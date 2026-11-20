import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env().SITE_URL.replace(/\/$/, "");
  return ["", "/start", "/sample", "/about", "/contact", "/privacy", "/terms", "/refunds"].map((p) => ({ url: `${base}${p}` }));
}
