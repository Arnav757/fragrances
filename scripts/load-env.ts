import { config } from "dotenv";

/** Load .env.local then .env (Next.js convention) for CLI scripts. */
export function loadEnv() {
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", quiet: true });
}
