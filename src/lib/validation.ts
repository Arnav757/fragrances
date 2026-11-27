import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max, { error: `Must be ${max} characters or fewer` });

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, { error: "Enter a valid 10-digit Indian mobile number" }));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }).max(254));

export const passwordSchema = z
  .string()
  .min(10, { error: "Use at least 10 characters" })
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), { error: "Include at least one letter and one number" });

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, { error: "Enter your password" }).max(200) });

export const checkoutSchema = z.object({
  contactName: trimmed(120).min(2, { error: "Enter your full name" }),
  email: emailSchema,
  phone: phoneSchema,
  plan: z.enum(["standard", "priority"]),
  discountCode: trimmed(30).optional().default(""),
  marketingConsent: z.boolean().default(false),
  acceptTerms: z.literal(true, { error: "Please accept the terms to continue" }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const revisionSchema = z.object({ message: trimmed(2000).min(10, { error: "Tell us a little more (at least 10 characters)" }) });

export const discountSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,30}$/, { error: "3–30 letters, numbers, - or _" }),
  description: trimmed(200).optional().default(""),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive(),
  maxUses: z.coerce.number().int().positive().optional(),
  endsAt: z.string().optional().default(""),
});
