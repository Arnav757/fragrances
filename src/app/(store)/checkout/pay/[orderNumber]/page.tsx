import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Container, Notice } from "@/components/ui/misc";
import { CheckoutSteps } from "@/components/store/checkout-steps";
import { PayPanel } from "@/components/store/pay-panel";
import { OrderTotals } from "@/components/store/order-summary";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/services/orders";
import { canViewOrder, guestOrderToken } from "@/lib/services/order-access";
import { getGateway } from "@/lib/payments/gateway";
import { formatINR } from "@/lib/money";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

type Props = { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ t?: string }> };

export default async function PayPage({ params, searchParams }: Props) {
  const [{ orderNumber }, { t }, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const order = await getOrderDetail({ orderNumber });
  if (!order || !canViewOrder(order, { user, guestToken: t ?? null })) {
    if (!user && order?.userId) redirect(`/login?next=/checkout/pay/${orderNumber}`);
    notFound();
  }
  const orderUrl = order.userId ? `/account/orders/${order.orderNumber}` : `/order/${order.orderNumber}?t=${guestOrderToken(order.id)}`;
  if (order.paymentMethod !== "razorpay" || !["pending", "failed", "authorized"].includes(order.paymentStatus) || !["awaiting_payment", "payment_failed"].includes(order.status)) {
    redirect(orderUrl);
  }
  const gateway = getGateway();

  return (
    <Container size="narrow" className="py-10 lg:py-14">
      <CheckoutSteps current={2} />
      <h1 className="mt-6 text-4xl text-ink">Complete your payment</h1>
      <p className="mt-2 text-sm text-stone">
        Order <strong className="font-medium text-ink">{order.orderNumber}</strong> is reserved. Pay {formatINR(order.totalPaise)} to confirm it.
      </p>
      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_300px]">
        <div>
          {order.paymentStatus === "authorized" ? (
            <Notice title="Payment received — awaiting confirmation">
              Your payment has been authorised and is being confirmed with Razorpay. This page will update once it&apos;s captured. Please don&apos;t pay again.
            </Notice>
          ) : gateway ? (
            <PayPanel orderNumber={order.orderNumber} token={order.userId ? null : (t ?? null)} totalPaise={order.totalPaise} mode={gateway.provider} failed={order.paymentStatus === "failed"} />
          ) : (
            <Notice tone="warning" title="Online payment unavailable">
              Online payments aren&apos;t configured for this store yet. Please contact support with your order number.
            </Notice>
          )}
          <ButtonLink href={orderUrl} variant="link" className="mt-6">
            View order details
          </ButtonLink>
        </div>
        <aside className="border border-line bg-paper p-5">
          <ul className="mb-4 space-y-2 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="text-charcoal">
                  {i.brandName} {i.productName} × {i.quantity}
                </span>
                <span className="tabular-nums">{formatINR(i.lineGrossPaise)}</span>
              </li>
            ))}
          </ul>
          <OrderTotals pricing={order} discountCode={order.discountCode} />
        </aside>
      </div>
    </Container>
  );
}
