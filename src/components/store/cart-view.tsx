"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { acknowledgePricesAction, applyDiscountAction, removeDiscountAction, updateCartQuantityAction } from "@/app/actions/cart";
import type { CartLine, CartIssue } from "@/lib/services/cart";
import { formatINR } from "@/lib/money";
import { QuantityStepper } from "./product-actions";
import { Button } from "../ui/button";
import { Notice } from "../ui/misc";

export function CartLines({ lines, issues }: { lines: CartLine[]; issues: CartIssue[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const priceChanged = issues.some((i) => !i.blocking && i.productId);

  function update(id: string, qty: number) {
    setBusyId(id);
    start(async () => {
      const r = await updateCartQuantityAction(id, qty);
      if (!r.ok) toast.error(r.message);
      else if (qty === 0) toast("Removed from your cart");
      router.refresh();
      setBusyId(null);
    });
  }

  return (
    <div>
      {issues.filter((i) => i.blocking).map((i) => (
        <Notice key={i.message} tone="danger" className="mb-3">
          {i.message}
        </Notice>
      ))}
      {priceChanged && (
        <Notice tone="warning" className="mb-4">
          <span>Some prices have changed since you added them. The current prices are shown below.</span>{" "}
          <button
            type="button"
            className="ml-1 underline underline-offset-2"
            onClick={() =>
              start(async () => {
                await acknowledgePricesAction();
                router.refresh();
              })
            }
          >
            OK, got it
          </button>
        </Notice>
      )}
      <ul className="divide-y divide-line border-y border-line" aria-busy={pending}>
        {lines.map((l) => {
          const unavailable = !l.isActive || l.availability !== "available";
          return (
            <li key={l.productId} className={`flex gap-4 py-6 ${busyId === l.productId ? "opacity-60" : ""}`}>
              <Link href={`/products/${l.slug}`} className="relative block h-28 w-22 shrink-0 overflow-hidden bg-sand sm:h-32 sm:w-26">
                {l.imageUrl ? (
                  <Image src={l.imageUrl} alt="" fill sizes="104px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center px-2 text-center font-display text-sm leading-tight text-stone">{l.name}</span>
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow text-[0.625rem]">{l.brandName}</p>
                    <Link href={`/products/${l.slug}`} className="mt-1 block font-display text-xl leading-snug text-ink hover:underline">
                      {l.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-stone">
                      {[l.concentration, l.sizeMl ? `${l.sizeMl} ml` : null, l.productType === "inspired_fragrance" ? "Inspired fragrance" : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button type="button" onClick={() => update(l.productId, 0)} className="h-8 w-8 shrink-0 text-stone hover:text-ink" aria-label={`Remove ${l.name}`}>
                    <X className="mx-auto h-4 w-4" />
                  </button>
                </div>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                  {unavailable ? (
                    <p className="text-xs text-danger">No longer available</p>
                  ) : (
                    <QuantityStepper value={Math.min(l.quantity, l.maxPerOrder)} max={l.maxPerOrder} onChange={(n) => update(l.productId, n)} disabled={pending} label={`Quantity of ${l.name}`} />
                  )}
                  <div className="text-right">
                    <p className="text-sm text-ink tabular-nums">{formatINR(l.unitPricePaise * l.quantity)}</p>
                    {l.quantity > 1 && <p className="text-xs text-stone">{formatINR(l.unitPricePaise)} each</p>}
                    {l.unitPricePaise !== l.addedPricePaise && <p className="text-xs text-warning">was {formatINR(l.addedPricePaise)}</p>}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DiscountForm({ appliedCode, error }: { appliedCode: string | null; error: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  function submit(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await applyDiscountAction(code);
      if (r.ok) {
        toast.success(r.message ?? "Code applied");
        setCode("");
      } else toast.error(r.errors?._form ?? r.message);
      router.refresh();
    });
  }
  if (appliedCode) {
    return (
      <div className="flex items-center justify-between border border-line bg-paper px-3 py-2 text-sm">
        <span>
          Code <strong className="font-medium">{appliedCode}</strong> applied
        </span>
        <button
          type="button"
          className="text-xs text-stone underline underline-offset-2"
          onClick={() =>
            start(async () => {
              await removeDiscountAction();
              router.refresh();
            })
          }
        >
          Remove
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="discount-code" className="mb-1.5 block text-xs font-medium text-charcoal">
        Discount code
      </label>
      <div className="flex">
        <input
          id="discount-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 30))}
          className="h-10 w-full border border-r-0 border-line bg-paper px-3 text-sm uppercase focus:border-ink focus:outline-none"
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" size="sm" className="h-10" loading={pending} disabled={!code.trim()}>
          Apply
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </form>
  );
}
