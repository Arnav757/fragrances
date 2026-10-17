import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/services/orders";
import { OrderView } from "@/components/store/order-view";
import { getSettings } from "@/lib/settings";
import { integrationStatus } from "@/lib/env";
import { Breadcrumbs } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

export default async function AccountOrderPage({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { orderNumber } = await params;
  const { placed } = await searchParams;
  const user = await requireUser(`/account/orders/${orderNumber}`);
  const order = await getOrderDetail({ orderNumber });
  // Customers may only ever see their own orders (admins use /admin).
  if (!order || order.userId !== user.id) notFound();
  const commerce = await getSettings("commerce");
  return (
    <div>
      <div className="mb-6">
        <Breadcrumbs items={[{ label: "Orders", href: "/account/orders" }, { label: order.orderNumber }]} />
      </div>
      <OrderView order={order} token={null} justPlaced={placed === "1"} canReview returnWindowDays={commerce.returnWindowDays} emailConfigured={integrationStatus().email.configured} />
    </div>
  );
}
