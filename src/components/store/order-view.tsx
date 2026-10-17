import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { OrderDetail } from "@/lib/services/orders";
import { CUSTOMER_CANCELLABLE, CUSTOMER_PROGRESS, PAYMENT_LABEL, STATUS_LABEL, progressIndex } from "@/lib/order-status";
import { formatINR } from "@/lib/money";
import { formatDate, cn } from "@/lib/utils";
import { Badge, Notice } from "../ui/misc";
import { ButtonLink } from "../ui/button";
import { OrderTotals } from "./order-summary";
import { RequestForm, ReviewForm } from "./order-actions";

export function OrderView({ order, token, justPlaced, canReview, returnWindowDays, emailConfigured = false }: { order: OrderDetail; token: string | null; justPlaced?: boolean; canReview: boolean; returnWindowDays: number; emailConfigured?: boolean }) {
  const idx = progressIndex(order.status);
  const needsPayment = order.paymentMethod === "razorpay" && ["pending", "failed"].includes(order.paymentStatus) && ["awaiting_payment", "payment_failed"].includes(order.status);
  const payHref = `/checkout/pay/${order.orderNumber}${token ? `?t=${token}` : ""}`;
  const openRequest = (type: string) => order.requests.some((r) => r.type === type && r.status === "requested");
  const a = order.shippingAddress;
  const confirmed = !["awaiting_payment", "payment_failed", "cancelled"].includes(order.status);

  return (
    <div>
      {justPlaced && confirmed && (
        <div className="mb-10 flex flex-col items-center border border-line bg-paper px-6 py-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={1.2} />
          <h1 className="mt-4 text-4xl text-ink">Thank you for your order</h1>
          <p className="mt-2 max-w-md text-sm text-stone">
            Order <strong className="text-ink">{order.orderNumber}</strong> is confirmed.{" "}
            {emailConfigured ? `A confirmation has been emailed to ${order.contactEmail}, and we'll email tracking details when it ships.` : "Bookmark this page to check its status — tracking details will appear here when it ships."}
          </p>
        </div>
      )}
      {!justPlaced || !confirmed ? (
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Order</p>
            <h1 className="mt-1 text-4xl text-ink">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-stone">Placed {formatDate(order.createdAt, true)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={order.status === "cancelled" || order.status === "payment_failed" ? "danger" : order.status === "delivered" ? "success" : "neutral"}>{STATUS_LABEL[order.status]}</Badge>
            <Badge tone="outline">Payment: {PAYMENT_LABEL[order.paymentStatus]}</Badge>
          </div>
        </div>
      ) : null}

      {needsPayment && (
        <Notice tone="warning" title={order.paymentStatus === "failed" ? "Payment didn't go through" : "Payment pending"} className="mb-8">
          <p>This order isn&apos;t confirmed until payment is complete.</p>
          <ButtonLink href={payHref} size="sm" className="mt-3">
            {order.paymentStatus === "failed" ? "Retry payment" : "Complete payment"}
          </ButtonLink>
        </Notice>
      )}

      {idx >= 0 && (
        <ol className="mb-10 grid grid-cols-4 gap-2" aria-label="Order progress">
          {CUSTOMER_PROGRESS.map((s, i) => (
            <li key={s.key} aria-current={i === idx ? "step" : undefined}>
              <div className={cn("h-1", i <= idx ? "bg-ink" : "bg-line")} />
              <p className={cn("mt-2 text-[0.6875rem] tracking-wide uppercase", i <= idx ? "text-ink" : "text-mist")}>{s.label}</p>
            </li>
          ))}
        </ol>
      )}

      {order.shipments.length > 0 && (
        <section className="mb-10 border border-line bg-paper p-5">
          <h2 className="eyebrow mb-3 text-ink">Tracking</h2>
          <ul className="space-y-3 text-sm">
            {order.shipments.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {s.courier} · <span className="font-medium">{s.trackingNumber}</span>
                  <span className="text-stone"> · shipped {formatDate(s.shippedAt)}</span>
                </span>
                {s.trackingUrl && (
                  <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2">
                    Track on courier site
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <section aria-label="Items">
          <ul className="divide-y divide-line border-y border-line">
            {order.items.map((i) => (
              <li key={i.id} className="py-5">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="eyebrow text-[0.625rem]">{i.brandName}</p>
                    {i.productSlug ? (
                      <Link href={`/products/${i.productSlug}`} className="font-display text-xl text-ink hover:underline">
                        {i.productName}
                      </Link>
                    ) : (
                      <p className="font-display text-xl text-ink">{i.productName}</p>
                    )}
                    <p className="text-xs text-stone">
                      {[i.concentration, i.sizeMl ? `${i.sizeMl} ml` : null, `Qty ${i.quantity}`, i.productType === "inspired_fragrance" ? "Inspired fragrance" : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">{formatINR(i.lineGrossPaise)}</p>
                </div>
                {canReview && order.status === "delivered" && <div className="mt-2"><ReviewForm orderItemId={i.id} productName={i.productName} /></div>}
              </li>
            ))}
          </ul>

          {order.events.length > 0 && (
            <section className="mt-10">
              <h2 className="eyebrow mb-4 text-ink">Updates</h2>
              <ol className="space-y-3 border-l border-line pl-5">
                {[...order.events].reverse().map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[23px] h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
                    <p className="text-charcoal">{e.message}</p>
                    <p className="text-xs text-stone">{formatDate(e.createdAt, true)}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {order.requests.length > 0 && (
            <section className="mt-10">
              <h2 className="eyebrow mb-4 text-ink">Your requests</h2>
              <ul className="space-y-2 text-sm">
                {order.requests.map((r) => (
                  <li key={r.id} className="border border-line bg-paper p-3">
                    <span className="capitalize">{r.type}</span> request — <span className="capitalize">{r.status}</span>
                    {r.adminNote && <p className="mt-1 text-xs text-stone">{r.adminNote}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            {CUSTOMER_CANCELLABLE.includes(order.status) && !openRequest("cancellation") && (
              <RequestForm
                orderNumber={order.orderNumber}
                token={token}
                type="cancellation"
                label={needsPayment ? "Cancel order" : "Request cancellation"}
                description={needsPayment ? "No payment has been taken, so the order will be cancelled immediately." : "We'll cancel and refund your order if it hasn't been dispatched yet."}
              />
            )}
            {order.status === "delivered" && !openRequest("return") && (
              <RequestForm
                orderNumber={order.orderNumber}
                token={token}
                type="return"
                label="Request a return"
                description={`Returns are accepted for damaged, defective or incorrect items within ${returnWindowDays} days of delivery. Please describe the problem; we may ask for photos.`}
              />
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="border border-line bg-paper p-5">
            <h2 className="eyebrow mb-4 text-ink">Summary</h2>
            <OrderTotals pricing={order} discountCode={order.discountCode} />
            <p className="mt-4 text-xs text-stone">
              {order.paymentMethod === "cod" ? "Cash on delivery" : "Paid online via Razorpay"} · {PAYMENT_LABEL[order.paymentStatus]}
            </p>
            {order.refunds.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <span>Refund ({r.status.replace("_", " ")})</span>
                    <span>{formatINR(r.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border border-line bg-paper p-5 text-sm leading-relaxed">
            <h2 className="eyebrow mb-3 text-ink">Delivering to</h2>
            <p>
              {a.fullName}
              <br />
              {a.line1}
              {a.line2 && (
                <>
                  <br />
                  {a.line2}
                </>
              )}
              <br />
              {a.city}, {a.state} {a.pincode}
            </p>
          </div>
          <p className="text-xs text-stone">
            Need help? <Link href="/contact" className="underline underline-offset-2">Contact us</Link> and quote {order.orderNumber}.
          </p>
        </aside>
      </div>
    </div>
  );
}
