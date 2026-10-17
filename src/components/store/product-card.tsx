import Link from "next/link";
import { formatINR } from "@/lib/money";
import type { ProductCard as Card } from "@/lib/services/catalog";
import { ProductImage } from "./product-image";
import { Badge } from "../ui/misc";

export function ProductCard({ p, priority }: { p: Card; priority?: boolean }) {
  const unavailable = p.availability !== "available";
  return (
    <article className="group relative flex flex-col">
      <Link href={`/products/${p.slug}`} className="block focus-visible:outline-offset-4" aria-label={`${p.brandName} ${p.name}`}>
        <div className="relative overflow-hidden">
          <ProductImage
            src={p.imageUrl}
            alt={p.imageAlt}
            brand={p.brandName}
            name={p.name}
            family={p.fragranceFamily}
            priority={priority}
            className="transition-transform duration-700 ease-out-soft group-hover:scale-[1.025]"
          />
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {p.productType === "inspired_fragrance" && <Badge tone="outline" className="bg-paper/90">Inspired fragrance</Badge>}
            {unavailable && <Badge tone="dark">{p.availability === "awaiting_supplier_confirmation" ? "Awaiting confirmation" : "Unavailable"}</Badge>}
          </div>
        </div>
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <p className="eyebrow text-[0.625rem]">
          {p.brandName}
          {p.isDemo && <span className="text-stone/70"> · Demo listing</span>}
        </p>
        <h3 className="mt-1 font-display text-xl leading-snug text-ink">
          <Link href={`/products/${p.slug}`} className="hover:underline hover:decoration-gold hover:underline-offset-4">
            {p.name}
          </Link>
        </h3>
        <p className="mt-1 text-xs text-stone">
          {[p.concentration, p.sizeMl ? `${p.sizeMl} ml` : null].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 flex items-baseline gap-2 text-sm">
          <span className="font-medium text-ink">{formatINR(p.sellingPricePaise)}</span>
          {p.mrpPaise && p.mrpPaise > p.sellingPricePaise && (
            <span className="text-xs text-mist line-through" aria-label={`MRP ${formatINR(p.mrpPaise)}`}>
              {formatINR(p.mrpPaise)}
            </span>
          )}
        </p>
      </div>
    </article>
  );
}

export function ProductGrid({ products, columns = 4 }: { products: Card[]; columns?: 3 | 4 }) {
  return (
    <div className={columns === 4 ? "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4" : "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3"}>
      {products.map((p, i) => (
        <ProductCard key={p.id} p={p} priority={i < 2} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4" aria-busy aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/5]" />
          <div className="skeleton mt-4 h-2.5 w-16" />
          <div className="skeleton mt-2 h-5 w-3/4" />
          <div className="skeleton mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
