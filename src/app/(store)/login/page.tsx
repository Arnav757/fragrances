import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/store/auth-shell";
import { LoginForm } from "@/components/store/auth-forms";
import { Notice } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/account";
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell
      title="Sign in"
      subtitle="Track orders, save addresses and check out faster."
      footer={
        <>
          New here?{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-ink underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      {sp.reset && <Notice tone="success" className="mb-5">Your password has been reset. Please sign in.</Notice>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
