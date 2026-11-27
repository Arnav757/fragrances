"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAnalysis, AnalysisError, emailPreviewLink, getAnalysisByToken, requestRevision, sendLinksForEmail } from "@/lib/services/analyses";
import { confirmCheckoutPayment, createOrder, ensureGatewayOrder, getOrder, PaymentError, quote, type Plan } from "@/lib/services/payments";
import { getMockGateway } from "@/lib/payments/gateway";
import { emailSchema, revisionSchema } from "@/lib/validation";
import { rateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { toActionError, type ActionResult } from "@/lib/forms";
import { getSettings, storeName } from "@/lib/settings";
import { formatINR } from "@/lib/money";
import { startUpiCheckout, submitUtr, type UpiCheckout } from "@/lib/services/upi";

export async function createAnalysisAction(form: FormData): Promise<ActionResult<{ token: string }>> {
  try {
    if (!(await rateLimit(`analysis:${await clientIp()}`, 8, 3600))) throw new RateLimitError();
    let quiz: unknown;
    let source: unknown;
    try {
      quiz = JSON.parse(String(form.get("quiz") ?? "{}"));
      source = JSON.parse(String(form.get("source") ?? "{}"));
    } catch {
      return { ok: false, message: "Something went wrong reading your answers. Please try again." };
    }
    const file = (k: string) => {
      const v = form.get(k);
      return v instanceof File && v.size > 0 ? v : null;
    };
    const r = await createAnalysis({ quiz, headshot: file("headshot"), fullbody: file("fullbody"), photoConsent: form.get("photoConsent") === "true", source });
    return { ok: true, data: { token: r.token } };
  } catch (e) {
    return toActionError(e, [AnalysisError]);
  }
}

export async function emailPreviewAction(token: string, email: string, marketing: boolean): Promise<ActionResult> {
  try {
    if (!(await rateLimit(`previewmail:${await clientIp()}`, 5, 3600))) throw new RateLimitError();
    await emailPreviewLink(token, emailSchema.parse(email), marketing === true);
    return { ok: true, message: "Sent. Check your inbox (and spam folder) for your link." };
  } catch (e) {
    return toActionError(e, [AnalysisError]);
  }
}

export async function quoteAction(token: string, plan: Plan, code: string): Promise<ActionResult<{ totalPaise: number; discountPaise: number; label: string }>> {
  try {
    if (!(await rateLimit(`quote:${await clientIp()}`, 30, 600))) throw new RateLimitError();
    if (!(await getAnalysisByToken(token))) return { ok: false, message: "Not found." };
    const q = await quote(z.enum(["standard", "priority"]).parse(plan), z.string().trim().max(30).parse(code));
    return { ok: true, data: { totalPaise: q.totalPaise, discountPaise: q.discountPaise, label: q.discountPaise ? `${formatINR(q.discountPaise)} off applied` : "" } };
  } catch (e) {
    return toActionError(e, [PaymentError]);
  }
}

export type StartPayment = {
  orderId: string;
  mode: "razorpay" | "mock";
  keyId: string;
  gatewayOrderId: string;
  amountPaise: number;
  storeName: string;
  orderNumber: string;
  prefill: { name: string; email: string; contact: string };
};

export async function startCheckoutAction(token: string, raw: unknown): Promise<ActionResult<StartPayment>> {
  try {
    if (!(await rateLimit(`checkout:${await clientIp()}`, 15, 3600))) throw new RateLimitError();
    const o = await createOrder(token, raw);
    const g = await ensureGatewayOrder(o.orderId);
    const store = await getSettings("store");
    return {
      ok: true,
      data: {
        orderId: o.orderId,
        mode: g.gateway.provider,
        keyId: g.gateway.publicKeyId,
        gatewayOrderId: g.gatewayOrderId,
        amountPaise: o.totalPaise,
        storeName: storeName(store),
        orderNumber: o.orderNumber,
        prefill: { name: g.order.contactName, email: g.order.contactEmail, contact: g.order.contactPhone },
      },
    };
  } catch (e) {
    return toActionError(e, [PaymentError, AnalysisError]);
  }
}

export async function startUpiCheckoutAction(token: string, raw: unknown): Promise<ActionResult<UpiCheckout>> {
  try {
    if (!(await rateLimit(`checkout:${await clientIp()}`, 15, 3600))) throw new RateLimitError();
    return { ok: true, data: await startUpiCheckout(token, raw) };
  } catch (e) {
    return toActionError(e, [PaymentError, AnalysisError]);
  }
}

export async function submitUtrAction(token: string, orderId: string, utr: string): Promise<ActionResult> {
  try {
    if (!(await rateLimit(`utr:${await clientIp()}`, 10, 3600))) throw new RateLimitError();
    await submitUtr(token, z.uuid().parse(orderId), utr);
    revalidatePath(`/s/${token}`);
    return { ok: true };
  } catch (e) {
    return toActionError(e, [PaymentError]);
  }
}

async function orderForToken(token: string, orderId: string) {
  const [a, o] = await Promise.all([getAnalysisByToken(token), getOrder(orderId)]);
  if (!a || !o || o.analysisId !== a.id) throw new PaymentError("Order not found.");
  return o;
}

export async function verifyPaymentAction(token: string, input: { orderId: string; gatewayOrderId: string; paymentId: string; signature: string }): Promise<ActionResult> {
  try {
    if (!(await rateLimit(`verify:${await clientIp()}`, 30, 600))) throw new RateLimitError();
    await orderForToken(token, input.orderId);
    await confirmCheckoutPayment(input);
    revalidatePath(`/s/${token}`);
    return { ok: true };
  } catch (e) {
    return toActionError(e, [PaymentError]);
  }
}

/** Test mode only: simulates the browser side of checkout against the mock gateway. */
export async function simulatePaymentAction(token: string, orderId: string, outcome: "success" | "failure"): Promise<ActionResult> {
  try {
    const mock = getMockGateway();
    if (!mock) return { ok: false, message: "Simulated payments are disabled." };
    const o = await orderForToken(token, orderId);
    if (!o.razorpayOrderId) throw new PaymentError("Payment wasn't started.");
    if (outcome === "failure") return { ok: false, message: "Simulated payment failed. No money was taken — you can try again." };
    const sim = mock.simulate(o.razorpayOrderId);
    await confirmCheckoutPayment({ orderId: o.id, gatewayOrderId: o.razorpayOrderId, paymentId: sim.paymentId, signature: sim.signature });
    revalidatePath(`/s/${token}`);
    return { ok: true };
  } catch (e) {
    return toActionError(e, [PaymentError]);
  }
}

export async function requestRevisionAction(token: string, message: string): Promise<ActionResult> {
  try {
    if (!(await rateLimit(`revision:${await clientIp()}`, 5, 3600))) throw new RateLimitError();
    await requestRevision(token, revisionSchema.parse({ message }).message);
    revalidatePath(`/s/${token}`);
    return { ok: true, message: "Got it — a stylist will update your report and email you." };
  } catch (e) {
    return toActionError(e, [AnalysisError]);
  }
}

export type FindState = { ok?: boolean; message?: string } | null;

export async function findReportAction(_: FindState, form: FormData): Promise<FindState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { message: "Enter a valid email address." };
  const ip = await clientIp();
  if (!(await rateLimit(`find:${ip}`, 5, 3600))) return { message: "Too many requests. Please try again later." };
  // Per-address cap so nobody can flood an inbox. Same answer either way (no account enumeration).
  if (await rateLimit(`find:email:${parsed.data}`, 3, 3600)) await sendLinksForEmail(parsed.data);
  return { ok: true, message: "If we have reports for that email, we've sent the links. Check your inbox and spam folder." };
}
