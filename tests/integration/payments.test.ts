import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrder, getOrderDetail } from "@/lib/services/orders";
import { quoteCartById } from "@/lib/services/cart";
import { confirmCheckoutPayment, ensureGatewayOrder, handleRazorpayWebhook, PaymentError } from "@/lib/services/payments";
import { getMockGateway } from "@/lib/payments/gateway";
import { hmacSha256Hex } from "@/lib/auth/crypto";
import { checkoutInput, makeCart } from "../helpers";

afterAll(async () => {
  await db().end();
});

async function newOrder() {
  const cartId = await makeCart([{ slug: "atelier-demo-no-12-neroli-tide-50ml", qty: 1 }]);
  const total = (await quoteCartById(cartId, { placeOfSupplyState: "Maharashtra" })).pricing.totalPaise;
  const o = await createOrder(checkoutInput({ expectedTotalPaise: total }), { user: null, cartId });
  return { ...o, cartId, total };
}

const SECRET = "test-webhook-secret";
function signed(body: object) {
  const raw = JSON.stringify(body);
  return { raw, sig: hmacSha256Hex(SECRET, raw) };
}
function capturedEvent(gatewayOrderId: string, paymentId: string, amount: number) {
  return {
    event: "payment.captured",
    payload: { payment: { entity: { id: paymentId, order_id: gatewayOrderId, amount, currency: "INR", status: "captured", method: "upi", fee: 2400, tax: 366 } } },
  };
}

describe("checkout payment verification", () => {
  it("rejects a forged signature and accepts a valid one, idempotently", async () => {
    const o = await newOrder();
    const mock = getMockGateway()!;
    const { gatewayOrderId } = await ensureGatewayOrder(o.id, mock);
    await expect(confirmCheckoutPayment({ orderId: o.id, gatewayOrderId, paymentId: "mock_pay_x", signature: "deadbeef" })).rejects.toBeInstanceOf(PaymentError);
    expect((await getOrderDetail({ id: o.id }))!.paymentStatus).toBe("pending");

    const { paymentId, signature } = mock.simulate(gatewayOrderId);
    const r1 = await confirmCheckoutPayment({ orderId: o.id, gatewayOrderId, paymentId, signature });
    expect(r1.result).toBe("paid");
    const r2 = await confirmCheckoutPayment({ orderId: o.id, gatewayOrderId, paymentId, signature });
    expect(r2.result).toBe("already_paid");
    const d = (await getOrderDetail({ id: o.id }))!;
    expect(d.status).toBe("confirmed");
    expect(d.paymentStatus).toBe("paid");
    expect((await db()`select 1 from payments where order_id = ${o.id} and status = 'captured'`).length).toBe(1);
    expect((await db()`select 1 from cart_items where cart_id = ${o.cartId}`).length).toBe(0);
    expect((await db()`select 1 from email_outbox where order_id = ${o.id} and template = 'payment_confirmation'`).length).toBe(1);
  });

  it("won't accept a payment for a different order's gateway id", async () => {
    const a = await newOrder();
    const b = await newOrder();
    const mock = getMockGateway()!;
    const ga = await ensureGatewayOrder(a.id, mock);
    const gb = await ensureGatewayOrder(b.id, mock);
    const p = mock.simulate(gb.gatewayOrderId);
    await expect(confirmCheckoutPayment({ orderId: a.id, gatewayOrderId: gb.gatewayOrderId, ...p })).rejects.toBeInstanceOf(PaymentError);
    expect(ga.gatewayOrderId).not.toBe(gb.gatewayOrderId);
  });
});

describe("razorpay webhook", () => {
  it("rejects unsigned or tampered payloads", async () => {
    const { raw, sig } = signed({ event: "payment.captured", payload: {} });
    expect((await handleRazorpayWebhook(raw, null, "evt_x")).status).toBe(401);
    expect((await handleRazorpayWebhook(raw + " ", sig, "evt_x")).status).toBe(401);
  });

  it("confirms payment once even when delivered repeatedly", async () => {
    const o = await newOrder();
    const gw = "order_TEST" + Date.now();
    await db()`update orders set razorpay_order_id = ${gw} where id = ${o.id}`;
    const { raw, sig } = signed(capturedEvent(gw, "pay_W1" + Date.now(), o.total));
    const r1 = await handleRazorpayWebhook(raw, sig, "evt_dup_1");
    const r2 = await handleRazorpayWebhook(raw, sig, "evt_dup_1");
    const r3 = await handleRazorpayWebhook(raw, sig, "evt_dup_2"); // same payment, new event id
    expect([r1.body, r2.body, r3.body]).toEqual(["ok", "duplicate", "ok"]);
    const d = (await getOrderDetail({ id: o.id }))!;
    expect(d.paymentStatus).toBe("paid");
    const pays = await db()<{ feePaise: number }[]>`select fee_paise from payments where order_id = ${o.id}`;
    expect(pays.length).toBe(1);
    expect(pays[0]!.feePaise).toBe(2400);
    const events = await db()`select 1 from fulfillment_events where order_id = ${o.id} and message like 'Payment received%'`;
    expect(events.length).toBe(1);
    const mails = await db()`select 1 from email_outbox where order_id = ${o.id} and template = 'payment_confirmation'`;
    expect(mails.length).toBe(1);
  });

  it("does not mark paid when the amount doesn't match", async () => {
    const o = await newOrder();
    const gw = "order_AMT" + Date.now();
    await db()`update orders set razorpay_order_id = ${gw} where id = ${o.id}`;
    const { raw, sig } = signed(capturedEvent(gw, "pay_A" + Date.now(), o.total - 100));
    const r = await handleRazorpayWebhook(raw, sig, "evt_amt");
    expect(r.status).toBe(200);
    expect((await getOrderDetail({ id: o.id }))!.paymentStatus).toBe("pending");
  });

  it("records failures so the customer can retry", async () => {
    const o = await newOrder();
    const gw = "order_F" + Date.now();
    await db()`update orders set razorpay_order_id = ${gw} where id = ${o.id}`;
    const { raw, sig } = signed({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_F" + Date.now(), order_id: gw, amount: o.total, currency: "INR", status: "failed", method: "card", error_code: "BAD_REQUEST_ERROR", error_description: "Card declined" } } },
    });
    await handleRazorpayWebhook(raw, sig, "evt_fail");
    const d = (await getOrderDetail({ id: o.id }))!;
    expect(d.status).toBe("payment_failed");
    expect(d.paymentStatus).toBe("failed");
    // a later successful capture still confirms it
    const ok = signed(capturedEvent(gw, "pay_OK" + Date.now(), o.total));
    await handleRazorpayWebhook(ok.raw, ok.sig, "evt_ok_after_fail");
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("confirmed");
  });

  it("flags a payment that arrives for a cancelled order instead of reviving it", async () => {
    const o = await newOrder();
    const gw = "order_C" + Date.now();
    await db()`update orders set razorpay_order_id = ${gw}, status = 'cancelled', payment_status = 'cancelled' where id = ${o.id}`;
    const { raw, sig } = signed(capturedEvent(gw, "pay_C" + Date.now(), o.total));
    await handleRazorpayWebhook(raw, sig, "evt_cancelled");
    const d = (await getOrderDetail({ id: o.id }, db(), { customerView: false }))!;
    expect(d.status).toBe("cancelled");
    expect(d.paymentStatus).toBe("paid");
    expect(d.events.some((e) => e.message?.includes("ACTION NEEDED"))).toBe(true);
  });
});
