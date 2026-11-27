import type { FrameKey } from "./types";
import type { FaceShape } from "./quiz";

export type FrameGuide = {
  name: string;
  description: string;
  goals: string[];
  wear: string[];
  avoid: string[];
  fitFixes: { item: string; fix: string }[];
  /** Fit wording used inside outfit pieces. */
  fit: { shirt: string; tee: string; trouser: string; jeans: string; jacket: string; kurta: string; knit: string };
};

export const FRAMES_GUIDE: Record<FrameKey, FrameGuide> = {
  inverted_triangle: {
    name: "Inverted triangle",
    description: "Your shoulders and chest are clearly broader than your waist and hips. The upper body is already strong — the job is to balance it, not add to it.",
    goals: ["Add a little visual weight to the lower half", "Keep the upper body clean and unpadded", "Show off the taper at the waist without clinging"],
    wear: ["Unstructured or soft-shouldered blazers", "V-necks and open collars that break up the chest", "Straight-leg trousers and chinos with some width", "Textured or lighter-coloured trousers with darker tops", "Chunkier shoes — derbies, boots, substantial sneakers"],
    avoid: ["Padded shoulders and epaulettes", "Horizontal chest stripes and big chest logos", "Skinny trousers — they make the top look top-heavy", "Very tight tees that pull across the chest"],
    fitFixes: [
      { item: "Shirts", fix: "Buy for the shoulders, then have the waist taken in by a tailor (₹150–300). Look for 'athletic fit' cuts." },
      { item: "Trousers", fix: "Straight or relaxed-tapered leg; avoid anything with less than a 17 cm hem opening." },
      { item: "Blazers", fix: "Soft shoulder, slightly longer length to balance the torso." },
    ],
    fit: { shirt: "athletic fit — room in the chest, tapered waist", tee: "fitted at the shoulder, straight body", trouser: "straight leg", jeans: "straight fit", jacket: "unstructured, soft shoulder", kurta: "straight cut, mid-thigh", knit: "fine-gauge, V-neck" },
  },
  trapezoid: {
    name: "Trapezoid",
    description: "Shoulders a little broader than your waist, with balanced proportions overall. This is the most versatile frame — most cuts work, so fit is everything.",
    goals: ["Keep clean, close-to-the-body fits", "Maintain the natural taper", "Experiment freely with layers and patterns"],
    wear: ["Slim-fit shirts and tees", "Structured or unstructured blazers", "Slim-straight trousers and jeans", "Layered looks — overshirts, bombers, Nehru jackets"],
    avoid: ["Oversized everything — it hides your proportions", "Very baggy trousers that drown the leg"],
    fitFixes: [
      { item: "Shirts", fix: "Slim fit; the shoulder seam should sit exactly at your shoulder bone." },
      { item: "Trousers", fix: "Slim-straight with a light break, or none." },
      { item: "Jackets", fix: "Should button without pulling into an X across the stomach." },
    ],
    fit: { shirt: "slim fit", tee: "slim fit", trouser: "slim-straight", jeans: "slim-straight", jacket: "tailored", kurta: "slim, mid-thigh", knit: "fine-gauge crew or V-neck" },
  },
  rectangle: {
    name: "Rectangle",
    description: "Your shoulders, waist and hips are close in width. The goal is to create shape: a bit more breadth up top and a defined waistline.",
    goals: ["Build the shoulder line", "Create a waist with structure and layering", "Break up the straight line with texture and layers"],
    wear: ["Structured blazers and jackets with a defined shoulder", "Layering — overshirts, shackets, Nehru jackets", "Horizontal detail on the chest: pockets, yokes, subtle stripes", "Slim-tapered trousers", "Crew necks and Henleys that widen the neckline"],
    avoid: ["Shapeless, boxy tees with no structure", "Very long untucked shirts", "Low-rise trousers that lengthen the torso"],
    fitFixes: [
      { item: "Shirts", fix: "Slim fit with a chest pocket or two adds width. Tuck in for office looks to create a waistline." },
      { item: "Trousers", fix: "Slim-tapered with a mid rise." },
      { item: "Jackets", fix: "Choose a defined, lightly padded shoulder and a slight waist suppression." },
    ],
    fit: { shirt: "slim fit, with chest pocket", tee: "slim fit, crew neck", trouser: "slim-tapered", jeans: "slim-tapered", jacket: "structured shoulder", kurta: "slim, with Nehru jacket", knit: "crew-neck, mid-gauge" },
  },
  triangle: {
    name: "Triangle",
    description: "Your hips or waist are a little wider than your shoulders. The aim is to broaden the shoulder line and keep the lower half quiet.",
    goals: ["Draw the eye upward", "Add width and structure at the shoulder", "Keep the lower half dark and streamlined"],
    wear: ["Structured jackets with defined shoulders", "Lighter or brighter colours on top, darker trousers", "Patterned shirts, chest pockets and wide collars", "Straight-leg, dark trousers", "Layers that end at the hip, not below"],
    avoid: ["Skinny trousers that emphasise the hips", "Light-coloured or patterned trousers", "Low-slung bags and belts that draw attention to the hip line"],
    fitFixes: [
      { item: "Shirts", fix: "Regular or classic fit with a defined shoulder; avoid tight fits at the hip — have the shoulders fit and let the body skim." },
      { item: "Trousers", fix: "Straight leg in dark colours, flat front." },
      { item: "Jackets", fix: "Structured shoulder; length that ends at the widest point of the hips or just below." },
    ],
    fit: { shirt: "regular fit, structured shoulder", tee: "regular fit, crew neck", trouser: "straight leg, flat front", jeans: "straight fit, dark wash", jacket: "structured shoulder", kurta: "straight cut, below the hip", knit: "crew-neck, chunkier gauge" },
  },
  oval: {
    name: "Oval",
    description: "Your midsection is the widest point. Good news: the right cut and vertical lines make the biggest visible difference for this frame.",
    goals: ["Create clean vertical lines", "Fit from the shoulder and let fabric skim, not cling", "Keep the midsection uninterrupted"],
    wear: ["Straight-cut shirts with some drape — worn untucked if hemmed for it", "Open jackets and overshirts that create a vertical line", "V-necks and open collars", "Mid-to-high-rise straight trousers", "Monochrome or tonal outfits", "Straight-cut kurtas"],
    avoid: ["Tight, clingy fabrics and slim fits that pull at the buttons", "Belts in contrasting colours", "Horizontal stripes across the middle", "Low-rise jeans", "Boxy shirts that end at the widest point"],
    fitFixes: [
      { item: "Shirts", fix: "Fit the shoulders and the stomach, never the chest. Buttons should lie flat with no pulling. A tailor can shorten the hem for untucked wear." },
      { item: "Trousers", fix: "Mid or high rise, straight leg; an extended waistband or side adjusters beat a tight belt." },
      { item: "Jackets", fix: "Single-breasted, one or two buttons, worn open for a long vertical line." },
    ],
    fit: { shirt: "regular fit, straight cut", tee: "regular fit, heavier cotton that doesn't cling", trouser: "mid-rise straight", jeans: "straight fit, mid-rise", jacket: "single-breasted, worn open", kurta: "straight-cut, knee length", knit: "V-neck, fine gauge" },
  },
};

export type FaceGuide = { name: string; description: string; collars: string[]; eyewear: string[]; hair: string[]; beard: string[] };

export const FACES_GUIDE: Record<FaceShape, FaceGuide> = {
  oval: {
    name: "Oval",
    description: "Balanced proportions, slightly longer than wide. Almost every collar, frame and haircut works.",
    collars: ["Any collar works — use it to suit the occasion: spread for office, button-down for casual"],
    eyewear: ["Rectangular, square, aviator or round — keep the frame about as wide as your face"],
    hair: ["Most cuts work: textured crop, side part, quiff", "Avoid fringes that cover the forehead and shorten the face"],
    beard: ["Short, even stubble or a neat short beard keeps the balance", "Most styles suit you — keep the cheek line clean"],
  },
  round: {
    name: "Round",
    description: "Width and length are similar, with soft angles. The goal is to add length and angles.",
    collars: ["Point and narrow-spread collars that create a vertical V", "Avoid wide cutaway collars"],
    eyewear: ["Rectangular and square frames add angles", "Avoid small round frames"],
    hair: ["Height on top with shorter sides: quiff, pompadour, textured top", "Avoid round bowl cuts and heavy fringes"],
    beard: ["A beard that is longer at the chin and shorter at the sides lengthens the face", "Keep the cheeks clean and sharp"],
  },
  square: {
    name: "Square",
    description: "A strong, angular jaw with a broad forehead. Soften a little or lean into the strength.",
    collars: ["Spread and semi-spread collars", "Round-collar and band-collar shirts soften angles"],
    eyewear: ["Round, oval and browline frames soften the jaw", "Avoid very boxy, thick square frames"],
    hair: ["Short, classic cuts — crew cut, side part, slick back", "Some texture on top softens the outline"],
    beard: ["Stubble or a short boxed beard shows off the jaw", "Avoid very square, blocky beard shapes"],
  },
  oblong: {
    name: "Long / oblong",
    description: "The face is noticeably longer than it is wide. The goal is to add width and avoid extra height.",
    collars: ["Spread and cutaway collars add width", "Avoid narrow point collars and deep V-necks"],
    eyewear: ["Deeper frames with strong temples — wayfarers, aviators", "Avoid narrow, small frames"],
    hair: ["Medium-length on the sides, not too much height on top", "A fringe or side-swept front shortens the face"],
    beard: ["Fuller at the sides, shorter at the chin", "Avoid long, pointed chin beards"],
  },
  heart: {
    name: "Heart",
    description: "A wider forehead narrowing to a pointed chin. Balance the forehead and add weight at the jaw.",
    collars: ["Classic spread collars", "Crew necks and Henleys work well"],
    eyewear: ["Bottom-heavy or rimless frames; aviators", "Avoid top-heavy browline frames"],
    hair: ["Medium length with some fringe or side-swept texture to narrow the forehead", "Avoid tight, short sides with lots of height"],
    beard: ["A fuller beard at the chin and jaw adds balance", "A short full beard is ideal"],
  },
  diamond: {
    name: "Diamond",
    description: "Cheekbones are the widest point, with a narrower forehead and chin.",
    collars: ["Spread collars and open necks", "Avoid very narrow collars"],
    eyewear: ["Oval, rimless and browline frames", "Avoid narrow, angular frames"],
    hair: ["Fuller at the forehead: textured fringe, side-swept top", "Avoid very short sides that widen the cheekbones further"],
    beard: ["A fuller chin beard balances the cheekbones", "Keep the sides short"],
  },
};

export function proportionTips(band: "short" | "average" | "tall"): string[] {
  if (band === "short")
    return [
      "Match trouser and shoe colour (or go tonal head-to-toe) to make your legs look longer.",
      "No break or a slight break on trousers — fabric bunching at the ankle cuts height.",
      "Shorter jackets and shirts that end at mid-fly length.",
      "Smaller patterns and proportionate collars; avoid oversized pieces.",
      "Slightly raised sole on boots or derbies adds height without looking forced.",
    ];
  if (band === "tall")
    return [
      "Break up your height with contrast between top and bottom.",
      "Layers, cuffs and turn-ups suit you — use them.",
      "Longer jackets and kurtas keep proportions right; standard lengths can look short.",
      "Check sleeve and inseam lengths — ‘tall’ fits save tailoring.",
    ];
  return [
    "You can play with proportion freely — tonal looks or contrast both work.",
    "A slight break on trousers is the safe default.",
    "Keep jacket length covering the seat of your trousers.",
  ];
}
