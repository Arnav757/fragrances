/**
 * Resolve the Postgres URL from the variable names used by different hosts:
 * DATABASE_URL (Neon on Vercel, plain Postgres), or POSTGRES_URL / POSTGRES_URL_NON_POOLING (Supabase on Vercel).
 * Supabase's Vercel integration appends a non-standard `supa` query parameter, which Postgres rejects; drop it.
 */
export function cleanDbUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    u.searchParams.delete("supa");
    return u.toString();
  } catch {
    return raw;
  }
}

/** For migrations prefer a direct (non-pooled) connection when one is available. */
export function migrationDbUrl(): string | undefined {
  const e = process.env;
  return cleanDbUrl(e.MIGRATION_DATABASE_URL || e.POSTGRES_URL_NON_POOLING || e.DATABASE_URL || e.POSTGRES_URL);
}
