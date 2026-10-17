"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getCartId } from "@/lib/services/cart";
import { CheckoutError, createOrder, getOrderDetail } from "@/lib/services/orders";
import { canViewOrder, guestOrderToken } from "@/lib/services/order-access";
import { confirmCheckoutPayment, ensureGatewayOrder, PaymentError, recordClientReportedFailure } from "@/lib/services/payments";
import { getGateway, getMockGateway, GatewayError } from "@/lib/payments/gateway";
import { getSettings, storeName } from "@/lib/settings";
import { rateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { toActionError, type ActionResult } from "@/lib/forms";
import { db } from "@/lib/db";

export type PlaceOrderResult = ActionResult<{ redirectTo: string }> & { newTotalPaise?: number | null };

function orderPath(o: { orderNumber: string; id: string; userId: string | null }, pay: boolean) {
  const base = pay ? `/checkout/pay/${o.orderNumber}` : `/order/${o.orderNumber}`;
  return o.userId ? base : `${base}?t=${guestOrderToken(o.id)}`;
}

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  try {
    if (!(await rateLimit(`checkout:${await clientIp()}`, 15, 600))) throw new RateLimitError();
    const [user, cartId] = await Promise.all([getCurrentUser(), getCartId()]);
    const order = await createOrder(input as never, { user, cartId });
    const full = await getOrderDetail({ id: order.id });
    const needsPayment = full!.paymentMethod === "razorpay" && ["pending", "failed"].includes(full!.paymentStatus);
    return { ok: true, data: { redirectTo: orderPath(full!, needsPayment) } };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, message: e.message, newTotalPaise: e.newTotalPaise };
    return toActionError(e, [PaymentError]);
  }
}

async function authorisedOrder(orderNumber: string, token: string | null) {
  const user = await getCurrentUser();
  const o = await getOrderDetail({ orderNumber });
  if (!o || !canViewOrder(o, { user, guestToken: token })) throw new PaymentError("Order not found.");
  return { o, user };
}

export type PaymentStart = {
  provider: "razorpay" | "mock";
  keyId: string;
  gatewayOrderId: string;
  amountPaise: number;
  storeName: string;
  orderNumber: string;
  prefill: { name: string; email: string; contact: string };
};

export async function startPaymentAction(orderNumber: string, token: string | null): Promise<ActionResult<PaymentStart>> {
  try {
    if (!(await rateLimit(`paystart:${await clientIp()}`, 30, 600))) throw new RateLimitError();
    const { o } = await authorisedOrder(orderNumber, token);
    const gateway = getGateway();
    const { gatewayOrderId } = await ensureGatewayOrder(o.id, gateway);
    const store = await getSettings("store");
    return {
      ok: true,
      data: {
        provider: gateway!.provider,
        keyId: gateway!.publicKeyId,
        gatewayOrderId,
        amountPaise: o.totalPaise,
        storeName: storeName(store),
        orderNumber: o.orderNumber,
        prefill: { name: o.contactName, email: o.contactEmail, contact: o.contactPhone },
      },
    };
  } catch (e) {
    return toActionError(e, [PaymentError, GatewayError]);
  }
}

const verifySchema = z.object({
  orderNumber: z.string().max(40),
  token: z.string().max(80).nullable(),
  gatewayOrderId: z.string().max(80),
  paymentId: z.string().max(80),
  signature: z.string().max(200),
});

export async function verifyPaymentAction(raw: z.input<typeof verifySchema>): Promise<ActionResult<{ redirectTo: string; pending?: boolean }>> {
  try {
    const input = verifySchema.parse(raw);
    const { o } = await authorisedOrder(input.orderNumber, input.token);
    const r = await confirmCheckoutPayment({ orderId: o.id, gatewayOrderId: input.gatewayOrderId, paymentId: input.paymentId, signature: input.signature });
    return { ok: true, data: { redirectTo: orderPath(o, false), pending: r.result === "authorized" } };
  } catch (e) {
    return toActionError(e, [PaymentError, GatewayError]);
  }
}

export async function reportPaymentFailureAction(orderNumber: string, token: string | null, description: string | null): Promise<ActionResult> {
  try {
    const { o } = await authorisedOrder(orderNumber, token);
    await recordClientReportedFailure(o.id, description);
    return { ok: true };
  } catch (e) {
    return toActionError(e, [PaymentError]);
  }
}

/**
 * TEST MODE ONLY. Simulates the browser half of a Razorpay checkout so the full server-side verification
 * path can be exercised without credentials. Unavailable when Razorpay keys are set or APP_ENV=production.
 */
export async function simulatePaymentAction(orderNumber: string, token: string | null, outcome: "success" | "failure"): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const mock = getMockGateway();
    if (!mock) throw new PaymentError("Simulated payments are disabled.");
    const { o } = await authorisedOrder(orderNumber, token);
    const { gatewayOrderId } = await ensureGatewayOrder(o.id, mock);
    if (outcome === "failure") {
      await db().begin(async (tx) => {
        await tx`insert into payments (order_id, provider, provider_order_id, provider_payment_id, amount_paise, status, error_description)
                 values (${o.id}, 'mock', ${gatewayOrderId}, ${"mock_fail_" + Date.now()}, ${o.totalPaise}, 'failed', 'Simulated failure')`;
        await tx`update orders set payment_status = 'failed', status = case when status = 'awaiting_payment' then 'payment_failed'::order_status else status end where id = ${o.id}`;
        await tx`insert into fulfillment_events (order_id, to_status, message, customer_visible) values (${o.id}, 'payment_failed', 'Payment attempt failed — you can retry', true)`;
      });
      return { ok: false, message: "The simulated payment failed. You can retry." };
    }
    const { paymentId, signature } = mock.simulate(gatewayOrderId);
    await confirmCheckoutPayment({ orderId: o.id, gatewayOrderId, paymentId, signature });
    return { ok: true, data: { redirectTo: orderPath(o, false) } };
  } catch (e) {
    return toActionError(e, [PaymentError]);
  }
}
