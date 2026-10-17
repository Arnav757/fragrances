import "server-only";
import { db, type Queryable, type Tx } from "../db";
import { checkoutSchema, type CheckoutInput, type AddressInput } from "../validation";
import { getSettings } from "../settings";
import { quoteCartById, type CartIssue } from "./cart";
import { releaseDiscountUse, reserveDiscountUse } from "./discounts";
import { getGateway } from "../payments/gateway";
import { notifyCustomer } from "./notify";
import { CUSTOMER_CANCELLABLE, CUSTOMER_RETURNABLE, type OrderStatus, type PaymentStatus } from "../order-status";
import type { SessionUser } from "../auth/session";
import type { ProductType } from "@/config/brand";

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly issues: CartIssue[] = [],
    readonly newTotalPaise: number | null = null,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type CreatedOrder = { id: string; orderNumber: string; paymentMethod: "razorpay" | "cod"; replayed: boolean };

function addressJson(a: AddressInput) {
  return {
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 || "",
    landmark: a.landmark || "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
  };
}

/**
 * Creates an order from the server-side cart. Prices, discounts, shipping and tax are recalculated
 * here from the database — nothing the browser sends about money is trusted except `expectedTotalPaise`,
 * which is only used to detect that the price changed while the customer was on the checkout page.
 * Idempotent on `idempotencyKey`.
 */
export async function createOrder(raw: CheckoutInput, ctx: { user: SessionUser | null; cartId: string | null }): Promise<CreatedOrder> {
  const input = checkoutSchema.parse(raw);
  const sql = db();

  const existing = await sql<{ id: string; orderNumber: string; paymentMethod: "razorpay" | "cod"; userId: string | null }[]>`
    select id, order_number, payment_method, user_id from orders where idempotency_key = ${input.idempotencyKey}`;
  if (existing[0]) {
    if ((existing[0].userId ?? null) !== (ctx.user?.id ?? null)) throw new CheckoutError("This checkout session is no longer valid. Please reload.");
    return { ...existing[0], replayed: true };
  }

  if (!ctx.cartId) throw new CheckoutError("Your cart is empty.");
  if (input.paymentMethod === "razorpay" && !getGateway()) {
    throw new CheckoutError("Online payment isn't available yet. Please choose another payment method or contact us.");
  }

  const commerce = await getSettings("commerce");

  const result = await sql.begin(async (tx) => {
    // Serialise checkouts of the same cart.
    await tx`select id from carts where id = ${ctx.cartId} for update`;
    const quote = await quoteCartById(ctx.cartId, { paymentMethod: input.paymentMethod, placeOfSupplyState: input.shipping.state }, tx, commerce);
    if (!quote.canCheckout) {
      throw new CheckoutError(quote.issues.find((i) => i.blocking)?.message ?? "Your cart can't be checked out.", quote.issues);
    }
    const p = quote.pricing;
    if (p.totalPaise !== input.expectedTotalPaise) {
      throw new CheckoutError("Your order total has changed. Please review the updated total before paying.", quote.issues, p.totalPaise);
    }
    if (quote.discountCode) {
      const ok = await reserveDiscountUse(quote.discountCode, tx);
      if (!ok) throw new CheckoutError("That discount code has just reached its usage limit. Please review your total.", [], null);
    }

    const [seq] = await tx<{ n: string }[]>`select nextval('order_number_seq')::text as n`;
    const orderNumber = `NN-${seq!.n}`;
    const isCod = input.paymentMethod === "cod";
    const status: OrderStatus = isCod ? "confirmed" : "awaiting_payment";
    const paymentStatus: PaymentStatus = isCod ? "cod_pending" : "pending";

    const inserted = await tx<{ id: string }[]>`
      insert into orders (
        order_number, user_id, idempotency_key, cart_id, contact_name, contact_email, contact_phone,
        shipping_address, billing_address, customer_notes, payment_method, payment_status, status,
        subtotal_paise, discount_paise, discount_code, shipping_paise, cod_fee_paise, taxable_value_paise, tax_paise,
        cgst_paise, sgst_paise, igst_paise, total_paise, prices_include_tax, tax_config_verified, seller_state, place_of_supply
      ) values (
        ${orderNumber}, ${ctx.user?.id ?? null}, ${input.idempotencyKey}, ${ctx.cartId}, ${input.contactName}, ${input.email}, ${input.phone},
        ${tx.json(addressJson(input.shipping))}, ${input.billingSameAsShipping || !input.billing ? null : tx.json(addressJson(input.billing))},
        ${input.notes || null}, ${input.paymentMethod}, ${paymentStatus}, ${status},
        ${p.subtotalPaise}, ${p.discountPaise}, ${quote.discountCode}, ${p.shippingPaise}, ${p.codFeePaise}, ${p.taxableValuePaise}, ${p.taxPaise},
        ${p.cgstPaise}, ${p.sgstPaise}, ${p.igstPaise}, ${p.totalPaise}, ${p.pricesIncludeTax},
        ${commerce.taxConfigVerified && quote.lines.every((l) => l.taxClassVerified)}, ${commerce.sellerState}, ${input.shipping.state}
      )
      on conflict (idempotency_key) do nothing
      returning id`;
    if (!inserted[0]) return null; // concurrent replay; handled below
    const orderId = inserted[0].id;

    const lineByProduct = new Map(quote.lines.map((l) => [l.productId, l]));
    for (const pl of p.lines) {
      const l = lineByProduct.get(pl.productId)!;
      await tx`
        insert into order_items (order_id, product_id, product_name, product_slug, brand_name, product_type, size_ml, concentration,
          unit_price_paise, quantity, line_gross_paise, discount_alloc_paise, taxable_value_paise, tax_rate_bp, tax_paise,
          hsn_code, tax_class_name, image_url)
        values (${orderId}, ${l.productId}, ${l.name}, ${l.slug}, ${l.brandName}, ${l.productType}, ${l.sizeMl}, ${l.concentration},
          ${pl.unitPricePaise}, ${pl.quantity}, ${pl.lineGrossPaise}, ${pl.discountAllocPaise}, ${pl.taxableValuePaise}, ${pl.taxRateBp}, ${pl.taxPaise},
          ${l.hsnCode}, ${l.taxClassName}, ${l.imageUrl})`;
    }

    await tx`insert into fulfillment_events (order_id, to_status, message, customer_visible)
             values (${orderId}, ${status}, ${isCod ? "Order placed (cash on delivery)" : "Order created — awaiting payment"}, true)`;

    if (isCod) await clearCart(ctx.cartId!, tx);

    if (ctx.user && input.saveAddress) {
      const s = addressJson(input.shipping);
      const dup = await tx`select 1 from addresses where user_id = ${ctx.user.id} and line1 = ${s.line1} and pincode = ${s.pincode}`;
      if (!dup.length) {
        const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from addresses where user_id = ${ctx.user.id}`;
        await tx`insert into addresses (user_id, full_name, phone, line1, line2, landmark, city, state, pincode, is_default)
                 values (${ctx.user.id}, ${s.fullName}, ${s.phone}, ${s.line1}, ${s.line2 || null}, ${s.landmark || null}, ${s.city}, ${s.state}, ${s.pincode}, ${n === 0})`;
      }
    }
    return { id: orderId, orderNumber, paymentMethod: input.paymentMethod, replayed: false } as CreatedOrder;
  });

  if (!result) {
    const again = await sql<{ id: string; orderNumber: string; paymentMethod: "razorpay" | "cod" }[]>`
      select id, order_number, payment_method from orders where idempotency_key = ${input.idempotencyKey}`;
    return { ...again[0]!, replayed: true };
  }

  if (result.paymentMethod === "cod") await notifyCustomer(result.id, { kind: "order_confirmation" });
  return result;
}

export async function clearCart(cartId: string, q: Queryable) {
  await q`delete from cart_items where cart_id = ${cartId}`;
  await q`update carts set discount_code = null where id = ${cartId}`;
}

// ------------------------------------------------------------------ reading orders

export type Address = ReturnType<typeof addressJson>;

export type OrderSummary = {
  id: string;
  orderNumber: string;
  userId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "razorpay" | "cod";
  totalPaise: number;
  createdAt: Date;
  itemCount: number;
};

export type OrderDetail = OrderSummary & {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  shippingAddress: Address;
  billingAddress: Address | null;
  customerNotes: string | null;
  subtotalPaise: number;
  discountPaise: number;
  discountCode: string | null;
  shippingPaise: number;
  codFeePaise: number;
  taxableValuePaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  pricesIncludeTax: boolean;
  razorpayOrderId: string | null;
  paidAt: Date | null;
  deliveredAt: Date | null;
  items: {
    id: string;
    productId: string | null;
    productName: string;
    productSlug: string | null;
    brandName: string;
    productType: ProductType;
    sizeMl: number | null;
    concentration: string | null;
    unitPricePaise: number;
    quantity: number;
    lineGrossPaise: number;
    discountAllocPaise: number;
    taxRateBp: number;
    taxPaise: number;
    hsnCode: string | null;
    imageUrl: string | null;
  }[];
  shipments: { id: string; courier: string; trackingNumber: string; trackingUrl: string | null; shippedAt: Date; deliveredAt: Date | null }[];
  events: { id: string; toStatus: OrderStatus | null; message: string | null; createdAt: Date }[];
  requests: { id: string; type: string; status: string; reason: string; adminNote: string | null; createdAt: Date }[];
  refunds: { id: string; amountPaise: number; status: string; createdAt: Date }[];
};

export async function getOrderDetail(where: { id?: string; orderNumber?: string }, q: Queryable = db(), opts: { customerView: boolean } = { customerView: true }) {
  const rows = await q<Omit<OrderDetail, "items" | "shipments" | "events" | "requests" | "refunds">[]>`
    select o.id, o.order_number, o.user_id, o.status, o.payment_status, o.payment_method, o.total_paise, o.created_at,
      (select coalesce(sum(quantity), 0)::int from order_items where order_id = o.id) as item_count,
      o.contact_name, o.contact_email, o.contact_phone, o.shipping_address, o.billing_address, o.customer_notes,
      o.subtotal_paise, o.discount_paise, o.discount_code, o.shipping_paise, o.cod_fee_paise, o.taxable_value_paise, o.tax_paise,
      o.cgst_paise, o.sgst_paise, o.igst_paise, o.prices_include_tax, o.razorpay_order_id, o.paid_at, o.delivered_at
    from orders o
    where ${where.id ? q`o.id = ${where.id}` : q`o.order_number = ${where.orderNumber ?? ""}`}`;
  const o = rows[0];
  if (!o) return null;
  const [items, shipments, events, requests, refunds] = await Promise.all([
    q<OrderDetail["items"]>`select id, product_id, product_name, product_slug, brand_name, product_type, size_ml, concentration,
        unit_price_paise, quantity, line_gross_paise, discount_alloc_paise, tax_rate_bp, tax_paise, hsn_code, image_url
        from order_items where order_id = ${o.id} order by product_name`,
    q<OrderDetail["shipments"]>`select id, courier, tracking_number, tracking_url, shipped_at, delivered_at from shipments where order_id = ${o.id} order by shipped_at`,
    q<OrderDetail["events"]>`select id, to_status, message, created_at from fulfillment_events
        where order_id = ${o.id} ${opts.customerView ? q`and customer_visible` : q``} order by created_at`,
    q<OrderDetail["requests"]>`select id, type, status, reason, admin_note, created_at from order_requests where order_id = ${o.id} order by created_at`,
    q<OrderDetail["refunds"]>`select id, amount_paise, status, created_at from refunds where order_id = ${o.id} order by created_at`,
  ]);
  return { ...o, items, shipments, events, requests, refunds } as OrderDetail;
}

export async function listOrdersForUser(userId: string, q: Queryable = db()): Promise<OrderSummary[]> {
  return q<OrderSummary[]>`
    select o.id, o.order_number, o.user_id, o.status, o.payment_status, o.payment_method, o.total_paise, o.created_at,
      (select coalesce(sum(quantity), 0)::int from order_items where order_id = o.id) as item_count
    from orders o where o.user_id = ${userId} order by o.created_at desc limit 100`;
}

// ------------------------------------------------------------------ customer requests

export class RequestError extends Error {}

/**
 * Customer cancellation / return request. Unpaid online orders are cancelled immediately; anything
 * that involves money or a supplier purchase goes to the admin as a request.
 */
export async function createCustomerRequest(
  orderId: string,
  userId: string | null,
  type: "cancellation" | "return" | "refund",
  reason: string,
): Promise<{ outcome: "cancelled" | "requested" }> {
  const sql = db();
  const commerce = await getSettings("commerce");
  const outcome = await sql.begin(async (tx) => {
    const rows = await tx<{ status: OrderStatus; paymentStatus: PaymentStatus; deliveredAt: Date | null; discountCode: string | null }[]>`
      select status, payment_status, delivered_at, discount_code from orders where id = ${orderId} for update`;
    const o = rows[0];
    if (!o) throw new RequestError("Order not found.");

    if (type === "cancellation") {
      if (!CUSTOMER_CANCELLABLE.includes(o.status)) throw new RequestError("This order can no longer be cancelled online. Please contact support.");
      if (o.status === "awaiting_payment" || o.status === "payment_failed") {
        if (o.paymentStatus === "paid" || o.paymentStatus === "authorized") throw new RequestError("Payment is being processed. Please contact support.");
        await tx`update orders set status = 'cancelled', payment_status = 'cancelled', cancelled_at = now() where id = ${orderId}`;
        await tx`insert into fulfillment_events (order_id, from_status, to_status, message, customer_visible, actor_id)
                 values (${orderId}, ${o.status}, 'cancelled', 'Cancelled by customer before payment', true, ${userId})`;
        if (o.discountCode) await releaseDiscountUse(o.discountCode, tx);
        return "cancelled" as const;
      }
      await tx`insert into order_requests (order_id, user_id, type, reason) values (${orderId}, ${userId}, 'cancellation', ${reason})
               on conflict do nothing`;
      await tx`update orders set status = 'cancellation_requested' where id = ${orderId}`;
      await tx`insert into fulfillment_events (order_id, from_status, to_status, message, customer_visible, actor_id)
               values (${orderId}, ${o.status}, 'cancellation_requested', 'Cancellation requested by customer', true, ${userId})`;
      return "requested" as const;
    }

    if (type === "return") {
      if (!CUSTOMER_RETURNABLE.includes(o.status)) throw new RequestError("Returns can be requested once an order has been delivered.");
      const deliveredAt = o.deliveredAt?.getTime() ?? 0;
      if (deliveredAt && Date.now() - deliveredAt > commerce.returnWindowDays * 86400_000) {
        throw new RequestError(`The ${commerce.returnWindowDays}-day return window for this order has passed. Please contact support.`);
      }
      await tx`insert into order_requests (order_id, user_id, type, reason) values (${orderId}, ${userId}, 'return', ${reason})`;
      await tx`update orders set status = 'return_requested' where id = ${orderId}`;
      await tx`insert into fulfillment_events (order_id, from_status, to_status, message, customer_visible, actor_id)
               values (${orderId}, ${o.status}, 'return_requested', 'Return requested by customer', true, ${userId})`;
      return "requested" as const;
    }

    if (!["paid", "partially_refunded", "cod_collected"].includes(o.paymentStatus)) throw new RequestError("There is no payment on this order to refund.");
    await tx`insert into order_requests (order_id, user_id, type, reason) values (${orderId}, ${userId}, 'refund', ${reason})`;
    await tx`insert into fulfillment_events (order_id, message, customer_visible, actor_id)
             values (${orderId}, 'Refund requested by customer', true, ${userId})`;
    return "requested" as const;
  }).catch((e: unknown) => {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505") {
      throw new RequestError("You already have an open request of this type for this order.");
    }
    throw e;
  });

  if (outcome === "cancelled") await notifyCustomer(orderId, { kind: "cancellation", reason: "Cancelled at your request", refundExpected: false });
  return { outcome };
}

// ------------------------------------------------------------------ maintenance

/** Cancel online orders that were never paid within the configured window, releasing discount uses. */
export async function expireStaleOrders(q: Tx | ReturnType<typeof db> = db()): Promise<number> {
  const commerce = await getSettings("commerce");
  const rows = await q<{ id: string; discountCode: string | null }[]>`
    update orders set status = 'cancelled', payment_status = 'cancelled', cancelled_at = now()
    where status in ('awaiting_payment', 'payment_failed') and payment_status in ('pending', 'failed')
      and created_at < now() - make_interval(hours => ${commerce.pendingOrderExpiryHours})
    returning id, discount_code`;
  for (const r of rows) {
    await q`insert into fulfillment_events (order_id, to_status, message, customer_visible)
            values (${r.id}, 'cancelled', 'Cancelled automatically — payment not completed', true)`;
    if (r.discountCode) await releaseDiscountUse(r.discountCode, q);
  }
  return rows.length;
}
