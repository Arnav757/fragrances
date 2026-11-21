/**
 * Applies SQL files from supabase/migrations in filename order, once each.
 * Usage: npm run db:migrate   (uses DATABASE_URL — or POSTGRES_URL[_NON_POOLING] — from .env.local / environment)
 * Runs automatically on Vercel before every build (see the `vercel-build` script in package.json).
 * A Postgres advisory lock makes concurrent runs (two deploys at once) safe: the second waits, then finds nothing to do.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { loadEnv } from "./load-env";
import { migrationDbUrl } from "./db-url";

loadEnv();

const LOCK_ID = 727_001; // arbitrary, constant per app

async function main() {
  const url = migrationDbUrl();
  if (!url) {
    throw new Error(
      "No database configured. Set DATABASE_URL (or add a Supabase/Neon database to the Vercel project, which sets POSTGRES_URL / DATABASE_URL).",
    );
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, connect_timeout: 30 });
  try {
    await sql`select pg_advisory_lock(${LOCK_ID})`;
    await sql`create schema if not exists app_meta`;
    await sql`create table if not exists app_meta.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const applied = new Set((await sql<{ name: string }[]>`select name from app_meta.schema_migrations`).map((r) => r.name));
    let n = 0;
    for (const f of files) {
      if (applied.has(f)) continue;
      const body = await readFile(path.join(dir, f), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into app_meta.schema_migrations (name) values (${f})`;
      });
      console.log(`applied ${f}`);
      n++;
    }
    console.log(n ? `migrations applied: ${n}` : "migrations up to date");
  } finally {
    await sql`select pg_advisory_unlock(${LOCK_ID})`.catch(() => {});
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
