import { formatINR } from "../money";

export type TemplateContext = { storeName: string; supportEmail: string };
export type RenderedEmail = { subject: string; html: string; text: string };

export function esc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(ctx: TemplateContext, title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f3f1ec;font-family:Helvetica,Arial,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ec;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3dfd6">
<tr><td style="padding:24px 32px;border-bottom:1px solid #e3dfd6;font-size:15px;font-weight:bold;letter-spacing:6px">${esc(ctx.storeName)}</td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e3dfd6;font-size:12px;color:#6b6760">
Your report link is private — anyone who has it can open your report. ${ctx.supportEmail ? `Questions? <a href="mailto:${esc(ctx.supportEmail)}" style="color:#141414">${esc(ctx.supportEmail)}</a>.` : "Reply to this email with any questions."}
</td></tr></table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:28px 0"><a href="${esc(href)}" style="background:#141414;color:#ffffff;padding:13px 22px;text-decoration:none;font-size:13px;letter-spacing:1px;text-transform:uppercase">${esc(label)}</a></p>`;
}

const h1 = (t: string) => `<h1 style="font-size:24px;font-weight:bold;margin:0 0 12px;letter-spacing:-0.3px">${esc(t)}</h1>`;

export const templates = {
  preview_link(ctx: TemplateContext, d: { name: string; ref: string; url: string }): RenderedEmail {
    const subject = `Your style preview (${d.ref})`;
    return {
      subject,
      html: layout(ctx, subject, `${h1(`Here's your preview, ${d.name}.`)}<p>Your frame, colour family and first outfits are saved. Come back to unlock the full report whenever you're ready.</p>${button(d.url, "Open my preview")}`),
      text: `Here's your preview, ${d.name}.\n\nOpen it any time: ${d.url}\nReference: ${d.ref}`,
    };
  },

  payment_confirmation(ctx: TemplateContext, d: { name: string; ref: string; url: string; amountPaise: number; orderNumber: string; reviewBy: string }): RenderedEmail {
    const subject = `Your full report is unlocked (${d.ref})`;
    return {
      subject,
      html: layout(
        ctx,
        subject,
        `${h1(`You're in, ${d.name}.`)}<p>We've received your payment of <strong>${formatINR(d.amountPaise)}</strong> (order ${esc(d.orderNumber)}). Your full report is ready to explore now.</p>
<p>A stylist will review it, adjust anything that needs it and add a personal note. We'll email you when the final version is released — <strong>by ${esc(d.reviewBy)}</strong>.</p>${button(d.url, "Open my report")}`,
      ),
      text: `Payment received: ${formatINR(d.amountPaise)} (order ${d.orderNumber}).\nYour report: ${d.url}\nStylist review due by ${d.reviewBy}.`,
    };
  },

  report_released(ctx: TemplateContext, d: { name: string; ref: string; url: string; stylist: string; changed: boolean }): RenderedEmail {
    const subject = `Your final report is ready (${d.ref})`;
    return {
      subject,
      html: layout(
        ctx,
        subject,
        `${h1("Your final report is ready.")}<p>Hi ${esc(d.name)}, ${d.stylist ? esc(d.stylist) : "our stylist"} has reviewed your report${d.changed ? " and made some adjustments" : ""}, and left you a personal note.</p>${button(d.url, "See my final report")}<p style="color:#6b6760;font-size:13px">If anything doesn't feel right, use “Ask for a revision” on the report page.</p>`,
      ),
      text: `Your final report is ready: ${d.url}`,
    };
  },

  revision_received(ctx: TemplateContext, d: { name: string; ref: string; url: string }): RenderedEmail {
    const subject = `We've got your revision request (${d.ref})`;
    return {
      subject,
      html: layout(ctx, subject, `${h1("Revision requested")}<p>Thanks, ${esc(d.name)}. A stylist will look at your request and update your report. We'll email you when it's done.</p>${button(d.url, "Open my report")}`),
      text: `We've got your revision request. ${d.url}`,
    };
  },

  find_links(ctx: TemplateContext, d: { links: { ref: string; url: string; created: string; status: string }[] }): RenderedEmail {
    const subject = `Your ${ctx.storeName} report links`;
    const list = d.links.map((l) => `<li style="margin:8px 0"><a href="${esc(l.url)}" style="color:#141414">${esc(l.ref)}</a> — ${esc(l.status)}, started ${esc(l.created)}</li>`).join("");
    return {
      subject,
      html: layout(ctx, subject, `${h1("Your report links")}<p>Here are the reports linked to this email address:</p><ul style="padding-left:18px">${list}</ul><p style="color:#6b6760;font-size:13px">If you didn't ask for this, you can ignore this email.</p>`),
      text: `Your report links:\n${d.links.map((l) => `${l.ref} (${l.status}): ${l.url}`).join("\n")}`,
    };
  },

  refund(ctx: TemplateContext, d: { name: string; ref: string; amountPaise: number }): RenderedEmail {
    const subject = `Refund initiated (${d.ref})`;
    return {
      subject,
      html: layout(ctx, subject, `${h1("Refund initiated")}<p>Hi ${esc(d.name)}, we've initiated a refund of <strong>${formatINR(d.amountPaise)}</strong> to your original payment method. Banks can take 5–7 working days to show it.</p>`),
      text: `Refund of ${formatINR(d.amountPaise)} initiated for ${d.ref}.`,
    };
  },

  password_reset(ctx: TemplateContext, d: { name: string; resetUrl: string }): RenderedEmail {
    const subject = `Reset your ${ctx.storeName} staff password`;
    return {
      subject,
      html: layout(ctx, subject, `<p>Hi ${esc(d.name)}, we received a request to reset your password. This link expires in 60 minutes.</p>${button(d.resetUrl, "Reset password")}<p style="color:#6b6760;font-size:13px">If you didn't ask for this, ignore this email.</p>`),
      text: `Reset your password (expires in 60 minutes): ${d.resetUrl}`,
    };
  },
};
