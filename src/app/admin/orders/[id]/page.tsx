import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/services/orders";
import { adminOrderExtras } from "@/lib/services/admin-orders";
import { listSuppliers } from "@/lib/services/admin-catalog";
import { getGateway } from "@/lib/payments/gateway";
import { db } from "@/lib/db";
import { formatINR, formatRateBp } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { ADMIN_STATUS_LABEL } from "@/lib/order-status";
import { KV, PageHeader, Panel, PaymentBadge, StatusBadge, Table } from "@/components/admin/ui";
import { CodCollectedButton, InternalNotes, PurchaseCard, RefundControl, RequestDecision, StatusControl, SupplierPlanner } from "@/components/admin/order-workflow";
import { Notice } from "@/components/ui/misc";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await getOrderDetail({ id }, db(), { customerView: false });
  if (!order) notFound();
  const [extras, suppliers] = await Promise.all([adminOrderExtras(id), listSuppliers()]);
  const refunded = order.refunds.filter((r) => r.status !== "failed").reduce((a, r) => a + r.amountPaise, 0);
  const paid = ["paid", "partially_refunded", "cod_collected"].includes(order.paymentStatus) ? order.totalPaise : 0;
  const openRequests = order.requests.filter((r) => r.status === "requested");
  const activePurchases = extras.purchases.filter((p) => p.status !== "cancelled");
  const supplierCost = activePurchases.reduce((a, p) => a + p.productCostPaise + p.shippingCostPaise, 0);
  const fees = extras.payments.reduce((a, p) => a + (p.feePaise ?? 0), 0);
  const a = order.shippingAddress;
  const plannerDisabled = ["awaiting_payment", "payment_failed"].includes(order.status)
    ? "Wait for payment before purchasing from the supplier."
    : ["cancelled", "refunded", "cancellation_requested"].includes(order.status)
      ? `Order is ${ADMIN_STATUS_LABEL[order.status].toLowerCase()} — no new supplier purchases.`
      : null;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={order.orderNumber}
        description={`Placed ${formatDate(order.createdAt, true)} · ${order.paymentMethod === "cod" ? "Cash on delivery" : "Online payment"}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
          </div>
        }
      />

      {order.status === "cancelled" && order.paymentStatus === "paid" && (
        <Notice tone="danger" className="mb-6" title="Paid order is cancelled">
          A payment was captured for this cancelled order. Issue a refund below.
        </Notice>
      )}
      {openRequests.map((r) => (
        <Notice key={r.id} tone="warning" className="mb-6" title={`Customer ${r.type} request`}>
          <p>“{r.reason}” — {formatDate(r.createdAt, true)}</p>
          <RequestDecision orderId={order.id} requestId={r.id} />
        </Notice>
      ))}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Items">
            <Table>
              <thead>
                <tr><th>Product</th><th>Qty</th><th className="text-right">Unit</th><th className="text-right">Line</th><th className="text-right">GST</th></tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.brandName} {i.productName}
                      <p className="text-xs text-stone">{[i.concentration, i.sizeMl ? `${i.sizeMl} ml` : null, i.productType === "inspired_fragrance" ? "Inspired" : "Authentic", i.hsnCode ? `HSN ${i.hsnCode}` : null].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td>{i.quantity}</td>
                    <td className="text-right tabular-nums">{formatINR(i.unitPricePaise)}</td>
                    <td className="text-right tabular-nums">{formatINR(i.lineGrossPaise)}{i.discountAllocPaise > 0 && <p className="text-xs text-stone">−{formatINR(i.discountAllocPaise)} disc.</p>}</td>
                    <td className="text-right text-xs text-stone tabular-nums">{formatRateBp(i.taxRateBp)} · {formatINR(i.taxPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>

          <SupplierPlanner
            orderId={order.id}
            items={order.items}
            offers={extras.offers}
            suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))}
            poItems={extras.poItems.filter((p) => extras.purchases.find((x) => x.id === p.poId)?.status !== "cancelled")}
            disabled={plannerDisabled}
          />

          {extras.purchases.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-[0.6875rem] font-medium tracking-[0.14em] text-ink uppercase">Supplier purchases</h2>
              {extras.purchases.map((po) => <PurchaseCard key={po.id} orderId={order.id} po={po} />)}
            </div>
          )}

          {order.shipments.length > 0 && (
            <Panel title="Shipments">
              <ul className="space-y-2 text-sm">
                {order.shipments.map((s) => (
                  <li key={s.id}>{s.courier} · {s.trackingNumber} · shipped {formatDate(s.shippedAt)}{s.deliveredAt && ` · delivered ${formatDate(s.deliveredAt)}`}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Timeline">
            <ol className="space-y-3 text-sm">
              {[...order.events].reverse().map((e) => (
                <li key={e.id} className="flex gap-4">
                  <span className="w-36 shrink-0 text-xs text-stone">{formatDate(e.createdAt, true)}</span>
                  <span>{e.message}{e.toStatus && <span className="text-stone"> → {ADMIN_STATUS_LABEL[e.toStatus]}</span>}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <KV items={[
              ["Name", order.contactName],
              ["Email", <a key="e" href={`mailto:${order.contactEmail}`} className="underline">{order.contactEmail}</a>],
              ["Phone", order.contactPhone],
              ["Account", order.userId ? "Registered" : "Guest"],
              ["Ship to", <span key="a">{a.fullName}<br />{a.line1}{a.line2 && <><br />{a.line2}</>}{a.landmark && <><br />Landmark: {a.landmark}</>}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</span>],
              ["Notes", order.customerNotes],
            ]} />
          </Panel>

          <Panel title="Status">
            <StatusControl orderId={order.id} status={order.status} />
          </Panel>

          <Panel title="Money">
            <KV items={[
              ["Subtotal", formatINR(order.subtotalPaise)],
              ["Discount", order.discountPaise ? `−${formatINR(order.discountPaise)} (${order.discountCode})` : "—"],
              ["Shipping", formatINR(order.shippingPaise)],
              ...(order.codFeePaise ? [["COD fee", formatINR(order.codFeePaise)] as [string, string]] : []),
              ["Total", <strong key="t">{formatINR(order.totalPaise)}</strong>],
              ["Taxable value", formatINR(order.taxableValuePaise)],
              ["GST", `${formatINR(order.taxPaise)} (${order.igstPaise ? `IGST ${formatINR(order.igstPaise)}` : `CGST ${formatINR(order.cgstPaise)} + SGST ${formatINR(order.sgstPaise)}`})`],
              ["Supplier costs", activePurchases.length ? formatINR(supplierCost) : "Not recorded"],
              ["Gateway fees", fees ? formatINR(fees) : "—"],
              ["Refunded", refunded ? formatINR(refunded) : "—"],
            ]} />
            {order.paymentMethod === "cod" && order.paymentStatus === "cod_pending" && order.status === "delivered" && (
              <div className="mt-4"><CodCollectedButton orderId={order.id} /></div>
            )}
          </Panel>

          <Panel title="Payments">
            {extras.payments.length === 0 ? (
              <p className="text-sm text-stone">No payment records.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {extras.payments.map((p) => (
                  <li key={p.id} className="border-b border-line pb-2">
                    <span className="font-medium">{p.provider}</span> · {p.status} · {formatINR(p.amountPaise)} {p.method && `· ${p.method}`}
                    <p className="break-all text-stone">{p.providerPaymentId} · {formatDate(p.createdAt, true)}</p>
                    {p.errorDescription && <p className="text-danger">{p.errorDescription}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Refund">
            <RefundControl orderId={order.id} maxPaise={paid - refunded} method={order.paymentMethod} gatewayAvailable={!!getGateway()} requestId={openRequests.find((r) => r.type !== "cancellation")?.id ?? null} />
          </Panel>

          <Panel title="Internal notes">
            <InternalNotes orderId={order.id} initial={extras.internalNotes} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
