import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, Table } from "@/components/admin/ui";
import { Badge, EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import { formatINR } from "@/lib/money";

export const metadata = { title: "Returns & cancellations" };

export default async function RequestsPage() {
  await requireAdminPage();
  const rows = await db()<{ id: string; orderId: string; orderNumber: string; type: string; status: string; reason: string; createdAt: Date; totalPaise: number; paymentStatus: string }[]>`
    select r.id, r.order_id, o.order_number, r.type, r.status, r.reason, r.created_at, o.total_paise, o.payment_status
    from order_requests r join orders o on o.id = r.order_id
    order by (r.status = 'requested') desc, r.created_at desc limit 200`;
  return (
    <div>
      <PageHeader title="Returns, cancellations & refund requests" description="Decide on each request from the order page, where you can also record refunds." />
      {rows.length === 0 ? (
        <EmptyState title="No requests" description="Customer cancellation and return requests will appear here." />
      ) : (
        <Table>
          <thead><tr><th>Order</th><th>Type</th><th>Reason</th><th>Status</th><th>Received</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/orders/${r.orderId}`} className="font-medium hover:underline">{r.orderNumber}</Link><p className="text-xs text-stone">{formatINR(r.totalPaise)} · {r.paymentStatus}</p></td>
                <td className="capitalize">{r.type}</td>
                <td className="max-w-md text-xs">{r.reason}</td>
                <td>{r.status === "requested" ? <Badge tone="warning">Awaiting decision</Badge> : <Badge>{r.status}</Badge>}</td>
                <td className="text-xs text-stone">{formatDate(r.createdAt, true)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
