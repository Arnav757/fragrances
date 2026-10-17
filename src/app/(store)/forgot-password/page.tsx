import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/store/auth-shell";
import { ForgotForm } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to reset it." footer={<Link href="/login" className="underline underline-offset-4">Back to sign in</Link>}>
      <ForgotForm />
    </AuthShell>
  );
}
