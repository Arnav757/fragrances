import type { Metadata } from "next";
import { ResetForm } from "@/components/site/auth-forms";
import { Notice } from "@/components/ui/misc";
import { AuthCard } from "../shell";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthCard title="Set a new password">{token ? <ResetForm token={token} /> : <Notice tone="danger">This reset link is invalid.</Notice>}</AuthCard>;
}
