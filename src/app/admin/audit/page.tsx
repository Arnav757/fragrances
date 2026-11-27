import type { Metadata } from "next";
import { PageHeader, Table } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireAdminPage();
  const rows = await db()<{ id: number; action: string; entity: string; entityId: string | null; metadata: unknown; createdAt: Date; actorName: string | null }[]>`
    select l.id, l.action, l.entity, l.entity_id, l.metadata, l.created_at, p.full_name as actor_name
    from audit_logs l left join profiles p on p.id = l.actor_id order by l.created_at desc limit 300`;
  return (
    <>
      <PageHeader title="Audit log" />
      <Table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-xs text-stone">{formatDate(r.createdAt, true)}</td>
              <td>{r.actorName ?? "system"}</td>
              <td>{r.action}</td>
              <td className="text-xs">{r.entity} {r.entityId?.slice(0, 8)}</td>
              <td className="max-w-xs truncate font-mono text-xs text-stone">{JSON.stringify(r.metadata)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
