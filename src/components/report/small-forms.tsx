"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { emailPreviewAction, findReportAction, requestRevisionAction } from "@/app/actions/analysis";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Textarea } from "../ui/form";
import { Notice } from "../ui/misc";

export function EmailPreviewForm({ token }: { token: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (msg?.ok) return <Notice tone="success">{msg.text}</Notice>;
  return (
    <form
      action={(f) =>
        start(async () => {
          const r = await emailPreviewAction(token, String(f.get("email") ?? ""), f.get("marketing") === "on");
          setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Sent.") : r.message });
        })
      }
      className="space-y-3"
    >
      {msg && !msg.ok && <Notice tone="danger">{msg.text}</Notice>}
      <div className="flex gap-2">
        <label htmlFor="preview-email" className="sr-only">
          Email
        </label>
        <Input id="preview-email" name="email" type="email" placeholder="you@example.com" required className="flex-1" autoComplete="email" />
        <Button type="submit" variant="outline" loading={pending}>
          Email it
        </Button>
      </div>
      <Checkbox id="preview-marketing" name="marketing" label={<span className="text-xs">Also send me occasional style tips (optional).</span>} />
    </form>
  );
}

export function RevisionForm({ token, open }: { token: string; open: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (open) return <Notice>You have a revision request open. A stylist will update your report and email you.</Notice>;
  if (msg?.ok) return <Notice tone="success">{msg.text}</Notice>;
  return (
    <form
      action={(f) =>
        start(async () => {
          const r = await requestRevisionAction(token, String(f.get("message") ?? ""));
          setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Sent.") : r.message });
          if (r.ok) router.refresh();
        })
      }
      className="space-y-3"
    >
      {msg && !msg.ok && <Notice tone="danger">{msg.text}</Notice>}
      <Field label="What should we look at again?" htmlFor="revision-message" hint="e.g. “I always get compliments in navy but it's not in my palette”">
        <Textarea id="revision-message" name="message" required minLength={10} maxLength={2000} />
      </Field>
      <Button type="submit" variant="outline" loading={pending}>
        Ask for a revision
      </Button>
    </form>
  );
}

export function FindForm() {
  const [state, action, pending] = useActionState(findReportAction, null);
  if (state?.ok) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.message && <Notice tone="danger">{state.message}</Notice>}
      <Field label="Email you used at checkout" htmlFor="find-email">
        <Input id="find-email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Email me my links
      </Button>
    </form>
  );
}
