import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { Breadcrumbs, Container } from "../ui/misc";
import { getPages, getSettings, storeName } from "@/lib/settings";
import { PAGE_META, type PageKey } from "@/lib/default-pages";
import { formatINR } from "@/lib/money";

export function infoMetadata(key: PageKey): Metadata {
  const m = PAGE_META[key];
  return { title: m.title, description: m.description, alternates: { canonical: m.path } };
}

/** Renders an editable Markdown page. Markdown is rendered without raw HTML, so admin content can't inject scripts. */
export async function InfoPage({ pageKey }: { pageKey: PageKey }) {
  const [pages, store, commerce] = await Promise.all([getPages(), getSettings("store"), getSettings("commerce")]);
  const pending = "(to be published)";
  const tokens: Record<string, string> = {
    storeName: storeName(store),
    legalBusinessName: store.legalBusinessName || storeName(store),
    supportEmail: store.supportEmail || pending,
    supportPhone: store.supportPhone || pending,
    supportHours: store.supportHours || pending,
    businessAddress: store.businessAddress || "",
    returnWindowDays: String(commerce.returnWindowDays),
    flatShipping: formatINR(commerce.flatShippingPaise),
    freeShippingThreshold: commerce.freeShippingThresholdPaise !== null ? formatINR(commerce.freeShippingThresholdPaise) : "— (not offered)",
    codStatus: commerce.codEnabled
      ? `Yes — cash on delivery is available on eligible orders up to ${formatINR(commerce.codMaxOrderPaise)}${commerce.codFeePaise ? `, with a ${formatINR(commerce.codFeePaise)} COD fee` : ""}.`
      : "Cash on delivery is not offered at the moment. Please pay online.",
  };
  const body = pages[pageKey].replace(/\{\{(\w+)\}\}/g, (_, k: string) => tokens[k] ?? "");
  const meta = PAGE_META[pageKey];
  return (
    <Container size="narrow" className="py-12 lg:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: meta.title }]} />
      <h1 className="mt-6 text-4xl text-ink sm:text-5xl">{meta.title}</h1>
      <article className="prose-store mt-8">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => {
              const safe = href && (href.startsWith("/") || href.startsWith("https://") || href.startsWith("mailto:")) ? href : undefined;
              return <a href={safe} rel={safe?.startsWith("https://") ? "noopener noreferrer" : undefined}>{children}</a>;
            },
            img: () => null,
          }}
        >
          {body}
        </ReactMarkdown>
      </article>
    </Container>
  );
}
