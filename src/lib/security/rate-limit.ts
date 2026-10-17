import "server-only";
import { db, type Queryable } from "../db";

/**
 * Fixed-window rate limiter stored in Postgres, so it works across serverless instances.
 * Returns true when the action is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, q: Queryable = db()): Promise<boolean> {
  const rows = await q<{ count: number }[]>`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count`;
  return (rows[0]?.count ?? 0) <= limit;
}

export class RateLimitError extends Error {
  constructor() {
    super("Too many attempts. Please wait a few minutes and try again.");
    this.name = "RateLimitError";
  }
}
