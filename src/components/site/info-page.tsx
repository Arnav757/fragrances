import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { Breadcrumbs, Container } from "../ui/misc";
import { getPages, getSettings, storeName } from "@/lib/settings";
import { PAGE_META, type PageKey } from "@/lib/default-pages";

export function infoMetadata(key: PageKey): Metadata {
  const m = PAGE_META[key];
  return { title: m.title, description: m.description, alternates: { canonical: m.path } };
}

/** Renders an editable Markdown page. Markdown is rendered without raw HTML, so admin content can't inject scripts. */
export async function InfoPage({ pageKey }: { pageKey: PageKey }) {
  const [pages, store, pricing, privacy] = await Promise.all([getPages(), getSettings("store"), getSettings("pricing"), getSettings("privacy")]);
  const pending = "(to be published)";
  const tokens: Record<string, string> = {
    storeName: storeName(store),
    legalBusinessName: store.legalBusinessName || storeName(store),
    supportEmail: store.supportEmail || pending,
    whatsapp: store.whatsapp || pending,
    businessAddress: store.businessAddress || pending,
    standardHours: String(pricing.standardHours),
    priorityHours: String(pricing.priorityHours),
    photoRetentionDays: String(privacy.photoRetentionDays),
    unpaidRetentionDays: String(privacy.unpaidRetentionDays),
  };
  const body = pages[pageKey].replace(/\{\{(\w+)\}\}/g, (_, k: string) => tokens[k] ?? "");
  const meta = PAGE_META[pageKey];
  return (
    <Container size="narrow" className="py-12 lg:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: meta.title }]} />
      <h1 className="mt-6 text-4xl sm:text-5xl">{meta.title}</h1>
      <article className="prose-store mt-8">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => {
              const safe = href && (href.startsWith("/") || href.startsWith("https://") || href.startsWith("mailto:")) ? href : undefined;
              return (
                <a href={safe} rel={safe?.startsWith("https://") ? "noopener noreferrer" : undefined}>
                  {children}
                </a>
              );
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
