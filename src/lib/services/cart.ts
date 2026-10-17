import "server-only";
import { cookies } from "next/headers";
import { db, type Queryable } from "../db";
import { randomToken, sha256 } from "../auth/crypto";
import { getCurrentUser } from "../auth/session";
import { priceOrder, type PricingResult } from "../pricing";
import { getSettings, type CommerceSettings } from "../settings";
import { findValidDiscount } from "./discounts";
import type { Availability, ProductType } from "@/config/brand";

export const CART_COOKIE = "nn_cart";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  brandName: string;
  productType: ProductType;
  sizeMl: number | null;
  concentration: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPricePaise: number;
  addedPricePaise: number;
  availability: Availability;
  isActive: boolean;
  maxPerOrder: number;
  taxRateBp: number | null;
  hsnCode: string | null;
  taxClassName: string | null;
  taxClassVerified: boolean;
};

export type CartIssue = { productId: string | null; message: string; blocking: boolean };

export type CartQuote = {
  cartId: string | null;
  lines: CartLine[];
  pricing: PricingResult;
  discountCode: string | null;
  discountError: string | null;
  issues: CartIssue[];
  canCheckout: boolean;
  itemCount: number;
};

export type CartRef = { userId: string | null; token: string | null };

async function cartRef(): Promise<CartRef> {
  const [user, jar] = await Promise.all([getCurrentUser(), cookies()]);
  return { userId: user?.id ?? null, token: jar.get(CART_COOKIE)?.value ?? null };
}

/** Find the cart for a user or anonymous token (pure DB, testable). */
export async function findCartId(ref: CartRef, q: Queryable = db()): Promise<string | null> {
  if (ref.userId) {
    const r = await q<{ id: string }[]>`select id from carts where user_id = ${ref.userId}`;
    if (r[0]) return r[0].id;
  }
  if (ref.token && ref.token.length < 200) {
    const r = await q<{ id: string }[]>`select id from carts where token_hash = ${sha256(ref.token)} and user_id is null`;
    if (r[0]) return r[0].id;
  }
  return null;
}

export async function getCartId(): Promise<string | null> {
  return findCartId(await cartRef());
}

async function ensureCartId(): Promise<string> {
  const ref = await cartRef();
  const existing = await findCartId(ref);
  if (existing) return existing;
  if (ref.userId) {
    const r = await db()<{ id: string }[]>`
      insert into carts (user_id) values (${ref.userId})
      on conflict (user_id) do update set updated_at = now() returning id`;
    return r[0]!.id;
  }
  const token = randomToken(24);
  const r = await db()<{ id: string }[]>`insert into carts (token_hash) values (${sha256(token)}) returning id`;
  const jar = await cookies();
  jar.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES,
    path: "/",
    maxAge: 60 * 86400,
  });
  return r[0]!.id;
}

export class CartError extends Error {}

export async function addToCart(productId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new CartError("Invalid quantity.");
  const rows = await db()<{ sellingPricePaise: number; availability: Availability; isActive: boolean; maxPerOrder: number }[]>`
    select selling_price_paise, availability, is_active, max_per_order from products where id = ${productId}`;
  const p = rows[0];
  if (!p || !p.isActive) throw new CartError("This product is no longer available.");
  if (p.availability !== "available") throw new CartError("This product can't be ordered right now.");
  const cartId = await ensureCartId();
  const existing = await db()<{ quantity: number }[]>`select quantity from cart_items where cart_id = ${cartId} and product_id = ${productId}`;
  const newQty = Math.min((existing[0]?.quantity ?? 0) + quantity, p.maxPerOrder);
  await db()`
    insert into cart_items (cart_id, product_id, quantity, added_price_paise)
    values (${cartId}, ${productId}, ${newQty}, ${p.sellingPricePaise})
    on conflict (cart_id, product_id) do update set quantity = ${newQty}`;
  await db()`update carts set updated_at = now() where id = ${cartId}`;
  return { quantity: newQty, cappedAt: newQty === p.maxPerOrder && (existing[0]?.quantity ?? 0) + quantity > p.maxPerOrder ? p.maxPerOrder : null };
}

export async function setCartQuantity(productId: string, quantity: number) {
  const cartId = await getCartId();
  if (!cartId) return;
  if (quantity <= 0) {
    await db()`delete from cart_items where cart_id = ${cartId} and product_id = ${productId}`;
    return;
  }
  const rows = await db()<{ maxPerOrder: number }[]>`select max_per_order from products where id = ${productId}`;
  const max = rows[0]?.maxPerOrder ?? 1;
  await db()`update cart_items set quantity = ${Math.min(quantity, max, 50)} where cart_id = ${cartId} and product_id = ${productId}`;
}

export async function acknowledgePriceChanges() {
  const cartId = await getCartId();
  if (!cartId) return;
  await db()`update cart_items ci set added_price_paise = p.selling_price_paise from products p
             where ci.cart_id = ${cartId} and p.id = ci.product_id`;
}

export async function setCartDiscount(code: string | null) {
  const cartId = code ? await ensureCartId() : await getCartId();
  if (!cartId) return;
  await db()`update carts set discount_code = ${code?.trim().toUpperCase() || null} where id = ${cartId}`;
}

export async function loadCartLines(cartId: string, q: Queryable = db()): Promise<CartLine[]> {
  return q<CartLine[]>`
    select p.id as product_id, p.slug, p.name, b.name as brand_name, p.product_type, p.size_ml, p.concentration,
      (select url from product_images i where i.product_id = p.id and i.usage_rights_confirmed order by position limit 1) as image_url,
      ci.quantity, p.selling_price_paise as unit_price_paise, ci.added_price_paise, p.availability, (p.is_active and b.is_active) as is_active,
      p.max_per_order, t.gst_rate_bp as tax_rate_bp, t.hsn_code, t.name as tax_class_name, coalesce(t.is_verified, false) as tax_class_verified
    from cart_items ci
    join products p on p.id = ci.product_id
    join brands b on b.id = p.brand_id
    left join tax_classes t on t.id = p.tax_class_id
    where ci.cart_id = ${cartId}
    order by ci.created_at`;
}

export type QuoteOptions = {
  paymentMethod?: "razorpay" | "cod";
  placeOfSupplyState?: string | null;
  discountCodeOverride?: string | null;
};

/** Server-side quote for a cart. This is the single source of truth for what a customer pays. */
export async function quoteCartById(
  cartId: string | null,
  opts: QuoteOptions = {},
  q: Queryable = db(),
  settings?: CommerceSettings,
): Promise<CartQuote> {
  const commerce = settings ?? (await getSettings("commerce", q));
  const lines = cartId ? await loadCartLines(cartId, q) : [];
  const issues: CartIssue[] = [];

  let storedCode: string | null = null;
  if (cartId && opts.discountCodeOverride === undefined) {
    const r = await q<{ discountCode: string | null }[]>`select discount_code from carts where id = ${cartId}`;
    storedCode = r[0]?.discountCode ?? null;
  }
  const code = opts.discountCodeOverride !== undefined ? opts.discountCodeOverride : storedCode;

  const purchasable = lines.filter((l) => {
    if (!l.isActive || l.availability !== "available") {
      issues.push({ productId: l.productId, message: `${l.name} is no longer available. Please remove it to continue.`, blocking: true });
      return false;
    }
    if (l.taxRateBp === null) {
      issues.push({ productId: l.productId, message: `${l.name} can't be ordered right now (missing tax configuration).`, blocking: true });
      return false;
    }
    if (l.quantity > l.maxPerOrder) {
      issues.push({ productId: l.productId, message: `You can order up to ${l.maxPerOrder} of ${l.name}.`, blocking: true });
    }
    if (l.unitPricePaise !== l.addedPricePaise) {
      issues.push({
        productId: l.productId,
        message: `The price of ${l.name} has changed since you added it. The current price is shown.`,
        blocking: false,
      });
    }
    return true;
  });

  const discount = await findValidDiscount(code, q);
  const isCod = opts.paymentMethod === "cod";

  const pricing = priceOrder({
    lines: purchasable.map((l) => ({
      productId: l.productId,
      unitPricePaise: l.unitPricePaise,
      quantity: Math.min(l.quantity, l.maxPerOrder),
      taxRateBp: l.taxRateBp!,
    })),
    discount: discount.rule,
    shipping: { flatRatePaise: commerce.flatShippingPaise, freeShippingThresholdPaise: commerce.freeShippingThresholdPaise },
    codFeePaise: isCod ? commerce.codFeePaise : 0,
    pricesIncludeTax: commerce.pricesIncludeTax,
    chargesTaxRateBp: commerce.chargesTaxRateBp,
    sellerState: commerce.sellerState,
    placeOfSupplyState: opts.placeOfSupplyState ?? null,
  });

  if (isCod) {
    if (!commerce.codEnabled) issues.push({ productId: null, message: "Cash on delivery isn't available.", blocking: true });
    else if (pricing.totalPaise > commerce.codMaxOrderPaise)
      issues.push({ productId: null, message: "Cash on delivery isn't available for orders of this value.", blocking: true });
  }

  const discountError = discount.error ?? pricing.discountError;
  return {
    cartId,
    lines,
    pricing,
    discountCode: discount.rule && !pricing.discountError ? discount.rule.code : null,
    discountError: code ? discountError : null,
    issues,
    canCheckout: purchasable.length > 0 && !issues.some((i) => i.blocking),
    itemCount: lines.reduce((a, l) => a + l.quantity, 0),
  };
}

export async function quoteCurrentCart(opts: QuoteOptions = {}): Promise<CartQuote> {
  return quoteCartById(await getCartId(), opts);
}

export async function cartItemCount(): Promise<number> {
  const id = await getCartId();
  if (!id) return 0;
  const r = await db()<{ n: number }[]>`select coalesce(sum(quantity), 0)::int as n from cart_items where cart_id = ${id}`;
  return r[0]?.n ?? 0;
}

/** On login/registration: merge the anonymous cart into the user's cart. */
export async function mergeGuestCartIntoUser(userId: string, guestToken: string | undefined) {
  if (!guestToken) return;
  const sql = db();
  await sql.begin(async (tx) => {
    const guest = await tx<{ id: string; discountCode: string | null }[]>`
      select id, discount_code from carts where token_hash = ${sha256(guestToken)} and user_id is null for update`;
    if (!guest[0]) return;
    const user = await tx<{ id: string }[]>`
      insert into carts (user_id, discount_code) values (${userId}, ${guest[0].discountCode})
      on conflict (user_id) do update set updated_at = now() returning id`;
    await tx`
      insert into cart_items (cart_id, product_id, quantity, added_price_paise)
      select ${user[0]!.id}, product_id, quantity, added_price_paise from cart_items where cart_id = ${guest[0].id}
      on conflict (cart_id, product_id) do update set quantity = least(cart_items.quantity + excluded.quantity, 50)`;
    await tx`delete from carts where id = ${guest[0].id}`;
  });
}
