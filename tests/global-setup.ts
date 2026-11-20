import { execSync } from "node:child_process";
import postgres from "postgres";

/** Recreates the test database schema and applies migrations before the suite. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/forma_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists app_meta cascade; create schema public;");
  await sql.end();
  execSync("npx tsx scripts/migrate.ts", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
