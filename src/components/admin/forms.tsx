"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createDiscountAction, refundAction, saveSettingsAction, toggleDiscountAction } from "@/app/actions/admin";
import type { PricingSettings, PrivacySettings, ShopSettings, StoreSettings } from "@/lib/settings";
import type { ActionResult } from "@/lib/forms";
import { paiseToRupeesString, rupeesToPaise } from "@/lib/money";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/form";

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved.");
        router.refresh();
      } else toast.error(r.message);
    });
  return { pending, run };
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const num = (f: FormData, k: string) => Number(f.get(k) ?? 0);
const paise = (f: FormData, k: string) => rupeesToPaise(str(f, k)) ?? 0;

export function StoreForm({ v }: { v: StoreSettings }) {
  const { pending, run } = useSave();
  return (
    <form
      action={(f) =>
        run(() =>
          saveSettingsAction("store", {
            name: str(f, "name"),
            legalBusinessName: str(f, "legalBusinessName"),
            supportEmail: str(f, "supportEmail"),
            whatsapp: str(f, "whatsapp"),
            businessAddress: str(f, "businessAddress"),
            gstin: str(f, "gstin"),
            stylistName: str(f, "stylistName"),
            instagram: str(f, "instagram"),
          }),
        )
      }
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Brand name" htmlFor="name"><Input id="name" name="name" defaultValue={v.name} /></Field>
      <Field label="Legal business name" htmlFor="legalBusinessName"><Input id="legalBusinessName" name="legalBusinessName" defaultValue={v.legalBusinessName} /></Field>
      <Field label="Support email" htmlFor="supportEmail"><Input id="supportEmail" name="supportEmail" type="email" defaultValue={v.supportEmail} /></Field>
      <Field label="WhatsApp" htmlFor="whatsapp"><Input id="whatsapp" name="whatsapp" defaultValue={v.whatsapp} /></Field>
      <Field label="Stylist name on reports" htmlFor="stylistName" hint="e.g. “Meera, senior stylist”"><Input id="stylistName" name="stylistName" defaultValue={v.stylistName} /></Field>
      <Field label="Instagram URL" htmlFor="instagram"><Input id="instagram" name="instagram" defaultValue={v.instagram} /></Field>
      <Field label="GSTIN" htmlFor="gstin"><Input id="gstin" name="gstin" defaultValue={v.gstin} /></Field>
      <Field label="Business address" htmlFor="businessAddress" className="sm:col-span-2"><Textarea id="businessAddress" name="businessAddress" defaultValue={v.businessAddress} rows={2} /></Field>
      <div className="sm:col-span-2"><Button type="submit" loading={pending}>Save</Button></div>
    </form>
  );
}

export function PricingForm({ v }: { v: PricingSettings }) {
  const { pending, run } = useSave();
  return (
    <form
      action={(f) =>
        run(() =>
          saveSettingsAction("pricing", {
            standardPaise: paise(f, "standard"),
            standardHours: num(f, "standardHours"),
            priorityEnabled: f.get("priorityEnabled") === "on",
            priorityPaise: paise(f, "priority"),
            priorityHours: num(f, "priorityHours"),
            gstRateBp: Math.round(Number(str(f, "gst")) * 100),
            taxConfigVerified: f.get("taxConfigVerified") === "on",
            orderExpiryHours: num(f, "orderExpiryHours"),
          }),
        )
      }
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Standard price (₹, incl. GST)" htmlFor="standard"><Input id="standard" name="standard" inputMode="decimal" defaultValue={paiseToRupeesString(v.standardPaise)} /></Field>
      <Field label="Standard review time (hours)" htmlFor="standardHours"><Input id="standardHours" name="standardHours" type="number" min={1} defaultValue={v.standardHours} /></Field>
      <Field label="Priority price (₹, incl. GST)" htmlFor="priority"><Input id="priority" name="priority" inputMode="decimal" defaultValue={paiseToRupeesString(v.priorityPaise)} /></Field>
      <Field label="Priority review time (hours)" htmlFor="priorityHours"><Input id="priorityHours" name="priorityHours" type="number" min={1} defaultValue={v.priorityHours} /></Field>
      <Field label="GST rate (%) included in prices" htmlFor="gst"><Input id="gst" name="gst" inputMode="decimal" defaultValue={(v.gstRateBp / 100).toString()} /></Field>
      <Field label="Unpaid checkout expiry (hours)" htmlFor="orderExpiryHours"><Input id="orderExpiryHours" name="orderExpiryHours" type="number" min={1} defaultValue={v.orderExpiryHours} /></Field>
      <Checkbox id="priorityEnabled" name="priorityEnabled" defaultChecked={v.priorityEnabled} label="Offer priority review" />
      <Checkbox id="taxConfigVerified" name="taxConfigVerified" defaultChecked={v.taxConfigVerified} label="I've confirmed the GST rate and SAC code with a tax adviser" />
      <div className="sm:col-span-2"><Button type="submit" loading={pending}>Save</Button></div>
    </form>
  );
}

export function ShopForm({ v }: { v: ShopSettings }) {
  const { pending, run } = useSave();
  return (
    <form
      action={(f) => run(() => saveSettingsAction("shop", { amazonEnabled: f.get("amazonEnabled") === "on", amazonTag: str(f, "amazonTag"), myntraEnabled: f.get("myntraEnabled") === "on", ajioEnabled: f.get("ajioEnabled") === "on" }))}
      className="space-y-4"
    >
      <div className="flex flex-wrap gap-6">
        <Checkbox id="myntraEnabled" name="myntraEnabled" defaultChecked={v.myntraEnabled} label="Myntra links" />
        <Checkbox id="ajioEnabled" name="ajioEnabled" defaultChecked={v.ajioEnabled} label="Ajio links" />
        <Checkbox id="amazonEnabled" name="amazonEnabled" defaultChecked={v.amazonEnabled} label="Amazon.in links" />
      </div>
      <Field label="Amazon Associates tag" htmlFor="amazonTag" hint="e.g. yourstore-21. When set, Amazon links carry it and are labelled as affiliate links." className="max-w-sm">
        <Input id="amazonTag" name="amazonTag" defaultValue={v.amazonTag} />
      </Field>
      <Button type="submit" loading={pending}>Save</Button>
    </form>
  );
}

export function PrivacyForm({ v }: { v: PrivacySettings }) {
  const { pending, run } = useSave();
  return (
    <form action={(f) => run(() => saveSettingsAction("privacy", { photoRetentionDays: num(f, "photoRetentionDays"), unpaidRetentionDays: num(f, "unpaidRetentionDays") }))} className="grid gap-4 sm:grid-cols-2">
      <Field label="Delete photos this many days after release" htmlFor="photoRetentionDays"><Input id="photoRetentionDays" name="photoRetentionDays" type="number" min={1} max={365} defaultValue={v.photoRetentionDays} /></Field>
      <Field label="Delete unpaid previews after (days)" htmlFor="unpaidRetentionDays"><Input id="unpaidRetentionDays" name="unpaidRetentionDays" type="number" min={1} max={365} defaultValue={v.unpaidRetentionDays} /></Field>
      <div className="sm:col-span-2"><Button type="submit" loading={pending}>Save</Button></div>
    </form>
  );
}

export function PagesForm({ pages, labels }: { pages: Record<string, string>; labels: Record<string, string> }) {
  const { pending, run } = useSave();
  return (
    <form action={(f) => run(() => saveSettingsAction("pages", Object.fromEntries(Object.keys(pages).map((k) => [k, str(f, k)]))))} className="space-y-5">
      {Object.entries(pages).map(([k, body]) => (
        <Field key={k} label={labels[k] ?? k} htmlFor={`page-${k}`} hint="Markdown. {{storeName}}, {{supportEmail}} and similar tokens are filled in automatically.">
          <Textarea id={`page-${k}`} name={k} defaultValue={body} rows={10} className="font-mono text-xs" />
        </Field>
      ))}
      <Button type="submit" loading={pending}>Save pages</Button>
    </form>
  );
}

export function DiscountForm() {
  const { pending, run } = useSave();
  return (
    <form
      action={(f) => run(() => createDiscountAction({ code: str(f, "code"), description: str(f, "description"), type: str(f, "type"), value: str(f, "value"), ...(str(f, "maxUses") ? { maxUses: str(f, "maxUses") } : {}), endsAt: str(f, "endsAt") }))}
      className="grid gap-4 sm:grid-cols-3"
    >
      <Field label="Code" htmlFor="code"><Input id="code" name="code" placeholder="INSTA20" required /></Field>
      <Field label="Type" htmlFor="type">
        <Select id="type" name="type" defaultValue="percent"><option value="percent">Percent off</option><option value="fixed">₹ off</option></Select>
      </Field>
      <Field label="Value (% or ₹)" htmlFor="value"><Input id="value" name="value" inputMode="decimal" required /></Field>
      <Field label="Max uses" htmlFor="maxUses" optional><Input id="maxUses" name="maxUses" type="number" min={1} /></Field>
      <Field label="Ends" htmlFor="endsAt" optional><Input id="endsAt" name="endsAt" type="datetime-local" /></Field>
      <Field label="Note" htmlFor="description" optional><Input id="description" name="description" /></Field>
      <div className="sm:col-span-3"><Button type="submit" loading={pending}>Create code</Button></div>
    </form>
  );
}

export function DiscountToggle({ id, active }: { id: string; active: boolean }) {
  const { pending, run } = useSave();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => toggleDiscountAction(id, !active))}>
      {active ? "Disable" : "Enable"}
    </Button>
  );
}

export function RefundButton({ orderId }: { orderId: string }) {
  const { pending, run } = useSave();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() => {
        const reason = prompt("Refund the full amount? Reason (internal):");
        if (reason !== null) run(() => refundAction(orderId, reason));
      }}
    >
      Refund
    </Button>
  );
}
