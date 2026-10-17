import Link from "next/link";
import { getSettings, storeName } from "@/lib/settings";
import { brand } from "@/config/brand";
import { Wordmark } from "./logo";

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All fragrances" },
      { href: "/shop?type=authentic_branded", label: "Authentic branded" },
      { href: "/shop?type=inspired_fragrance", label: "Inspired fragrances" },
      { href: "/brands", label: "Brands" },
      { href: "/shop?sort=newest", label: "New arrivals" },
    ],
  },
  {
    title: "Customer care",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/faq", label: "FAQs" },
      { href: "/shipping-policy", label: "Shipping policy" },
      { href: "/returns", label: "Returns & refunds" },
      { href: "/payment-information", label: "Payment information" },
      { href: "/account/orders", label: "Track your order" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about", label: "Our story" },
      { href: "/authenticity", label: "Authenticity policy" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms & conditions" },
    ],
  },
];

export async function Footer() {
  const store = await getSettings("store");
  const name = storeName(store);
  const socials = Object.entries(store.socials).filter(([, url]) => url && /^https:\/\//.test(url));
  return (
    <footer className="mt-24 bg-night text-paper/80">
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Wordmark name={name} tone="light" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-paper/60">{brand.description}</p>
            <div className="mt-6 space-y-1 text-sm">
              {store.supportEmail && (
                <p>
                  <a href={`mailto:${store.supportEmail}`} className="hover:text-gold">
                    {store.supportEmail}
                  </a>
                </p>
              )}
              {store.supportPhone && <p>{store.supportPhone}</p>}
              {store.supportHours && <p className="text-paper/50">{store.supportHours}</p>}
            </div>
            {socials.length > 0 && (
              <ul className="mt-6 flex gap-5 text-[0.6875rem] tracking-[0.16em] uppercase">
                {socials.map(([k, url]) => (
                  <li key={k}>
                    <a href={url} rel="noopener noreferrer" target="_blank" className="hover:text-gold">
                      {k === "x" ? "X" : k}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {columns.map((c) => (
              <div key={c.title}>
                <h2 className="mb-4 font-sans text-[0.6875rem] tracking-[0.18em] text-gold uppercase">{c.title}</h2>
                <ul className="space-y-2.5 text-sm">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-paper/70 transition-colors hover:text-paper">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-paper/10 pt-6 text-xs text-paper/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {store.legalBusinessName || name}. All prices in INR.
          </p>
          <p>Brand names are trademarks of their respective owners. Inspired fragrances are not affiliated with any designer brand.</p>
        </div>
      </div>
    </footer>
  );
}
