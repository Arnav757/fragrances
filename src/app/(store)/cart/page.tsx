import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { Container, EmptyState, Notice } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { CartLines, DiscountForm } from "@/components/store/cart-view";
import { OrderTotals } from "@/components/store/order-summary";
import { quoteCurrentCart } from "@/lib/services/cart";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const [quote, commerce] = await Promise.all([quoteCurrentCart(), getSettings("commerce")]);
  if (!quote.lines.length) {
    return (
      <Container size="narrow" className="py-20">
        <h1 className="sr-only">Your cart</h1>
        <EmptyState
          icon={<ShoppingBag className="h-8 w-8" strokeWidth={1.2} />}
          title="Your cart is empty"
          description="Discover authentic Middle Eastern perfumes and clearly labelled inspired fragrances."
          action={<ButtonLink href="/shop">Continue shopping</ButtonLink>}
        />
      </Container>
    );
  }
  const p = quote.pricing;
  const gap =
    commerce.freeShippingThresholdPaise !== null && p.shippingPaise > 0 ? commerce.freeShippingThresholdPaise - (p.subtotalPaise - p.discountPaise) : null;

  return (
    <Container className="py-10 lg:py-14">
      <h1 className="text-4xl text-ink sm:text-5xl">Your cart</h1>
      <p className="mt-2 text-sm text-stone">
        {quote.itemCount} item{quote.itemCount === 1 ? "" : "s"}
      </p>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <CartLines lines={quote.lines} issues={quote.issues} />
        <aside className="h-fit border border-line bg-paper p-6 lg:sticky lg:top-28" aria-label="Order summary">
          <h2 className="eyebrow mb-4 text-ink">Order summary</h2>
          <div className="mb-5">
            <DiscountForm appliedCode={quote.discountCode} error={quote.discountError} />
          </div>
          <OrderTotals pricing={p} discountCode={quote.discountCode} freeShippingGapPaise={gap && gap > 0 ? gap : null} />
          <p className="mt-3 text-xs text-stone">Final shipping and tax are confirmed at checkout based on your delivery address.</p>
          {quote.canCheckout ? (
            <ButtonLink href="/checkout" className="mt-6 w-full" size="lg">
              Checkout
            </ButtonLink>
          ) : (
            <Notice tone="danger" className="mt-6">
              Please resolve the issues in your cart to continue.
            </Notice>
          )}
          <ButtonLink href="/shop" variant="link" className="mt-4 w-full">
            Continue shopping
          </ButtonLink>
        </aside>
      </div>
    </Container>
  );
}
