"use server";

import { db } from "@/lib/db";
import { newsletterSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { fieldErrors } from "@/lib/forms";

export type NewsletterState = { ok?: boolean; message?: string; errors?: { email?: string; consent?: string } } | null;

const CONSENT_TEXT = "Agreed to receive occasional emails about new arrivals and offers; can unsubscribe at any time.";

export async function subscribeNewsletter(_: NewsletterState, form: FormData): Promise<NewsletterState> {
  const parsed = newsletterSchema.safeParse({ email: form.get("email"), consent: form.get("consent") === "yes" });
  if (!parsed.success) {
    const f = fieldErrors(parsed.error);
    return { errors: { email: f.email, consent: f.consent } };
  }
  if (!(await rateLimit(`newsletter:${await clientIp()}`, 5, 3600))) return { message: "Too many attempts. Please try again later." };
  await db()`
    insert into newsletter_subscribers (email, consent_text, source) values (${parsed.data.email}, ${CONSENT_TEXT}, 'homepage')
    on conflict (email) do update set consent_text = excluded.consent_text, consented_at = now(), unsubscribed_at = null`;
  return { ok: true };
}
