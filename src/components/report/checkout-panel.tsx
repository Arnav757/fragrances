"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock, Copy, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { quoteAction, simulatePaymentAction, startCheckoutAction, startUpiCheckoutAction, submitUtrAction, verifyPaymentAction, type StartPayment } from "@/app/actions/analysis";
import type { UpiCheckout } from "@/lib/services/upi";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Checkbox, Field, Input } from "../ui/form";
import { Notice } from "../ui/misc";

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (ev: string, cb: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
}

export type PendingUpiView = { orderNumber: string; utr: string; amountPaise: number };

export type PlanOption = { code: "standard" | "priority"; label: string; pricePaise: number; hours: number };

export function CheckoutPanel({ token, plans, mode, firstName, pendingUpi }: { token: string; plans: PlanOption[]; mode: "razorpay" | "mock" | "upi" | "off"; firstName: string; pendingUpi: PendingUpiView | null }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanOption["code"]>(plans[0]!.code);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; plan: string; totalPaise: number; label: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [verifying, setVerifying] = useState(false);
  const [mockOrder, setMockOrder] = useState<StartPayment | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [upi, setUpi] = useState<UpiCheckout | null>(null);
  const [utr, setUtr] = useState("");

  const current = plans.find((p) => p.code === plan)!;
  const total = applied && applied.plan === plan ? applied.totalPaise : current.pricePaise;

  function applyCode() {
    if (!code.trim()) return;
    start(async () => {
      const r = await quoteAction(token, plan, code.trim());
      if (r.ok && r.data) {
        setApplied({ code: code.trim(), plan, totalPaise: r.data.totalPaise, label: r.data.label });
        toast.success(r.data.label || "Code applied");
      } else {
        setApplied(null);
        setErrors((e) => ({ ...e, discountCode: r.ok ? "" : r.message }));
      }
    });
  }

  function submit(form: FormData) {
    setError(null);
    setErrors({});
    const input = {
      contactName: String(form.get("contactName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      plan,
      discountCode: applied && applied.plan === plan ? applied.code : "",
      marketingConsent: form.get("marketing") === "on",
      acceptTerms: form.get("terms") === "on",
    };
    if (mode === "upi") {
      start(async () => {
        const r = await startUpiCheckoutAction(token, input);
        if (!r.ok || !r.data) {
          if (!r.ok && r.errors) setErrors(r.errors);
          setError(r.ok ? "Could not start payment." : r.message);
          return;
        }
        setUpi(r.data);
      });
      return;
    }
    start(async () => {
      const r = await startCheckoutAction(token, input);
      if (!r.ok || !r.data) {
        if (!r.ok && r.errors) setErrors(r.errors);
        setError(r.ok ? "Could not start payment." : r.message);
        return;
      }
      const d = r.data;
      if (d.mode === "mock") {
        setMockOrder(d);
        return;
      }
      if (!window.Razorpay) {
        setError("The payment window couldn't load. Check your connection or disable content blockers, then try again.");
        return;
      }
      const rzp = new window.Razorpay({
        key: d.keyId,
        amount: d.amountPaise,
        currency: "INR",
        name: d.storeName,
        description: `Style report ${d.orderNumber}`,
        order_id: d.gatewayOrderId,
        prefill: d.prefill,
        theme: { color: "#17191d" },
        modal: { ondismiss: () => toast("Payment window closed — you can try again any time.") },
        handler: async (resp: RazorpaySuccess) => {
          setVerifying(true);
          const v = await verifyPaymentAction(token, { orderId: d.orderId, gatewayOrderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature });
          if (v.ok) router.refresh();
          else {
            setVerifying(false);
            setError(`${v.ok ? "" : v.message} If money was debited, don't pay again — your report unlocks automatically once Razorpay confirms, or contact us with order ${d.orderNumber}.`);
          }
        },
      });
      rzp.on("payment.failed", (resp) => setError(`Payment failed${resp.error?.description ? `: ${resp.error.description}` : ""}. You can try again.`));
      rzp.open();
    });
  }

  function sendUtr() {
    if (!upi) return;
    setError(null);
    start(async () => {
      const r = await submitUtrAction(token, upi.orderId, utr);
      if (r.ok) router.refresh();
      else setError(r.message);
    });
  }

  function simulate(outcome: "success" | "failure") {
    if (!mockOrder) return;
    start(async () => {
      const r = await simulatePaymentAction(token, mockOrder.orderId, outcome);
      if (r.ok) {
        setVerifying(true);
        router.refresh();
      } else setError(r.message);
    });
  }

  if (verifying) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-6 text-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-r-transparent" aria-hidden />
        Payment confirmed — unlocking your full report…
      </div>
    );
  }

  if (pendingUpi) {
    return (
      <div id="unlock" role="status" className="scroll-mt-24 rounded-2xl border border-ink/15 bg-paper p-6">
        <p className="inline-flex items-center gap-2 rounded-full bg-gold-soft px-3 py-1 text-xs font-medium text-gold-deep">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Payment being verified
        </p>
        <h2 className="mt-3 text-2xl leading-tight">Thanks, {firstName}. We&apos;re checking your payment.</h2>
        <p className="mt-2 text-sm leading-relaxed text-charcoal">
          We received transaction ID <span className="font-mono font-medium">{pendingUpi.utr}</span> for {formatINR(pendingUpi.amountPaise)} (order {pendingUpi.orderNumber}). As soon as we see it in our account, your full report unlocks here and we email you the link — usually within a few hours.
        </p>
        <p className="mt-3 text-xs text-stone">Don&apos;t pay again. If you entered the wrong number, contact us with your order number.</p>
      </div>
    );
  }

  return (
    <div id="unlock" className="scroll-mt-24 rounded-2xl border border-ink/15 bg-paper p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)] sm:p-6">
      {mode === "razorpay" && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} />}
      <p className="eyebrow">Unlock everything</p>
      <h2 className="mt-2 text-2xl leading-tight">Your full report, {firstName}</h2>
      <p className="mt-1 text-sm text-stone">Opens instantly. Then a stylist reviews it and adds a personal note.</p>

      {!upi && (
      <fieldset className="mt-5 space-y-2">
        <legend className="sr-only">Review speed</legend>
        {plans.map((p) => (
          <label key={p.code} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3", plan === p.code ? "border-ink bg-ivory" : "border-line")}>
            <span className="flex items-center gap-3">
              <input type="radio" name="plan" value={p.code} checked={plan === p.code} onChange={() => setPlan(p.code)} className="accent-ink" />
              <span>
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-xs text-stone">Stylist-reviewed within {p.hours} hours</span>
              </span>
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatINR(p.pricePaise)}</span>
          </label>
        ))}
      </fieldset>
      )}

      {upi ? (
        <div className="mt-5">
          <p className="text-sm font-medium">Scan to pay {formatINR(upi.amountPaise)}</p>
          <p className="mt-0.5 text-xs text-stone">Any UPI app: GPay, PhonePe, Paytm, BHIM. The amount and order number are filled in for you.</p>
          <div className="mx-auto mt-4 w-56 rounded-2xl border border-line bg-white p-3" aria-label={`UPI QR code to pay ${formatINR(upi.amountPaise)} to ${upi.payee}`} role="img" dangerouslySetInnerHTML={{ __html: upi.qrSvg }} />
          <a href={upi.uri} className="mt-3 flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-white lg:hidden">
            <Smartphone className="h-4 w-4" aria-hidden /> Pay with a UPI app
          </a>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="text-stone">UPI ID </span>
              <span className="font-mono">{upi.upiId}</span>
            </span>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
              onClick={() => navigator.clipboard.writeText(upi.upiId).then(() => toast.success("UPI ID copied"))}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
            </button>
          </div>
          <p className="mt-1.5 text-xs text-stone">Paying to {upi.payee} · order {upi.orderNumber}. Pay exactly {formatINR(upi.amountPaise)}.</p>
          <div className="mt-5 border-t border-line pt-4">
            {error && <Notice tone="danger" className="mb-3">{error}</Notice>}
            <Field label="After paying: your UPI transaction ID" htmlFor="utr" hint="12 digits, shown as UTR / UPI Ref No. in your app's payment details">
              <Input id="utr" inputMode="numeric" autoComplete="off" placeholder="123456789012" value={utr} onChange={(e) => setUtr(e.target.value.replace(/[^\d ]/g, "").slice(0, 16))} />
            </Field>
            <Button className="mt-3 w-full" size="lg" onClick={sendUtr} loading={pending} disabled={utr.replace(/\s/g, "").length !== 12} data-testid="submit-utr">
              I&apos;ve paid — submit
            </Button>
            <p className="mt-2 text-center text-xs text-stone">We check every payment by hand, usually within a few hours. Your report unlocks as soon as it&apos;s confirmed.</p>
          </div>
        </div>
      ) : mockOrder ? (
        <div className="mt-5 rounded-xl border border-dashed border-warning/60 bg-warning/5 p-4">
          <p className="text-sm font-medium">Test mode — simulated payment of {formatINR(mockOrder.amountPaise)}</p>
          <p className="mt-1 text-xs text-stone">Razorpay isn&apos;t configured here. No money moves; the server still verifies a signed payment.</p>
          {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => simulate("success")} loading={pending} data-testid="simulate-success">
              Simulate successful payment
            </Button>
            <Button variant="outline" onClick={() => simulate("failure")} disabled={pending}>
              Simulate failure
            </Button>
          </div>
        </div>
      ) : (
        <form action={submit} className="mt-5 space-y-4" noValidate>
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Full name" htmlFor="contactName" error={errors.contactName}>
            <Input id="contactName" name="contactName" autoComplete="name" required aria-invalid={!!errors.contactName} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email} hint="Your report link is sent here">
            <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} />
          </Field>
          <Field label="Mobile" htmlFor="phone" error={errors.phone}>
            <Input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" required aria-invalid={!!errors.phone} />
          </Field>
          <div>
            <label htmlFor="discountCode" className="mb-1.5 block text-xs font-medium text-charcoal">
              Promo code <span className="font-normal text-mist">(optional)</span>
            </label>
            <div className="flex gap-2">
              <Input id="discountCode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-invalid={!!errors.discountCode} className="flex-1" />
              <Button type="button" variant="outline" onClick={applyCode} disabled={pending || !code.trim()}>
                Apply
              </Button>
            </div>
            {errors.discountCode ? <p className="mt-1.5 text-xs text-danger">{errors.discountCode}</p> : applied?.plan === plan && <p className="mt-1.5 text-xs text-success">{applied.label}</p>}
          </div>
          <Checkbox id="marketing" name="marketing" label={<span className="text-xs">Send me occasional style tips and offers. (Optional — unsubscribe any time.)</span>} />
          <Checkbox
            id="terms"
            name="terms"
            label={
              <span className="text-xs">
                I agree to the <a href="/terms" target="_blank" className="underline">terms</a> and <a href="/privacy" target="_blank" className="underline">privacy policy</a>.
              </span>
            }
          />
          {errors.acceptTerms && <p className="text-xs text-danger">{errors.acceptTerms}</p>}
          <Button type="submit" size="lg" className="w-full" loading={pending} disabled={mode === "off" || (mode === "razorpay" && !scriptReady)} data-testid="pay">
            <Lock className="h-4 w-4" aria-hidden /> Pay {formatINR(total)}
          </Button>
          {mode === "off" && <p className="text-center text-xs text-danger">Payments aren&apos;t available right now.</p>}
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-stone">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {mode === "upi" ? "Pay by UPI QR" : "UPI, cards & netbanking via Razorpay"} · GST included · Revisions included
          </p>
        </form>
      )}
    </div>
  );
}
