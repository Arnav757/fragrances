"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/requests", label: "Returns & cancellations" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/catalog", label: "Brands, collections & tax" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/discounts", label: "Discounts" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/reports", label: "Financial report" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/emails", label: "Email log" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="overflow-x-auto px-3 pb-3 lg:pb-6">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn("block px-3 py-2 text-[0.8125rem] whitespace-nowrap transition-colors", active ? "bg-paper/10 text-paper" : "text-paper/65 hover:text-paper")}
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
