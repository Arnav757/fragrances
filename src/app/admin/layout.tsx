import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/site/logo";
import { brand } from "@/config/brand";
import { AdminNav } from "@/components/admin/nav";

export const metadata: Metadata = { title: { default: "Studio", template: `%s · Studio · ${brand.name}` }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <div className="min-h-screen bg-ivory lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="bg-night text-paper/80 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <Link href="/admin" aria-label="Studio home">
            <Wordmark name={brand.name} tone="light" />
          </Link>
          <p className="hidden text-[0.625rem] tracking-[0.18em] text-gold uppercase lg:mt-2 lg:block">Stylist studio</p>
        </div>
        <AdminNav isAdmin={user.role === "admin"} />
        <div className="hidden border-t border-paper/10 px-5 py-4 text-xs lg:block">
          <p className="truncate text-paper/60">
            {user.fullName} · {user.role}
          </p>
          <div className="mt-2 flex gap-4">
            <Link href="/" className="hover:text-paper">
              View site
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="hover:text-paper">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
