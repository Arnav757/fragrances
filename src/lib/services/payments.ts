import "server-only";
import { z } from "zod";
import { db, type Tx } from "../db";
import { env } from "../env";
import { sha256 } from "../auth/crypto";
import { getGateway, GatewayError, verifyWebhookSignature, type GatewayPayment, type PaymentGateway } from "../payments/gateway";
import { checkoutSchema } from "../validation";
import { getSettings, includedTax, type PricingSettings } from "../settings";
import { emailContext, sendEmail } from "../email/send";
import { templates } from "../email/templates";
import { formatDate } from "../utils";
import { getAnalysisByToken, linkTokenFor, reportUrl } from "./analyses";
import { audit } from "./audit";

export class PaymentError extends Error {}

export type Plan = "standard" | "priority";

export function planPrice(p: PricingSettings, plan: Plan): { paise: number; hours: number } {
  if (plan === "priority") {
    if (!p.priorityEnabled) throw new PaymentError("Priority review isn't available right now.");
    return { paise: p.priorityPaise, hours: p.priorityHours };
  }
  return { paise: p.standardPaise, hours: p.standardHours };
}

type DiscountRow = { code: string; type: "percent" | "fixed"; value: number; maxUses: number | null; usedCount: number; endsAt: Date | null; isActive: boolean };

/** Validates a discount code and returns the discount in paise. Never discounts below ₹1. */
export async function discountFor(code: string, listPaise: number, q: Tx | ReturnType<typeof db> = db()): Promise<{ code: string; discountPaise: number }> {
  const rows = await q<DiscountRow[]>`select code, type, value, max_uses, used_count, ends_at, is_active from discounts where code = ${code}`;
  const d = rows[0];
  if (!d || !d.isActive || (d.endsAt && d.endsAt < new Date()) || (d.maxUses !== null && d.usedCount >= d.maxUses)) {
    throw new PaymentError("That code isn't valid or has expired.");
  }
  const raw = d.type === "percent" ? Math.round((listPaise * d.value) / 10000) : d.value;
  return { code: d.code, discountPaise: Math.min(raw, listPaise - 100) };
}

export async function quote(plan: Plan, code: string) {
  const pricing = await getSettings("pricing");
  const { paise, hours } = planPrice(pricing, plan);
  const discount = code ? await discountFor(code, paise) : { code: null, discountPaise: 0 };
  const total = paise - discount.discountPaise;
  return { listPaise: paise, discountPaise: discount.discountPaise, code: discount.code, totalPaise: total, hours, taxPaise: includedTax(total, pricing.gstRateBp), taxRateBp: pricing.gstRateBp };
}

/** Creates an order for an analysis. The amount is always computed on the server. */
export async function createOrder(token: string, raw: unknown): Promise<{ orderId: string; orderNumber: string; totalPaise: number }> {
  const input = checkoutSchema.parse(raw);
  const a = await getAnalysisByToken(token);
  if (!a) throw new PaymentError("We couldn't find this analysis.");
  if (a.status !== "preview") throw new PaymentError("This report is already unlocked.");
  const q = await quote(input.plan, input.discountCode);
  const rows = await db()<{ id: string; orderNumber: string }[]>`
    insert into orders (order_number, analysis_id, plan, contact_name, contact_email, contact_phone, list_price_paise, discount_paise,
                        discount_code, total_paise, tax_rate_bp, tax_paise)
    values ('FMO-' || nextval('order_number_seq')::text, ${a.id}, ${input.plan}, ${input.contactName}, ${input.email}, ${input.phone},
            ${q.listPaise}, ${q.discountPaise}, ${q.code}, ${q.totalPaise}, ${q.taxRateBp}, ${q.taxPaise})
    returning id, order_number`;
  await db()`update analyses set email = ${input.email}, phone = ${input.phone}, marketing_consent = marketing_consent or ${input.marketingConsent} where id = ${a.id}`;
  return { orderId: rows[0]!.id, orderNumber: rows[0]!.orderNumber, totalPaise: q.totalPaise };
}

type PayableOrder = {
  id: string;
  orderNumber: string;
  analysisId: string;
  plan: Plan;
  status: "awaiting_payment" | "paid" | "payment_failed" | "expired" | "refunded";
  totalPaise: number;
  razorpayOrderId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  discountCode: string | null;
};

async function loadOrder(where: { id?: string; gatewayOrderId?: string }, q: Tx | ReturnType<typeof db>, lock = false) {
  const rows = await q<PayableOrder[]>`
    select id, order_number, analysis_id, plan, status, total_paise, razorpay_order_id, contact_name, contact_email, contact_phone, discount_code
    from orders where ${where.id ? q`id = ${where.id}` : q`razorpay_order_id = ${where.gatewayOrderId ?? ""}`}
    ${lock ? q`for update` : q``}`;
  return rows[0] ?? null;
}

export async function getOrder(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return loadOrder({ id }, db());
}

/** Ensure a gateway order exists for an unpaid order (created once, reused for retries). */
export async function ensureGatewayOrder(orderId: string, gateway: PaymentGateway | null = getGateway()) {
  if (!gateway) throw new PaymentError("Online payments are not configured.");
  const o = await loadOrder({ id: orderId }, db());
  if (!o) throw new PaymentError("Order not found.");
  if (o.status !== "awaiting_payment" && o.status !== "payment_failed") throw new PaymentError("This order can't be paid.");
  if (o.razorpayOrderId && o.razorpayOrderId.startsWith(gateway.provider === "mock" ? "mock_" : "order_")) return { gatewayOrderId: o.razorpayOrderId, order: o, gateway };
  const created = await gateway.createOrder({ amountPaise: o.totalPaise, receipt: o.orderNumber, notes: { order_id: o.id, order_number: o.orderNumber } });
  const updated = await db()<{ razorpayOrderId: string }[]>`
    update orders set razorpay_order_id = coalesce(razorpay_order_id, ${created.id}) where id = ${o.id} returning razorpay_order_id`;
  return { gatewayOrderId: updated[0]!.razorpayOrderId, order: o, gateway };
}

export type MarkPaidResult = { result: "paid" | "already_paid" | "duplicate_payment"; orderId: string; analysisId: string };

/**
 * Idempotently records a captured payment, unlocks the report and starts the stylist review clock.
 * Safe to call from both the checkout callback and the webhook in any order, any number of times.
 */
export async function markOrderPaid(gatewayOrderId: string, payment: GatewayPayment, provider: "razorpay" | "mock" | "upi"): Promise<MarkPaidResult> {
  const pricing = await getSettings("pricing");
  const res = await db().begin(async (tx) => {
    const o = await loadOrder({ gatewayOrderId }, tx, true);
    if (!o) throw new PaymentError("No order matches this payment.");
    if (payment.currency !== "INR" || payment.amountPaise !== o.totalPaise) {
      await tx`insert into analysis_events (analysis_id, message) values (${o.analysisId}, ${`Payment ${payment.id} amount/currency mismatch: ${payment.amountPaise} ${payment.currency}`})`;
      throw new PaymentError("Payment amount does not match the order total.");
    }
    await tx`
      insert into payments (order_id, provider, provider_order_id, provider_payment_id, amount_paise, status, method, fee_paise, raw)
      values (${o.id}, ${provider}, ${gatewayOrderId}, ${payment.id}, ${payment.amountPaise}, 'captured', ${payment.method}, ${payment.feePaise},
              ${tx.json((payment.raw ?? {}) as never)})
      on conflict (provider_payment_id) do update set status = 'captured', fee_paise = coalesce(excluded.fee_paise, payments.fee_paise)`;
    if (o.status === "paid" || o.status === "refunded") return { result: "already_paid" as const, o, notify: false };

    const a = await tx<{ status: string }[]>`select status from analyses where id = ${o.analysisId} for update`;
    await tx`update orders set status = 'paid', paid_at = now() where id = ${o.id}`;
    if (o.discountCode) await tx`update discounts set used_count = used_count + 1 where code = ${o.discountCode}`;
    if (a[0]?.status !== "preview") {
      // Already unlocked through another order (e.g. two tabs). Keep the money visible for a refund.
      await tx`insert into analysis_events (analysis_id, message) values (${o.analysisId}, ${`ACTION NEEDED: duplicate payment on order ${o.orderNumber} — refund it`})`;
      return { result: "duplicate_payment" as const, o, notify: false };
    }
    const hours = o.plan === "priority" ? pricing.priorityHours : pricing.standardHours;
    await tx`update analyses set status = 'paid', plan = ${o.plan}, paid_at = now(), due_at = now() + make_interval(hours => ${hours}),
               email = ${o.contactEmail}, phone = ${o.contactPhone} where id = ${o.analysisId}`;
    await tx`insert into analysis_events (analysis_id, message, customer_visible)
             values (${o.analysisId}, 'Payment received — full report unlocked and sent for stylist review', true)`;
    return { result: "paid" as const, o, notify: true };
  });

  if (res.notify) {
    const row = await db()<{ ref: string; firstName: string; tokenSealed: string; dueAt: Date }[]>`
      select ref, first_name, token_sealed, due_at from analyses where id = ${res.o.analysisId}`;
    const token = row[0] ? linkTokenFor(row[0].tokenSealed) : null;
    if (row[0] && token) {
      const ctx = await emailContext();
      await sendEmail(
        res.o.contactEmail,
        "payment_confirmation",
        templates.payment_confirmation(ctx, {
          name: row[0].firstName,
          ref: row[0].ref,
          url: reportUrl(token),
          amountPaise: res.o.totalPaise,
          orderNumber: res.o.orderNumber,
          reviewBy: formatDate(row[0].dueAt, true),
        }),
        res.o.analysisId,
      );
    }
  }
  return { result: res.result, orderId: res.o.id, analysisId: res.o.analysisId };
}

async function recordPaymentFailure(gatewayOrderId: string, p: GatewayPayment, provider: "razorpay" | "mock") {
  await db().begin(async (tx) => {
    const o = await loadOrder({ gatewayOrderId }, tx, true);
    if (!o) return;
    await tx`
      insert into payments (order_id, provider, provider_order_id, provider_payment_id, amount_paise, status, method, error_description, raw)
      values (${o.id}, ${provider}, ${gatewayOrderId}, ${p.id}, ${p.amountPaise}, 'failed', ${p.method}, ${p.errorDescription}, ${tx.json((p.raw ?? {}) as never)})
      on conflict (provider_payment_id) do nothing`;
    if (o.status === "awaiting_payment") await tx`update orders set status = 'payment_failed' where id = ${o.id}`;
  });
}

/**
 * Called by the browser after Razorpay Checkout reports success. The client's claim is not trusted:
 * we verify the HMAC signature, then fetch the payment from the gateway and check status and amount.
 */
export async function confirmCheckoutPayment(input: { orderId: string; gatewayOrderId: string; paymentId: string; signature: string }) {
  const gateway = getGateway();
  if (!gateway) throw new PaymentError("Online payments are not configured.");
  const o = await loadOrder({ id: input.orderId }, db());
  if (!o || !o.razorpayOrderId || o.razorpayOrderId !== input.gatewayOrderId) throw new PaymentError("Payment does not match this order.");
  if (!gateway.verifyCheckoutSignature(input.gatewayOrderId, input.paymentId, input.signature)) throw new PaymentError("Payment signature verification failed.");
  let payment: GatewayPayment;
  try {
    payment = await gateway.fetchPayment(input.paymentId, o.totalPaise);
  } catch (e) {
    throw new PaymentError(e instanceof GatewayError ? e.message : "Could not confirm payment with the provider.");
  }
  if (payment.orderId && payment.orderId !== input.gatewayOrderId) throw new PaymentError("Payment does not match this order.");
  if (payment.status === "captured") return markOrderPaid(input.gatewayOrderId, payment, gateway.provider);
  if (payment.status === "failed") {
    await recordPaymentFailure(input.gatewayOrderId, payment, gateway.provider);
    throw new PaymentError(payment.errorDescription ?? "Payment failed.");
  }
  throw new PaymentError(`Payment is ${payment.status}; we'll unlock your report automatically as soon as it completes.`);
}

// ------------------------------------------------------------------ refunds

export async function refundOrder(orderId: string, actorId: string, reason: string) {
  const o = await getOrder(orderId);
  if (!o) throw new PaymentError("Order not found.");
  if (o.status !== "paid") throw new PaymentError("Only paid orders can be refunded.");
  const pay = await db()<{ providerPaymentId: string; provider: "razorpay" | "mock" | "upi" }[]>`
    select provider_payment_id, provider from payments where order_id = ${o.id} and status = 'captured' order by created_at desc limit 1`;
  if (!pay[0]) throw new PaymentError("No captured payment found for this order.");
  if (pay[0].provider === "upi") return recordManualRefund(o, actorId, reason);
  const gateway = getGateway();
  if (!gateway || gateway.provider !== pay[0].provider) throw new PaymentError("The payment provider for this order isn't configured.");
  const r = await gateway.refund(pay[0].providerPaymentId, o.totalPaise, { order_number: o.orderNumber });
  await db().begin(async (tx) => {
    await tx`insert into refunds (order_id, amount_paise, provider_refund_id, status, reason, created_by)
             values (${o.id}, ${o.totalPaise}, ${r.id}, ${r.status}, ${reason || null}, ${actorId})`;
    await tx`update orders set status = 'refunded', refunded_at = now() where id = ${o.id}`;
    await tx`insert into analysis_events (analysis_id, message, customer_visible, actor_id) values (${o.analysisId}, 'Refund initiated', true, ${actorId})`;
  });
  await audit(actorId, "order.refund", "order", o.id, { amountPaise: o.totalPaise, reason });
  const a = await db()<{ ref: string; firstName: string }[]>`select ref, first_name from analyses where id = ${o.analysisId}`;
  const ctx = await emailContext();
  await sendEmail(o.contactEmail, "refund", templates.refund(ctx, { name: a[0]!.firstName, ref: a[0]!.ref, amountPaise: o.totalPaise }), o.analysisId);
}

/** UPI payments are refunded by the admin from their own UPI app; this records it and tells the customer. */
async function recordManualRefund(o: PayableOrder, actorId: string, reason: string) {
  await db().begin(async (tx) => {
    await tx`insert into refunds (order_id, amount_paise, status, reason, created_by) values (${o.id}, ${o.totalPaise}, 'manual', ${reason || null}, ${actorId})`;
    await tx`update orders set status = 'refunded', refunded_at = now() where id = ${o.id}`;
    await tx`insert into analysis_events (analysis_id, message, customer_visible, actor_id) values (${o.analysisId}, 'Refund sent by UPI', true, ${actorId})`;
  });
  await audit(actorId, "order.refund", "order", o.id, { amountPaise: o.totalPaise, reason, manual: true });
  const a = await db()<{ ref: string; firstName: string }[]>`select ref, first_name from analyses where id = ${o.analysisId}`;
  const ctx = await emailContext();
  await sendEmail(o.contactEmail, "refund", templates.refund(ctx, { name: a[0]!.firstName, ref: a[0]!.ref, amountPaise: o.totalPaise }), o.analysisId);
}

// ------------------------------------------------------------------ webhooks

type RazorpayPaymentEntity = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: GatewayPayment["status"];
  method: string | null;
  fee?: number | null;
  tax?: number | null;
  error_code?: string | null;
  error_description?: string | null;
};

function toGatewayPayment(p: RazorpayPaymentEntity): GatewayPayment {
  return {
    id: p.id,
    orderId: p.order_id,
    amountPaise: p.amount,
    currency: p.currency,
    status: p.status,
    method: p.method,
    feePaise: p.fee ?? null,
    feeTaxPaise: p.tax ?? null,
    errorCode: p.error_code ?? null,
    errorDescription: p.error_description ?? null,
    raw: p,
  };
}

export type WebhookOutcome = { status: number; body: string };

/** Razorpay webhook: verifies the signature over the raw body and processes each event at most once. */
export async function handleRazorpayWebhook(rawBody: string, signature: string | null, eventIdHeader: string | null): Promise<WebhookOutcome> {
  const secret = env().RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return { status: 503, body: "webhook secret not configured" };
  if (!verifyWebhookSignature(rawBody, signature, secret)) return { status: 401, body: "invalid signature" };

  let event: { event: string; payload: Record<string, { entity: Record<string, unknown> }> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "invalid json" };
  }
  const eventId = eventIdHeader?.slice(0, 100) || `body:${sha256(rawBody)}`;
  const inserted = await db()<{ id: string }[]>`
    insert into webhook_events (provider, event_id, event_type, payload)
    values ('razorpay', ${eventId}, ${event.event ?? "unknown"}, ${db().json(event as never)})
    on conflict (provider, event_id) do nothing returning id`;
  if (!inserted[0]) {
    const prior = await db()<{ processedAt: Date | null }[]>`select processed_at from webhook_events where provider = 'razorpay' and event_id = ${eventId}`;
    if (prior[0]?.processedAt) return { status: 200, body: "duplicate" };
  }

  try {
    const p = event.payload?.payment?.entity as RazorpayPaymentEntity | undefined;
    if ((event.event === "payment.captured" || event.event === "order.paid") && p?.order_id && p.status === "captured") {
      await markOrderPaid(p.order_id, toGatewayPayment(p), "razorpay");
    } else if (event.event === "payment.failed" && p?.order_id) {
      await recordPaymentFailure(p.order_id, toGatewayPayment(p), "razorpay");
    } else if (event.event === "refund.processed" || event.event === "refund.failed") {
      const r = event.payload?.refund?.entity as { id: string } | undefined;
      if (r?.id) await db()`update refunds set status = ${event.event === "refund.processed" ? "processed" : "failed"} where provider_refund_id = ${r.id}`;
    }
    await db()`update webhook_events set processed_at = now(), error = null where provider = 'razorpay' and event_id = ${eventId}`;
    return { status: 200, body: "ok" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    await db()`update webhook_events set error = ${msg.slice(0, 500)} where provider = 'razorpay' and event_id = ${eventId}`;
    return e instanceof PaymentError ? { status: 200, body: "recorded" } : { status: 500, body: "error" };
  }
}
