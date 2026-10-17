import { requireAdminPage } from "@/lib/auth/session";
import { listDiscounts } from "@/lib/services/admin-catalog";
import { PageHeader, Panel } from "@/components/admin/ui";
import { DiscountForm } from "@/components/admin/entity-forms";
import { Badge } from "@/components/ui/misc";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Discounts" };

export default async function DiscountsPage() {
  await requireAdminPage();
  const rows = await listDiscounts();
  return (
    <div className="space-y-8">
      <PageHeader title="Discount codes" description="Codes are validated on the server at checkout. Usage is reserved when an order is placed and released if it's cancelled unpaid." />
      <Panel title="Create a code"><DiscountForm /></Panel>
      <Panel title={`Codes (${rows.length})`}>
        <ul className="divide-y divide-line">
          {rows.map((d) => (
            <li key={d.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-mono font-medium">{d.code}</span>
                <span>{d.type === "percent" ? `${d.value / 100}% off` : `${formatINR(d.value)} off`}{d.maxDiscountPaise ? ` (max ${formatINR(d.maxDiscountPaise)})` : ""}</span>
                <span className="text-xs text-stone">min {formatINR(d.minSubtotalPaise)} · used {d.usedCount}{d.maxUses ? `/${d.maxUses}` : ""}{d.endsAt ? ` · ends ${formatDate(d.endsAt)}` : ""}</span>
                {d.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
              </div>
              {d.description && <p className="text-xs text-stone">{d.description}</p>}
              <div className="mt-2"><DiscountForm initial={d} /></div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
