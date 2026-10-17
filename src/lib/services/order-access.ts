import "server-only";
import { env } from "../env";
import { hmacSha256Hex, safeEqual } from "../auth/crypto";
import type { SessionUser } from "../auth/session";

/**
 * Guest order access token: HMAC(APP_SECRET, order id). Deterministic, so it can be put in emails
 * at any time without storing it, and it can't be guessed without the server secret.
 */
export function guestOrderToken(orderId: string): string {
  return hmacSha256Hex(env().APP_SECRET, `guest-order:${orderId}`).slice(0, 40);
}

export function canViewOrder(
  order: { id: string; userId: string | null },
  viewer: { user: SessionUser | null; guestToken?: string | null },
): boolean {
  if (viewer.user?.role === "admin") return true;
  if (order.userId) return viewer.user?.id === order.userId;
  if (viewer.guestToken) return safeEqual(guestOrderToken(order.id), viewer.guestToken);
  return false;
}
