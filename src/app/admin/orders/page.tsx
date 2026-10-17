import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { adminListOrders } from "@/lib/services/admin-orders";
import { ADMIN_STATUS_LABEL, ORDER_STATUSES, PAYMENT_LABEL, PAYMENT_STATUSES } from "@/lib/order-status";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader, PaymentBadge, StatusBadge, Table } from "@/components/admin/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Orders" };

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminOrders({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const sp = await searchParams;
  const { rows, total, page, pageCount } = await adminListOrders({ q: sp.q, status: sp.status, payment: sp.payment, from: sp.from, to: sp.to, page: Number(sp.page) || 1 });
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `/admin/orders?${u}`;
  };
  const exportQs = new URLSearchParams(Object.entries({ from: sp.from, to: sp.to }).filter(([, v]) => v) as [string, string][]);
  return (
    <div>
      <PageHeader title="Orders" description={`${total} order${total === 1 ? "" : "s"}`} actions={<ButtonLink href={`/admin/export/orders?${exportQs}`} variant="outline" size="sm">Export CSV</ButtonLink>} />
      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <label className="sr-only" htmlFor="q">Search</label>
        <Input id="q" name="q" placeholder="Order no., name, email, phone" defaultValue={sp.q} className="lg:col-span-2" />
        <label className="sr-only" htmlFor="status">Status</label>
        <Select id="status" name="status" defaultValue={sp.status ?? ""}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ADMIN_STATUS_LABEL[s]}</option>)}
        </Select>
        <label className="sr-only" htmlFor="payment">Payment</label>
        <Select id="payment" name="payment" defaultValue={sp.payment ?? ""}>
          <option value="">All payments</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
        </Select>
        <div className="flex gap-2 lg:col-span-2">
          <label className="sr-only" htmlFor="from">From</label>
          <Input id="from" type="date" name="from" defaultValue={sp.from} />
          <label className="sr-only" htmlFor="to">To</label>
          <Input id="to" type="date" name="to" defaultValue={sp.to} />
          <Button type="submit" variant="secondary">Filter</Button>
        </div>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No orders found" description="Try adjusting the filters." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Payment</th>
              <th className="text-right">Total</th>
              <th className="text-right">Supplier cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-ivory">
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.orderNumber}</Link>
                  {o.openRequests > 0 && <span className="ml-2 text-[0.6875rem] text-danger">{o.openRequests} request</span>}
                  <p className="text-xs text-stone">{o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {o.paymentMethod === "cod" ? "COD" : "Online"}</p>
                </td>
                <td className="text-xs whitespace-nowrap text-stone">{formatDate(o.createdAt, true)}</td>
                <td>
                  {o.contactName}
                  <p className="text-xs text-stone">{o.contactEmail}</p>
                </td>
                <td><StatusBadge status={o.status} /></td>
                <td><PaymentBadge status={o.paymentStatus} /></td>
                <td className="text-right tabular-nums">{formatINR(o.totalPaise)}</td>
                <td className="text-right text-stone tabular-nums">{o.supplierCostPaise != null ? formatINR(o.supplierCostPaise) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {pageCount > 1 && (
        <div className="mt-6 flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={qs(page - 1)} className="underline">Previous</Link>}
          <span className="text-stone">Page {page} of {pageCount}</span>
          {page < pageCount && <Link href={qs(page + 1)} className="underline">Next</Link>}
        </div>
      )}
    </div>
  );
}
