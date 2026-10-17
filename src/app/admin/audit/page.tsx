import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PageHeader, Table } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requireAdminPage();
  const rows = await db()<{ id: string; action: string; entity: string; entityId: string | null; metadata: unknown; createdAt: Date; actor: string | null }[]>`
    select a.id, a.action, a.entity, a.entity_id, a.metadata, a.created_at, p.email as actor
    from audit_logs a left join profiles p on p.id = a.actor_id order by a.created_at desc limit 300`;
  return (
    <div>
      <PageHeader title="Audit log" description="Sensitive admin actions — latest 300." />
      <Table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-xs whitespace-nowrap text-stone">{formatDate(r.createdAt, true)}</td>
              <td className="text-xs">{r.actor ?? "system"}</td>
              <td className="text-xs font-medium">{r.action}<p className="font-normal text-stone">{r.entity}{r.entityId ? ` ${r.entityId.slice(0, 8)}` : ""}</p></td>
              <td className="max-w-md truncate font-mono text-[0.6875rem] text-stone" title={JSON.stringify(r.metadata)}>{JSON.stringify(r.metadata)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
