import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { KV, PageHeader } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Email" };
export const dynamic = "force-dynamic";

export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const rows = await db()<{ toEmail: string; subject: string; html: string; status: string; error: string | null; createdAt: Date }[]>`
    select to_email, subject, html, status, error, created_at from email_outbox where id = ${id}`;
  const e = rows[0];
  if (!e) notFound();
  return (
    <>
      <PageHeader back={{ href: "/admin/emails", label: "Email log" }} title={e.subject} />
      <KV items={[["To", e.toEmail], ["Status", e.status], ["Sent", formatDate(e.createdAt, true)], ...(e.error ? ([["Error", e.error]] as [string, string][]) : [])]} />
      {/* Rendered in a fully sandboxed frame: no scripts, no same-origin access. */}
      <iframe title="Email preview" sandbox="" srcDoc={e.html} className="mt-6 h-[640px] w-full rounded-2xl border border-line bg-paper" />
    </>
  );
}
