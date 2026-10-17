import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Minimal stand-in for Next's request APIs so server-side auth checks can run under test.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    set: (n: string, v: string) => jar.set(n, v),
    delete: (n: string) => jar.delete(n),
  }),
  headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": "10.0.0." + Math.floor(Math.random() * 250) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, refresh: () => {} }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const { db } = await import("@/lib/db");
const { createSessionRecord, requireAdmin, getCurrentUser, SESSION_COOKIE, AuthorizationError } = await import("@/lib/auth/session");
const { registerUser, authenticate, AuthError, requestPasswordReset, resetPassword } = await import("@/lib/services/auth");
const { changeStatusAction, refundAction } = await import("@/app/actions/admin-orders");
const { saveProductAction } = await import("@/app/actions/admin-catalog");
const { saveSettingsAction } = await import("@/app/actions/admin-settings");
const { createUser } = await import("../helpers");

afterAll(async () => {
  await db().end();
});
beforeEach(() => jar.clear());

async function signInAs(userId: string) {
  jar.set(SESSION_COOKIE, await createSessionRecord(userId, "vitest"));
}

describe("authentication", () => {
  it("registers with a hashed password and rejects duplicates and weak passwords", async () => {
    const u = await registerUser({ fullName: "Riya", email: "Riya@Example.com", password: "perfume-lover-42" });
    const row = (await db()<{ passwordHash: string; email: string }[]>`select password_hash, email from profiles where id = ${u.id}`)[0]!;
    expect(row.email).toBe("riya@example.com");
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(registerUser({ fullName: "R", email: "riya@example.com", password: "perfume-lover-42" })).rejects.toThrow();
    await expect(registerUser({ fullName: "Weak", email: "weak@example.com", password: "short" })).rejects.toThrow();
    await expect(authenticate({ email: "riya@example.com", password: "wrong-password-1" })).rejects.toBeInstanceOf(AuthError);
    expect((await authenticate({ email: "RIYA@example.com", password: "perfume-lover-42" })).role).toBe("customer");
  });

  it("resets passwords with a single-use token and signs out other sessions", async () => {
    await registerUser({ fullName: "Kabir", email: "kabir@example.com", password: "first-password-1" });
    const uid = (await db()<{ id: string }[]>`select id from profiles where email = 'kabir@example.com'`)[0]!.id;
    await createSessionRecord(uid, "old device");
    await requestPasswordReset("kabir@example.com");
    const mail = (await db()<{ textBody: string }[]>`select text_body from email_outbox where to_email = 'kabir@example.com' and template = 'password_reset' order by created_at desc limit 1`)[0]!;
    const token = mail.textBody.match(/token=([A-Za-z0-9_-]+)/)![1]!;
    await resetPassword(token, "second-password-2");
    await expect(resetPassword(token, "third-password-3")).rejects.toBeInstanceOf(AuthError);
    expect((await db()`select 1 from sessions where user_id = ${uid}`).length).toBe(0);
    expect((await authenticate({ email: "kabir@example.com", password: "second-password-2" })).id).toBe(uid);
    // unknown emails behave identically (no enumeration)
    await expect(requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
  });

  it("ignores expired or forged session tokens", async () => {
    const uid = await createUser("sess@example.com");
    const token = await createSessionRecord(uid, "x");
    jar.set(SESSION_COOKIE, token);
    expect((await getCurrentUser())?.id).toBe(uid);
    jar.set(SESSION_COOKIE, token + "x");
    expect(await getCurrentUser()).toBeNull();
    jar.set(SESSION_COOKIE, token);
    await db()`update sessions set expires_at = now() - interval '1 minute' where user_id = ${uid}`;
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("admin authorisation (server-side)", () => {
  it("rejects anonymous users and customers on admin checks and actions", async () => {
    await expect(requireAdmin()).rejects.toBeInstanceOf(AuthorizationError);
    const customer = await createUser("shopper@example.com");
    await signInAs(customer);
    await expect(requireAdmin()).rejects.toBeInstanceOf(AuthorizationError);
    const someOrder = (await db()<{ id: string }[]>`select id from orders limit 1`)[0];
    const anyId = someOrder?.id ?? "00000000-0000-4000-8000-000000000000";
    for (const r of [
      await changeStatusAction(anyId, "cancelled", "", false),
      await refundAction(anyId, { amountPaise: 100, reason: "steal", viaGateway: false }),
      await saveProductAction(null, {}),
      await saveSettingsAction("commerce", { codEnabled: true }),
    ]) {
      expect(r.ok).toBe(false);
    }
    const cod = (await db()<{ value: { codEnabled?: boolean } }[]>`select value from settings where key = 'commerce'`)[0]?.value?.codEnabled;
    expect(cod ?? false).not.toBe(true);
  });

  it("allows admins", async () => {
    const adminId = await createUser("chief@example.com", "admin");
    await signInAs(adminId);
    expect((await requireAdmin()).id).toBe(adminId);
    const r = await saveSettingsAction("store", { announcement: "Hello from tests" });
    expect(r.ok).toBe(true);
    expect((await db()`select 1 from audit_logs where actor_id = ${adminId} and action = 'settings.store'`).length).toBe(1);
  });

  it("disabled accounts lose access immediately", async () => {
    const id = await createUser("gone@example.com", "admin");
    await signInAs(id);
    await db()`update profiles set is_disabled = true where id = ${id}`;
    await expect(requireAdmin()).rejects.toBeInstanceOf(AuthorizationError);
  });
});
