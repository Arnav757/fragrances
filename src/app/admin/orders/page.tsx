import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusText, PageHeader, Panel, Table } from "@/components/admin/ui";
import { RefundButton, UpiReviewButtons } from "@/components/admin/forms";
import { upiQueue } from "@/lib/services/upi";
import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  await requireAdminPage();
  const queue = await upiQueue();
  const rows = await db()<{ id: string; orderNumber: string; analysisId: string; ref: string; contactName: string; contactEmail: string; plan: string; totalPaise: number; taxPaise: number; discountCode: string | null; status: string; createdAt: Date; paidAt: Date | null }[]>`
    select o.id, o.order_number, o.analysis_id, a.ref, o.contact_name, o.contact_email, o.plan, o.total_paise, o.tax_paise, o.discount_code, o.status, o.created_at, o.paid_at
    from orders o join analyses a on a.id = o.analysis_id order by o.created_at desc limit 300`;
  return (
    <>
      <PageHeader title="Orders & refunds" description="Razorpay payments are verified automatically. UPI QR payments wait below until you confirm them." />
      {queue.length > 0 && (
        <Panel title={`UPI payments to check (${queue.length})`} className="mb-6">
          <p className="mb-4 text-sm text-stone">Open your bank or UPI app and find each transaction ID with the exact amount before confirming. Confirming unlocks the report and emails the customer.</p>
          <Table>
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Amount</th><th>UTR</th><th>Submitted</th><th /></tr>
            </thead>
            <tbody>
              {queue.map((p) => (
                <tr key={p.paymentId}>
                  <td className="font-medium">{p.orderNumber}<Link href={`/admin/reports/${p.analysisId}`} className="block text-xs text-stone underline-offset-2 hover:underline">{p.ref}</Link></td>
                  <td>{p.contactName}<span className="block text-xs text-stone">{p.contactPhone} · {p.contactEmail}</span></td>
                  <td className="font-semibold tabular-nums">{formatINR(p.amountPaise)}</td>
                  <td className="font-mono text-sm">{p.utr}</td>
                  <td className="text-xs text-stone">{formatDate(p.createdAt, true)}</td>
                  <td><UpiReviewButtons paymentId={p.paymentId} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
      <Table>
        <thead>
          <tr><th>Order</th><th>Report</th><th>Customer</th><th>Plan</th><th>Total</th><th>Status</th><th>Created</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="font-medium">{o.orderNumber}</td>
              <td><Link href={`/admin/reports/${o.analysisId}`} className="underline-offset-2 hover:underline">{o.ref}</Link></td>
              <td>{o.contactName}<span className="block text-xs text-stone">{o.contactEmail}</span></td>
              <td className="text-xs">{o.plan}</td>
              <td className="tabular-nums">{formatINR(o.totalPaise)}{o.discountCode && <span className="block text-xs text-stone">code {o.discountCode}</span>}<span className="block text-xs text-stone">incl. GST {formatINR(o.taxPaise)}</span></td>
              <td><OrderStatusText status={o.status} /></td>
              <td className="text-xs text-stone">{formatDate(o.createdAt, true)}</td>
              <td>{o.status === "paid" && <RefundButton orderId={o.id} />}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={8} className="py-10 text-center text-stone">No orders yet.</td></tr>}
        </tbody>
      </Table>
    </>
  );
}
