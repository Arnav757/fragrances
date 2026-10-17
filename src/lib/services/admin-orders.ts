import "server-only";
import { db, type Queryable } from "../db";
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "../order-status";

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  contactName: string;
  contactEmail: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "razorpay" | "cod";
  totalPaise: number;
  itemCount: number;
  createdAt: Date;
  supplierCostPaise: number | null;
  openRequests: number;
};

export async function adminListOrders(
  f: { q?: string; status?: string; payment?: string; from?: string; to?: string; page?: number },
  q: Queryable = db(),
) {
  const pageSize = 50;
  const page = Math.max(1, f.page ?? 1);
  const like = f.q ? `%${f.q.trim().replace(/[%_\\]/g, (m) => "\\" + m)}%` : null;
  const status = f.status && (ORDER_STATUSES as readonly string[]).includes(f.status) ? f.status : null;
  const payment = f.payment && (PAYMENT_STATUSES as readonly string[]).includes(f.payment) ? f.payment : null;
  const from = f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from) ? f.from : null;
  const to = f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to) ? f.to : null;
  const where = q`true
    ${like ? q`and (o.order_number ilike ${like} or o.contact_name ilike ${like} or o.contact_email ilike ${like} or o.contact_phone ilike ${like})` : q``}
    ${status ? q`and o.status = ${status}` : q``}
    ${payment ? q`and o.payment_status = ${payment}` : q``}
    ${from ? q`and o.created_at >= ${from}::date` : q``}
    ${to ? q`and o.created_at < ${to}::date + 1` : q``}`;
  const [count] = await q<{ n: number }[]>`select count(*)::int as n from orders o where ${where}`;
  const rows = await q<AdminOrderRow[]>`
    select o.id, o.order_number, o.contact_name, o.contact_email, o.status, o.payment_status, o.payment_method, o.total_paise, o.created_at,
      (select coalesce(sum(quantity), 0)::int from order_items where order_id = o.id) as item_count,
      (select sum(product_cost_paise + shipping_cost_paise)::int from supplier_purchase_orders where order_id = o.id and status <> 'cancelled') as supplier_cost_paise,
      (select count(*)::int from order_requests r where r.order_id = o.id and r.status = 'requested') as open_requests
    from orders o where ${where}
    order by o.created_at desc
    limit ${pageSize} offset ${(page - 1) * pageSize}`;
  return { rows, total: count?.n ?? 0, page, pageCount: Math.max(1, Math.ceil((count?.n ?? 0) / pageSize)) };
}

export async function adminOrderExtras(orderId: string, q: Queryable = db()) {
  const [purchases, payments, poItems, internal, offers] = await Promise.all([
    q<{
      id: string;
      supplierId: string;
      supplierName: string;
      supplierReference: string | null;
      status: string;
      productCostPaise: number;
      shippingCostPaise: number;
      costsIncludeGst: boolean;
      gstOnCostsPaise: number;
      itcEligible: boolean;
      supplierInvoiceNumber: string | null;
      costIsActual: boolean;
      customerDataSharedAt: Date | null;
      orderedAt: Date | null;
      confirmedAt: Date | null;
      dispatchedAt: Date | null;
      issue: string | null;
      notes: string | null;
      createdAt: Date;
    }[]>`
      select po.id, po.supplier_id, s.name as supplier_name, po.supplier_reference, po.status, po.product_cost_paise, po.shipping_cost_paise,
        po.costs_include_gst, po.gst_on_costs_paise, po.itc_eligible, po.supplier_invoice_number, po.cost_is_actual, po.customer_data_shared_at,
        po.ordered_at, po.confirmed_at, po.dispatched_at, po.issue, po.notes, po.created_at
      from supplier_purchase_orders po join suppliers s on s.id = po.supplier_id where po.order_id = ${orderId} order by po.created_at`,
    q<{ id: string; provider: string; providerPaymentId: string | null; amountPaise: number; status: string; method: string | null; feePaise: number | null; errorDescription: string | null; createdAt: Date }[]>`
      select id, provider, provider_payment_id, amount_paise, status, method, fee_paise, error_description, created_at from payments where order_id = ${orderId} order by created_at`,
    q<{ poId: string; orderItemId: string; quantity: number; unitCostPaise: number }[]>`
      select spi.po_id, spi.order_item_id, spi.quantity, spi.unit_cost_paise from supplier_po_items spi
      join supplier_purchase_orders po on po.id = spi.po_id where po.order_id = ${orderId}`,
    q<{ internalNotes: string | null }[]>`select internal_notes from orders where id = ${orderId}`,
    q<{ productId: string; supplierId: string; supplierName: string; costPaise: number | null; supplierSku: string | null; isPreferred: boolean; lastConfirmedAt: Date | null; availability: string }[]>`
      select o.product_id, o.supplier_id, s.name as supplier_name, o.cost_paise, o.supplier_sku, o.is_preferred, o.last_confirmed_at, p.availability
      from product_supplier_offers o join suppliers s on s.id = o.supplier_id join products p on p.id = o.product_id
      where o.product_id in (select product_id from order_items where order_id = ${orderId}) and s.is_active`,
  ]);
  return { purchases, payments, poItems, internalNotes: internal[0]?.internalNotes ?? null, offers };
}

export async function exportOrdersRows(from: string | null, to: string | null, q: Queryable = db()) {
  return q<Record<string, unknown>[]>`
    select o.order_number, o.created_at, o.status, o.payment_method, o.payment_status, o.contact_name, o.contact_email, o.contact_phone,
      o.shipping_address->>'city' as city, o.shipping_address->>'state' as state, o.shipping_address->>'pincode' as pincode,
      round(o.subtotal_paise / 100.0, 2) as subtotal_inr, round(o.discount_paise / 100.0, 2) as discount_inr, o.discount_code,
      round(o.shipping_paise / 100.0, 2) as shipping_inr, round(o.cod_fee_paise / 100.0, 2) as cod_fee_inr,
      round(o.taxable_value_paise / 100.0, 2) as taxable_value_inr, round(o.cgst_paise / 100.0, 2) as cgst_inr, round(o.sgst_paise / 100.0, 2) as sgst_inr,
      round(o.igst_paise / 100.0, 2) as igst_inr, round(o.total_paise / 100.0, 2) as total_inr, o.place_of_supply,
      (select string_agg(oi.brand_name || ' ' || oi.product_name || ' x' || oi.quantity, '; ') from order_items oi where oi.order_id = o.id) as items,
      (select round(sum(product_cost_paise + shipping_cost_paise) / 100.0, 2) from supplier_purchase_orders po where po.order_id = o.id and po.status <> 'cancelled') as supplier_cost_inr,
      (select round(sum(fee_paise) / 100.0, 2) from payments p where p.order_id = o.id) as gateway_fee_inr,
      (select round(sum(amount_paise) / 100.0, 2) from refunds r where r.order_id = o.id and r.status <> 'failed') as refunded_inr,
      (select string_agg(courier || ' ' || tracking_number, '; ') from shipments s where s.order_id = o.id) as tracking
    from orders o
    where (${from}::date is null or o.created_at >= ${from}::date) and (${to}::date is null or o.created_at < ${to}::date + 1)
    order by o.created_at`;
}
