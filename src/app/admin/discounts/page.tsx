import type { Metadata } from "next";
import { PageHeader, Panel, Table } from "@/components/admin/ui";
import { DiscountForm, DiscountToggle } from "@/components/admin/forms";
import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Promo codes" };
export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await requireAdminPage();
  const rows = await db()<{ id: string; code: string; description: string | null; type: string; value: number; maxUses: number | null; usedCount: number; endsAt: Date | null; isActive: boolean }[]>`
    select id, code, description, type, value, max_uses, used_count, ends_at, is_active from discounts order by created_at desc`;
  return (
    <>
      <PageHeader title="Promo codes" description="Great for influencer and Instagram campaigns — pair a code with a utm_campaign to see what converts." />
      <Panel title="New code" className="mb-8"><DiscountForm /></Panel>
      <Table>
        <thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Ends</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="font-medium">{d.code}{d.description && <span className="block text-xs text-stone">{d.description}</span>}</td>
              <td>{d.type === "percent" ? `${d.value / 100}%` : formatINR(d.value)}</td>
              <td className="tabular-nums">{d.usedCount}{d.maxUses ? ` / ${d.maxUses}` : ""}</td>
              <td className="text-xs">{d.endsAt ? formatDate(d.endsAt, true) : "—"}</td>
              <td className="text-xs">{d.isActive ? "Active" : "Disabled"}</td>
              <td><DiscountToggle id={d.id} active={d.isActive} /></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="py-10 text-center text-stone">No codes yet.</td></tr>}
        </tbody>
      </Table>
    </>
  );
}
