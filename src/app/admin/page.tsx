import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { dashboardStats, ordersNeedingAction } from "@/lib/services/reports";
import { adminListOrders } from "@/lib/services/admin-orders";
import { expireStaleOrders } from "@/lib/services/orders";
import { getAllSettings } from "@/lib/settings";
import { integrationStatus } from "@/lib/env";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader, Panel, PaymentBadge, Stat, StatusBadge, Table } from "@/components/admin/ui";
import { Notice } from "@/components/ui/misc";

export const metadata = { title: "Overview" };

async function setupWarnings() {
  const { store, commerce } = await getAllSettings();
  const s = integrationStatus();
  const [counts] = await db()<{ demo: number; unverifiedTax: number; admins: number }[]>`
    select (select count(*)::int from products where is_demo and is_active) as demo,
      (select count(*)::int from tax_classes where not is_verified) as unverified_tax,
      (select count(*)::int from profiles where role = 'admin') as admins`;
  const w: { text: string; href: string }[] = [];
  if (!s.razorpay.configured) w.push({ text: s.mockPayments ? "Razorpay isn't configured — checkout is using SIMULATED payments." : "Razorpay isn't configured — online payment is unavailable.", href: "/admin/settings" });
  if (s.razorpay.configured && !s.razorpay.webhook) w.push({ text: "RAZORPAY_WEBHOOK_SECRET is missing — payments rely only on the checkout callback.", href: "/admin/settings" });
  if (!s.email.configured) w.push({ text: "Email provider isn't configured — customer emails are logged but NOT sent.", href: "/admin/emails" });
  if (!commerce.sellerState) w.push({ text: "Seller state isn't set — GST can't be split into CGST/SGST vs IGST correctly.", href: "/admin/settings" });
  if (!commerce.taxConfigVerified || counts!.unverifiedTax > 0) w.push({ text: "Tax configuration hasn't been verified. Confirm GST rates and HSN codes with your tax adviser.", href: "/admin/catalog" });
  if (!store.supportEmail || !store.legalBusinessName) w.push({ text: "Business name and support contact details are incomplete — they appear on policy pages.", href: "/admin/settings" });
  if (counts!.demo > 0) w.push({ text: `${counts!.demo} demo product(s) are visible on the storefront. Remove them before launch.`, href: "/admin/products" });
  if (!s.storage.configured) w.push({ text: "Supabase Storage isn't configured — uploaded images are saved to local disk (development only).", href: "/admin/settings" });
  return w;
}

export default async function AdminHome() {
  await requireAdminPage();
  await expireStaleOrders(); // housekeeping; also available as a cron endpoint
  const [stats, action, recent, warnings] = await Promise.all([dashboardStats(), ordersNeedingAction(), adminListOrders({}), setupWarnings()]);
  return (
    <div>
      <PageHeader title="Overview" description="Orders, fulfilment and setup at a glance." />

      {warnings.length > 0 && (
        <Notice tone="warning" title="Before going live" className="mb-8">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {warnings.map((w) => (
              <li key={w.text}>
                <Link href={w.href} className="hover:underline">
                  {w.text}
                </Link>
              </li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total orders" value={stats.total} hint={`${stats.awaitingPayment} awaiting payment`} />
        <Stat label="Paid orders" value={stats.paid} hint="Online paid + COD collected" />
        <Stat label="Pending fulfilment" value={stats.pendingFulfilment} tone={stats.pendingFulfilment ? "warning" : undefined} />
        <Stat label="Cancelled" value={stats.cancelled} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Stat label="Revenue (paid, incl. GST)" value={formatINR(stats.revenue)} hint="Money received from customers. Not profit." />
        <Stat label="Revenue excl. GST" value={formatINR(stats.revenueExTax)} hint="Taxable value of paid orders" />
        <Stat label="Recorded supplier costs" value={formatINR(stats.recordedCosts)} hint={<Link href="/admin/reports" className="underline">See contribution in the financial report</Link>} />
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <Panel title={`Needs action (${action.length})`}>
          {action.length === 0 ? (
            <p className="text-sm text-stone">Nothing waiting. Nice.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {action.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-ink hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="flex-1 text-stone">{o.reason}</span>
                  <span className="text-xs text-stone">{formatDate(o.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-xs underline">All orders</Link>}>
          {recent.rows.length === 0 ? (
            <p className="text-sm text-stone">No orders yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.rows.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                        {o.orderNumber}
                      </Link>
                      <p className="text-xs text-stone">{o.contactName}</p>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>
                      <PaymentBadge status={o.paymentStatus} />
                    </td>
                    <td className="text-right tabular-nums">{formatINR(o.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
