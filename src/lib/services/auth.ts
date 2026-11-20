import "server-only";
import { db } from "../db";
import { dummyHash, hashPassword, verifyPassword } from "../auth/password";
import { randomToken, sha256 } from "../auth/crypto";
import { emailSchema, loginSchema, passwordSchema } from "../validation";
import { emailContext, sendEmail, siteUrl } from "../email/send";
import { templates } from "../email/templates";

export class AuthError extends Error {}

export async function authenticate(input: unknown): Promise<{ id: string; role: "stylist" | "admin" }> {
  const data = loginSchema.parse(input);
  const rows = await db()<{ id: string; passwordHash: string; role: "stylist" | "admin"; isDisabled: boolean }[]>`
    select id, password_hash, role, is_disabled from profiles where email = ${data.email}`;
  const u = rows[0];
  const ok = await verifyPassword(u?.passwordHash ?? (await dummyHash()), data.password);
  if (!u || !ok || u.isDisabled) throw new AuthError("Incorrect email or password.");
  return { id: u.id, role: u.role };
}

/** Always behaves the same whether or not the email exists (no account enumeration). */
export async function requestPasswordReset(emailInput: unknown): Promise<void> {
  const email = emailSchema.parse(emailInput);
  const rows = await db()<{ id: string; fullName: string }[]>`select id, full_name from profiles where email = ${email} and not is_disabled`;
  const u = rows[0];
  if (!u) return;
  const token = randomToken(32);
  await db()`delete from password_reset_tokens where user_id = ${u.id}`;
  await db()`insert into password_reset_tokens (token_hash, user_id, expires_at) values (${sha256(token)}, ${u.id}, now() + interval '60 minutes')`;
  const ctx = await emailContext();
  await sendEmail(email, "password_reset", templates.password_reset(ctx, { name: u.fullName, resetUrl: siteUrl(`/reset-password?token=${token}`) }));
}

export async function resetPassword(token: string, newPassword: unknown): Promise<string> {
  const password = passwordSchema.parse(newPassword);
  if (!token || token.length > 200) throw new AuthError("This reset link is invalid or has expired.");
  const hash = await hashPassword(password);
  return db().begin(async (tx) => {
    const rows = await tx<{ userId: string }[]>`
      update password_reset_tokens set used_at = now()
      where token_hash = ${sha256(token)} and used_at is null and expires_at > now() returning user_id`;
    const userId = rows[0]?.userId;
    if (!userId) throw new AuthError("This reset link is invalid or has expired.");
    await tx`update profiles set password_hash = ${hash} where id = ${userId}`;
    await tx`delete from sessions where user_id = ${userId}`; // sign out everywhere
    return userId;
  });
}

export async function changePassword(userId: string, current: string, next: unknown) {
  const password = passwordSchema.parse(next);
  const rows = await db()<{ passwordHash: string }[]>`select password_hash from profiles where id = ${userId}`;
  if (!rows[0] || !(await verifyPassword(rows[0].passwordHash, current))) throw new AuthError("Your current password is incorrect.");
  await db()`update profiles set password_hash = ${await hashPassword(password)} where id = ${userId}`;
}
