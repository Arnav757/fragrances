import type { Metadata } from "next";
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
