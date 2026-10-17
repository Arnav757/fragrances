import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { Breadcrumbs, Container, EmptyState, Notice } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { ProductGrid } from "@/components/store/product-card";
import { DesktopFilters, MobileFilters, SortSelect, type FacetData } from "@/components/store/shop-filters";
import { getCollection, getFacets, listBrands, listProducts } from "@/lib/services/catalog";
import { activeFilterCount, parseShopParams, shopHref } from "@/lib/shop-params";
import { FAMILIES, GENDERS, OCCASIONS, PRODUCT_TYPES, PRODUCT_TYPE_LABEL } from "@/config/brand";
import { formatINR } from "@/lib/money";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseShopParams(await searchParams);
  const title = f.types?.length === 1 ? `${PRODUCT_TYPE_LABEL[f.types[0]!]} fragrances` : f.q ? `Search: ${f.q}` : "Shop fragrances";
  return {
    title,
    description: "Browse authentic Middle Eastern perfumes and clearly labelled inspired fragrances. Filter by brand, family, occasion, size and price.",
    alternates: { canonical: "/shop" },
    robots: f.q || activeFilterCount(f) > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: Props) {
  const f = parseShopParams(await searchParams);
  const [result, brands, facetsRaw, collection] = await Promise.all([
    listProducts(f),
    listBrands(),
    getFacets(),
    f.collection ? getCollection(f.collection) : Promise.resolve(null),
  ]);
  const facets: FacetData = {
    brands,
    families: FAMILIES,
    concentrations: facetsRaw.concentrations,
    sizes: facetsRaw.sizes,
    genders: GENDERS,
    occasions: OCCASIONS,
    types: PRODUCT_TYPES,
  };
  const active = activeFilterCount(f);
  const brandName = (slug: string) => brands.find((b) => b.slug === slug)?.name ?? slug;

  const chips: { label: string; href: string }[] = [
    ...(f.brands ?? []).map((b) => ({ label: brandName(b), href: shopHref(f, { brands: f.brands!.filter((x) => x !== b), page: 1 }) })),
    ...(f.types ?? []).map((t) => ({ label: PRODUCT_TYPE_LABEL[t], href: shopHref(f, { types: f.types!.filter((x) => x !== t), page: 1 }) })),
    ...(f.families ?? []).map((t) => ({ label: t, href: shopHref(f, { families: f.families!.filter((x) => x !== t), page: 1 }) })),
    ...(f.occasions ?? []).map((t) => ({ label: t, href: shopHref(f, { occasions: f.occasions!.filter((x) => x !== t), page: 1 }) })),
    ...(f.concentrations ?? []).map((t) => ({ label: t, href: shopHref(f, { concentrations: f.concentrations!.filter((x) => x !== t), page: 1 }) })),
    ...(f.sizes ?? []).map((t) => ({ label: `${t} ml`, href: shopHref(f, { sizes: f.sizes!.filter((x) => x !== t), page: 1 }) })),
    ...(f.genders ?? []).map((t) => ({ label: t, href: shopHref(f, { genders: f.genders!.filter((x) => x !== t), page: 1 }) })),
    ...(f.minPricePaise != null ? [{ label: `From ${formatINR(f.minPricePaise)}`, href: shopHref(f, { minPricePaise: undefined, page: 1 }) }] : []),
    ...(f.maxPricePaise != null ? [{ label: `Up to ${formatINR(f.maxPricePaise)}`, href: shopHref(f, { maxPricePaise: undefined, page: 1 }) }] : []),
    ...(f.availableOnly ? [{ label: "Available now", href: shopHref(f, { availableOnly: false, page: 1 }) }] : []),
    ...(collection ? [{ label: collection.name, href: shopHref(f, { collection: undefined, page: 1 }) }] : []),
  ];

  const heading = collection?.name ?? (f.types?.length === 1 ? (f.types[0] === "inspired_fragrance" ? "Inspired fragrances" : f.types[0] === "authentic_branded" ? "Authentic branded" : "Other products") : "All fragrances");

  return (
    <Container className="py-10 lg:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />
      <div className="mt-6 mb-8 flex flex-col gap-2">
        <h1 className="text-4xl text-ink sm:text-5xl">{f.q ? <>Results for “{f.q}”</> : heading}</h1>
        {collection?.description && <p className="max-w-xl text-sm text-stone">{collection.description}</p>}
        {f.types?.includes("inspired_fragrance") && (
          <p className="max-w-2xl text-sm text-stone">Inspired fragrances are sold under their own names and are not affiliated with any designer brand.</p>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <div className="mb-5 flex items-center justify-between">
              <p className="eyebrow text-ink">Filter</p>
              {active > 0 && (
                <Link href={f.q ? `/shop?q=${encodeURIComponent(f.q)}` : "/shop"} className="text-xs text-stone underline underline-offset-2 hover:text-ink">
                  Reset all
                </Link>
              )}
            </div>
            <DesktopFilters f={f} facets={facets} />
          </div>
        </aside>

        <section aria-label="Products">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <MobileFilters f={f} facets={facets} activeCount={active} resultCount={result.total} />
              <p className="text-xs text-stone" aria-live="polite">
                {result.total} {result.total === 1 ? "product" : "products"}
              </p>
            </div>
            <SortSelect value={result.sortApplied} popularityAvailable={result.popularityAvailable} hasQuery={!!f.q} />
          </div>

          {f.sort === "popular" && !result.popularityAvailable && (
            <Notice className="mb-6">There isn&apos;t enough order history to rank by popularity yet, so products are shown newest first.</Notice>
          )}

          {chips.length > 0 && (
            <ul className="mb-6 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="inline-flex items-center gap-1.5 border border-line bg-paper px-2.5 py-1 text-xs text-charcoal hover:border-ink" aria-label={`Remove filter ${c.label}`}>
                    {c.label} <X className="h-3 w-3" />
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/shop" className="inline-flex px-2 py-1 text-xs text-stone underline underline-offset-2">
                  Clear all
                </Link>
              </li>
            </ul>
          )}

          {result.products.length ? (
            <ProductGrid products={result.products} columns={3} />
          ) : (
            <EmptyState
              title="No fragrances match"
              description={f.q ? `We couldn't find anything for “${f.q}”. Try a brand name or a note like oud, vanilla or citrus.` : "Try removing a filter or two."}
              action={<ButtonLink href="/shop" variant="outline">Reset filters</ButtonLink>}
            />
          )}

          {result.pageCount > 1 && (
            <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-1">
              {result.page > 1 && (
                <ButtonLink href={shopHref(f, { page: result.page - 1 })} variant="ghost" size="sm">
                  Previous
                </ButtonLink>
              )}
              {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={shopHref(f, { page: n })}
                  aria-current={n === result.page ? "page" : undefined}
                  className={`inline-flex h-9 min-w-9 items-center justify-center text-xs ${n === result.page ? "bg-ink text-paper" : "text-charcoal hover:bg-sand"}`}
                >
                  {n}
                </Link>
              ))}
              {result.page < result.pageCount && (
                <ButtonLink href={shopHref(f, { page: result.page + 1 })} variant="ghost" size="sm">
                  Next
                </ButtonLink>
              )}
            </nav>
          )}
        </section>
      </div>
    </Container>
  );
}
