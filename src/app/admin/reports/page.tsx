import type { Metadata } from "next";
import Link from "next/link";
import { AnalysisStatusBadge, PageHeader, Table } from "@/components/admin/ui";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const FILTERS = { queue: "Needs review", revision_requested: "Revisions", released: "Released", preview: "Previews (unpaid)", all: "All" } as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = (sp.status && sp.status in FILTERS ? sp.status : "queue") as keyof typeof FILTERS;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const sql = db();
  const rows = await sql<{ id: string; ref: string; firstName: string; email: string | null; status: string; plan: string | null; dueAt: Date | null; createdAt: Date; observationSource: string }[]>`
    select id, ref, first_name, email, status, plan, due_at, created_at, observation_source from analyses
    where true
      ${status === "queue" ? sql`and status in ('paid', 'revision_requested')` : status === "all" ? sql`` : sql`and status = ${status}`}
      ${q ? sql`and (ref ilike ${"%" + q + "%"} or email ilike ${"%" + q + "%"} or first_name ilike ${"%" + q + "%"})` : sql``}
    order by ${status === "queue" ? sql`due_at asc nulls last` : sql`created_at desc`}
    limit 200`;
  return (
    <>
      <PageHeader title="Reports" description="Every analysis. Reviews are ordered by deadline." />
      <form className="mb-6 flex flex-wrap gap-2" role="search">
        <Select name="status" defaultValue={status} aria-label="Status" className="w-48">
          {Object.entries(FILTERS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Input name="q" defaultValue={q} placeholder="Ref, name or email" aria-label="Search" className="w-64" />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <Table>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Name</th>
            <th>Status</th>
            <th>Plan</th>
            <th>Due</th>
            <th>Analysis</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/admin/reports/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                  {r.ref}
                </Link>
              </td>
              <td>
                {r.firstName}
                {r.email && <span className="block text-xs text-stone">{r.email}</span>}
              </td>
              <td>
                <AnalysisStatusBadge status={r.status} />
              </td>
              <td className="text-xs">{r.plan ?? "—"}</td>
              <td className={r.dueAt && r.dueAt < new Date() && r.status !== "released" ? "text-xs text-danger" : "text-xs"}>{r.dueAt ? formatDate(r.dueAt, true) : "—"}</td>
              <td className="text-xs">{r.observationSource === "ai" ? "Photos + quiz" : "Quiz only"}</td>
              <td className="text-xs text-stone">{formatDate(r.createdAt, true)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-stone">
                Nothing here.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
