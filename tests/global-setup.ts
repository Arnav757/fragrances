import { execSync } from "node:child_process";
import postgres from "postgres";

/** Recreates the test database schema, applies migrations and seeds demo data before the suite. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/noir_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists app_meta cascade; create schema public;");
  await sql.end();
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx tsx scripts/migrate.ts", { env, stdio: "pipe" });
  execSync("npx tsx scripts/seed.ts", { env, stdio: "pipe" });
}
