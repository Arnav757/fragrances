import { formatINR } from "@/lib/money";
import type { PricingResult } from "@/lib/pricing";

export function OrderTotals({
  pricing,
  discountCode,
  shippingLabel,
  freeShippingGapPaise,
}: {
  pricing: Pick<PricingResult, "subtotalPaise" | "discountPaise" | "shippingPaise" | "codFeePaise" | "taxPaise" | "totalPaise" | "pricesIncludeTax">;
  discountCode?: string | null;
  shippingLabel?: string;
  freeShippingGapPaise?: number | null;
}) {
  const row = "flex justify-between gap-4 py-1.5";
  return (
    <dl className="text-sm">
      <div className={row}>
        <dt className="text-stone">Subtotal</dt>
        <dd className="tabular-nums">{formatINR(pricing.subtotalPaise)}</dd>
      </div>
      {pricing.discountPaise > 0 && (
        <div className={row}>
          <dt className="text-stone">Discount{discountCode ? ` (${discountCode})` : ""}</dt>
          <dd className="text-success tabular-nums">−{formatINR(pricing.discountPaise)}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-stone">{shippingLabel ?? "Shipping"}</dt>
        <dd className="tabular-nums">{pricing.shippingPaise ? formatINR(pricing.shippingPaise) : "Free"}</dd>
      </div>
      {freeShippingGapPaise ? (
        <p className="pb-1 text-xs text-stone">Add {formatINR(freeShippingGapPaise)} more for free shipping.</p>
      ) : null}
      {pricing.codFeePaise > 0 && (
        <div className={row}>
          <dt className="text-stone">Cash on delivery fee</dt>
          <dd className="tabular-nums">{formatINR(pricing.codFeePaise)}</dd>
        </div>
      )}
      {!pricing.pricesIncludeTax && (
        <div className={row}>
          <dt className="text-stone">GST</dt>
          <dd className="tabular-nums">{formatINR(pricing.taxPaise)}</dd>
        </div>
      )}
      <div className="mt-2 flex justify-between gap-4 border-t border-line pt-4 text-base">
        <dt className="font-medium text-ink">Total</dt>
        <dd className="font-medium text-ink tabular-nums">{formatINR(pricing.totalPaise)}</dd>
      </div>
      {pricing.pricesIncludeTax && pricing.taxPaise > 0 && (
        <p className="mt-1 text-right text-xs text-stone">Includes {formatINR(pricing.taxPaise)} GST</p>
      )}
    </dl>
  );
}
