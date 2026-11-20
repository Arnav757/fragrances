import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Table } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Email log" };
export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const rows = await db()<{ id: string; toEmail: string; template: string; subject: string; status: string; createdAt: Date }[]>`
    select id, to_email, template, subject, status, created_at from email_outbox order by created_at desc limit 200`;
  return (
    <>
      <PageHeader title="Email log" description="Every email we tried to send. “Logged” means email isn't configured and it was NOT sent." />
      <Table>
        <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-xs text-stone">{formatDate(r.createdAt, true)}</td>
              <td>{r.toEmail}</td>
              <td><Link href={`/admin/emails/${r.id}`} className="underline-offset-2 hover:underline">{r.subject}</Link></td>
              <td className={r.status === "failed" ? "text-xs text-danger" : r.status === "logged" ? "text-xs text-warning" : "text-xs text-success"}>{r.status === "logged" ? "logged, not sent" : r.status}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="py-10 text-center text-stone">No emails yet.</td></tr>}
        </tbody>
      </Table>
    </>
  );
}
