import type { Occasion, Quiz, StyleDirection } from "./quiz";
import { OCCASIONS } from "./quiz";
import type { FrameGuide } from "./frames";
import type { Palette } from "./palettes";
import type { Outfit, Piece, Swatch, Undertone } from "./types";

type Role = "best" | "light" | "dark" | "mid" | "accent" | "denim" | "leather" | "white";
type FitKey = keyof FrameGuide["fit"];
type TplPiece = [slot: Piece["slot"], garment: string, role: Role, fit?: FitKey];
type Template = { title: string; styles?: StyleDirection[]; pieces: TplPiece[]; why: string };

/**
 * Outfit templates per occasion. Colours are roles resolved against the person's palette, fits come
 * from their frame — so the same template produces genuinely different outfits for different men.
 */
const T: Record<Occasion, Template[]> = {
  office_formal: [
    { title: "The boardroom default", styles: ["classic", "minimal"], pieces: [["top", "poplin dress shirt", "light", "shirt"], ["layer", "two-piece suit", "dark", "jacket"], ["shoes", "oxford shoes", "leather"], ["accessory", "silk tie", "best"]], why: "A dark suit and light shirt is the highest-contrast, most authoritative combination — the tie is where your best colour earns its place." },
    { title: "Suit without the tie", styles: ["smart_casual", "minimal"], pieces: [["top", "oxford shirt", "white", "shirt"], ["layer", "suit", "best", "jacket"], ["shoes", "suede loafers", "leather"]], why: "Wearing a suit in one of your best colours instead of black gives you presence without looking like a uniform." },
    { title: "Odd jacket, sharp trousers", styles: ["classic", "smart_casual"], pieces: [["top", "fine-twill shirt", "light", "shirt"], ["layer", "wool blazer", "best", "jacket"], ["bottom", "wool trousers", "dark", "trouser"], ["shoes", "derby shoes", "leather"]], why: "Separates read as confident and personal; the darker trouser grounds the look." },
    { title: "Bandhgala formal", styles: ["fusion", "classic"], pieces: [["top", "bandhgala jacket", "dark", "jacket"], ["bottom", "tailored trousers", "dark", "trouser"], ["shoes", "oxford shoes", "leather"], ["accessory", "pocket square", "accent"]], why: "The bandhgala is India's most elegant formal option — a single dark tone with one accent keeps it modern." },
    { title: "Tonal dark formal", styles: ["minimal"], pieces: [["top", "dress shirt", "mid", "shirt"], ["layer", "blazer", "dark", "jacket"], ["bottom", "trousers", "dark", "trouser"], ["shoes", "chelsea boots", "leather"]], why: "Tonal dressing is quiet and expensive-looking, and creates a long unbroken line." },
    { title: "Client-meeting knit", styles: ["minimal", "smart_casual"], pieces: [["top", "dress shirt", "light", "shirt"], ["layer", "merino V-neck sweater", "best", "knit"], ["bottom", "wool trousers", "dark", "trouser"], ["shoes", "oxford shoes", "leather"]], why: "For air-conditioned offices: the knit adds colour near your face and softens a formal look." },
    { title: "Summer formal", styles: ["classic"], pieces: [["top", "linen-blend shirt", "white", "shirt"], ["layer", "unlined blazer", "mid", "jacket"], ["bottom", "trousers", "dark", "trouser"], ["shoes", "loafers", "leather"]], why: "Breathable fabrics for Indian summers without losing structure." },
  ],
  office_casual: [
    { title: "Oxford and chinos", styles: ["classic", "smart_casual"], pieces: [["top", "oxford button-down shirt", "best", "shirt"], ["bottom", "chinos", "light", "trouser"], ["shoes", "suede derby shoes", "leather"], ["accessory", "leather belt", "leather"]], why: "The most reliable smart-casual formula, with your best colour where people look first." },
    { title: "Polo and trousers", styles: ["minimal", "smart_casual"], pieces: [["top", "knit polo", "best", "tee"], ["bottom", "pleated trousers", "dark", "trouser"], ["shoes", "loafers", "leather"]], why: "A knitted polo looks sharper than a pique one and suits hot weather." },
    { title: "Overshirt Friday", styles: ["street", "smart_casual"], pieces: [["top", "crew-neck tee", "light", "tee"], ["layer", "cotton overshirt", "best", "jacket"], ["bottom", "chinos", "dark", "trouser"], ["shoes", "leather sneakers", "white"]], why: "The overshirt adds structure at the shoulder and works as a light jacket indoors." },
    { title: "Kurta to work", styles: ["fusion"], pieces: [["top", "short cotton kurta", "best", "kurta"], ["bottom", "slim trousers", "dark", "trouser"], ["shoes", "loafers", "leather"]], why: "A short kurta over trousers is office-appropriate and far more comfortable than a shirt in humid weather." },
    { title: "Unstructured blazer, tee", styles: ["minimal", "smart_casual", "classic"], pieces: [["top", "premium crew-neck tee", "white", "tee"], ["layer", "unstructured blazer", "best", "jacket"], ["bottom", "trousers", "mid", "trouser"], ["shoes", "leather sneakers", "white"]], why: "Smart enough for meetings, relaxed enough for the rest of the day." },
    { title: "Textured shirt, dark denim", styles: ["smart_casual", "street"], pieces: [["top", "textured cotton shirt", "best", "shirt"], ["bottom", "jeans", "denim", "jeans"], ["shoes", "chelsea boots", "leather"]], why: "Dark denim with a good shirt passes most smart-casual dress codes." },
    { title: "Nehru layer", styles: ["fusion", "classic"], pieces: [["top", "mandarin-collar shirt", "light", "shirt"], ["layer", "Nehru jacket", "best", "jacket"], ["bottom", "chinos", "dark", "trouser"], ["shoes", "loafers", "leather"]], why: "A Nehru jacket adds structure and a waistline — it's the Indian answer to the blazer." },
  ],
  weekend: [
    { title: "Tee and jeans, done right", styles: ["minimal", "street", "smart_casual"], pieces: [["top", "heavyweight tee", "best", "tee"], ["bottom", "jeans", "denim", "jeans"], ["shoes", "sneakers", "white"]], why: "The simplest outfit there is — it only works when the fit is right and the colour is yours." },
    { title: "Linen weekend", styles: ["classic", "minimal", "smart_casual"], pieces: [["top", "linen shirt", "best", "shirt"], ["bottom", "chino shorts", "light", "trouser"], ["shoes", "suede loafers", "leather"]], why: "Linen in your best colour is the best thing you can wear in Indian heat." },
    { title: "Henley and chinos", styles: ["smart_casual", "classic"], pieces: [["top", "henley", "best", "tee"], ["bottom", "chinos", "mid", "trouser"], ["shoes", "canvas sneakers", "white"]], why: "The henley's placket breaks up the chest and frames the face." },
    { title: "Relaxed street", styles: ["street"], pieces: [["top", "boxy tee", "dark", "tee"], ["layer", "overshirt", "best", "jacket"], ["bottom", "cargo trousers", "mid", "trouser"], ["shoes", "chunky sneakers", "white"]], why: "Relaxed but intentional — the overshirt in your colour does the work." },
    { title: "Camp-collar shirt", styles: ["street", "smart_casual", "minimal"], pieces: [["top", "camp-collar shirt", "accent", "shirt"], ["layer", "tee underneath", "white", "tee"], ["bottom", "pleated trousers", "light", "trouser"], ["shoes", "leather sandals", "leather"]], why: "An open camp collar is cool and flattering — use one of your accent colours here." },
    { title: "Short kurta casual", styles: ["fusion"], pieces: [["top", "short linen kurta", "best", "kurta"], ["bottom", "jeans", "denim", "jeans"], ["shoes", "kolhapuri sandals", "leather"]], why: "Indo-western at its easiest: a short kurta over denim." },
    { title: "Polo and shorts", styles: ["classic", "smart_casual", "minimal"], pieces: [["top", "polo shirt", "best", "tee"], ["bottom", "tailored shorts", "dark", "trouser"], ["shoes", "sneakers", "white"]], why: "Shorts ending just above the knee, with a collared top, keep a casual look grown-up." },
  ],
  date: [
    { title: "Dark and sharp", styles: ["minimal", "smart_casual", "classic"], pieces: [["top", "fine knit polo", "best", "knit"], ["bottom", "trousers", "dark", "trouser"], ["shoes", "suede chelsea boots", "leather"]], why: "A fine knit catches the light and looks expensive; keep everything else dark and simple." },
    { title: "Shirt, open collar", styles: ["classic", "smart_casual"], pieces: [["top", "cotton shirt", "best", "shirt"], ["bottom", "jeans", "denim", "jeans"], ["shoes", "loafers", "leather"], ["accessory", "watch on leather strap", "leather"]], why: "Two buttons open, sleeves rolled twice — your best colour framing your face." },
    { title: "Monochrome evening", styles: ["minimal", "street"], pieces: [["top", "crew-neck tee", "dark", "tee"], ["layer", "bomber jacket", "dark", "jacket"], ["bottom", "trousers", "dark", "trouser"], ["shoes", "leather sneakers", "white"]], why: "Head-to-toe dark is confident and slimming; white shoes stop it looking heavy." },
    { title: "Blazer and tee", styles: ["smart_casual", "classic"], pieces: [["top", "premium tee", "light", "tee"], ["layer", "blazer", "best", "jacket"], ["bottom", "jeans", "denim", "jeans"], ["shoes", "suede loafers", "leather"]], why: "Dressed up without trying too hard." },
    { title: "Rich colour statement", styles: ["street", "smart_casual"], pieces: [["top", "knit shirt", "accent", "knit"], ["bottom", "trousers", "dark", "trouser"], ["shoes", "loafers", "leather"]], why: "One bold colour from your accent range, everything else quiet." },
    { title: "Kurta date night", styles: ["fusion"], pieces: [["top", "silk-blend kurta", "best", "kurta"], ["bottom", "churidar or slim trousers", "light", "trouser"], ["shoes", "mojaris", "leather"]], why: "A rich kurta in your colour is memorable without being loud." },
    { title: "Leather and layers", styles: ["street", "classic"], pieces: [["top", "henley", "light", "tee"], ["layer", "suede or leather jacket", "leather", "jacket"], ["bottom", "jeans", "denim", "jeans"], ["shoes", "boots", "leather"]], why: "For cooler evenings: texture and a defined shoulder." },
  ],
  festive: [
    { title: "Classic kurta pyjama", styles: ["fusion", "classic", "minimal", "smart_casual", "street"], pieces: [["top", "cotton-silk kurta", "best", "kurta"], ["bottom", "churidar", "light", "trouser"], ["shoes", "juttis", "leather"]], why: "The festive essential — in your best colour instead of the usual default." },
    { title: "Kurta with Nehru jacket", styles: ["fusion", "classic", "smart_casual"], pieces: [["top", "kurta", "light", "kurta"], ["layer", "Nehru jacket", "best", "jacket"], ["bottom", "churidar", "light", "trouser"], ["shoes", "mojaris", "leather"]], why: "The jacket adds structure at the shoulders and a waistline — ideal for every frame." },
    { title: "Bandhgala for weddings", styles: ["classic", "minimal"], pieces: [["top", "bandhgala", "best", "jacket"], ["bottom", "tailored trousers", "dark", "trouser"], ["shoes", "polished oxfords", "leather"], ["accessory", "brooch or pocket square", "accent"]], why: "Regal, sharp and easier to rewear than a sherwani." },
    { title: "Pathani set", styles: ["fusion", "street", "smart_casual"], pieces: [["top", "pathani kurta", "dark", "kurta"], ["bottom", "salwar", "dark", "trouser"], ["shoes", "kolhapuri sandals", "leather"]], why: "A strong, simple silhouette — the single dark tone is slimming and dignified." },
    { title: "Indo-western jacket", styles: ["smart_casual", "street", "minimal"], pieces: [["top", "mandarin-collar shirt", "white", "shirt"], ["layer", "embroidered Indo-western jacket", "best", "jacket"], ["bottom", "slim trousers", "dark", "trouser"], ["shoes", "loafers", "leather"]], why: "Festive enough for a sangeet, wearable again for a dinner." },
    { title: "Puja morning", styles: ["minimal", "classic", "fusion"], pieces: [["top", "linen kurta", "light", "kurta"], ["bottom", "dhoti pants or pyjama", "white", "trouser"], ["shoes", "kolhapuri sandals", "leather"], ["accessory", "stole", "accent"]], why: "Light, breathable and respectful — a stole adds colour where it counts." },
    { title: "Reception sherwani", styles: ["classic", "fusion"], pieces: [["top", "sherwani", "best", "jacket"], ["bottom", "churidar", "light", "trouser"], ["shoes", "embroidered mojaris", "leather"], ["accessory", "stole", "accent"]], why: "For the big events: one rich colour from your palette with tonal embellishment." },
  ],
  travel: [
    { title: "Airport smart", styles: ["minimal", "smart_casual", "street", "classic", "fusion"], pieces: [["top", "merino or cotton tee", "dark", "tee"], ["layer", "lightweight overshirt", "best", "jacket"], ["bottom", "travel chinos with stretch", "mid", "trouser"], ["shoes", "slip-on sneakers", "white"]], why: "Comfortable for hours, still looks put together on arrival." },
    { title: "Hill-station layers", styles: ["classic", "smart_casual"], pieces: [["top", "henley", "light", "tee"], ["layer", "quilted jacket", "best", "jacket"], ["bottom", "jeans", "denim", "jeans"], ["shoes", "desert boots", "leather"]], why: "Layers you can add and remove as the temperature changes." },
    { title: "Beach holiday", styles: ["street", "smart_casual", "minimal"], pieces: [["top", "linen camp-collar shirt", "accent", "shirt"], ["bottom", "swim shorts", "dark", "trouser"], ["shoes", "leather sliders", "leather"]], why: "Your accent colours look best with a tan — this is where to use them." },
    { title: "City walking", styles: ["minimal", "street", "smart_casual", "classic", "fusion"], pieces: [["top", "polo shirt", "best", "tee"], ["bottom", "chinos", "light", "trouser"], ["shoes", "cushioned sneakers", "white"], ["accessory", "crossbody bag", "leather"]], why: "Breathable, easy to move in, and smart enough for a nice lunch." },
    { title: "Long-haul comfort", styles: ["minimal", "street"], pieces: [["top", "knit sweatshirt", "mid", "knit"], ["bottom", "tapered joggers", "dark", "trouser"], ["shoes", "minimal sneakers", "white"]], why: "Tonal, soft and wrinkle-proof." },
    { title: "Weekend getaway dinner", styles: ["classic", "smart_casual", "fusion"], pieces: [["top", "linen shirt", "best", "shirt"], ["bottom", "linen trousers", "light", "trouser"], ["shoes", "suede loafers", "leather"]], why: "Packs light and works from lunch to dinner." },
  ],
};

export const TEMPLATE_COUNT = Object.values(T).reduce((n, l) => n + l.length, 0);

// ---------------------------------------------------------------- deterministic randomness

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: string) {
  let a = hashSeed(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

// ---------------------------------------------------------------- colour roles

function denimFor(undertone: Undertone, deep: boolean): Swatch[] {
  if (undertone === "cool") return deep ? [{ name: "Black denim", hex: "#1d1f24" }, { name: "Dark rinse", hex: "#1f2a44" }] : [{ name: "Mid-blue denim", hex: "#4a6a9b" }, { name: "Grey-blue denim", hex: "#5d6f86" }];
  if (undertone === "warm") return deep ? [{ name: "Raw indigo", hex: "#23305a" }, { name: "Dark indigo", hex: "#2b3a67" }] : [{ name: "Mid-blue denim", hex: "#4f6d99" }, { name: "Indigo", hex: "#2f4170" }];
  return [{ name: "Dark indigo", hex: "#26335a" }, { name: "Mid-blue denim", hex: "#4a6a9b" }];
}

function leatherFor(undertone: Undertone): Swatch[] {
  if (undertone === "cool") return [{ name: "Black", hex: "#141414" }, { name: "Dark brown", hex: "#3d2618" }];
  if (undertone === "warm") return [{ name: "Tan", hex: "#a8693a" }, { name: "Cognac", hex: "#8b4a24" }, { name: "Dark brown", hex: "#4a2c1a" }];
  return [{ name: "Dark brown", hex: "#4a2c1a" }, { name: "Cognac", hex: "#8b4a24" }];
}

type RolePools = Record<Role, Swatch[]>;

function rolePools(p: Palette, undertone: Undertone, deep: boolean): RolePools {
  const neutrals = [...p.neutrals].sort((a, b) => luminance(b.hex) - luminance(a.hex));
  const light = neutrals.filter((s) => luminance(s.hex) > 0.35);
  const dark = neutrals.filter((s) => luminance(s.hex) < 0.08);
  const mid = neutrals.filter((s) => !light.includes(s) && !dark.includes(s));
  const white = undertone === "warm" ? { name: "Off-white", hex: "#f4efe4" } : { name: "White", hex: "#f7f7f7" };
  return {
    best: p.best,
    accent: p.accents,
    light: light.length ? light : [white],
    dark: dark.length ? dark : [neutrals.at(-1)!],
    mid: mid.length ? mid : [...p.best.filter((s) => luminance(s.hex) > 0.08 && luminance(s.hex) < 0.35).slice(0, 3), neutrals[Math.floor(neutrals.length / 2)]!],
    denim: denimFor(undertone, deep),
    leather: leatherFor(undertone),
    white: [white],
  };
}

// ---------------------------------------------------------------- allocation

/** How many outfits per occasion: the chosen occasions get most of them. */
export function allocate(chosen: Occasion[], total = 20): Record<Occasion, number> {
  const out = Object.fromEntries(OCCASIONS.map((o) => [o, 0])) as Record<Occasion, number>;
  const perChosen = chosen.length === 1 ? 7 : chosen.length === 2 ? 6 : 5;
  for (const o of chosen) out[o] = Math.min(perChosen, T[o].length);
  let remaining = total - Object.values(out).reduce((a, b) => a + b, 0);
  const others = OCCASIONS.filter((o) => !chosen.includes(o));
  // Spread the rest over the other occasions first, then top up the chosen ones.
  for (const group of [others, chosen]) {
    let placed = true;
    while (remaining > 0 && placed) {
      placed = false;
      for (const o of group) {
        if (remaining > 0 && out[o] < T[o].length) {
          out[o]++;
          remaining--;
          placed = true;
        }
      }
    }
  }
  return out;
}

export function generateOutfits(input: { quiz: Quiz; palette: Palette; frame: FrameGuide; undertone: Undertone; deep: boolean; seed: string; total?: number }): Outfit[] {
  const { quiz, palette, frame, seed } = input;
  const rand = rng(seed);
  const pools = rolePools(palette, input.undertone, input.deep);
  const counts = allocate(quiz.occasions, input.total ?? 20);
  const usedBest = new Map<string, number>();

  // Pick colours so the same "best" colour isn't repeated too often across the whole wardrobe.
  function pick(role: Role, avoid: Set<string>): Swatch {
    const pool = pools[role];
    const candidates = pool.filter((s) => !avoid.has(s.name));
    const list = candidates.length ? candidates : pool;
    if (role === "best" || role === "accent") {
      const sorted = [...list].sort((a, b) => (usedBest.get(a.name) ?? 0) - (usedBest.get(b.name) ?? 0) || rand() - 0.5);
      const chosen = sorted[Math.floor(rand() * Math.min(3, sorted.length))]!;
      usedBest.set(chosen.name, (usedBest.get(chosen.name) ?? 0) + 1);
      return chosen;
    }
    return list[Math.floor(rand() * list.length)]!;
  }

  const outfits: Outfit[] = [];
  // Interleave occasions so the user's priorities appear first, then the rest.
  const orderedOccasions = [...quiz.occasions, ...OCCASIONS.filter((o) => !quiz.occasions.includes(o))];
  for (const occ of orderedOccasions) {
    const n = counts[occ];
    if (!n) continue;
    const templates = [...T[occ]]
      .map((t, i) => ({ t, i, score: (t.styles?.includes(quiz.style) ? 0 : 1) + rand() * 0.5 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, n);
    for (const { t, i } of templates) {
      const used = new Set<string>();
      const pieces: Piece[] = t.pieces.map(([slot, garment, role, fitKey]) => {
        const colour = pick(role, used);
        used.add(colour.name);
        const name = `${colour.name} ${garment}`;
        return {
          slot,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          colour,
          ...(fitKey ? { fit: frame.fit[fitKey] } : {}),
          query: `${colour.name} ${garment} men`.toLowerCase().replace(/\s+/g, " ").slice(0, 120),
        };
      });
      outfits.push({ id: `${occ}-${i}`, occasion: occ, title: t.title, pieces, why: t.why });
    }
  }
  return outfits;
}
