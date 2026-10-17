import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { integrationStatus } from "@/lib/env";
import { PageHeader, Table } from "@/components/admin/ui";
import { Badge, EmptyState, Notice } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Email log" };

export default async function EmailsPage() {
  await requireAdminPage();
  const rows = await db()<{ id: string; toEmail: string; template: string; subject: string; status: string; error: string | null; createdAt: Date }[]>`
    select id, to_email, template, subject, status, error, created_at from email_outbox order by created_at desc limit 200`;
  return (
    <div>
      <PageHeader title="Email log" description="Every customer email the store generates, and whether it was actually sent." />
      {!integrationStatus().email.configured && (
        <Notice tone="warning" className="mb-6">No email provider is configured. Emails below are <strong>logged only — customers did not receive them</strong>. Set RESEND_API_KEY and EMAIL_FROM to send.</Notice>
      )}
      {rows.length === 0 ? <EmptyState title="No emails yet" /> : (
        <Table>
          <thead><tr><th>When</th><th>To</th><th>Template</th><th>Subject</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-xs whitespace-nowrap text-stone">{formatDate(r.createdAt, true)}</td>
                <td className="text-xs">{r.toEmail}</td>
                <td className="text-xs">{r.template}</td>
                <td><Link href={`/admin/emails/${r.id}`} className="hover:underline">{r.subject}</Link></td>
                <td>{r.status === "sent" ? <Badge tone="success">Sent</Badge> : r.status === "failed" ? <Badge tone="danger">Failed</Badge> : <Badge tone="warning">Logged, not sent</Badge>}{r.error && <p className="text-xs text-danger">{r.error}</p>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
