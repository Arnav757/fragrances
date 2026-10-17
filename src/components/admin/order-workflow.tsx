"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  changeStatusAction,
  codCollectedAction,
  createPurchaseAction,
  markConfirmedAction,
  markOrderedAction,
  purchaseIssueAction,
  recordShipmentAction,
  refundAction,
  resolveRequestAction,
  saveInternalNotesAction,
  supplierMessageAction,
  updateCostsAction,
} from "@/app/actions/admin-orders";
import type { ActionResult } from "@/lib/forms";
import { ADMIN_STATUS_LABEL, TRANSITIONS, type OrderStatus } from "@/lib/order-status";
import { formatINR, paiseToRupeesString, rupeesToPaise } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { Button } from "../ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "../ui/form";
import { Badge, Notice } from "../ui/misc";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function exec<T>(fn: () => Promise<ActionResult<T>>, onOk?: (r: T | undefined) => void) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
        onOk?.(r.data);
        router.refresh();
      } else {
        toast.error(r.message, { description: r.errors ? Object.values(r.errors).join(" ") : undefined });
      }
    });
  }
  return { pending, exec };
}

function Section({ step, title, children, aside }: { step?: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border border-line bg-paper">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-[0.6875rem] font-medium tracking-[0.14em] text-ink uppercase">
          {step && <span className="mr-2 text-gold-deep">{step}</span>}
          {title}
        </h2>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export type WorkflowItem = { id: string; productId: string | null; productName: string; brandName: string; sizeMl: number | null; quantity: number; unitPricePaise: number };
export type WorkflowOffer = { productId: string; supplierId: string; supplierName: string; costPaise: number | null; supplierSku: string | null; isPreferred: boolean; lastConfirmedAt: Date | null; availability: string };
export type WorkflowPurchase = {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierReference: string | null;
  status: string;
  productCostPaise: number;
  shippingCostPaise: number;
  costsIncludeGst: boolean;
  gstOnCostsPaise: number;
  itcEligible: boolean;
  supplierInvoiceNumber: string | null;
  costIsActual: boolean;
  customerDataSharedAt: Date | null;
  orderedAt: Date | null;
  confirmedAt: Date | null;
  dispatchedAt: Date | null;
  issue: string | null;
  notes: string | null;
};
export type WorkflowSupplier = { id: string; name: string; isActive: boolean; shippingChargePaise?: number };

// ----------------------------------------------------------------- 1. availability + 2–5 create purchase

export function SupplierPlanner({
  orderId,
  items,
  offers,
  suppliers,
  poItems,
  disabled,
}: {
  orderId: string;
  items: WorkflowItem[];
  offers: WorkflowOffer[];
  suppliers: WorkflowSupplier[];
  poItems: { orderItemId: string; quantity: number }[];
  disabled: string | null;
}) {
  const { pending, exec } = useAction();
  const purchased = new Map<string, number>();
  for (const p of poItems) purchased.set(p.orderItemId, (purchased.get(p.orderItemId) ?? 0) + p.quantity);
  const remaining = items.map((i) => ({ ...i, remaining: i.quantity - (purchased.get(i.id) ?? 0) }));
  const preferred = offers.find((o) => o.isPreferred)?.supplierId ?? offers[0]?.supplierId ?? suppliers[0]?.id ?? "";
  const [supplierId, setSupplierId] = useState(preferred);
  const offerFor = (productId: string | null, sid: string) => offers.find((o) => o.productId === productId && o.supplierId === sid);
  const [lines, setLines] = useState(() =>
    Object.fromEntries(remaining.map((i) => [i.id, { include: i.remaining > 0, qty: i.remaining, cost: paiseToRupeesString(offerFor(i.productId, preferred)?.costPaise ?? null) }])),
  );
  const [shipping, setShipping] = useState("0");
  const [inclGst, setInclGst] = useState(true);
  const [gst, setGst] = useState("0");
  const [itc, setItc] = useState(false);
  const [actual, setActual] = useState(false);
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");

  function pickSupplier(sid: string) {
    setSupplierId(sid);
    setLines((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => {
      const item = items.find((i) => i.id === k)!;
      const c = offerFor(item.productId, sid)?.costPaise;
      return [k, { ...v, cost: c != null ? paiseToRupeesString(c) : v.cost }];
    })));
  }

  const anyRemaining = remaining.some((r) => r.remaining > 0);
  const productCost = remaining.reduce((a, i) => (lines[i.id]?.include ? a + (rupeesToPaise(lines[i.id]!.cost) ?? 0) * (lines[i.id]!.qty || 0) : a), 0);

  function submit() {
    const payload = {
      supplierId,
      supplierReference: ref,
      items: remaining
        .filter((i) => lines[i.id]?.include && lines[i.id]!.qty > 0)
        .map((i) => ({ orderItemId: i.id, quantity: Number(lines[i.id]!.qty), unitCostPaise: rupeesToPaise(lines[i.id]!.cost) ?? -1 })),
      shippingCostPaise: rupeesToPaise(shipping) ?? 0,
      costsIncludeGst: inclGst,
      gstOnCostsPaise: rupeesToPaise(gst) ?? 0,
      itcEligible: itc,
      costIsActual: actual,
      notes,
    };
    if (payload.items.some((i) => i.unitCostPaise < 0)) {
      toast.error("Enter a purchase cost for each selected item.");
      return;
    }
    exec(() => createPurchaseAction(orderId, payload));
  }

  return (
    <Section step="1–5" title="Check availability & plan supplier purchase">
      <div className="space-y-4">
        {remaining.map((i) => {
          const itemOffers = offers.filter((o) => o.productId === i.productId);
          return (
            <div key={i.id} className="border border-line p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium text-ink">
                  {i.brandName} {i.productName} {i.sizeMl ? `${i.sizeMl}ml` : ""} × {i.quantity}
                </p>
                <p className="text-xs text-stone">{i.remaining > 0 ? `${i.remaining} still to purchase` : "Fully assigned to purchases"}</p>
              </div>
              {itemOffers.length ? (
                <ul className="mt-2 space-y-1 text-xs text-charcoal">
                  {itemOffers.map((o) => (
                    <li key={o.supplierId}>
                      {o.supplierName}
                      {o.isPreferred && <Badge tone="gold" className="ml-1">Preferred</Badge>} — cost {o.costPaise != null ? formatINR(o.costPaise) : "not recorded"}
                      {o.supplierSku && ` · SKU ${o.supplierSku}`} · last confirmed {o.lastConfirmedAt ? formatDate(o.lastConfirmedAt) : "never"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-warning">No supplier offer recorded for this product.</p>
              )}
            </div>
          );
        })}
      </div>

      {disabled ? (
        <p className="mt-5 text-sm text-stone">{disabled}</p>
      ) : !anyRemaining ? (
        <p className="mt-5 text-sm text-stone">All items are assigned to supplier purchases below.</p>
      ) : (
        <div className="mt-6 space-y-4 border-t border-line pt-5">
          <p className="text-xs text-stone">Recording a purchase does not contact the supplier. You place the order yourself, then mark it as ordered below.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="po-supplier">Supplier</Label>
              <Select id="po-supplier" value={supplierId} onChange={(e) => pickSupplier(e.target.value)}>
                {suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="po-ref" optional>Supplier order reference</Label>
              <Input id="po-ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={120} />
            </div>
          </div>
          <div className="space-y-2">
            {remaining.filter((i) => i.remaining > 0).map((i) => (
              <div key={i.id} className="grid grid-cols-[auto_1fr_80px_120px] items-center gap-3 text-sm">
                <input type="checkbox" aria-label={`Include ${i.productName}`} checked={lines[i.id]?.include ?? false} onChange={(e) => setLines({ ...lines, [i.id]: { ...lines[i.id]!, include: e.target.checked } })} className="accent-ink" />
                <span className="truncate">{i.productName}</span>
                <Input aria-label="Quantity" type="number" min={1} max={i.remaining} value={lines[i.id]?.qty ?? 0} onChange={(e) => setLines({ ...lines, [i.id]: { ...lines[i.id]!, qty: Math.min(i.remaining, Math.max(1, Number(e.target.value))) } })} className="h-9" />
                <Input aria-label="Unit cost (₹)" placeholder="Unit cost ₹" inputMode="decimal" value={lines[i.id]?.cost ?? ""} onChange={(e) => setLines({ ...lines, [i.id]: { ...lines[i.id]!, cost: e.target.value } })} className="h-9" />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="po-ship">Supplier shipping charge (₹)</Label>
              <Input id="po-ship" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="po-gst">GST on these costs (₹)</Label>
              <Input id="po-gst" inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} />
            </div>
            <div className="space-y-2 pt-6">
              <Checkbox id="po-incl" checked={inclGst} onChange={(e) => setInclGst(e.target.checked)} label="Costs include GST" />
              <Checkbox id="po-itc" checked={itc} onChange={(e) => setItc(e.target.checked)} label="Input tax credit eligible" />
              <Checkbox id="po-actual" checked={actual} onChange={(e) => setActual(e.target.checked)} label="Costs are from the supplier's invoice" />
            </div>
          </div>
          <div>
            <Label htmlFor="po-notes" optional>Internal notes</Label>
            <Textarea id="po-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-stone">Product cost: <span className="text-ink">{formatINR(productCost)}</span></p>
            <Button onClick={submit} loading={pending}>Record supplier purchase</Button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ----------------------------------------------------------------- 6–11 per purchase

export function PurchaseCard({ orderId, po }: { orderId: string; po: WorkflowPurchase }) {
  const { pending, exec } = useAction();
  const [message, setMessage] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [ref, setRef] = useState(po.supplierReference ?? "");
  const [ship, setShip] = useState({ courier: "", trackingNumber: "", trackingUrl: "", dispatchedAt: new Date().toISOString().slice(0, 10), notify: true });
  const [issue, setIssue] = useState("");
  const [editCosts, setEditCosts] = useState(false);
  const [costs, setCosts] = useState({
    product: paiseToRupeesString(po.productCostPaise),
    shipping: paiseToRupeesString(po.shippingCostPaise),
    gst: paiseToRupeesString(po.gstOnCostsPaise),
    incl: po.costsIncludeGst,
    itc: po.itcEligible,
    invoice: po.supplierInvoiceNumber ?? "",
    actual: po.costIsActual,
  });

  const statusTone = po.status === "cancelled" || po.status === "issue" ? "danger" : po.status === "dispatched" || po.status === "delivered" ? "success" : "neutral";

  return (
    <div className="border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <p className="text-sm font-medium text-ink">
          {po.supplierName} {po.supplierReference && <span className="font-normal text-stone">· ref {po.supplierReference}</span>}
        </p>
        <Badge tone={statusTone}>{po.status}</Badge>
      </div>
      <div className="space-y-5 p-5 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>Product cost: <strong className="font-medium">{formatINR(po.productCostPaise)}</strong> {po.costIsActual ? <Badge tone="success">Invoice</Badge> : <Badge tone="warning">Estimate</Badge>}</p>
          <p>Supplier shipping: {formatINR(po.shippingCostPaise)}</p>
          <p>GST on costs: {formatINR(po.gstOnCostsPaise)} {po.costsIncludeGst ? "(included)" : "(extra)"} · ITC {po.itcEligible ? "eligible" : "not claimed"}</p>
          <p className="text-xs text-stone">
            {po.orderedAt && `Ordered ${formatDate(po.orderedAt, true)}`} {po.confirmedAt && `· confirmed ${formatDate(po.confirmedAt)}`} {po.dispatchedAt && `· dispatched ${formatDate(po.dispatchedAt)}`}
          </p>
        </div>
        {po.issue && <Notice tone="danger">Issue: {po.issue}</Notice>}
        {po.customerDataSharedAt && <p className="text-xs text-stone">Customer delivery details shared with supplier on {formatDate(po.customerDataSharedAt, true)}.</p>}

        {po.status === "draft" && (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-xs font-medium tracking-wide text-ink uppercase">6. Place the order with the supplier</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={pending && !message}
                onClick={() => exec(() => supplierMessageAction(orderId, po.id), (t) => setMessage((t as string) ?? null))}
              >
                Show supplier message
              </Button>
            </div>
            {message && (
              <div>
                <Textarea readOnly value={message} rows={Math.min(18, message.split("\n").length + 1)} className="font-mono text-xs" aria-label="Supplier message" />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={async () => {
                    await navigator.clipboard.writeText(message);
                    toast.success("Copied. Paste it into WhatsApp or email to your supplier.");
                  }}
                >
                  Copy to clipboard
                </Button>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label htmlFor={`ref-${po.id}`} optional>Supplier order reference</Label>
                <Input id={`ref-${po.id}`} value={ref} onChange={(e) => setRef(e.target.value)} />
              </div>
            </div>
            <Checkbox
              id={`consent-${po.id}`}
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              label="I confirm I have placed this order with the supplier and shared only the customer's name, phone and delivery address needed to dispatch it."
            />
            <Button size="sm" disabled={!consent} loading={pending} onClick={() => exec(() => markOrderedAction(orderId, po.id, ref, consent))}>
              Mark as ordered
            </Button>
          </div>
        )}

        {po.status === "ordered" && (
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-ink uppercase">7. Supplier confirmation</p>
            <Button size="sm" loading={pending} onClick={() => exec(() => markConfirmedAction(orderId, po.id))}>
              Supplier confirmed availability
            </Button>
          </div>
        )}

        {(po.status === "ordered" || po.status === "confirmed") && (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-xs font-medium tracking-wide text-ink uppercase">8–10. Dispatch & tracking</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`courier-${po.id}`}>Courier</Label>
                <Input id={`courier-${po.id}`} value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} placeholder="e.g. Delhivery" />
              </div>
              <div>
                <Label htmlFor={`awb-${po.id}`}>Tracking number</Label>
                <Input id={`awb-${po.id}`} value={ship.trackingNumber} onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`turl-${po.id}`} optional>Tracking link (https)</Label>
                <Input id={`turl-${po.id}`} value={ship.trackingUrl} onChange={(e) => setShip({ ...ship, trackingUrl: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`date-${po.id}`}>Dispatch date</Label>
                <Input id={`date-${po.id}`} type="date" value={ship.dispatchedAt} onChange={(e) => setShip({ ...ship, dispatchedAt: e.target.value })} />
              </div>
            </div>
            <Checkbox id={`notify-${po.id}`} checked={ship.notify} onChange={(e) => setShip({ ...ship, notify: e.target.checked })} label="Email the customer their tracking details" />
            <Button size="sm" loading={pending} onClick={() => exec(() => recordShipmentAction(orderId, { ...ship, poId: po.id }))}>
              Mark shipped
            </Button>
          </div>
        )}

        {po.status !== "cancelled" && po.status !== "delivered" && (
          <details className="border-t border-line pt-4">
            <summary className="cursor-pointer text-xs font-medium tracking-wide text-ink uppercase">11. Report an issue</summary>
            <Textarea className="mt-3" rows={2} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="e.g. Supplier out of stock, damaged in transit" aria-label="Issue description" />
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" loading={pending} onClick={() => exec(() => purchaseIssueAction(orderId, po.id, issue, false))}>
                Record issue
              </Button>
              <Button size="sm" variant="danger" loading={pending} onClick={() => exec(() => purchaseIssueAction(orderId, po.id, issue, true))}>
                Cancel this purchase
              </Button>
            </div>
          </details>
        )}

        <details open={editCosts} onToggle={(e) => setEditCosts((e.target as HTMLDetailsElement).open)} className="border-t border-line pt-4">
          <summary className="cursor-pointer text-xs font-medium tracking-wide text-ink uppercase">Update actual costs</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor={`pc-${po.id}`}>Product cost (₹)</Label><Input id={`pc-${po.id}`} value={costs.product} onChange={(e) => setCosts({ ...costs, product: e.target.value })} /></div>
            <div><Label htmlFor={`sc-${po.id}`}>Shipping (₹)</Label><Input id={`sc-${po.id}`} value={costs.shipping} onChange={(e) => setCosts({ ...costs, shipping: e.target.value })} /></div>
            <div><Label htmlFor={`gc-${po.id}`}>GST (₹)</Label><Input id={`gc-${po.id}`} value={costs.gst} onChange={(e) => setCosts({ ...costs, gst: e.target.value })} /></div>
            <div><Label htmlFor={`inv-${po.id}`} optional>Supplier invoice no.</Label><Input id={`inv-${po.id}`} value={costs.invoice} onChange={(e) => setCosts({ ...costs, invoice: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2 sm:pt-6">
              <Checkbox id={`ci-${po.id}`} checked={costs.incl} onChange={(e) => setCosts({ ...costs, incl: e.target.checked })} label="Costs include GST" />
              <Checkbox id={`itc-${po.id}`} checked={costs.itc} onChange={(e) => setCosts({ ...costs, itc: e.target.checked })} label="ITC eligible" />
              <Checkbox id={`act-${po.id}`} checked={costs.actual} onChange={(e) => setCosts({ ...costs, actual: e.target.checked })} label="From supplier invoice (actual)" />
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            loading={pending}
            onClick={() =>
              exec(() =>
                updateCostsAction(orderId, po.id, {
                  productCostPaise: rupeesToPaise(costs.product) ?? 0,
                  shippingCostPaise: rupeesToPaise(costs.shipping) ?? 0,
                  gstOnCostsPaise: rupeesToPaise(costs.gst) ?? 0,
                  costsIncludeGst: costs.incl,
                  itcEligible: costs.itc,
                  supplierInvoiceNumber: costs.invoice,
                  costIsActual: costs.actual,
                }),
              )
            }
          >
            Save costs
          </Button>
        </details>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- status, payment, requests, notes

export function StatusControl({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const { pending, exec } = useAction();
  const options = TRANSITIONS[status];
  const [to, setTo] = useState<string>(options[0] ?? "");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  if (!options.length) return <p className="text-sm text-stone">This order is in a final state.</p>;
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="status-to">Move to</Label>
        <Select id="status-to" value={to} onChange={(e) => setTo(e.target.value)}>
          {options.map((s) => <option key={s} value={s}>{ADMIN_STATUS_LABEL[s]}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="status-note" optional>Note (visible to customer)</Label>
        <Input id="status-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>
      <Checkbox id="status-notify" checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Email the customer (cancellation / delivery)" />
      <Button
        size="sm"
        loading={pending}
        onClick={() => {
          if (to === "cancelled" && !confirm("Cancel this order? If it's paid you'll need to record a refund.")) return;
          exec(() => changeStatusAction(orderId, to, note, notify));
        }}
      >
        Update status
      </Button>
    </div>
  );
}

export function RefundControl({ orderId, maxPaise, method, gatewayAvailable, requestId }: { orderId: string; maxPaise: number; method: "razorpay" | "cod"; gatewayAvailable: boolean; requestId: string | null }) {
  const { pending, exec } = useAction();
  const [amount, setAmount] = useState(paiseToRupeesString(maxPaise));
  const [reason, setReason] = useState("");
  const [via, setVia] = useState(method === "razorpay" && gatewayAvailable);
  if (maxPaise <= 0) return <p className="text-sm text-stone">Nothing left to refund.</p>;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="refund-amt">Amount (₹)</Label>
          <Input id="refund-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="mt-1 text-xs text-stone">Up to {formatINR(maxPaise)}</p>
        </div>
        <div>
          <Label htmlFor="refund-reason">Reason</Label>
          <Input id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      {method === "razorpay" && (
        <Checkbox id="refund-via" checked={via} disabled={!gatewayAvailable} onChange={(e) => setVia(e.target.checked)} label="Refund through the payment gateway (otherwise record a manual refund)" />
      )}
      <Button
        size="sm"
        variant="danger"
        loading={pending}
        onClick={() => {
          const paise = rupeesToPaise(amount);
          if (!paise) return toast.error("Enter a refund amount.");
          if (!confirm(`${via ? "Refund" : "Record a manual refund of"} ${formatINR(paise)}? This can't be undone.`)) return;
          exec(() => refundAction(orderId, { amountPaise: paise, reason, viaGateway: via, requestId }));
        }}
      >
        {via ? "Issue refund" : "Record refund"}
      </Button>
    </div>
  );
}

export function CodCollectedButton({ orderId }: { orderId: string }) {
  const { pending, exec } = useAction();
  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => exec(() => codCollectedAction(orderId))}>
      Mark COD collected
    </Button>
  );
}

export function RequestDecision({ orderId, requestId }: { orderId: string; requestId: string }) {
  const { pending, exec } = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="mt-2 space-y-2">
      <Input aria-label="Note to customer" placeholder="Note to customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-9" />
      <div className="flex gap-2">
        <Button size="sm" loading={pending} onClick={() => exec(() => resolveRequestAction(orderId, requestId, "approved", note))}>Approve</Button>
        <Button size="sm" variant="outline" loading={pending} onClick={() => exec(() => resolveRequestAction(orderId, requestId, "rejected", note))}>Decline</Button>
      </div>
    </div>
  );
}

export function InternalNotes({ orderId, initial }: { orderId: string; initial: string | null }) {
  const { pending, exec } = useAction();
  const [v, setV] = useState(initial ?? "");
  return (
    <div>
      <Textarea aria-label="Internal notes" rows={4} value={v} onChange={(e) => setV(e.target.value)} placeholder="Only visible to admins" />
      <Button size="sm" variant="secondary" className="mt-2" loading={pending} onClick={() => exec(() => saveInternalNotesAction(orderId, v))}>
        Save notes
      </Button>
    </div>
  );
}
