import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisStatusBadge, KV, PageHeader, Panel } from "@/components/admin/ui";
import { DeletePhotosButton, NoteForm, OutfitEditor, OverridesForm, ReleasePanel } from "@/components/admin/review";
import { analysisEvents, effectiveObservations, getAnalysisById, linkTokenFor } from "@/lib/services/analyses";
import { LABELS, FACE_SHAPES } from "@/lib/style/quiz";
import { FRAMES_GUIDE } from "@/lib/style/frames";
import { CONTRASTS, DEPTHS, FRAMES, UNDERTONES, reportSchema } from "@/lib/style/types";
import { PALETTES } from "@/lib/style/palettes";
import { paletteKey } from "@/lib/style/report";
import { db } from "@/lib/db";
import { formatDate, titleCase } from "@/lib/utils";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Review" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAnalysisById(id);
  if (!a) notFound();
  const sql = db();
  const [events, revisions, orders, sealed] = await Promise.all([
    analysisEvents(a.id),
    sql<{ message: string; status: string; createdAt: Date }[]>`select message, status, created_at from revision_requests where analysis_id = ${a.id} order by created_at desc`,
    sql<{ orderNumber: string; status: string; totalPaise: number; plan: string; createdAt: Date }[]>`select order_number, status, total_paise, plan, created_at from orders where analysis_id = ${a.id} order by created_at desc`,
    sql<{ tokenSealed: string }[]>`select token_sealed from analyses where id = ${a.id}`,
  ]);
  const token = linkTokenFor(sealed[0]!.tokenSealed);
  const eff = effectiveObservations(a);
  const report = reportSchema.parse(a.report);
  const pal = PALETTES[paletteKey(eff)];
  const swatches = [...pal.best, ...pal.neutrals, ...pal.accents, { name: "White", hex: "#f7f7f7" }, { name: "Off-white", hex: "#f4efe4" }, { name: "Dark indigo", hex: "#26335a" }, { name: "Tan", hex: "#a8693a" }, { name: "Cognac", hex: "#8b4a24" }, { name: "Dark brown", hex: "#4a2c1a" }, { name: "Black", hex: "#141414" }];
  const openRevision = revisions.find((r) => r.status === "open");
  const q = a.quiz;

  const fields = [
    { key: "frame", label: "Body frame", options: FRAMES.map((f) => ({ value: f, label: FRAMES_GUIDE[f].name })) },
    { key: "undertone", label: "Undertone", options: UNDERTONES.map((v) => ({ value: v, label: titleCase(v) })) },
    { key: "depth", label: "Depth", options: DEPTHS.map((v) => ({ value: v, label: v === "light" ? "Light–medium" : "Medium–deep" })) },
    { key: "contrast", label: "Contrast", options: CONTRASTS.map((v) => ({ value: v, label: titleCase(v) })) },
    { key: "faceShape", label: "Face shape", options: FACE_SHAPES.map((v) => ({ value: v, label: LABELS.faceShape[v] })) },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/reports", label: "Reports" }}
        title={`${a.ref} · ${a.firstName}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <AnalysisStatusBadge status={a.status} />
            {a.plan && <span>{a.plan} review</span>}
            {a.dueAt && a.status !== "released" && <span className={a.dueAt < new Date() ? "text-danger" : ""}>due {formatDate(a.dueAt, true)}</span>}
          </span>
        }
        actions={
          token ? (
            <Link href={`/s/${token}`} target="_blank" className="rounded-full border border-line bg-paper px-4 py-2 text-sm hover:border-ink">
              Open customer view ↗
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Panel title="Photos" actions={a.headshotPath || a.fullbodyPath ? <DeletePhotosButton analysisId={a.id} /> : null}>
            {a.photosDeletedAt ? (
              <p className="text-sm text-stone">Deleted {formatDate(a.photosDeletedAt, true)}.</p>
            ) : a.headshotPath || a.fullbodyPath ? (
              <div className="grid grid-cols-2 gap-3">
                {(["headshot", "fullbody"] as const).map((k) =>
                  (k === "headshot" ? a.headshotPath : a.fullbodyPath) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private, staff-only image route
                    <img key={k} src={`/api/admin/photos/${a.id}/${k}`} alt={k} className="aspect-[3/4] w-full rounded-xl bg-sand object-cover" />
                  ) : (
                    <div key={k} className="flex aspect-[3/4] items-center justify-center rounded-xl bg-sand text-xs text-stone">
                      No {k}
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-stone">No photos uploaded.</p>
            )}
          </Panel>

          <Panel title="Analysis">
            <KV
              items={[
                ["Source", a.observationSource === "ai" ? `Photos + quiz (${a.aiModel})` : "Quiz only"],
                ...(a.aiNotes ? ([["Why no AI", a.aiNotes]] as [string, string][]) : []),
                ["Frame", `${FRAMES_GUIDE[eff.frame].name} (${eff.confidence.frame})`],
                ["Colour", `${pal.name} · ${eff.contrast} contrast (${eff.confidence.colour})`],
                ["Face", `${LABELS.faceShape[eff.faceShape]} (${eff.confidence.face})`],
                ["Height", `${q.heightCm} cm — ${eff.heightBand}`],
              ]}
            />
            {eff.notes.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-line pt-4 text-xs text-charcoal">
                {eff.notes.map((n) => (
                  <li key={n}>— {n}</li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Quiz answers">
            <KV
              items={[
                ["Age", LABELS.ageRange[q.ageRange]],
                ["Build", LABELS.build[q.build]],
                ["Shoulders", LABELS.shoulders[q.shoulders]],
                ["Midsection", LABELS.midsection[q.midsection]],
                ["Fit issues", q.fitIssues.map((f) => LABELS.fitIssues[f]).join("; ") || "—"],
                ["Veins / sun / metal", `${LABELS.veins[q.veins]} · ${LABELS.sun[q.sun]} · ${LABELS.metal[q.metal]}`],
                ["Skin / hair", `${LABELS.skinDepth[q.skinDepth]} · ${LABELS.hair[q.hair]}`],
                ["Face / beard / glasses", `${LABELS.faceShape[q.faceShape]} · ${LABELS.beard[q.beard]} · ${q.glasses ? "glasses" : "no glasses"}`],
                ["Occasions", q.occasions.map((o) => LABELS.occasions[o]).join(", ")],
                ["Style / budget", `${LABELS.style[q.style]} · ${LABELS.budget[q.budget]}`],
              ]}
            />
          </Panel>

          <Panel title="Customer">
            <KV
              items={[
                ["Email", a.email ?? "—"],
                ["Mobile", a.phone ?? "—"],
                ["Marketing", a.marketingConsent ? "Opted in" : "No"],
                ["Came from", Object.entries(a.source).map(([k, v]) => `${k}=${v}`).join(" ") || "direct"],
              ]}
            />
            {orders.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-line pt-4 text-xs">
                {orders.map((o) => (
                  <li key={o.orderNumber}>
                    {o.orderNumber} · {o.plan} · {formatINR(o.totalPaise)} · {o.status} · {formatDate(o.createdAt, true)}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Timeline">
            <ol className="space-y-2 text-xs">
              {events.map((e) => (
                <li key={e.id}>
                  <span className="text-stone">{formatDate(e.createdAt, true)}</span> — {e.message}
                  {e.actorName && <span className="text-stone"> ({e.actorName})</span>}
                  {e.customerVisible && <span className="text-mist"> · visible to customer</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="1 · Check the analysis">
            <OverridesForm analysisId={a.id} fields={fields} current={a.overrides as Record<string, string | undefined>} detected={a.observations as unknown as Record<string, string>} edited={a.reportEdited} />
          </Panel>
          <Panel title={`2 · Review the outfits (${report.outfits.length})`}>
            <div className="divide-y divide-line">
              {report.outfits.map((o, i) => (
                <OutfitEditor key={o.id + JSON.stringify(o).length} analysisId={a.id} outfit={o} index={i} swatches={swatches} />
              ))}
            </div>
          </Panel>
          <Panel title="3 · Write a personal note">
            <NoteForm analysisId={a.id} note={a.stylistNote ?? ""} />
          </Panel>
          <Panel title="4 · Release">
            {a.status === "released" ? (
              <p className="text-sm text-success">Released {formatDate(a.releasedAt, true)}. If you change anything, the customer sees it immediately.</p>
            ) : (
              <ReleasePanel analysisId={a.id} canRelease={a.status !== "preview"} hasNote={Boolean(a.stylistNote?.trim())} revision={openRevision?.message ?? null} />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
