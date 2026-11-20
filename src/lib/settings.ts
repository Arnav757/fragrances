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
  whatsapp: optionalText(30),
  businessAddress: optionalText(500),
  gstin: optionalText(20),
  stylistName: optionalText(80), // shown on released reports, e.g. "Reviewed by Meera, senior stylist"
  instagram: optionalText(200),
});

export const pricingSettingsSchema = z.object({
  standardPaise: z.number().int().min(100).max(10_000_000).default(149900),
  standardHours: z.number().int().min(1).max(336).default(72),
  priorityEnabled: z.boolean().default(true),
  priorityPaise: z.number().int().min(100).max(10_000_000).default(229900),
  priorityHours: z.number().int().min(1).max(336).default(24),
  // GST on the service, included in the price. Must be confirmed with a tax adviser before launch.
  gstRateBp: z.number().int().min(0).max(4000).default(1800),
  taxConfigVerified: z.boolean().default(false),
  orderExpiryHours: z.number().int().min(1).max(168).default(24),
});

export const shopSettingsSchema = z.object({
  amazonEnabled: z.boolean().default(true),
  amazonTag: z.string().trim().max(40).default(""),
  myntraEnabled: z.boolean().default(true),
  ajioEnabled: z.boolean().default(true),
});

export const privacySettingsSchema = z.object({
  photoRetentionDays: z.number().int().min(1).max(365).default(30),
  unpaidRetentionDays: z.number().int().min(1).max(365).default(14),
});

export const pagesSettingsSchema = z.record(z.enum(PAGE_KEYS), z.string().max(30000));

export type StoreSettings = z.infer<typeof storeSettingsSchema>;
export type PricingSettings = z.infer<typeof pricingSettingsSchema>;
export type ShopSettings = z.infer<typeof shopSettingsSchema>;
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

const DEFAULTS = {
  store: storeSettingsSchema.parse({ name: brand.name }),
  pricing: pricingSettingsSchema.parse({}),
  shop: shopSettingsSchema.parse({}),
  privacy: privacySettingsSchema.parse({}),
};

export type SettingsKey = keyof typeof DEFAULTS;
const SCHEMAS = { store: storeSettingsSchema, pricing: pricingSettingsSchema, shop: shopSettingsSchema, privacy: privacySettingsSchema } as const;

export async function getSettings<K extends SettingsKey>(key: K, q: Queryable = db()): Promise<(typeof DEFAULTS)[K]> {
  const rows = await q<{ value: unknown }[]>`select value from settings where key = ${key}`;
  const stored = rows[0]?.value;
  const merged = { ...DEFAULTS[key], ...(stored && typeof stored === "object" ? stored : {}) };
  const parsed = SCHEMAS[key].safeParse(merged);
  return (parsed.success ? parsed.data : DEFAULTS[key]) as (typeof DEFAULTS)[K];
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

/** GST included in a tax-inclusive price. */
export function includedTax(totalPaise: number, rateBp: number): number {
  if (rateBp <= 0) return 0;
  return Math.round(totalPaise - (totalPaise * 10000) / (10000 + rateBp));
}
