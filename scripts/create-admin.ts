/**
 * Creates an administrator, or promotes an existing account to admin.
 * Usage: npm run admin:create -- you@example.com "Your Name"
 * The password is read from ADMIN_PASSWORD or prompted for (input hidden is not supported by all terminals,
 * so prefer: ADMIN_PASSWORD='…' npm run admin:create -- you@example.com "Your Name").
 */
import { createInterface } from "node:readline/promises";
import { hash } from "@node-rs/argon2";
import postgres from "postgres";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: npm run admin:create -- you@example.com "Your Name"');
    process.exit(1);
  }
  const name = nameParts.join(" ") || "Administrator";
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Password (min 12 chars): ");
    rl.close();
  }
  if (!password || password.length < 12) {
    console.error("Admin passwords must be at least 12 characters.");
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const rows = await sql<{ id: string }[]>`
    insert into profiles (email, password_hash, full_name, role) values (${email.toLowerCase()}, ${passwordHash}, ${name}, 'admin')
    on conflict (email) do update set role = 'admin', password_hash = excluded.password_hash
    returning id`;
  await sql`insert into audit_logs (actor_id, action, entity, entity_id, metadata) values (null, 'admin.create_cli', 'profile', ${rows[0]!.id}, ${sql.json({ email })})`;
  console.log(`Admin ready: ${email}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
