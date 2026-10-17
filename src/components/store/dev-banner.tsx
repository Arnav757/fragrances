import { integrationStatus } from "@/lib/env";

/** Visible warning outside production so nobody mistakes a test environment for a live shop. */
export function DevBanner() {
  const s = integrationStatus();
  if (s.appEnv === "production" && s.razorpay.mode === "live") return null;
  const parts: string[] = [];
  if (s.appEnv !== "production") parts.push(`${s.appEnv} environment`);
  if (s.mockPayments) parts.push("simulated payments — no money moves");
  else if (s.razorpay.mode === "test") parts.push("Razorpay test mode");
  else if (!s.razorpay.configured) parts.push("online payments not configured");
  if (!s.email.configured) parts.push("emails are logged, not sent");
  return (
    <div className="bg-warning px-4 py-1.5 text-center text-[0.6875rem] tracking-wide text-paper">
      Test store: {parts.join(" · ")}
    </div>
  );
}
