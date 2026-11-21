import { afterEach, describe, expect, it } from "vitest";
import { env, resetEnvCache } from "@/lib/env";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
});

describe("database URL", () => {
  it("falls back to POSTGRES_URL and drops Supabase's non-standard parameter", () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://u:p@db.example.com:6543/postgres?sslmode=require&supa=base-pooler.x";
    resetEnvCache();
    expect(env().DATABASE_URL).toBe("postgres://u:p@db.example.com:6543/postgres?sslmode=require");
  });

  it("prefers DATABASE_URL when both are set", () => {
    process.env.DATABASE_URL = "postgres://a@localhost/a";
    process.env.POSTGRES_URL = "postgres://b@localhost/b";
    resetEnvCache();
    expect(env().DATABASE_URL).toBe("postgres://a@localhost/a");
  });

  it("refuses simulated payments in production", () => {
    process.env.APP_ENV = "production";
    process.env.APP_SECRET = "x".repeat(40);
    process.env.ENABLE_MOCK_PAYMENTS = "true";
    resetEnvCache();
    expect(() => env()).toThrow(/ENABLE_MOCK_PAYMENTS/);
  });
});
