import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { KV, PageHeader, Panel } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Email preview" };

export default async function EmailPreview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const rows = await db()<{ toEmail: string; template: string; subject: string; html: string; textBody: string; status: string; createdAt: Date }[]>`
    select to_email, template, subject, html, text_body, status, created_at from email_outbox where id = ${id}`;
  const e = rows[0];
  if (!e) notFound();
  return (
    <div className="space-y-6">
      <PageHeader back={{ href: "/admin/emails", label: "Email log" }} title={e.subject} />
      <Panel><KV items={[["To", e.toEmail], ["Template", e.template], ["Status", e.status], ["Created", formatDate(e.createdAt, true)]]} /></Panel>
      <Panel title="HTML preview">
        {/* Sandboxed: no scripts, no same-origin access. */}
        <iframe title="Email preview" sandbox="" srcDoc={e.html} className="h-[720px] w-full border border-line bg-white" />
      </Panel>
      <Panel title="Plain text"><pre className="text-xs whitespace-pre-wrap">{e.textBody}</pre></Panel>
    </div>
  );
}
