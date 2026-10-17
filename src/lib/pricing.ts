/**
 * Pure pricing engine. Used for the cart display AND (authoritatively) on the server when an order is
 * created. All amounts are integer paise; rates are basis points (1800 = 18%).
 *
 * GST model (configurable, must be validated by the business's tax adviser before live use):
 *  - Product prices are either tax-inclusive (Indian retail default) or tax-exclusive.
 *  - Discounts reduce the value of supply and are allocated across lines pro rata before tax.
 *  - Shipping and COD fees charged to the customer are taxed at `chargesTaxRateBp`; by default the
 *    caller passes the highest item rate (composite supply), but this is a setting, not a rule.
 *  - Intra-state supplies split tax into CGST + SGST; inter-state supplies use IGST.
 */

export type PricingLineInput = {
  productId: string;
  unitPricePaise: number;
  quantity: number;
  taxRateBp: number;
};

export type DiscountRule = {
  code: string;
  type: "percent" | "fixed";
  value: number; // percent: basis points; fixed: paise
  minSubtotalPaise: number;
  maxDiscountPaise: number | null;
};

export type ShippingRule = {
  flatRatePaise: number;
  freeShippingThresholdPaise: number | null; // null = never free
};

export type PricingInput = {
  lines: PricingLineInput[];
  discount: DiscountRule | null;
  shipping: ShippingRule;
  codFeePaise: number; // 0 when not COD
  pricesIncludeTax: boolean;
  chargesTaxRateBp: number | null; // null => highest line rate
  sellerState: string | null;
  placeOfSupplyState: string | null;
};

export type PricedLine = PricingLineInput & {
  lineGrossPaise: number;
  discountAllocPaise: number;
  taxableValuePaise: number;
  taxPaise: number;
};

export type PricingResult = {
  lines: PricedLine[];
  subtotalPaise: number;
  discountPaise: number;
  discountCode: string | null;
  discountError: string | null;
  shippingPaise: number;
  codFeePaise: number;
  taxableValuePaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  pricesIncludeTax: boolean;
  intraState: boolean | null; // null when seller state / place of supply unknown
};

function assertInt(n: number, name: string) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
}

/** Tax contained in, or charged on, an amount. */
export function taxOn(amountPaise: number, rateBp: number, inclusive: boolean): { taxable: number; tax: number } {
  assertInt(amountPaise, "amount");
  assertInt(rateBp, "rate");
  if (rateBp === 0 || amountPaise === 0) return { taxable: amountPaise, tax: 0 };
  if (inclusive) {
    const taxable = Math.round((amountPaise * 10000) / (10000 + rateBp));
    return { taxable, tax: amountPaise - taxable };
  }
  return { taxable: amountPaise, tax: Math.round((amountPaise * rateBp) / 10000) };
}

/** Allocate `amount` across `weights` proportionally using the largest-remainder method (sums exactly). */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (amount === 0 || total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const floors = raw.map(Math.floor);
  let remainder = amount - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors;
}

export function computeDiscount(subtotalPaise: number, rule: DiscountRule | null): { amount: number; error: string | null } {
  if (!rule) return { amount: 0, error: null };
  if (subtotalPaise < rule.minSubtotalPaise) {
    return { amount: 0, error: `This code needs a minimum order of ₹${(rule.minSubtotalPaise / 100).toLocaleString("en-IN")}.` };
  }
  let amount = rule.type === "percent" ? Math.floor((subtotalPaise * rule.value) / 10000) : rule.value;
  if (rule.maxDiscountPaise !== null) amount = Math.min(amount, rule.maxDiscountPaise);
  amount = Math.min(amount, subtotalPaise);
  return { amount, error: null };
}

export function normaliseState(s: string | null | undefined): string | null {
  return s ? s.trim().toLowerCase() : null;
}

export function priceOrder(input: PricingInput): PricingResult {
  for (const l of input.lines) {
    assertInt(l.unitPricePaise, "unitPricePaise");
    assertInt(l.taxRateBp, "taxRateBp");
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new Error("quantity must be a positive integer");
  }
  const grosses = input.lines.map((l) => l.unitPricePaise * l.quantity);
  const subtotalPaise = grosses.reduce((a, b) => a + b, 0);

  const { amount: discountPaise, error: discountError } = computeDiscount(subtotalPaise, input.discount);
  const allocs = allocate(discountPaise, grosses);

  const inclusive = input.pricesIncludeTax;
  const lines: PricedLine[] = input.lines.map((l, i) => {
    const net = grosses[i] - allocs[i];
    const { taxable, tax } = taxOn(net, l.taxRateBp, inclusive);
    return { ...l, lineGrossPaise: grosses[i], discountAllocPaise: allocs[i], taxableValuePaise: taxable, taxPaise: tax };
  });

  const afterDiscount = subtotalPaise - discountPaise;
  const threshold = input.shipping.freeShippingThresholdPaise;
  const shippingPaise =
    input.lines.length === 0 ? 0 : threshold !== null && afterDiscount >= threshold ? 0 : input.shipping.flatRatePaise;
  const codFeePaise = input.lines.length === 0 ? 0 : input.codFeePaise;

  const chargesRate =
    input.chargesTaxRateBp ?? (input.lines.length ? Math.max(...input.lines.map((l) => l.taxRateBp)) : 0);
  const shipTax = taxOn(shippingPaise, chargesRate, inclusive);
  const codTax = taxOn(codFeePaise, chargesRate, inclusive);

  const taxPaise = lines.reduce((a, l) => a + l.taxPaise, 0) + shipTax.tax + codTax.tax;
  const taxableValuePaise = lines.reduce((a, l) => a + l.taxableValuePaise, 0) + shipTax.taxable + codTax.taxable;

  const seller = normaliseState(input.sellerState);
  const pos = normaliseState(input.placeOfSupplyState);
  const intraState = seller && pos ? seller === pos : null;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  if (intraState) {
    cgstPaise = Math.floor(taxPaise / 2);
    sgstPaise = taxPaise - cgstPaise;
  } else {
    igstPaise = taxPaise;
  }

  const totalPaise = afterDiscount + shippingPaise + codFeePaise + (inclusive ? 0 : taxPaise);

  return {
    lines,
    subtotalPaise,
    discountPaise,
    discountCode: discountPaise > 0 && input.discount ? input.discount.code : null,
    discountError,
    shippingPaise,
    codFeePaise,
    taxableValuePaise,
    taxPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise,
    pricesIncludeTax: inclusive,
    intraState,
  };
}
