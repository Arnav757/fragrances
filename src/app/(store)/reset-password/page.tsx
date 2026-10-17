import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/store/auth-shell";
import { ResetForm } from "@/components/store/auth-forms";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Choose a new password">
      {token ? <ResetForm token={token} /> : <Notice tone="danger">This reset link is invalid. <Link href="/forgot-password" className="underline">Request a new one</Link>.</Notice>}
    </AuthShell>
  );
}
