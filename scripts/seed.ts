/**
 * Seeds a small DEMONSTRATION catalogue. Everything here is flagged is_demo = true and shown on the
 * storefront with a "Demo listing" notice. Prices, availability and supplier costs are placeholders,
 * not live offers. Fragrance notes for real branded products are left empty on purpose — add them only after
 * verifying against the manufacturer's information. Delete demo data before launch: npm run db:seed -- --remove
 */
import postgres from "postgres";
import { loadEnv } from "./load-env";

loadEnv();

type P = {
  slug: string;
  name: string;
  brand: string;
  type: "authentic_branded" | "inspired_fragrance" | "other";
  size: number;
  conc: string;
  family: string;
  gender: string;
  occasions: string[];
  price: number; // rupees
  cost: number; // rupees (placeholder)
  availability: "available" | "awaiting_supplier_confirmation" | "out_of_stock";
  top: string[];
  heart: string[];
  base: string[];
  notesVerified: boolean;
  featured?: boolean;
  collections: string[];
  description: string;
};

const brands = [
  { slug: "lattafa", name: "Lattafa", origin: "United Arab Emirates", me: true, description: "Perfume house based in the UAE, known for Arabian-style Eaux de Parfum." },
  { slug: "afnan", name: "Afnan", origin: "United Arab Emirates", me: true, description: "Dubai-based fragrance house producing modern Middle Eastern perfumery." },
  { slug: "armaf", name: "Armaf", origin: "United Arab Emirates", me: true, description: "UAE fragrance brand with a broad range of contemporary scents." },
  { slug: "rasasi", name: "Rasasi", origin: "United Arab Emirates", me: true, description: "Long-established Dubai perfume house." },
  { slug: "atelier-demo", name: "Atelier Demo", origin: null, me: false, description: "Placeholder brand used for demonstration listings only." },
];

const authenticDesc = (brand: string, name: string, conc: string) =>
  `${name} is an ${conc} from ${brand}. This is a demonstration listing: full fragrance notes, MRP and pricing will be published once verified against the manufacturer's information and our supplier's current offer.`;
const inspiredDesc = (name: string) =>
  `${name} is a demonstration inspired fragrance sold under its own name. It is not a designer fragrance and is not affiliated with or endorsed by any designer brand. Replace this listing with your real inspired range before launch.`;

const products: P[] = [
  { slug: "lattafa-khamrah-edp-100ml", name: "Khamrah", brand: "Lattafa", type: "authentic_branded", size: 100, conc: "Eau de Parfum", family: "Amber", gender: "Unisex", occasions: ["Evening", "Winter", "Date Night"], price: 2499, cost: 1550, availability: "available", top: [], heart: [], base: [], notesVerified: false, featured: true, collections: ["oud-and-amber-evenings"], description: "" },
  { slug: "lattafa-asad-edp-100ml", name: "Asad", brand: "Lattafa", type: "authentic_branded", size: 100, conc: "Eau de Parfum", family: "Spicy", gender: "Men", occasions: ["Evening", "Winter"], price: 1999, cost: 1200, availability: "available", top: [], heart: [], base: [], notesVerified: false, collections: ["oud-and-amber-evenings"], description: "" },
  { slug: "lattafa-yara-edp-100ml", name: "Yara", brand: "Lattafa", type: "authentic_branded", size: 100, conc: "Eau de Parfum", family: "Sweet", gender: "Women", occasions: ["Everyday", "Date Night"], price: 1899, cost: 1100, availability: "available", top: [], heart: [], base: [], notesVerified: false, featured: true, collections: ["date-night"], description: "" },
  { slug: "afnan-9pm-edp-100ml", name: "9PM", brand: "Afnan", type: "authentic_branded", size: 100, conc: "Eau de Parfum", family: "Sweet", gender: "Men", occasions: ["Evening", "Date Night", "Winter"], price: 2299, cost: 1400, availability: "available", top: [], heart: [], base: [], notesVerified: false, featured: true, collections: ["date-night"], description: "" },
  { slug: "afnan-supremacy-not-only-intense-100ml", name: "Supremacy Not Only Intense", brand: "Afnan", type: "authentic_branded", size: 100, conc: "Extrait de Parfum", family: "Woody", gender: "Men", occasions: ["Office", "Evening"], price: 2999, cost: 1900, availability: "awaiting_supplier_confirmation", top: [], heart: [], base: [], notesVerified: false, collections: [], description: "" },
  { slug: "armaf-club-de-nuit-intense-man-edt-105ml", name: "Club de Nuit Intense Man", brand: "Armaf", type: "authentic_branded", size: 105, conc: "Eau de Toilette", family: "Woody", gender: "Men", occasions: ["Evening", "Date Night"], price: 2799, cost: 1750, availability: "available", top: [], heart: [], base: [], notesVerified: false, featured: true, collections: ["date-night"], description: "" },
  { slug: "armaf-club-de-nuit-untold-edp-105ml", name: "Club de Nuit Untold", brand: "Armaf", type: "authentic_branded", size: 105, conc: "Eau de Parfum", family: "Amber", gender: "Unisex", occasions: ["Evening", "Winter"], price: 2899, cost: 1850, availability: "awaiting_supplier_confirmation", top: [], heart: [], base: [], notesVerified: false, collections: ["oud-and-amber-evenings"], description: "" },
  { slug: "rasasi-hawas-for-him-edp-100ml", name: "Hawas for Him", brand: "Rasasi", type: "authentic_branded", size: 100, conc: "Eau de Parfum", family: "Fresh", gender: "Men", occasions: ["Summer", "Everyday"], price: 3299, cost: 2150, availability: "available", top: [], heart: [], base: [], notesVerified: false, featured: true, collections: ["fresh-and-easy"], description: "" },
  { slug: "atelier-demo-no-7-saffron-leather-50ml", name: "No. 7 Saffron Leather", brand: "Atelier Demo", type: "inspired_fragrance", size: 50, conc: "Eau de Parfum", family: "Leather", gender: "Unisex", occasions: ["Evening", "Winter"], price: 1299, cost: 650, availability: "available", top: ["Saffron", "Cardamom"], heart: ["Leather", "Rose"], base: ["Oud Accord", "Amber"], notesVerified: true, collections: ["oud-and-amber-evenings"], description: "" },
  { slug: "atelier-demo-no-12-neroli-tide-50ml", name: "No. 12 Neroli Tide", brand: "Atelier Demo", type: "inspired_fragrance", size: 50, conc: "Eau de Parfum", family: "Fresh", gender: "Unisex", occasions: ["Summer", "Office", "Everyday"], price: 1199, cost: 600, availability: "available", top: ["Bergamot", "Neroli"], heart: ["Sea Salt Accord", "Orange Blossom"], base: ["White Musk", "Vetiver"], notesVerified: true, collections: ["fresh-and-easy"], description: "" },
  { slug: "atelier-demo-no-21-vanilla-smoke-50ml", name: "No. 21 Vanilla Smoke", brand: "Atelier Demo", type: "inspired_fragrance", size: 50, conc: "Eau de Parfum", family: "Sweet", gender: "Unisex", occasions: ["Date Night", "Winter"], price: 1299, cost: 650, availability: "available", top: ["Pink Pepper"], heart: ["Tobacco Leaf", "Vanilla"], base: ["Benzoin", "Tonka Bean"], notesVerified: true, collections: ["date-night"], description: "" },
  { slug: "atelier-demo-no-3-cedar-ink-50ml", name: "No. 3 Cedar Ink", brand: "Atelier Demo", type: "inspired_fragrance", size: 50, conc: "Eau de Parfum", family: "Woody", gender: "Men", occasions: ["Office", "Everyday"], price: 1199, cost: 600, availability: "out_of_stock", top: ["Grapefruit"], heart: ["Cedarwood", "Iris"], base: ["Patchouli", "Ambroxan"], notesVerified: true, collections: ["fresh-and-easy"], description: "" },
  { slug: "atelier-demo-no-9-oud-ember-attar-12ml", name: "No. 9 Oud Ember Oil", brand: "Atelier Demo", type: "inspired_fragrance", size: 12, conc: "Attar / Perfume Oil", family: "Oud", gender: "Unisex", occasions: ["Evening", "Winter"], price: 899, cost: 420, availability: "available", top: ["Saffron"], heart: ["Oud Accord", "Rose"], base: ["Sandalwood", "Amber"], notesVerified: true, collections: ["oud-and-amber-evenings"], description: "" },
];

const collections = [
  { slug: "oud-and-amber-evenings", name: "Oud & Amber Evenings", description: "Warm, resinous fragrances for cooler nights.", position: 1 },
  { slug: "fresh-and-easy", name: "Fresh & Easy", description: "Bright, clean scents for daytime and warm weather.", position: 2 },
  { slug: "date-night", name: "Date Night", description: "Sweeter, more sensual fragrances for evenings out.", position: 3 },
];

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  try {
    if (process.argv.includes("--remove")) {
      const r = await sql`update products set is_active = false where is_demo returning id`;
      await sql`delete from products p where is_demo and not exists (select 1 from order_items oi where oi.product_id = p.id)`;
      await sql`delete from discounts where code = 'DEMO10'`;
      await sql`delete from brands b where slug = 'atelier-demo' and not exists (select 1 from products p where p.brand_id = b.id)`;
      await sql`delete from product_supplier_offers where supplier_id in (select id from suppliers where name = 'Demo Wholesaler (replace me)')`;
      await sql`delete from suppliers s where name = 'Demo Wholesaler (replace me)' and not exists (select 1 from supplier_purchase_orders po where po.supplier_id = s.id)`;
      console.log(`Deactivated ${r.length} demo products (products referenced by orders are kept but hidden).`);
      return;
    }

    await sql.begin(async (tx) => {
      const [tax] = await tx<{ id: string }[]>`
        insert into tax_classes (name, hsn_code, gst_rate_bp, is_verified, notes)
        values ('Perfumes & toilet waters', '3303', 1800, false, 'Placeholder — confirm the HSN code and GST rate with your tax adviser, then mark verified.')
        on conflict (name) do update set name = excluded.name returning id`;

      const brandIds = new Map<string, string>();
      for (const b of brands) {
        const [r] = await tx<{ id: string }[]>`
          insert into brands (slug, name, origin, description, is_middle_eastern)
          values (${b.slug}, ${b.name}, ${b.origin}, ${b.description}, ${b.me})
          on conflict (slug) do update set name = excluded.name returning id`;
        brandIds.set(b.name, r!.id);
      }

      const collIds = new Map<string, string>();
      for (const c of collections) {
        const [r] = await tx<{ id: string }[]>`
          insert into collections (slug, name, description, is_featured, position)
          values (${c.slug}, ${c.name}, ${c.description}, true, ${c.position})
          on conflict (slug) do update set name = excluded.name returning id`;
        collIds.set(c.slug, r!.id);
      }

      const [supplier] = await tx<{ id: string }[]>`
        insert into suppliers (name, contact_name, payment_terms, dispatch_estimate, return_policy, notes)
        values ('Demo Wholesaler (replace me)', 'Demo contact', 'Placeholder — e.g. prepaid per order', 'Placeholder — e.g. dispatch within 1–2 working days',
                'Placeholder — record the wholesaler''s damage/return policy', 'Demonstration supplier. Replace with your real wholesaler.')
        on conflict (name) do update set name = excluded.name returning id`;

      let i = 0;
      for (const p of products) {
        i++;
        const description = p.type === "authentic_branded" ? authenticDesc(p.brand, p.name, p.conc) : inspiredDesc(p.name);
        const [row] = await tx<{ id: string }[]>`
          insert into products (slug, name, brand_id, product_type, description, size_ml, concentration, fragrance_family,
            top_notes, heart_notes, base_notes, notes_verified, gender, occasions, selling_price_paise, mrp_paise, mrp_verified,
            tax_class_id, availability, is_active, is_featured, is_demo, created_at)
          values (${p.slug}, ${p.name}, ${brandIds.get(p.brand)!}, ${p.type}, ${description}, ${p.size}, ${p.conc}, ${p.family},
            ${p.top}, ${p.heart}, ${p.base}, ${p.notesVerified}, ${p.gender}, ${p.occasions}, ${p.price * 100}, null, false,
            ${tax!.id}, ${p.availability}, true, ${p.featured ?? false}, true, now() - make_interval(days => ${products.length - i}))
          on conflict (slug) do update set name = excluded.name
          returning id`;
        for (const c of p.collections) {
          await tx`insert into product_collections (product_id, collection_id) values (${row!.id}, ${collIds.get(c)!}) on conflict do nothing`;
        }
        await tx`
          insert into product_supplier_offers (product_id, supplier_id, supplier_sku, cost_paise, cost_includes_gst, gst_rate_bp, itc_eligible, is_preferred, notes)
          values (${row!.id}, ${supplier!.id}, ${"DEMO-" + String(i).padStart(3, "0")}, ${p.cost * 100}, true, 1800, false, true, 'Placeholder cost — not a real quote')
          on conflict (product_id, supplier_id) do nothing`;
      }

      await tx`
        insert into discounts (code, description, type, value, max_discount_paise, is_active)
        values ('DEMO10', 'Demo code: 10% off up to ₹300 — delete before launch', 'percent', 1000, 30000, true)
        on conflict (code) do nothing`;
    });
    console.log(`Seeded ${products.length} demo products, ${brands.length} brands, ${collections.length} collections, 1 demo supplier.`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
