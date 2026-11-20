"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Link2, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Outfit, Report } from "@/lib/style/types";
import { LABELS, type Occasion } from "@/lib/style/quiz";
import type { ShopSettings } from "@/lib/style/shop";
import { shopLinks } from "@/lib/style/shop";
import { OutfitCard } from "./parts";

export function OutfitBrowser({ outfits, shop, priority }: { outfits: Outfit[]; shop: ShopSettings | null; priority: Occasion[] }) {
  const occasions = useMemo(() => {
    const present = new Set(outfits.map((o) => o.occasion));
    return [...priority, ...(Object.keys(LABELS.occasions) as Occasion[]).filter((o) => !priority.includes(o))].filter((o) => present.has(o));
  }, [outfits, priority]);
  const [filter, setFilter] = useState<Occasion | "all">("all");
  const shown = filter === "all" ? outfits : outfits.filter((o) => o.occasion === filter);
  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter outfits by occasion">
        {(["all", ...occasions] as const).map((o) => {
          const count = o === "all" ? outfits.length : outfits.filter((x) => x.occasion === o).length;
          return (
            <button
              key={o}
              type="button"
              onClick={() => setFilter(o)}
              aria-pressed={filter === o}
              className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", filter === o ? "border-ink bg-ink text-paper" : "border-line bg-paper text-charcoal hover:border-ink")}
            >
              {o === "all" ? "All" : LABELS.occasions[o]} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((o) => (
          <OutfitCard key={o.id} outfit={o} index={outfits.indexOf(o)} shop={shop} />
        ))}
      </div>
    </div>
  );
}

/** Wardrobe checklist; ticks are remembered on this device only. */
export function CapsuleChecklist({ items, storageKey, shop }: { items: Report["capsule"]; storageKey: string; shop: ShopSettings | null }) {
  const [owned, setOwned] = useState<Record<number, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // Restoring per-device state from browser storage after hydration (it can't be read during SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setOwned(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);
  function toggle(i: number) {
    setOwned((prev) => {
      const next = { ...prev, [i]: !prev[i] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }
  const have = items.filter((_, i) => owned[i]).length;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(have / items.length) * 100}%` }} />
        </div>
        <p className="text-sm text-stone tabular-nums">
          {have} of {items.length} owned
        </p>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-4 px-4 py-3">
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={!!owned[i]}
              aria-label={`${owned[i] ? "Unmark" : "Mark"} ${c.colour.name} ${c.item} as owned`}
              className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", owned[i] ? "border-success bg-success text-paper" : "border-line bg-paper")}
            >
              {owned[i] && <Check className="h-4 w-4" aria-hidden />}
            </button>
            <span className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-black/10" style={{ backgroundColor: c.colour.hex }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", owned[i] && "text-stone line-through")}>
                {c.colour.name} {c.item.toLowerCase()}
              </p>
              <p className="text-xs text-stone">{c.why}</p>
            </div>
            {shop && !owned[i] && (
              <div className="no-print hidden gap-3 text-xs sm:flex">
                {shopLinks(c.query, shop).map((l) => (
                  <a key={l.store} href={l.href} target="_blank" rel={l.affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"} className="text-gold-deep hover:underline">
                    {l.store}
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportToolbar() {
  function copy() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success("Link copied. Anyone with this link can open your report."))
      .catch(() => toast.error("Couldn't copy — copy the address bar instead."));
  }
  return (
    <div className="no-print flex gap-2">
      <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-sm hover:border-ink">
        <Link2 className="h-4 w-4" aria-hidden /> Copy link
      </button>
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 text-sm hover:border-ink">
        <Printer className="h-4 w-4" aria-hidden /> Save as PDF
      </button>
    </div>
  );
}
