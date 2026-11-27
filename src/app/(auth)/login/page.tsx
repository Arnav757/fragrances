import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/site/auth-forms";
import { Notice } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthCard } from "../shell";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const next = sp.next?.startsWith("/admin") ? sp.next : "/admin";
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthCard
      title="Staff sign in"
      subtitle="For stylists and admins. Customers don't need an account."
      footer={
        <Link href="/find" className="underline underline-offset-4">
          Looking for your report?
        </Link>
      }
    >
      {sp.reset && (
        <Notice tone="success" className="mb-5">
          Your password has been reset. Please sign in.
        </Notice>
      )}
      <LoginForm next={next} />
    </AuthCard>
  );
}
