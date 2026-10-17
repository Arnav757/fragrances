import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting. The first X-Forwarded-For entry is whatever the client sent,
 * so it is never used: prefer X-Real-IP (set by Vercel and typical nginx setups), else the last
 * X-Forwarded-For entry, which is the one appended by the proxy nearest to us.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",").at(-1)!.trim().slice(0, 64);
  return "unknown";
}
