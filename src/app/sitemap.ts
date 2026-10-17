import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { allActiveSlugs } from "@/lib/services/catalog";
import { PAGE_META } from "@/lib/default-pages";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = env().SITE_URL.replace(/\/$/, "");
  const products = await allActiveSlugs();
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    { url: `${site}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/brands`, changeFrequency: "weekly", priority: 0.6 },
    ...Object.values(PAGE_META).map((m) => ({ url: `${site}${m.path}`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...products.map((p) => ({ url: `${site}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
