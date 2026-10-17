import { requireAdminPage } from "@/lib/auth/session";
import { financialReport } from "@/lib/services/reports";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader, Panel, Table } from "@/components/admin/ui";
import { ExpenseForm } from "@/components/admin/settings-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";

export const metadata = { title: "Financial report" };

function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const from = valid(sp.from) ?? monthStart();
  const toIncl = valid(sp.to) ?? new Date().toISOString().slice(0, 10);
  const toExcl = new Date(new Date(toIncl).getTime() + 86400_000);
  const r = await financialReport(new Date(from), toExcl);
  const expenses = await db()<{ id: string; category: string; description: string; amountPaise: number; gstPaise: number; itcEligible: boolean; incurredOn: Date }[]>`
    select id, category, description, amount_paise, gst_paise, itc_eligible, incurred_on from expenses where incurred_on >= ${from} and incurred_on < ${toExcl} order by incurred_on desc`;
  const line = (label: string, v: number, opts: { minus?: boolean; strong?: boolean; note?: string } = {}) => (
    <tr className={opts.strong ? "font-medium" : ""}>
      <td>{label}{opts.note && <p className="text-xs font-normal text-stone">{opts.note}</p>}</td>
      <td className="text-right tabular-nums">{opts.minus && v ? "−" : ""}{formatINR(v)}</td>
    </tr>
  );
  return (
    <div className="space-y-8">
      <PageHeader title="Financial report" description="Estimated contribution before overheads and income tax. Not a substitute for proper accounts or tax advice." />
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div><label htmlFor="from" className="mb-1 block text-xs">From</label><Input id="from" type="date" name="from" defaultValue={from} /></div>
        <div><label htmlFor="to" className="mb-1 block text-xs">To (inclusive)</label><Input id="to" type="date" name="to" defaultValue={toIncl} /></div>
        <Button type="submit" variant="secondary">Update</Button>
      </form>

      {(r.ordersMissingCosts > 0 || r.ordersWithEstimatedCosts > 0 || r.paymentsMissingFees > 0) && (
        <Notice tone="warning" title="Figures include estimates">
          <ul className="list-disc pl-5">
            {r.ordersMissingCosts > 0 && <li>{r.ordersMissingCosts} paid order(s) have no supplier purchase recorded — their product cost counts as ₹0, so contribution is overstated.</li>}
            {r.ordersWithEstimatedCosts > 0 && <li>{r.ordersWithEstimatedCosts} order(s) use estimated (catalogue) costs rather than supplier invoices.</li>}
            {r.paymentsMissingFees > 0 && <li>{r.paymentsMissingFees} Razorpay payment(s) have no fee recorded yet (fees arrive via webhook).</li>}
          </ul>
        </Notice>
      )}

      <Panel title={`${formatDate(new Date(from))} – ${formatDate(new Date(toIncl))} · ${r.orderCount} paid orders`}>
        <Table>
          <tbody>
            {line("Gross sales (charged to customers, incl. GST)", r.grossSalesPaise)}
            {line("Output GST collected", r.outputTaxPaise, { minus: true, note: "Payable to government (before input tax credit)" })}
            {line("Refunds (excl. GST portion)", r.refundsExTaxPaise, { minus: true, note: `Total refunded incl. GST: ${formatINR(r.refundsPaise)}` })}
            {line("Revenue excl. GST", r.revenueExTaxPaise, { strong: true, note: `Discounts of ${formatINR(r.discountsPaise)} are already deducted` })}
            {line("Product & supplier shipping cost", r.costsExRecoverableGstPaise, { minus: true, note: `Cost basis: supplier purchases recorded on each order, excluding GST you can reclaim as ITC. Recorded total incl. GST: ${formatINR(r.productCostPaise + r.supplierShippingPaise)}` })}
            {line("Non-recoverable GST on costs", r.costGstNotRecoverablePaise, { minus: true })}
            {line("Payment gateway fees (incl. GST on fees)", r.paymentFeesPaise, { minus: true })}
            {line("Other expenses (advertising etc.)", r.expensesPaise, { minus: true, note: "Excluding ITC-eligible GST" })}
            {line("Estimated contribution", r.contributionPaise, { strong: true, note: "Before overheads, salaries, rent and income tax" })}
          </tbody>
        </Table>
        <p className="mt-3 text-xs text-stone">Revenue is not profit. GST is excluded from revenue and costs where it is recoverable, so it isn&apos;t double-counted. Based on orders created in the period.</p>
      </Panel>

      <Panel title="Record an expense">
        <ExpenseForm />
        {expenses.length > 0 && (
          <ul className="mt-6 divide-y divide-line text-sm">
            {expenses.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span>{formatDate(e.incurredOn)} · <span className="capitalize">{e.category}</span> · {e.description}</span>
                <span className="tabular-nums">{formatINR(e.amountPaise)}{e.itcEligible ? ` (ITC ${formatINR(e.gstPaise)})` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
