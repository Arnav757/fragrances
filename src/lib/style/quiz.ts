import { z } from "zod";

/**
 * The intake quiz. Every option has a plain-language label for the UI; the keys are what we store.
 * Order matters: it is the order the questions are shown in.
 */

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45+"] as const;
export const BUILDS = ["slim", "athletic", "average", "heavy"] as const;
export const SHOULDERS = ["broader", "balanced", "narrower"] as const;
export const MIDSECTIONS = ["flat", "slight", "prominent"] as const;
export const FIT_ISSUES = [
  "shirt_tight_shoulders",
  "shirt_loose_waist",
  "shirt_tight_belly",
  "sleeves_long",
  "trousers_tight_thighs",
  "trousers_long",
  "look_boxy",
  "look_shorter",
  "look_skinny",
] as const;
export const VEINS = ["green", "blue", "mixed", "unsure"] as const;
export const SUN = ["tans", "burns", "both"] as const;
export const METALS = ["gold", "silver", "both", "unsure"] as const;
export const SKIN_DEPTHS = ["light", "medium", "tan", "deep"] as const;
export const HAIR = ["black", "dark_brown", "brown", "grey", "bald"] as const;
export const FACE_SHAPES = ["oval", "round", "square", "oblong", "heart", "diamond"] as const;
export const FACE_ANSWERS = [...FACE_SHAPES, "unsure"] as const;
export const BEARDS = ["clean", "stubble", "short", "full"] as const;
export const OCCASIONS = ["office_formal", "office_casual", "weekend", "date", "festive", "travel"] as const;
export const STYLES = ["classic", "minimal", "smart_casual", "street", "fusion"] as const;
export const BUDGETS = ["value", "mid", "premium"] as const;

export type Occasion = (typeof OCCASIONS)[number];
export type FaceShape = (typeof FACE_SHAPES)[number];
export type Budget = (typeof BUDGETS)[number];
export type StyleDirection = (typeof STYLES)[number];

export const quizSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { error: "Tell us what to call you" })
    .max(40)
    .regex(/^[\p{L}][\p{L} .'-]*$/u, { error: "Use letters only" }),
  ageRange: z.enum(AGE_RANGES),
  heightCm: z.coerce.number().int().min(140, { error: "Height looks too low" }).max(215, { error: "Height looks too high" }),
  build: z.enum(BUILDS),
  shoulders: z.enum(SHOULDERS),
  midsection: z.enum(MIDSECTIONS),
  fitIssues: z.array(z.enum(FIT_ISSUES)).max(FIT_ISSUES.length).default([]),
  veins: z.enum(VEINS),
  sun: z.enum(SUN),
  metal: z.enum(METALS),
  skinDepth: z.enum(SKIN_DEPTHS),
  hair: z.enum(HAIR),
  faceShape: z.enum(FACE_ANSWERS),
  beard: z.enum(BEARDS),
  glasses: z.boolean(),
  occasions: z.array(z.enum(OCCASIONS)).min(1, { error: "Pick at least one" }).max(3, { error: "Pick up to three" }),
  style: z.enum(STYLES),
  budget: z.enum(BUDGETS),
});

export type Quiz = z.infer<typeof quizSchema>;

export const LABELS = {
  ageRange: { "18-24": "18–24", "25-34": "25–34", "35-44": "35–44", "45+": "45+" },
  build: { slim: "Slim", athletic: "Athletic", average: "Average", heavy: "Heavier set" },
  shoulders: {
    broader: "Shoulders clearly wider than my waist",
    balanced: "Shoulders and waist about the same width",
    narrower: "Waist or hips wider than my shoulders",
  },
  midsection: { flat: "Flat", slight: "A little softness", prominent: "A noticeable belly" },
  fitIssues: {
    shirt_tight_shoulders: "Shirts pull across my shoulders or chest",
    shirt_loose_waist: "Shirts balloon around my waist",
    shirt_tight_belly: "Shirts pull or gape at the buttons over my stomach",
    sleeves_long: "Sleeves are usually too long",
    trousers_tight_thighs: "Trousers are tight on my thighs",
    trousers_long: "Trousers bunch up at the ankle",
    look_boxy: "I look boxy in most clothes",
    look_shorter: "I want to look taller",
    look_skinny: "I want to look less skinny",
  },
  veins: { green: "Mostly green or olive", blue: "Mostly blue or purple", mixed: "A mix of both", unsure: "Can't tell" },
  sun: { tans: "I tan easily and rarely burn", burns: "I burn or go red before I tan", both: "Somewhere in between" },
  metal: { gold: "Gold looks better on me", silver: "Silver looks better on me", both: "Both work", unsure: "Not sure" },
  skinDepth: { light: "Light / fair", medium: "Medium / wheatish", tan: "Tan / dusky", deep: "Deep / dark" },
  hair: { black: "Black", dark_brown: "Dark brown", brown: "Brown / lighter", grey: "Grey or salt-and-pepper", bald: "Shaved / bald" },
  faceShape: {
    oval: "Oval",
    round: "Round",
    square: "Square",
    oblong: "Long / oblong",
    heart: "Heart (wider forehead, narrow chin)",
    diamond: "Diamond (wide cheekbones)",
    unsure: "Not sure — work it out from my photo",
  },
  beard: { clean: "Clean-shaven", stubble: "Stubble", short: "Short beard", full: "Full beard" },
  occasions: {
    office_formal: "Formal office",
    office_casual: "Smart-casual office",
    weekend: "Weekends & casual",
    date: "Dates & evenings out",
    festive: "Weddings, pujas & festivals",
    travel: "Travel",
  },
  style: {
    classic: "Classic — timeless, a bit polished",
    minimal: "Minimal — clean lines, few colours",
    smart_casual: "Smart casual — sharp but relaxed",
    street: "Street — sneakers, overshirts, relaxed fits",
    fusion: "Indo-fusion — kurtas and Nehru jackets in the mix",
  },
  budget: { value: "Value (under ₹1,500 a piece)", mid: "Mid (₹1,500–4,000)", premium: "Premium (₹4,000+)" },
} as const;

/** A sensible example used for the public sample report and in tests. */
export const SAMPLE_QUIZ: Quiz = {
  firstName: "Arjun",
  ageRange: "25-34",
  heightCm: 175,
  build: "athletic",
  shoulders: "broader",
  midsection: "flat",
  fitIssues: ["shirt_tight_shoulders", "shirt_loose_waist"],
  veins: "green",
  sun: "tans",
  metal: "gold",
  skinDepth: "medium",
  hair: "black",
  faceShape: "oval",
  beard: "short",
  glasses: false,
  occasions: ["office_casual", "weekend", "festive"],
  style: "smart_casual",
  budget: "mid",
};
