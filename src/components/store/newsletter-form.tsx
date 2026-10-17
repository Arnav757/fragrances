"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "@/app/actions/newsletter";
import { Button } from "../ui/button";

export function NewsletterForm({ storeName, tone = "light" }: { storeName: string; tone?: "light" | "dark" }) {
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  if (state?.ok) {
    return <p role="status" className="text-sm">Thank you — you&apos;re subscribed. You can unsubscribe at any time by contacting us.</p>;
  }
  const dark = tone === "dark";
  return (
    <form action={action} className="w-full max-w-md" noValidate>
      <div className={`flex border-b ${dark ? "border-paper/40" : "border-ink"}`}>
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Your email address"
          className={`h-12 w-full bg-transparent text-sm focus:outline-none ${dark ? "text-paper placeholder:text-paper/50" : "text-ink placeholder:text-mist"}`}
          aria-invalid={Boolean(state?.errors?.email)}
        />
        <Button type="submit" variant={dark ? "gold" : "primary"} size="sm" className="my-1.5" loading={pending}>
          Subscribe
        </Button>
      </div>
      <label className={`mt-4 flex items-start gap-2.5 text-xs leading-relaxed ${dark ? "text-paper/70" : "text-stone"}`}>
        <input type="checkbox" name="consent" value="yes" required className="mt-0.5 accent-gold" />
        <span>
          I agree to receive occasional emails from {storeName} about new arrivals and offers. I can unsubscribe at any time. See our{" "}
          <a href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </span>
      </label>
      {(state?.errors?.email || state?.errors?.consent || state?.message) && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {state.errors?.email ?? state.errors?.consent ?? state.message}
        </p>
      )}
    </form>
  );
}
