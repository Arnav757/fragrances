"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteAddressAction, saveAddressAction } from "@/app/actions/auth";
import { INDIAN_STATES } from "@/config/brand";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Select } from "../ui/form";
import { Badge, EmptyState, Notice } from "../ui/misc";

export type Addr = { id: string; label: string | null; fullName: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string; isDefault: boolean };

function AddressForm({ initial, onDone }: { initial?: Addr; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof saveAddressAction>[0], fd: FormData) => {
    const r = await saveAddressAction(prev, fd);
    if (r?.ok) onDone();
    return r;
  }, null);
  const v = (k: keyof Addr) => (state?.values?.[k] ?? (initial?.[k] as string | undefined) ?? "") as string;
  const e = state?.errors ?? {};
  return (
    <form action={action} className="grid gap-4 border border-line bg-paper p-5 sm:grid-cols-2" noValidate>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field label="Label" htmlFor="a-label" optional hint="e.g. Home, Office"><Input id="a-label" name="label" defaultValue={v("label")} /></Field>
      <Field label="Full name" htmlFor="a-fullName" error={e.fullName}><Input id="a-fullName" name="fullName" defaultValue={v("fullName")} /></Field>
      <Field label="Mobile number" htmlFor="a-phone" error={e.phone}><Input id="a-phone" name="phone" type="tel" defaultValue={v("phone")} /></Field>
      <Field label="PIN code" htmlFor="a-pincode" error={e.pincode}><Input id="a-pincode" name="pincode" inputMode="numeric" maxLength={6} defaultValue={v("pincode")} /></Field>
      <Field label="House / flat, building, street" htmlFor="a-line1" error={e.line1} className="sm:col-span-2"><Input id="a-line1" name="line1" defaultValue={v("line1")} /></Field>
      <Field label="Area, locality" htmlFor="a-line2" optional><Input id="a-line2" name="line2" defaultValue={v("line2")} /></Field>
      <Field label="Landmark" htmlFor="a-landmark" optional><Input id="a-landmark" name="landmark" defaultValue={v("landmark")} /></Field>
      <Field label="City" htmlFor="a-city" error={e.city}><Input id="a-city" name="city" defaultValue={v("city")} /></Field>
      <Field label="State" htmlFor="a-state" error={e.state}>
        <Select id="a-state" name="state" defaultValue={v("state")}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>
      <Checkbox id="a-default" name="isDefault" label="Use as my default address" defaultChecked={initial?.isDefault} className="sm:col-span-2" />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>Save address</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses }: { addresses: Addr[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const done = () => { setEditing(null); setSaved(true); };
  return (
    <div className="space-y-4">
      {saved && <Notice tone="success">Address saved.</Notice>}
      {addresses.length === 0 && editing !== "new" && <EmptyState title="No saved addresses" description="Save an address to check out faster next time." />}
      <ul className="grid gap-4 sm:grid-cols-2">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="sm:col-span-2"><AddressForm initial={a} onDone={done} /></li>
          ) : (
            <li key={a.id} className="border border-line bg-paper p-5 text-sm leading-relaxed">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium text-ink">{a.label || a.fullName}</span>
                {a.isDefault && <Badge tone="gold">Default</Badge>}
              </div>
              <p className="text-charcoal">{a.fullName}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</p>
              <div className="mt-3 flex gap-4 text-xs">
                <button type="button" className="underline underline-offset-2" onClick={() => setEditing(a.id)}>Edit</button>
                <button type="button" className="text-danger underline underline-offset-2" disabled={pending} onClick={() => start(() => deleteAddressAction(a.id))}>Delete</button>
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? <AddressForm onDone={done} /> : <Button variant="outline" onClick={() => { setSaved(false); setEditing("new"); }}>Add an address</Button>}
    </div>
  );
}
