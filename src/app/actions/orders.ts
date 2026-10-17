"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createCustomerRequest, getOrderDetail, RequestError } from "@/lib/services/orders";
import { canViewOrder } from "@/lib/services/order-access";
import { requestSchema, reviewSchema } from "@/lib/validation";
import { rateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { toActionError, type ActionResult } from "@/lib/forms";
import { db } from "@/lib/db";

export async function orderRequestAction(orderNumber: string, token: string | null, raw: { type: string; reason: string }): Promise<ActionResult<{ outcome: string }>> {
  try {
    if (!(await rateLimit(`orderreq:${await clientIp()}`, 10, 3600))) throw new RateLimitError();
    const input = requestSchema.parse(raw);
    const user = await getCurrentUser();
    const order = await getOrderDetail({ orderNumber });
    // Admins act through the admin area; customers can only act on their own orders.
    if (!order || !canViewOrder(order, { user: user?.role === "admin" ? null : user, guestToken: token })) throw new RequestError("Order not found.");
    const r = await createCustomerRequest(order.id, user?.id ?? null, input.type, input.reason);
    revalidatePath(`/account/orders/${orderNumber}`);
    revalidatePath(`/order/${orderNumber}`);
    return {
      ok: true,
      data: r,
      message: r.outcome === "cancelled" ? "Your order has been cancelled." : "Your request has been sent. We'll get back to you by email.",
    };
  } catch (e) {
    return toActionError(e, [RequestError]);
  }
}

export async function submitReviewAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Please sign in to write a review." };
    if (!(await rateLimit(`review:${user.id}`, 10, 3600))) throw new RateLimitError();
    const input = reviewSchema.parse(raw);
    const rows = await db()<{ productId: string | null }[]>`
      select oi.product_id from order_items oi join orders o on o.id = oi.order_id
      where oi.id = ${input.orderItemId} and o.user_id = ${user.id} and o.status in ('delivered', 'return_requested', 'returned')`;
    const productId = rows[0]?.productId;
    if (!productId) return { ok: false, message: "You can review products from delivered orders only." };
    await db()`insert into reviews (product_id, user_id, order_item_id, rating, title, body)
               values (${productId}, ${user.id}, ${input.orderItemId}, ${input.rating}, ${input.title || null}, ${input.body})
               on conflict (order_item_id) do nothing`;
    return { ok: true, message: "Thank you! Your review will appear once it's been checked." };
  } catch (e) {
    return toActionError(e);
  }
}
