import "server-only";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  // Used to derive guest order-access links. Must be a long random value in staging/production.
  APP_SECRET: z.string().min(32).default("dev-only-insecure-app-secret-change-me-0000"),
  CRON_SECRET: z.string().min(16).optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  ENABLE_MOCK_PAYMENTS: bool,

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("product-images"),

  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_PICKUP_PINCODE: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Invalid environment configuration: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  const e = parsed.data;
  if (e.APP_ENV === "production" && e.ENABLE_MOCK_PAYMENTS) {
    throw new Error("ENABLE_MOCK_PAYMENTS must not be set when APP_ENV=production.");
  }
  if ((e.APP_ENV === "production" || e.APP_ENV === "staging") && e.APP_SECRET.startsWith("dev-only")) {
    throw new Error("APP_SECRET must be set to a long random value in staging/production.");
  }
  cached = e;
  return e;
}

/** For tests: forget the parsed environment so changes to process.env take effect. */
export function resetEnvCache() {
  cached = null;
}

export type IntegrationStatus = { configured: boolean; detail: string };

export function integrationStatus() {
  const e = env();
  const razorpay = Boolean(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET);
  return {
    razorpay: {
      configured: razorpay,
      mode: razorpay ? (e.RAZORPAY_KEY_ID!.startsWith("rzp_live_") ? "live" : "test") : "not configured",
      webhook: Boolean(e.RAZORPAY_WEBHOOK_SECRET),
    },
    mockPayments: !razorpay && e.ENABLE_MOCK_PAYMENTS && e.APP_ENV !== "production",
    email: { configured: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM) },
    storage: { configured: Boolean(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY), bucket: e.SUPABASE_STORAGE_BUCKET },
    shiprocket: { configured: Boolean(e.SHIPROCKET_EMAIL && e.SHIPROCKET_PASSWORD && e.SHIPROCKET_PICKUP_PINCODE) },
    appEnv: e.APP_ENV,
  };
}
