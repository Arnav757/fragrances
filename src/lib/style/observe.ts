import type { Quiz } from "./quiz";
import type { FrameKey, Observations, Overrides, Undertone } from "./types";

/** Body frame from the self-assessment answers. */
export function frameFromQuiz(q: Quiz): FrameKey {
  if (q.midsection === "prominent") return "oval";
  if (q.shoulders === "narrower") return "triangle";
  if (q.shoulders === "broader") return q.build === "athletic" && q.midsection === "flat" ? "inverted_triangle" : "trapezoid";
  // balanced shoulders
  if (q.build === "athletic") return "trapezoid";
  if (q.build === "heavy" && q.midsection === "slight") return "oval";
  return "rectangle";
}

/** Undertone from three independent tests; each votes warm (+1) or cool (−1). */
export function undertoneFromQuiz(q: Quiz): { undertone: Undertone; votes: number; signals: number } {
  let votes = 0;
  let signals = 0;
  const vote = (v: number) => {
    votes += v;
    if (v !== 0) signals++;
  };
  vote(q.veins === "green" ? 1 : q.veins === "blue" ? -1 : 0);
  vote(q.sun === "tans" ? 1 : q.sun === "burns" ? -1 : 0);
  vote(q.metal === "gold" ? 1 : q.metal === "silver" ? -1 : 0);
  const undertone: Undertone = votes >= 2 ? "warm" : votes <= -2 ? "cool" : "neutral";
  return { undertone, votes, signals };
}

export function heightBand(cm: number): Observations["heightBand"] {
  return cm < 168 ? "short" : cm > 183 ? "tall" : "average";
}

export function contrastFromQuiz(q: Quiz): Observations["contrast"] {
  const darkHair = q.hair === "black" || q.hair === "dark_brown";
  if (q.hair === "grey" || q.hair === "brown") return q.skinDepth === "deep" ? "medium" : "low";
  if (q.hair === "bald") return q.skinDepth === "light" ? "medium" : "low";
  if (darkHair && (q.skinDepth === "light" || q.skinDepth === "medium")) return "high";
  return "medium";
}

/**
 * Observations derived from the answers alone. Used when there are no photos, when AI analysis isn't
 * configured, or when it fails — and as the starting point the AI corrects.
 */
export function observeFromQuiz(q: Quiz): Observations {
  const u = undertoneFromQuiz(q);
  const frame = frameFromQuiz(q);
  const notes: string[] = [];
  if (frame === "inverted_triangle") notes.push("You described broad shoulders with a flat, athletic midsection — a classic V-shape.");
  if (frame === "oval") notes.push("You said your midsection is your widest point, so we've prioritised cuts that skim rather than cling.");
  if (q.fitIssues.includes("shirt_tight_shoulders") && q.fitIssues.includes("shirt_loose_waist"))
    notes.push("Shirts that pull at the shoulders but balloon at the waist mean off-the-rack ‘regular’ fits aren't cut for you — athletic fits and a tailor fix this.");
  if (u.signals < 2) notes.push("Your undertone answers were mixed or unsure, so your colour palette is a best estimate — a photo in daylight would make it sharper.");
  return {
    frame,
    undertone: u.undertone,
    depth: q.skinDepth === "light" || q.skinDepth === "medium" ? "light" : "deep",
    contrast: contrastFromQuiz(q),
    faceShape: q.faceShape === "unsure" ? "oval" : q.faceShape,
    heightBand: heightBand(q.heightCm),
    confidence: {
      frame: "medium",
      colour: u.signals >= 3 && Math.abs(u.votes) !== 1 ? "medium" : "low",
      face: q.faceShape === "unsure" ? "low" : "medium",
    },
    notes: notes.slice(0, 6),
  };
}

export function applyOverrides(o: Observations, ov: Overrides): Observations {
  return {
    ...o,
    ...Object.fromEntries(Object.entries(ov).filter(([, v]) => v !== undefined && v !== null)),
  } as Observations;
}
