import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/admin/ui";
import { PasswordForm } from "@/components/site/auth-forms";

export const metadata: Metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="My account" />
      <Panel title="Change password" className="max-w-lg"><PasswordForm /></Panel>
    </>
  );
}
