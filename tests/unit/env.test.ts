import { afterEach, describe, expect, it } from "vitest";
import { env, resetEnvCache } from "@/lib/env";

const keys = ["SUPABASE_URL", "CRON_SECRET", "APP_SECRET", "SUPABASE_STORAGE_BUCKET"] as const;
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetEnvCache();
});

describe("env", () => {
  it("treats blank values copied from .env.example as unset", () => {
    for (const k of keys) process.env[k] = "";
    resetEnvCache();
    const e = env();
    expect(e.SUPABASE_URL).toBeUndefined();
    expect(e.CRON_SECRET).toBeUndefined();
    expect(e.APP_SECRET.startsWith("dev-only")).toBe(true);
    expect(e.SUPABASE_STORAGE_BUCKET).toBe("product-images");
  });

  it("still rejects invalid non-blank values", () => {
    process.env.SUPABASE_URL = "not a url";
    resetEnvCache();
    expect(() => env()).toThrow(/SUPABASE_URL/);
  });
});
