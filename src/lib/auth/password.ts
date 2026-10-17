import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id with OWASP-recommended parameters (19 MiB memory, 2 iterations, 1 lane).
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTS);
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  try {
    return await verify(hashValue, password);
  } catch {
    return false;
  }
}

// A real hash of a random string, used to equalise timing when an email doesn't exist.
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hash("timing-equaliser-" + Math.random(), OPTS);
  return dummy;
}
