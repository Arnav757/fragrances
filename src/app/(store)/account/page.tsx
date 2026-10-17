import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { PasswordForm, ProfileForm } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage() {
  const user = await requireUser("/account");
  return (
    <div className="grid gap-12 xl:grid-cols-2">
      <section>
        <h1 className="mb-6 text-2xl text-ink">Profile</h1>
        <ProfileForm fullName={user.fullName} phone={user.phone} email={user.email} />
      </section>
      <section>
        <h2 className="mb-6 text-2xl text-ink">Password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
