import { z } from "zod";

/** First error message per field path (dot-joined), for showing next to form inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; message: string; errors?: Record<string, string> };

/** Convert known errors into a user-safe action result; unknown errors get a generic message. */
export function toActionError(e: unknown, knownTypes: (new (...args: never[]) => Error)[] = []): { ok: false; message: string; errors?: Record<string, string> } {
  if (e instanceof z.ZodError) return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(e) };
  if (e instanceof Error && knownTypes.some((t) => e instanceof t)) return { ok: false, message: e.message };
  if (e instanceof Error && (e.name === "AuthorizationError" || e.name === "RateLimitError")) return { ok: false, message: e.message };
  console.error("[action] unexpected error", e);
  return { ok: false, message: "Something went wrong. Please try again." };
}
