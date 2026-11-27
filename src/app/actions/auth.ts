"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authenticate, AuthError, changePassword, requestPasswordReset, resetPassword } from "@/lib/services/auth";
import { endSession, getCurrentUser, startSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { fieldErrors } from "@/lib/forms";

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string> } | null;

/** Only allow same-site relative redirects after login. */
function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin";
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const ip = await clientIp();
  if (!(await rateLimit(`login:ip:${ip}`, 20, 900)) || !(await rateLimit(`login:email:${email.toLowerCase().slice(0, 254)}`, 8, 900))) {
    return { message: "Too many sign-in attempts. Please wait 15 minutes and try again.", values: { email } };
  }
  try {
    const u = await authenticate({ email, password: form.get("password") });
    await startSession(u.id);
  } catch (e) {
    if (e instanceof z.ZodError) return { errors: fieldErrors(e), values: { email } };
    if (e instanceof AuthError) return { message: e.message, values: { email } };
    throw e;
  }
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  if (!(await rateLimit(`forgot:${await clientIp()}`, 5, 3600))) return { message: "Too many requests. Please try again later." };
  const perEmail = await rateLimit(`forgot:email:${email.trim().toLowerCase().slice(0, 254)}`, 3, 3600);
  try {
    if (perEmail) await requestPasswordReset(email);
  } catch (e) {
    if (e instanceof z.ZodError) return { errors: fieldErrors(e), values: { email } };
    throw e;
  }
  return { ok: true, message: "If a staff account exists for that email, we've sent a reset link. It expires in 60 minutes." };
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
