import "server-only";
import { db } from "../db";
import { env } from "../env";
import { getSettings, storeName } from "../settings";
import type { RenderedEmail, TemplateContext } from "./templates";

export type SendResult = { status: "sent" | "logged" | "failed"; id: string };

/**
 * Sends an email through Resend when configured. Without a provider the email is stored in the outbox
 * with status "logged" (viewable at /admin/emails) and is NOT sent — callers must not claim otherwise.
 * Failures never throw into order flows; they are recorded in the outbox.
 */
export async function sendEmail(to: string, template: string, email: RenderedEmail, orderId: string | null = null): Promise<SendResult> {
  const e = env();
  let status: SendResult["status"] = "logged";
  let providerId: string | null = null;
  let error: string | null = null;

  if (e.RESEND_API_KEY && e.EMAIL_FROM) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: e.EMAIL_FROM,
          to: [to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(e.EMAIL_REPLY_TO ? { reply_to: e.EMAIL_REPLY_TO } : {}),
        }),
        signal: AbortSignal.timeout(10000),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok && json.id) {
        status = "sent";
        providerId = json.id;
      } else {
        status = "failed";
        error = json.message ?? `HTTP ${res.status}`;
      }
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : "Unknown error";
    }
  }

  const rows = await db()<{ id: string }[]>`
    insert into email_outbox (to_email, template, subject, html, text_body, status, provider_message_id, error, order_id)
    values (${to}, ${template}, ${email.subject}, ${email.html}, ${email.text}, ${status}, ${providerId}, ${error}, ${orderId})
    returning id`;
  if (status === "failed") console.error(`[email] ${template} to order ${orderId ?? "-"} failed: ${error}`);
  return { status, id: rows[0]!.id };
}

export async function emailContext(orderUrl: string | null): Promise<TemplateContext> {
  const store = await getSettings("store");
  return { storeName: storeName(store), supportEmail: store.supportEmail, orderUrl };
}

export function siteUrl(path = ""): string {
  return env().SITE_URL.replace(/\/$/, "") + path;
}
