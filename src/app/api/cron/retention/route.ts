import { env } from "@/lib/env";
import { safeEqual } from "@/lib/auth/crypto";
import { runRetention } from "@/lib/services/analyses";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily privacy housekeeping (photo deletion, unpaid preview cleanup, order expiry). `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("unauthorised", { status: 401 });
  return Response.json(await runRetention());
}
