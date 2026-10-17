import "server-only";
import { db, type Tx } from "../db";
import { env } from "../env";
import { sha256 } from "../auth/crypto";
import { getGateway, GatewayError, verifyWebhookSignature, type GatewayPayment, type PaymentGateway } from "../payments/gateway";
import { clearCart } from "./orders";
import { notifyCustomer } from "./notify";
import type { OrderStatus, PaymentStatus } from "../order-status";

export class PaymentError extends Error {}

type PayableOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "razorpay" | "cod";
  totalPaise: number;
  razorpayOrderId: string | null;
  cartId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

async function loadPayable(where: { id?: string; gatewayOrderId?: string }, q: Tx | ReturnType<typeof db>, lock = false) {
  const rows = await q<PayableOrder[]>`
    select id, order_number, status, payment_status, payment_method, total_paise, razorpay_order_id, cart_id,
      contact_name, contact_email, contact_phone
    from orders
    where ${where.id ? q`id = ${where.id}` : q`razorpay_order_id = ${where.gatewayOrderId ?? ""}`}
    ${lock ? q`for update` : q``}`;
  return rows[0] ?? null;
}

/** Ensure a gateway order exists for an unpaid online order (created once, reused for retries). */
export async function ensureGatewayOrder(orderId: string, gateway: PaymentGateway | null = getGateway()) {
  if (!gateway) throw new PaymentError("Online payments are not configured.");
  const o = await loadPayable({ id: orderId }, db());
  if (!o) throw new PaymentError("Order not found.");
  if (o.paymentMethod !== "razorpay") throw new PaymentError("This order is not an online payment order.");
  if (!["awaiting_payment", "payment_failed"].includes(o.status) || !["pending", "failed"].includes(o.paymentStatus)) {
    throw new PaymentError("This order can't be paid.");
  }
  if (o.razorpayOrderId && o.razorpayOrderId.startsWith(gateway.provider === "mock" ? "mock_" : "order_")) {
    return { gatewayOrderId: o.razorpayOrderId, order: o, gateway };
  }
  const created = await gateway.createOrder({ amountPaise: o.totalPaise, receipt: o.orderNumber, notes: { order_id: o.id, order_number: o.orderNumber } });
  const updated = await db()<{ razorpayOrderId: string }[]>`
    update orders set razorpay_order_id = coalesce(razorpay_order_id, ${created.id}) where id = ${o.id} returning razorpay_order_id`;
  return { gatewayOrderId: updated[0]!.razorpayOrderId, order: o, gateway };
}

export type MarkPaidResult = { result: "paid" | "already_paid" | "paid_on_cancelled_order"; orderId: string };

/**
 * Idempotently records a captured payment and confirms the order. Safe to call from both the
 * checkout callback and the webhook in any order, any number of times.
 */
export async function markOrderPaid(
  gatewayOrderId: string,
  payment: GatewayPayment,
  provider: "razorpay" | "mock",
): Promise<MarkPaidResult> {
  const sql = db();
  const res = await sql.begin(async (tx) => {
    const o = await loadPayable({ gatewayOrderId }, tx, true);
    if (!o) throw new PaymentError("No order matches this payment.");
    if (payment.currency !== "INR" || payment.amountPaise !== o.totalPaise) {
      await tx`insert into fulfillment_events (order_id, message) values (${o.id}, ${`Payment ${payment.id} amount/currency mismatch: ${payment.amountPaise} ${payment.currency}`})`;
      throw new PaymentError("Payment amount does not match the order total.");
    }
    await tx`
      insert into payments (order_id, provider, provider_order_id, provider_payment_id, amount_paise, status, method, fee_paise, fee_tax_paise, raw)
      values (${o.id}, ${provider}, ${gatewayOrderId}, ${payment.id}, ${payment.amountPaise}, 'captured', ${payment.method},
              ${payment.feePaise}, ${payment.feeTaxPaise}, ${tx.json((payment.raw ?? {}) as never)})
      on conflict (provider_payment_id) do update set status = 'captured',
        fee_paise = coalesce(excluded.fee_paise, payments.fee_paise), fee_tax_paise = coalesce(excluded.fee_tax_paise, payments.fee_tax_paise)`;

    if (o.paymentStatus === "paid" || o.paymentStatus === "refunded" || o.paymentStatus === "partially_refunded") {
      return { result: "already_paid" as const, orderId: o.id, notify: false };
    }
    if (o.status === "cancelled") {
      await tx`update orders set payment_status = 'paid', paid_at = now() where id = ${o.id}`;
      await tx`insert into fulfillment_events (order_id, message) values (${o.id}, 'ACTION NEEDED: payment captured on a cancelled order — refund or reinstate')`;
      return { result: "paid_on_cancelled_order" as const, orderId: o.id, notify: false };
    }
    await tx`update orders set payment_status = 'paid', paid_at = now(),
               status = case when status in ('awaiting_payment', 'payment_failed') then 'confirmed'::order_status else status end
             where id = ${o.id}`;
    await tx`insert into fulfillment_events (order_id, from_status, to_status, message, customer_visible)
             values (${o.id}, ${o.status}, 'confirmed', 'Payment received — order confirmed', true)`;
    if (o.cartId) await clearCart(o.cartId, tx);
    return { result: "paid" as const, orderId: o.id, notify: true };
  });
  if (res.notify) await notifyCustomer(res.orderId, { kind: "payment_confirmation" });
  return { result: res.result, orderId: res.orderId };
}

async function recordPaymentFailure(gatewayOrderId: string, p: GatewayPayment, provider: "razorpay" | "mock") {
  await db().begin(async (tx) => {
    const o = await loadPayable({ gatewayOrderId }, tx, true);
    if (!o) return;
    await tx`
      insert into payments (order_id, provider, provider_order_id, provider_payment_id, amount_paise, status, method, error_code, error_description, raw)
      values (${o.id}, ${provider}, ${gatewayOrderId}, ${p.id}, ${p.amountPaise}, 'failed', ${p.method}, ${p.errorCode}, ${p.errorDescription}, ${tx.json((p.raw ?? {}) as never)})
      on conflict (provider_payment_id) do nothing`;
    if (o.paymentStatus === "pending" || o.paymentStatus === "failed") {
      await tx`update orders set payment_status = 'failed', status = case when status = 'awaiting_payment' then 'payment_failed'::order_status else status end where id = ${o.id}`;
      await tx`insert into fulfillment_events (order_id, from_status, to_status, message, customer_visible)
               values (${o.id}, ${o.status}, 'payment_failed', 'Payment attempt failed — you can retry', true)`;
    }
  });
}

/**
 * Called by the browser after Razorpay Checkout reports success. The client's claim is not trusted:
 * we verify the HMAC signature, then fetch the payment from the gateway and check status and amount.
 */
export async function confirmCheckoutPayment(input: { orderId: string; gatewayOrderId: string; paymentId: string; signature: string }) {
  const gateway = getGateway();
  if (!gateway) throw new PaymentError("Online payments are not configured.");
  const o = await loadPayable({ id: input.orderId }, db());
  if (!o || !o.razorpayOrderId || o.razorpayOrderId !== input.gatewayOrderId) throw new PaymentError("Payment does not match this order.");
  if (!gateway.verifyCheckoutSignature(input.gatewayOrderId, input.paymentId, input.signature)) {
    throw new PaymentError("Payment signature verification failed.");
  }
  let payment: GatewayPayment;
  try {
    payment = await gateway.fetchPayment(input.paymentId, o.totalPaise);
  } catch (e) {
    throw new PaymentError(e instanceof GatewayError ? e.message : "Could not confirm payment with the provider.");
  }
  if (payment.orderId && payment.orderId !== input.gatewayOrderId) throw new PaymentError("Payment does not match this order.");
  if (payment.status === "captured") return markOrderPaid(input.gatewayOrderId, payment, gateway.provider);
  if (payment.status === "authorized") {
    await db()`
      insert into payments (order_id, provider, provider_order_id, provider_payment_id, amount_paise, status, method)
      values (${o.id}, ${gateway.provider}, ${input.gatewayOrderId}, ${payment.id}, ${payment.amountPaise}, 'authorized', ${payment.method})
      on conflict (provider_payment_id) do nothing`;
    await db()`update orders set payment_status = 'authorized' where id = ${o.id} and payment_status in ('pending', 'failed')`;
    return { result: "authorized" as const, orderId: o.id };
  }
  if (payment.status === "failed") {
    await recordPaymentFailure(input.gatewayOrderId, payment, gateway.provider);
    throw new PaymentError(payment.errorDescription ?? "Payment failed.");
  }
  throw new PaymentError(`Payment is ${payment.status}; we'll update your order when it completes.`);
}

/** Records a failed attempt reported by Checkout (we still verify against the gateway via webhook). */
export async function recordClientReportedFailure(orderId: string, description: string | null) {
  await db()`insert into fulfillment_events (order_id, message) values (${orderId}, ${`Checkout reported failure: ${(description ?? "unknown").slice(0, 200)}`})`;
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

/**
 * Razorpay webhook handler. Verifies the signature over the raw body, deduplicates on the
 * x-razorpay-event-id header, and processes each event at most once.
 */
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
    const paymentEntity = event.payload?.payment?.entity as RazorpayPaymentEntity | undefined;
    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        if (paymentEntity?.order_id && paymentEntity.status === "captured") {
          await markOrderPaid(paymentEntity.order_id, toGatewayPayment(paymentEntity), "razorpay");
        }
        break;
      }
      case "payment.authorized": {
        if (paymentEntity?.order_id) {
          await db()`update orders set payment_status = 'authorized' where razorpay_order_id = ${paymentEntity.order_id} and payment_status in ('pending', 'failed')`;
        }
        break;
      }
      case "payment.failed": {
        if (paymentEntity?.order_id) await recordPaymentFailure(paymentEntity.order_id, toGatewayPayment(paymentEntity), "razorpay");
        break;
      }
      case "refund.processed":
      case "refund.failed": {
        const r = event.payload?.refund?.entity as { id: string } | undefined;
        if (r?.id) {
          const status = event.event === "refund.processed" ? "processed" : "failed";
          const updated = await db()<{ orderId: string; amountPaise: number }[]>`
            update refunds set status = ${status} where provider_refund_id = ${r.id} and status <> ${status} returning order_id, amount_paise`;
          if (updated[0]) await notifyCustomer(updated[0].orderId, { kind: "refund_status", amountPaise: updated[0].amountPaise, status, viaGateway: true });
        }
        break;
      }
      default:
        break;
    }
    await db()`update webhook_events set processed_at = now(), error = null where provider = 'razorpay' and event_id = ${eventId}`;
    return { status: 200, body: "ok" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    await db()`update webhook_events set error = ${msg.slice(0, 500)} where provider = 'razorpay' and event_id = ${eventId}`;
    // A payment that can't be matched won't succeed on retry; anything else should be retried by Razorpay.
    return e instanceof PaymentError ? { status: 200, body: "recorded" } : { status: 500, body: "error" };
  }
}
