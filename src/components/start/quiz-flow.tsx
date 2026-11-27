"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, ShieldCheck, X } from "lucide-react";
import { createAnalysisAction } from "@/app/actions/analysis";
import { cn } from "@/lib/utils";
import {
  AGE_RANGES,
  BEARDS,
  BUDGETS,
  BUILDS,
  FACE_ANSWERS,
  FIT_ISSUES,
  HAIR,
  LABELS,
  METALS,
  MIDSECTIONS,
  OCCASIONS,
  SHOULDERS,
  SKIN_DEPTHS,
  STYLES,
  SUN,
  VEINS,
  quizSchema,
  type Quiz,
} from "@/lib/style/quiz";
import { Button } from "../ui/button";
import { Notice } from "../ui/misc";

type Draft = Partial<Quiz>;
const STORE_KEY = "forma:quiz";

const SKIN_HEX: Record<(typeof SKIN_DEPTHS)[number], string> = { light: "#e9c9a8", medium: "#d1a27a", tan: "#a8754f", deep: "#6e4a33" };

function Options<T extends string>({
  name,
  options,
  labels,
  value,
  onChange,
  columns = "sm:grid-cols-2",
  swatch,
}: {
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | undefined;
  onChange: (v: T) => void;
  columns?: string;
  swatch?: Partial<Record<T, string>>;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn("grid gap-2.5", columns)}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-[0.95rem] transition-colors",
            value === o ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink",
          )}
        >
          {swatch?.[o] && <span className="h-7 w-7 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: swatch[o] }} aria-hidden />}
          <span className="flex-1">{labels[o]}</span>
          {value === o && <Check className="h-4 w-4 shrink-0" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

function Multi<T extends string>({ name, options, labels, value, onChange, max }: { name: string; options: readonly T[]; labels: Record<T, string>; value: T[]; onChange: (v: T[]) => void; max?: number }) {
  return (
    <div role="group" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        const disabled = !on && max !== undefined && value.length >= max;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            className={cn(
              "rounded-full border px-4 py-2.5 text-sm transition-colors disabled:opacity-40",
              on ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink",
            )}
          >
            {labels[o]}
          </button>
        );
      })}
    </div>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl leading-snug sm:text-2xl">{title}</h2>
        {hint && <p className="mt-1 text-sm text-stone">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Downscale and re-encode a photo in the browser: smaller uploads, EXIF (incl. GPS) stripped. */
async function prepareImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.86));
  if (!blob) throw new Error("encode");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

function PhotoSlot({ label, guide, file, onFile, testId }: { label: string; guide: string; file: File | null; onFile: (f: File | null) => void; testId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={url} alt={`${label} preview`} className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-6 w-6 text-mist" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-stone">{guide}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              data-testid={testId}
              aria-label={label}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setErr(null);
                setBusy(true);
                try {
                  onFile(await prepareImage(f));
                } catch {
                  setErr("We couldn't read that photo. Try a JPEG or PNG (on iPhone: Settings → Camera → Formats → Most Compatible).");
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button type="button" size="sm" variant={file ? "outline" : "primary"} onClick={() => input.current?.click()} loading={busy}>
              <ImagePlus className="h-4 w-4" aria-hidden /> {file ? "Replace" : "Add photo"}
            </Button>
            {file && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onFile(null)}>
                <X className="h-4 w-4" aria-hidden /> Remove
              </Button>
            )}
          </div>
          {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        </div>
      </div>
    </div>
  );
}

const ANALYSING = ["Reading your answers", "Checking proportions", "Finding your undertone", "Matching your colour palette", "Building 20 outfits", "Picking cuts for your frame"];

export function QuizFlow() {
  const router = useRouter();
  const [d, setD] = useState<Draft>({ fitIssues: [], occasions: [], glasses: false, heightCm: 172 });
  const [step, setStep] = useState(0);
  const [headshot, setHeadshot] = useState<File | null>(null);
  const [fullbody, setFullbody] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [tick, setTick] = useState(0);
  const source = useRef<Record<string, string>>({});
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      // Restoring an in-progress quiz from browser storage after hydration (it can't be read during SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setD((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {
      /* storage unavailable */
    }
    const sp = new URLSearchParams(window.location.search);
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"]) {
      const v = sp.get(k);
      if (v) source.current[k] = v.slice(0, 120);
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(d));
    } catch {
      /* storage unavailable */
    }
  }, [d]);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setTick((x) => x + 1), 1800);
    return () => clearInterval(t);
  }, [pending]);

  const set = <K extends keyof Quiz>(k: K, v: Quiz[K]) => setD((p) => ({ ...p, [k]: v }));
  const nameCheck = quizSchema.shape.firstName.safeParse(d.firstName ?? "");

  const steps: { valid: boolean; body: React.ReactNode }[] = [
    {
      valid: nameCheck.success && Boolean(d.ageRange),
      body: (
        <>
          <Q title="First, what should we call you?">
            <input
              value={d.firstName ?? ""}
              onChange={(e) => set("firstName", e.target.value)}
              maxLength={40}
              autoComplete="given-name"
              placeholder="First name"
              aria-label="First name"
              aria-invalid={Boolean(d.firstName && !nameCheck.success)}
              aria-describedby="name-error"
              className="h-14 w-full rounded-xl border border-line bg-paper px-4 text-lg focus:border-ink focus:outline-none aria-[invalid=true]:border-danger"
            />
            {d.firstName && !nameCheck.success && (
              <p id="name-error" role="alert" className="text-sm text-danger">
                {nameCheck.error.issues[0]?.message}
              </p>
            )}
          </Q>
          <Q title="Your age">
            <Options name="Age" options={AGE_RANGES} labels={LABELS.ageRange} value={d.ageRange} onChange={(v) => set("ageRange", v)} columns="grid-cols-2 sm:grid-cols-4" />
          </Q>
        </>
      ),
    },
    {
      valid: Boolean(d.heightCm && d.build),
      body: (
        <>
          <Q title="How tall are you?">
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-3xl font-semibold tabular-nums">
                {d.heightCm} cm{" "}
                <span className="text-lg font-normal text-stone">
                  ({Math.floor((d.heightCm ?? 0) / 30.48)}′{Math.round(((d.heightCm ?? 0) / 2.54) % 12)}″)
                </span>
              </p>
              <input type="range" min={150} max={200} value={d.heightCm} onChange={(e) => set("heightCm", Number(e.target.value))} aria-label="Height in centimetres" className="mt-4 w-full accent-ink" />
            </div>
          </Q>
          <Q title="How would you describe your build?">
            <Options name="Build" options={BUILDS} labels={LABELS.build} value={d.build} onChange={(v) => set("build", v)} />
          </Q>
        </>
      ),
    },
    {
      valid: Boolean(d.shoulders && d.midsection),
      body: (
        <>
          <Q title="Look in a mirror, straight on. Your shoulders are…" hint="Compare the width of your shoulders with your waist.">
            <Options name="Shoulders" options={SHOULDERS} labels={LABELS.shoulders} value={d.shoulders} onChange={(v) => set("shoulders", v)} columns="" />
          </Q>
          <Q title="And your midsection?">
            <Options name="Midsection" options={MIDSECTIONS} labels={LABELS.midsection} value={d.midsection} onChange={(v) => set("midsection", v)} columns="sm:grid-cols-3" />
          </Q>
        </>
      ),
    },
    {
      valid: true,
      body: (
        <Q title="Which of these sound familiar?" hint="Pick any that apply — or none. This is where most fit advice comes from.">
          <Multi name="Fit problems" options={FIT_ISSUES} labels={LABELS.fitIssues} value={d.fitIssues ?? []} onChange={(v) => set("fitIssues", v)} />
        </Q>
      ),
    },
    {
      valid: Boolean(d.veins && d.sun && d.metal),
      body: (
        <>
          <p className="rounded-xl bg-gold-soft px-4 py-3 text-sm text-gold-deep">Three quick tests for your skin undertone — do them in daylight if you can.</p>
          <Q title="Look at the veins on your inner wrist. They look…">
            <Options name="Veins" options={VEINS} labels={LABELS.veins} value={d.veins} onChange={(v) => set("veins", v)} />
          </Q>
          <Q title="In strong sun, you…">
            <Options name="Sun" options={SUN} labels={LABELS.sun} value={d.sun} onChange={(v) => set("sun", v)} columns="" />
          </Q>
          <Q title="Gold or silver near your face?">
            <Options name="Metal" options={METALS} labels={LABELS.metal} value={d.metal} onChange={(v) => set("metal", v)} />
          </Q>
        </>
      ),
    },
    {
      valid: Boolean(d.skinDepth && d.hair),
      body: (
        <>
          <Q title="Your skin tone is closest to…">
            <Options name="Skin depth" options={SKIN_DEPTHS} labels={LABELS.skinDepth} value={d.skinDepth} onChange={(v) => set("skinDepth", v)} swatch={SKIN_HEX} />
          </Q>
          <Q title="Your natural hair colour">
            <Options name="Hair" options={HAIR} labels={LABELS.hair} value={d.hair} onChange={(v) => set("hair", v)} />
          </Q>
        </>
      ),
    },
    {
      valid: Boolean(d.faceShape && d.beard && d.glasses !== undefined),
      body: (
        <>
          <Q title="Your face shape" hint="Not sure? Pick the last option and we'll work it out from your photo.">
            <Options name="Face shape" options={FACE_ANSWERS} labels={LABELS.faceShape} value={d.faceShape} onChange={(v) => set("faceShape", v)} />
          </Q>
          <Q title="Facial hair right now">
            <Options name="Beard" options={BEARDS} labels={LABELS.beard} value={d.beard} onChange={(v) => set("beard", v)} columns="grid-cols-2 sm:grid-cols-4" />
          </Q>
          <Q title="Do you wear glasses?">
            <Options name="Glasses" options={["yes", "no"] as const} labels={{ yes: "Yes", no: "No" }} value={d.glasses === undefined ? undefined : d.glasses ? "yes" : "no"} onChange={(v) => set("glasses", v === "yes")} columns="grid-cols-2" />
          </Q>
        </>
      ),
    },
    {
      valid: Boolean((d.occasions?.length ?? 0) > 0 && d.style),
      body: (
        <>
          <Q title="What do you dress for most?" hint="Pick up to three — most of your outfits will be for these.">
            <Multi name="Occasions" options={OCCASIONS} labels={LABELS.occasions} value={d.occasions ?? []} onChange={(v) => set("occasions", v)} max={3} />
          </Q>
          <Q title="Which direction feels most like you?">
            <Options name="Style" options={STYLES} labels={LABELS.style} value={d.style} onChange={(v) => set("style", v)} columns="" />
          </Q>
        </>
      ),
    },
    {
      valid: Boolean(d.budget),
      body: (
        <Q title="What do you usually spend on one piece?" hint="We'll keep the shopping guide realistic.">
          <Options name="Budget" options={BUDGETS} labels={LABELS.budget} value={d.budget} onChange={(v) => set("budget", v)} columns="" />
        </Q>
      ),
    },
    {
      valid: !(headshot || fullbody) || consent,
      body: (
        <>
          <Q title="Two photos make your analysis far more accurate" hint="Optional, but colour and proportions are much easier to judge from a photo than from answers.">
            <div className="space-y-3">
              <PhotoSlot label="Headshot" guide="Face the window in daylight. No filter, no sunglasses, hair off your forehead." file={headshot} onFile={setHeadshot} testId="headshot" />
              <PhotoSlot label="Full length" guide="Head to toe, standing straight, arms slightly away from your body. A fitted tee and jeans is ideal." file={fullbody} onFile={setFullbody} testId="fullbody" />
            </div>
          </Q>
          {(headshot || fullbody) && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper p-4 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
              <span>
                I&apos;m 18 or over, these are photos of me, and I agree to them being analysed by AI and reviewed by a stylist. They&apos;re stored privately and deleted automatically.{" "}
                <a href="/privacy" target="_blank" className="underline">
                  Privacy policy
                </a>
              </span>
            </label>
          )}
          <p className="flex items-start gap-2 text-xs leading-relaxed text-stone">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Photos are resized on your phone (location data removed), never published, and never used in marketing.
          </p>
        </>
      ),
    },
  ];

  const total = steps.length;
  const last = step === total - 1;
  const current = steps[step]!;

  function go(n: number) {
    setError(null);
    setStep(n);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submit() {
    const parsed = quizSchema.safeParse(d);
    if (!parsed.success) {
      // Jump to the step that holds the first problem.
      const field = String(parsed.error.issues[0]?.path[0] ?? "");
      const STEP_OF: Record<string, number> = { firstName: 0, ageRange: 0, heightCm: 1, build: 1, shoulders: 2, midsection: 2, fitIssues: 3, veins: 4, sun: 4, metal: 4, skinDepth: 5, hair: 5, faceShape: 6, beard: 6, glasses: 6, occasions: 7, style: 7, budget: 8 };
      go(STEP_OF[field] ?? 0);
      setError(`Please check this answer: ${parsed.error.issues[0]?.message ?? "missing"}.`);
      return;
    }
    const fd = new FormData();
    fd.set("quiz", JSON.stringify(parsed.data));
    fd.set("source", JSON.stringify(source.current));
    fd.set("photoConsent", String(consent));
    if (headshot) fd.set("headshot", headshot);
    if (fullbody) fd.set("fullbody", fullbody);
    start(async () => {
      const r = await createAnalysisAction(fd);
      if (r.ok && r.data) {
        try {
          sessionStorage.removeItem(STORE_KEY);
        } catch {
          /* ignore */
        }
        router.push(`/s/${r.data.token}`);
      } else setError(r.ok ? "Something went wrong." : r.message);
    });
  }

  if (pending) {
    return (
      <div role="status" aria-live="polite" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <div className="relative h-20 w-20">
          <span className="absolute inset-0 animate-ping rounded-full bg-gold/20" />
          <span className="absolute inset-3 rounded-full bg-ink" />
        </div>
        <h2 className="mt-8 text-2xl">Analysing, {d.firstName}…</h2>
        <p className="mt-2 text-stone">{ANALYSING[tick % ANALYSING.length]}</p>
        <p className="mt-6 text-xs text-mist">{headshot || fullbody ? "Photo analysis can take up to a minute." : "Just a few seconds."}</p>
      </div>
    );
  }

  return (
    <div ref={top} className="mx-auto max-w-2xl scroll-mt-24">
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-stone">
          <span>
            Step {step + 1} of {total}
          </span>
          <span>About {Math.max(1, Math.round(((total - step) * 20) / 60))} min left</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-ink transition-all duration-500" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      </div>
      <div key={step} className="animate-rise space-y-8">
        {current.body}
      </div>
      {error && (
        <Notice tone="danger" className="mt-6">
          {error}
        </Notice>
      )}
      <div className="mt-10 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={() => go(step - 1)}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
        ) : (
          <span />
        )}
        {last ? (
          <Button type="button" size="lg" onClick={submit} disabled={!current.valid} data-testid="submit-quiz">
            {headshot || fullbody ? "Analyse my photos" : "See my results"} <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={() => go(step + 1)} disabled={!current.valid} data-testid="next">
            Continue <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
