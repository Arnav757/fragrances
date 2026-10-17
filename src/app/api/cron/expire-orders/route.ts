import { env } from "@/lib/env";
import { safeEqual } from "@/lib/auth/crypto";
import { expireStaleOrders } from "@/lib/services/orders";

export const dynamic = "force-dynamic";

/** Cancels unpaid online orders past the configured window. Call with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("unauthorised", { status: 401 });
  const n = await expireStaleOrders();
  return Response.json({ expired: n });
}
