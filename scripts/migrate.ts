/**
 * Applies SQL files from supabase/migrations in filename order, once each.
 * Usage: npm run db:migrate            (uses DATABASE_URL from .env.local / environment)
 * You can also apply the same files with the Supabase CLI (`supabase db push`).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql`create schema if not exists app_meta`;
    await sql`create table if not exists app_meta.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const applied = new Set((await sql<{ name: string }[]>`select name from app_meta.schema_migrations`).map((r) => r.name));
    for (const f of files) {
      if (applied.has(f)) continue;
      const body = await readFile(path.join(dir, f), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into app_meta.schema_migrations (name) values (${f})`;
      });
      console.log(`applied ${f}`);
    }
    console.log("migrations up to date");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
