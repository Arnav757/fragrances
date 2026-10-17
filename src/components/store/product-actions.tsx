"use client";

import { Minus, Plus, Share2, Check } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { addToCartAction, buyNowAction, checkPincodeAction } from "@/app/actions/cart";
import type { PincodeCheck } from "@/lib/shipping";
import { Button } from "../ui/button";
import { ProductImage } from "./product-image";
import { cn } from "@/lib/utils";

export function QuantityStepper({ value, onChange, max, label = "Quantity", disabled }: { value: number; onChange: (n: number) => void; max: number; label?: string; disabled?: boolean }) {
  return (
    <div className="inline-flex h-11 items-center border border-line bg-paper" role="group" aria-label={label}>
      <button type="button" className="flex h-full w-10 items-center justify-center disabled:opacity-40" onClick={() => onChange(Math.max(1, value - 1))} disabled={disabled || value <= 1} aria-label="Decrease quantity">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className="flex h-full w-10 items-center justify-center disabled:opacity-40" onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function PurchasePanel({ productId, maxPerOrder, purchasable, unavailableReason }: { productId: string; maxPerOrder: number; purchasable: boolean; unavailableReason: string | null }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [buying, startBuy] = useTransition();

  if (!purchasable) {
    return (
      <div className="border border-line bg-paper p-4 text-sm text-charcoal">
        <p className="font-medium text-ink">Not available to order</p>
        <p className="mt-1 text-stone">{unavailableReason}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <QuantityStepper value={qty} onChange={setQty} max={maxPerOrder} />
        <Button
          className="flex-1"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await addToCartAction(productId, qty);
              if (r.ok) {
                toast.success("Added to your cart", {
                  description: r.data?.cappedAt ? `Limited to ${r.data.cappedAt} per order.` : undefined,
                  action: { label: "View cart", onClick: () => router.push("/cart") },
                });
              } else toast.error(r.message);
            })
          }
        >
          Add to cart
        </Button>
      </div>
      <Button
        variant="outline"
        className="w-full"
        loading={buying}
        onClick={() =>
          startBuy(async () => {
            const r = await buyNowAction(productId, qty);
            if (r && !r.ok) toast.error(r.message);
          })
        }
      >
        Buy now
      </Button>
      <p className="text-xs text-stone">Maximum {maxPerOrder} per order.</p>
    </div>
  );
}

export function PincodeChecker() {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<PincodeCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await checkPincodeAction(pin);
      if (r.ok) setResult(r.data ?? null);
      else {
        setResult(null);
        setError(r.errors?.["_form"] ?? r.message);
      }
    });
  }
  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <label htmlFor="pdp-pincode" className="text-xs font-medium text-charcoal">
        Check delivery to your PIN code
      </label>
      <div className="flex">
        <input
          id="pdp-pincode"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="6-digit PIN"
          className="h-10 w-full border border-r-0 border-line bg-paper px-3 text-sm focus:border-ink focus:outline-none"
          aria-invalid={!!error}
          aria-describedby="pdp-pincode-result"
        />
        <Button type="submit" variant="secondary" size="sm" className="h-10" loading={pending} disabled={pin.length !== 6}>
          Check
        </Button>
      </div>
      <div id="pdp-pincode-result" aria-live="polite" className="text-xs leading-relaxed">
        {error && <p className="text-danger">{error}</p>}
        {result && (
          <p className={cn(result.serviceable === false ? "text-danger" : "text-charcoal")}>
            {result.message}
            {result.estimate && ` Estimated delivery: ${result.estimate.minDays}–${result.estimate.maxDays} days after dispatch.`}
          </p>
        )}
      </div>
    </form>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled */
    }
  }
  return (
    <button type="button" onClick={share} className="inline-flex items-center gap-2 text-xs tracking-wide text-stone hover:text-ink">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />} Share
    </button>
  );
}

export function Gallery({ images, brand, name, family }: { images: { url: string; alt: string }[]; brand: string; name: string; family: string | null }) {
  const [active, setActive] = useState(0);
  if (!images.length) return <ProductImage src={null} alt={null} brand={brand} name={name} family={family} priority />;
  const img = images[active] ?? images[0]!;
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        <Image src={img.url} alt={img.alt || `${brand} ${name}`} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2" role="tablist" aria-label="Product images">
          {images.map((im, i) => (
            <button
              key={im.url}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Show image ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn("relative aspect-square overflow-hidden border", i === active ? "border-ink" : "border-transparent opacity-70 hover:opacity-100")}
            >
              <Image src={im.url} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
