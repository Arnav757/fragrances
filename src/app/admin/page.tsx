import Link from "next/link";
import { PageHeader, Panel, Stat, Table, AnalysisStatusBadge } from "@/components/admin/ui";
import { Notice } from "@/components/ui/misc";
import { db } from "@/lib/db";
import { integrationStatus } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const sql = db();
  const [[q], [funnel], sources, due, pricing] = await Promise.all([
    sql<{ queue: number; overdue: number; revisions: number; released7: number }[]>`
      select count(*) filter (where status in ('paid', 'revision_requested'))::int as queue,
             count(*) filter (where status = 'paid' and due_at < now())::int as overdue,
             count(*) filter (where status = 'revision_requested')::int as revisions,
             count(*) filter (where status = 'released' and released_at > now() - interval '7 days')::int as released7
      from analyses`,
    sql<{ previews: number; paid: number; revenue: number; ai: number }[]>`
      select count(*)::int as previews,
             count(*) filter (where status <> 'preview')::int as paid,
             coalesce((select sum(total_paise) from orders where status = 'paid' and paid_at > now() - interval '30 days'), 0)::int as revenue,
             count(*) filter (where observation_source = 'ai')::int as ai
      from analyses where created_at > now() - interval '30 days'`,
    sql<{ source: string; previews: number; paid: number }[]>`
      select coalesce(source->>'utm_source', 'direct') || coalesce(' / ' || (source->>'utm_campaign'), '') as source,
             count(*)::int as previews, count(*) filter (where status <> 'preview')::int as paid
      from analyses where created_at > now() - interval '30 days'
      group by 1 order by previews desc limit 8`,
    sql<{ id: string; ref: string; firstName: string; status: string; dueAt: Date | null; plan: string | null }[]>`
      select id, ref, first_name, status, due_at, plan from analyses
      where status in ('paid', 'revision_requested') order by due_at nulls last limit 8`,
    getSettings("pricing"),
  ]);
  const s = integrationStatus();
  const warnings = [
    !s.razorpay.configured && "Razorpay keys are not set — customers can't pay.",
    s.razorpay.configured && !s.razorpay.webhook && "RAZORPAY_WEBHOOK_SECRET is not set — payments rely on the browser callback only.",
    !s.email.configured && "Email isn't configured — customers won't receive their report links.",
    !s.ai.configured && "ANTHROPIC_API_KEY isn't set — analyses use quiz answers only, photos are not analysed.",
    !s.storage.configured && "Private photo storage (Supabase) isn't configured — photos are stored on local disk.",
    !pricing.taxConfigVerified && "GST settings haven't been confirmed (Settings → Pricing).",
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader title="Overview" description="Review queue, funnel and setup status." />
      {warnings.length > 0 && (
        <Notice tone="warning" title="Before going live" className="mb-8">
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="To review" value={q!.queue} hint={`${q!.revisions} revision requests`} />
        <Stat label="Overdue" value={q!.overdue} tone={q!.overdue ? "warning" : undefined} hint="Past the promised time" />
        <Stat label="Released (7 days)" value={q!.released7} />
        <Stat label="Revenue (30 days)" value={formatINR(funnel!.revenue)} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Previews (30 days)" value={funnel!.previews} />
        <Stat label="Unlocked (30 days)" value={funnel!.paid} hint={funnel!.previews ? `${((funnel!.paid / funnel!.previews) * 100).toFixed(1)}% conversion` : "—"} />
        <Stat label="Analysed with photos" value={funnel!.previews ? `${Math.round((funnel!.ai / funnel!.previews) * 100)}%` : "—"} />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Panel title="Next up" actions={<Link href="/admin/reports?status=queue" className="text-xs underline">All</Link>}>
          {due.length ? (
            <ul className="divide-y divide-line">
              {due.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/admin/reports/${d.id}`} className="font-medium hover:underline">
                    {d.ref} · {d.firstName}
                  </Link>
                  <span className="flex items-center gap-2">
                    {d.plan === "priority" && <span className="text-xs text-gold-deep">priority</span>}
                    <AnalysisStatusBadge status={d.status} />
                    <span className={d.dueAt && d.dueAt < new Date() ? "text-xs text-danger" : "text-xs text-stone"}>due {formatDate(d.dueAt, true)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone">Nothing waiting. 🎉</p>
          )}
        </Panel>
        <Panel title="Where customers come from (30 days)">
          <Table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Previews</th>
                <th>Unlocked</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((r) => (
                <tr key={r.source}>
                  <td>{r.source}</td>
                  <td className="tabular-nums">{r.previews}</td>
                  <td className="tabular-nums">{r.paid}</td>
                  <td className="tabular-nums">{r.previews ? `${Math.round((r.paid / r.previews) * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>
    </>
  );
}
