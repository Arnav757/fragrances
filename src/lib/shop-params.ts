import { CONCENTRATIONS, FAMILIES, GENDERS, OCCASIONS, PRODUCT_TYPES, type ProductType } from "@/config/brand";
import type { ShopFilters } from "./services/catalog";
import { rupeesToPaise } from "./money";

type SP = Record<string, string | string[] | undefined>;

function many(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean).slice(0, 20);
}
function pick<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((v): v is T => (allowed as readonly string[]).includes(v));
}

/** Parse and whitelist shop query parameters. Unknown values are ignored. */
export function parseShopParams(sp: SP): ShopFilters {
  const sortRaw = typeof sp.sort === "string" ? sp.sort : undefined;
  const sort = (["newest", "price_asc", "price_desc", "popular", "relevance"] as const).find((s) => s === sortRaw);
  const page = Number(typeof sp.page === "string" ? sp.page : 1);
  const min = typeof sp.min === "string" ? rupeesToPaise(sp.min) : null;
  const max = typeof sp.max === "string" ? rupeesToPaise(sp.max) : null;
  return {
    q: typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined,
    brands: many(sp.brand).filter((b) => /^[a-z0-9-]{1,80}$/.test(b)),
    types: pick(many(sp.type), PRODUCT_TYPES) as ProductType[],
    families: pick(many(sp.family), FAMILIES),
    concentrations: pick(many(sp.concentration), CONCENTRATIONS),
    sizes: many(sp.size).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 1000),
    genders: pick(many(sp.gender), GENDERS),
    occasions: pick(many(sp.occasion), OCCASIONS),
    collection: typeof sp.collection === "string" && /^[a-z0-9-]{1,80}$/.test(sp.collection) ? sp.collection : undefined,
    minPricePaise: min ?? undefined,
    maxPricePaise: max ?? undefined,
    availableOnly: sp.available === "1",
    sort,
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 500) : 1,
    pageSize: 12,
  };
}

export function activeFilterCount(f: ShopFilters): number {
  return (
    (f.brands?.length ?? 0) +
    (f.types?.length ?? 0) +
    (f.families?.length ?? 0) +
    (f.concentrations?.length ?? 0) +
    (f.sizes?.length ?? 0) +
    (f.genders?.length ?? 0) +
    (f.occasions?.length ?? 0) +
    (f.minPricePaise != null ? 1 : 0) +
    (f.maxPricePaise != null ? 1 : 0) +
    (f.availableOnly ? 1 : 0) +
    (f.collection ? 1 : 0)
  );
}

/** Build a shop URL from filters (used for pagination and chip removal). */
export function shopHref(f: ShopFilters, overrides: Partial<ShopFilters> = {}): string {
  const m = { ...f, ...overrides };
  const p = new URLSearchParams();
  if (m.q) p.set("q", m.q);
  m.brands?.forEach((v) => p.append("brand", v));
  m.types?.forEach((v) => p.append("type", v));
  m.families?.forEach((v) => p.append("family", v));
  m.concentrations?.forEach((v) => p.append("concentration", v));
  m.sizes?.forEach((v) => p.append("size", String(v)));
  m.genders?.forEach((v) => p.append("gender", v));
  m.occasions?.forEach((v) => p.append("occasion", v));
  if (m.collection) p.set("collection", m.collection);
  if (m.minPricePaise != null) p.set("min", String(m.minPricePaise / 100));
  if (m.maxPricePaise != null) p.set("max", String(m.maxPricePaise / 100));
  if (m.availableOnly) p.set("available", "1");
  if (m.sort) p.set("sort", m.sort);
  if (m.page && m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `/shop?${s}` : "/shop";
}
