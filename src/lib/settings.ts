import "server-only";
import { z } from "zod";
import { db, type Queryable } from "./db";
import { brand } from "@/config/brand";
import { DEFAULT_PAGES, PAGE_KEYS } from "./default-pages";

const optionalText = (max = 300) => z.string().trim().max(max).default("");

export const storeSettingsSchema = z.object({
  name: optionalText(80),
  legalBusinessName: optionalText(160),
  supportEmail: z.union([z.literal(""), z.email()]).default(""),
  supportPhone: optionalText(30),
  whatsapp: optionalText(30),
  supportHours: optionalText(120),
  businessAddress: optionalText(500),
  gstin: optionalText(20),
  announcement: optionalText(160),
  logoUrl: optionalText(500),
  socials: z
    .object({
      instagram: optionalText(200),
      facebook: optionalText(200),
      youtube: optionalText(200),
      x: optionalText(200),
    })
    .default({ instagram: "", facebook: "", youtube: "", x: "" }),
});

export const commerceSettingsSchema = z.object({
  currency: z.literal("INR").default("INR"),
  pricesIncludeTax: z.boolean().default(true),
  sellerState: z.string().nullable().default(null),
  chargesTaxRateBp: z.number().int().min(0).max(4000).nullable().default(null),
  taxConfigVerified: z.boolean().default(false),
  flatShippingPaise: z.number().int().nonnegative().default(9900),
  freeShippingThresholdPaise: z.number().int().nonnegative().nullable().default(199900),
  codEnabled: z.boolean().default(false),
  codFeePaise: z.number().int().nonnegative().default(0),
  codMaxOrderPaise: z.number().int().positive().default(500000),
  deliveryEstimateMinDays: z.number().int().positive().nullable().default(null),
  deliveryEstimateMaxDays: z.number().int().positive().nullable().default(null),
  blockedPincodes: z.array(z.string().regex(/^\d{6}$/)).default([]),
  serviceablePrefixes: z.array(z.string().regex(/^\d{1,6}$/)).default([]),
  returnWindowDays: z.number().int().min(0).max(60).default(7),
  pendingOrderExpiryHours: z.number().int().min(1).max(168).default(24),
});

export const homepageSettingsSchema = z.object({
  heroEyebrow: optionalText(80),
  heroTitle: optionalText(120),
  heroSubtitle: optionalText(300),
  heroImageUrl: optionalText(500),
  storyTitle: optionalText(120),
  storyBody: optionalText(1500),
});

export const pagesSettingsSchema = z.record(z.enum(PAGE_KEYS), z.string().max(30000));

export type StoreSettings = z.infer<typeof storeSettingsSchema>;
export type CommerceSettings = z.infer<typeof commerceSettingsSchema>;
export type HomepageSettings = z.infer<typeof homepageSettingsSchema>;

const DEFAULTS = {
  store: storeSettingsSchema.parse({ name: brand.name, announcement: "Complimentary shipping on orders above ₹1,999" }),
  commerce: commerceSettingsSchema.parse({}),
  homepage: homepageSettingsSchema.parse({
    heroEyebrow: "The Fragrance Edit",
    heroTitle: "Middle Eastern perfumery, thoughtfully curated.",
    heroSubtitle:
      "Authentic fragrances from Lattafa, Afnan, Armaf, Rasasi and more — alongside clearly labelled inspired scents. Honest descriptions, transparent prices.",
    storyTitle: "A boutique built on honest information",
    storyBody:
      "We started NOIR & NOTES for people who love fragrance and are tired of guesswork. Every listing tells you what it is — an authentic branded perfume or an inspired fragrance sold under its own name — and we only publish notes, prices and availability we can stand behind.",
  }),
};

type SettingsKey = keyof typeof DEFAULTS;
const SCHEMAS = { store: storeSettingsSchema, commerce: commerceSettingsSchema, homepage: homepageSettingsSchema } as const;

export async function getSettings<K extends SettingsKey>(key: K, q: Queryable = db()): Promise<(typeof DEFAULTS)[K]> {
  const rows = await q<{ value: unknown }[]>`select value from settings where key = ${key}`;
  const stored = rows[0]?.value;
  const merged = { ...DEFAULTS[key], ...(stored && typeof stored === "object" ? stored : {}) };
  const parsed = SCHEMAS[key].safeParse(merged);
  return (parsed.success ? parsed.data : DEFAULTS[key]) as (typeof DEFAULTS)[K];
}

export async function getAllSettings() {
  const [store, commerce, homepage] = await Promise.all([getSettings("store"), getSettings("commerce"), getSettings("homepage")]);
  return { store, commerce, homepage };
}

export async function saveSettings(key: SettingsKey | "pages", value: unknown, actorId: string | null, q: Queryable = db()) {
  const schema = key === "pages" ? pagesSettingsSchema : SCHEMAS[key];
  const data = schema.parse(value);
  await q`
    insert into settings (key, value, updated_by) values (${key}, ${q.json(data as never)}, ${actorId})
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`;
  return data;
}

export async function getPages(): Promise<Record<(typeof PAGE_KEYS)[number], string>> {
  const rows = await db()<{ value: Record<string, string> }[]>`select value from settings where key = 'pages'`;
  return { ...DEFAULT_PAGES, ...(rows[0]?.value ?? {}) };
}

export function storeName(store: StoreSettings): string {
  return store.name || brand.name;
}
