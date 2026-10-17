"use client";

import { useForm, useWatch, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import type { z } from "zod";
import { checkoutSchema } from "@/lib/validation";
import { INDIAN_STATES } from "@/config/brand";
import { placeOrderAction } from "@/app/actions/checkout";
import { formatINR } from "@/lib/money";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/form";
import { Notice } from "../ui/misc";
import { cn } from "@/lib/utils";

type In = z.input<typeof checkoutSchema>;
type Out = z.output<typeof checkoutSchema>;

export type SavedAddress = { id: string; label: string | null; fullName: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string; isDefault: boolean };

function AddressFields({ prefix, register, errors }: { prefix: "shipping" | "billing"; register: UseFormRegister<In>; errors: FieldErrors<In>[typeof prefix] }) {
  const e = (errors ?? {}) as Record<string, { message?: string } | undefined>;
  const id = (k: string) => `${prefix}-${k}`;
  const aria = (k: string) => ({ "aria-invalid": !!e[k], "aria-describedby": e[k] ? `${id(k)}-error` : undefined });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor={id("fullName")} error={e.fullName?.message} className="sm:col-span-2">
        <Input id={id("fullName")} autoComplete={`${prefix} name`} {...register(`${prefix}.fullName`)} {...aria("fullName")} />
      </Field>
      <Field label="Mobile number" htmlFor={id("phone")} error={e.phone?.message} hint="For delivery updates from the courier" className="sm:col-span-2">
        <Input id={id("phone")} type="tel" inputMode="tel" autoComplete={`${prefix} tel-national`} placeholder="10-digit mobile number" {...register(`${prefix}.phone`)} {...aria("phone")} />
      </Field>
      <Field label="House / flat no., building, street" htmlFor={id("line1")} error={e.line1?.message} className="sm:col-span-2">
        <Input id={id("line1")} autoComplete={`${prefix} address-line1`} {...register(`${prefix}.line1`)} {...aria("line1")} />
      </Field>
      <Field label="Area, locality" htmlFor={id("line2")} error={e.line2?.message} optional>
        <Input id={id("line2")} autoComplete={`${prefix} address-line2`} {...register(`${prefix}.line2`)} />
      </Field>
      <Field label="Landmark" htmlFor={id("landmark")} error={e.landmark?.message} optional>
        <Input id={id("landmark")} {...register(`${prefix}.landmark`)} />
      </Field>
      <Field label="PIN code" htmlFor={id("pincode")} error={e.pincode?.message}>
        <Input id={id("pincode")} inputMode="numeric" maxLength={6} autoComplete={`${prefix} postal-code`} {...register(`${prefix}.pincode`)} {...aria("pincode")} />
      </Field>
      <Field label="City / town" htmlFor={id("city")} error={e.city?.message}>
        <Input id={id("city")} autoComplete={`${prefix} address-level2`} {...register(`${prefix}.city`)} {...aria("city")} />
      </Field>
      <Field label="State / union territory" htmlFor={id("state")} error={e.state?.message} className="sm:col-span-2">
        <Select id={id("state")} autoComplete={`${prefix} address-level1`} defaultValue="" {...register(`${prefix}.state`)} {...aria("state")}>
          <option value="" disabled>
            Select state
          </option>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="mb-6 flex items-center gap-3 text-2xl text-ink">
        <span className="flex h-7 w-7 items-center justify-center border border-ink font-sans text-xs">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CheckoutForm({
  idempotencyKey,
  totals,
  codEnabled,
  codUnavailableReason,
  onlineAvailable,
  user,
  addresses,
}: {
  idempotencyKey: string;
  totals: { razorpay: number; cod: number | null };
  codEnabled: boolean;
  codUnavailableReason: string | null;
  onlineAvailable: boolean;
  user: { email: string; fullName: string; phone: string | null } | null;
  addresses: SavedAddress[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const def = addresses.find((a) => a.isDefault) ?? addresses[0];
  const toForm = (a?: SavedAddress) => ({
    fullName: a?.fullName ?? user?.fullName ?? "",
    phone: a?.phone ?? user?.phone ?? "",
    line1: a?.line1 ?? "",
    line2: a?.line2 ?? "",
    landmark: a?.landmark ?? "",
    city: a?.city ?? "",
    state: (a?.state ?? "") as In["shipping"]["state"],
    pincode: a?.pincode ?? "",
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(checkoutSchema),
    mode: "onBlur",
    defaultValues: {
      idempotencyKey,
      email: user?.email ?? "",
      contactName: user?.fullName ?? "",
      phone: user?.phone ?? def?.phone ?? "",
      shipping: toForm(def),
      billingSameAsShipping: true,
      notes: "",
      paymentMethod: onlineAvailable ? "razorpay" : codEnabled ? "cod" : "razorpay",
      expectedTotalPaise: onlineAvailable ? totals.razorpay : (totals.cod ?? totals.razorpay),
      saveAddress: !!user && addresses.length === 0,
    },
  });
  const method = useWatch({ control, name: "paymentMethod" });
  const billingSame = useWatch({ control, name: "billingSameAsShipping" });
  const total = method === "cod" && totals.cod !== null ? totals.cod : totals.razorpay;

  function onSubmit(data: Out) {
    setServerError(null);
    start(async () => {
      const r = await placeOrderAction({ ...data, expectedTotalPaise: total });
      if (r.ok && r.data) {
        router.push(r.data.redirectTo);
        return;
      }
      if (!r.ok) {
        setServerError(r.message);
        toast.error(r.message);
        if (r.newTotalPaise != null) router.refresh();
      }
    });
  }

  const contactErr = errors as Record<string, { message?: string } | undefined>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="min-w-0">
      <input type="hidden" {...register("idempotencyKey")} />
      <Step n={1} title="Contact">
        {!user && (
          <p className="mb-5 text-sm text-stone">
            Have an account?{" "}
            <Link href="/login?next=/checkout" className="text-ink underline underline-offset-4">
              Sign in
            </Link>{" "}
            — or continue as a guest.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={contactErr.email?.message} hint="We'll send your order confirmation here">
            <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
          </Field>
          <Field label="Your name" htmlFor="contactName" error={contactErr.contactName?.message}>
            <Input id="contactName" autoComplete="name" {...register("contactName")} aria-invalid={!!errors.contactName} />
          </Field>
          <Field label="Mobile number" htmlFor="phone" error={contactErr.phone?.message} className="sm:col-span-2">
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" {...register("phone")} aria-invalid={!!errors.phone} />
          </Field>
        </div>
      </Step>

      <Step n={2} title="Delivery address">
        {addresses.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-medium text-charcoal">Saved addresses</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {addresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => reset({ ...getValues(), shipping: toForm(a) }, { keepDefaultValues: true })}
                  className="border border-line bg-paper p-3 text-left text-xs leading-relaxed hover:border-ink"
                >
                  <span className="block font-medium text-ink">{a.label || a.fullName}</span>
                  {a.line1}, {a.city} {a.pincode}
                </button>
              ))}
            </div>
          </div>
        )}
        <AddressFields prefix="shipping" register={register} errors={errors.shipping} />
        <div className="mt-6 space-y-3">
          <Checkbox id="billingSame" label="Billing address is the same as delivery address" {...register("billingSameAsShipping")} />
          {user && <Checkbox id="saveAddress" label="Save this address to my account" {...register("saveAddress")} />}
        </div>
        {!billingSame && (
          <div className="mt-6 border-t border-line pt-6">
            <h3 className="mb-4 font-display text-xl">Billing address</h3>
            <AddressFields prefix="billing" register={register} errors={errors.billing} />
          </div>
        )}
        <Field label="Order notes" htmlFor="notes" optional className="mt-6" error={contactErr.notes?.message}>
          <Textarea id="notes" rows={3} maxLength={500} placeholder="Delivery instructions, if any" {...register("notes")} />
        </Field>
      </Step>

      <Step n={3} title="Payment">
        <fieldset>
          <legend className="sr-only">Payment method</legend>
          <div className="space-y-3">
            <label className={cn("flex cursor-pointer items-start gap-3 border p-4", method === "razorpay" ? "border-ink bg-paper" : "border-line", !onlineAvailable && "cursor-not-allowed opacity-60")}>
              <input type="radio" value="razorpay" disabled={!onlineAvailable} className="mt-1 accent-ink" {...register("paymentMethod", { onChange: () => setValue("expectedTotalPaise", totals.razorpay) })} />
              <span>
                <span className="block text-sm font-medium text-ink">Pay online — UPI, cards, net banking, wallets</span>
                <span className="text-xs text-stone">{onlineAvailable ? "Secure payment processed by Razorpay. We never see your card or UPI details." : "Online payment isn't available yet."}</span>
              </span>
            </label>
            <label className={cn("flex items-start gap-3 border p-4", method === "cod" ? "border-ink bg-paper" : "border-line", codEnabled && totals.cod !== null ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
              <input type="radio" value="cod" disabled={!codEnabled || totals.cod === null} className="mt-1 accent-ink" {...register("paymentMethod", { onChange: () => setValue("expectedTotalPaise", totals.cod ?? totals.razorpay) })} />
              <span>
                <span className="block text-sm font-medium text-ink">Cash on delivery</span>
                <span className="text-xs text-stone">
                  {codEnabled && totals.cod !== null
                    ? totals.cod !== totals.razorpay
                      ? `A COD fee applies — total ${formatINR(totals.cod)}.`
                      : "Pay the courier when your order arrives."
                    : (codUnavailableReason ?? "Not available for this order.")}
                </span>
              </span>
            </label>
          </div>
        </fieldset>
        <div className="mt-6">
          <Checkbox
            id="acceptTerms"
            {...register("acceptTerms")}
            label={
              <>
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="underline underline-offset-2">
                  Terms
                </Link>
                ,{" "}
                <Link href="/returns" target="_blank" className="underline underline-offset-2">
                  Returns policy
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="underline underline-offset-2">
                  Privacy policy
                </Link>
                .
              </>
            }
          />
          {errors.acceptTerms && (
            <p role="alert" className="mt-1.5 text-xs text-danger">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>
        {serverError && (
          <Notice tone="danger" className="mt-6">
            {serverError}
          </Notice>
        )}
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="mt-4 text-xs text-danger">
            Please correct the highlighted fields above.
          </p>
        )}
        <Button type="submit" size="lg" className="mt-6 w-full" loading={pending} disabled={!onlineAvailable && !(codEnabled && totals.cod !== null)}>
          {method === "cod" ? `Place order · ${formatINR(total)}` : `Continue to payment · ${formatINR(total)}`}
        </Button>
        <p className="mt-3 text-center text-xs text-stone">Your order total is recalculated and verified on our server before payment.</p>
      </Step>
    </form>
  );
}
