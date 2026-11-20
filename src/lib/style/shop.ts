export type ShopSettings = { amazonTag: string; myntraEnabled: boolean; ajioEnabled: boolean; amazonEnabled: boolean };

export type ShopLink = { store: "Myntra" | "Ajio" | "Amazon"; href: string; affiliate: boolean };

/**
 * Search links for a piece at Indian retailers. These are honest *searches*, not product picks — we
 * never claim a specific product was chosen for the customer. Amazon links carry the Associates tag
 * when configured, and are then marked as affiliate links in the UI.
 */
export function shopLinks(query: string, s: ShopSettings): ShopLink[] {
  const q = query.trim().slice(0, 120);
  const out: ShopLink[] = [];
  if (s.myntraEnabled) out.push({ store: "Myntra", href: `https://www.myntra.com/${encodeURIComponent(q.replace(/\s+/g, "-"))}`, affiliate: false });
  if (s.ajioEnabled) out.push({ store: "Ajio", href: `https://www.ajio.com/search/?text=${encodeURIComponent(q)}`, affiliate: false });
  if (s.amazonEnabled) {
    const tag = /^[A-Za-z0-9-]{3,40}$/.test(s.amazonTag) ? s.amazonTag : "";
    out.push({ store: "Amazon", href: `https://www.amazon.in/s?k=${encodeURIComponent(q)}${tag ? `&tag=${tag}` : ""}`, affiliate: Boolean(tag) });
  }
  return out;
}
