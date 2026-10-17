"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { acknowledgePriceChanges, addToCart, CartError, quoteCurrentCart, setCartDiscount, setCartQuantity } from "@/lib/services/cart";
import { findValidDiscount } from "@/lib/services/discounts";
import { checkPincode, type PincodeCheck } from "@/lib/shipping";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { toActionError, type ActionResult } from "@/lib/forms";

const idQty = z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(50) });

export async function addToCartAction(productId: string, quantity: number): Promise<ActionResult<{ quantity: number; cappedAt: number | null }>> {
  try {
    const input = idQty.parse({ productId, quantity });
    if (!(await rateLimit(`cart:${await clientIp()}`, 120, 60))) return { ok: false, message: "Too many requests. Please slow down." };
    const r = await addToCart(input.productId, input.quantity);
    revalidatePath("/", "layout");
    return { ok: true, data: r };
  } catch (e) {
    return toActionError(e, [CartError]);
  }
}

export async function buyNowAction(productId: string, quantity: number): Promise<ActionResult> {
  const r = await addToCartAction(productId, quantity);
  if (!r.ok) return r;
  redirect("/checkout");
}

export async function updateCartQuantityAction(productId: string, quantity: number): Promise<ActionResult> {
  try {
    const input = z.object({ productId: z.uuid(), quantity: z.number().int().min(0).max(50) }).parse({ productId, quantity });
    await setCartQuantity(input.productId, input.quantity);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function applyDiscountAction(code: string): Promise<ActionResult> {
  try {
    const clean = z.string().trim().min(1).max(30).parse(code).toUpperCase();
    if (!(await rateLimit(`discount:${await clientIp()}`, 20, 600))) return { ok: false, message: "Too many attempts. Please try again later." };
    const found = await findValidDiscount(clean);
    if (!found.rule) return { ok: false, message: found.error ?? "That code isn't valid." };
    await setCartDiscount(clean);
    const quote = await quoteCurrentCart();
    revalidatePath("/cart");
    if (quote.discountError) return { ok: true, message: quote.discountError };
    return { ok: true, message: "Code applied." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeDiscountAction(): Promise<ActionResult> {
  await setCartDiscount(null);
  revalidatePath("/cart");
  return { ok: true };
}

export async function acknowledgePricesAction(): Promise<ActionResult> {
  await acknowledgePriceChanges();
  revalidatePath("/cart");
  return { ok: true };
}

export async function checkPincodeAction(pincode: string): Promise<ActionResult<PincodeCheck>> {
  try {
    const pin = z.string().trim().regex(/^[1-9]\d{5}$/, { error: "Enter a valid 6-digit PIN code" }).parse(pincode);
    if (!(await rateLimit(`pincode:${await clientIp()}`, 30, 600))) return { ok: false, message: "Too many checks. Please try again later." };
    return { ok: true, data: await checkPincode(pin) };
  } catch (e) {
    return toActionError(e);
  }
}
