"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePasswordAction, forgotPasswordAction, loginAction, resetPasswordAction, type FormState } from "@/app/actions/auth";
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
