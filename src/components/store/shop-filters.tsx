"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useTransition, type ReactNode } from "react";
import { Button, ButtonLink } from "../ui/button";
import type { ShopFilters } from "@/lib/services/catalog";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/config/brand";

export type FacetData = {
  brands: { slug: string; name: string; productCount: number }[];
  families: readonly string[];
  concentrations: string[];
  sizes: number[];
  genders: readonly string[];
  occasions: readonly string[];
  types: readonly ProductType[];
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-b border-line py-5 first:pt-0">
      <legend className="mb-3 text-[0.6875rem] font-medium tracking-[0.16em] text-ink uppercase">{title}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

function Check({ name, value, checked, label }: { name: string; value: string; checked: boolean; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-charcoal hover:text-ink">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="h-3.5 w-3.5 accent-ink" />
      {label}
    </label>
  );
}

function FilterForm({ f, facets, onApplied, idPrefix }: { f: ShopFilters; facets: FacetData; onApplied?: () => void; idPrefix: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  function apply() {
    const form = ref.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) if (typeof v === "string" && v !== "") params.append(k, v);
    start(() => router.push(`/shop${params.toString() ? `?${params}` : ""}`, { scroll: false }));
    onApplied?.();
  }
  return (
    <form
      ref={ref}
      action="/shop"
      method="get"
      onChange={(e) => {
        if ((e.target as unknown as HTMLInputElement).type !== "number") apply();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      aria-busy={pending}
    >
      {f.q && <input type="hidden" name="q" value={f.q} />}
      {f.sort && <input type="hidden" name="sort" value={f.sort} />}
      {f.collection && <input type="hidden" name="collection" value={f.collection} />}
      <Group title="Availability">
        <Check name="available" value="1" checked={!!f.availableOnly} label="Available to order now" />
      </Group>
      <Group title="Product type">
        {facets.types.map((t) => (
          <Check key={t} name="type" value={t} checked={!!f.types?.includes(t)} label={PRODUCT_TYPE_LABEL[t]} />
        ))}
      </Group>
      <Group title="Price (₹)">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`${idPrefix}-min`}>Minimum price</label>
          <input id={`${idPrefix}-min`} name="min" type="number" min={0} inputMode="numeric" placeholder="Min" defaultValue={f.minPricePaise != null ? f.minPricePaise / 100 : ""} className="h-9 w-full border border-line bg-paper px-2 text-sm" />
          <span className="text-stone">–</span>
          <label className="sr-only" htmlFor={`${idPrefix}-max`}>Maximum price</label>
          <input id={`${idPrefix}-max`} name="max" type="number" min={0} inputMode="numeric" placeholder="Max" defaultValue={f.maxPricePaise != null ? f.maxPricePaise / 100 : ""} className="h-9 w-full border border-line bg-paper px-2 text-sm" />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="mt-2 w-full">Apply price</Button>
      </Group>
      <Group title="Brand">
        {facets.brands.filter((b) => b.productCount > 0).map((b) => (
          <Check key={b.slug} name="brand" value={b.slug} checked={!!f.brands?.includes(b.slug)} label={<>{b.name} <span className="text-mist">({b.productCount})</span></>} />
        ))}
      </Group>
      <Group title="Fragrance family">
        {facets.families.map((x) => <Check key={x} name="family" value={x} checked={!!f.families?.includes(x)} label={x} />)}
      </Group>
      <Group title="Occasion">
        {facets.occasions.map((x) => <Check key={x} name="occasion" value={x} checked={!!f.occasions?.includes(x)} label={x} />)}
      </Group>
      <Group title="Concentration">
        {facets.concentrations.map((x) => <Check key={x} name="concentration" value={x} checked={!!f.concentrations?.includes(x)} label={x} />)}
      </Group>
      <Group title="Size">
        {facets.sizes.map((x) => <Check key={x} name="size" value={String(x)} checked={!!f.sizes?.includes(x)} label={`${x} ml`} />)}
      </Group>
      <Group title="Marketed for">
        {facets.genders.map((x) => <Check key={x} name="gender" value={x} checked={!!f.genders?.includes(x)} label={x} />)}
      </Group>
      <noscript>
        <Button type="submit" className="mt-4 w-full">Apply filters</Button>
      </noscript>
    </form>
  );
}

export function DesktopFilters(props: { f: ShopFilters; facets: FacetData }) {
  return <FilterForm {...props} idPrefix="d" />;
}

export function MobileFilters({ f, facets, activeCount, resultCount }: { f: ShopFilters; facets: FacetData; activeCount: number; resultCount: number }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters{activeCount ? ` (${activeCount})` : ""}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[90%] max-w-sm flex-col bg-ivory focus:outline-none">
          <div className="flex h-16 items-center justify-between border-b border-line px-5">
            <Dialog.Title className="eyebrow text-ink">Filters</Dialog.Title>
            <Dialog.Close className="inline-flex h-10 w-10 items-center justify-center" aria-label="Close filters">
              <X className="h-5 w-5" strokeWidth={1.4} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Refine products by brand, family, price and more</Dialog.Description>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <FilterForm f={f} facets={facets} idPrefix="m" />
          </div>
          <div className="flex gap-3 border-t border-line p-4">
            <ButtonLink href="/shop" variant="outline" className="flex-1">Reset</ButtonLink>
            <Dialog.Close asChild>
              <Button className="flex-1">Show {resultCount}</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SortSelect({ value, popularityAvailable, hasQuery }: { value: string; popularityAvailable: boolean; hasQuery: boolean }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-xs text-stone">
      <span className="hidden sm:inline">Sort</span>
      <select
        aria-label="Sort products"
        value={value}
        onChange={(e) => {
          const url = new URL(window.location.href);
          url.searchParams.set("sort", e.target.value);
          url.searchParams.delete("page");
          router.push(url.pathname + url.search, { scroll: false });
        }}
        className="h-9 border border-line bg-paper px-2 text-xs text-ink"
      >
        {hasQuery && <option value="relevance">Best match</option>}
        <option value="newest">Newest</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
        <option value="popular" disabled={!popularityAvailable}>
          Popularity{popularityAvailable ? "" : " (not enough orders yet)"}
        </option>
      </select>
    </label>
  );
}
