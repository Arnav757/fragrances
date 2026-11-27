"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ALL = [
  { href: "/admin", label: "Overview", admin: false },
  { href: "/admin/reports", label: "Reports", admin: false },
  { href: "/admin/orders", label: "Orders & refunds", admin: true },
  { href: "/admin/discounts", label: "Promo codes", admin: true },
  { href: "/admin/settings", label: "Settings", admin: true },
  { href: "/admin/emails", label: "Email log", admin: false },
  { href: "/admin/audit", label: "Audit log", admin: true },
  { href: "/admin/account", label: "My account", admin: false },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="overflow-x-auto px-3 pb-3 lg:pb-6">
      <ul className="flex gap-1 lg:flex-col">
        {ALL.filter((i) => isAdmin || !i.admin).map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn("block rounded-lg px-3 py-2 text-[0.8125rem] whitespace-nowrap transition-colors", active ? "bg-paper/10 text-paper" : "text-paper/65 hover:text-paper")}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
