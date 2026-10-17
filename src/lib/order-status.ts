export const ORDER_STATUSES = [
  "awaiting_payment",
  "payment_failed",
  "confirmed",
  "awaiting_supplier_purchase",
  "supplier_ordered",
  "supplier_confirmed",
  "shipped",
  "delivered",
  "cancellation_requested",
  "cancelled",
  "return_requested",
  "returned",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "paid",
  "failed",
  "cod_pending",
  "cod_collected",
  "refunded",
  "partially_refunded",
  "cancelled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  payment_failed: "Payment failed",
  confirmed: "Confirmed",
  awaiting_supplier_purchase: "Preparing your order",
  supplier_ordered: "Preparing your order",
  supplier_confirmed: "Ready to dispatch",
  shipped: "Shipped",
  delivered: "Delivered",
  cancellation_requested: "Cancellation requested",
  cancelled: "Cancelled",
  return_requested: "Return requested",
  returned: "Returned",
  refunded: "Refunded",
};

/** Admin-facing labels (customers never see supplier-specific wording). */
export const ADMIN_STATUS_LABEL: Record<OrderStatus, string> = {
  ...STATUS_LABEL,
  awaiting_supplier_purchase: "Awaiting supplier purchase",
  supplier_ordered: "Supplier ordered",
  supplier_confirmed: "Supplier confirmed",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  authorized: "Authorised",
  paid: "Paid",
  failed: "Failed",
  cod_pending: "Cash on delivery — to be collected",
  cod_collected: "Cash on delivery — collected",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  cancelled: "Cancelled",
};

/**
 * Allowed manual/automatic transitions. Orders do not all follow the same path: cancellations,
 * returns and refunds can branch off at the appropriate points.
 */
export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  awaiting_payment: ["confirmed", "payment_failed", "cancelled"],
  payment_failed: ["confirmed", "cancelled", "awaiting_payment"],
  confirmed: ["awaiting_supplier_purchase", "supplier_ordered", "cancellation_requested", "cancelled"],
  awaiting_supplier_purchase: ["supplier_ordered", "cancellation_requested", "cancelled"],
  supplier_ordered: ["supplier_confirmed", "shipped", "awaiting_supplier_purchase", "cancellation_requested", "cancelled"],
  supplier_confirmed: ["shipped", "awaiting_supplier_purchase", "cancellation_requested", "cancelled"],
  shipped: ["delivered", "return_requested", "returned"],
  delivered: ["return_requested", "returned", "refunded"],
  cancellation_requested: ["cancelled", "confirmed", "awaiting_supplier_purchase", "supplier_ordered", "supplier_confirmed"],
  cancelled: ["refunded"],
  return_requested: ["returned", "delivered", "refunded"],
  returned: ["refunded"],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses from which a customer may request cancellation (before dispatch). */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = [
  "awaiting_payment",
  "payment_failed",
  "confirmed",
  "awaiting_supplier_purchase",
  "supplier_ordered",
  "supplier_confirmed",
];

/** Statuses from which a customer may request a return. */
export const CUSTOMER_RETURNABLE: readonly OrderStatus[] = ["delivered"];

/** Statuses that count as revenue-bearing (money received or COD order active). */
export const ACTIVE_FULFILMENT: readonly OrderStatus[] = [
  "confirmed",
  "awaiting_supplier_purchase",
  "supplier_ordered",
  "supplier_confirmed",
];

/** Customer-facing progress steps. */
export const CUSTOMER_PROGRESS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "placed", label: "Order placed", statuses: ["confirmed"] },
  { key: "preparing", label: "Preparing", statuses: ["awaiting_supplier_purchase", "supplier_ordered", "supplier_confirmed"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
];

export function progressIndex(status: OrderStatus): number {
  return CUSTOMER_PROGRESS.findIndex((s) => s.statuses.includes(status));
}
