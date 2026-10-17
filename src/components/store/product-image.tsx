import Image from "next/image";
import { cn } from "@/lib/utils";

const familyTint: Record<string, string> = {
  Fresh: "#dfe5df",
  Citrus: "#ece6cf",
  Aquatic: "#d9e2e4",
  Woody: "#e2d8c8",
  Amber: "#eadbc2",
  Oud: "#ddd0c4",
  Sweet: "#efdfd6",
  Spicy: "#e8d6c9",
  Floral: "#eddcdc",
  Musk: "#e6e1da",
  Leather: "#ddd2c6",
  Fougere: "#dde2d6",
};

/**
 * Product imagery. When no licensed photo exists we show an honest typographic placeholder rather than
 * an invented bottle that could misrepresent the real product.
 */
export function ProductImage({
  src,
  alt,
  brand,
  name,
  family,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  priority,
  className,
}: {
  src: string | null;
  alt: string | null;
  brand: string;
  name: string;
  family?: string | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (src) {
    return (
      <div className={cn("relative aspect-[4/5] overflow-hidden bg-sand", className)}>
        <Image src={src} alt={alt || `${brand} ${name}`} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  const tint = (family && familyTint[family]) || "#e6dfd3";
  return (
    <div
      className={cn("relative flex aspect-[4/5] flex-col items-center justify-center overflow-hidden px-6 pt-8 text-center", className)}
      style={{ background: `radial-gradient(120% 80% at 50% 30%, #fbf8f2 0%, ${tint} 100%)` }}
      role="img"
      aria-label={`${brand} ${name} — photo coming soon`}
    >
      <span className="absolute inset-3 border border-ink/10" aria-hidden />
      <span className="eyebrow text-[0.6rem] text-stone">{brand}</span>
      <span className="mt-2 font-display text-2xl leading-tight text-ink/85">{name}</span>
      {family && <span className="mt-3 h-px w-8 bg-gold" aria-hidden />}
      <span className="absolute bottom-6 text-[0.625rem] tracking-[0.14em] text-stone/80 uppercase">Photo coming soon</span>
    </div>
  );
}
