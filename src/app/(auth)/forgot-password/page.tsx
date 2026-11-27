import type { Metadata } from "next";
import { ForgotForm } from "@/components/site/auth-forms";
import { AuthCard } from "../shell";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to set a new one.">
      <ForgotForm />
    </AuthCard>
  );
}
