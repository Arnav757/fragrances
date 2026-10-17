import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";
import { Container } from "@/components/ui/misc";

const nav = [
  { href: "/account", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  return (
    <Container className="py-10 lg:py-14">
      <p className="eyebrow">My account</p>
      <p className="mt-1 font-display text-3xl text-ink">Hello, {user.fullName.split(" ")[0]}</p>
      <div className="mt-8 grid gap-10 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Account">
          <ul className="flex gap-4 overflow-x-auto border-b border-line pb-3 text-sm lg:flex-col lg:gap-1 lg:border-0">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block py-1.5 whitespace-nowrap text-charcoal hover:text-ink">
                  {n.label}
                </Link>
              </li>
            ))}
            {user.role === "admin" && (
              <li>
                <Link href="/admin" className="block py-1.5 whitespace-nowrap text-gold-deep">
                  Admin dashboard
                </Link>
              </li>
            )}
            <li>
              <form action={logoutAction}>
                <button type="submit" className="py-1.5 whitespace-nowrap text-stone hover:text-ink">
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
