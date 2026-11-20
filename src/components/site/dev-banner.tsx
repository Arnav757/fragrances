import { integrationStatus } from "@/lib/env";

/** Visible warning outside production so nobody mistakes a test environment for the live service. */
export function DevBanner() {
  const s = integrationStatus();
  if (s.appEnv === "production" && s.razorpay.mode === "live") return null;
  const parts: string[] = [];
  if (s.appEnv !== "production") parts.push(`${s.appEnv} environment`);
  if (s.mockPayments) parts.push("simulated payments — no money moves");
  else if (s.razorpay.mode === "test") parts.push("Razorpay test mode");
  else if (!s.razorpay.configured) parts.push("online payments not configured");
  if (!s.ai.configured) parts.push("photo AI off — analysis uses quiz answers");
  if (!s.email.configured) parts.push("emails are logged, not sent");
  return <div className="no-print bg-warning px-4 py-1.5 text-center text-[0.6875rem] tracking-wide text-paper">Test mode: {parts.join(" · ")}</div>;
}
