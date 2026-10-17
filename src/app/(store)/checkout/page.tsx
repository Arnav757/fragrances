import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { randomUUID } from "node:crypto";
import { Container } from "@/components/ui/misc";
import { CheckoutForm, type SavedAddress } from "@/components/store/checkout-form";
import { CheckoutSteps } from "@/components/store/checkout-steps";
import { OrderTotals } from "@/components/store/order-summary";
import { getCartId, quoteCartById } from "@/lib/services/cart";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { getGateway } from "@/lib/payments/gateway";
import { formatINR } from "@/lib/money";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [cartId, user, commerce] = await Promise.all([getCartId(), getCurrentUser(), getSettings("commerce")]);
  const quote = await quoteCartById(cartId, { paymentMethod: "razorpay" }, undefined, commerce);
  if (!quote.lines.length || !quote.canCheckout) redirect("/cart");
  const codQuote = commerce.codEnabled ? await quoteCartById(cartId, { paymentMethod: "cod" }, undefined, commerce) : null;
  const codOk = !!codQuote && !codQuote.issues.some((i) => i.blocking);
  const addresses = user
    ? await db()<SavedAddress[]>`select id, label, full_name, phone, line1, line2, landmark, city, state, pincode, is_default from addresses where user_id = ${user.id} order by is_default desc, created_at desc`
    : [];
  const p = quote.pricing;

  return (
    <Container className="py-10 lg:py-14">
      <CheckoutSteps current={1} />
      <h1 className="mt-6 text-4xl text-ink sm:text-5xl">Checkout</h1>
      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_400px]">
        <CheckoutForm
          idempotencyKey={randomUUID()}
          totals={{ razorpay: p.totalPaise, cod: codOk ? codQuote!.pricing.totalPaise : null }}
          codEnabled={commerce.codEnabled}
          codUnavailableReason={commerce.codEnabled ? (codQuote?.issues.find((i) => i.blocking)?.message ?? null) : "Cash on delivery isn't offered at the moment."}
          onlineAvailable={!!getGateway()}
          user={user ? { email: user.email, fullName: user.fullName, phone: user.phone } : null}
          addresses={addresses}
        />
        <aside className="h-fit border border-line bg-paper p-6 lg:sticky lg:top-28" aria-label="Order summary">
          <h2 className="eyebrow mb-5 text-ink">In your order</h2>
          <ul className="mb-6 space-y-4">
            {quote.lines.map((l) => (
              <li key={l.productId} className="flex gap-3">
                <div className="relative h-16 w-13 shrink-0 overflow-hidden bg-sand">
                  {l.imageUrl && <Image src={l.imageUrl} alt="" fill sizes="52px" className="object-cover" />}
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[0.625rem] text-paper">{l.quantity}</span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate text-ink">
                    {l.brandName} {l.name}
                  </p>
                  <p className="text-xs text-stone">{[l.concentration, l.sizeMl ? `${l.sizeMl} ml` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="text-sm tabular-nums">{formatINR(l.unitPricePaise * l.quantity)}</p>
              </li>
            ))}
          </ul>
          <OrderTotals pricing={p} discountCode={quote.discountCode} />
          {codOk && commerce.codFeePaise > 0 && <p className="mt-3 text-xs text-stone">Cash on delivery adds {formatINR(commerce.codFeePaise)}.</p>}
        </aside>
      </div>
    </Container>
  );
}
