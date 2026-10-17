"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { orderRequestAction, submitReviewAction } from "@/app/actions/orders";
import { Button } from "../ui/button";
import { Textarea, Select } from "../ui/form";

export function RequestForm({ orderNumber, token, type, label, description }: { orderNumber: string; token: string | null; type: "cancellation" | "return" | "refund"; label: string; description: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await orderRequestAction(orderNumber, token, { type, reason });
      if (r.ok) {
        toast.success(r.message);
        setOpen(false);
        router.refresh();
      } else setErr(r.errors?.reason ?? r.message);
    });
  }
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="w-full border border-line bg-paper p-4" noValidate>
      <p className="text-sm text-charcoal">{description}</p>
      <label htmlFor={`reason-${type}`} className="mt-3 mb-1.5 block text-xs font-medium">
        Reason
      </label>
      <Textarea id={`reason-${type}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={3} aria-invalid={!!err} />
      {err && <p className="mt-1 text-xs text-danger" role="alert">{err}</p>}
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Submit request
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReviewForm({ orderItemId, productName }: { orderItemId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="text-xs text-success">Thanks — your review is awaiting moderation.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-stone underline underline-offset-2 hover:text-ink">
        Write a review
      </button>
    );
  return (
    <form
      className="mt-3 space-y-2 border border-line bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitReviewAction({ orderItemId, rating, title, body });
          if (r.ok) setDone(true);
          else setErr(r.errors?.body ?? r.message);
        });
      }}
    >
      <p className="text-sm font-medium">Review {productName}</p>
      <label className="block text-xs" htmlFor={`rating-${orderItemId}`}>
        Rating
      </label>
      <Select id={`rating-${orderItemId}`} value={rating} onChange={(e) => setRating(e.target.value)} className="h-9 w-32">
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} star{n > 1 ? "s" : ""}
          </option>
        ))}
      </Select>
      <label className="block text-xs" htmlFor={`title-${orderItemId}`}>
        Title (optional)
      </label>
      <input id={`title-${orderItemId}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="h-9 w-full border border-line bg-paper px-3 text-sm" />
      <label className="block text-xs" htmlFor={`body-${orderItemId}`}>
        Your review
      </label>
      <Textarea id={`body-${orderItemId}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} />
      {err && <p className="text-xs text-danger">{err}</p>}
      <Button type="submit" size="sm" loading={pending}>
        Submit review
      </Button>
    </form>
  );
}
