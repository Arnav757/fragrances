import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusText, PageHeader, Table } from "@/components/admin/ui";
import { RefundButton } from "@/components/admin/forms";
import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  await requireAdminPage();
  const rows = await db()<{ id: string; orderNumber: string; analysisId: string; ref: string; contactName: string; contactEmail: string; plan: string; totalPaise: number; taxPaise: number; discountCode: string | null; status: string; createdAt: Date; paidAt: Date | null }[]>`
    select o.id, o.order_number, o.analysis_id, a.ref, o.contact_name, o.contact_email, o.plan, o.total_paise, o.tax_paise, o.discount_code, o.status, o.created_at, o.paid_at
    from orders o join analyses a on a.id = o.analysis_id order by o.created_at desc limit 300`;
  return (
    <>
      <PageHeader title="Orders & refunds" description="Payments are verified server-side against Razorpay. Refunds go back to the original payment method." />
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
