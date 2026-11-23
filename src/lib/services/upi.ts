import "server-only";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "../db";
import { getSettings, storeName, type PaymentsSettings } from "../settings";
import { getAnalysisByToken } from "./analyses";
import { audit } from "./audit";
import { createOrder, getOrder, markOrderPaid, PaymentError } from "./payments";

/**
 * Manual UPI payments (temporary, until Razorpay is live). The customer scans a QR that carries the exact
 * amount and order number, pays from any UPI app and submits the 12-digit UTR. Nothing is unlocked until an
 * admin has seen the money arrive and confirms the payment; confirmation goes through markOrderPaid, so the
 * report unlocks and the confirmation email goes out exactly as for a gateway payment.
 */

export const utrSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{12}$/, { error: "Enter the 12-digit UPI transaction ID (UTR / reference number) from your payment app." }));

export function upiReady(p: PaymentsSettings): boolean {
  return p.upiEnabled && p.upiId.length > 0;
}

export function upiUri(p: PaymentsSettings, name: string, amountPaise: number, orderNumber: string): string {
  const params = new URLSearchParams({
    pa: p.upiId,
    pn: (p.upiName || name).slice(0, 50),
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: `${orderNumber} ${name}`.slice(0, 50),
  });
  return `upi://pay?${params.toString().replace(/\+/g, "%20").replace(/%40/g, "@")}`;
}

export type UpiCheckout = { orderId: string; orderNumber: string; amountPaise: number; uri: string; qrSvg: string; upiId: string; payee: string };

/** Creates the order (amount computed on the server) and returns the QR for it. */
export async function startUpiCheckout(token: string, raw: unknown): Promise<UpiCheckout> {
  const [payments, store] = await Promise.all([getSettings("payments"), getSettings("store")]);
  if (!upiReady(payments)) throw new PaymentError("UPI payments aren't available right now.");
  const o = await createOrder(token, raw);
  const name = storeName(store);
  const uri = upiUri(payments, name, o.totalPaise, o.orderNumber);
  const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#17191d", light: "#ffffff" } });
  return { orderId: o.orderId, orderNumber: o.orderNumber, amountPaise: o.totalPaise, uri, qrSvg, upiId: payments.upiId, payee: payments.upiName || name };
}

/** The customer's claim that they paid: recorded as pending until an admin confirms it. */
export async function submitUtr(token: string, orderId: string, rawUtr: unknown) {
  const parsed = utrSchema.safeParse(rawUtr);
  if (!parsed.success) throw new PaymentError(parsed.error.issues[0]?.message ?? "Enter the 12-digit UPI transaction ID.");
  const utr = parsed.data;
  const [a, o] = await Promise.all([getAnalysisByToken(token), getOrder(orderId)]);
  if (!a || !o || o.analysisId !== a.id) throw new PaymentError("Order not found.");
  if (a.status !== "preview") throw new PaymentError("This report is already unlocked.");
  if (o.status !== "awaiting_payment" && o.status !== "payment_failed") throw new PaymentError("This order can't be paid any more. Please start again.");
  const pending = await db()`select 1 from payments p join orders o on o.id = p.order_id
                             where o.analysis_id = ${a.id} and p.provider = 'upi' and p.status = 'pending'`;
  if (pending.length) throw new PaymentError("We already have a payment waiting to be checked for this report.");
  try {
    await db()`
      insert into payments (order_id, provider, provider_order_id, provider_payment_id, amount_paise, status, method)
      values (${o.id}, 'upi', ${`upi_${o.orderNumber}`}, ${`upi_${utr}`}, ${o.totalPaise}, 'pending', 'upi')`;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new PaymentError("That transaction ID has already been submitted. Check the number in your payment app.");
    throw e;
  }
  await db()`insert into analysis_events (analysis_id, message, customer_visible)
             values (${a.id}, ${`UPI payment submitted (UTR ${utr}) — waiting for confirmation`}, true)`;
}

export type PendingUpi = { paymentId: string; orderId: string; orderNumber: string; utr: string; amountPaise: number; createdAt: Date };

export async function pendingUpiFor(analysisId: string): Promise<PendingUpi | null> {
  const rows = await db()<PendingUpi[]>`
    select p.id as payment_id, o.id as order_id, o.order_number, substr(p.provider_payment_id, 5) as utr, p.amount_paise, p.created_at
    from payments p join orders o on o.id = p.order_id
    where o.analysis_id = ${analysisId} and p.provider = 'upi' and p.status = 'pending' order by p.created_at desc limit 1`;
  return rows[0] ?? null;
}

export type UpiQueueRow = PendingUpi & { analysisId: string; ref: string; contactName: string; contactEmail: string; contactPhone: string };

export async function upiQueue(): Promise<UpiQueueRow[]> {
  return db()<UpiQueueRow[]>`
    select p.id as payment_id, o.id as order_id, o.order_number, substr(p.provider_payment_id, 5) as utr, p.amount_paise, p.created_at,
           o.analysis_id, a.ref, o.contact_name, o.contact_email, o.contact_phone
    from payments p join orders o on o.id = p.order_id join analyses a on a.id = o.analysis_id
    where p.provider = 'upi' and p.status = 'pending' order by p.created_at`;
}

async function loadPending(paymentId: string) {
  const rows = await db()<{ id: string; orderId: string; providerPaymentId: string; amountPaise: number; orderNumber: string; totalPaise: number }[]>`
    select p.id, p.order_id, p.provider_payment_id, p.amount_paise, o.order_number, o.total_paise
    from payments p join orders o on o.id = p.order_id where p.id = ${paymentId} and p.provider = 'upi' and p.status = 'pending'`;
  if (!rows[0]) throw new PaymentError("This payment isn't waiting for confirmation (already handled?).");
  return rows[0];
}

/** Admin has seen the money in their bank/UPI app: unlock exactly as a gateway payment would. */
export async function confirmUpi(paymentId: string, actorId: string) {
  const p = await loadPending(z.uuid().parse(paymentId));
  const gatewayOrderId = `upi_${p.orderNumber}`;
  await db()`update orders set razorpay_order_id = ${gatewayOrderId} where id = ${p.orderId}`;
  const r = await markOrderPaid(
    gatewayOrderId,
    { id: p.providerPaymentId, orderId: gatewayOrderId, amountPaise: p.totalPaise, currency: "INR", status: "captured", method: "upi", feePaise: 0, feeTaxPaise: 0, errorCode: null, errorDescription: null, raw: { confirmedBy: actorId } },
    "upi",
  );
  await audit(actorId, "order.upi_confirm", "order", p.orderId, { utr: p.providerPaymentId.slice(4), result: r.result });
  return r;
}

/** Money never arrived (or wrong amount): the customer can pay again and submit a new UTR. */
export async function rejectUpi(paymentId: string, actorId: string, reason: string) {
  const p = await loadPending(z.uuid().parse(paymentId));
  await db()`update payments set status = 'rejected', error_description = ${reason.slice(0, 300) || "Not received"} where id = ${p.id}`;
  const a = await db()<{ analysisId: string }[]>`select analysis_id from orders where id = ${p.orderId}`;
  if (a[0]) {
    await db()`insert into analysis_events (analysis_id, message, customer_visible)
               values (${a[0].analysisId}, 'We could not find your UPI payment. Please check the transaction ID or pay again.', true)`;
  }
  await audit(actorId, "order.upi_reject", "order", p.orderId, { utr: p.providerPaymentId.slice(4), reason });
}
