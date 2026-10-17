import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { CheckoutInput } from "@/lib/validation";
import { randomToken, sha256 } from "@/lib/auth/crypto";

export async function productId(slug: string): Promise<string> {
  const r = await db()<{ id: string }[]>`select id from products where slug = ${slug}`;
  return r[0]!.id;
}

/** Creates an anonymous cart containing the given products (bypassing cookies). */
export async function makeCart(items: { slug: string; qty: number }[], discountCode: string | null = null) {
  const r = await db()<{ id: string }[]>`insert into carts (token_hash, discount_code) values (${sha256(randomToken())}, ${discountCode}) returning id`;
  const cartId = r[0]!.id;
  for (const it of items) {
    const pid = await productId(it.slug);
    await db()`insert into cart_items (cart_id, product_id, quantity, added_price_paise)
               select ${cartId}, id, ${it.qty}, selling_price_paise from products where id = ${pid}`;
  }
  return cartId;
}

export function checkoutInput(overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    idempotencyKey: randomUUID(),
    email: "test.buyer@example.com",
    contactName: "Test Buyer",
    phone: "9876543210",
    shipping: { fullName: "Test Buyer", phone: "+91 98765 43210", line1: "1 Test Street", line2: "", landmark: "", city: "Pune", state: "Maharashtra", pincode: "411001" },
    billingSameAsShipping: true,
    notes: "",
    paymentMethod: "razorpay",
    expectedTotalPaise: 0,
    acceptTerms: true,
    ...overrides,
  };
}

export async function createUser(email: string, role: "customer" | "admin" = "customer") {
  const r = await db()<{ id: string }[]>`
    insert into profiles (email, password_hash, full_name, role) values (${email}, 'x', 'Test User', ${role})
    on conflict (email) do update set role = excluded.role returning id`;
  return r[0]!.id;
}
