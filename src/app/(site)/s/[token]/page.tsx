import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { analysisEvents, customerView, effectiveObservations, getAnalysisByToken } from "@/lib/services/analyses";
import { ReportView } from "@/components/report/report-view";
import { PreviewView } from "@/components/report/preview-view";
import { RevisionForm } from "@/components/report/small-forms";
import { Notice } from "@/components/ui/misc";
import { getSettings } from "@/lib/settings";
import { getGateway } from "@/lib/payments/gateway";
import { formatDate } from "@/lib/utils";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Your style report", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await getAnalysisByToken(token);
  if (!a) notFound();
  const view = customerView(a);
  const observations = effectiveObservations(a);

  if (view.kind === "preview") {
    const pricing = await getSettings("pricing");
    const gateway = getGateway();
    const plans = [
      { code: "standard" as const, label: "Standard review", pricePaise: pricing.standardPaise, hours: pricing.standardHours },
      ...(pricing.priorityEnabled ? [{ code: "priority" as const, label: "Priority review", pricePaise: pricing.priorityPaise, hours: pricing.priorityHours }] : []),
    ];
    return (
      <PreviewView
        token={token}
        firstName={a.firstName}
        preview={view.preview}
        observations={observations}
        source={a.observationSource}
        aiNote={a.aiNotes}
        plans={plans}
        mode={gateway ? gateway.provider : "off"}
      />
    );
  }

  const [store, shop, events, openRev] = await Promise.all([
    getSettings("store"),
    getSettings("shop"),
    analysisEvents(a.id, true),
    db()`select 1 from revision_requests where analysis_id = ${a.id} and status = 'open'`,
  ]);
  const banner =
    a.status === "paid" ? (
      <Notice className="mt-8" title="Your stylist review is in progress">
        Everything below is yours now. A stylist is checking it{a.dueAt ? ` and will release the final version by ${formatDate(a.dueAt, true)}` : ""} — we&apos;ll email you. Small things may change.
      </Notice>
    ) : a.status === "revision_requested" ? (
      <Notice className="mt-8" title="Revision in progress">
        A stylist is updating your report based on your request. We&apos;ll email you when it&apos;s done.
      </Notice>
    ) : null;

  return (
    <ReportView
      report={view.report}
      shop={shop}
      banner={banner}
      meta={{
        firstName: a.firstName,
        ref: a.ref,
        status: view.final ? "final" : "draft",
        stylistNote: view.final || a.status === "revision_requested" ? a.stylistNote : null,
        stylistName: store.stylistName,
        observations,
        source: a.observationSource,
        occasions: a.quiz.occasions,
        storageKey: `capsule:${a.ref}`,
      }}
      footer={
        <section className="no-print grid gap-10 border-t border-line py-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl">Something not right?</h2>
            <p className="mt-2 mb-5 text-sm text-stone">Revisions are included. Tell us what feels off and a stylist will update your report.</p>
            <RevisionForm token={token} open={openRev.length > 0} />
          </div>
          <div>
            <h2 className="text-2xl">Timeline</h2>
            <ol className="mt-4 space-y-3 border-l border-line pl-5 text-sm">
              {events.map((e) => (
                <li key={e.id}>
                  <p className="text-ink">{e.message}</p>
                  <p className="text-xs text-stone">{formatDate(e.createdAt, true)}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs text-stone">Reference {a.ref}. Keep this link private — anyone with it can open your report.</p>
          </div>
        </section>
      }
    />
  );
}
