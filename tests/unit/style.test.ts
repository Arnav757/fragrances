import { describe, expect, it } from "vitest";
import { SAMPLE_QUIZ, OCCASIONS, type Quiz } from "@/lib/style/quiz";
import { frameFromQuiz, observeFromQuiz, undertoneFromQuiz, applyOverrides } from "@/lib/style/observe";
import { buildReport, previewOf } from "@/lib/style/report";
import { allocate } from "@/lib/style/outfits";
import { PALETTES } from "@/lib/style/palettes";
import { DEPTHS, FRAMES, reportSchema, UNDERTONES, type Observations } from "@/lib/style/types";
import { FACE_SHAPES } from "@/lib/style/quiz";
import { mergeObservations } from "@/lib/ai/analyze";
import { shopLinks } from "@/lib/style/shop";

const q = (over: Partial<Quiz> = {}): Quiz => ({ ...SAMPLE_QUIZ, ...over });

describe("observations from the quiz", () => {
  it("maps answers to body frames", () => {
    expect(frameFromQuiz(q({ midsection: "prominent" }))).toBe("oval");
    expect(frameFromQuiz(q({ shoulders: "narrower", midsection: "flat" }))).toBe("triangle");
    expect(frameFromQuiz(q({ shoulders: "broader", build: "athletic", midsection: "flat" }))).toBe("inverted_triangle");
    expect(frameFromQuiz(q({ shoulders: "broader", build: "average", midsection: "slight" }))).toBe("trapezoid");
    expect(frameFromQuiz(q({ shoulders: "balanced", build: "slim", midsection: "flat" }))).toBe("rectangle");
  });

  it("votes on undertone and only commits with two agreeing signals", () => {
    expect(undertoneFromQuiz(q({ veins: "green", sun: "tans", metal: "both" })).undertone).toBe("warm");
    expect(undertoneFromQuiz(q({ veins: "blue", sun: "burns", metal: "silver" })).undertone).toBe("cool");
    expect(undertoneFromQuiz(q({ veins: "green", sun: "burns", metal: "unsure" })).undertone).toBe("neutral");
  });

  it("flags low colour confidence when answers are unsure", () => {
    const o = observeFromQuiz(q({ veins: "unsure", sun: "both", metal: "unsure", faceShape: "unsure" }));
    expect(o.confidence.colour).toBe("low");
    expect(o.confidence.face).toBe("low");
    expect(o.faceShape).toBe("oval");
  });

  it("applies stylist overrides on top", () => {
    const o = applyOverrides(observeFromQuiz(q()), { undertone: "cool", faceShape: "round" });
    expect(o.undertone).toBe("cool");
    expect(o.faceShape).toBe("round");
  });
});

describe("AI merge", () => {
  const base = observeFromQuiz(q());
  const ai = {
    photosUsable: true,
    photoProblem: "",
    frame: "oval" as const,
    frameConfidence: "low" as const,
    undertone: "cool" as const,
    depth: "deep" as const,
    contrast: "low" as const,
    colourConfidence: "high" as const,
    faceShape: "square" as const,
    faceConfidence: "medium" as const,
    notes: ["  Your shoulders are wider than your waist.  ", "", "x".repeat(500)],
  };
  it("ignores low-confidence AI calls and keeps the quiz answer", () => {
    const m = mergeObservations(base, ai);
    expect(m.frame).toBe(base.frame);
    expect(m.undertone).toBe("cool");
    expect(m.faceShape).toBe("square");
    expect(m.notes[0]).toBe("Your shoulders are wider than your waist.");
    expect(m.notes.every((n) => n.length <= 300)).toBe(true);
  });
});

describe("report generation", () => {
  it("produces a valid 20-outfit report for every frame × palette × face", () => {
    for (const frame of FRAMES)
      for (const undertone of UNDERTONES)
        for (const depth of DEPTHS)
          for (const faceShape of FACE_SHAPES) {
            const o: Observations = { ...observeFromQuiz(q()), frame, undertone, depth, faceShape };
            const r = reportSchema.parse(buildReport(q(), o, `${frame}-${undertone}-${depth}-${faceShape}`));
            expect(r.outfits).toHaveLength(20);
            expect(new Set(r.outfits.map((x) => x.id)).size).toBe(20);
            // Nothing in an outfit uses a colour the palette says to avoid.
            const avoid = new Set(PALETTES[`${undertone}-${depth}`].avoid.map((s) => s.hex));
            for (const out of r.outfits) for (const p of out.pieces) expect(avoid.has(p.colour.hex)).toBe(false);
          }
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const o = observeFromQuiz(q());
    expect(buildReport(q(), o, "a")).toEqual(buildReport(q(), o, "a"));
    expect(JSON.stringify(buildReport(q(), o, "a").outfits)).not.toEqual(JSON.stringify(buildReport(q(), o, "b").outfits));
  });

  it("weights outfits toward chosen occasions", () => {
    for (const chosen of [["festive"], ["office_formal", "date"], ["weekend", "travel", "office_casual"]] as (typeof OCCASIONS)[number][][]) {
      const a = allocate(chosen);
      expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(20);
      const minChosen = Math.min(...chosen.map((c) => a[c]));
      const maxOther = Math.max(...OCCASIONS.filter((o) => !chosen.includes(o)).map((o) => a[o]));
      expect(minChosen).toBeGreaterThan(maxOther);
    }
  });

  it("adds fit fixes for reported problems", () => {
    const r = buildReport(q({ fitIssues: ["sleeves_long", "trousers_tight_thighs"] }), observeFromQuiz(q()), "x");
    expect(r.frame.fitFixes.map((f) => f.item)).toEqual(expect.arrayContaining(["Sleeves", "Thighs"]));
  });

  it("previews reveal only a small subset", () => {
    const r = buildReport(q(), observeFromQuiz(q()), "x");
    const p = previewOf(r);
    expect(p.outfits).toHaveLength(2);
    expect(p.colour.best).toHaveLength(4);
    const json = JSON.stringify(p);
    // Locked content never appears in the preview payload.
    for (const o of r.outfits.slice(2)) expect(json).not.toContain(o.why);
    for (const s of r.colour.avoid) expect(json).not.toContain(s.hex);
    expect(json).not.toContain(r.frame.fitFixes[0]!.fix);
  });
});

describe("shop links", () => {
  it("adds a valid Amazon tag and marks it as affiliate", () => {
    const links = shopLinks("olive linen shirt men", { amazonEnabled: true, amazonTag: "forma-21", myntraEnabled: true, ajioEnabled: false });
    expect(links.map((l) => l.store)).toEqual(["Myntra", "Amazon"]);
    expect(links[1]!.href).toContain("tag=forma-21");
    expect(links[1]!.affiliate).toBe(true);
  });
  it("ignores a malformed tag", () => {
    const [l] = shopLinks("x", { amazonEnabled: true, amazonTag: "bad&tag=evil", myntraEnabled: false, ajioEnabled: false });
    expect(l!.href).not.toContain("tag=");
    expect(l!.affiliate).toBe(false);
  });
});
