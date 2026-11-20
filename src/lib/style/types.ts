import { z } from "zod";
import { FACE_SHAPES, OCCASIONS } from "./quiz";

export const FRAMES = ["inverted_triangle", "trapezoid", "rectangle", "triangle", "oval"] as const;
export const UNDERTONES = ["warm", "cool", "neutral"] as const;
export const DEPTHS = ["light", "deep"] as const;
export const CONTRASTS = ["low", "medium", "high"] as const;
export const HEIGHT_BANDS = ["short", "average", "tall"] as const;
export const CONFIDENCE = ["high", "medium", "low"] as const;

export type FrameKey = (typeof FRAMES)[number];
export type Undertone = (typeof UNDERTONES)[number];
export type Depth = (typeof DEPTHS)[number];
export type PaletteKey = `${Undertone}-${Depth}`;

/** What we concluded about the person. Built from the quiz, refined from photos when AI is available. */
export const observationsSchema = z.object({
  frame: z.enum(FRAMES),
  undertone: z.enum(UNDERTONES),
  depth: z.enum(DEPTHS),
  contrast: z.enum(CONTRASTS),
  faceShape: z.enum(FACE_SHAPES),
  heightBand: z.enum(HEIGHT_BANDS),
  confidence: z.object({
    frame: z.enum(CONFIDENCE),
    colour: z.enum(CONFIDENCE),
    face: z.enum(CONFIDENCE),
  }),
  /** Short, specific things noticed (from photos or answers). Shown to the customer. */
  notes: z.array(z.string().max(300)).max(6),
});
export type Observations = z.infer<typeof observationsSchema>;

/** Stylist corrections. Any field set here wins over the observation. */
export const overridesSchema = z
  .object({
    frame: z.enum(FRAMES),
    undertone: z.enum(UNDERTONES),
    depth: z.enum(DEPTHS),
    contrast: z.enum(CONTRASTS),
    faceShape: z.enum(FACE_SHAPES),
  })
  .partial();
export type Overrides = z.infer<typeof overridesSchema>;

export const swatchSchema = z.object({ name: z.string().max(60), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
export type Swatch = z.infer<typeof swatchSchema>;

export const SLOTS = ["top", "layer", "bottom", "shoes", "accessory"] as const;
export const pieceSchema = z.object({
  slot: z.enum(SLOTS),
  name: z.string().min(1).max(120),
  colour: swatchSchema,
  fit: z.string().max(160).optional(),
  /** Search phrase used for shop links, e.g. "olive linen shirt men". */
  query: z.string().min(1).max(120),
});
export type Piece = z.infer<typeof pieceSchema>;

export const outfitSchema = z.object({
  id: z.string().max(40),
  occasion: z.enum(OCCASIONS),
  title: z.string().min(1).max(120),
  pieces: z.array(pieceSchema).min(2).max(6),
  why: z.string().max(500),
});
export type Outfit = z.infer<typeof outfitSchema>;

export const reportSchema = z.object({
  version: z.literal(1),
  summary: z.object({ headline: z.string().max(200), paragraphs: z.array(z.string().max(1200)).max(4) }),
  frame: z.object({
    key: z.enum(FRAMES),
    name: z.string(),
    description: z.string(),
    goals: z.array(z.string()),
    wear: z.array(z.string()),
    avoid: z.array(z.string()),
    fitFixes: z.array(z.object({ item: z.string(), fix: z.string() })),
  }),
  colour: z.object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    best: z.array(swatchSchema),
    neutrals: z.array(swatchSchema),
    accents: z.array(swatchSchema),
    avoid: z.array(swatchSchema),
    metals: z.string(),
    denim: z.string(),
    contrastTip: z.string(),
    combos: z.array(z.string()),
  }),
  face: z.object({
    key: z.enum(FACE_SHAPES),
    name: z.string(),
    description: z.string(),
    collars: z.array(z.string()),
    eyewear: z.array(z.string()),
    hair: z.array(z.string()),
    beard: z.array(z.string()),
  }),
  proportion: z.object({ band: z.enum(HEIGHT_BANDS), tips: z.array(z.string()) }),
  outfits: z.array(outfitSchema).min(1).max(30),
  capsule: z.array(z.object({ item: z.string(), colour: swatchSchema, why: z.string(), query: z.string() })),
  shopping: z.object({ priceGuide: z.array(z.object({ category: z.string(), range: z.string() })), rules: z.array(z.string()) }),
  avoidList: z.array(z.string()),
});
export type Report = z.infer<typeof reportSchema>;
