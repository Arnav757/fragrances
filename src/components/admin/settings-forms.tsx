"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addExpenseAction, saveSettingsAction } from "@/app/actions/admin-settings";
import type { CommerceSettings, HomepageSettings, StoreSettings } from "@/lib/settings";
import { INDIAN_STATES } from "@/config/brand";
import { PAGE_META, type PageKey } from "@/lib/default-pages";
import { paiseToRupeesString, rupeesToPaise } from "@/lib/money";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/form";

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = (key: "store" | "commerce" | "homepage" | "pages", value: unknown) =>
    start(async () => {
      const r = await saveSettingsAction(key, value);
      if (r.ok) {
        setErrors({});
        toast.success(r.message);
        router.refresh();
      } else {
        setErrors(r.errors ?? {});
        toast.error(r.message);
      }
    });
  return { pending, errors, save };
}

export function StoreSettingsForm({ initial }: { initial: StoreSettings }) {
  const { pending, errors, save } = useSave();
  const [v, setV] = useState(initial);
  const t = (k: Exclude<keyof StoreSettings, "socials">, label: string, opts: { hint?: string; area?: boolean } = {}) => (
    <Field label={label} htmlFor={`st-${k}`} error={errors[k]} hint={opts.hint}>
      {opts.area ? <Textarea id={`st-${k}`} rows={3} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <Input id={`st-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
    </Field>
  );
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save("store", v); }}>
      {t("name", "Store display name", { hint: "Overrides the name in src/config/brand.ts" })}
      {t("legalBusinessName", "Registered business name", { hint: "Shown on policies and footer. Use your actual legal entity." })}
      {t("supportEmail", "Support email")}
      {t("supportPhone", "Support phone")}
      {t("whatsapp", "WhatsApp number")}
      {t("supportHours", "Support hours", { hint: "e.g. Mon–Sat, 10am–6pm IST" })}
      {t("gstin", "Your GSTIN")}
      {t("announcement", "Announcement bar text", { hint: "Leave empty to hide" })}
      <div className="sm:col-span-2">{t("businessAddress", "Business address", { area: true, hint: "Only publish an address you are legally required / happy to show." })}</div>
      {(["instagram", "facebook", "youtube", "x"] as const).map((s) => (
        <Field key={s} label={`${s === "x" ? "X" : s[0]!.toUpperCase() + s.slice(1)} URL`} htmlFor={`st-${s}`} hint="https:// links only">
          <Input id={`st-${s}`} value={v.socials[s]} onChange={(e) => setV({ ...v, socials: { ...v.socials, [s]: e.target.value } })} />
        </Field>
      ))}
      <div><Button type="submit" loading={pending}>Save store details</Button></div>
    </form>
  );
}

export function CommerceSettingsForm({ initial }: { initial: CommerceSettings }) {
  const { pending, errors, save } = useSave();
  const [v, setV] = useState({
    ...initial,
    flat: paiseToRupeesString(initial.flatShippingPaise),
    free: paiseToRupeesString(initial.freeShippingThresholdPaise),
    codFee: paiseToRupeesString(initial.codFeePaise),
    codMax: paiseToRupeesString(initial.codMaxOrderPaise),
    chargesRate: initial.chargesTaxRateBp != null ? String(initial.chargesTaxRateBp / 100) : "",
    blocked: initial.blockedPincodes.join(", "),
    prefixes: initial.serviceablePrefixes.join(", "),
  });
  function submit() {
    const list = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    save("commerce", {
      pricesIncludeTax: v.pricesIncludeTax,
      sellerState: v.sellerState || null,
      chargesTaxRateBp: v.chargesRate === "" ? null : Math.round(Number(v.chargesRate) * 100),
      taxConfigVerified: v.taxConfigVerified,
      flatShippingPaise: rupeesToPaise(v.flat) ?? 0,
      freeShippingThresholdPaise: v.free === "" ? null : rupeesToPaise(v.free),
      codEnabled: v.codEnabled,
      codFeePaise: rupeesToPaise(v.codFee) ?? 0,
      codMaxOrderPaise: rupeesToPaise(v.codMax) ?? 500000,
      deliveryEstimateMinDays: v.deliveryEstimateMinDays || null,
      deliveryEstimateMaxDays: v.deliveryEstimateMaxDays || null,
      blockedPincodes: list(v.blocked),
      serviceablePrefixes: list(v.prefixes),
      returnWindowDays: Number(v.returnWindowDays),
      pendingOrderExpiryHours: Number(v.pendingOrderExpiryHours),
    });
  }
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-xs font-medium tracking-wide uppercase">GST</legend>
        <Field label="Your registered state (seller)" htmlFor="c-seller" error={errors.sellerState} hint="Decides CGST+SGST vs IGST">
          <Select id="c-seller" value={v.sellerState ?? ""} onChange={(e) => setV({ ...v, sellerState: e.target.value || null })}>
            <option value="">Not set</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="GST rate on shipping/COD fee (%)" htmlFor="c-crate" hint="Blank = highest item rate in the order (composite supply). Confirm with your CA." error={errors.chargesTaxRateBp}>
          <Input id="c-crate" inputMode="decimal" value={v.chargesRate} onChange={(e) => setV({ ...v, chargesRate: e.target.value })} />
        </Field>
        <div className="space-y-2 pt-6">
          <Checkbox id="c-incl" checked={v.pricesIncludeTax} onChange={(e) => setV({ ...v, pricesIncludeTax: e.target.checked })} label="Prices include GST" />
          <Checkbox id="c-verified" checked={v.taxConfigVerified} onChange={(e) => setV({ ...v, taxConfigVerified: e.target.checked })} label="Tax setup reviewed by my tax adviser" />
        </div>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-xs font-medium tracking-wide uppercase">Shipping</legend>
        <Field label="Flat shipping charge (₹)" htmlFor="c-flat" error={errors.flatShippingPaise}><Input id="c-flat" inputMode="decimal" value={v.flat} onChange={(e) => setV({ ...v, flat: e.target.value })} /></Field>
        <Field label="Free shipping from (₹)" htmlFor="c-free" hint="Blank = never free"><Input id="c-free" inputMode="decimal" value={v.free} onChange={(e) => setV({ ...v, free: e.target.value })} /></Field>
        <div />
        <Field label="Delivery estimate — min days" htmlFor="c-min" hint="Leave blank unless you can stand behind it"><Input id="c-min" inputMode="numeric" value={v.deliveryEstimateMinDays ?? ""} onChange={(e) => setV({ ...v, deliveryEstimateMinDays: e.target.value ? Number(e.target.value) : null })} /></Field>
        <Field label="Delivery estimate — max days" htmlFor="c-max"><Input id="c-max" inputMode="numeric" value={v.deliveryEstimateMaxDays ?? ""} onChange={(e) => setV({ ...v, deliveryEstimateMaxDays: e.target.value ? Number(e.target.value) : null })} /></Field>
        <div />
        <Field label="Blocked PIN codes" htmlFor="c-blocked" hint="Comma separated" className="sm:col-span-3"><Input id="c-blocked" value={v.blocked} onChange={(e) => setV({ ...v, blocked: e.target.value })} /></Field>
        <Field label="Serviceable PIN prefixes" htmlFor="c-prefix" hint="Optional allow-list, e.g. 11, 40, 56. Blank = all India" className="sm:col-span-3"><Input id="c-prefix" value={v.prefixes} onChange={(e) => setV({ ...v, prefixes: e.target.value })} /></Field>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-xs font-medium tracking-wide uppercase">Cash on delivery</legend>
        <div className="pt-6"><Checkbox id="c-cod" checked={v.codEnabled} onChange={(e) => setV({ ...v, codEnabled: e.target.checked })} label="Offer COD (only if your supplier/courier supports it)" /></div>
        <Field label="COD fee (₹)" htmlFor="c-codfee"><Input id="c-codfee" inputMode="decimal" value={v.codFee} onChange={(e) => setV({ ...v, codFee: e.target.value })} /></Field>
        <Field label="COD max order value (₹)" htmlFor="c-codmax"><Input id="c-codmax" inputMode="decimal" value={v.codMax} onChange={(e) => setV({ ...v, codMax: e.target.value })} /></Field>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-xs font-medium tracking-wide uppercase">Orders</legend>
        <Field label="Return window (days)" htmlFor="c-ret"><Input id="c-ret" inputMode="numeric" value={v.returnWindowDays} onChange={(e) => setV({ ...v, returnWindowDays: Number(e.target.value) || 0 })} /></Field>
        <Field label="Cancel unpaid orders after (hours)" htmlFor="c-exp"><Input id="c-exp" inputMode="numeric" value={v.pendingOrderExpiryHours} onChange={(e) => setV({ ...v, pendingOrderExpiryHours: Number(e.target.value) || 24 })} /></Field>
      </fieldset>
      {Object.keys(errors).length > 0 && <p className="text-xs text-danger">{Object.entries(errors).map(([k, m]) => `${k}: ${m}`).join(" · ")}</p>}
      <Button type="submit" loading={pending}>Save commerce settings</Button>
    </form>
  );
}

export function HomepageSettingsForm({ initial }: { initial: HomepageSettings }) {
  const { pending, save } = useSave();
  const [v, setV] = useState(initial);
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save("homepage", v); }}>
      <Field label="Hero eyebrow" htmlFor="h-eyebrow"><Input id="h-eyebrow" value={v.heroEyebrow} onChange={(e) => setV({ ...v, heroEyebrow: e.target.value })} /></Field>
      <Field label="Hero title" htmlFor="h-title"><Input id="h-title" value={v.heroTitle} onChange={(e) => setV({ ...v, heroTitle: e.target.value })} /></Field>
      <Field label="Hero subtitle" htmlFor="h-sub"><Textarea id="h-sub" rows={2} value={v.heroSubtitle} onChange={(e) => setV({ ...v, heroSubtitle: e.target.value })} /></Field>
      <Field label="Hero image URL" htmlFor="h-img" hint="Optional. Use a photo you own or have licensed. Must be on an allowed image host (your Supabase storage or /uploads).">
        <Input id="h-img" value={v.heroImageUrl} onChange={(e) => setV({ ...v, heroImageUrl: e.target.value })} />
      </Field>
      <Field label="Story title" htmlFor="h-story-title"><Input id="h-story-title" value={v.storyTitle} onChange={(e) => setV({ ...v, storyTitle: e.target.value })} /></Field>
      <Field label="Story text" htmlFor="h-story"><Textarea id="h-story" rows={4} value={v.storyBody} onChange={(e) => setV({ ...v, storyBody: e.target.value })} /></Field>
      <div><Button type="submit" loading={pending}>Save homepage</Button></div>
    </form>
  );
}

export function PagesForm({ initial }: { initial: Record<PageKey, string> }) {
  const { pending, save } = useSave();
  const [v, setV] = useState(initial);
  const [key, setKey] = useState<PageKey>("about");
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save("pages", v); }}>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PAGE_META) as PageKey[]).map((k) => (
          <button key={k} type="button" onClick={() => setKey(k)} className={`px-3 py-1.5 text-xs ${k === key ? "bg-ink text-paper" : "bg-sand"}`}>
            {PAGE_META[k].title}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone">
        Markdown. Tokens: {"{{storeName}} {{legalBusinessName}} {{supportEmail}} {{supportPhone}} {{supportHours}} {{businessAddress}} {{returnWindowDays}} {{flatShipping}} {{freeShippingThreshold}} {{codStatus}}"}. Raw HTML is not rendered.
      </p>
      <label htmlFor="page-body" className="sr-only">{PAGE_META[key].title} content</label>
      <Textarea id="page-body" rows={22} className="font-mono text-xs" value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} />
      <Button type="submit" loading={pending}>Save all pages</Button>
    </form>
  );
}

export function ExpenseForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({ category: "advertising", description: "", amount: "", gst: "", itc: false, date: new Date().toISOString().slice(0, 10) });
  return (
    <form
      className="grid gap-3 sm:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addExpenseAction({ category: v.category, description: v.description, amountPaise: rupeesToPaise(v.amount) ?? 0, gstPaise: rupeesToPaise(v.gst) ?? 0, itcEligible: v.itc, incurredOn: v.date });
          if (r.ok) { toast.success(r.message); setV({ ...v, description: "", amount: "", gst: "" }); router.refresh(); } else toast.error(r.message);
        });
      }}
    >
      <Field label="Category" htmlFor="x-cat"><Select id="x-cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{["advertising", "packaging", "shipping", "software", "other"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <Field label="Description" htmlFor="x-desc" className="sm:col-span-2"><Input id="x-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <Field label="Amount incl. GST (₹)" htmlFor="x-amt"><Input id="x-amt" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
      <Field label="GST part (₹)" htmlFor="x-gst"><Input id="x-gst" inputMode="decimal" value={v.gst} onChange={(e) => setV({ ...v, gst: e.target.value })} /></Field>
      <Field label="Date" htmlFor="x-date"><Input id="x-date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
      <Checkbox id="x-itc" className="sm:col-span-3" checked={v.itc} onChange={(e) => setV({ ...v, itc: e.target.checked })} label="GST is claimable as input tax credit" />
      <div className="sm:col-span-3 sm:text-right"><Button type="submit" size="sm" loading={pending}>Add expense</Button></div>
    </form>
  );
}
