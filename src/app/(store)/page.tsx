import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/ui/misc";
import { ProductGrid } from "@/components/store/product-card";
import { HeroArt } from "@/components/store/hero-art";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { getBestsellers, getProductsWhere, listBrands, listFeaturedCollections } from "@/lib/services/catalog";
import { getSettings, storeName } from "@/lib/settings";
import { HOMEPAGE_FAMILIES, OCCASIONS } from "@/config/brand";

const occasionNotes: Record<string, string> = {
  Office: "Clean, close-wearing",
  Everyday: "Easy, versatile",
  "Date Night": "Warm, sensual",
  Evening: "Rich, lingering",
  Summer: "Bright, airy",
  Winter: "Deep, enveloping",
};
const familyNotes: Record<string, string> = {
  Fresh: "Citrus · green · aquatic",
  Woody: "Cedar · vetiver · sandalwood",
  Amber: "Resins · labdanum · vanilla",
  Oud: "Agarwood · smoke · rose",
  Sweet: "Gourmand · praline · tonka",
  Spicy: "Saffron · cardamom · pepper",
};

export default async function HomePage() {
  const [homepage, store, bestsellers, authentic, inspired, recent, brands, collections] = await Promise.all([
    getSettings("homepage"),
    getSettings("store"),
    getBestsellers(4),
    getProductsWhere({ type: "authentic_branded", middleEastern: true, limit: 4 }),
    getProductsWhere({ type: "inspired_fragrance", limit: 4 }),
    getProductsWhere({ limit: 8 }),
    listBrands(),
    listFeaturedCollections(),
  ]);
  const meBrands = brands.filter((b) => b.isMiddleEastern && b.productCount > 0);
  const name = storeName(store);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <Container size="wide" className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-20">
          <div className="max-w-xl">
            {homepage.heroEyebrow && <p className="eyebrow mb-6">{homepage.heroEyebrow}</p>}
            <h1 className="text-[2.75rem] leading-[1.02] text-ink sm:text-6xl lg:text-[4.6rem]">{homepage.heroTitle}</h1>
            <p className="mt-6 max-w-lg text-[0.975rem] leading-relaxed text-stone">{homepage.heroSubtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/shop" size="lg">
                Shop fragrances
              </ButtonLink>
              <ButtonLink href="/shop?sort=popular" variant="outline" size="lg">
                Explore bestsellers
              </ButtonLink>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[520px]">
            {homepage.heroImageUrl ? (
              <div className="relative aspect-[7/8]">
                <Image src={homepage.heroImageUrl} alt="" fill priority sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
              </div>
            ) : (
              <HeroArt className="h-auto w-full" />
            )}
          </div>
        </Container>
        <div className="border-t border-line bg-paper">
          <Container size="wide">
            <ul className="grid grid-cols-2 gap-px text-center text-[0.6875rem] tracking-[0.12em] text-charcoal uppercase lg:grid-cols-4">
              {["Authentic & inspired, clearly labelled", "Only verified notes and prices", "Secure checkout via Razorpay", "Tracking shared on dispatch"].map((t) => (
                <li key={t} className="px-3 py-4">
                  {t}
                </li>
              ))}
            </ul>
          </Container>
        </div>
      </section>

      {/* Collections */}
      {collections.length > 0 && (
        <section className="py-20">
          <Container>
            <SectionHeading eyebrow="Curated edits" title="Featured collections" />
            <div className="grid gap-4 md:grid-cols-3">
              {collections.map((c, i) => (
                <Link
                  key={c.slug}
                  href={`/shop?collection=${c.slug}`}
                  className={`group relative flex min-h-64 flex-col justify-end overflow-hidden p-7 ${i === 0 ? "bg-night text-paper" : i === 1 ? "bg-sand" : "bg-gold-soft"}`}
                >
                  <span aria-hidden className={`absolute top-6 right-6 font-display text-7xl leading-none ${i === 0 ? "text-paper/10" : "text-ink/10"}`}>
                    0{i + 1}
                  </span>
                  <h3 className="text-3xl">{c.name}</h3>
                  {c.description && <p className={`mt-2 max-w-xs text-sm ${i === 0 ? "text-paper/70" : "text-stone"}`}>{c.description}</p>}
                  <span className="mt-5 inline-flex items-center gap-2 text-[0.6875rem] tracking-[0.16em] uppercase">
                    {c.productCount} fragrance{c.productCount === 1 ? "" : "s"} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Bestsellers (real order data only) */}
      <section className="border-y border-line bg-paper py-20">
        <Container>
          <SectionHeading
            eyebrow="Most ordered"
            title="Bestsellers"
            description="Ranked by actual orders over the last 90 days."
            action={bestsellers.length ? <ButtonLink href="/shop?sort=popular" variant="link">View all</ButtonLink> : undefined}
          />
          {bestsellers.length ? (
            <ProductGrid products={bestsellers} />
          ) : (
            <div className="border border-dashed border-line px-6 py-12 text-center">
              <p className="font-display text-2xl text-ink">Our bestsellers will appear here</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-stone">We rank bestsellers only from real orders, so this list fills in once customers start shopping. Meanwhile, browse the full collection.</p>
              <ButtonLink href="/shop" variant="outline" className="mt-6">
                Browse all fragrances
              </ButtonLink>
            </div>
          )}
        </Container>
      </section>

      {/* Authentic Middle Eastern brands */}
      <section className="py-20">
        <Container>
          <SectionHeading
            eyebrow="Authentic branded"
            title="Middle Eastern perfume houses"
            description="Genuine products from established houses, sourced through our trade partners."
            action={<ButtonLink href="/shop?type=authentic_branded" variant="link">Shop authentic</ButtonLink>}
          />
          {meBrands.length > 0 && (
            <ul className="mb-12 grid grid-cols-2 border-t border-l border-line sm:grid-cols-4">
              {meBrands.map((b) => (
                <li key={b.slug} className="border-r border-b border-line">
                  <Link href={`/shop?brand=${b.slug}`} className="group flex h-28 flex-col items-center justify-center gap-1 transition-colors hover:bg-paper">
                    <span className="font-display text-2xl tracking-[0.12em] text-ink uppercase">{b.name}</span>
                    <span className="text-[0.6875rem] text-stone">{b.productCount} fragrance{b.productCount === 1 ? "" : "s"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {authentic.length > 0 && <ProductGrid products={authentic} />}
        </Container>
      </section>

      {/* Inspired */}
      <section className="bg-night py-20 text-paper">
        <Container>
          <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-end">
            <div>
              <p className="eyebrow mb-3 text-gold">A separate category</p>
              <h2 className="text-3xl leading-[1.1] sm:text-[2.6rem]">Inspired fragrances</h2>
            </div>
            <p className="text-sm leading-relaxed text-paper/65">
              Inspired fragrances are sold under their own names. They are not designer originals and are not affiliated with any designer brand — every listing says
              so plainly. <Link href="/authenticity" className="text-gold underline underline-offset-4">Read our authenticity policy</Link>.
            </p>
          </div>
          {inspired.length ? (
            <div className="[&_.eyebrow]:text-paper/50 [&_h3]:text-paper [&_p]:text-paper/70 [&_span.font-medium]:text-paper">
              <ProductGrid products={inspired} />
            </div>
          ) : (
            <p className="text-sm text-paper/60">Inspired fragrances are coming soon.</p>
          )}
          <ButtonLink href="/shop?type=inspired_fragrance" variant="gold" className="mt-10">
            Shop inspired fragrances
          </ButtonLink>
        </Container>
      </section>

      {/* Occasion */}
      <section className="py-20">
        <Container>
          <SectionHeading eyebrow="Find your scent" title="Browse by occasion" />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {OCCASIONS.map((o) => (
              <li key={o}>
                <Link href={`/shop?occasion=${encodeURIComponent(o)}`} className="group flex h-36 flex-col justify-between border border-line bg-paper p-5 transition-colors hover:border-ink">
                  <span className="text-[0.6875rem] text-stone">{occasionNotes[o]}</span>
                  <span className="flex items-center justify-between font-display text-2xl text-ink">
                    {o}
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Family */}
      <section className="pb-20">
        <Container>
          <SectionHeading eyebrow="Olfactive families" title="Browse by fragrance family" />
          <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
            {HOMEPAGE_FAMILIES.map((f) => (
              <li key={f} className="bg-ivory">
                <Link href={`/shop?family=${f}`} className="group block px-6 py-8 transition-colors hover:bg-paper">
                  <span className="block font-display text-3xl text-ink italic">{f}</span>
                  <span className="mt-2 block text-xs text-stone">{familyNotes[f]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Recently added */}
      {recent.length > 0 && (
        <section className="border-t border-line bg-paper py-20">
          <Container>
            <SectionHeading eyebrow="Just in" title="Recently added" action={<ButtonLink href="/shop?sort=newest" variant="link">See all new</ButtonLink>} />
            <ProductGrid products={recent.slice(0, 4)} />
          </Container>
        </section>
      )}

      {/* Story */}
      <section className="py-24">
        <Container size="narrow" className="text-center">
          <p className="eyebrow mb-5">Our story</p>
          <h2 className="text-4xl leading-tight text-ink sm:text-5xl">{homepage.storyTitle}</h2>
          <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-stone">{homepage.storyBody}</p>
          <ButtonLink href="/about" variant="link" className="mt-8">
            More about us
          </ButtonLink>
        </Container>
      </section>

      {/* Newsletter */}
      <section className="border-t border-line">
        <Container className="grid gap-8 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl text-ink sm:text-4xl">New arrivals, first.</h2>
            <p className="mt-3 max-w-md text-sm text-stone">Occasional emails about new fragrances and genuine offers. No daily blasts.</p>
          </div>
          <NewsletterForm storeName={name} />
        </Container>
      </section>
    </>
  );
}
