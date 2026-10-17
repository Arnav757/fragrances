import Link from "next/link";
import { ShoppingBag, User } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { cartItemCount } from "@/lib/services/cart";
import { getSettings, storeName } from "@/lib/settings";
import { Wordmark } from "./logo";
import { MobileNav, SearchButton } from "./header-client";

const primary = [
  { href: "/shop", label: "Shop all" },
  { href: "/shop?type=authentic_branded", label: "Authentic" },
  { href: "/shop?type=inspired_fragrance", label: "Inspired" },
  { href: "/brands", label: "Brands" },
];
const secondary = [
  { href: "/authenticity", label: "Authenticity" },
  { href: "/shipping-policy", label: "Shipping" },
  { href: "/returns", label: "Returns" },
  { href: "/contact", label: "Contact" },
  { href: "/account", label: "My account" },
];

export async function Header() {
  const [store, user, count] = await Promise.all([getSettings("store"), getCurrentUser(), cartItemCount()]);
  const name = storeName(store);
  return (
    <>
      {store.announcement && (
        <div className="bg-night px-4 py-2 text-center text-[0.6875rem] tracking-[0.14em] text-paper/85 uppercase">{store.announcement}</div>
      )}
      <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:h-20 lg:px-10">
          <div className="flex items-center">
            <MobileNav links={primary} secondary={secondary} />
            <nav aria-label="Primary" className="hidden lg:block">
              <ul className="flex items-center gap-8">
                {primary.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[0.6875rem] tracking-[0.16em] text-charcoal uppercase transition-colors hover:text-gold-deep">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <Link href="/" aria-label={`${name} — home`} className="justify-self-center">
            <Wordmark name={name} className="[&>span:last-child]:text-[0.95rem] [&>span:last-child]:tracking-[0.16em] sm:[&>span:last-child]:text-[1.35rem] sm:[&>span:last-child]:tracking-[0.22em] [&>svg]:hidden sm:[&>svg]:block" />
          </Link>
          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <SearchButton />
            <Link
              href={user ? (user.role === "admin" ? "/admin" : "/account") : "/login"}
              className="hidden h-10 w-10 items-center justify-center hover:text-gold-deep sm:inline-flex"
              aria-label={user ? "Your account" : "Sign in"}
            >
              <User className="h-[18px] w-[18px]" strokeWidth={1.4} />
            </Link>
            <Link href="/cart" className="relative inline-flex h-10 w-10 items-center justify-center hover:text-gold-deep" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.4} />
              {count > 0 && (
                <span className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[0.6rem] font-medium text-paper">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
