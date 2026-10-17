import "server-only";
import { db, type Queryable } from "../db";

export type FinancialReport = {
  from: Date;
  to: Date;
  orderCount: number;
  grossSalesPaise: number; // amount charged to customers, incl. tax (net of refunds below)
  outputTaxPaise: number;
  revenueExTaxPaise: number;
  refundsPaise: number;
  refundsExTaxPaise: number;
  discountsPaise: number; // informational: already deducted from revenue
  productCostPaise: number;
  costsExRecoverableGstPaise: number;
  supplierShippingPaise: number;
  costGstNotRecoverablePaise: number;
  paymentFeesPaise: number;
  expensesPaise: number;
  contributionPaise: number;
  ordersMissingCosts: number;
  ordersWithEstimatedCosts: number;
  paymentsMissingFees: number;
};

/**
 * Estimated contribution before overhead and income tax:
 *   revenue excluding output GST (net of refunds, discounts already deducted)
 *   − product cost (supplier purchase cost, excluding GST that is ITC-eligible)
 *   − supplier shipping borne by the store
 *   − payment gateway fees (fee + GST on fee)
 *   − other recorded expenses (advertising etc., excluding ITC-eligible GST)
 *
 * Cost basis: supplier purchase orders recorded on each order (actual when marked "actual", otherwise
 * the catalogue estimate entered at purchase time). Orders without any purchase cost are counted in
 * `ordersMissingCosts` and contribute zero cost — so the figure is overstated for them.
 */
export async function financialReport(from: Date, to: Date, q: Queryable = db()): Promise<FinancialReport> {
  const [rev] = await q<{ n: number; gross: number; tax: number; disc: number }[]>`
    select count(*)::int as n, coalesce(sum(total_paise), 0)::bigint::float8 as gross, coalesce(sum(tax_paise), 0)::float8 as tax,
      coalesce(sum(discount_paise), 0)::float8 as disc
    from orders
    where created_at >= ${from} and created_at < ${to}
      and (payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected'))`;

  const [ref] = await q<{ amt: number; exTax: number }[]>`
    select coalesce(sum(r.amount_paise), 0)::float8 as amt,
      coalesce(sum(round(r.amount_paise::numeric * o.taxable_value_paise / nullif(o.total_paise, 0))), 0)::float8 as ex_tax
    from refunds r join orders o on o.id = r.order_id
    where r.status <> 'failed' and o.created_at >= ${from} and o.created_at < ${to}`;

  const [cost] = await q<{ product: number; ship: number; gstNonRec: number; productExGst: number; estimated: number }[]>`
    select
      coalesce(sum(po.product_cost_paise), 0)::float8 as product,
      coalesce(sum(po.shipping_cost_paise), 0)::float8 as ship,
      coalesce(sum(case when po.itc_eligible then 0 when po.costs_include_gst then 0 else po.gst_on_costs_paise end), 0)::float8 as gst_non_rec,
      coalesce(sum(case when po.itc_eligible and po.costs_include_gst then po.product_cost_paise + po.shipping_cost_paise - po.gst_on_costs_paise
                        else po.product_cost_paise + po.shipping_cost_paise end), 0)::float8 as product_ex_gst,
      count(distinct case when not po.cost_is_actual then po.order_id end)::int as estimated
    from supplier_purchase_orders po join orders o on o.id = po.order_id
    where po.status <> 'cancelled' and o.created_at >= ${from} and o.created_at < ${to}
      and o.payment_status in ('paid', 'partially_refunded', 'refunded', 'cod_collected')`;

  const [missing] = await q<{ n: number }[]>`
    select count(*)::int as n from orders o
    where o.created_at >= ${from} and o.created_at < ${to}
      and o.payment_status in ('paid', 'partially_refunded', 'cod_collected')
      and not exists (select 1 from supplier_purchase_orders po where po.order_id = o.id and po.status <> 'cancelled')`;

  const [fees] = await q<{ fees: number; missing: number }[]>`
    select coalesce(sum(coalesce(p.fee_paise, 0)), 0)::float8 as fees,
      count(*) filter (where p.fee_paise is null and p.provider = 'razorpay')::int as missing
    from payments p join orders o on o.id = p.order_id
    where p.status = 'captured' and o.created_at >= ${from} and o.created_at < ${to}`;

  const [exp] = await q<{ amt: number }[]>`
    select coalesce(sum(amount_paise - case when itc_eligible then gst_paise else 0 end), 0)::float8 as amt
    from expenses where incurred_on >= ${from} and incurred_on < ${to}`;

  const gross = rev!.gross;
  const tax = rev!.tax;
  const revenueExTax = gross - tax - ref!.exTax;
  // Product + shipping cost excluding recoverable GST; non-recoverable GST added back separately.
  const productAndShipExGst = cost!.productExGst;
  const contribution = revenueExTax - productAndShipExGst - cost!.gstNonRec - fees!.fees - exp!.amt;

  return {
    from,
    to,
    orderCount: rev!.n,
    grossSalesPaise: gross,
    outputTaxPaise: tax,
    revenueExTaxPaise: revenueExTax,
    refundsPaise: ref!.amt,
    refundsExTaxPaise: ref!.exTax,
    discountsPaise: rev!.disc,
    productCostPaise: cost!.product,
    costsExRecoverableGstPaise: productAndShipExGst,
    supplierShippingPaise: cost!.ship,
    costGstNotRecoverablePaise: cost!.gstNonRec,
    paymentFeesPaise: fees!.fees,
    expensesPaise: exp!.amt,
    contributionPaise: Math.round(contribution),
    ordersMissingCosts: missing!.n,
    ordersWithEstimatedCosts: cost!.estimated,
    paymentsMissingFees: fees!.missing,
  };
}

export async function dashboardStats(q: Queryable = db()) {
  const [s] = await q<{
    total: number;
    paid: number;
    pendingFulfilment: number;
    cancelled: number;
    revenue: number;
    revenueExTax: number;
    recordedCosts: number;
    awaitingPayment: number;
  }[]>`
    select
      count(*)::int as total,
      count(*) filter (where payment_status in ('paid', 'cod_collected', 'partially_refunded'))::int as paid,
      count(*) filter (where status in ('confirmed', 'awaiting_supplier_purchase', 'supplier_ordered', 'supplier_confirmed'))::int as pending_fulfilment,
      count(*) filter (where status = 'cancelled')::int as cancelled,
      coalesce(sum(total_paise) filter (where payment_status in ('paid', 'cod_collected', 'partially_refunded')), 0)::float8 as revenue,
      coalesce(sum(taxable_value_paise) filter (where payment_status in ('paid', 'cod_collected', 'partially_refunded')), 0)::float8 as revenue_ex_tax,
      (select coalesce(sum(product_cost_paise + shipping_cost_paise), 0)::float8 from supplier_purchase_orders where status <> 'cancelled') as recorded_costs,
      count(*) filter (where status = 'awaiting_payment')::int as awaiting_payment
    from orders`;
  return s!;
}

export async function ordersNeedingAction(q: Queryable = db()) {
  return q<{ id: string; orderNumber: string; status: string; paymentStatus: string; totalPaise: number; createdAt: Date; reason: string }[]>`
    select id, order_number, status, payment_status, total_paise, created_at,
      case
        when status = 'cancelled' and payment_status = 'paid' then 'Paid but cancelled — refund needed'
        when status = 'cancellation_requested' then 'Cancellation requested'
        when status = 'return_requested' then 'Return requested'
        when status = 'confirmed' then 'Purchase from supplier'
        when status = 'awaiting_supplier_purchase' then 'Place supplier order'
        when status = 'supplier_ordered' then 'Awaiting supplier confirmation'
        when status = 'supplier_confirmed' then 'Add tracking when dispatched'
        when payment_status = 'authorized' then 'Payment authorised — check capture'
        else 'Review'
      end as reason
    from orders
    where status in ('confirmed', 'awaiting_supplier_purchase', 'supplier_ordered', 'supplier_confirmed', 'cancellation_requested', 'return_requested')
       or (status = 'cancelled' and payment_status = 'paid')
       or payment_status = 'authorized'
       or exists (select 1 from order_requests r where r.order_id = orders.id and r.status = 'requested')
    order by created_at asc
    limit 50`;
}
