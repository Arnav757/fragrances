"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { archiveProductAction, deleteImageAction, deleteOfferAction, saveOfferAction, saveProductAction, uploadImageAction } from "@/app/actions/admin-catalog";
import { AVAILABILITY, AVAILABILITY_LABEL, CONCENTRATIONS, FAMILIES, GENDERS, OCCASIONS, PRODUCT_TYPES, PRODUCT_TYPE_LABEL } from "@/config/brand";
import { formatINR, formatRateBp, paiseToRupeesString, rupeesToPaise } from "@/lib/money";
import { slugify, formatDate } from "@/lib/utils";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Label, Select, Textarea } from "../ui/form";
import { Badge, Notice } from "../ui/misc";

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  brandId: string;
  productType: string;
  description: string;
  sizeMl: number | null;
  concentration: string | null;
  fragranceFamily: string | null;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  notesVerified: boolean;
  gender: string | null;
  occasions: string[];
  sellingPricePaise: number;
  mrpPaise: number | null;
  mrpVerified: boolean;
  taxClassId: string | null;
  availability: string;
  isActive: boolean;
  isFeatured: boolean;
  maxPerOrder: number;
  collectionIds: string[];
  isDemo?: boolean;
};

type Option = { id: string; name: string };

export function ProductForm({
  initial,
  brands,
  collections,
  taxClasses,
}: {
  initial: ProductFormValues | null;
  brands: Option[];
  collections: Option[];
  taxClasses: { id: string; name: string; gstRateBp: number; isVerified: boolean }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [v, setV] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    slugTouched: !!initial,
    brandId: initial?.brandId ?? brands[0]?.id ?? "",
    productType: initial?.productType ?? "authentic_branded",
    description: initial?.description ?? "",
    sizeMl: initial?.sizeMl?.toString() ?? "",
    concentration: initial?.concentration ?? "",
    fragranceFamily: initial?.fragranceFamily ?? "",
    topNotes: initial?.topNotes.join(", ") ?? "",
    heartNotes: initial?.heartNotes.join(", ") ?? "",
    baseNotes: initial?.baseNotes.join(", ") ?? "",
    notesVerified: initial?.notesVerified ?? false,
    gender: initial?.gender ?? "",
    occasions: initial?.occasions ?? [],
    price: paiseToRupeesString(initial?.sellingPricePaise ?? null),
    mrp: paiseToRupeesString(initial?.mrpPaise ?? null),
    mrpVerified: initial?.mrpVerified ?? false,
    taxClassId: initial?.taxClassId ?? taxClasses[0]?.id ?? "",
    availability: initial?.availability ?? "awaiting_supplier_confirmation",
    isActive: initial?.isActive ?? false,
    isFeatured: initial?.isFeatured ?? false,
    maxPerOrder: String(initial?.maxPerOrder ?? 5),
    collectionIds: initial?.collectionIds ?? [],
  });
  const set = (patch: Partial<typeof v>) => setV((p) => ({ ...p, ...patch }));
  const brandName = brands.find((b) => b.id === v.brandId)?.name ?? "";

  function submit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name: v.name,
      slug: v.slug,
      brandId: v.brandId,
      productType: v.productType,
      description: v.description,
      sizeMl: v.sizeMl ? Number(v.sizeMl) : null,
      concentration: v.concentration || null,
      fragranceFamily: v.fragranceFamily || null,
      topNotes: v.topNotes,
      heartNotes: v.heartNotes,
      baseNotes: v.baseNotes,
      notesVerified: v.notesVerified,
      gender: v.gender || null,
      occasions: v.occasions,
      sellingPricePaise: rupeesToPaise(v.price) ?? 0,
      mrpPaise: rupeesToPaise(v.mrp),
      mrpVerified: v.mrpVerified,
      taxClassId: v.taxClassId || null,
      availability: v.availability,
      isActive: v.isActive,
      isFeatured: v.isFeatured,
      maxPerOrder: Number(v.maxPerOrder),
      collectionIds: v.collectionIds,
    };
    start(async () => {
      const r = await saveProductAction(initial?.id ?? null, payload);
      if (r.ok) {
        setErrors({});
        toast.success(r.message ?? "Saved");
        router.refresh();
      } else {
        setErrors(r.errors ?? {});
        toast.error(r.message);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <section className="grid gap-4 border border-line bg-paper p-5 sm:grid-cols-2">
        <h2 className="text-[0.6875rem] font-medium tracking-[0.14em] uppercase sm:col-span-2">Basics</h2>
        <Field label="Product name" htmlFor="p-name" error={errors.name}>
          <Input id="p-name" value={v.name} onChange={(e) => set({ name: e.target.value, ...(v.slugTouched ? {} : { slug: slugify(`${brandName} ${e.target.value} ${v.sizeMl ? v.sizeMl + "ml" : ""}`) }) })} />
        </Field>
        <Field label="Brand" htmlFor="p-brand" error={errors.brandId}>
          <Select id="p-brand" value={v.brandId} onChange={(e) => set({ brandId: e.target.value })}>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="URL slug" htmlFor="p-slug" error={errors.slug} hint={`/products/${v.slug || "…"}`}>
          <Input id="p-slug" value={v.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase(), slugTouched: true })} />
        </Field>
        <Field label="Product type" htmlFor="p-type" error={errors.productType} hint="Shown prominently to customers. Inspired fragrances must never be presented as designer originals.">
          <Select id="p-type" value={v.productType} onChange={(e) => set({ productType: e.target.value })}>
            {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{PRODUCT_TYPE_LABEL[t]}</option>)}
          </Select>
        </Field>
        <Field label="Description" htmlFor="p-desc" error={errors.description} className="sm:col-span-2" hint="Accurate and factual. Don't claim longevity, projection or ingredients unless verified.">
          <Textarea id="p-desc" rows={5} value={v.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </section>

      <section className="grid gap-4 border border-line bg-paper p-5 sm:grid-cols-3">
        <h2 className="text-[0.6875rem] font-medium tracking-[0.14em] uppercase sm:col-span-3">Fragrance details</h2>
        <Field label="Size (ml)" htmlFor="p-size" error={errors.sizeMl}>
          <Input id="p-size" inputMode="numeric" value={v.sizeMl} onChange={(e) => set({ sizeMl: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label="Concentration" htmlFor="p-conc" error={errors.concentration}>
          <Select id="p-conc" value={v.concentration} onChange={(e) => set({ concentration: e.target.value })}>
            <option value="">Unknown</option>
            {CONCENTRATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Fragrance family" htmlFor="p-family" error={errors.fragranceFamily}>
          <Select id="p-family" value={v.fragranceFamily} onChange={(e) => set({ fragranceFamily: e.target.value })}>
            <option value="">—</option>
            {FAMILIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Top notes" htmlFor="p-top" hint="Comma separated">
          <Input id="p-top" value={v.topNotes} onChange={(e) => set({ topNotes: e.target.value })} />
        </Field>
        <Field label="Heart notes" htmlFor="p-heart">
          <Input id="p-heart" value={v.heartNotes} onChange={(e) => set({ heartNotes: e.target.value })} />
        </Field>
        <Field label="Base notes" htmlFor="p-base">
          <Input id="p-base" value={v.baseNotes} onChange={(e) => set({ baseNotes: e.target.value })} />
        </Field>
        <Checkbox id="p-notes-verified" className="sm:col-span-3" checked={v.notesVerified} onChange={(e) => set({ notesVerified: e.target.checked })} label="Notes verified against the manufacturer's information (only verified notes are shown to customers)" />
        <Field label="Marketed for" htmlFor="p-gender">
          <Select id="p-gender" value={v.gender} onChange={(e) => set({ gender: e.target.value })}>
            <option value="">—</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-xs font-medium text-charcoal">Occasions</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {OCCASIONS.map((o) => (
              <Checkbox key={o} id={`occ-${o}`} label={o} checked={v.occasions.includes(o)} onChange={(e) => set({ occasions: e.target.checked ? [...v.occasions, o] : v.occasions.filter((x) => x !== o) })} />
            ))}
          </div>
        </fieldset>
      </section>

      <section className="grid gap-4 border border-line bg-paper p-5 sm:grid-cols-3">
        <h2 className="text-[0.6875rem] font-medium tracking-[0.14em] uppercase sm:col-span-3">Price, tax & availability</h2>
        <Field label="Selling price (₹)" htmlFor="p-price" error={errors.sellingPricePaise}>
          <Input id="p-price" inputMode="decimal" value={v.price} onChange={(e) => set({ price: e.target.value })} />
        </Field>
        <Field label="MRP (₹)" htmlFor="p-mrp" error={errors.mrpPaise} optional>
          <Input id="p-mrp" inputMode="decimal" value={v.mrp} onChange={(e) => set({ mrp: e.target.value })} />
        </Field>
        <div className="pt-6">
          <Checkbox id="p-mrp-verified" checked={v.mrpVerified} onChange={(e) => set({ mrpVerified: e.target.checked })} label="MRP verified from packaging (shown as strike-through)" />
          {errors.mrpVerified && <p className="mt-1 text-xs text-danger">{errors.mrpVerified}</p>}
        </div>
        <Field label="Tax class" htmlFor="p-tax" error={errors.taxClassId}>
          <Select id="p-tax" value={v.taxClassId} onChange={(e) => set({ taxClassId: e.target.value })}>
            <option value="">None</option>
            {taxClasses.map((t) => <option key={t.id} value={t.id}>{t.name} — {formatRateBp(t.gstRateBp)}{t.isVerified ? "" : " (unverified)"}</option>)}
          </Select>
        </Field>
        <Field label="Availability" htmlFor="p-avail" error={errors.availability} hint="Only 'Available to order' can be purchased.">
          <Select id="p-avail" value={v.availability} onChange={(e) => set({ availability: e.target.value })}>
            {AVAILABILITY.map((a) => <option key={a} value={a}>{AVAILABILITY_LABEL[a]}</option>)}
          </Select>
        </Field>
        <Field label="Max per order" htmlFor="p-max" error={errors.maxPerOrder}>
          <Input id="p-max" inputMode="numeric" value={v.maxPerOrder} onChange={(e) => set({ maxPerOrder: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <div className="space-y-2 sm:col-span-3">
          <Checkbox id="p-active" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} label="Visible on the storefront" />
          <Checkbox id="p-featured" checked={v.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} label="Featured" />
        </div>
        {collections.length > 0 && (
          <fieldset className="sm:col-span-3">
            <legend className="mb-1.5 text-xs font-medium text-charcoal">Collections</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {collections.map((c) => (
                <Checkbox key={c.id} id={`col-${c.id}`} label={c.name} checked={v.collectionIds.includes(c.id)} onChange={(e) => set({ collectionIds: e.target.checked ? [...v.collectionIds, c.id] : v.collectionIds.filter((x) => x !== c.id) })} />
              ))}
            </div>
          </fieldset>
        )}
      </section>

      {errors._form && <Notice tone="danger">{errors._form}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>{initial ? "Save changes" : "Create product"}</Button>
        {initial?.id && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!confirm("Archive this product? It will be hidden and marked discontinued. Past orders keep their snapshot.")) return;
              start(async () => {
                const r = await archiveProductAction(initial.id!);
                if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
              });
            }}
          >
            Archive
          </Button>
        )}
      </div>
    </form>
  );
}

export function ImageManager({ productId, images }: { productId: string; images: { id: string; url: string; alt: string; usageRightsConfirmed: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((im) => (
            <li key={im.id} className="relative">
              <div className="relative aspect-[4/5] overflow-hidden bg-sand">
                <Image src={im.url} alt={im.alt} fill sizes="160px" className="object-cover" />
              </div>
              {!im.usageRightsConfirmed && <Badge tone="warning" className="mt-1">Rights unconfirmed — hidden</Badge>}
              <button
                type="button"
                className="mt-1 text-xs text-danger underline"
                onClick={() => start(async () => { const r = await deleteImageAction(productId, im.id); if (r.ok) router.refresh(); else toast.error(r.message); })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone">No images. Customers see a typographic placeholder.</p>
      )}
      <form
        className="space-y-3 border-t border-line pt-4"
        action={(fd) =>
          start(async () => {
            const r = await uploadImageAction(productId, fd);
            if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
          })
        }
      >
        <div>
          <Label htmlFor="img-file">Upload image (JPEG, PNG, WebP or AVIF, max 5 MB)</Label>
          <input id="img-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="text-sm" />
        </div>
        <div>
          <Label htmlFor="img-alt">Alt text</Label>
          <Input id="img-alt" name="alt" placeholder="e.g. Front of the bottle and box" />
        </div>
        <label className="flex items-start gap-2 text-xs text-charcoal">
          <input type="checkbox" name="rights" value="yes" required className="mt-0.5 accent-ink" />
          I took this photo or have permission to use it, and it accurately shows the product being sold.
        </label>
        <Button type="submit" size="sm" variant="secondary" loading={pending}>Upload</Button>
      </form>
    </div>
  );
}

type Offer = { supplierId: string; supplierName: string; supplierSku: string | null; supplierReference: string | null; costPaise: number | null; costIncludesGst: boolean; gstRateBp: number | null; itcEligible: boolean; isPreferred: boolean; lastConfirmedAt: Date | null; notes: string | null };

export function OfferManager({ productId, offers, suppliers, sellingPricePaise }: { productId: string; offers: Offer[]; suppliers: Option[]; sellingPricePaise: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ supplierId: suppliers[0]?.id ?? "", sku: "", ref: "", cost: "", incl: true, gst: "18", itc: false, preferred: offers.length === 0, notes: "" });
  function edit(o: Offer) {
    setF({ supplierId: o.supplierId, sku: o.supplierSku ?? "", ref: o.supplierReference ?? "", cost: paiseToRupeesString(o.costPaise), incl: o.costIncludesGst, gst: o.gstRateBp != null ? String(o.gstRateBp / 100) : "", itc: o.itcEligible, preferred: o.isPreferred, notes: o.notes ?? "" });
  }
  return (
    <div className="space-y-4">
      {offers.length > 0 ? (
        <ul className="divide-y divide-line text-sm">
          {offers.map((o) => (
            <li key={o.supplierId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <strong className="font-medium">{o.supplierName}</strong> {o.isPreferred && <Badge tone="gold">Preferred</Badge>}
                <span className="block text-xs text-stone">
                  Cost {o.costPaise != null ? formatINR(o.costPaise) : "—"} {o.costIncludesGst ? "incl." : "excl."} GST{o.gstRateBp != null ? ` @ ${formatRateBp(o.gstRateBp)}` : ""} · SKU {o.supplierSku ?? "—"} · confirmed {o.lastConfirmedAt ? formatDate(o.lastConfirmedAt) : "never"}
                  {o.costPaise != null && ` · gross margin ${formatINR(sellingPricePaise - o.costPaise)}`}
                </span>
              </span>
              <span className="flex gap-3 text-xs">
                <button type="button" className="underline" onClick={() => edit(o)}>Edit</button>
                <button type="button" className="text-danger underline" onClick={() => start(async () => { await deleteOfferAction(productId, o.supplierId); router.refresh(); })}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone">No supplier recorded for this product.</p>
      )}
      {suppliers.length === 0 ? (
        <Notice>Create a supplier first under Suppliers.</Notice>
      ) : (
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="o-sup">Supplier</Label>
            <Select id="o-sup" value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div><Label htmlFor="o-sku" optional>Supplier SKU</Label><Input id="o-sku" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
          <div><Label htmlFor="o-ref" optional>Supplier reference</Label><Input id="o-ref" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} /></div>
          <div><Label htmlFor="o-cost">Wholesale cost (₹)</Label><Input id="o-cost" inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></div>
          <div><Label htmlFor="o-gst" optional>GST rate on cost (%)</Label><Input id="o-gst" inputMode="decimal" value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value })} /></div>
          <div className="space-y-2 pt-6">
            <Checkbox id="o-incl" checked={f.incl} onChange={(e) => setF({ ...f, incl: e.target.checked })} label="Cost includes GST" />
            <Checkbox id="o-itc" checked={f.itc} onChange={(e) => setF({ ...f, itc: e.target.checked })} label="ITC eligible" />
            <Checkbox id="o-pref" checked={f.preferred} onChange={(e) => setF({ ...f, preferred: e.target.checked })} label="Preferred supplier" />
          </div>
          <div className="sm:col-span-3"><Label htmlFor="o-notes" optional>Notes</Label><Input id="o-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <div className="sm:col-span-3">
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveOfferAction(productId, {
                    supplierId: f.supplierId,
                    supplierSku: f.sku,
                    supplierReference: f.ref,
                    costPaise: rupeesToPaise(f.cost),
                    costIncludesGst: f.incl,
                    gstRateBp: f.gst ? Math.round(Number(f.gst) * 100) : null,
                    itcEligible: f.itc,
                    isPreferred: f.preferred,
                    notes: f.notes,
                  });
                  if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
                })
              }
            >
              Save supplier offer
            </Button>
            <p className="mt-2 text-xs text-stone">Saving also records today as the last date you confirmed this supplier&apos;s price and availability.</p>
          </div>
        </div>
      )}
    </div>
  );
}
