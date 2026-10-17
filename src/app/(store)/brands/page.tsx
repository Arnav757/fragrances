import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Container, EmptyState } from "@/components/ui/misc";
import { listBrands } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Brands", description: "Fragrance houses we stock — authentic Middle Eastern brands and our inspired ranges.", alternates: { canonical: "/brands" } };

export default async function BrandsPage() {
  const brands = (await listBrands()).filter((b) => b.productCount > 0);
  const groups = [
    { title: "Middle Eastern perfume houses", items: brands.filter((b) => b.isMiddleEastern) },
    { title: "Other brands", items: brands.filter((b) => !b.isMiddleEastern) },
  ].filter((g) => g.items.length);
  return (
    <Container className="py-12 lg:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Brands" }]} />
      <h1 className="mt-6 text-4xl text-ink sm:text-5xl">Brands</h1>
      {groups.length === 0 && <div className="mt-10"><EmptyState title="No brands yet" /></div>}
      {groups.map((g) => (
        <section key={g.title} className="mt-12">
          <h2 className="eyebrow mb-5 text-ink">{g.title}</h2>
          <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((b) => (
              <li key={b.slug} className="bg-ivory">
                <Link href={`/shop?brand=${b.slug}`} className="block h-full p-6 hover:bg-paper">
                  <p className="font-display text-3xl text-ink">{b.name}</p>
                  {b.origin && <p className="mt-1 text-xs text-stone">{b.origin}</p>}
                  {b.description && <p className="mt-3 text-sm leading-relaxed text-charcoal">{b.description}</p>}
                  <p className="mt-4 text-[0.6875rem] tracking-[0.14em] text-stone uppercase">{b.productCount} fragrance{b.productCount === 1 ? "" : "s"}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Container>
  );
}
