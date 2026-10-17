import { handleRazorpayWebhook } from "@/lib/services/payments";

export const dynamic = "force-dynamic";

/** Razorpay webhook endpoint. Configure in the Razorpay dashboard with events: payment.captured, payment.failed, payment.authorized, order.paid, refund.processed, refund.failed. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return new Response("payload too large", { status: 413 });
  const r = await handleRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"), req.headers.get("x-razorpay-event-id"));
  return new Response(r.body, { status: r.status });
}
