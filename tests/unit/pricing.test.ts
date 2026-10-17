import { describe, expect, it } from "vitest";
import { allocate, computeDiscount, priceOrder, taxOn, type PricingInput } from "@/lib/pricing";

const base: PricingInput = {
  lines: [{ productId: "a", unitPricePaise: 129900, quantity: 1, taxRateBp: 1800 }],
  discount: null,
  shipping: { flatRatePaise: 9900, freeShippingThresholdPaise: 199900 },
  codFeePaise: 0,
  pricesIncludeTax: true,
  chargesTaxRateBp: null,
  sellerState: "Karnataka",
  placeOfSupplyState: "Karnataka",
};

describe("taxOn", () => {
  it("extracts tax from tax-inclusive amounts", () => {
    expect(taxOn(11800, 1800, true)).toEqual({ taxable: 10000, tax: 1800 });
  });
  it("adds tax to exclusive amounts", () => {
    expect(taxOn(10000, 1800, false)).toEqual({ taxable: 10000, tax: 1800 });
  });
  it("handles zero rates and zero amounts", () => {
    expect(taxOn(5000, 0, true)).toEqual({ taxable: 5000, tax: 0 });
    expect(taxOn(0, 1800, true)).toEqual({ taxable: 0, tax: 0 });
  });
  it("rejects fractional paise", () => {
    expect(() => taxOn(10.5, 1800, true)).toThrow();
  });
});

describe("allocate", () => {
  it("allocates exactly, with no rounding loss", () => {
    const parts = allocate(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });
  it("is proportional", () => {
    expect(allocate(300, [100, 200])).toEqual([100, 200]);
  });
});

describe("computeDiscount", () => {
  const pct = { code: "TEN", type: "percent" as const, value: 1000, minSubtotalPaise: 0, maxDiscountPaise: 30000 };
  it("applies percent with cap", () => {
    expect(computeDiscount(129900, pct).amount).toBe(12990);
    expect(computeDiscount(1000000, pct).amount).toBe(30000);
  });
  it("respects minimum order", () => {
    const r = computeDiscount(50000, { ...pct, minSubtotalPaise: 100000 });
    expect(r.amount).toBe(0);
    expect(r.error).toMatch(/minimum/);
  });
  it("never discounts more than the subtotal", () => {
    expect(computeDiscount(5000, { code: "BIG", type: "fixed", value: 99999, minSubtotalPaise: 0, maxDiscountPaise: null }).amount).toBe(5000);
  });
});

describe("priceOrder", () => {
  it("prices a tax-inclusive order with flat shipping", () => {
    const r = priceOrder(base);
    expect(r.subtotalPaise).toBe(129900);
    expect(r.shippingPaise).toBe(9900);
    expect(r.totalPaise).toBe(139800);
    // GST contained in 1299 + 99 at 18%
    expect(r.taxPaise).toBe(129900 - Math.round(129900 * 10000 / 11800) + (9900 - Math.round(9900 * 10000 / 11800)));
    expect(r.taxableValuePaise + r.taxPaise).toBe(r.totalPaise);
  });

  it("gives free shipping at the threshold, measured after discount", () => {
    const r = priceOrder({ ...base, lines: [{ ...base.lines[0]!, quantity: 2 }] });
    expect(r.shippingPaise).toBe(0);
    const d = priceOrder({ ...base, lines: [{ ...base.lines[0]!, unitPricePaise: 200000 }], discount: { code: "X", type: "fixed", value: 5000, minSubtotalPaise: 0, maxDiscountPaise: null } });
    expect(d.shippingPaise).toBe(9900); // 2000 - 50 = 1950 < 1999
  });

  it("splits CGST/SGST intra-state and IGST inter-state", () => {
    const intra = priceOrder(base);
    expect(intra.intraState).toBe(true);
    expect(intra.cgstPaise + intra.sgstPaise).toBe(intra.taxPaise);
    expect(intra.igstPaise).toBe(0);
    const inter = priceOrder({ ...base, placeOfSupplyState: "Maharashtra" });
    expect(inter.intraState).toBe(false);
    expect(inter.igstPaise).toBe(inter.taxPaise);
    expect(inter.totalPaise).toBe(intra.totalPaise);
  });

  it("adds GST on top for tax-exclusive pricing", () => {
    const r = priceOrder({ ...base, pricesIncludeTax: false });
    expect(r.taxPaise).toBe(Math.round(129900 * 0.18) + Math.round(9900 * 0.18));
    expect(r.totalPaise).toBe(129900 + 9900 + r.taxPaise);
  });

  it("allocates discounts across lines before tax and keeps totals consistent", () => {
    const r = priceOrder({
      ...base,
      lines: [
        { productId: "a", unitPricePaise: 129900, quantity: 1, taxRateBp: 1800 },
        { productId: "b", unitPricePaise: 89900, quantity: 2, taxRateBp: 1200 },
      ],
      discount: { code: "TEN", type: "percent", value: 1000, minSubtotalPaise: 0, maxDiscountPaise: null },
    });
    expect(r.discountPaise).toBe(Math.floor(309700 * 0.1));
    expect(r.lines.reduce((a, l) => a + l.discountAllocPaise, 0)).toBe(r.discountPaise);
    expect(r.taxableValuePaise + r.taxPaise).toBe(r.totalPaise);
    // charges taxed at the highest item rate by default
    expect(r.shippingPaise).toBe(0);
  });

  it("adds a COD fee when given", () => {
    const r = priceOrder({ ...base, codFeePaise: 4900 });
    expect(r.totalPaise).toBe(139800 + 4900);
  });

  it("returns zero for an empty cart", () => {
    const r = priceOrder({ ...base, lines: [] });
    expect(r.totalPaise).toBe(0);
    expect(r.shippingPaise).toBe(0);
  });

  it("rejects invalid quantities", () => {
    expect(() => priceOrder({ ...base, lines: [{ ...base.lines[0]!, quantity: 0 }] })).toThrow();
  });
});
