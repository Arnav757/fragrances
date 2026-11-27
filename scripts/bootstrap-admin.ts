/**
 * Creates the first admin from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD, so a fresh deploy
 * needs no terminal. Runs during `vercel-build`, after migrations.
 *  - Does nothing when the variables aren't set.
 *  - Does nothing when ANY admin already exists — it never changes an existing password or role.
 * Remove the variables from Vercel once you've signed in.
 */
import { hash } from "@node-rs/argon2";
import postgres from "postgres";
import { loadEnv } from "./load-env";
import { migrationDbUrl } from "./db-url";

loadEnv();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL is not a valid email address.");
  if (!password || password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");
  const url = migrationDbUrl();
  if (!url) throw new Error("No database configured.");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const existing = await sql<{ n: number }[]>`select count(*)::int as n from profiles where role = 'admin'`;
    if (existing[0]!.n > 0) {
      console.log("bootstrap admin: an admin already exists — skipped (you can remove BOOTSTRAP_ADMIN_* now)");
      return;
    }
    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const rows = await sql<{ id: string }[]>`
      insert into profiles (email, password_hash, full_name, role) values (${email}, ${passwordHash}, 'Administrator', 'admin')
      on conflict (email) do nothing returning id`;
    if (!rows[0]) {
      console.log("bootstrap admin: that email already has a stylist account — skipped; promote it with npm run admin:create");
      return;
    }
    await sql`insert into audit_logs (actor_id, action, entity, entity_id, metadata) values (null, 'admin.bootstrap', 'profile', ${rows[0].id}, ${sql.json({ email })})`;
    console.log(`bootstrap admin: created ${email}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
