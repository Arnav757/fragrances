import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = env().SITE_URL.replace(/\/$/, "");
  // Report links are private; never index them or the studio.
  if (env().APP_ENV !== "production") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/s/", "/admin", "/api/", "/login"] }], sitemap: `${base}/sitemap.xml` };
}
