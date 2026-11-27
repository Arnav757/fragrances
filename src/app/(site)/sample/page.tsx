import type { Metadata } from "next";
import Image from "next/image";
import { SAMPLE_QUIZ } from "@/lib/style/quiz";
import { observeFromQuiz } from "@/lib/style/observe";
import { buildReport } from "@/lib/style/report";
import { ReportView } from "@/components/report/report-view";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Sample report", description: "A complete example of a personal style report: frame, colours, face, 20 outfits and a wardrobe checklist." };

export default async function SamplePage() {
  const [shop, store] = await Promise.all([getSettings("shop"), getSettings("store")]);
  const observations = observeFromQuiz(SAMPLE_QUIZ);
  const report = buildReport(SAMPLE_QUIZ, observations, "sample-report");
  return (
    <ReportView
      report={report}
      shop={shop}
      art={<SampleArt colours={report.colour.best.slice(0, 6).map((c) => c.hex)} />}
      banner={
        <Notice className="mt-8" title="This is a sample">
          Arjun is a fictional example — 175 cm, athletic, warm undertone, smart-casual office. Your report is built from your own photos and answers.
        </Notice>
      }
      meta={{
        firstName: SAMPLE_QUIZ.firstName,
        ref: "SAMPLE",
        status: "sample",
        stylistNote:
          "Arjun — your shoulders are doing a lot of work already, so let your trousers and shoes carry some weight. Start with the olive overshirt and a pair of straight-leg chinos: that one change will fix the 'top-heavy' look you described.",
        stylistName: store.stylistName || "your stylist",
        observations,
        source: "quiz",
        occasions: SAMPLE_QUIZ.occasions,
        storageKey: "capsule:sample",
      }}
      footer={
        <section className="no-print border-t border-line py-16 text-center">
          <h2 className="text-3xl sm:text-4xl">Get yours — the preview is free.</h2>
          <p className="mx-auto mt-3 max-w-md text-stone">Three minutes, two photos, and you&apos;ll see your frame, colours and first outfits before paying anything.</p>
          <ButtonLink href="/start" size="lg" className="mt-6">
            Start my free analysis
          </ButtonLink>
        </section>
      }
    />
  );
}

/** Arjun on an ice-blue disc with his best colours orbiting him. */
function SampleArt({ colours }: { colours: string[] }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]" aria-hidden>
      <div className="absolute inset-[8%] rounded-full bg-ice" />
      <div className="animate-orbit absolute inset-0">
        {colours.map((c, i) => {
          const a = (i / colours.length) * 2 * Math.PI;
          return (
            <span
              key={c + i}
              className="animate-orbit-rev absolute h-10 w-10 rounded-full ring-4 ring-white"
              style={{ backgroundColor: c, left: `calc(50% + ${Math.cos(a) * 47}% - 20px)`, top: `calc(50% + ${Math.sin(a) * 47}% - 20px)` }}
            />
          );
        })}
      </div>
      <div className="absolute inset-[8%] overflow-hidden rounded-full">
        <Image src="/brand/looks/A2.webp" alt="" fill sizes="420px" className="object-contain object-top pt-6" priority />
      </div>
      <span className="absolute right-[6%] bottom-[10%] h-7 w-7 rounded-full bg-gold" />
    </div>
  );
}
