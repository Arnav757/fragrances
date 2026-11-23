import { Lock } from "lucide-react";
import type { ReportPreview } from "@/lib/style/report";
import type { Observations } from "@/lib/style/types";
import { Container } from "../ui/misc";
import { ConfidencePill, List, OutfitCard, SwatchChip } from "./parts";
import { CheckoutPanel, type PendingUpiView, type PlanOption } from "./checkout-panel";
import { EmailPreviewForm } from "./small-forms";
import { formatINR } from "@/lib/money";

function LockedBlock({ label, className = "h-40" }: { label: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-paper ${className}`}>
      <div className="locked absolute inset-0 grid grid-cols-4 gap-3 p-5" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-sand" />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs text-paper">
          <Lock className="h-3.5 w-3.5" aria-hidden /> {label}
        </span>
      </div>
    </div>
  );
}

export function PreviewView({
  token,
  firstName,
  preview,
  observations,
  source,
  aiNote,
  plans,
  mode,
  pendingUpi,
}: {
  token: string;
  firstName: string;
  preview: ReportPreview;
  observations: Observations;
  source: "ai" | "quiz";
  aiNote: string | null;
  plans: PlanOption[];
  mode: "razorpay" | "mock" | "upi" | "off";
  pendingUpi?: PendingUpiView | null;
}) {
  const cheapest = Math.min(...plans.map((p) => p.pricePaise));
  return (
    <>
      <div className="bg-night text-paper">
        <Container className="py-12 sm:py-16">
          <p className="eyebrow !text-paper/60">Your free preview</p>
          <h1 className="animate-rise mt-4 max-w-3xl text-4xl leading-[1.02] sm:text-6xl">{preview.headline}</h1>
          <p className="mt-5 max-w-2xl text-paper/70">
            Here&apos;s what we found. Unlock the full report for all {preview.outfits.length + preview.lockedOutfits} outfits, your complete palette, fit fixes, face guide and a stylist&apos;s personal review.
          </p>
        </Container>
      </div>

      <Container className="grid gap-10 py-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-10">
          {observations.notes.length > 0 && (
            <section aria-labelledby="noticed" className="rounded-2xl border border-line bg-paper p-6">
              <h2 id="noticed" className="eyebrow">
                {source === "ai" ? "What we noticed in your photos" : "What your answers told us"}
              </h2>
              <ul className="mt-3 space-y-2 text-[0.95rem] leading-relaxed text-charcoal">
                {observations.notes.map((n) => (
                  <li key={n}>— {n}</li>
                ))}
              </ul>
              {source === "quiz" && aiNote && <p className="mt-4 text-xs text-stone">Note: {aiNote}</p>}
            </section>
          )}

          <section aria-labelledby="pv-frame">
            <p className="eyebrow mb-2">Body frame</p>
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="pv-frame" className="text-3xl">
                {preview.frame.name}
              </h2>
              <ConfidencePill level={observations.confidence.frame} />
            </div>
            <p className="mt-3 max-w-2xl leading-relaxed text-charcoal">{preview.frame.description}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-line bg-paper p-5">
                <h3 className="mb-3 text-lg">Your first two goals</h3>
                <List items={preview.frame.goals} />
              </div>
              <LockedBlock label={`${preview.counts.fitFixes} fit fixes + what to wear & skip`} className="h-full min-h-40" />
            </div>
          </section>

          <section aria-labelledby="pv-colour">
            <p className="eyebrow mb-2">Colour</p>
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="pv-colour" className="text-3xl">
                {preview.colour.name}
              </h2>
              <ConfidencePill level={observations.confidence.colour} />
            </div>
            <p className="mt-3 max-w-2xl leading-relaxed text-charcoal">{preview.colour.description}</p>
            <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-6">
              {preview.colour.best.map((s) => (
                <SwatchChip key={s.name} s={s} />
              ))}
              <div className="col-span-4 sm:col-span-2">
                <LockedBlock label={`+${preview.colour.lockedSwatches} more`} className="h-12" />
              </div>
            </div>
          </section>

          <section aria-labelledby="pv-face">
            <p className="eyebrow mb-2">Face</p>
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="pv-face" className="text-3xl">
                {preview.face.name} face
              </h2>
              <ConfidencePill level={observations.confidence.face} />
            </div>
            <div className="mt-5">
              <LockedBlock label="Collars, eyewear, hair & beard guide" className="h-28" />
            </div>
          </section>

          <section aria-labelledby="pv-outfits">
            <p className="eyebrow mb-2">Outfits</p>
            <h2 id="pv-outfits" className="text-3xl">
              Your first {preview.outfits.length} outfits
            </h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {preview.outfits.map((o, i) => (
                <OutfitCard key={o.id} outfit={o} index={i} shop={null} />
              ))}
            </div>
            <div className="mt-5">
              <LockedBlock label={`${preview.lockedOutfits} more outfits with shop links`} className="h-48" />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-6">
            <h2 className="text-xl">Not ready yet?</h2>
            <p className="mt-1 mb-4 text-sm text-stone">We&apos;ll email you a link to this preview so you can come back later.</p>
            <EmailPreviewForm token={token} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CheckoutPanel token={token} plans={plans} mode={mode} firstName={firstName} pendingUpi={pendingUpi ?? null} />
          <ul className="mt-5 space-y-2 px-1 text-sm text-charcoal">
            {[
              `All ${preview.outfits.length + preview.lockedOutfits} outfits, with shop links`,
              "Your full palette: best colours, neutrals, accents, what to avoid",
              `${preview.counts.fitFixes} fit fixes for your frame`,
              "Collar, eyewear, hair & beard guide",
              `${preview.counts.capsule}-piece core wardrobe checklist`,
              "Reviewed by a stylist, with a personal note",
              "Revisions included",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="text-success" aria-hidden>
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </Container>

      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 p-3 backdrop-blur lg:hidden">
        <a href="#unlock" className="flex h-12 items-center justify-center rounded-full bg-ink text-sm font-medium text-paper">
          Unlock full report · from {formatINR(cheapest)}
        </a>
      </div>
    </>
  );
}
