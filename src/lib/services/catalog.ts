import "server-only";
import { db, type Queryable } from "../db";
import type { Availability, ProductType } from "@/config/brand";

/**
 * PUBLIC catalogue queries. Every column is listed explicitly — supplier costs, supplier SKUs and
 * internal flags are never selected here. Unverified MRP and fragrance notes are suppressed in SQL.
 */

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  brandSlug: string;
  productType: ProductType;
  sizeMl: number | null;
  concentration: string | null;
  fragranceFamily: string | null;
  gender: string | null;
  sellingPricePaise: number;
  mrpPaise: number | null; // only when verified
  availability: Availability;
  isDemo: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
};

export type ProductDetail = ProductCard & {
  description: string;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  notesVerified: boolean;
  occasions: string[];
  maxPerOrder: number;
  images: { url: string; alt: string }[];
  brandOrigin: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewCount: number;
  ratingAverage: number | null;
};

const cardColumns = (q: Queryable) => q`
  p.id, p.slug, p.name, b.name as brand_name, b.slug as brand_slug, p.product_type, p.size_ml, p.concentration,
  p.fragrance_family, p.gender, p.selling_price_paise,
  case when p.mrp_verified then p.mrp_paise end as mrp_paise,
  p.availability, p.is_demo,
  img.url as image_url, img.alt as image_alt`;

const imageJoin = (q: Queryable) => q`
  left join lateral (
    select url, alt from product_images i where i.product_id = p.id and i.usage_rights_confirmed
    order by position, created_at limit 1
  ) img on true`;

/** Orders that represent genuine demand (paid online or active COD). */
const demandOrders = (q: Queryable) => q`
  (o.payment_status in ('paid', 'cod_pending', 'cod_collected', 'partially_refunded')
   and o.status not in ('cancelled', 'refunded', 'awaiting_payment', 'payment_failed'))`;

export type ShopFilters = {
  q?: string;
  brands?: string[];
  types?: ProductType[];
  families?: string[];
  concentrations?: string[];
  sizes?: number[];
  genders?: string[];
  occasions?: string[];
  collection?: string;
  minPricePaise?: number;
  maxPricePaise?: number;
  availableOnly?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "popular" | "relevance";
  page?: number;
  pageSize?: number;
};

export type ShopResult = {
  products: ProductCard[];
  total: number;
  page: number;
  pageCount: number;
  popularityAvailable: boolean;
  sortApplied: NonNullable<ShopFilters["sort"]>;
};

export async function hasPopularityData(q: Queryable = db()): Promise<boolean> {
  const rows = await q<{ n: number }[]>`
    select count(*)::int as n from order_items oi join orders o on o.id = oi.order_id
    where ${demandOrders(q)} and o.created_at > now() - interval '90 days'`;
  return (rows[0]?.n ?? 0) > 0;
}

export async function listProducts(f: ShopFilters, q: Queryable = db()): Promise<ShopResult> {
  const pageSize = Math.min(Math.max(f.pageSize ?? 12, 1), 48);
  const page = Math.max(f.page ?? 1, 1);
  const search = f.q?.trim().slice(0, 80) || null;
  const like = search ? `%${search.replace(/[%_\\]/g, (m) => "\\" + m)}%` : null;

  const popularityAvailable = await hasPopularityData(q);
  let sort = f.sort ?? (search ? "relevance" : "newest");
  if (sort === "popular" && !popularityAvailable) sort = "newest";
  if (sort === "relevance" && !search) sort = "newest";

  const where = q`
    p.is_active and b.is_active
    ${search ? q`and (p.name ilike ${like} or b.name ilike ${like}
        or (p.notes_verified and array_to_string(p.top_notes || p.heart_notes || p.base_notes, ' ') ilike ${like})
        or p.fragrance_family ilike ${like})` : q``}
    ${f.brands?.length ? q`and b.slug in ${q(f.brands)}` : q``}
    ${f.types?.length ? q`and p.product_type in ${q(f.types)}` : q``}
    ${f.families?.length ? q`and p.fragrance_family in ${q(f.families)}` : q``}
    ${f.concentrations?.length ? q`and p.concentration in ${q(f.concentrations)}` : q``}
    ${f.sizes?.length ? q`and p.size_ml in ${q(f.sizes)}` : q``}
    ${f.genders?.length ? q`and p.gender in ${q(f.genders)}` : q``}
    ${f.occasions?.length ? q`and p.occasions && ${f.occasions}::text[]` : q``}
    ${f.minPricePaise != null ? q`and p.selling_price_paise >= ${f.minPricePaise}` : q``}
    ${f.maxPricePaise != null ? q`and p.selling_price_paise <= ${f.maxPricePaise}` : q``}
    ${f.availableOnly ? q`and p.availability = 'available'` : q``}
    ${f.collection ? q`and exists (select 1 from product_collections pc join collections c on c.id = pc.collection_id
        where pc.product_id = p.id and c.slug = ${f.collection})` : q``}`;

  const order =
    sort === "price_asc"
      ? q`p.selling_price_paise asc, p.created_at desc`
      : sort === "price_desc"
        ? q`p.selling_price_paise desc, p.created_at desc`
        : sort === "popular"
          ? q`coalesce(pop.qty, 0) desc, p.created_at desc`
          : sort === "relevance"
            ? q`(case when p.name ilike ${like} then 0 when b.name ilike ${like} then 1 else 2 end), p.created_at desc`
            : q`p.created_at desc, p.name asc`;

  const [countRow] = await q<{ n: number }[]>`
    select count(*)::int as n from products p join brands b on b.id = p.brand_id where ${where}`;
  const total = countRow?.n ?? 0;

  const products = await q<ProductCard[]>`
    select ${cardColumns(q)}
    from products p
    join brands b on b.id = p.brand_id
    ${imageJoin(q)}
    left join lateral (
      select sum(oi.quantity)::int as qty from order_items oi join orders o on o.id = oi.order_id
      where oi.product_id = p.id and ${demandOrders(q)} and o.created_at > now() - interval '90 days'
    ) pop on true
    where ${where}
    order by ${order}
    limit ${pageSize} offset ${(page - 1) * pageSize}`;

  return { products, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)), popularityAvailable, sortApplied: sort };
}

export async function getProductBySlug(slug: string, q: Queryable = db()): Promise<ProductDetail | null> {
  const rows = await q<(Omit<ProductDetail, "images"> & { images: { url: string; alt: string }[] | null })[]>`
    select ${cardColumns(q)},
      p.description,
      case when p.notes_verified then p.top_notes else '{}' end as top_notes,
      case when p.notes_verified then p.heart_notes else '{}' end as heart_notes,
      case when p.notes_verified then p.base_notes else '{}' end as base_notes,
      p.notes_verified, p.occasions, p.max_per_order, b.origin as brand_origin, p.created_at, p.updated_at,
      (select coalesce(json_agg(json_build_object('url', i.url, 'alt', i.alt) order by i.position, i.created_at), '[]'::json)
         from product_images i where i.product_id = p.id and i.usage_rights_confirmed) as images,
      (select count(*)::int from reviews r where r.product_id = p.id and r.status = 'approved') as review_count,
      (select round(avg(rating)::numeric, 1)::float from reviews r where r.product_id = p.id and r.status = 'approved') as rating_average
    from products p
    join brands b on b.id = p.brand_id
    ${imageJoin(q)}
    where p.slug = ${slug} and p.is_active and b.is_active`;
  const row = rows[0];
  if (!row) return null;
  return { ...row, images: row.images ?? [] };
}

export async function getRelatedProducts(p: ProductDetail, limit = 4, q: Queryable = db()): Promise<ProductCard[]> {
  return q<ProductCard[]>`
    select ${cardColumns(q)}
    from products p
    join brands b on b.id = p.brand_id
    ${imageJoin(q)}
    where p.is_active and b.is_active and p.id <> ${p.id}
    order by
      (case when p.fragrance_family = ${p.fragranceFamily} then 3 else 0 end
       + case when p.product_type = ${p.productType} then 1 else 0 end
       + case when b.slug = ${p.brandSlug} then 1 else 0 end
       + cardinality(array(select unnest(p.occasions) intersect select unnest(${p.occasions}::text[])))) desc,
      (p.availability = 'available') desc, p.created_at desc
    limit ${limit}`;
}

export async function getBestsellers(limit = 4, q: Queryable = db()): Promise<ProductCard[]> {
  return q<ProductCard[]>`
    select ${cardColumns(q)}
    from products p
    join brands b on b.id = p.brand_id
    ${imageJoin(q)}
    join lateral (
      select sum(oi.quantity)::int as qty from order_items oi join orders o on o.id = oi.order_id
      where oi.product_id = p.id and ${demandOrders(q)} and o.created_at > now() - interval '90 days'
    ) pop on pop.qty > 0
    where p.is_active and b.is_active
    order by pop.qty desc, p.created_at desc
    limit ${limit}`;
}

export async function getProductsWhere(
  opts: { type?: ProductType; featured?: boolean; middleEastern?: boolean; limit: number },
  q: Queryable = db(),
): Promise<ProductCard[]> {
  return q<ProductCard[]>`
    select ${cardColumns(q)}
    from products p
    join brands b on b.id = p.brand_id
    ${imageJoin(q)}
    where p.is_active and b.is_active
      ${opts.type ? q`and p.product_type = ${opts.type}` : q``}
      ${opts.featured ? q`and p.is_featured` : q``}
      ${opts.middleEastern ? q`and b.is_middle_eastern` : q``}
    order by (p.availability = 'available') desc, p.created_at desc
    limit ${opts.limit}`;
}

export type BrandSummary = { slug: string; name: string; origin: string | null; description: string | null; productCount: number; isMiddleEastern: boolean };

export async function listBrands(q: Queryable = db()): Promise<BrandSummary[]> {
  return q<BrandSummary[]>`
    select b.slug, b.name, b.origin, b.description, b.is_middle_eastern,
      (select count(*)::int from products p where p.brand_id = b.id and p.is_active) as product_count
    from brands b where b.is_active
    order by b.name`;
}

export type CollectionSummary = { slug: string; name: string; description: string | null; productCount: number };

export async function listFeaturedCollections(q: Queryable = db()): Promise<CollectionSummary[]> {
  return q<CollectionSummary[]>`
    select c.slug, c.name, c.description,
      (select count(*)::int from product_collections pc join products p on p.id = pc.product_id
        where pc.collection_id = c.id and p.is_active) as product_count
    from collections c where c.is_featured
    order by c.position, c.name`;
}

export async function getCollection(slug: string, q: Queryable = db()) {
  const rows = await q<{ slug: string; name: string; description: string | null }[]>`
    select slug, name, description from collections where slug = ${slug}`;
  return rows[0] ?? null;
}

export async function getFacets(q: Queryable = db()) {
  const [sizes, concentrations, range] = await Promise.all([
    q<{ sizeMl: number }[]>`select distinct size_ml from products where is_active and size_ml is not null order by size_ml`,
    q<{ concentration: string }[]>`select distinct concentration from products where is_active and concentration is not null order by concentration`,
    q<{ min: number | null; max: number | null }[]>`select min(selling_price_paise)::int as min, max(selling_price_paise)::int as max from products where is_active`,
  ]);
  return {
    sizes: sizes.map((s) => s.sizeMl),
    concentrations: concentrations.map((c) => c.concentration),
    priceMinPaise: range[0]?.min ?? 0,
    priceMaxPaise: range[0]?.max ?? 0,
  };
}

export async function getApprovedReviews(productId: string, q: Queryable = db()) {
  return q<{ id: string; rating: number; title: string | null; body: string; authorName: string; createdAt: Date }[]>`
    select r.id, r.rating, r.title, r.body, split_part(pr.full_name, ' ', 1) as author_name, r.created_at
    from reviews r join profiles pr on pr.id = r.user_id
    where r.product_id = ${productId} and r.status = 'approved'
    order by r.created_at desc limit 20`;
}

export async function allActiveSlugs(q: Queryable = db()) {
  return q<{ slug: string; updatedAt: Date }[]>`select slug, updated_at from products where is_active order by updated_at desc`;
}
