"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reportPaymentFailureAction, simulatePaymentAction, startPaymentAction, verifyPaymentAction } from "@/app/actions/checkout";
import { formatINR } from "@/lib/money";
import { Button } from "../ui/button";
import { Notice } from "../ui/misc";

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (ev: string, cb: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
}

export function PayPanel({ orderNumber, token, totalPaise, mode, failed }: { orderNumber: string; token: string | null; totalPaise: number; mode: "razorpay" | "mock"; failed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(failed ? "Your last payment attempt didn't go through. No money has been taken for it by us — you can try again." : null);
  const [verifying, setVerifying] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  function payWithRazorpay() {
    setError(null);
    start(async () => {
      const r = await startPaymentAction(orderNumber, token);
      if (!r.ok || !r.data) {
        setError(r.ok ? "Could not start payment." : r.message);
        return;
      }
      if (!window.Razorpay) {
        setError("The payment window couldn't load. Check your connection or disable content blockers, then try again.");
        return;
      }
      const d = r.data;
      const rzp = new window.Razorpay({
        key: d.keyId,
        amount: d.amountPaise,
        currency: "INR",
        name: d.storeName,
        description: `Order ${d.orderNumber}`,
        order_id: d.gatewayOrderId,
        prefill: d.prefill,
        theme: { color: "#161514" },
        modal: { ondismiss: () => toast("Payment window closed. You can resume payment any time from this page.") },
        handler: async (resp: RazorpaySuccess) => {
          setVerifying(true);
          const v = await verifyPaymentAction({
            orderNumber,
            token,
            gatewayOrderId: resp.razorpay_order_id,
            paymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
          });
          if (v.ok && v.data) router.push(v.data.redirectTo);
          else {
            setVerifying(false);
            setError(
              (v.ok ? "" : v.message) +
                " If money was debited, please don't pay again — we'll confirm automatically once Razorpay notifies us, or contact support with your order number.",
            );
          }
        },
      });
      rzp.on("payment.failed", (resp) => {
        const desc = resp.error?.description ?? null;
        void reportPaymentFailureAction(orderNumber, token, desc);
        setError(`Payment failed${desc ? `: ${desc}` : ""}. You can try again or use a different method.`);
      });
      rzp.open();
    });
  }

  function simulate(outcome: "success" | "failure") {
    setError(null);
    start(async () => {
      const r = await simulatePaymentAction(orderNumber, token, outcome);
      if (r.ok && r.data) router.push(r.data.redirectTo);
      else {
        setError(r.ok ? null : r.message);
        router.refresh();
      }
    });
  }

  if (verifying) {
    return (
      <div role="status" className="flex items-center gap-3 border border-line bg-paper p-5 text-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-r-transparent" aria-hidden />
        Verifying your payment with Razorpay… please don&apos;t close this page.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="danger">{error}</Notice>}
      {mode === "razorpay" ? (
        <>
          <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
          <Button size="lg" className="w-full" onClick={payWithRazorpay} loading={pending} disabled={!scriptReady}>
            {failed || error ? "Retry payment" : "Pay"} {formatINR(totalPaise)}
          </Button>
          <p className="text-center text-xs text-stone">You&apos;ll complete payment in Razorpay&apos;s secure window.</p>
        </>
      ) : (
        <div className="border border-dashed border-warning/60 bg-warning/5 p-5">
          <p className="text-sm font-medium text-ink">Test mode — simulated payment</p>
          <p className="mt-1 text-xs leading-relaxed text-stone">
            Razorpay isn&apos;t configured, so this environment uses a simulated gateway. No money moves. The server still verifies a signed payment before
            confirming the order.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => simulate("success")} loading={pending} data-testid="simulate-success">
              Simulate successful payment
            </Button>
            <Button variant="outline" onClick={() => simulate("failure")} disabled={pending}>
              Simulate failure
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
