import { LABELS, type Budget, type Quiz } from "./quiz";
import { contrastTip, PALETTES } from "./palettes";
import { FACES_GUIDE, FRAMES_GUIDE, proportionTips } from "./frames";
import { generateOutfits, luminance } from "./outfits";
import type { Observations, Outfit, PaletteKey, Report, Swatch } from "./types";

export function paletteKey(o: Pick<Observations, "undertone" | "depth">): PaletteKey {
  return `${o.undertone}-${o.depth}`;
}

const PRICE_GUIDE: Record<Budget, { category: string; range: string }[]> = {
  value: [
    { category: "Shirts", range: "₹700 – 1,500" },
    { category: "T-shirts & polos", range: "₹400 – 900" },
    { category: "Trousers & chinos", range: "₹900 – 1,800" },
    { category: "Jeans", range: "₹1,000 – 2,000" },
    { category: "Blazers & jackets", range: "₹2,500 – 5,000" },
    { category: "Shoes", range: "₹1,500 – 3,000" },
    { category: "Kurtas", range: "₹800 – 2,000" },
  ],
  mid: [
    { category: "Shirts", range: "₹1,500 – 3,500" },
    { category: "T-shirts & polos", range: "₹900 – 2,000" },
    { category: "Trousers & chinos", range: "₹1,800 – 3,500" },
    { category: "Jeans", range: "₹2,000 – 4,000" },
    { category: "Blazers & jackets", range: "₹5,000 – 12,000" },
    { category: "Shoes", range: "₹3,000 – 7,000" },
    { category: "Kurtas", range: "₹2,000 – 5,000" },
  ],
  premium: [
    { category: "Shirts", range: "₹3,500 – 9,000" },
    { category: "T-shirts & polos", range: "₹2,000 – 5,000" },
    { category: "Trousers & chinos", range: "₹3,500 – 9,000" },
    { category: "Jeans", range: "₹4,000 – 12,000" },
    { category: "Blazers & jackets", range: "₹12,000 – 40,000" },
    { category: "Shoes", range: "₹7,000 – 20,000" },
    { category: "Kurtas", range: "₹5,000 – 15,000" },
  ],
};

function capsule(best: Swatch[], neutrals: Swatch[], q: Quiz, leather: string): Report["capsule"] {
  const byLum = [...neutrals].sort((a, b) => luminance(b.hex) - luminance(a.hex));
  const lightest = byLum[0]!;
  const darkest = byLum.at(-1)!;
  const mid = byLum[Math.floor(byLum.length / 2)]!;
  const items: Omit<Report["capsule"][number], "query">[] = [
    { item: "Oxford shirt", colour: lightest, why: "Works tucked for office and open over a tee on weekends." },
    { item: "Oxford shirt", colour: best[0]!, why: "Your strongest colour near your face, every week." },
    { item: "Crew-neck tee", colour: best[1]!, why: "The base of half your casual outfits." },
    { item: "Crew-neck tee", colour: darkest, why: "Dark, slimming, goes with everything." },
    { item: "Knit polo", colour: best[2]!, why: "Smarter than a tee, cooler than a shirt." },
    { item: "Chinos", colour: mid, why: "Your everyday trouser." },
    { item: "Tailored trousers", colour: darkest, why: "For formal days and evenings." },
    { item: "Dark jeans", colour: { name: "Dark indigo", hex: "#26335a" }, why: "The most versatile casual bottom." },
    { item: "Unstructured blazer", colour: best[3] ?? darkest, why: "Turns any tee or shirt into a smart outfit." },
    { item: "Leather loafers", colour: { name: leather, hex: leather === "Black" ? "#141414" : "#8b4a24" }, why: "Smart-casual shoe that works with and without socks." },
    { item: "White leather sneakers", colour: { name: "White", hex: "#f5f5f5" }, why: "Goes with everything casual." },
  ];
  if (q.occasions.includes("festive") || q.style === "fusion") items.push({ item: "Kurta", colour: best[4] ?? best[0]!, why: "Your go-to for pujas, festivals and family events." });
  else items.push({ item: "Overshirt", colour: best[4] ?? best[0]!, why: "A light layer that adds structure." });
  return items.map((i) => ({ ...i, query: `${i.colour.name} ${i.item} men`.toLowerCase() }));
}

function summary(q: Quiz, o: Observations, paletteName: string, frameName: string, faceName: string, outfits: Outfit[]): Report["summary"] {
  const occ = q.occasions.map((x) => LABELS.occasions[x].toLowerCase());
  const occText = occ.length > 1 ? `${occ.slice(0, -1).join(", ")} and ${occ.at(-1)}` : occ[0]!;
  return {
    headline: `${q.firstName}, you're ${/^[aeiou]/i.test(frameName) ? "an" : "a"} ${frameName.toLowerCase()} frame with ${paletteName} colouring.`,
    paragraphs: [
      `${FRAMES_GUIDE[o.frame].goals[0]} — that single idea fixes most of the "it looked better in the shop" problem. Your fit notes below tell you exactly what to look for and what to ask a tailor.`,
      `Your colours: ${PALETTES[paletteKey(o)].best.slice(0, 4).map((s) => s.name.toLowerCase()).join(", ")} and the rest of your palette. Wear them closest to your face; keep the colours you should avoid for trousers and shoes, or skip them.`,
      `We built ${outfits.length} complete outfits weighted towards ${occText}, using cuts for your ${faceName.toLowerCase()} face and ${o.heightBand === "average" ? "height" : `${o.heightBand} height`}. Each piece links straight to shops so you can buy only what's missing.`,
    ],
  };
}

/** Builds the full report. Pure and deterministic for a given (quiz, observations, seed). */
export function buildReport(q: Quiz, o: Observations, seed: string): Report {
  const pk = paletteKey(o);
  const p = PALETTES[pk];
  const f = FRAMES_GUIDE[o.frame];
  const face = FACES_GUIDE[o.faceShape];
  const outfits = generateOutfits({ quiz: q, palette: p, frame: f, undertone: o.undertone, deep: o.depth === "deep", seed });
  const leather = o.undertone === "cool" ? "Black" : "Cognac";

  const fitFixes = [...f.fitFixes];
  if (q.fitIssues.includes("sleeves_long")) fitFixes.push({ item: "Sleeves", fix: "Shortening sleeves costs ₹100–200 and makes a cheap shirt look custom. The cuff should end where your wrist meets your hand." });
  if (q.fitIssues.includes("trousers_long") || o.heightBand === "short") fitFixes.push({ item: "Trouser length", fix: "Hem every new pair to a slight break or none — it's the cheapest upgrade there is." });
  if (q.fitIssues.includes("trousers_tight_thighs")) fitFixes.push({ item: "Thighs", fix: "Look for ‘athletic taper’ or ‘relaxed tapered’ cuts; size up the waist and have it taken in rather than squeezing into slim fits." });
  if (q.fitIssues.includes("shirt_tight_belly")) fitFixes.push({ item: "Button pull", fix: "If buttons pull into an X, go up a size and have the sides taken in elsewhere — never buy for the chest alone." });

  const avoidList = [
    ...f.avoid,
    `Colours that work against you: ${p.avoid.map((s) => s.name.toLowerCase()).join(", ")} — especially near your face.`,
    ...(q.fitIssues.includes("look_skinny") ? ["Very slim, clingy fits — they exaggerate a slim frame. Choose substantial fabrics and layers."] : []),
    ...(q.fitIssues.includes("look_boxy") ? ["Boxy, shapeless tees and stiff oversized shirts."] : []),
  ];

  return {
    version: 1,
    summary: summary(q, o, p.name, f.name, face.name, outfits),
    frame: { key: o.frame, name: f.name, description: f.description, goals: f.goals, wear: f.wear, avoid: f.avoid, fitFixes },
    colour: {
      key: pk,
      name: p.name,
      description: p.description,
      best: p.best,
      neutrals: p.neutrals,
      accents: p.accents,
      avoid: p.avoid,
      metals: p.metals,
      denim: p.denim,
      contrastTip: contrastTip(o.contrast),
      combos: p.combos,
    },
    face: { key: o.faceShape, name: face.name, description: face.description, collars: face.collars, eyewear: face.eyewear, hair: face.hair, beard: face.beard },
    proportion: { band: o.heightBand, tips: proportionTips(o.heightBand) },
    outfits,
    capsule: capsule(p.best, p.neutrals, q, leather),
    shopping: {
      priceGuide: PRICE_GUIDE[q.budget],
      rules: [
        "Buy for your shoulders, then tailor the rest. A ₹200 alteration beats a ₹2,000 upgrade.",
        "Check fabric: 100% cotton, linen or wool blends breathe in Indian weather; avoid high-polyester shirts.",
        "Before buying, name three things you already own that it goes with. If you can't, skip it.",
        "Buy one item in a new colour from your palette before buying it in three.",
      ],
    },
    avoidList,
  };
}

/** What a free preview reveals. Built on the server so locked content never reaches the browser. */
export type ReportPreview = {
  headline: string;
  frame: { name: string; description: string; goals: string[] };
  colour: { name: string; description: string; best: Swatch[]; lockedSwatches: number };
  face: { name: string };
  outfits: Outfit[];
  lockedOutfits: number;
  counts: { fitFixes: number; capsule: number; avoid: number };
};

export function previewOf(r: Report): ReportPreview {
  return {
    headline: r.summary.headline,
    frame: { name: r.frame.name, description: r.frame.description, goals: r.frame.goals.slice(0, 2) },
    colour: { name: r.colour.name, description: r.colour.description, best: r.colour.best.slice(0, 4), lockedSwatches: r.colour.best.length - 4 + r.colour.neutrals.length + r.colour.accents.length + r.colour.avoid.length },
    face: { name: r.face.name },
    outfits: r.outfits.slice(0, 2),
    lockedOutfits: Math.max(0, r.outfits.length - 2),
    counts: { fitFixes: r.frame.fitFixes.length, capsule: r.capsule.length, avoid: r.avoidList.length },
  };
}
