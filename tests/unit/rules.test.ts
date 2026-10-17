import { describe, expect, it } from "vitest";
import { canTransition, TRANSITIONS, ORDER_STATUSES, CUSTOMER_CANCELLABLE } from "@/lib/order-status";
import { checkoutSchema, phoneSchema, pincodeSchema, productSchema } from "@/lib/validation";
import { checkPincodeRules } from "@/lib/shipping";
import { commerceSettingsSchema } from "@/lib/settings";
import { csvSafe } from "@/lib/csv";
import { checkoutSignature, verifyWebhookSignature } from "@/lib/payments/gateway";
import { hmacSha256Hex } from "@/lib/auth/crypto";
import { sniffImageType } from "@/lib/storage";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { parseShopParams } from "@/lib/shop-params";
import { checkoutInput } from "../helpers";

describe("order status transitions", () => {
  it("follows the supplier fulfilment path", () => {
    const path = ["awaiting_payment", "confirmed", "awaiting_supplier_purchase", "supplier_ordered", "supplier_confirmed", "shipped", "delivered"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });
  it("blocks impossible jumps", () => {
    expect(canTransition("awaiting_payment", "shipped")).toBe(false);
    expect(canTransition("delivered", "awaiting_payment")).toBe(false);
    expect(canTransition("refunded", "confirmed")).toBe(false);
    expect(canTransition("shipped", "cancelled")).toBe(false);
  });
  it("allows cancellation/refund branches", () => {
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("cancelled", "refunded")).toBe(true);
    expect(canTransition("delivered", "return_requested")).toBe(true);
  });
  it("defines transitions for every status and customers can't cancel after dispatch", () => {
    for (const s of ORDER_STATUSES) expect(TRANSITIONS[s]).toBeDefined();
    expect(CUSTOMER_CANCELLABLE).not.toContain("shipped");
  });
});

describe("validation", () => {
  it("normalises Indian mobile numbers", () => {
    expect(phoneSchema.parse("+91 98765-43210")).toBe("9876543210");
    expect(phoneSchema.parse("09876543210")).toBe("9876543210");
    expect(phoneSchema.safeParse("12345").success).toBe(false);
    expect(phoneSchema.safeParse("5876543210").success).toBe(false);
  });
  it("validates PIN codes", () => {
    expect(pincodeSchema.safeParse("560001").success).toBe(true);
    expect(pincodeSchema.safeParse("060001").success).toBe(false);
    expect(pincodeSchema.safeParse("56001").success).toBe(false);
  });
  it("requires terms acceptance, a valid state and a billing address when different", () => {
    expect(checkoutSchema.safeParse(checkoutInput()).success).toBe(true);
    expect(checkoutSchema.safeParse(checkoutInput({ acceptTerms: false as unknown as true })).success).toBe(false);
    expect(checkoutSchema.safeParse(checkoutInput({ shipping: { ...checkoutInput().shipping, state: "Atlantis" as never } })).success).toBe(false);
    expect(checkoutSchema.safeParse(checkoutInput({ billingSameAsShipping: false })).success).toBe(false);
  });
  it("rejects MRP below price and unverifiable MRP", () => {
    const p = { name: "Test Scent", slug: "test-scent", brandId: crypto.randomUUID(), productType: "authentic_branded", availability: "available", isActive: true, sellingPricePaise: 1000 };
    expect(productSchema.safeParse({ ...p, mrpPaise: 500 }).success).toBe(false);
    expect(productSchema.safeParse({ ...p, mrpVerified: true }).success).toBe(false);
    const ok = productSchema.safeParse({ ...p, mrpPaise: 1500, mrpVerified: true });
    expect(ok.error?.issues ?? []).toEqual([]);
  });
});

describe("shipping rules", () => {
  const c = commerceSettingsSchema.parse({});
  it("never invents a delivery estimate", () => {
    const r = checkPincodeRules("560001", c);
    expect(r.serviceable).toBeNull();
    expect(r.estimate).toBeNull();
  });
  it("respects blocked PIN codes and allow-lists", () => {
    expect(checkPincodeRules("560001", { ...c, blockedPincodes: ["560001"] }).serviceable).toBe(false);
    expect(checkPincodeRules("110001", { ...c, serviceablePrefixes: ["56"] }).serviceable).toBe(false);
    const ok = checkPincodeRules("560001", { ...c, serviceablePrefixes: ["56"], deliveryEstimateMinDays: 3, deliveryEstimateMaxDays: 6 });
    expect(ok.serviceable).toBe(true);
    expect(ok.estimate).toEqual({ minDays: 3, maxDays: 6 });
  });
});

describe("security helpers", () => {
  it("neutralises CSV formula injection", () => {
    expect(csvSafe("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvSafe("Normal")).toBe("Normal");
    expect(csvSafe(["a", "b"])).toBe("a|b");
  });
  it("verifies Razorpay-style signatures", () => {
    const sig = checkoutSignature("secret", "order_1", "pay_1");
    expect(sig).toBe(hmacSha256Hex("secret", "order_1|pay_1"));
    const body = JSON.stringify({ event: "payment.captured" });
    expect(verifyWebhookSignature(body, hmacSha256Hex("whsec", body), "whsec")).toBe(true);
    expect(verifyWebhookSignature(body + " ", hmacSha256Hex("whsec", body), "whsec")).toBe(false);
    expect(verifyWebhookSignature(body, null, "whsec")).toBe(false);
  });
  it("detects image types from content, not extension", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("money & params", () => {
  it("formats rupees", () => {
    expect(formatINR(249900)).toBe("₹2,499");
    expect(formatINR(126810)).toBe("₹1,268.10");
    expect(formatINR(10000000)).toBe("₹1,00,000");
    expect(rupeesToPaise("2,499.50")).toBe(249950);
    expect(rupeesToPaise("-1")).toBeNull();
  });
  it("whitelists shop filters", () => {
    const f = parseShopParams({ family: ["Oud", "Nope"], type: "inspired_fragrance", brand: "lattafa,'; drop", size: "100", sort: "evil", page: "-3" });
    expect(f.families).toEqual(["Oud"]);
    expect(f.types).toEqual(["inspired_fragrance"]);
    expect(f.brands).toEqual(["lattafa"]);
    expect(f.sizes).toEqual([100]);
    expect(f.sort).toBeUndefined();
    expect(f.page).toBe(1);
  });
});
