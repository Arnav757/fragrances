import "server-only";
import postgres from "postgres";
import { env } from "./env";

type Sql = postgres.Sql<Record<string, unknown>>;

const globalForDb = globalThis as unknown as { __noirSql?: Sql };

function create(): Sql {
  return postgres(env().DATABASE_URL, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    transform: postgres.camel,
    onnotice: () => {},
    idle_timeout: 20,
  });
}

/** Lazily-created shared connection pool. Column names are camelCased in results. */
export function db(): Sql {
  if (!globalForDb.__noirSql) globalForDb.__noirSql = create();
  return globalForDb.__noirSql;
}

export type Tx = postgres.TransactionSql<Record<string, unknown>>;
export type Queryable = Sql | Tx;
