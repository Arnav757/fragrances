"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authenticate, AuthError, changePassword, registerUser, requestPasswordReset, resetPassword } from "@/lib/services/auth";
import { endSession, getCurrentUser, startSession } from "@/lib/auth/session";
import { CART_COOKIE, mergeGuestCartIntoUser } from "@/lib/services/cart";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { fieldErrors } from "@/lib/forms";
import { profileSchema, savedAddressSchema } from "@/lib/validation";
import { db } from "@/lib/db";

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string> } | null;

/** Only allow same-site relative redirects after login. */
function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/account";
}

async function afterSignIn(userId: string) {
  const jar = await cookies();
  await mergeGuestCartIntoUser(userId, jar.get(CART_COOKIE)?.value);
  jar.delete(CART_COOKIE);
  await startSession(userId);
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const ip = await clientIp();
  if (!(await rateLimit(`login:ip:${ip}`, 20, 900)) || !(await rateLimit(`login:email:${email.toLowerCase().slice(0, 254)}`, 8, 900))) {
    return { message: "Too many sign-in attempts. Please wait 15 minutes and try again.", values: { email } };
  }
  let role: string;
  try {
    const u = await authenticate({ email, password: form.get("password") });
    await afterSignIn(u.id);
    role = u.role;
  } catch (e) {
    if (e instanceof z.ZodError) return { errors: fieldErrors(e), values: { email } };
    if (e instanceof AuthError) return { message: e.message, values: { email } };
    throw e;
  }
  const next = safeNext(form.get("next"));
  redirect(role === "admin" && next === "/account" ? "/admin" : next);
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const values = { fullName: String(form.get("fullName") ?? ""), email: String(form.get("email") ?? "") };
  if (!(await rateLimit(`register:${await clientIp()}`, 5, 3600))) return { message: "Too many sign-ups from this network. Please try again later.", values };
  try {
    const u = await registerUser({ ...values, password: form.get("password") });
    await afterSignIn(u.id);
  } catch (e) {
    if (e instanceof z.ZodError) return { errors: fieldErrors(e), values };
    if (e instanceof AuthError) return { message: e.message, values };
    throw e;
  }
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  if (!(await rateLimit(`forgot:${await clientIp()}`, 5, 3600))) return { message: "Too many requests. Please try again later." };
  // Per-address cap so nobody can flood one inbox with reset emails. Over the cap we answer exactly as
  // usual (without sending) so the response never reveals whether the address has an account.
  const perEmail = await rateLimit(`forgot:email:${email.trim().toLowerCase().slice(0, 254)}`, 3, 3600);
  try {
    if (perEmail) await requestPasswordReset(email);
  } catch (e) {
    if (e instanceof z.ZodError) return { errors: fieldErrors(e), values: { email } };
    throw e;
  }
  return { ok: true, message: "If an account exists for that email, we've sent a link to reset your password. It expires in 60 minutes." };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!(await rateLimit(`reset:${await clientIp()}`, 10, 3600))) return { message: "Too many attempts. Please try again later." };
  if (form.get("password") !== form.get("confirm")) return { errors: { confirm: "Passwords don't match" } };
  try {
    await resetPassword(String(form.get("token") ?? ""), form.get("password"));
  } catch (e) {
    if (e instanceof z.ZodError) return { errors: { password: fieldErrors(e)._form ?? "Invalid password" } };
    if (e instanceof AuthError) return { message: e.message };
    throw e;
  }
  redirect("/login?reset=1");
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = profileSchema.safeParse({ fullName: form.get("fullName"), phone: form.get("phone") ?? "" });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await db()`update profiles set full_name = ${parsed.data.fullName}, phone = ${parsed.data.phone || null} where id = ${user.id}`;
  revalidatePath("/account");
  return { ok: true, message: "Profile updated." };
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await rateLimit(`chpw:${user.id}`, 5, 900))) return { message: "Too many attempts. Please try again later." };
  try {
    await changePassword(user.id, String(form.get("current") ?? ""), form.get("password"));
  } catch (e) {
    if (e instanceof z.ZodError) return { errors: { password: fieldErrors(e)._form ?? "Invalid password" } };
    if (e instanceof AuthError) return { errors: { current: e.message } };
    throw e;
  }
  return { ok: true, message: "Password changed." };
}

export async function saveAddressAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const raw = Object.fromEntries(["label", "fullName", "phone", "line1", "line2", "landmark", "city", "state", "pincode"].map((k) => [k, String(form.get(k) ?? "")]));
  const parsed = savedAddressSchema.safeParse({ ...raw, isDefault: form.get("isDefault") === "on" });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const a = parsed.data;
  const id = String(form.get("id") ?? "");
  await db().begin(async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from addresses where user_id = ${user.id}`;
    const makeDefault = a.isDefault || n === 0;
    if (makeDefault) await tx`update addresses set is_default = false where user_id = ${user.id}`;
    if (id) {
      await tx`update addresses set label = ${a.label || null}, full_name = ${a.fullName}, phone = ${a.phone}, line1 = ${a.line1}, line2 = ${a.line2 || null},
               landmark = ${a.landmark || null}, city = ${a.city}, state = ${a.state}, pincode = ${a.pincode}, is_default = ${makeDefault} or is_default
               where id = ${id} and user_id = ${user.id}`;
    } else {
      if (n >= 20) throw new Error("Address limit reached");
      await tx`insert into addresses (user_id, label, full_name, phone, line1, line2, landmark, city, state, pincode, is_default)
               values (${user.id}, ${a.label || null}, ${a.fullName}, ${a.phone}, ${a.line1}, ${a.line2 || null}, ${a.landmark || null}, ${a.city}, ${a.state}, ${a.pincode}, ${makeDefault})`;
    }
  });
  revalidatePath("/account/addresses");
  return { ok: true, message: "Address saved." };
}

export async function deleteAddressAction(id: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!z.uuid().safeParse(id).success) return;
  await db()`delete from addresses where id = ${id} and user_id = ${user.id}`;
  revalidatePath("/account/addresses");
}
