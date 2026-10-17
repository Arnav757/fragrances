import { formatINR } from "../money";

export type EmailOrder = {
  orderNumber: string;
  contactName: string;
  items: { productName: string; brandName: string; sizeMl: number | null; quantity: number; lineGrossPaise: number }[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  taxPaise: number;
  totalPaise: number;
  pricesIncludeTax: boolean;
  paymentMethod: "razorpay" | "cod";
  shippingAddress: { fullName: string; line1: string; line2?: string; city: string; state: string; pincode: string };
};

export type TemplateContext = { storeName: string; supportEmail: string; orderUrl: string | null };

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
<body style="margin:0;background:#f5f1ea;font-family:Helvetica,Arial,sans-serif;color:#1a1918">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1ea;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border:1px solid #e4dccf">
<tr><td style="padding:28px 32px;border-bottom:1px solid #e4dccf;font-family:Georgia,serif;font-size:20px;letter-spacing:4px;text-align:center">${esc(ctx.storeName)}</td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e4dccf;font-size:12px;color:#6b655d">
Questions? ${ctx.supportEmail ? `Write to <a href="mailto:${esc(ctx.supportEmail)}" style="color:#6b5730">${esc(ctx.supportEmail)}</a>.` : "Reply to this email."}
</td></tr></table></td></tr></table></body></html>`;
}

function button(href: string | null, label: string) {
  if (!href) return "";
  return `<p style="margin:28px 0"><a href="${esc(href)}" style="background:#1a1918;color:#fffdf9;padding:12px 22px;text-decoration:none;font-size:13px;letter-spacing:1px;text-transform:uppercase">${esc(label)}</a></p>`;
}

function orderTable(o: EmailOrder): string {
  const rows = o.items
    .map(
      (i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee6da">${esc(i.brandName)} — ${esc(i.productName)}${i.sizeMl ? ` (${i.sizeMl} ml)` : ""} × ${i.quantity}</td>
<td style="padding:8px 0;border-bottom:1px solid #eee6da;text-align:right">${formatINR(i.lineGrossPaise)}</td></tr>`,
    )
    .join("");
  const line = (label: string, v: string) => `<tr><td style="padding:4px 0;color:#6b655d">${label}</td><td style="padding:4px 0;text-align:right">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
${line("Subtotal", formatINR(o.subtotalPaise))}
${o.discountPaise ? line("Discount", "−" + formatINR(o.discountPaise)) : ""}
${line("Shipping", o.shippingPaise ? formatINR(o.shippingPaise) : "Free")}
${o.codFeePaise ? line("COD fee", formatINR(o.codFeePaise)) : ""}
${o.pricesIncludeTax ? line("Includes GST", formatINR(o.taxPaise)) : line("GST", formatINR(o.taxPaise))}
<tr><td style="padding:10px 0;font-weight:bold">Total</td><td style="padding:10px 0;text-align:right;font-weight:bold">${formatINR(o.totalPaise)}</td></tr></table>`;
}

function address(o: EmailOrder) {
  const a = o.shippingAddress;
  return `<p style="font-size:14px;color:#3b3833">${esc(a.fullName)}<br>${esc(a.line1)}${a.line2 ? "<br>" + esc(a.line2) : ""}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}</p>`;
}

function itemsText(o: EmailOrder) {
  return o.items.map((i) => `- ${i.brandName} ${i.productName}${i.sizeMl ? ` ${i.sizeMl}ml` : ""} x${i.quantity}: ${formatINR(i.lineGrossPaise)}`).join("\n");
}

export const templates = {
  order_confirmation(ctx: TemplateContext, o: EmailOrder): RenderedEmail {
    const subject = `Order ${o.orderNumber} received`;
    const cod = o.paymentMethod === "cod";
    const html = layout(
      ctx,
      subject,
      `<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 12px">Thank you, ${esc(o.contactName)}.</h1>
<p>We've received your order <strong>${esc(o.orderNumber)}</strong>. ${cod ? `You've chosen cash on delivery — please keep ${formatINR(o.totalPaise)} ready.` : ""} We'll email you again when it ships.</p>
${orderTable(o)}<h3 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-top:24px">Delivering to</h3>${address(o)}
${button(ctx.orderUrl, "View order")}`,
    );
    const text = `Thank you, ${o.contactName}.\n\nWe've received your order ${o.orderNumber}.${cod ? ` Payment: cash on delivery (${formatINR(o.totalPaise)}).` : ""}\n\n${itemsText(o)}\nTotal: ${formatINR(o.totalPaise)}\n\n${ctx.orderUrl ?? ""}`;
    return { subject, html, text };
  },

  payment_confirmation(ctx: TemplateContext, o: EmailOrder): RenderedEmail {
    const subject = `Payment received — order ${o.orderNumber}`;
    const html = layout(
      ctx,
      subject,
      `<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 12px">Payment confirmed</h1>
<p>Thank you, ${esc(o.contactName)}. We've received your payment of <strong>${formatINR(o.totalPaise)}</strong> for order <strong>${esc(o.orderNumber)}</strong>, and we're now preparing it. We'll email you tracking details when it ships.</p>
${orderTable(o)}<h3 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-top:24px">Delivering to</h3>${address(o)}
${button(ctx.orderUrl, "View order")}`,
    );
    const text = `Payment confirmed for order ${o.orderNumber}: ${formatINR(o.totalPaise)}.\n\n${itemsText(o)}\n\n${ctx.orderUrl ?? ""}`;
    return { subject, html, text };
  },

  order_dispatched(ctx: TemplateContext, o: EmailOrder, s: { courier: string; trackingNumber: string; trackingUrl: string | null }): RenderedEmail {
    const subject = `Your order ${o.orderNumber} has shipped`;
    const html = layout(
      ctx,
      subject,
      `<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 12px">On its way</h1>
<p>Good news, ${esc(o.contactName)} — order <strong>${esc(o.orderNumber)}</strong> has been dispatched.</p>
<p><strong>Courier:</strong> ${esc(s.courier)}<br><strong>Tracking number:</strong> ${esc(s.trackingNumber)}</p>
${button(s.trackingUrl, "Track shipment")}${address(o)}${button(ctx.orderUrl, "View order")}`,
    );
    const text = `Order ${o.orderNumber} has shipped.\nCourier: ${s.courier}\nTracking: ${s.trackingNumber}${s.trackingUrl ? `\n${s.trackingUrl}` : ""}`;
    return { subject, html, text };
  },

  tracking_update(ctx: TemplateContext, o: EmailOrder, s: { courier: string; trackingNumber: string; trackingUrl: string | null }): RenderedEmail {
    const subject = `Tracking update for order ${o.orderNumber}`;
    const html = layout(
      ctx,
      subject,
      `<p>Hi ${esc(o.contactName)}, the tracking details for order <strong>${esc(o.orderNumber)}</strong> have been updated.</p>
<p><strong>Courier:</strong> ${esc(s.courier)}<br><strong>Tracking number:</strong> ${esc(s.trackingNumber)}</p>${button(s.trackingUrl, "Track shipment")}`,
    );
    return { subject, html, text: `Tracking for ${o.orderNumber}: ${s.courier} ${s.trackingNumber} ${s.trackingUrl ?? ""}` };
  },

  delivered(ctx: TemplateContext, o: EmailOrder): RenderedEmail {
    const subject = `Order ${o.orderNumber} delivered`;
    const html = layout(
      ctx,
      subject,
      `<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 12px">Delivered</h1>
<p>Hi ${esc(o.contactName)}, our records show order <strong>${esc(o.orderNumber)}</strong> has been delivered. If anything isn't right, please contact us.</p>${button(ctx.orderUrl, "View order")}`,
    );
    return { subject, html, text: `Order ${o.orderNumber} has been delivered.` };
  },

  cancellation(ctx: TemplateContext, o: EmailOrder, info: { reason: string | null; refundExpected: boolean }): RenderedEmail {
    const subject = `Order ${o.orderNumber} cancelled`;
    const html = layout(
      ctx,
      subject,
      `<p>Hi ${esc(o.contactName)}, order <strong>${esc(o.orderNumber)}</strong> has been cancelled.${info.reason ? ` Reason: ${esc(info.reason)}.` : ""}</p>
<p>${info.refundExpected ? "We'll email you as soon as your refund is initiated." : "No payment was taken for this order."}</p>${button(ctx.orderUrl, "View order")}`,
    );
    return { subject, html, text: `Order ${o.orderNumber} has been cancelled.${info.refundExpected ? " We'll email you when your refund is initiated." : ""}` };
  },

  refund_status(ctx: TemplateContext, o: EmailOrder, r: { amountPaise: number; status: string; viaGateway: boolean }): RenderedEmail {
    const subject = `Refund update — order ${o.orderNumber}`;
    const statusLine =
      r.status === "processed"
        ? "has been processed"
        : r.status === "failed"
          ? "could not be processed — we'll contact you"
          : r.viaGateway
            ? "has been initiated to your original payment method"
            : "has been recorded and will be paid by bank transfer";
    const html = layout(
      ctx,
      subject,
      `<p>Hi ${esc(o.contactName)}, a refund of <strong>${formatINR(r.amountPaise)}</strong> for order <strong>${esc(o.orderNumber)}</strong> ${statusLine}.</p>
<p style="color:#6b655d;font-size:13px">Banks and payment providers can take several working days to show refunds on your statement.</p>${button(ctx.orderUrl, "View order")}`,
    );
    return { subject, html, text: `Refund of ${formatINR(r.amountPaise)} for order ${o.orderNumber} ${statusLine}.` };
  },

  password_reset(ctx: TemplateContext, d: { name: string; resetUrl: string }): RenderedEmail {
    const subject = `Reset your ${ctx.storeName} password`;
    const html = layout(
      ctx,
      subject,
      `<p>Hi ${esc(d.name)}, we received a request to reset your password. This link expires in 60 minutes.</p>${button(d.resetUrl, "Reset password")}
<p style="color:#6b655d;font-size:13px">If you didn't ask for this, you can ignore this email — your password won't change.</p>`,
    );
    return { subject, html, text: `Reset your password (link expires in 60 minutes): ${d.resetUrl}\nIf you didn't request this, ignore this email.` };
  },
};

export type TemplateName = keyof typeof templates;
