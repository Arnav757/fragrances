import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, type Queryable } from "../db";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "fm_session";
const SESSION_DAYS = 14;

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "stylist" | "admin";
};

const secure = () => process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES;

/** Creates a DB session (storing only the token hash) and returns the raw token. */
export async function createSessionRecord(userId: string, userAgent: string | null, q: Queryable = db()): Promise<string> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await q`insert into sessions (token_hash, user_id, expires_at, user_agent)
          values (${sha256(token)}, ${userId}, ${expires}, ${userAgent?.slice(0, 300) ?? null})`;
  return token;
}

export async function startSession(userId: string) {
  const h = await headers();
  const token = await createSessionRecord(userId, h.get("user-agent"));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db()`delete from sessions where token_hash = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

export async function userFromToken(token: string | undefined, q: Queryable = db()): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const rows = await q<SessionUser[]>`
    select p.id, p.email, p.full_name, p.role
    from sessions s join profiles p on p.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now() and not p.is_disabled`;
  return rows[0] ?? null;
}

/** Current user for this request (deduplicated per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
});


export class AuthorizationError extends Error {
  constructor(message = "Not authorised") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For staff pages (stylists and admins): redirects everyone else. Always checked against the database. */
export async function requireStaffPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  return user;
}

/** For admin-only pages (settings, discounts, refunds). */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireStaffPage();
  if (user.role !== "admin") redirect("/admin");
  return user;
}

/** For staff server actions / route handlers: throws instead of redirecting. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new AuthorizationError();
  return user;
}

export async function revokeOtherSessions(userId: string, keepToken?: string) {
  if (keepToken) await db()`delete from sessions where user_id = ${userId} and token_hash <> ${sha256(keepToken)}`;
  else await db()`delete from sessions where user_id = ${userId}`;
}
