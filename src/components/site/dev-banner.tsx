import { integrationStatus } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { upiReady } from "@/lib/services/upi";

/** Visible warning outside production so nobody mistakes a test environment for the live service. */
export async function DevBanner() {
  const s = integrationStatus();
  const upi = upiReady(await getSettings("payments"));
  if (s.appEnv === "production" && s.razorpay.mode === "live") return null;
  const parts: string[] = [];
  if (s.appEnv !== "production") parts.push(`${s.appEnv} environment`);
  if (upi) parts.push("payments by UPI QR, confirmed by hand");
  else if (s.mockPayments) parts.push("simulated payments — no money moves");
  else if (s.razorpay.mode === "test") parts.push("Razorpay test mode");
  else if (!s.razorpay.configured) parts.push("online payments not configured");
  if (!s.ai.configured) parts.push("photo AI off — analysis uses quiz answers");
  if (!s.email.configured) parts.push("emails are logged, not sent");
  return <div className="no-print bg-warning px-4 py-1.5 text-center text-[0.6875rem] tracking-wide text-paper">Test mode: {parts.join(" · ")}</div>;
}
