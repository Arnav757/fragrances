import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listOrdersForUser } from "@/lib/services/orders";
import { PAYMENT_LABEL, STATUS_LABEL } from "@/lib/order-status";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await listOrdersForUser(user.id);
  return (
    <section>
      <h1 className="mb-6 text-2xl text-ink">Orders</h1>
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" description="When you place an order while signed in, it will appear here." action={<ButtonLink href="/shop">Start shopping</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.orderNumber}`} className="flex flex-wrap items-center justify-between gap-3 py-5 hover:bg-paper">
                <div>
                  <p className="font-medium text-ink">{o.orderNumber}</p>
                  <p className="text-xs text-stone">
                    {formatDate(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-ink">{STATUS_LABEL[o.status]}</p>
                  <p className="text-xs text-stone">
                    {formatINR(o.totalPaise)} · {PAYMENT_LABEL[o.paymentStatus]}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-stone">Checked out as a guest? Use the link in your order email or on the confirmation page to view that order.</p>
    </section>
  );
}
