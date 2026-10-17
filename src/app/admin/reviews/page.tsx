import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { ReviewButtons } from "@/components/admin/entity-forms";
import { Badge, EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage() {
  await requireAdminPage();
  const rows = await db()<{ id: string; rating: number; title: string | null; body: string; status: string; createdAt: Date; productName: string; customer: string; orderNumber: string }[]>`
    select r.id, r.rating, r.title, r.body, r.status, r.created_at, p.name as product_name, pr.full_name as customer, o.order_number
    from reviews r join products p on p.id = r.product_id join profiles pr on pr.id = r.user_id
    join order_items oi on oi.id = r.order_item_id join orders o on o.id = oi.order_id
    order by (r.status = 'pending') desc, r.created_at desc limit 200`;
  return (
    <div>
      <PageHeader title="Reviews" description="Only customers with a delivered order can review. Approve genuine reviews — including critical ones." />
      {rows.length === 0 ? (
        <EmptyState title="No reviews yet" description="Reviews from verified purchases will appear here for moderation." />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="border border-line bg-paper p-5">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gold-deep">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                <span className="font-medium">{r.productName}</span>
                <span className="text-xs text-stone">{r.customer} · {r.orderNumber} · {formatDate(r.createdAt)}</span>
                <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}>{r.status}</Badge>
              </div>
              {r.title && <p className="mt-2 font-medium">{r.title}</p>}
              <p className="mt-1 text-sm text-charcoal">{r.body}</p>
              {r.status === "pending" && <div className="mt-3"><ReviewButtons id={r.id} /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
