import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Clock, Eye, Palette, Ruler, Shirt, ShoppingBag, Sparkles, Trash2, UserCheck, X } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { OutfitFigure } from "@/components/report/outfit-figure";
import { SAMPLE_QUIZ } from "@/lib/style/quiz";
import { observeFromQuiz } from "@/lib/style/observe";
import { buildReport } from "@/lib/style/report";
import { PALETTES } from "@/lib/style/palettes";
import { getSettings, storeName } from "@/lib/settings";
import { formatINR } from "@/lib/money";

export const dynamic = "force-dynamic";

const LOOKS: { key: string; name: string; note: string; bg: string; ink?: boolean }[] = [
  { key: "A1", name: "Weekend", note: "Navy linen, light straight denim", bg: "#a5e8ff" },
  { key: "A2", name: "Office", note: "Camel knit, pleated taupe", bg: "#c7ff43" },
  { key: "A3", name: "Summer", note: "Slub henley, flared denim", bg: "#ff4f2a" },
  { key: "A4", name: "Wedding", note: "Ivory bandhgala, black flares", bg: "#2557ff" },
  { key: "A5", name: "Knit", note: "Grey crewneck, ecru wide jeans", bg: "#ffe4dc" },
  { key: "A6", name: "Tonal", note: "Navy on navy, pleats", bg: "#a5e8ff" },
];

const PLATES: [string, string][] = [
  ["paper-flatlay", "A date-night outfit laid out on white with cut-paper shapes"],
  ["hem-macro", "A navy pinstripe trouser hem resting on a brown loafer"],
  ["sculptural-plinth", "A tailor's form in a pale blue shirt and wide navy trousers under a cobalt arch"],
  ["fabric-swatches", "A fan of fabric swatches in olive, camel, navy and ivory"],
  ["paper-studio", "Cut-paper shapes in cobalt, orange and lime"],
  ["idea-architecture", "A cobalt and orange architectural sculpture with a staircase"],
  ["glass-flower", "Stacked lime and ice-blue glass rings with a cobalt ribbon"],
];

const FAQ: [string, string][] = [
  ["Do I need to book a call?", "No. You answer a short quiz and (optionally) add two photos. Everything else happens on our side."],
  ["What do I see for free?", "Your body frame, your colour family with your first colours, your face shape and two complete outfits — before you pay anything."],
  ["Is a real person involved?", "Yes. After you unlock the full report, a stylist reviews it, corrects anything that's off and adds a personal note before marking it final."],
  ["Is this built for Indian men?", "Yes. Our palettes are written for South Asian skin tones first, and outfits cover Indian occasions — weddings, pujas, festivals — alongside office and weekend."],
  ["What happens to my photos?", "They're stored privately, used only for your analysis, never published, and deleted automatically after your report is final. You can ask us to delete them sooner."],
  ["What if I'm not happy?", "Revisions are included. If you're still unhappy after a revision, see our refund policy."],
];

export default async function Home() {
  const [store, pricing] = await Promise.all([getSettings("store"), getSettings("pricing")]);
  const name = storeName(store);
  const sample = buildReport(SAMPLE_QUIZ, observeFromQuiz(SAMPLE_QUIZ), "landing");
  const heroOutfits = sample.outfits.slice(0, 3);
  const palettes = Object.values(PALETTES);

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs text-charcoal">
              <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden /> Free preview · no call · no sign-up
            </p>
            <h1 className="mt-6 text-[2.75rem] leading-[0.98] sm:text-7xl">
              Stop guessing
              <br />
              what <span className="serif-accent text-gold">suits</span> you.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-charcoal">
              Your body frame, your colours and your face shape — worked out from two photos and a 3-minute quiz. Then <strong>20 outfits built for you</strong>, linked to shops, and checked by a real stylist.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/start" size="lg">
                Start free <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/sample" size="lg" variant="outline">
                See a sample report
              </ButtonLink>
            </div>
            <ul className="mt-8 grid max-w-lg gap-2 text-sm text-charcoal sm:grid-cols-2">
              {["See your results in minutes, not days", "Built for Indian skin tones", "Stylist-reviewed, revisions included", `From ${formatINR(pricing.standardPaise)} — price shown upfront`].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-success" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[330px]">
            <span className="absolute -left-6 top-10 h-16 w-16 rounded-full bg-gold" aria-hidden />
            <span className="absolute -right-5 bottom-16 h-24 w-24 rounded-full border-[6px] border-cobalt" aria-hidden />
            <div className="relative aspect-[9/16] overflow-hidden rounded-[2.25rem] border-[6px] border-ink bg-white shadow-2xl">
              <video
                src="/brand/forma-ad.mp4"
                poster="/brand/forma-ad-poster.webp"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
                aria-label={`${name} brand film: one frame, many looks`}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ looks */}
      <section>
        <Container className="py-16 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-xl text-4xl leading-[1.02] sm:text-6xl">
              One frame.
              <br />
              Many looks<span className="text-gold">.</span>
            </h2>
            <p className="max-w-sm leading-relaxed text-charcoal">Same guy, six occasions. Every look follows one rule for his broad shoulders and warm skin: a long leg line, in colours that suit him.</p>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {LOOKS.map((l) => (
              <li key={l.key} className="group">
                <div className="relative aspect-[3/5] overflow-hidden rounded-3xl transition-transform duration-500 ease-out-soft group-hover:-translate-y-1" style={{ backgroundColor: l.bg }}>
                  <Image
                    src={`/brand/looks/${l.key}.webp`}
                    alt={`${l.name} look: ${l.note}`}
                    fill
                    sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw"
                    className="object-contain object-bottom pt-4 transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
                  />
                </div>
                <p className="mt-3 font-display text-lg font-bold">{l.name}</p>
                <p className="text-sm text-stone">{l.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-mist">Models and outfits shown are AI-generated.</p>
        </Container>
      </section>

      {/* ------------------------------------------------------------ preview */}
      <section className="border-y border-line bg-paper">
        <Container className="grid items-center gap-12 py-16 lg:grid-cols-[1fr_1.1fr] lg:py-20">
          <div>
            <h2 className="text-4xl leading-[1.02] sm:text-5xl">Your colours, tested in minutes.</h2>
            <p className="mt-5 max-w-md leading-relaxed text-charcoal">Black and icy grey wash out warm skin. Olive, camel and rust make it glow. Your free preview shows your frame, your colour family and your first outfits before you pay anything.</p>
            <div className="relative mt-8 hidden aspect-[2/3] w-56 overflow-hidden rounded-3xl lg:block">
              <Image src="/brand/plates/fabric-swatches.webp" alt="A fan of fabric swatches in olive, camel, navy and ivory" fill sizes="224px" className="object-cover" />
            </div>
          </div>
          <div className="relative">
            <div className="rounded-[2rem] bg-night p-6 text-paper shadow-2xl sm:p-8">
              <div className="flex items-center justify-between">
                <p className="eyebrow !text-paper/50">Sample result</p>
                <span className="rounded-full bg-paper/10 px-2.5 py-1 text-[0.6875rem] text-paper/70">{sample.frame.name} · {sample.colour.name}</span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {heroOutfits.map((o) => (
                  <div key={o.id} className="rounded-2xl bg-paper/[0.06] p-3">
                    <OutfitFigure pieces={o.pieces} className="mx-auto h-36 w-auto" />
                    <p className="mt-2 truncate text-center text-[0.6875rem] text-paper/60">{o.title}</p>
                  </div>
                ))}
              </div>
              <p className="eyebrow mt-6 !text-paper/50">Best colours</p>
              <div className="mt-3 grid grid-cols-10 gap-1.5">
                {sample.colour.best.map((s) => (
                  <span key={s.name} title={s.name} className="aspect-square rounded-md" style={{ backgroundColor: s.hex }} />
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-paper/[0.06] p-4 text-sm leading-relaxed text-paper/80">
                <p className="eyebrow mb-1 !text-paper/50">Fit fix</p>
                {sample.frame.fitFixes[0]!.fix}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ pain */}
      <section className="border-y border-line bg-paper">
        <Container className="grid gap-10 py-16 lg:grid-cols-[1fr_1.4fr] lg:py-20">
          <h2 className="text-4xl leading-[1.02] sm:text-5xl">Sound familiar?</h2>
          <div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                "Clothes look fine in the shop and wrong at home.",
                "Shirts pull at the shoulders but balloon at the waist.",
                "Half your wardrobe sits unworn.",
                "Every wedding season, you panic-buy a kurta.",
              ].map((t) => (
                <li key={t} className="rounded-2xl border border-line bg-ivory p-5 text-[0.95rem] leading-relaxed">
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-lg leading-relaxed text-charcoal">
              It isn&apos;t taste. Nobody has ever mapped <em className="serif-accent text-xl">your</em> frame, colouring and face — so every purchase is a guess. {name} replaces the guess with a system.
            </p>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ how */}
      <section>
        <Container className="py-16 lg:py-24">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 max-w-2xl text-4xl leading-[1.02] sm:text-5xl">Three minutes from you. The rest is on us.</h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { icon: Ruler, title: "Answer & snap", body: "A short quiz with quick undertone tests, plus two photos if you like: a headshot and a full-length." },
              { icon: Eye, title: "See your preview, free", body: "Your frame, colour family, face shape and first two outfits appear straight away. Pay only if you want the rest." },
              { icon: UserCheck, title: "Unlock & get reviewed", body: `Your full report opens instantly. A stylist reviews it within ${pricing.standardHours} hours (${pricing.priorityHours} with priority) and adds a personal note.` },
            ].map((s, i) => (
              <li key={s.title} className="rounded-3xl border border-line bg-paper p-7">
                <div className="flex items-center justify-between">
                  <s.icon className="h-6 w-6 text-gold" aria-hidden />
                  <span className="text-5xl font-semibold text-sand">{i + 1}</span>
                </div>
                <h3 className="mt-6 text-2xl">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-stone">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ------------------------------------------------------------ details strip */}
      <section aria-label="Details" className="pb-16 lg:pb-24">
        <Container>
          <h2 className="text-3xl leading-[1.05] sm:text-4xl">Made to measure, down to the hem<span className="text-gold">.</span></h2>
        </Container>
        <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-8 [scrollbar-width:none]">
          {PLATES.map(([f, alt]) => (
            <div key={f} className="relative aspect-[2/3] w-56 shrink-0 snap-start overflow-hidden rounded-3xl sm:w-64">
              <Image src={`/brand/plates/${f}.webp`} alt={alt} fill sizes="256px" className="object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ what you get */}
      <section className="bg-night text-paper">
        <Container className="py-16 lg:py-24">
          <p className="eyebrow !text-paper/50">Everything you get</p>
          <h2 className="mt-3 max-w-2xl text-4xl leading-[1.02] sm:text-5xl">Not a PDF. A style system you&apos;ll actually use.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Ruler, t: "Frame & fit fixes", b: "What to wear, what to skip and exactly what to ask a tailor — for your shoulders, waist and height." },
              { icon: Palette, t: "Your colour palette", b: "Ten best colours, five neutrals, accents and the shades to keep away from your face. Six palettes written for Indian skin." },
              { icon: Shirt, t: "20 complete outfits", b: "Office, weekend, dates, travel, weddings and pujas — weighted to what you actually dress for, each one illustrated." },
              { icon: ShoppingBag, t: "Shop every piece", b: "One tap from any piece to Myntra, Ajio or Amazon. Buy only what's missing from your wardrobe." },
              { icon: Check, t: "Core wardrobe checklist", b: "The 12 pieces that make the rest work. Tick off what you own; we show you the gaps." },
              { icon: UserCheck, t: "A real stylist's review", b: "Every paid report is checked by a stylist who corrects it, adds a personal note and handles your revisions." },
            ].map((f) => (
              <div key={f.t} className="rounded-3xl bg-paper/[0.05] p-7 ring-1 ring-paper/10">
                <f.icon className="h-6 w-6 text-gold" aria-hidden />
                <h3 className="mt-5 text-xl">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper/65">{f.b}</p>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <p className="eyebrow !text-paper/50">Six palettes, written for South Asian skin first</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {palettes.map((p) => (
                <div key={p.name} className="rounded-2xl bg-paper/[0.05] p-4 ring-1 ring-paper/10">
                  <p className="text-sm">{p.name}</p>
                  <div className="mt-3 flex gap-1">
                    {p.best.slice(0, 8).map((s) => (
                      <span key={s.name} className="h-6 flex-1 rounded" style={{ backgroundColor: s.hex }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ comparison */}
      <section>
        <Container className="py-16 lg:py-24">
          <p className="eyebrow">Why {name}</p>
          <h2 className="mt-3 max-w-2xl text-4xl leading-[1.02] sm:text-5xl">Styling services, without the usual catches.</h2>
          <div className="mt-10 overflow-x-auto rounded-3xl border border-line bg-paper">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-6 py-4 font-medium text-stone" />
                  <th className="px-6 py-4 font-semibold">{name}</th>
                  <th className="px-6 py-4 font-medium text-stone">Typical online styling report</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:border-line [&_td]:px-6 [&_td]:py-4">
                {[
                  ["See results before paying", true, false],
                  ["First results", "Minutes", "Days"],
                  ["Price shown before you start", true, false],
                  ["Interactive, shoppable report", true, "Static PDF"],
                  ["Indian occasions (weddings, pujas)", true, "Sometimes"],
                  ["Human stylist review", true, true],
                  ["Photos deleted automatically", true, "Rarely stated"],
                ].map(([label, us, them]) => (
                  <tr key={String(label)}>
                    <td className="text-charcoal">{label}</td>
                    <td>{us === true ? <Check className="h-5 w-5 text-success" aria-label="Yes" /> : <span className="font-medium">{us}</span>}</td>
                    <td className="text-stone">{them === true ? <Check className="h-5 w-5 text-stone" aria-label="Yes" /> : them === false ? <X className="h-5 w-5 text-danger" aria-label="No" /> : them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ pricing */}
      <section className="border-y border-line bg-paper">
        <Container className="grid gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-3 text-4xl leading-[1.02] sm:text-5xl">One payment. Yours to keep.</h2>
            <p className="mt-5 max-w-md leading-relaxed text-charcoal">The preview is free. Unlock the full report only if what you see is useful. GST included, UPI and cards accepted, revisions included.</p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold" aria-hidden /> Full report opens instantly after payment
              </li>
              <li className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-gold" aria-hidden /> Final stylist-reviewed version by email
              </li>
              <li className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-gold" aria-hidden /> Photos deleted automatically afterwards
              </li>
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-line bg-ivory p-7">
              <p className="text-sm text-stone">Standard</p>
              <p className="mt-2 text-4xl font-semibold tabular-nums">{formatINR(pricing.standardPaise)}</p>
              <p className="mt-2 text-sm text-stone">Stylist review within {pricing.standardHours} hours</p>
            </div>
            {pricing.priorityEnabled && (
              <div className="rounded-3xl border-2 border-ink bg-ivory p-7">
                <p className="text-sm text-stone">Priority</p>
                <p className="mt-2 text-4xl font-semibold tabular-nums">{formatINR(pricing.priorityPaise)}</p>
                <p className="mt-2 text-sm text-stone">Stylist review within {pricing.priorityHours} hours</p>
              </div>
            )}
            <ButtonLink href="/start" size="lg" className="sm:col-span-2">
              Start with the free preview <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------ faq */}
      <section>
        <Container size="narrow" className="py-16 lg:py-24">
          <h2 className="text-4xl leading-[1.02] sm:text-5xl">Questions</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                  {q}
                  <span className="text-2xl text-stone transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-charcoal">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-sm text-stone">
            More detail in <Link href="/about" className="underline">how it works</Link> and our <Link href="/privacy" className="underline">privacy policy</Link>.
          </p>
        </Container>
      </section>

      <section className="pb-8">
        <Container>
          <div className="relative overflow-hidden rounded-[2rem] bg-gold px-6 py-14 text-center text-ink sm:px-12">
            <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[10px] border-cobalt" aria-hidden />
            <span className="absolute -bottom-8 left-8 h-20 w-20 rounded-full bg-lime" aria-hidden />
            <h2 className="relative mx-auto max-w-2xl text-4xl leading-[1.02] sm:text-5xl">Know exactly what to wear. Starting today.</h2>
            <ButtonLink href="/start" size="lg" className="relative mt-8 bg-ink !text-white hover:bg-charcoal">
              Start my free analysis <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
