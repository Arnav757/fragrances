"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { saveBrandAction, saveCollectionAction, saveDiscountAction, saveSupplierAction, saveTaxClassAction, moderateReviewAction } from "@/app/actions/admin-catalog";
import type { ActionResult } from "@/lib/forms";
import { paiseToRupeesString, rupeesToPaise } from "@/lib/money";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Textarea, Select } from "../ui/form";

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  function save(fn: () => Promise<ActionResult<unknown>>, onOk?: () => void) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setErrors({});
        toast.success(r.message ?? "Saved");
        onOk?.();
        router.refresh();
      } else {
        setErrors(r.errors ?? {});
        toast.error(r.message);
      }
    });
  }
  return { pending, errors, save };
}

export function BrandForm({ initial }: { initial?: { id: string; name: string; origin: string | null; description: string | null; isMiddleEastern: boolean; isActive: boolean } }) {
  const { pending, errors, save } = useSave();
  const [v, setV] = useState({ name: initial?.name ?? "", origin: initial?.origin ?? "", description: initial?.description ?? "", isMiddleEastern: initial?.isMiddleEastern ?? true, isActive: initial?.isActive ?? true });
  const [open, setOpen] = useState(!initial);
  if (!open) return <button type="button" className="text-xs underline" onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        save(() => saveBrandAction(initial?.id ?? null, v), () => (initial ? setOpen(false) : setV({ name: "", origin: "", description: "", isMiddleEastern: true, isActive: true })));
      }}
    >
      <Field label="Brand name" htmlFor={`b-name-${initial?.id ?? "new"}`} error={errors.name}><Input id={`b-name-${initial?.id ?? "new"}`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="Origin" htmlFor={`b-origin-${initial?.id ?? "new"}`} optional><Input id={`b-origin-${initial?.id ?? "new"}`} value={v.origin} onChange={(e) => setV({ ...v, origin: e.target.value })} /></Field>
      <Field label="Description" htmlFor={`b-desc-${initial?.id ?? "new"}`} optional className="sm:col-span-2"><Textarea id={`b-desc-${initial?.id ?? "new"}`} rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <div className="flex flex-wrap gap-5 sm:col-span-2">
        <Checkbox id={`b-me-${initial?.id ?? "new"}`} checked={v.isMiddleEastern} onChange={(e) => setV({ ...v, isMiddleEastern: e.target.checked })} label="Middle Eastern house (shown on homepage)" />
        <Checkbox id={`b-active-${initial?.id ?? "new"}`} checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} label="Active" />
      </div>
      <div><Button type="submit" size="sm" loading={pending}>{initial ? "Save" : "Add brand"}</Button></div>
    </form>
  );
}

export function CollectionForm({ initial }: { initial?: { id: string; name: string; description: string | null; isFeatured: boolean; position: number } }) {
  const { pending, errors, save } = useSave();
  const [v, setV] = useState({ name: initial?.name ?? "", description: initial?.description ?? "", isFeatured: initial?.isFeatured ?? true, position: String(initial?.position ?? 0) });
  const [open, setOpen] = useState(!initial);
  const key = initial?.id ?? "new";
  if (!open) return <button type="button" className="text-xs underline" onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save(() => saveCollectionAction(initial?.id ?? null, { ...v, position: Number(v.position) || 0 }), () => (initial ? setOpen(false) : setV({ name: "", description: "", isFeatured: true, position: "0" })));
      }}
    >
      <Field label="Name" htmlFor={`c-name-${key}`} error={errors.name}><Input id={`c-name-${key}`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="Order" htmlFor={`c-pos-${key}`}><Input id={`c-pos-${key}`} inputMode="numeric" value={v.position} onChange={(e) => setV({ ...v, position: e.target.value })} /></Field>
      <Field label="Description" htmlFor={`c-desc-${key}`} optional className="sm:col-span-2"><Input id={`c-desc-${key}`} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <Checkbox id={`c-feat-${key}`} checked={v.isFeatured} onChange={(e) => setV({ ...v, isFeatured: e.target.checked })} label="Featured on homepage" />
      <div><Button type="submit" size="sm" loading={pending}>{initial ? "Save" : "Add collection"}</Button></div>
    </form>
  );
}

export function TaxClassForm({ initial }: { initial?: { id: string; name: string; hsnCode: string | null; gstRateBp: number; isVerified: boolean; notes: string | null } }) {
  const { pending, errors, save } = useSave();
  const [v, setV] = useState({ name: initial?.name ?? "", hsnCode: initial?.hsnCode ?? "", rate: initial ? String(initial.gstRateBp / 100) : "", isVerified: initial?.isVerified ?? false, notes: initial?.notes ?? "" });
  const [open, setOpen] = useState(!initial);
  const key = initial?.id ?? "new";
  if (!open) return <button type="button" className="text-xs underline" onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const bp = Math.round(Number(v.rate) * 100);
        save(() => saveTaxClassAction(initial?.id ?? null, { name: v.name, hsnCode: v.hsnCode, gstRateBp: Number.isFinite(bp) ? bp : -1, isVerified: v.isVerified, notes: v.notes }), () => initial && setOpen(false));
      }}
    >
      <Field label="Name" htmlFor={`t-name-${key}`} error={errors.name}><Input id={`t-name-${key}`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="HSN code" htmlFor={`t-hsn-${key}`} error={errors.hsnCode}><Input id={`t-hsn-${key}`} value={v.hsnCode} onChange={(e) => setV({ ...v, hsnCode: e.target.value })} /></Field>
      <Field label="GST rate (%)" htmlFor={`t-rate-${key}`} error={errors.gstRateBp}><Input id={`t-rate-${key}`} inputMode="decimal" value={v.rate} onChange={(e) => setV({ ...v, rate: e.target.value })} /></Field>
      <Field label="Notes" htmlFor={`t-notes-${key}`} optional className="sm:col-span-3"><Input id={`t-notes-${key}`} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
      <Checkbox id={`t-ver-${key}`} className="sm:col-span-2" checked={v.isVerified} onChange={(e) => setV({ ...v, isVerified: e.target.checked })} label="Verified with my tax adviser for current use" />
      <div><Button type="submit" size="sm" loading={pending}>{initial ? "Save" : "Add tax class"}</Button></div>
    </form>
  );
}

export function DiscountForm({ initial }: { initial?: { id: string; code: string; description: string | null; type: "percent" | "fixed"; value: number; minSubtotalPaise: number; maxDiscountPaise: number | null; maxUses: number | null; startsAt: Date | null; endsAt: Date | null; isActive: boolean } }) {
  const { pending, errors, save } = useSave();
  const toLocal = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const [v, setV] = useState({
    code: initial?.code ?? "",
    description: initial?.description ?? "",
    type: initial?.type ?? "percent",
    value: initial ? (initial.type === "percent" ? String(initial.value / 100) : paiseToRupeesString(initial.value)) : "",
    min: paiseToRupeesString(initial?.minSubtotalPaise ?? 0),
    max: paiseToRupeesString(initial?.maxDiscountPaise ?? null),
    maxUses: initial?.maxUses?.toString() ?? "",
    startsAt: toLocal(initial?.startsAt ?? null),
    endsAt: toLocal(initial?.endsAt ?? null),
    isActive: initial?.isActive ?? true,
  });
  const [open, setOpen] = useState(!initial);
  const key = initial?.id ?? "new";
  if (!open) return <button type="button" className="text-xs underline" onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form
      className="grid gap-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const value = v.type === "percent" ? Math.round(Number(v.value) * 100) : (rupeesToPaise(v.value) ?? 0);
        save(
          () =>
            saveDiscountAction(initial?.id ?? null, {
              code: v.code,
              description: v.description,
              type: v.type,
              value,
              minSubtotalPaise: rupeesToPaise(v.min) ?? 0,
              maxDiscountPaise: rupeesToPaise(v.max),
              maxUses: v.maxUses ? Number(v.maxUses) : null,
              startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : null,
              endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
              isActive: v.isActive,
            }),
          () => initial && setOpen(false),
        );
      }}
    >
      <Field label="Code" htmlFor={`d-code-${key}`} error={errors.code}><Input id={`d-code-${key}`} value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} /></Field>
      <Field label="Type" htmlFor={`d-type-${key}`}>
        <Select id={`d-type-${key}`} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as "percent" | "fixed" })}>
          <option value="percent">Percent off</option>
          <option value="fixed">Fixed amount off</option>
        </Select>
      </Field>
      <Field label={v.type === "percent" ? "Percent" : "Amount (₹)"} htmlFor={`d-val-${key}`} error={errors.value}><Input id={`d-val-${key}`} inputMode="decimal" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} /></Field>
      <Field label="Max discount (₹)" htmlFor={`d-max-${key}`} optional><Input id={`d-max-${key}`} inputMode="decimal" value={v.max} onChange={(e) => setV({ ...v, max: e.target.value })} /></Field>
      <Field label="Min order (₹)" htmlFor={`d-min-${key}`}><Input id={`d-min-${key}`} inputMode="decimal" value={v.min} onChange={(e) => setV({ ...v, min: e.target.value })} /></Field>
      <Field label="Max uses" htmlFor={`d-uses-${key}`} optional><Input id={`d-uses-${key}`} inputMode="numeric" value={v.maxUses} onChange={(e) => setV({ ...v, maxUses: e.target.value })} /></Field>
      <Field label="Starts" htmlFor={`d-start-${key}`} optional><Input id={`d-start-${key}`} type="datetime-local" value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} /></Field>
      <Field label="Ends" htmlFor={`d-end-${key}`} optional><Input id={`d-end-${key}`} type="datetime-local" value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} /></Field>
      <Field label="Description (internal)" htmlFor={`d-desc-${key}`} optional className="sm:col-span-3"><Input id={`d-desc-${key}`} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <div className="flex items-end gap-4">
        <Checkbox id={`d-active-${key}`} checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} label="Active" />
        <Button type="submit" size="sm" loading={pending}>{initial ? "Save" : "Create"}</Button>
      </div>
    </form>
  );
}

type SupplierValues = { name: string; contactName: string; phone: string; whatsapp: string; email: string; address: string; gstin: string; paymentTerms: string; dispatchEstimate: string; shippingChargePaise: number; shippingChargeIncludesGst: boolean; returnPolicy: string; notes: string; isActive: boolean };

export function SupplierForm({ id, initial }: { id: string | null; initial?: SupplierValues }) {
  const { pending, errors, save } = useSave();
  const [v, setV] = useState({ ...(initial ?? { name: "", contactName: "", phone: "", whatsapp: "", email: "", address: "", gstin: "", paymentTerms: "", dispatchEstimate: "", shippingChargePaise: 0, shippingChargeIncludesGst: false, returnPolicy: "", notes: "", isActive: true }), shipping: paiseToRupeesString(initial?.shippingChargePaise ?? 0) });
  const f = (k: keyof SupplierValues, label: string, opts: { optional?: boolean; area?: boolean; wide?: boolean } = {}) => (
    <Field label={label} htmlFor={`s-${k}`} error={errors[k]} optional={opts.optional} className={opts.wide ? "sm:col-span-2" : undefined}>
      {opts.area ? (
        <Textarea id={`s-${k}`} rows={3} value={String(v[k] ?? "")} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
      ) : (
        <Input id={`s-${k}`} value={String(v[k] ?? "")} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
      )}
    </Field>
  );
  return (
    <form
      className="grid gap-4 border border-line bg-paper p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const { shipping, ...rest } = v;
        save(() => saveSupplierAction(id, { ...rest, shippingChargePaise: rupeesToPaise(shipping) ?? 0 }));
      }}
    >
      {f("name", "Supplier name")}
      {f("contactName", "Contact person", { optional: true })}
      {f("phone", "Phone", { optional: true })}
      {f("whatsapp", "WhatsApp", { optional: true })}
      {f("email", "Email", { optional: true })}
      {f("gstin", "GSTIN", { optional: true })}
      {f("address", "Address", { optional: true, area: true, wide: true })}
      {f("paymentTerms", "Payment terms", { optional: true, wide: true })}
      {f("dispatchEstimate", "Dispatch estimate", { optional: true })}
      <Field label="Shipping charge per order (₹)" htmlFor="s-ship">
        <Input id="s-ship" inputMode="decimal" value={v.shipping} onChange={(e) => setV({ ...v, shipping: e.target.value })} />
      </Field>
      <Checkbox id="s-ship-gst" checked={v.shippingChargeIncludesGst} onChange={(e) => setV({ ...v, shippingChargeIncludesGst: e.target.checked })} label="Shipping charge includes GST" />
      <Checkbox id="s-active" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} label="Active" />
      {f("returnPolicy", "Return / damage policy", { optional: true, area: true, wide: true })}
      {f("notes", "Internal notes", { optional: true, area: true, wide: true })}
      <div><Button type="submit" loading={pending}>{id ? "Save supplier" : "Create supplier"}</Button></div>
    </form>
  );
}

export function ReviewButtons({ id }: { id: string }) {
  const { pending, save } = useSave();
  return (
    <div className="flex gap-2">
      <Button size="sm" loading={pending} onClick={() => save(() => moderateReviewAction(id, "approved"))}>Approve</Button>
      <Button size="sm" variant="outline" loading={pending} onClick={() => save(() => moderateReviewAction(id, "rejected"))}>Reject</Button>
    </div>
  );
}
