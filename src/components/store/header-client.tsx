"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type NavLink = { href: string; label: string };

export function MobileNav({ links, secondary }: { links: NavLink[]; secondary: NavLink[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="-ml-2 inline-flex h-10 w-10 items-center justify-center lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" strokeWidth={1.4} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-sm flex-col bg-paper shadow-xl focus:outline-none">
          <div className="flex h-16 items-center justify-between border-b border-line px-5">
            <Dialog.Title className="eyebrow">Menu</Dialog.Title>
            <Dialog.Close className="inline-flex h-10 w-10 items-center justify-center" aria-label="Close menu">
              <X className="h-5 w-5" strokeWidth={1.4} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
          <nav className="flex-1 overflow-y-auto px-5 py-6">
            <ul className="space-y-1">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="block py-2.5 font-display text-2xl text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-8 space-y-1 border-t border-line pt-6">
              {secondary.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="block py-2 text-sm text-charcoal">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SearchButton() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  function submit(e: FormEvent) {
    e.preventDefault();
    setOpen(false);
    router.push(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : "/shop");
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="inline-flex h-10 w-10 items-center justify-center hover:text-gold-deep" aria-label="Search">
        <Search className="h-[18px] w-[18px]" strokeWidth={1.4} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30" />
        <Dialog.Content className="fixed inset-x-0 top-0 z-50 border-b border-line bg-paper px-4 py-8 shadow-lg focus:outline-none sm:px-10">
          <Dialog.Title className="sr-only">Search fragrances</Dialog.Title>
          <Dialog.Description className="sr-only">Search by fragrance name, brand or note</Dialog.Description>
          <form onSubmit={submit} role="search" className="mx-auto flex max-w-3xl items-center gap-3 border-b border-ink pb-3">
            <Search className="h-5 w-5 shrink-0 text-stone" strokeWidth={1.4} aria-hidden />
            <label htmlFor="site-search" className="sr-only">
              Search
            </label>
            <input
              id="site-search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, brand or note — e.g. oud, Lattafa, vanilla"
              className="w-full bg-transparent font-display text-2xl text-ink placeholder:text-mist focus:outline-none sm:text-3xl"
              maxLength={80}
            />
            <Dialog.Close className="inline-flex h-10 w-10 shrink-0 items-center justify-center" aria-label="Close search">
              <X className="h-5 w-5" strokeWidth={1.4} />
            </Dialog.Close>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
