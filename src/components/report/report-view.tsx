import type { ReactNode } from "react";
import { Sparkles, UserCheck } from "lucide-react";
import type { Observations, Report } from "@/lib/style/types";
import type { Occasion } from "@/lib/style/quiz";
import type { ShopSettings } from "@/lib/style/shop";
import { Container } from "../ui/misc";
import { ConfidencePill, List, Section, SwatchGrid } from "./parts";
import { CapsuleChecklist, OutfitBrowser, ReportToolbar } from "./interactive";

const NAV = [
  ["frame", "Frame"],
  ["colours", "Colours"],
  ["face", "Face"],
  ["outfits", "Outfits"],
  ["wardrobe", "Wardrobe"],
  ["shopping", "Shopping"],
  ["avoid", "Avoid"],
] as const;

export type ReportMeta = {
  firstName: string;
  ref: string;
  status: "draft" | "final" | "sample";
  stylistNote: string | null;
  stylistName: string;
  observations: Observations;
  source: "ai" | "quiz";
  occasions: Occasion[];
  storageKey: string;
};

/** Ends a headline on the brand's orange full stop. */
function Dotted({ text }: { text: string }) {
  const body = text.replace(/[.!]$/, "");
  return (
    <>
      {body}
      <span className="text-gold">.</span>
    </>
  );
}

export function ReportView({ report, meta, shop, banner, footer, art }: { report: Report; meta: ReportMeta; shop: ShopSettings | null; banner?: ReactNode; footer?: ReactNode; art?: ReactNode }) {
  const o = meta.observations;
  return (
    <div>
      <div className="relative overflow-hidden bg-ivory">
        <Container className={art ? "grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.5fr_1fr]" : "py-12 sm:py-16"}>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
                <span className="h-2 w-2 rounded-full bg-gold" aria-hidden />
                {meta.status === "sample" ? "Sample report" : `Style report · ${meta.ref}`}
              </p>
              {meta.status === "final" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs text-white">
                  <UserCheck className="h-3.5 w-3.5" aria-hidden /> Stylist reviewed
                </span>
              ) : meta.status === "draft" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-xs text-charcoal">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> Stylist review in progress
                </span>
              ) : null}
            </div>
            <h1 className="mt-6 max-w-3xl text-[2.6rem] leading-[0.98] font-extrabold tracking-[-0.045em] sm:text-6xl">
              <Dotted text={report.summary.headline} />
            </h1>
            <div className="mt-6 flex items-center" aria-label="Your best colours">
              {report.colour.best.slice(0, 8).map((c, i) => (
                <span key={c.name} title={c.name} className="h-9 w-9 rounded-full ring-4 ring-white" style={{ backgroundColor: c.hex, marginLeft: i ? -8 : 0 }} />
              ))}
              <span className="ml-3 text-sm text-stone">{report.colour.name}</span>
            </div>
            <div className={`mt-8 grid max-w-4xl gap-4 text-[0.95rem] leading-relaxed text-charcoal ${art ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
              {report.summary.paragraphs.slice(0, art ? 2 : 3).map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ReportToolbar />
            </div>
          </div>
          {art}
        </Container>
      </div>

      <nav aria-label="Report sections" className="no-print sticky top-16 z-30 border-b border-line bg-ivory/90 backdrop-blur">
        <Container className="flex gap-1 overflow-x-auto py-2">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-charcoal hover:bg-sand">
              {label}
            </a>
          ))}
        </Container>
      </nav>

      <Container>
        {banner}

        {meta.stylistNote && (
          <aside className="mt-10 rounded-2xl border-l-[6px] border-gold bg-paper p-6 sm:p-8">
            <p className="eyebrow">A note from {meta.stylistName || "your stylist"}</p>
            <p className="serif-accent mt-3 text-2xl leading-snug whitespace-pre-line text-ink">{meta.stylistNote}</p>
          </aside>
        )}

        {o.notes.length > 0 && (
          <div className="mt-10 grid gap-3 md:grid-cols-[220px_1fr]">
            <p className="eyebrow pt-1">{meta.source === "ai" ? "What we noticed in your photos" : "What your answers told us"}</p>
            <ul className="space-y-2 text-[0.95rem] leading-relaxed text-charcoal">
              {o.notes.map((n) => (
                <li key={n}>— {n}</li>
              ))}
            </ul>
          </div>
        )}

        <Section id="frame" eyebrow="01 · Body frame" title={<>{report.frame.name}</>} className="mt-10">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <ConfidencePill level={o.confidence.frame} />
          </div>
          <p className="max-w-3xl text-lg leading-relaxed text-charcoal">{report.frame.description}</p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-lime/35 p-6">
              <h3 className="mb-4 text-lg">Your goals</h3>
              <List items={report.frame.goals} />
            </div>
            <div className="rounded-2xl bg-ice/45 p-6">
              <h3 className="mb-4 text-lg">Wear more</h3>
              <List items={report.frame.wear} />
            </div>
            <div className="rounded-2xl bg-gold-soft p-6">
              <h3 className="mb-4 text-lg">Skip</h3>
              <List items={report.frame.avoid} tone="dont" />
            </div>
          </div>
          <h3 className="mt-10 mb-4 text-xl">Fit fixes</h3>
          <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
            {report.frame.fitFixes.map((f) => (
              <div key={f.item + f.fix} className="grid gap-1 px-5 py-4 sm:grid-cols-[160px_1fr]">
                <dt className="font-medium">{f.item}</dt>
                <dd className="text-sm leading-relaxed text-charcoal">{f.fix}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-10 mb-4 text-xl">Proportion</h3>
          <List items={report.proportion.tips} />
        </Section>

        <Section id="colours" eyebrow="02 · Colour" title={report.colour.name}>
          <div className="mb-6">
            <ConfidencePill level={o.confidence.colour} />
          </div>
          <p className="max-w-3xl text-lg leading-relaxed text-charcoal">{report.colour.description}</p>
          <h3 className="mt-10 mb-4 text-xl">Your best colours</h3>
          <SwatchGrid swatches={report.colour.best} />
          <div className="mt-10 grid gap-10 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-xl">Your neutrals</h3>
              <SwatchGrid swatches={report.colour.neutrals} cols="grid-cols-5" />
            </div>
            <div>
              <h3 className="mb-4 text-xl">Accents</h3>
              <SwatchGrid swatches={report.colour.accents} cols="grid-cols-5" />
            </div>
          </div>
          <h3 className="mt-10 mb-4 text-xl">Keep away from your face</h3>
          <div className="relative">
            <SwatchGrid swatches={report.colour.avoid} cols="grid-cols-5" />
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-paper p-5 text-sm leading-relaxed">
              <p className="eyebrow mb-2">Contrast</p>
              {report.colour.contrastTip}
            </div>
            <div className="rounded-2xl border border-line bg-paper p-5 text-sm leading-relaxed">
              <p className="eyebrow mb-2">Metals & leather</p>
              {report.colour.metals}
            </div>
            <div className="rounded-2xl border border-line bg-paper p-5 text-sm leading-relaxed">
              <p className="eyebrow mb-2">Denim</p>
              {report.colour.denim}
            </div>
          </div>
          <h3 className="mt-10 mb-4 text-xl">Combinations that always work</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {report.colour.combos.map((c) => (
              <li key={c} className="rounded-xl border border-line bg-paper px-4 py-3 text-sm">
                {c}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="face" eyebrow="03 · Face" title={`${report.face.name} face`}>
          <div className="mb-6">
            <ConfidencePill level={o.confidence.face} />
          </div>
          <p className="max-w-3xl text-lg leading-relaxed text-charcoal">{report.face.description}</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Collars", report.face.collars],
                ["Eyewear", report.face.eyewear],
                ["Hair", report.face.hair],
                ["Beard", report.face.beard],
              ] as const
            ).map(([t, items]) => (
              <div key={t} className="rounded-2xl border border-line bg-paper p-5">
                <h3 className="mb-3 text-lg">{t}</h3>
                <List items={[...items]} />
              </div>
            ))}
          </div>
        </Section>

        <Section id="outfits" eyebrow="04 · Outfits" title={`${report.outfits.length} outfits built for you`}>
          <p className="mb-8 max-w-3xl text-charcoal">
            Every outfit uses your colours and the cuts for your frame. Shop links open searches at each store — buy only what you&apos;re missing.
            {shop?.amazonTag ? " Links marked * may earn us a small commission at no cost to you." : ""}
          </p>
          <OutfitBrowser outfits={report.outfits} shop={shop} priority={meta.occasions} />
        </Section>

        <Section id="wardrobe" eyebrow="05 · Core wardrobe" title={`The ${report.capsule.length} pieces that make it all work`}>
          <p className="mb-6 max-w-3xl text-charcoal">Tick off what you already own. These pieces combine into most of your outfits — buy the gaps first.</p>
          <CapsuleChecklist items={report.capsule} storageKey={meta.storageKey} shop={shop} />
        </Section>

        <Section id="shopping" eyebrow="06 · Shopping" title="How to shop from now on">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-xl">What to spend</h3>
              <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
                {report.shopping.priceGuide.map((p) => (
                  <div key={p.category} className="flex justify-between px-5 py-3 text-sm">
                    <dt>{p.category}</dt>
                    <dd className="text-charcoal tabular-nums">{p.range}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="mb-4 text-xl">Rules</h3>
              <List items={report.shopping.rules} />
            </div>
          </div>
        </Section>

        <Section id="avoid" eyebrow="07 · Avoid" title="What to stop buying">
          <List items={report.avoidList} tone="dont" />
        </Section>

        {footer}
      </Container>
    </div>
  );
}
