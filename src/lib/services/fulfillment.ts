import "server-only";
import { z } from "zod";
import { db, type Tx } from "../db";
import { audit } from "./audit";
import { notifyCustomer } from "./notify";
import { releaseDiscountUse } from "./discounts";
import { canTransition, type OrderStatus, type PaymentStatus, ADMIN_STATUS_LABEL } from "../order-status";
import { getGateway } from "../payments/gateway";
import { formatINR } from "../money";

export class FulfillmentError extends Error {}

type Actor = { id: string };

async function lockOrder(tx: Tx, orderId: string) {
  const rows = await tx<{ id: string; status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod: "razorpay" | "cod"; totalPaise: number; discountCode: string | null }[]>`
    select id, status, payment_status, payment_method, total_paise, discount_code from orders where id = ${orderId} for update`;
  if (!rows[0]) throw new FulfillmentError("Order not found.");
  return rows[0];
}

async function transition(tx: Tx, orderId: string, from: OrderStatus, to: OrderStatus, actor: Actor, message: string, customerVisible: boolean) {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new FulfillmentError(`Can't move an order from "${ADMIN_STATUS_LABEL[from]}" to "${ADMIN_STATUS_LABEL[to]}".`);
  }
  await tx`update orders set status = ${to},
             cancelled_at = case when ${to} = 'cancelled' then now() else cancelled_at end,
             delivered_at = case when ${to} = 'delivered' then now() else delivered_at end
           where id = ${orderId}`;
  await tx`insert into fulfillment_events (order_id, from_status, to_status, message, customer_visible, actor_id)
           values (${orderId}, ${from}, ${to}, ${message}, ${customerVisible}, ${actor.id})`;
}

/** Manual status change by an admin (validated against the transition map). */
export async function changeOrderStatus(orderId: string, to: OrderStatus, actor: Actor, note: string | null, notify: boolean) {
  const result = await db().begin(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (to === "confirmed" && o.paymentMethod === "razorpay" && o.paymentStatus !== "paid") {
      throw new FulfillmentError("An online order can only be confirmed after its payment is verified.");
    }
    await transition(tx, orderId, o.status, to, actor, note || `Status changed to ${ADMIN_STATUS_LABEL[to]}`, true);
    if (to === "cancelled") {
      if (o.paymentStatus === "pending" || o.paymentStatus === "failed") await tx`update orders set payment_status = 'cancelled' where id = ${orderId}`;
      if (o.discountCode && !["paid", "cod_collected"].includes(o.paymentStatus)) await releaseDiscountUse(o.discountCode, tx);
      await tx`update supplier_purchase_orders set status = 'cancelled' where order_id = ${orderId} and status in ('draft')`;
    }
    if (to === "delivered") {
      await tx`update shipments set delivered_at = coalesce(delivered_at, now()) where order_id = ${orderId}`;
      await tx`update supplier_purchase_orders set status = 'delivered', delivered_at = now() where order_id = ${orderId} and status = 'dispatched'`;
    }
    await audit(actor.id, "order.status", "order", orderId, { from: o.status, to, note }, tx);
    return o;
  });
  if (notify) {
    if (to === "cancelled") {
      await notifyCustomer(orderId, {
        kind: "cancellation",
        reason: note,
        refundExpected: ["paid", "partially_refunded"].includes(result.paymentStatus),
      });
    }
    if (to === "delivered") await notifyCustomer(orderId, { kind: "delivered" });
  }
}

export const poItemSchema = z.object({ orderItemId: z.uuid(), quantity: z.number().int().positive(), unitCostPaise: z.number().int().nonnegative() });
export const createPoSchema = z.object({
  supplierId: z.uuid(),
  supplierReference: z.string().trim().max(120).optional().default(""),
  items: z.array(poItemSchema).min(1, { error: "Select at least one item" }),
  shippingCostPaise: z.number().int().nonnegative().default(0),
  costsIncludeGst: z.boolean().default(false),
  gstOnCostsPaise: z.number().int().nonnegative().default(0),
  itcEligible: z.boolean().default(false),
  costIsActual: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional().default(""),
});

/** Step 1–5: record which supplier fulfils which items and at what cost (draft, nothing is sent). */
export async function createSupplierPurchase(orderId: string, raw: z.input<typeof createPoSchema>, actor: Actor) {
  const input = createPoSchema.parse(raw);
  return db().begin(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (["cancelled", "refunded", "awaiting_payment", "payment_failed"].includes(o.status)) {
      throw new FulfillmentError("Supplier purchases can only be created for confirmed orders.");
    }
    const items = await tx<{ id: string; quantity: number }[]>`select id, quantity from order_items where order_id = ${orderId}`;
    const byId = new Map(items.map((i) => [i.id, i.quantity]));
    const already = await tx<{ orderItemId: string; qty: number }[]>`
      select spi.order_item_id, sum(spi.quantity)::int as qty from supplier_po_items spi
      join supplier_purchase_orders po on po.id = spi.po_id
      where po.order_id = ${orderId} and po.status <> 'cancelled' group by spi.order_item_id`;
    const used = new Map(already.map((a) => [a.orderItemId, a.qty]));
    for (const it of input.items) {
      const ordered = byId.get(it.orderItemId);
      if (ordered === undefined) throw new FulfillmentError("Item does not belong to this order.");
      if ((used.get(it.orderItemId) ?? 0) + it.quantity > ordered) throw new FulfillmentError("Quantity exceeds the items still to be purchased.");
    }
    const productCost = input.items.reduce((a, i) => a + i.quantity * i.unitCostPaise, 0);
    const [po] = await tx<{ id: string }[]>`
      insert into supplier_purchase_orders (order_id, supplier_id, supplier_reference, status, product_cost_paise, shipping_cost_paise,
        costs_include_gst, gst_on_costs_paise, itc_eligible, cost_is_actual, notes, created_by)
      values (${orderId}, ${input.supplierId}, ${input.supplierReference || null}, 'draft', ${productCost}, ${input.shippingCostPaise},
        ${input.costsIncludeGst}, ${input.gstOnCostsPaise}, ${input.itcEligible}, ${input.costIsActual}, ${input.notes || null}, ${actor.id})
      returning id`;
    for (const it of input.items) {
      await tx`insert into supplier_po_items (po_id, order_item_id, quantity, unit_cost_paise) values (${po!.id}, ${it.orderItemId}, ${it.quantity}, ${it.unitCostPaise})`;
    }
    if (o.status === "confirmed") await transition(tx, orderId, o.status, "awaiting_supplier_purchase", actor, "Supplier purchase prepared", false);
    await audit(actor.id, "supplier_po.create", "order", orderId, { poId: po!.id, supplierId: input.supplierId, productCost }, tx);
    return po!.id;
  });
}

async function lockPo(tx: Tx, poId: string) {
  const rows = await tx<{ id: string; orderId: string; status: string; supplierId: string }[]>`
    select id, order_id, status, supplier_id from supplier_purchase_orders where id = ${poId} for update`;
  if (!rows[0]) throw new FulfillmentError("Supplier purchase not found.");
  return rows[0];
}

/**
 * Step 6: mark the purchase as placed with the supplier. Requires explicit confirmation that the admin
 * has shared (or is about to share) the customer's delivery details with this supplier.
 */
export async function markPurchaseOrdered(poId: string, input: { supplierReference?: string; confirmDataShare: boolean }, actor: Actor) {
  if (!input.confirmDataShare) throw new FulfillmentError("Confirm that you are sharing the customer's delivery details with this supplier.");
  await db().begin(async (tx) => {
    const po = await lockPo(tx, poId);
    if (po.status !== "draft") throw new FulfillmentError("Only draft purchases can be marked as ordered.");
    await tx`update supplier_purchase_orders set status = 'ordered', ordered_at = now(),
               supplier_reference = coalesce(nullif(${input.supplierReference ?? ""}, ''), supplier_reference),
               customer_data_shared_at = now(), customer_data_shared_by = ${actor.id}
             where id = ${poId}`;
    const o = await lockOrder(tx, po.orderId);
    if (["confirmed", "awaiting_supplier_purchase"].includes(o.status)) {
      await transition(tx, po.orderId, o.status, "supplier_ordered", actor, "Order placed with fulfilment partner", true);
    }
    await audit(actor.id, "supplier_po.ordered", "supplier_purchase_order", poId, { orderId: po.orderId, customerDataShared: true }, tx);
  });
}

/** Step 7: supplier confirmed they can fulfil. */
export async function markPurchaseConfirmed(poId: string, actor: Actor) {
  await db().begin(async (tx) => {
    const po = await lockPo(tx, poId);
    if (po.status !== "ordered") throw new FulfillmentError("Only ordered purchases can be confirmed.");
    await tx`update supplier_purchase_orders set status = 'confirmed', confirmed_at = now() where id = ${poId}`;
    const o = await lockOrder(tx, po.orderId);
    if (o.status === "supplier_ordered") await transition(tx, po.orderId, o.status, "supplier_confirmed", actor, "Supplier confirmed availability", false);
    await audit(actor.id, "supplier_po.confirmed", "supplier_purchase_order", poId, {}, tx);
  });
}

export const shipmentSchema = z.object({
  poId: z.uuid().nullable().optional(),
  courier: z.string().trim().min(2).max(80),
  trackingNumber: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9-]+$/, { error: "Letters, numbers and hyphens only" }),
  trackingUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Must be an https:// link" })]).optional().default(""),
  dispatchedAt: z.string().optional(),
  notify: z.boolean().default(true),
});

/** Steps 8–10: dispatch date, courier and tracking; marks the order shipped. */
export async function recordShipment(orderId: string, raw: z.input<typeof shipmentSchema>, actor: Actor) {
  const input = shipmentSchema.parse(raw);
  const dispatched = input.dispatchedAt ? new Date(input.dispatchedAt) : new Date();
  if (Number.isNaN(dispatched.getTime())) throw new FulfillmentError("Invalid dispatch date.");
  const { isUpdate } = await db().begin(async (tx) => {
    const o = await lockOrder(tx, orderId);
    const prior = await tx`select 1 from shipments where order_id = ${orderId}`;
    await tx`insert into shipments (order_id, po_id, courier, tracking_number, tracking_url, shipped_at)
             values (${orderId}, ${input.poId ?? null}, ${input.courier}, ${input.trackingNumber}, ${input.trackingUrl || null}, ${dispatched})`;
    if (input.poId) {
      await tx`update supplier_purchase_orders set status = 'dispatched', dispatched_at = ${dispatched} where id = ${input.poId} and order_id = ${orderId}`;
    }
    if (o.status !== "shipped") {
      await transition(tx, orderId, o.status, "shipped", actor, `Shipped via ${input.courier} (${input.trackingNumber})`, true);
    } else {
      await tx`insert into fulfillment_events (order_id, message, customer_visible, actor_id)
               values (${orderId}, ${`Tracking updated: ${input.courier} ${input.trackingNumber}`}, true, ${actor.id})`;
    }
    await audit(actor.id, "shipment.create", "order", orderId, { courier: input.courier, trackingNumber: input.trackingNumber }, tx);
    return { isUpdate: prior.length > 0 };
  });
  if (input.notify) {
    await notifyCustomer(orderId, {
      kind: isUpdate ? "tracking_update" : "order_dispatched",
      courier: input.courier,
      trackingNumber: input.trackingNumber,
      trackingUrl: input.trackingUrl || null,
    });
  }
}

/** Step 11: problems with a supplier purchase (out of stock, damaged, cancelled by supplier…). */
export async function recordPurchaseIssue(poId: string, issue: string, cancel: boolean, actor: Actor) {
  const text = issue.trim().slice(0, 1000);
  if (text.length < 3) throw new FulfillmentError("Describe the issue.");
  await db().begin(async (tx) => {
    const po = await lockPo(tx, poId);
    await tx`update supplier_purchase_orders set issue = ${text}, status = ${cancel ? "cancelled" : "issue"} where id = ${poId}`;
    await tx`insert into fulfillment_events (order_id, message, actor_id) values (${po.orderId}, ${`Supplier issue: ${text}`}, ${actor.id})`;
    if (cancel) {
      const o = await lockOrder(tx, po.orderId);
      if (["supplier_ordered", "supplier_confirmed"].includes(o.status)) {
        await transition(tx, po.orderId, o.status, "awaiting_supplier_purchase", actor, "Supplier purchase cancelled — needs re-sourcing", false);
      }
    }
    await audit(actor.id, cancel ? "supplier_po.cancel" : "supplier_po.issue", "supplier_purchase_order", poId, { issue: text }, tx);
  });
}

export const poCostSchema = z.object({
  productCostPaise: z.number().int().nonnegative(),
  shippingCostPaise: z.number().int().nonnegative(),
  costsIncludeGst: z.boolean(),
  gstOnCostsPaise: z.number().int().nonnegative(),
  itcEligible: z.boolean(),
  supplierInvoiceNumber: z.string().trim().max(80).optional().default(""),
  costIsActual: z.boolean(),
});

export async function updatePurchaseCosts(poId: string, raw: z.input<typeof poCostSchema>, actor: Actor) {
  const input = poCostSchema.parse(raw);
  await db().begin(async (tx) => {
    const po = await lockPo(tx, poId);
    await tx`update supplier_purchase_orders set product_cost_paise = ${input.productCostPaise}, shipping_cost_paise = ${input.shippingCostPaise},
               costs_include_gst = ${input.costsIncludeGst}, gst_on_costs_paise = ${input.gstOnCostsPaise}, itc_eligible = ${input.itcEligible},
               supplier_invoice_number = ${input.supplierInvoiceNumber || null}, cost_is_actual = ${input.costIsActual}
             where id = ${poId}`;
    await audit(actor.id, "supplier_po.costs", "supplier_purchase_order", poId, { orderId: po.orderId, ...input }, tx);
  });
}

/** Builds the message an admin can copy into WhatsApp/email for the supplier. Only what's needed to ship. */
export async function supplierOrderMessage(poId: string): Promise<string> {
  const rows = await db()<{
    orderNumber: string;
    shippingAddress: { fullName: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string };
    paymentMethod: "razorpay" | "cod";
    paymentStatus: PaymentStatus;
    totalPaise: number;
    supplierReference: string | null;
    supplierName: string;
  }[]>`
    select o.order_number, o.shipping_address, o.payment_method, o.payment_status, o.total_paise, po.supplier_reference, s.name as supplier_name
    from supplier_purchase_orders po join orders o on o.id = po.order_id join suppliers s on s.id = po.supplier_id
    where po.id = ${poId}`;
  const r = rows[0];
  if (!r) throw new FulfillmentError("Supplier purchase not found.");
  const items = await db()<{ productName: string; brandName: string; sizeMl: number | null; concentration: string | null; quantity: number; supplierSku: string | null }[]>`
    select oi.product_name, oi.brand_name, oi.size_ml, oi.concentration, spi.quantity,
      (select supplier_sku from product_supplier_offers pso where pso.product_id = oi.product_id and pso.supplier_id = po.supplier_id) as supplier_sku
    from supplier_po_items spi join order_items oi on oi.id = spi.order_item_id join supplier_purchase_orders po on po.id = spi.po_id
    where spi.po_id = ${poId} order by oi.product_name`;
  const a = r.shippingAddress;
  const lines = [
    `New dispatch request — ref ${r.orderNumber}${r.supplierReference ? ` / ${r.supplierReference}` : ""}`,
    "",
    "Items:",
    ...items.map(
      (i) => `• ${i.brandName} ${i.productName}${i.sizeMl ? ` ${i.sizeMl}ml` : ""}${i.concentration ? ` (${i.concentration})` : ""} × ${i.quantity}${i.supplierSku ? ` — SKU ${i.supplierSku}` : ""}`,
    ),
    "",
    "Ship to:",
    a.fullName,
    a.line1,
    ...(a.line2 ? [a.line2] : []),
    ...(a.landmark ? [`Landmark: ${a.landmark}`] : []),
    `${a.city}, ${a.state} ${a.pincode}`,
    `Phone: ${a.phone}`,
    "",
    r.paymentMethod === "cod" && r.paymentStatus === "cod_pending"
      ? `Payment: CASH ON DELIVERY — collect ${formatINR(r.totalPaise)}`
      : "Payment: PREPAID — do not collect any money from the customer",
    "Please use plain packaging, no invoice with prices inside the parcel, and share the courier name and tracking number once dispatched.",
  ];
  return lines.join("\n");
}

// ------------------------------------------------------------------ refunds and requests

export const refundSchema = z.object({
  amountPaise: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
  requestId: z.uuid().nullable().optional(),
  viaGateway: z.boolean(),
  notify: z.boolean().default(true),
});

export async function recordRefund(orderId: string, raw: z.input<typeof refundSchema>, actor: Actor) {
  const input = refundSchema.parse(raw);
  const prep = await db().begin(async (tx) => {
    const o = await lockOrder(tx, orderId);
    const [{ refunded }] = await tx<{ refunded: number }[]>`
      select coalesce(sum(amount_paise), 0)::int as refunded from refunds where order_id = ${orderId} and status <> 'failed'`;
    const paidAmount = ["paid", "partially_refunded", "cod_collected"].includes(o.paymentStatus) ? o.totalPaise : 0;
    if (paidAmount === 0) throw new FulfillmentError("No captured payment on this order to refund.");
    if (refunded + input.amountPaise > paidAmount) throw new FulfillmentError(`Refunds would exceed the amount paid (${formatINR(paidAmount - refunded)} remaining).`);
    let paymentId: string | null = null;
    if (input.viaGateway) {
      if (o.paymentMethod !== "razorpay") throw new FulfillmentError("COD orders must be refunded manually (bank transfer).");
      const p = await tx<{ providerPaymentId: string }[]>`select provider_payment_id from payments where order_id = ${orderId} and status = 'captured' order by created_at desc limit 1`;
      paymentId = p[0]?.providerPaymentId ?? null;
      if (!paymentId) throw new FulfillmentError("No captured payment found to refund through the gateway.");
    }
    const [ref] = await tx<{ id: string }[]>`
      insert into refunds (order_id, request_id, amount_paise, status, reason, created_by)
      values (${orderId}, ${input.requestId ?? null}, ${input.amountPaise}, ${input.viaGateway ? "pending" : "recorded_manually"}, ${input.reason}, ${actor.id})
      returning id`;
    return { refundId: ref!.id, paymentId, total: o.totalPaise, refundedAfter: refunded + input.amountPaise, status: o.status };
  });

  let refundStatus = input.viaGateway ? "pending" : "recorded_manually";
  if (input.viaGateway && prep.paymentId) {
    const gateway = getGateway();
    try {
      if (!gateway) throw new FulfillmentError("Payment gateway is not configured.");
      const r = await gateway.refund(prep.paymentId, input.amountPaise, { order_id: orderId, reason: input.reason.slice(0, 200) });
      refundStatus = r.status === "processed" ? "processed" : "pending";
      await db()`update refunds set provider_refund_id = ${r.id}, status = ${refundStatus} where id = ${prep.refundId}`;
    } catch (e) {
      await db()`update refunds set status = 'failed' where id = ${prep.refundId}`;
      await audit(actor.id, "refund.failed", "order", orderId, { amountPaise: input.amountPaise, error: e instanceof Error ? e.message : "error" });
      throw new FulfillmentError(`Refund failed at the payment gateway: ${e instanceof Error ? e.message : "unknown error"}. Nothing was refunded.`);
    }
  }

  await db().begin(async (tx) => {
    const full = prep.refundedAfter >= prep.total;
    await tx`update orders set payment_status = ${full ? "refunded" : "partially_refunded"} where id = ${orderId}`;
    const o = await lockOrder(tx, orderId);
    if (full && canTransition(o.status, "refunded")) await transition(tx, orderId, o.status, "refunded", actor, "Order refunded", true);
    else await tx`insert into fulfillment_events (order_id, message, customer_visible, actor_id) values (${orderId}, ${`Refund of ${formatINR(input.amountPaise)} recorded`}, true, ${actor.id})`;
    if (input.requestId) await tx`update order_requests set status = 'completed' where id = ${input.requestId}`;
    await audit(actor.id, "refund.create", "order", orderId, { amountPaise: input.amountPaise, viaGateway: input.viaGateway, status: refundStatus }, tx);
  });

  if (input.notify) await notifyCustomer(orderId, { kind: "refund_status", amountPaise: input.amountPaise, status: refundStatus, viaGateway: input.viaGateway });
  return { refundId: prep.refundId, status: refundStatus };
}

export async function resolveRequest(requestId: string, decision: "approved" | "rejected", note: string, actor: Actor) {
  await db().begin(async (tx) => {
    const rows = await tx<{ orderId: string; type: string; status: string }[]>`select order_id, type, status from order_requests where id = ${requestId} for update`;
    const r = rows[0];
    if (!r) throw new FulfillmentError("Request not found.");
    if (r.status !== "requested") throw new FulfillmentError("This request has already been resolved.");
    await tx`update order_requests set status = ${decision}, admin_note = ${note || null} where id = ${requestId}`;
    const o = await lockOrder(tx, r.orderId);
    if (r.type === "cancellation") {
      if (decision === "approved") {
        await transition(tx, r.orderId, o.status, "cancelled", actor, note || "Cancellation approved", true);
        if (o.discountCode && !["paid", "cod_collected"].includes(o.paymentStatus)) await releaseDiscountUse(o.discountCode, tx);
      } else if (o.status === "cancellation_requested") {
        const prev = await tx<{ fromStatus: OrderStatus }[]>`
          select from_status from fulfillment_events where order_id = ${r.orderId} and to_status = 'cancellation_requested' order by created_at desc limit 1`;
        await transition(tx, r.orderId, o.status, prev[0]?.fromStatus ?? "confirmed", actor, note || "Cancellation request declined", true);
      }
    }
    if (r.type === "return") {
      if (decision === "rejected" && o.status === "return_requested") await transition(tx, r.orderId, o.status, "delivered", actor, note || "Return request declined", true);
      if (decision === "approved") await tx`insert into fulfillment_events (order_id, message, customer_visible, actor_id) values (${r.orderId}, ${note || "Return approved — we'll be in touch with next steps"}, true, ${actor.id})`;
    }
    await audit(actor.id, `request.${decision}`, "order_request", requestId, { orderId: r.orderId, type: r.type, note }, tx);
    return { orderId: r.orderId, type: r.type, paymentStatus: o.paymentStatus };
  }).then(async (res) => {
    if (res.type === "cancellation" && decision === "approved") {
      await notifyCustomer(res.orderId, { kind: "cancellation", reason: note || null, refundExpected: ["paid", "partially_refunded"].includes(res.paymentStatus) });
    }
  });
}

export async function markCodCollected(orderId: string, actor: Actor) {
  await db().begin(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (o.paymentMethod !== "cod" || o.paymentStatus !== "cod_pending") throw new FulfillmentError("Only pending COD orders can be marked collected.");
    await tx`update orders set payment_status = 'cod_collected', paid_at = now() where id = ${orderId}`;
    await tx`insert into payments (order_id, provider, amount_paise, status, method) values (${orderId}, 'cod', ${o.totalPaise}, 'collected', 'cod')`;
    await tx`insert into fulfillment_events (order_id, message, actor_id) values (${orderId}, 'COD amount collected', ${actor.id})`;
    await audit(actor.id, "order.cod_collected", "order", orderId, {}, tx);
  });
}
