import type { PaletteKey, Swatch } from "./types";

export type Palette = {
  name: string;
  description: string;
  best: Swatch[];
  neutrals: Swatch[];
  accents: Swatch[];
  avoid: Swatch[];
  metals: string;
  denim: string;
  combos: string[];
};

const s = (name: string, hex: string): Swatch => ({ name, hex });

/**
 * Six palettes: undertone (warm / cool / neutral) × depth (light-to-medium / medium-to-deep).
 * Written for South Asian skin tones first — most Indian men fall in the medium-to-deep half,
 * and the classic Western "seasons" give them washed-out advice.
 */
export const PALETTES: Record<PaletteKey, Palette> = {
  "warm-light": {
    name: "Warm Light",
    description:
      "Golden undertone with light-to-medium depth. Warm, clear mid-tones bring colour to your face; icy shades and stark black drain it.",
    best: [s("Camel", "#c19a6b"), s("Olive", "#708238"), s("Terracotta", "#c8644a"), s("Warm teal", "#2f7f7a"), s("Mustard", "#d4a017"), s("Moss", "#8a9a5b"), s("Coral rust", "#d2694b"), s("Cornflower", "#6f8fcf"), s("Peach", "#f2b38f"), s("Tobacco", "#8b5a2b")],
    neutrals: [s("Ivory", "#f6f0e1"), s("Stone", "#cfc3ad"), s("Khaki", "#b9a37e"), s("Chocolate", "#5a3a22"), s("Warm navy", "#2a3a5c")],
    accents: [s("Saffron", "#f0a030"), s("Leaf green", "#4f9d4f"), s("Brick", "#a94a35")],
    avoid: [s("Jet black", "#0a0a0a"), s("Icy grey", "#d9dee3"), s("Fuchsia", "#d0207a"), s("Lavender", "#b7a5d6"), s("Bright white", "#ffffff")],
    metals: "Gold, brass and brushed bronze. Brown leather straps over black.",
    denim: "Mid-blue with a slightly warm cast; avoid very dark, near-black washes against your face.",
    combos: ["Camel + ivory + warm navy", "Olive + stone + tobacco brown", "Terracotta + khaki + chocolate", "Warm teal + ivory + tan"],
  },
  "warm-deep": {
    name: "Warm Deep",
    description:
      "Golden undertone with medium-to-deep depth — the most common colouring we see in India. Rich, earthy shades with depth make your skin glow; pale pastels and grey wash you out.",
    best: [s("Rust", "#b7410e"), s("Olive", "#5f6b2e"), s("Bottle green", "#1f4d3a"), s("Mustard", "#c9a227"), s("Burgundy", "#7a1f2b"), s("Teal", "#1e6b6b"), s("Camel", "#b8865b"), s("Burnt orange", "#cc5500"), s("Deep plum", "#5b2a4e"), s("Copper", "#b06a3b")],
    neutrals: [s("Cream", "#f2e8d0"), s("Khaki", "#a89466"), s("Chocolate", "#4a2c1a"), s("Charcoal brown", "#3b3530"), s("Ink navy", "#1f2a44")],
    accents: [s("Saffron", "#e8902a"), s("Emerald", "#1f7a4d"), s("Maroon", "#6b1420")],
    avoid: [s("Pastel pink", "#f4c2c2"), s("Baby blue", "#bcd4e6"), s("Light grey", "#c8c8c8"), s("Icy mint", "#c8efe0"), s("Bright white", "#ffffff")],
    metals: "Gold, antique brass and copper. Tan and cognac leather.",
    denim: "Mid to dark indigo with warmth; raw denim works well.",
    combos: ["Rust + cream + ink navy", "Bottle green + khaki + chocolate", "Mustard + charcoal brown + cream", "Burgundy + camel + navy"],
  },
  "cool-light": {
    name: "Cool Light",
    description:
      "Pink-to-blue undertone with light-to-medium depth. Soft cool shades and clean blues flatter you; orange, mustard and yellow-greens make skin look sallow.",
    best: [s("Powder blue", "#a7c4e2"), s("Slate blue", "#5a7394"), s("Dusty rose", "#c48b9f"), s("Lavender grey", "#9f9cb8"), s("Sea green", "#4f9a8a"), s("Raspberry", "#b03a5b"), s("Periwinkle", "#8890c9"), s("Soft teal", "#4c8c96"), s("Mauve", "#a4788f"), s("Cool berry", "#7f3a63")],
    neutrals: [s("Soft white", "#f4f5f6"), s("Dove grey", "#b8bcc2"), s("Charcoal", "#3a3d42"), s("Navy", "#1e2b4a"), s("Taupe grey", "#8f8a86")],
    accents: [s("Cobalt", "#2b59c3"), s("Emerald", "#1f8a5c"), s("Fuchsia", "#c2307a")],
    avoid: [s("Orange", "#f07c1a"), s("Mustard", "#c9a227"), s("Camel", "#c19a6b"), s("Rust", "#b7410e"), s("Olive drab", "#6b6b2a")],
    metals: "Silver, white gold and gunmetal. Black or grey leather.",
    denim: "Clean mid-blue or grey-blue washes.",
    combos: ["Navy + powder blue + soft white", "Charcoal + dusty rose + dove grey", "Slate blue + white + grey", "Sea green + navy + white"],
  },
  "cool-deep": {
    name: "Cool Deep",
    description:
      "Cool undertone with medium-to-deep depth and strong natural contrast. Crisp, saturated jewel tones and true black and white look sharp on you; muddy earth tones flatten you.",
    best: [s("Royal blue", "#2747a8"), s("Emerald", "#0f6b4c"), s("Ruby", "#9b1b30"), s("Amethyst", "#5f3a8a"), s("Sapphire", "#1c3f94"), s("Pine", "#14453d"), s("Icy blue", "#cfe3f2"), s("Magenta", "#a3175a"), s("Teal", "#0f5f6b"), s("Burgundy", "#6e1028")],
    neutrals: [s("Pure white", "#fbfbfb"), s("Black", "#111111"), s("Charcoal", "#2f3136"), s("Navy", "#14203d"), s("Cool grey", "#8c9198")],
    accents: [s("Cobalt", "#1f4fd1"), s("Hot pink", "#d02a78"), s("Lemon ice", "#f3f2a6")],
    avoid: [s("Beige", "#d8c3a0"), s("Orange", "#e8761c"), s("Mustard", "#c4a12a"), s("Khaki", "#b4a27a"), s("Peach", "#f2b38f")],
    metals: "Silver, platinum and black steel. Black leather.",
    denim: "Dark rinse or black denim.",
    combos: ["Navy + white + black", "Emerald + charcoal + white", "Burgundy + black + grey", "Royal blue + white + navy"],
  },
  "neutral-light": {
    name: "Neutral Light",
    description:
      "Balanced undertone with light-to-medium depth. You can wear both warm and cool shades as long as they are softened and mid-intensity; very bright or very icy extremes overpower you.",
    best: [s("Sage", "#9caf88"), s("Dusty blue", "#6c8ead"), s("Soft teal", "#4f8f8c"), s("Muted coral", "#d98a74"), s("Heather grey", "#9a9a9a"), s("Soft navy", "#33415c"), s("Rose brown", "#a0675e"), s("Jade", "#4a9a7b"), s("Stone blue", "#7d93a8"), s("Wine", "#7b3045")],
    neutrals: [s("Off-white", "#f3efe7"), s("Greige", "#b9b1a5"), s("Taupe", "#8b7d70"), s("Graphite", "#45474d"), s("Navy", "#22304f")],
    accents: [s("Turquoise", "#2aa198"), s("Raspberry", "#b33b5e"), s("Moss", "#7a8a4a")],
    avoid: [s("Neon yellow", "#e5f22a"), s("Bright orange", "#ff6a00"), s("Jet black", "#0a0a0a"), s("Electric blue", "#0047ff"), s("Hot pink", "#ff2d95")],
    metals: "Both work — brushed or matte finishes look best. Mid-brown leather.",
    denim: "Mid-blue, lightly faded.",
    combos: ["Sage + off-white + navy", "Dusty blue + greige + taupe", "Wine + graphite + off-white", "Soft teal + navy + stone"],
  },
  "neutral-deep": {
    name: "Neutral Deep",
    description:
      "Balanced undertone with medium-to-deep depth. Deep, rich colours from both families suit you — think forest, navy, wine and teal — while pale pastels and greige disappear against your skin.",
    best: [s("Forest", "#234d36"), s("Navy", "#1c2b4f"), s("Wine", "#6d1f33"), s("Deep teal", "#145a5f"), s("Aubergine", "#4a2545"), s("Olive", "#5c6630"), s("Rust", "#a7462a"), s("Cobalt", "#2a4fb0"), s("Cognac", "#8b4a24"), s("Plum", "#6a2c5a")],
    neutrals: [s("Cream", "#efe6d2"), s("Charcoal", "#33353a"), s("Espresso", "#3b2a20"), s("Midnight", "#141b2d"), s("Warm grey", "#7d766e")],
    accents: [s("Marigold", "#e39b1b"), s("Emerald", "#16784f"), s("Crimson", "#a3172e")],
    avoid: [s("Pastel yellow", "#f7eda0"), s("Baby pink", "#f4c8d2"), s("Greige", "#c9c0b3"), s("Light khaki", "#d2c39a"), s("Mint", "#bfe9d4")],
    metals: "Gold or silver — antique and darker finishes look richest. Dark brown leather.",
    denim: "Dark indigo or black.",
    combos: ["Forest + cream + espresso", "Wine + charcoal + cream", "Deep teal + navy + white", "Rust + midnight + cream"],
  },
};

export function contrastTip(contrast: "low" | "medium" | "high"): string {
  if (contrast === "high")
    return "You have high natural contrast (dark hair against your skin). Outfits with contrast — a dark jacket over a light shirt — look intentional on you; head-to-toe mid-tones can look flat.";
  if (contrast === "medium")
    return "You have medium contrast. Pair one darker and one mid-tone piece; avoid stark black-and-white combinations right next to your face.";
  return "Your natural contrast is soft. Tonal outfits (shades of one colour) and blended combinations flatter you more than sharp black-and-white pairings.";
}
