import { z } from "zod";
import { AVAILABILITY, CONCENTRATIONS, FAMILIES, GENDERS, INDIAN_STATES, OCCASIONS, PRODUCT_TYPES } from "@/config/brand";

const trimmed = (max: number) => z.string().trim().max(max, { error: `Must be ${max} characters or fewer` });

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, { error: "Enter a valid 10-digit Indian mobile number" }));

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, { error: "Enter a valid 6-digit PIN code" });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }).max(254));

export const stateSchema = z.enum(INDIAN_STATES, { error: "Select a state" });

export const addressSchema = z.object({
  fullName: trimmed(120).min(2, { error: "Enter the recipient's full name" }),
  phone: phoneSchema,
  line1: trimmed(160).min(3, { error: "Enter house / flat number and street" }),
  line2: trimmed(160).optional().default(""),
  landmark: trimmed(120).optional().default(""),
  city: trimmed(80).min(2, { error: "Enter a city" }),
  state: stateSchema,
  pincode: pincodeSchema,
});
export type AddressInput = z.infer<typeof addressSchema>;

export const savedAddressSchema = addressSchema.extend({
  label: trimmed(40).optional().default(""),
  isDefault: z.coerce.boolean().optional().default(false),
});

export const checkoutSchema = z
  .object({
    idempotencyKey: z.uuid({ error: "Missing checkout session. Please reload the page." }),
    email: emailSchema,
    contactName: trimmed(120).min(2, { error: "Enter your name" }),
    phone: phoneSchema,
    shipping: addressSchema,
    billingSameAsShipping: z.boolean(),
    billing: addressSchema.optional(),
    notes: trimmed(500).optional().default(""),
    paymentMethod: z.enum(["razorpay", "cod"]),
    expectedTotalPaise: z.number().int().nonnegative(),
    acceptTerms: z.literal(true, { error: "Please accept the terms and policies to continue" }),
    saveAddress: z.boolean().optional().default(false),
  })
  .refine((v) => v.billingSameAsShipping || v.billing, { path: ["billing"], error: "Enter a billing address" });
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const passwordSchema = z
  .string()
  .min(10, { error: "Use at least 10 characters" })
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), { error: "Include at least one letter and one number" });

export const registerSchema = z.object({
  fullName: trimmed(120).min(2, { error: "Enter your name" }),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Enter your password" }).max(200),
});

export const profileSchema = z.object({
  fullName: trimmed(120).min(2, { error: "Enter your name" }),
  phone: z.union([z.literal(""), phoneSchema]).optional().default(""),
});

const notesList = z
  .union([z.array(z.string()), z.string()])
  .transform((v) =>
    (Array.isArray(v) ? v : v.split(","))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20),
  );

export const productSchema = z
  .object({
    name: trimmed(160).min(2),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "Use lowercase letters, numbers and hyphens" })
      .max(80),
    brandId: z.uuid({ error: "Select a brand" }),
    productType: z.enum(PRODUCT_TYPES),
    description: trimmed(5000).default(""),
    sizeMl: z.coerce.number().int().positive().max(1000).nullable().optional(),
    concentration: z.enum(CONCENTRATIONS).nullable().optional(),
    fragranceFamily: z.enum(FAMILIES).nullable().optional(),
    topNotes: notesList.default([]),
    heartNotes: notesList.default([]),
    baseNotes: notesList.default([]),
    notesVerified: z.boolean().default(false),
    gender: z.enum(GENDERS).nullable().optional(),
    occasions: z.array(z.enum(OCCASIONS)).default([]),
    sellingPricePaise: z.number().int().positive({ error: "Enter a selling price" }),
    mrpPaise: z.number().int().positive().nullable().optional(),
    mrpVerified: z.boolean().default(false),
    taxClassId: z.uuid().nullable().optional(),
    availability: z.enum(AVAILABILITY),
    isActive: z.boolean(),
    isFeatured: z.boolean().default(false),
    maxPerOrder: z.coerce.number().int().min(1).max(50).default(5),
    collectionIds: z.array(z.uuid()).default([]),
  })
  .refine((p) => p.mrpPaise == null || p.mrpPaise >= p.sellingPricePaise, {
    path: ["mrpPaise"],
    error: "MRP cannot be lower than the selling price",
  })
  .refine((p) => !p.mrpVerified || p.mrpPaise != null, { path: ["mrpVerified"], error: "Enter the MRP before marking it verified" });
export type ProductInput = z.input<typeof productSchema>;

export const supplierSchema = z.object({
  name: trimmed(120).min(2),
  contactName: trimmed(120).optional().default(""),
  phone: trimmed(20).optional().default(""),
  whatsapp: trimmed(20).optional().default(""),
  email: z.union([z.literal(""), emailSchema]).optional().default(""),
  address: trimmed(500).optional().default(""),
  gstin: z
    .union([z.literal(""), z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, { error: "Invalid GSTIN format" })])
    .optional()
    .default(""),
  paymentTerms: trimmed(500).optional().default(""),
  dispatchEstimate: trimmed(200).optional().default(""),
  shippingChargePaise: z.number().int().nonnegative().default(0),
  shippingChargeIncludesGst: z.boolean().default(false),
  returnPolicy: trimmed(2000).optional().default(""),
  notes: trimmed(2000).optional().default(""),
  isActive: z.boolean().default(true),
});

export const offerSchema = z.object({
  supplierId: z.uuid(),
  supplierSku: trimmed(80).optional().default(""),
  supplierReference: trimmed(200).optional().default(""),
  costPaise: z.number().int().nonnegative().nullable(),
  costIncludesGst: z.boolean().default(false),
  gstRateBp: z.number().int().min(0).max(4000).nullable(),
  itcEligible: z.boolean().default(false),
  isPreferred: z.boolean().default(false),
  notes: trimmed(500).optional().default(""),
});

export const discountSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, { error: "3–30 letters, numbers, - or _" }),
    description: trimmed(200).optional().default(""),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int().positive(),
    minSubtotalPaise: z.number().int().nonnegative().default(0),
    maxDiscountPaise: z.number().int().positive().nullable().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.type !== "percent" || d.value <= 10000, { path: ["value"], error: "Percent cannot exceed 100%" });

export const requestSchema = z.object({
  type: z.enum(["cancellation", "return", "refund"]),
  reason: trimmed(1000).min(5, { error: "Please tell us a little more (at least 5 characters)" }),
});

export const reviewSchema = z.object({
  orderItemId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: trimmed(120).optional().default(""),
  body: trimmed(2000).min(10, { error: "Please write at least 10 characters" }),
});

export const newsletterSchema = z.object({
  email: emailSchema,
  consent: z.literal(true, { error: "Please confirm you'd like to receive emails" }),
});
