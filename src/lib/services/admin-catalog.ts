import "server-only";
import { z } from "zod";
import { db, type Queryable } from "../db";
import { audit } from "./audit";
import { productSchema, supplierSchema, offerSchema, discountSchema } from "../validation";
import { parseCsv, PRODUCT_CSV_HEADERS } from "../csv";
import { rupeesToPaise } from "../money";
import { slugify } from "../utils";
import { AVAILABILITY, CONCENTRATIONS, FAMILIES, GENDERS, OCCASIONS, PRODUCT_TYPES, type Availability, type ProductType } from "@/config/brand";

type Actor = { id: string };

export class AdminError extends Error {}

function uniqueViolation(e: unknown, message: string): never {
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505") throw new AdminError(message);
  throw e;
}

// ------------------------------------------------------------------ products

export type AdminProductRow = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  productType: ProductType;
  sizeMl: number | null;
  sellingPricePaise: number;
  availability: Availability;
  isActive: boolean;
  isDemo: boolean;
  preferredCostPaise: number | null;
  supplierCount: number;
  imageCount: number;
  updatedAt: Date;
};

export async function adminListProducts(f: { q?: string; status?: string; availability?: string }, q: Queryable = db()) {
  const like = f.q ? `%${f.q.replace(/[%_\\]/g, (m) => "\\" + m)}%` : null;
  return q<AdminProductRow[]>`
    select p.id, p.slug, p.name, b.name as brand_name, p.product_type, p.size_ml, p.selling_price_paise, p.availability, p.is_active, p.is_demo,
      (select cost_paise from product_supplier_offers o where o.product_id = p.id order by is_preferred desc, cost_paise asc nulls last limit 1) as preferred_cost_paise,
      (select count(*)::int from product_supplier_offers o where o.product_id = p.id) as supplier_count,
      (select count(*)::int from product_images i where i.product_id = p.id) as image_count,
      p.updated_at
    from products p join brands b on b.id = p.brand_id
    where true
      ${like ? q`and (p.name ilike ${like} or b.name ilike ${like} or p.slug ilike ${like})` : q``}
      ${f.status === "active" ? q`and p.is_active` : f.status === "hidden" ? q`and not p.is_active` : q``}
      ${f.availability && (AVAILABILITY as readonly string[]).includes(f.availability) ? q`and p.availability = ${f.availability}` : q``}
    order by p.updated_at desc
    limit 500`;
}

export type AdminProductDetail = {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  productType: ProductType;
  description: string;
  sizeMl: number | null;
  concentration: string | null;
  fragranceFamily: string | null;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  notesVerified: boolean;
  gender: string | null;
  occasions: string[];
  sellingPricePaise: number;
  mrpPaise: number | null;
  mrpVerified: boolean;
  taxClassId: string | null;
  availability: Availability;
  isActive: boolean;
  isFeatured: boolean;
  maxPerOrder: number;
  isDemo: boolean;
  collectionIds: string[];
};

export async function adminGetProduct(id: string, q: Queryable = db()) {
  const rows = await q<AdminProductDetail[]>`
    select p.id, p.name, p.slug, p.brand_id, p.product_type, p.description, p.size_ml, p.concentration, p.fragrance_family,
      p.top_notes, p.heart_notes, p.base_notes, p.notes_verified, p.gender, p.occasions, p.selling_price_paise, p.mrp_paise, p.mrp_verified,
      p.tax_class_id, p.availability, p.is_active, p.is_featured, p.max_per_order, p.is_demo,
      array(select collection_id from product_collections where product_id = p.id) as collection_ids
    from products p where p.id = ${id}`;
  if (!rows[0]) return null;
  const [images, offers] = await Promise.all([
    q<{ id: string; url: string; alt: string; position: number; usageRightsConfirmed: boolean; storagePath: string | null }[]>`
      select id, url, alt, position, usage_rights_confirmed, storage_path from product_images where product_id = ${id} order by position, created_at`,
    q<{
      id: string;
      supplierId: string;
      supplierName: string;
      supplierSku: string | null;
      supplierReference: string | null;
      costPaise: number | null;
      costIncludesGst: boolean;
      gstRateBp: number | null;
      itcEligible: boolean;
      isPreferred: boolean;
      lastConfirmedAt: Date | null;
      notes: string | null;
    }[]>`
      select o.id, o.supplier_id, s.name as supplier_name, o.supplier_sku, o.supplier_reference, o.cost_paise, o.cost_includes_gst,
        o.gst_rate_bp, o.itc_eligible, o.is_preferred, o.last_confirmed_at, o.notes
      from product_supplier_offers o join suppliers s on s.id = o.supplier_id where o.product_id = ${id} order by o.is_preferred desc, s.name`,
  ]);
  return { product: rows[0], images, offers };
}

export async function saveProduct(id: string | null, raw: unknown, actor: Actor): Promise<string> {
  const p = productSchema.parse(raw);
  const sql = db();
  try {
    return await sql.begin(async (tx) => {
      const values = {
        name: p.name,
        slug: p.slug,
        brandId: p.brandId,
        productType: p.productType,
        description: p.description,
        sizeMl: p.sizeMl ?? null,
        concentration: p.concentration ?? null,
        fragranceFamily: p.fragranceFamily ?? null,
        topNotes: p.topNotes,
        heartNotes: p.heartNotes,
        baseNotes: p.baseNotes,
        notesVerified: p.notesVerified,
        gender: p.gender ?? null,
        occasions: p.occasions,
        sellingPricePaise: p.sellingPricePaise,
        mrpPaise: p.mrpPaise ?? null,
        mrpVerified: p.mrpVerified,
        taxClassId: p.taxClassId ?? null,
        availability: p.availability,
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        maxPerOrder: p.maxPerOrder,
      };
      if (p.isActive && p.availability === "available" && !values.taxClassId) {
        throw new AdminError("Assign a tax class before making a product available for purchase.");
      }
      let productId = id;
      if (id) {
        const before = await tx<{ sellingPricePaise: number; availability: string; isActive: boolean }[]>`
          select selling_price_paise, availability, is_active from products where id = ${id}`;
        if (!before[0]) throw new AdminError("Product not found.");
        await tx`update products set ${tx(values)} where id = ${id}`;
        await audit(actor.id, "product.update", "product", id, { before: before[0], after: { sellingPricePaise: values.sellingPricePaise, availability: values.availability, isActive: values.isActive } }, tx);
      } else {
        const r = await tx<{ id: string }[]>`insert into products ${tx(values)} returning id`;
        productId = r[0]!.id;
        await audit(actor.id, "product.create", "product", productId, { name: p.name }, tx);
      }
      await tx`delete from product_collections where product_id = ${productId}`;
      for (const c of p.collectionIds) await tx`insert into product_collections (product_id, collection_id) values (${productId}, ${c}) on conflict do nothing`;
      return productId!;
    });
  } catch (e) {
    if (e instanceof AdminError || e instanceof z.ZodError) throw e;
    uniqueViolation(e, "Another product already uses this URL slug.");
  }
}

export async function archiveProduct(id: string, actor: Actor) {
  await db()`update products set is_active = false, availability = 'discontinued' where id = ${id}`;
  await audit(actor.id, "product.archive", "product", id);
}

export async function addProductImage(productId: string, img: { url: string; storagePath: string | null; alt: string; usageRightsConfirmed: boolean }, actor: Actor) {
  const [{ pos }] = await db()<{ pos: number }[]>`select coalesce(max(position) + 1, 0)::int as pos from product_images where product_id = ${productId}`;
  await db()`insert into product_images (product_id, url, storage_path, alt, position, usage_rights_confirmed)
             values (${productId}, ${img.url}, ${img.storagePath}, ${img.alt}, ${pos}, ${img.usageRightsConfirmed})`;
  await audit(actor.id, "product.image_add", "product", productId, { url: img.url, usageRightsConfirmed: img.usageRightsConfirmed });
}

export async function upsertOffer(productId: string, raw: unknown, actor: Actor) {
  const o = offerSchema.parse(raw);
  await db().begin(async (tx) => {
    if (o.isPreferred) await tx`update product_supplier_offers set is_preferred = false where product_id = ${productId}`;
    await tx`
      insert into product_supplier_offers (product_id, supplier_id, supplier_sku, supplier_reference, cost_paise, cost_includes_gst, gst_rate_bp, itc_eligible, is_preferred, notes, last_confirmed_at)
      values (${productId}, ${o.supplierId}, ${o.supplierSku || null}, ${o.supplierReference || null}, ${o.costPaise}, ${o.costIncludesGst}, ${o.gstRateBp}, ${o.itcEligible}, ${o.isPreferred}, ${o.notes || null}, now())
      on conflict (product_id, supplier_id) do update set supplier_sku = excluded.supplier_sku, supplier_reference = excluded.supplier_reference,
        cost_paise = excluded.cost_paise, cost_includes_gst = excluded.cost_includes_gst, gst_rate_bp = excluded.gst_rate_bp,
        itc_eligible = excluded.itc_eligible, is_preferred = excluded.is_preferred, notes = excluded.notes, last_confirmed_at = now()`;
    await audit(actor.id, "product.supplier_offer", "product", productId, { supplierId: o.supplierId, costPaise: o.costPaise }, tx);
  });
}

// ------------------------------------------------------------------ reference data

export async function listBrandsAdmin(q: Queryable = db()) {
  return q<{ id: string; slug: string; name: string; origin: string | null; description: string | null; isMiddleEastern: boolean; isActive: boolean; productCount: number }[]>`
    select b.id, b.slug, b.name, b.origin, b.description, b.is_middle_eastern, b.is_active,
      (select count(*)::int from products p where p.brand_id = b.id) as product_count
    from brands b order by b.name`;
}

export const brandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  origin: z.string().trim().max(80).optional().default(""),
  description: z.string().trim().max(1000).optional().default(""),
  isMiddleEastern: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function saveBrand(id: string | null, raw: unknown, actor: Actor) {
  const b = brandSchema.parse(raw);
  try {
    if (id) {
      await db()`update brands set name = ${b.name}, origin = ${b.origin || null}, description = ${b.description || null},
                 is_middle_eastern = ${b.isMiddleEastern}, is_active = ${b.isActive} where id = ${id}`;
    } else {
      await db()`insert into brands (slug, name, origin, description, is_middle_eastern, is_active)
                 values (${slugify(b.name)}, ${b.name}, ${b.origin || null}, ${b.description || null}, ${b.isMiddleEastern}, ${b.isActive})`;
    }
  } catch (e) {
    uniqueViolation(e, "A brand with this name already exists.");
  }
  await audit(actor.id, id ? "brand.update" : "brand.create", "brand", id, { name: b.name });
}

export async function listCollectionsAdmin(q: Queryable = db()) {
  return q<{ id: string; slug: string; name: string; description: string | null; isFeatured: boolean; position: number; productCount: number }[]>`
    select c.id, c.slug, c.name, c.description, c.is_featured, c.position,
      (select count(*)::int from product_collections pc where pc.collection_id = c.id) as product_count
    from collections c order by c.position, c.name`;
}

export const collectionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().default(""),
  isFeatured: z.boolean().default(false),
  position: z.number().int().min(0).max(999).default(0),
});

export async function saveCollection(id: string | null, raw: unknown, actor: Actor) {
  const c = collectionSchema.parse(raw);
  try {
    if (id) {
      await db()`update collections set name = ${c.name}, description = ${c.description || null}, is_featured = ${c.isFeatured}, position = ${c.position} where id = ${id}`;
    } else {
      await db()`insert into collections (slug, name, description, is_featured, position) values (${slugify(c.name)}, ${c.name}, ${c.description || null}, ${c.isFeatured}, ${c.position})`;
    }
  } catch (e) {
    uniqueViolation(e, "A collection with this name already exists.");
  }
  await audit(actor.id, id ? "collection.update" : "collection.create", "collection", id, { name: c.name });
}

export async function listTaxClasses(q: Queryable = db()) {
  return q<{ id: string; name: string; hsnCode: string | null; gstRateBp: number; isVerified: boolean; notes: string | null }[]>`
    select id, name, hsn_code, gst_rate_bp, is_verified, notes from tax_classes order by name`;
}

export const taxClassSchema = z.object({
  name: z.string().trim().min(2).max(80),
  hsnCode: z.string().trim().regex(/^(\d{4}|\d{6}|\d{8})?$/, { error: "HSN must be 4, 6 or 8 digits" }).optional().default(""),
  gstRateBp: z.number().int().min(0).max(4000),
  isVerified: z.boolean().default(false),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function saveTaxClass(id: string | null, raw: unknown, actor: Actor) {
  const t = taxClassSchema.parse(raw);
  try {
    if (id) await db()`update tax_classes set name = ${t.name}, hsn_code = ${t.hsnCode || null}, gst_rate_bp = ${t.gstRateBp}, is_verified = ${t.isVerified}, notes = ${t.notes || null} where id = ${id}`;
    else await db()`insert into tax_classes (name, hsn_code, gst_rate_bp, is_verified, notes) values (${t.name}, ${t.hsnCode || null}, ${t.gstRateBp}, ${t.isVerified}, ${t.notes || null})`;
  } catch (e) {
    uniqueViolation(e, "A tax class with this name already exists.");
  }
  await audit(actor.id, id ? "tax_class.update" : "tax_class.create", "tax_class", id, t);
}

// ------------------------------------------------------------------ suppliers

export async function listSuppliers(q: Queryable = db()) {
  return q<{ id: string; name: string; contactName: string | null; phone: string | null; email: string | null; dispatchEstimate: string | null; isActive: boolean; productCount: number; openPurchases: number }[]>`
    select s.id, s.name, s.contact_name, s.phone, s.email, s.dispatch_estimate, s.is_active,
      (select count(*)::int from product_supplier_offers o where o.supplier_id = s.id) as product_count,
      (select count(*)::int from supplier_purchase_orders po where po.supplier_id = s.id and po.status in ('draft', 'ordered', 'confirmed')) as open_purchases
    from suppliers s order by s.is_active desc, s.name`;
}

export async function getSupplier(id: string, q: Queryable = db()) {
  const rows = await q<(z.infer<typeof supplierSchema> & { id: string })[]>`
    select id, name, coalesce(contact_name, '') as contact_name, coalesce(phone, '') as phone, coalesce(whatsapp, '') as whatsapp,
      coalesce(email::text, '') as email, coalesce(address, '') as address, coalesce(gstin, '') as gstin, coalesce(payment_terms, '') as payment_terms,
      coalesce(dispatch_estimate, '') as dispatch_estimate, shipping_charge_paise, shipping_charge_includes_gst,
      coalesce(return_policy, '') as return_policy, coalesce(notes, '') as notes, is_active
    from suppliers where id = ${id}`;
  if (!rows[0]) return null;
  const products = await q<{ productId: string; productName: string; brandName: string; supplierSku: string | null; costPaise: number | null; costIncludesGst: boolean; isPreferred: boolean }[]>`
    select p.id as product_id, p.name as product_name, b.name as brand_name, o.supplier_sku, o.cost_paise, o.cost_includes_gst, o.is_preferred
    from product_supplier_offers o join products p on p.id = o.product_id join brands b on b.id = p.brand_id
    where o.supplier_id = ${id} order by b.name, p.name`;
  return { supplier: rows[0], products };
}

export async function saveSupplier(id: string | null, raw: unknown, actor: Actor): Promise<string> {
  const s = supplierSchema.parse(raw);
  const values = {
    name: s.name,
    contactName: s.contactName || null,
    phone: s.phone || null,
    whatsapp: s.whatsapp || null,
    email: s.email || null,
    address: s.address || null,
    gstin: s.gstin || null,
    paymentTerms: s.paymentTerms || null,
    dispatchEstimate: s.dispatchEstimate || null,
    shippingChargePaise: s.shippingChargePaise,
    shippingChargeIncludesGst: s.shippingChargeIncludesGst,
    returnPolicy: s.returnPolicy || null,
    notes: s.notes || null,
    isActive: s.isActive,
  };
  try {
    let sid = id;
    if (id) await db()`update suppliers set ${db()(values)} where id = ${id}`;
    else sid = (await db()<{ id: string }[]>`insert into suppliers ${db()(values)} returning id`)[0]!.id;
    await audit(actor.id, id ? "supplier.update" : "supplier.create", "supplier", sid, { name: s.name });
    return sid!;
  } catch (e) {
    uniqueViolation(e, "A supplier with this name already exists.");
  }
}

// ------------------------------------------------------------------ discounts

export async function listDiscounts(q: Queryable = db()) {
  return q<{ id: string; code: string; description: string | null; type: "percent" | "fixed"; value: number; minSubtotalPaise: number; maxDiscountPaise: number | null; maxUses: number | null; usedCount: number; startsAt: Date | null; endsAt: Date | null; isActive: boolean }[]>`
    select id, code, description, type, value, min_subtotal_paise, max_discount_paise, max_uses, used_count, starts_at, ends_at, is_active
    from discounts order by created_at desc`;
}

export async function saveDiscount(id: string | null, raw: unknown, actor: Actor) {
  const d = discountSchema.parse(raw);
  const values = {
    code: d.code,
    description: d.description || null,
    type: d.type,
    value: d.value,
    minSubtotalPaise: d.minSubtotalPaise,
    maxDiscountPaise: d.maxDiscountPaise ?? null,
    maxUses: d.maxUses ?? null,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
    isActive: d.isActive,
  };
  try {
    if (id) await db()`update discounts set ${db()(values)} where id = ${id}`;
    else await db()`insert into discounts ${db()(values)}`;
  } catch (e) {
    uniqueViolation(e, "This discount code already exists.");
  }
  await audit(actor.id, id ? "discount.update" : "discount.create", "discount", id, { code: d.code });
}

// ------------------------------------------------------------------ CSV import

const bool = (v: string | undefined) => ["true", "yes", "1", "y"].includes((v ?? "").trim().toLowerCase());
const list = (v: string | undefined) =>
  (v ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

export type ImportPreview = { ok: boolean; created: number; updated: number; errors: string[] };

/** Imports products from CSV (see public/templates/product-import-template.csv). All-or-nothing. */
export async function importProductsCsv(text: string, opts: { commit: boolean }, actor: Actor): Promise<ImportPreview> {
  const { rows, errors: parseErrors } = parseCsv(text);
  const errors = [...parseErrors];
  if (!rows.length) return { ok: false, created: 0, updated: 0, errors: ["The file has no data rows."] };
  if (rows.length > 2000) return { ok: false, created: 0, updated: 0, errors: ["Import at most 2,000 rows at a time."] };
  const missing = ["slug", "name", "brand", "product_type", "selling_price_inr", "availability"].filter((h) => !(h in rows[0]!));
  if (missing.length) return { ok: false, created: 0, updated: 0, errors: [`Missing required columns: ${missing.join(", ")}`] };
  const unknownCols = Object.keys(rows[0]!).filter((h) => !(PRODUCT_CSV_HEADERS as readonly string[]).includes(h));
  if (unknownCols.length) errors.push(`Ignoring unknown columns: ${unknownCols.join(", ")}`);

  let created = 0;
  let updated = 0;
  const sql = db();
  try {
    await sql.begin(async (tx) => {
      const brands = new Map((await tx<{ id: string; name: string }[]>`select id, name from brands`).map((b) => [b.name.toLowerCase(), b.id]));
      const taxes = new Map((await tx<{ id: string; name: string }[]>`select id, name from tax_classes`).map((t) => [t.name.toLowerCase(), t.id]));
      const suppliers = new Map((await tx<{ id: string; name: string }[]>`select id, name from suppliers`).map((s) => [s.name.toLowerCase(), s.id]));

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]!;
        const line = i + 2;
        const rowErr = (m: string) => errors.push(`Row ${line} (${r.slug || r.name || "?"}): ${m}`);
        const brandName = (r.brand ?? "").trim();
        if (!brandName) {
          rowErr("brand is required");
          continue;
        }
        let brandId = brands.get(brandName.toLowerCase());
        if (!brandId) {
          const b = await tx<{ id: string }[]>`insert into brands (slug, name) values (${slugify(brandName)}, ${brandName}) returning id`;
          brandId = b[0]!.id;
          brands.set(brandName.toLowerCase(), brandId);
        }
        const taxClassId = r.tax_class ? taxes.get(r.tax_class.trim().toLowerCase()) : undefined;
        if (r.tax_class && !taxClassId) {
          rowErr(`unknown tax_class "${r.tax_class}"`);
          continue;
        }
        const occasions = list(r.occasions);
        const badOcc = occasions.filter((o) => !(OCCASIONS as readonly string[]).includes(o));
        if (badOcc.length) {
          rowErr(`unknown occasions: ${badOcc.join(", ")} (use ${OCCASIONS.join(", ")})`);
          continue;
        }
        const candidate = {
          name: r.name,
          slug: (r.slug || slugify(`${brandName} ${r.name} ${r.size_ml ?? ""}`)).trim(),
          brandId,
          productType: r.product_type?.trim(),
          description: r.description ?? "",
          sizeMl: r.size_ml ? Number(r.size_ml) : null,
          concentration: r.concentration?.trim() || null,
          fragranceFamily: r.fragrance_family?.trim() || null,
          topNotes: list(r.top_notes),
          heartNotes: list(r.heart_notes),
          baseNotes: list(r.base_notes),
          notesVerified: bool(r.notes_verified),
          gender: r.gender?.trim() || null,
          occasions,
          sellingPricePaise: rupeesToPaise(r.selling_price_inr) ?? 0,
          mrpPaise: rupeesToPaise(r.mrp_inr),
          mrpVerified: bool(r.mrp_verified),
          taxClassId: taxClassId ?? null,
          availability: r.availability?.trim(),
          isActive: r.is_active === undefined || r.is_active === "" ? false : bool(r.is_active),
          isFeatured: false,
          maxPerOrder: r.max_per_order ? Number(r.max_per_order) : 5,
          collectionIds: [],
        };
        const parsed = productSchema.safeParse(candidate);
        if (!parsed.success) {
          rowErr(
            parsed.error.issues
              .map((iss) => {
                const field = iss.path.join(".");
                const hint =
                  field === "productType" ? ` (use ${PRODUCT_TYPES.join(", ")})`
                  : field === "concentration" ? ` (use ${CONCENTRATIONS.join(", ")})`
                  : field === "fragranceFamily" ? ` (use ${FAMILIES.join(", ")})`
                  : field === "gender" ? ` (use ${GENDERS.join(", ")})`
                  : field === "availability" ? ` (use ${AVAILABILITY.join(", ")})`
                  : "";
                return `${field}: ${iss.message}${hint}`;
              })
              .join("; "),
          );
          continue;
        }
        const p = parsed.data;
        if (p.isActive && p.availability === "available" && !p.taxClassId) {
          rowErr("tax_class is required for active, available products");
          continue;
        }
        const values = {
          name: p.name,
          slug: p.slug,
          brandId: p.brandId,
          productType: p.productType,
          description: p.description,
          sizeMl: p.sizeMl ?? null,
          concentration: p.concentration ?? null,
          fragranceFamily: p.fragranceFamily ?? null,
          topNotes: p.topNotes,
          heartNotes: p.heartNotes,
          baseNotes: p.baseNotes,
          notesVerified: p.notesVerified,
          gender: p.gender ?? null,
          occasions: p.occasions,
          sellingPricePaise: p.sellingPricePaise,
          mrpPaise: p.mrpPaise ?? null,
          mrpVerified: p.mrpVerified,
          taxClassId: p.taxClassId ?? null,
          availability: p.availability,
          isActive: p.isActive,
          maxPerOrder: p.maxPerOrder,
        };
        const existing = await tx<{ id: string }[]>`select id from products where slug = ${p.slug}`;
        let productId: string;
        if (existing[0]) {
          await tx`update products set ${tx(values)} where id = ${existing[0].id}`;
          productId = existing[0].id;
          updated++;
        } else {
          productId = (await tx<{ id: string }[]>`insert into products ${tx(values)} returning id`)[0]!.id;
          created++;
        }
        if (r.supplier?.trim()) {
          const supplierId = suppliers.get(r.supplier.trim().toLowerCase());
          if (!supplierId) {
            rowErr(`unknown supplier "${r.supplier}" — create it in Suppliers first`);
            continue;
          }
          const cost = rupeesToPaise(r.supplier_cost_inr);
          await tx`
            insert into product_supplier_offers (product_id, supplier_id, supplier_sku, supplier_reference, cost_paise, cost_includes_gst, itc_eligible, last_confirmed_at)
            values (${productId}, ${supplierId}, ${r.supplier_sku || null}, ${r.supplier_reference || null}, ${cost}, ${bool(r.supplier_cost_includes_gst)}, ${bool(r.supplier_itc_eligible)}, now())
            on conflict (product_id, supplier_id) do update set supplier_sku = excluded.supplier_sku, supplier_reference = excluded.supplier_reference,
              cost_paise = excluded.cost_paise, cost_includes_gst = excluded.cost_includes_gst, itc_eligible = excluded.itc_eligible, last_confirmed_at = now()`;
        }
      }
      const blocking = errors.filter((e) => !e.startsWith("Ignoring"));
      if (blocking.length || !opts.commit) throw new RollbackSignal();
      await audit(actor.id, "product.import", "product", null, { created, updated }, tx);
    });
  } catch (e) {
    if (!(e instanceof RollbackSignal)) throw e;
  }
  const blocking = errors.filter((e) => !e.startsWith("Ignoring"));
  return { ok: blocking.length === 0, created, updated, errors };
}

class RollbackSignal extends Error {}

export async function exportProductsRows(q: Queryable = db()) {
  return q<Record<string, unknown>[]>`
    select p.slug, p.name, b.name as brand, p.product_type, p.description, p.size_ml, p.concentration, p.fragrance_family,
      p.top_notes, p.heart_notes, p.base_notes, p.notes_verified, p.gender, p.occasions,
      round(p.selling_price_paise / 100.0, 2) as selling_price_inr, round(p.mrp_paise / 100.0, 2) as mrp_inr, p.mrp_verified,
      t.name as tax_class, p.availability, p.is_active, p.max_per_order,
      s.name as supplier, o.supplier_sku, o.supplier_reference, round(o.cost_paise / 100.0, 2) as supplier_cost_inr,
      o.cost_includes_gst as supplier_cost_includes_gst, o.itc_eligible as supplier_itc_eligible
    from products p join brands b on b.id = p.brand_id
    left join tax_classes t on t.id = p.tax_class_id
    left join lateral (select * from product_supplier_offers o where o.product_id = p.id order by is_preferred desc limit 1) o on true
    left join suppliers s on s.id = o.supplier_id
    order by b.name, p.name`;
}
