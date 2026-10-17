"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePasswordAction, forgotPasswordAction, loginAction, registerAction, resetPasswordAction, updateProfileAction, type FormState } from "@/app/actions/auth";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/form";
import { Notice } from "../ui/misc";

function errProps(state: FormState, name: string) {
  const err = state?.errors?.[name];
  return { "aria-invalid": !!err, "aria-describedby": err ? `${name}-error` : undefined };
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state?.message && <Notice tone="danger">{state.message}</Notice>}
      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} {...errProps(state, "email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required {...errProps(state, "password")} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-xs text-stone underline underline-offset-2 hover:text-ink">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(registerAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state?.message && <Notice tone="danger">{state.message}</Notice>}
      <Field label="Full name" htmlFor="fullName" error={state?.errors?.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={state?.values?.fullName} {...errProps(state, "fullName")} />
      </Field>
      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} {...errProps(state, "email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.errors?.password} hint="At least 10 characters, including a letter and a number">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} {...errProps(state, "password")} />
      </Field>
      <p className="text-xs leading-relaxed text-stone">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
      </p>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Create account
      </Button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message && <Notice tone="danger">{state.message}</Notice>}
      <Field label="Email" htmlFor="email" error={state?.errors?.email ?? state?.errors?._form}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {state?.message && <Notice tone="danger">{state.message}</Notice>}
      <Field label="New password" htmlFor="password" error={state?.errors?.password} hint="At least 10 characters, including a letter and a number">
        <Input id="password" name="password" type="password" autoComplete="new-password" required {...errProps(state, "password")} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={state?.errors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required {...errProps(state, "confirm")} />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Set new password
      </Button>
    </form>
  );
}

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string | null; email: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <Field label="Email" htmlFor="profile-email" hint="Contact us to change the email on your account">
        <Input id="profile-email" value={email} disabled readOnly />
      </Field>
      <Field label="Full name" htmlFor="fullName" error={state?.errors?.fullName}>
        <Input id="fullName" name="fullName" defaultValue={fullName} autoComplete="name" />
      </Field>
      <Field label="Mobile number" htmlFor="phone" error={state?.errors?.phone} optional>
        <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} autoComplete="tel-national" />
      </Field>
      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      {state?.message && !state.ok && <Notice tone="danger">{state.message}</Notice>}
      <Field label="Current password" htmlFor="current" error={state?.errors?.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" />
      </Field>
      <Field label="New password" htmlFor="new-password" error={state?.errors?.password}>
        <Input id="new-password" name="password" type="password" autoComplete="new-password" />
      </Field>
      <Button type="submit" variant="outline" loading={pending}>
        Change password
      </Button>
    </form>
  );
}
