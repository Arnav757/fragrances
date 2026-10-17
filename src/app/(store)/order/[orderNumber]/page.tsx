import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/ui/misc";
import { CheckoutSteps } from "@/components/store/checkout-steps";
import { OrderView } from "@/components/store/order-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/services/orders";
import { canViewOrder } from "@/lib/services/order-access";
import { getSettings } from "@/lib/settings";
import { integrationStatus } from "@/lib/env";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

type Props = { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ t?: string }> };

/** Order confirmation / status page. Guests access it with the signed link from checkout and emails. */
export default async function OrderPage({ params, searchParams }: Props) {
  const [{ orderNumber }, { t }, user, commerce] = await Promise.all([params, searchParams, getCurrentUser(), getSettings("commerce")]);
  const order = await getOrderDetail({ orderNumber });
  if (!order) notFound();
  if (order.userId) {
    if (!user) redirect(`/login?next=/account/orders/${orderNumber}`);
    if (user.id === order.userId) redirect(`/account/orders/${orderNumber}?placed=1`);
  }
  if (!canViewOrder(order, { user, guestToken: t ?? null })) notFound();
  return (
    <Container className="py-10 lg:py-14">
      <div className="mb-8">
        <CheckoutSteps current={3} />
      </div>
      <OrderView order={order} token={order.userId ? null : (t ?? null)} justPlaced canReview={false} returnWindowDays={commerce.returnWindowDays} emailConfigured={integrationStatus().email.configured} />
    </Container>
  );
}
