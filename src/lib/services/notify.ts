import "server-only";
import { db } from "../db";
import { emailContext, sendEmail, siteUrl } from "../email/send";
import { templates, type EmailOrder } from "../email/templates";
import { guestOrderToken } from "./order-access";

async function loadEmailOrder(orderId: string): Promise<(EmailOrder & { contactEmail: string; userId: string | null; id: string }) | null> {
  const rows = await db()<(Omit<EmailOrder, "items"> & { contactEmail: string; userId: string | null; id: string })[]>`
    select id, order_number, contact_name, contact_email, user_id, subtotal_paise, discount_paise, shipping_paise, cod_fee_paise,
      tax_paise, total_paise, prices_include_tax, payment_method, shipping_address
    from orders where id = ${orderId}`;
  const o = rows[0];
  if (!o) return null;
  const items = await db()<EmailOrder["items"]>`
    select product_name, brand_name, size_ml, quantity, line_gross_paise from order_items where order_id = ${orderId} order by product_name`;
  return { ...o, items };
}

function orderUrl(o: { orderNumber: string; userId: string | null; id: string }) {
  return o.userId
    ? siteUrl(`/account/orders/${o.orderNumber}`)
    : siteUrl(`/order/${o.orderNumber}?t=${guestOrderToken(o.id)}`);
}

type Notification =
  | { kind: "order_confirmation" }
  | { kind: "payment_confirmation" }
  | { kind: "order_dispatched" | "tracking_update"; courier: string; trackingNumber: string; trackingUrl: string | null }
  | { kind: "delivered" }
  | { kind: "cancellation"; reason: string | null; refundExpected: boolean }
  | { kind: "refund_status"; amountPaise: number; status: string; viaGateway: boolean };

/** Send a customer notification. Never throws — email problems must not break order processing. */
export async function notifyCustomer(orderId: string, n: Notification) {
  try {
    const o = await loadEmailOrder(orderId);
    if (!o) return null;
    const ctx = await emailContext(orderUrl(o));
    let rendered;
    switch (n.kind) {
      case "order_confirmation":
        rendered = templates.order_confirmation(ctx, o);
        break;
      case "payment_confirmation":
        rendered = templates.payment_confirmation(ctx, o);
        break;
      case "order_dispatched":
      case "tracking_update":
        rendered = templates[n.kind](ctx, o, n);
        break;
      case "delivered":
        rendered = templates.delivered(ctx, o);
        break;
      case "cancellation":
        rendered = templates.cancellation(ctx, o, n);
        break;
      case "refund_status":
        rendered = templates.refund_status(ctx, o, n);
        break;
    }
    return await sendEmail(o.contactEmail, n.kind, rendered, o.id);
  } catch (err) {
    console.error("[notify] failed", n.kind, err instanceof Error ? err.message : err);
    return null;
  }
}
