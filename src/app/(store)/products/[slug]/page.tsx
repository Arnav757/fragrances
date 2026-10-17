import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { Badge, Breadcrumbs, Container, Notice, SectionHeading } from "@/components/ui/misc";
import { ProductGrid } from "@/components/store/product-card";
import { Gallery, PincodeChecker, PurchasePanel, ShareButton } from "@/components/store/product-actions";
import { getApprovedReviews, getProductBySlug, getRelatedProducts } from "@/lib/services/catalog";
import { getSettings, storeName } from "@/lib/settings";
import { formatINR } from "@/lib/money";
import { AVAILABILITY_LABEL, PRODUCT_TYPE_LABEL } from "@/config/brand";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Product not found" };
  const title = `${p.brandName} ${p.name}${p.sizeMl ? ` ${p.sizeMl}ml` : ""}${p.concentration ? ` ${p.concentration}` : ""}`;
  const description =
    p.description.slice(0, 155) || `${p.brandName} ${p.name} — ${PRODUCT_TYPE_LABEL[p.productType].toLowerCase()} fragrance, ${formatINR(p.sellingPricePaise)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title, description, url: `/products/${p.slug}`, images: p.images[0] ? [{ url: p.images[0].url, alt: p.images[0].alt }] : undefined },
    robots: p.isDemo ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const [related, reviews, commerce, store] = await Promise.all([getRelatedProducts(p), getApprovedReviews(p.id), getSettings("commerce"), getSettings("store")]);

  const purchasable = p.availability === "available";
  const unavailableReason =
    p.availability === "awaiting_supplier_confirmation"
      ? "We're confirming availability with our supplier. We don't take payment until we know we can deliver."
      : p.availability === "discontinued"
        ? "This product has been discontinued."
        : "This product is currently unavailable.";
  const hasNotes = p.notesVerified && (p.topNotes.length || p.heartNotes.length || p.baseNotes.length);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${p.brandName} ${p.name}`,
    brand: { "@type": "Brand", name: p.brandName },
    description: p.description,
    sku: p.slug,
    image: p.images.map((i) => i.url.startsWith("http") ? i.url : env().SITE_URL + i.url),
    ...(p.reviewCount > 0 && p.ratingAverage ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAverage, reviewCount: p.reviewCount } } : {}),
    offers: {
      "@type": "Offer",
      url: `${env().SITE_URL}/products/${p.slug}`,
      priceCurrency: "INR",
      price: (p.sellingPricePaise / 100).toFixed(2),
      availability: purchasable ? "https://schema.org/InStock" : p.availability === "discontinued" ? "https://schema.org/Discontinued" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: storeName(store) },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Container className="py-8 lg:py-12">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: p.brandName, href: `/shop?brand=${p.brandSlug}` }, { label: p.name }]} />
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Gallery images={p.images} brand={p.brandName} name={p.name} family={p.fragranceFamily} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={p.productType === "authentic_branded" ? "gold" : "outline"}>{PRODUCT_TYPE_LABEL[p.productType]}</Badge>
              {p.isDemo && <Badge tone="warning">Demo listing</Badge>}
            </div>
            <p className="eyebrow mt-5">
              <Link href={`/shop?brand=${p.brandSlug}`} className="hover:text-ink">
                {p.brandName}
              </Link>
            </p>
            <h1 className="mt-2 text-4xl leading-tight text-ink sm:text-5xl">{p.name}</h1>
            <p className="mt-2 text-sm text-stone">{[p.concentration, p.sizeMl ? `${p.sizeMl} ml` : null, p.gender ? (p.gender === "Unisex" ? "Unisex" : `Marketed for ${p.gender.toLowerCase()}`) : null].filter(Boolean).join(" · ")}</p>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-2xl text-ink">{formatINR(p.sellingPricePaise)}</span>
              {p.mrpPaise && p.mrpPaise > p.sellingPricePaise && (
                <span className="text-sm text-stone">
                  MRP <span className="line-through">{formatINR(p.mrpPaise)}</span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-stone">{commerce.pricesIncludeTax ? "Inclusive of all taxes." : "GST is added at checkout."} Shipping calculated in cart.</p>

            {p.isDemo && (
              <Notice tone="warning" className="mt-5">
                This is a demonstration listing. Its price, availability and details are placeholders and are not a live offer.
              </Notice>
            )}
            {p.productType === "inspired_fragrance" && (
              <Notice className="mt-5">This is an inspired fragrance sold under its own name. It is not a designer original and is not affiliated with any designer brand.</Notice>
            )}

            <p className={`mt-6 flex items-center gap-2 text-sm ${purchasable ? "text-success" : "text-warning"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${purchasable ? "bg-success" : "bg-warning"}`} aria-hidden />
              {AVAILABILITY_LABEL[p.availability]}
            </p>

            <div className="mt-5">
              <PurchasePanel productId={p.id} maxPerOrder={p.maxPerOrder} purchasable={purchasable} unavailableReason={unavailableReason} />
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <PincodeChecker />
            </div>

            <div className="mt-8 border-t border-line pt-8">
              <h2 className="eyebrow mb-3 text-ink">About this fragrance</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-charcoal">{p.description}</p>
            </div>

            <div className="mt-8 border-t border-line pt-8">
              <h2 className="eyebrow mb-4 text-ink">Fragrance notes</h2>
              {hasNotes ? (
                <dl className="grid gap-4 sm:grid-cols-3">
                  {(
                    [
                      ["Top", p.topNotes],
                      ["Heart", p.heartNotes],
                      ["Base", p.baseNotes],
                    ] as const
                  ).map(([label, notes]) => (
                    <div key={label} className="border-l border-gold pl-4">
                      <dt className="text-[0.6875rem] tracking-[0.14em] text-stone uppercase">{label}</dt>
                      <dd className="mt-1 font-display text-lg text-ink">{notes.length ? notes.join(", ") : "—"}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-stone">Notes for this fragrance are being verified against the manufacturer&apos;s information and will be published once confirmed.</p>
              )}
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                {p.fragranceFamily && (
                  <div>
                    <dt className="text-xs text-stone">Family</dt>
                    <dd className="mt-0.5">
                      <Link href={`/shop?family=${p.fragranceFamily}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                        {p.fragranceFamily}
                      </Link>
                    </dd>
                  </div>
                )}
                {p.occasions.length > 0 && (
                  <div>
                    <dt className="text-xs text-stone">Suits</dt>
                    <dd className="mt-0.5 text-ink">{p.occasions.join(", ")}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="mt-8 grid gap-4 border-t border-line pt-8 text-sm sm:grid-cols-3">
              <Link href="/shipping-policy" className="group flex gap-3">
                <Truck className="h-5 w-5 shrink-0 text-gold-deep" strokeWidth={1.3} />
                <span>
                  <span className="block text-ink group-hover:underline">Shipping</span>
                  <span className="text-xs text-stone">
                    {commerce.freeShippingThresholdPaise !== null ? `Free over ${formatINR(commerce.freeShippingThresholdPaise)}` : `${formatINR(commerce.flatShippingPaise)} flat`}; tracking on dispatch
                  </span>
                </span>
              </Link>
              <Link href="/returns" className="group flex gap-3">
                <RotateCcw className="h-5 w-5 shrink-0 text-gold-deep" strokeWidth={1.3} />
                <span>
                  <span className="block text-ink group-hover:underline">Returns</span>
                  <span className="text-xs text-stone">Damaged or incorrect items, within {commerce.returnWindowDays} days</span>
                </span>
              </Link>
              <Link href="/authenticity" className="group flex gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-gold-deep" strokeWidth={1.3} />
                <span>
                  <span className="block text-ink group-hover:underline">Authenticity</span>
                  <span className="text-xs text-stone">How we label and source</span>
                </span>
              </Link>
            </div>

            <div className="mt-8">
              <ShareButton title={`${p.brandName} ${p.name}`} />
            </div>
          </div>
        </div>

        <section className="mt-20 border-t border-line pt-14" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-3xl text-ink">
            Customer reviews
          </h2>
          {reviews.length ? (
            <>
              <p className="mt-2 text-sm text-stone">
                {p.ratingAverage} out of 5 from {p.reviewCount} verified purchase{p.reviewCount === 1 ? "" : "s"}.
              </p>
              <ul className="mt-8 grid gap-6 md:grid-cols-2">
                {reviews.map((r) => (
                  <li key={r.id} className="border border-line bg-paper p-6">
                    <p className="text-sm text-gold-deep" aria-label={`${r.rating} out of 5`}>
                      {"★".repeat(r.rating)}
                      <span className="text-line">{"★".repeat(5 - r.rating)}</span>
                    </p>
                    {r.title && <h3 className="mt-2 font-display text-xl">{r.title}</h3>}
                    <p className="mt-2 text-sm leading-relaxed text-charcoal">{r.body}</p>
                    <p className="mt-4 text-xs text-stone">
                      {r.authorName} · Verified purchase · {formatDate(r.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-sm text-stone">No reviews yet. Reviews can only be written by customers who have received this product.</p>
          )}
        </section>

        {related.length > 0 && (
          <section className="mt-20 border-t border-line pt-14">
            <SectionHeading eyebrow="You may also like" title="Related fragrances" />
            <ProductGrid products={related} />
          </section>
        )}
      </Container>
    </>
  );
}
