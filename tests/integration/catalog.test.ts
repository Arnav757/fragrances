import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getProductBySlug, listProducts, getRelatedProducts, getBestsellers } from "@/lib/services/catalog";

afterAll(async () => {
  await db().end();
});

const FORBIDDEN = ["supplierCost", "costPaise", "supplierSku", "supplierId", "supplierReference", "isPreferred", "itcEligible"];

function deepKeys(v: unknown, acc: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => deepKeys(x, acc));
  else if (v && typeof v === "object" && !(v instanceof Date)) for (const [k, x] of Object.entries(v)) { acc.push(k); deepKeys(x, acc); }
  return acc;
}

describe("public catalogue", () => {
  it("lists only active products and supports filters", async () => {
    const all = await listProducts({});
    expect(all.total).toBe(13);
    const inspired = await listProducts({ types: ["inspired_fragrance"] });
    expect(inspired.products.every((p) => p.productType === "inspired_fragrance")).toBe(true);
    const lattafa = await listProducts({ brands: ["lattafa"] });
    expect(lattafa.products.map((p) => p.brandName)).toEqual(["Lattafa", "Lattafa", "Lattafa"]);
    const avail = await listProducts({ availableOnly: true });
    expect(avail.products.every((p) => p.availability === "available")).toBe(true);
    const cheap = await listProducts({ maxPricePaise: 120000 });
    expect(cheap.products.every((p) => p.sellingPricePaise <= 120000)).toBe(true);
    const winter = await listProducts({ occasions: ["Winter"], families: ["Amber"] });
    expect(winter.total).toBeGreaterThan(0);
    const sized = await listProducts({ sizes: [105] });
    expect(sized.products.every((p) => p.sizeMl === 105)).toBe(true);
  });

  it("searches by name, brand and verified notes only", async () => {
    expect((await listProducts({ q: "khamrah" })).total).toBe(1);
    expect((await listProducts({ q: "rasasi" })).total).toBe(1);
    expect((await listProducts({ q: "neroli" })).total).toBe(1); // verified note on demo inspired product
    expect((await listProducts({ q: "%" })).total).toBe(0); // wildcard is escaped
  });

  it("sorts by price and falls back from popularity when there's no order data", async () => {
    const asc = await listProducts({ sort: "price_asc", pageSize: 48 });
    const prices = asc.products.map((p) => p.sellingPricePaise);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    // Popularity uses real paid orders only; other test files may or may not have created some.
    const paid = await db()`select 1 from orders where payment_status in ('paid','cod_pending','cod_collected','partially_refunded') and status not in ('cancelled','refunded','awaiting_payment','payment_failed') limit 1`;
    const pop = await listProducts({ sort: "popular" });
    expect(pop.popularityAvailable).toBe(paid.length > 0);
    expect(pop.sortApplied).toBe(paid.length > 0 ? "popular" : "newest");
    expect((await getBestsellers()).length > 0).toBe(paid.length > 0);
  });

  it("paginates", async () => {
    const p1 = await listProducts({ pageSize: 5, page: 1 });
    const p3 = await listProducts({ pageSize: 5, page: 3 });
    expect(p1.pageCount).toBe(3);
    expect(p3.products.length).toBe(3);
  });

  it("never exposes supplier costs or unverified details", async () => {
    const list = await listProducts({ pageSize: 48 });
    const p = await getProductBySlug("lattafa-khamrah-edp-100ml");
    const related = await getRelatedProducts(p!);
    const keys = new Set(deepKeys([list, p, related]));
    for (const k of FORBIDDEN) expect(keys.has(k)).toBe(false);
    expect(p!.mrpPaise).toBeNull(); // MRP not verified
    expect(p!.notesVerified).toBe(false);
    expect(p!.topNotes).toEqual([]);
  });

  it("hides unverified notes and MRP at the SQL level", async () => {
    await db()`update products set mrp_paise = 300000, mrp_verified = false, top_notes = '{Secret}', notes_verified = false where slug = 'lattafa-asad-edp-100ml'`;
    const p = await getProductBySlug("lattafa-asad-edp-100ml");
    expect(p!.mrpPaise).toBeNull();
    expect(p!.topNotes).toEqual([]);
    await db()`update products set mrp_verified = true where slug = 'lattafa-asad-edp-100ml'`;
    expect((await getProductBySlug("lattafa-asad-edp-100ml"))!.mrpPaise).toBe(300000);
    await db()`update products set mrp_paise = null, mrp_verified = false, top_notes = '{}' where slug = 'lattafa-asad-edp-100ml'`;
  });

  it("returns null for hidden products", async () => {
    await db()`update products set is_active = false where slug = 'atelier-demo-no-3-cedar-ink-50ml'`;
    expect(await getProductBySlug("atelier-demo-no-3-cedar-ink-50ml")).toBeNull();
    await db()`update products set is_active = true where slug = 'atelier-demo-no-3-cedar-ink-50ml'`;
  });
});
