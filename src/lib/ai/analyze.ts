import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "../env";
import { FACE_SHAPES, LABELS, type Quiz } from "../style/quiz";
import { CONFIDENCE, CONTRASTS, DEPTHS, FRAMES, UNDERTONES, type Observations } from "../style/types";

/** What the model returns. Kept free of length constraints; we clamp after parsing. */
const aiSchema = z.object({
  photosUsable: z.boolean(),
  photoProblem: z.string(),
  frame: z.enum(FRAMES),
  frameConfidence: z.enum(CONFIDENCE),
  undertone: z.enum(UNDERTONES),
  depth: z.enum(DEPTHS),
  contrast: z.enum(CONTRASTS),
  colourConfidence: z.enum(CONFIDENCE),
  faceShape: z.enum(FACE_SHAPES),
  faceConfidence: z.enum(CONFIDENCE),
  notes: z.array(z.string()),
});
type AiResult = z.infer<typeof aiSchema>;

export type Photo = { bytes: Uint8Array; mime: "image/jpeg" | "image/png" | "image/webp" };

export type AnalysisOutcome =
  | { used: true; observations: Observations; model: string }
  | { used: false; reason: string };

const SYSTEM = `You are an experienced men's personal stylist working for an Indian styling service. You assess body proportions, skin colouring and face shape from photos so that a separate system can recommend clothing cuts and colours.

How to work:
- Judge proportions from the full-length photo: shoulder width relative to waist and hips, and where the midsection sits. Frames: inverted_triangle (shoulders clearly broader than a narrow waist), trapezoid (moderately broader shoulders, balanced), rectangle (shoulders, waist and hips similar), triangle (hips or waist wider than shoulders), oval (midsection is the widest point).
- Judge skin undertone (warm = golden/olive/yellow; cool = pink/red/blue; neutral = balanced) and depth (light = fair to wheatish/medium; deep = tan, dusky or dark) from the headshot, accounting for lighting, white balance and filters. Most South Asian men are warm or neutral; do not default to cool without clear evidence.
- Contrast is the difference between hair/beard/eyes and skin: high, medium or low.
- Face shape: oval, round, square, oblong, heart or diamond.
- Use the person's own answers as evidence too. Where the photos are ambiguous (poor light, baggy clothes, angle), say so with lower confidence rather than guessing.
- Notes: 2 to 4 short, specific, neutral observations written to the customer in second person ("Your shoulders are noticeably wider than your waist"). Describe proportions and colouring only. Never comment on attractiveness, weight as a judgement, ethnicity, caste, or anything medical.
- Set photosUsable to false (and explain in photoProblem) if the photos do not clearly show one adult person — for example no person, several people, a child, a heavily filtered or edited image, or a face covered by sunglasses or a mask. Otherwise photoProblem is an empty string.`;

function describeQuiz(q: Quiz): string {
  return [
    `Height: ${q.heightCm} cm. Age: ${q.ageRange}.`,
    `Self-described build: ${LABELS.build[q.build]}. Shoulders: ${LABELS.shoulders[q.shoulders]}. Midsection: ${LABELS.midsection[q.midsection]}.`,
    `Fit problems: ${q.fitIssues.length ? q.fitIssues.map((f) => LABELS.fitIssues[f]).join("; ") : "none mentioned"}.`,
    `Wrist veins: ${LABELS.veins[q.veins]}. In the sun: ${LABELS.sun[q.sun]}. Jewellery: ${LABELS.metal[q.metal]}. Skin depth (self-described): ${LABELS.skinDepth[q.skinDepth]}. Hair: ${LABELS.hair[q.hair]}.`,
    `Face shape (self-described): ${LABELS.faceShape[q.faceShape]}.`,
  ].join("\n");
}

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Merge AI findings with the quiz baseline: low-confidence AI calls never override the answers. */
export function mergeObservations(base: Observations, ai: AiResult): Observations {
  const frameOk = ai.frameConfidence !== "low";
  const colourOk = ai.colourConfidence !== "low";
  const faceOk = ai.faceConfidence !== "low";
  const notes = ai.notes
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((n) => n.slice(0, 280))
    .slice(0, 4);
  return {
    ...base,
    frame: frameOk ? ai.frame : base.frame,
    undertone: colourOk ? ai.undertone : base.undertone,
    depth: colourOk ? ai.depth : base.depth,
    contrast: colourOk ? ai.contrast : base.contrast,
    faceShape: faceOk ? ai.faceShape : base.faceShape,
    confidence: {
      frame: frameOk ? ai.frameConfidence : base.confidence.frame,
      colour: colourOk ? ai.colourConfidence : base.confidence.colour,
      face: faceOk ? ai.faceConfidence : base.confidence.face,
    },
    notes: [...notes, ...base.notes].slice(0, 6),
  };
}

/**
 * Analyses the photos with Claude. Never throws: any problem (not configured, refusal, timeout, unusable
 * photos) is returned as a reason, and the caller keeps the quiz-based observations.
 */
export async function analysePhotos(quiz: Quiz, base: Observations, photos: { headshot?: Photo; fullbody?: Photo }): Promise<AnalysisOutcome> {
  const e = env();
  if (!e.ANTHROPIC_API_KEY) return { used: false, reason: "Photo analysis is not configured; used quiz answers." };
  if (!photos.headshot && !photos.fullbody) return { used: false, reason: "No photos uploaded; used quiz answers." };

  const content: Anthropic.ContentBlockParam[] = [];
  if (photos.fullbody) {
    content.push({ type: "text", text: "Full-length photo:" });
    content.push({ type: "image", source: { type: "base64", media_type: photos.fullbody.mime, data: b64(photos.fullbody.bytes) } });
  }
  if (photos.headshot) {
    content.push({ type: "text", text: "Headshot:" });
    content.push({ type: "image", source: { type: "base64", media_type: photos.headshot.mime, data: b64(photos.headshot.bytes) } });
  }
  content.push({
    type: "text",
    text: `The customer's own answers:\n${describeQuiz(quiz)}\n\n${!photos.fullbody ? "There is no full-length photo, so rely on the answers for the frame and mark frameConfidence accordingly.\n" : ""}${!photos.headshot ? "There is no headshot, so rely on the answers for colouring and face shape and mark those confidences accordingly.\n" : ""}Assess this person.`,
  });

  try {
    const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 0 });
    const response = await client.messages.parse({
      model: e.ANTHROPIC_MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: zodOutputFormat(aiSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return { used: false, reason: "The AI declined to analyse these photos; used quiz answers." };
    const parsed = response.parsed_output;
    if (!parsed) return { used: false, reason: "The AI response couldn't be read; used quiz answers." };
    if (!parsed.photosUsable) return { used: false, reason: `Photos not usable: ${parsed.photoProblem.slice(0, 200) || "unclear photo"}. Used quiz answers.` };
    return { used: true, observations: mergeObservations(base, parsed), model: response.model };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { used: false, reason: "AI rate limit reached; used quiz answers." };
    if (err instanceof Anthropic.AuthenticationError) return { used: false, reason: "AI key rejected; used quiz answers." };
    if (err instanceof Anthropic.APIConnectionTimeoutError) return { used: false, reason: "AI analysis timed out; used quiz answers." };
    if (err instanceof Anthropic.APIError) return { used: false, reason: `AI error ${err.status ?? ""}; used quiz answers.`.replace("  ", " ") };
    console.error("[ai] unexpected analysis error", err);
    return { used: false, reason: "AI analysis failed; used quiz answers." };
  }
}
