import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Outfit, Swatch } from "@/lib/style/types";
import { LABELS } from "@/lib/style/quiz";
import { shopLinks, type ShopSettings } from "@/lib/style/shop";
import { OutfitFigure } from "./outfit-figure";

export function SwatchChip({ s, size = "md", label = true }: { s: Swatch; size?: "sm" | "md" | "lg"; label?: boolean }) {
  const dim = size === "lg" ? "h-20 w-full" : size === "md" ? "h-12 w-full" : "h-5 w-5";
  return (
    <div className={cn(size === "sm" ? "inline-flex items-center gap-1.5" : "")}>
      <div className={cn(dim, "rounded-lg ring-1 ring-black/10 ring-inset")} style={{ backgroundColor: s.hex }} aria-hidden />
      {label && <p className={cn("text-charcoal", size === "sm" ? "text-xs" : "mt-1.5 text-xs")}>{s.name}</p>}
    </div>
  );
}

export function SwatchGrid({ swatches, cols = "grid-cols-4 sm:grid-cols-5" }: { swatches: Swatch[]; cols?: string }) {
  return (
    <div className={cn("grid gap-3", cols)}>
      {swatches.map((s) => (
        <SwatchChip key={s.name + s.hex} s={s} />
      ))}
    </div>
  );
}

export function Section({ id, eyebrow, title, children, className }: { id?: string; eyebrow: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-24 border-t border-line py-12 sm:py-16", className)}>
      <SectionLabel eyebrow={eyebrow} />
      <h2 className="mb-8 text-3xl leading-[1.02] font-extrabold tracking-[-0.04em] sm:text-5xl">
        {title}
        <span className="text-gold">.</span>
      </h2>
      {children}
    </section>
  );
}

/** "01 · Body frame" → an orange number badge plus the label. */
function SectionLabel({ eyebrow }: { eyebrow: string }) {
  const m = eyebrow.match(/^(\d+)\s*·\s*(.+)$/);
  if (!m) return <p className="eyebrow mb-3">{eyebrow}</p>;
  return (
    <p className="mb-4 flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-gold font-display text-sm font-extrabold text-ink">{m[1]}</span>
      <span className="eyebrow">{m[2]}</span>
    </p>
  );
}

export function List({ items, tone = "do" }: { items: string[]; tone?: "do" | "dont" }) {
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed text-charcoal">
          <span aria-hidden className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", tone === "do" ? "bg-success" : "bg-danger")} />
          <span>
            <span className="sr-only">{tone === "do" ? "Do: " : "Avoid: "}</span>
            {i}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OutfitCard({ outfit, index, shop }: { outfit: Outfit; index: number; shop: ShopSettings | null }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper" data-occasion={outfit.occasion}>
      <div className="flex items-end gap-4 bg-sand/60 px-5 pt-5">
        <OutfitFigure pieces={outfit.pieces} className="h-44 w-auto shrink-0" />
        <div className="pb-5">
          <p className="eyebrow">
            {String(index + 1).padStart(2, "0")} · {LABELS.occasions[outfit.occasion]}
          </p>
          <h3 className="mt-1 text-xl leading-tight">{outfit.title}</h3>
          <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
            {outfit.pieces.map((p) => (
              <span key={p.slot + p.name} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: p.colour.hex }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <ul className="space-y-3">
          {outfit.pieces.map((p) => (
            <li key={p.slot + p.name} className="text-sm">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded ring-1 ring-black/10" style={{ backgroundColor: p.colour.hex }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{p.name}</p>
                  {p.fit && <p className="text-xs text-stone">Fit: {p.fit}</p>}
                  {shop && (
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {shopLinks(p.query, shop).map((l) => (
                        <a
                          key={l.store}
                          href={l.href}
                          target="_blank"
                          rel={l.affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
                          className="inline-flex items-center gap-0.5 text-gold-deep underline-offset-2 hover:underline"
                        >
                          {l.store}
                          {l.affiliate && <span className="text-mist">*</span>}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-stone">{outfit.why}</p>
      </div>
    </article>
  );
}

export function ConfidencePill({ level }: { level: "high" | "medium" | "low" }) {
  const t = { high: "bg-success/10 text-success", medium: "bg-gold-soft text-gold-deep", low: "bg-sand text-stone" }[level];
  return <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-medium", t)}>{level} confidence</span>;
}
