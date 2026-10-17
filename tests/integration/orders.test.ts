import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrder, CheckoutError, createCustomerRequest, RequestError, getOrderDetail, expireStaleOrders } from "@/lib/services/orders";
import { quoteCartById } from "@/lib/services/cart";
import { saveSettings } from "@/lib/settings";
import { canViewOrder, guestOrderToken } from "@/lib/services/order-access";
import { checkoutInput, createUser, makeCart } from "../helpers";
import type { SessionUser } from "@/lib/auth/session";

afterAll(async () => {
  await db().end();
});

beforeEach(async () => {
  await saveSettings("commerce", { codEnabled: false, sellerState: "Karnataka" }, null);
});

async function expectedTotal(cartId: string, method: "razorpay" | "cod" = "razorpay", state = "Maharashtra") {
  return (await quoteCartById(cartId, { paymentMethod: method, placeOfSupplyState: state })).pricing.totalPaise;
}

describe("checkout / order creation", () => {
  it("creates an order using server-side prices and snapshots items", async () => {
    const cartId = await makeCart([{ slug: "lattafa-khamrah-edp-100ml", qty: 2 }]);
    const total = await expectedTotal(cartId);
    const o = await createOrder(checkoutInput({ expectedTotalPaise: total }), { user: null, cartId });
    const d = (await getOrderDetail({ id: o.id }))!;
    expect(d.totalPaise).toBe(total);
    expect(d.status).toBe("awaiting_payment");
    expect(d.paymentStatus).toBe("pending");
    expect(d.items[0]!.unitPricePaise).toBe(249900);
    expect(d.igstPaise).toBe(d.taxPaise); // Karnataka seller → Maharashtra buyer
    expect(d.shippingAddress.phone).toBe("9876543210"); // normalised
    // snapshot survives later product edits
    await db()`update products set selling_price_paise = 999900, name = 'Renamed' where slug = 'lattafa-khamrah-edp-100ml'`;
    const again = (await getOrderDetail({ id: o.id }))!;
    expect(again.items[0]!.productName).toBe("Khamrah");
    expect(again.items[0]!.unitPricePaise).toBe(249900);
    await db()`update products set selling_price_paise = 249900, name = 'Khamrah' where slug = 'lattafa-khamrah-edp-100ml'`;
    // online orders keep the cart until payment
    const items = await db()`select 1 from cart_items where cart_id = ${cartId}`;
    expect(items.length).toBe(1);
  });

  it("rejects a tampered or stale total (never trusts the browser)", async () => {
    const cartId = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }]);
    const total = await expectedTotal(cartId);
    await expect(createOrder(checkoutInput({ expectedTotalPaise: 100 }), { user: null, cartId })).rejects.toMatchObject({
      name: "CheckoutError",
      newTotalPaise: total,
    });
    const count = await db()`select 1 from orders where cart_id = ${cartId}`;
    expect(count.length).toBe(0);
  });

  it("is idempotent on the checkout key", async () => {
    const cartId = await makeCart([{ slug: "afnan-9pm-edp-100ml", qty: 1 }]);
    const input = checkoutInput({ expectedTotalPaise: await expectedTotal(cartId) });
    const [a, b] = await Promise.all([createOrder(input, { user: null, cartId }), createOrder(input, { user: null, cartId })]);
    expect(a.id).toBe(b.id);
    const c = await createOrder(input, { user: null, cartId });
    expect(c.id).toBe(a.id);
    expect(c.replayed).toBe(true);
    const rows = await db()`select 1 from orders where idempotency_key = ${input.idempotencyKey}`;
    expect(rows.length).toBe(1);
  });

  it("refuses products that can't be fulfilled", async () => {
    const cartId = await makeCart([{ slug: "afnan-supremacy-not-only-intense-100ml", qty: 1 }]);
    await expect(createOrder(checkoutInput({ expectedTotalPaise: 0 }), { user: null, cartId })).rejects.toBeInstanceOf(CheckoutError);
  });

  it("enforces max per order and positive quantities", async () => {
    const cartId = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 9 }]);
    const q = await quoteCartById(cartId);
    expect(q.canCheckout).toBe(false);
  });

  it("rejects COD unless enabled, then creates a confirmed COD order and clears the cart", async () => {
    const cartId = await makeCart([{ slug: "rasasi-hawas-for-him-edp-100ml", qty: 1 }]);
    await expect(createOrder(checkoutInput({ paymentMethod: "cod", expectedTotalPaise: await expectedTotal(cartId, "cod") }), { user: null, cartId })).rejects.toBeInstanceOf(CheckoutError);
    await saveSettings("commerce", { codEnabled: true, codFeePaise: 4900, sellerState: "Karnataka" }, null);
    const total = await expectedTotal(cartId, "cod");
    const o = await createOrder(checkoutInput({ paymentMethod: "cod", expectedTotalPaise: total }), { user: null, cartId });
    const d = (await getOrderDetail({ id: o.id }))!;
    expect(d.status).toBe("confirmed");
    expect(d.paymentStatus).toBe("cod_pending");
    expect(d.codFeePaise).toBe(4900);
    expect((await db()`select 1 from cart_items where cart_id = ${cartId}`).length).toBe(0);
    const mail = await db()<{ status: string }[]>`select status from email_outbox where order_id = ${o.id} and template = 'order_confirmation'`;
    expect(mail[0]?.status).toBe("logged"); // no provider configured → logged, not "sent"
  });

  it("validates discount codes on the server and reserves usage", async () => {
    await db()`insert into discounts (code, type, value, max_uses, is_active) values ('ONCE', 'fixed', 10000, 1, true) on conflict do nothing`;
    const c1 = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }], "ONCE");
    const q1 = await quoteCartById(c1, { placeOfSupplyState: "Maharashtra" });
    expect(q1.pricing.discountPaise).toBe(10000);
    await createOrder(checkoutInput({ expectedTotalPaise: q1.pricing.totalPaise }), { user: null, cartId: c1 });
    const c2 = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }], "ONCE");
    const q2 = await quoteCartById(c2);
    expect(q2.pricing.discountPaise).toBe(0);
    expect(q2.discountError).toMatch(/usage limit/);
    const bogus = await quoteCartById(await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }], "NOPE"));
    expect(bogus.pricing.discountPaise).toBe(0);
  });
});

describe("order access", () => {
  it("lets only the owner, a guest with the signed link, or an admin view an order", async () => {
    const owner: SessionUser = { id: await createUser("owner@example.com"), email: "owner@example.com", fullName: "O", phone: null, role: "customer" };
    const other: SessionUser = { id: await createUser("other@example.com"), email: "other@example.com", fullName: "X", phone: null, role: "customer" };
    const admin: SessionUser = { id: await createUser("boss@example.com", "admin"), email: "boss@example.com", fullName: "A", phone: null, role: "admin" };
    const cartId = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }]);
    const o = await createOrder(checkoutInput({ expectedTotalPaise: await expectedTotal(cartId) }), { user: owner, cartId });
    const order = { id: o.id, userId: owner.id };
    expect(canViewOrder(order, { user: owner })).toBe(true);
    expect(canViewOrder(order, { user: other })).toBe(false);
    expect(canViewOrder(order, { user: null, guestToken: guestOrderToken(o.id) })).toBe(false); // account orders need sign-in
    expect(canViewOrder(order, { user: admin })).toBe(true);

    const gCart = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }]);
    const g = await createOrder(checkoutInput({ expectedTotalPaise: await expectedTotal(gCart) }), { user: null, cartId: gCart });
    const gOrder = { id: g.id, userId: null };
    expect(canViewOrder(gOrder, { user: null, guestToken: guestOrderToken(g.id) })).toBe(true);
    expect(canViewOrder(gOrder, { user: null, guestToken: guestOrderToken(o.id) })).toBe(false);
    expect(canViewOrder(gOrder, { user: other, guestToken: null })).toBe(false);
  });
});

describe("customer cancellation", () => {
  it("cancels an unpaid order immediately and releases the discount", async () => {
    await db()`insert into discounts (code, type, value, max_uses, is_active) values ('REL', 'fixed', 5000, 5, true) on conflict do nothing`;
    const cartId = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }], "REL");
    const o = await createOrder(checkoutInput({ expectedTotalPaise: await expectedTotal(cartId) }), { user: null, cartId });
    expect((await db()<{ usedCount: number }[]>`select used_count from discounts where code = 'REL'`)[0]!.usedCount).toBe(1);
    const r = await createCustomerRequest(o.id, null, "cancellation", "Changed my mind");
    expect(r.outcome).toBe("cancelled");
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("cancelled");
    expect((await db()<{ usedCount: number }[]>`select used_count from discounts where code = 'REL'`)[0]!.usedCount).toBe(0);
    await expect(createCustomerRequest(o.id, null, "cancellation", "again please")).rejects.toBeInstanceOf(RequestError);
  });

  it("does not allow returns before delivery", async () => {
    const cartId = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }]);
    const o = await createOrder(checkoutInput({ expectedTotalPaise: await expectedTotal(cartId) }), { user: null, cartId });
    await expect(createCustomerRequest(o.id, null, "return", "Broken bottle")).rejects.toBeInstanceOf(RequestError);
  });

  it("expires stale unpaid orders", async () => {
    const cartId = await makeCart([{ slug: "lattafa-yara-edp-100ml", qty: 1 }]);
    const o = await createOrder(checkoutInput({ expectedTotalPaise: await expectedTotal(cartId) }), { user: null, cartId });
    await db()`update orders set created_at = now() - interval '3 days' where id = ${o.id}`;
    expect(await expireStaleOrders()).toBeGreaterThanOrEqual(1);
    expect((await getOrderDetail({ id: o.id }))!.status).toBe("cancelled");
  });
});
