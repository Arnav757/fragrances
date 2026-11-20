import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, type Queryable } from "../db";
import { env } from "../env";
import { randomToken, seal, sha256, unseal } from "../auth/crypto";
import { quizSchema, type Quiz } from "../style/quiz";
import { applyOverrides, observeFromQuiz } from "../style/observe";
import { buildReport, previewOf, type ReportPreview } from "../style/report";
import { observationsSchema, outfitSchema, overridesSchema, reportSchema, type Observations, type Overrides, type Report } from "../style/types";
import { analysePhotos, type Photo } from "../ai/analyze";
import { deletePhoto, readPhoto, storePhoto, UploadError } from "../storage";
import { emailContext, sendEmail, siteUrl } from "../email/send";
import { templates } from "../email/templates";
import { revisionSchema } from "../validation";
import { getSettings } from "../settings";
import { audit } from "./audit";
import { REF_PREFIX } from "@/config/brand";
import { formatDate } from "../utils";

export class AnalysisError extends Error {}

export type AnalysisStatus = "preview" | "paid" | "released" | "revision_requested";

export type AnalysisRow = {
  id: string;
  ref: string;
  status: AnalysisStatus;
  firstName: string;
  email: string | null;
  phone: string | null;
  marketingConsent: boolean;
  quiz: Quiz;
  observations: Observations;
  observationSource: "ai" | "quiz";
  aiModel: string | null;
  aiNotes: string | null;
  overrides: Overrides;
  report: Report | null;
  reportEdited: boolean;
  stylistNote: string | null;
  reviewedBy: string | null;
  plan: "standard" | "priority" | null;
  dueAt: Date | null;
  paidAt: Date | null;
  releasedAt: Date | null;
  headshotPath: string | null;
  fullbodyPath: string | null;
  photosDeletedAt: Date | null;
  source: Record<string, string>;
  createdAt: Date;
};

const COLUMNS = (q: Queryable) => q`
  id, ref, status, first_name, email, phone, marketing_consent, quiz, observations, observation_source, ai_model, ai_notes,
  overrides, report, report_edited, stylist_note, reviewed_by, plan, due_at, paid_at, released_at,
  headshot_path, fullbody_path, photos_deleted_at, source, created_at`;

export function reportUrl(token: string): string {
  return siteUrl(`/s/${token}`);
}

const sourceSchema = z.record(z.string().max(40), z.string().max(120)).catch({});

/** Effective observations = AI/quiz observations with any stylist overrides applied. */
export function effectiveObservations(a: Pick<AnalysisRow, "observations" | "overrides">): Observations {
  return applyOverrides(a.observations, a.overrides);
}

// ---------------------------------------------------------------- create

export type CreateInput = {
  quiz: unknown;
  headshot: File | null;
  fullbody: File | null;
  photoConsent: boolean;
  source?: unknown;
};

/**
 * Creates an analysis from the quiz and optional photos and returns the secret link token.
 * Photos are stored privately, analysed (when AI is configured) and the report generated immediately.
 */
export async function createAnalysis(input: CreateInput): Promise<{ id: string; ref: string; token: string; observationSource: "ai" | "quiz" }> {
  const quiz = quizSchema.parse(input.quiz);
  const hasPhotos = Boolean(input.headshot?.size || input.fullbody?.size);
  if (hasPhotos && !input.photoConsent) throw new AnalysisError("Please confirm you're happy for us to analyse your photos.");

  const stored: { headshot?: { path: string; photo: Photo }; fullbody?: { path: string; photo: Photo } } = {};
  try {
    if (input.headshot?.size) {
      const s = await storePhoto(input.headshot);
      stored.headshot = { path: s.path, photo: { bytes: s.bytes, mime: s.mime } };
    }
    if (input.fullbody?.size) {
      const s = await storePhoto(input.fullbody);
      stored.fullbody = { path: s.path, photo: { bytes: s.bytes, mime: s.mime } };
    }
  } catch (e) {
    await Promise.all([deletePhoto(stored.headshot?.path ?? null), deletePhoto(stored.fullbody?.path ?? null)]);
    if (e instanceof UploadError) throw new AnalysisError(e.message);
    throw e;
  }

  const base = observeFromQuiz(quiz);
  const ai = await analysePhotos(quiz, base, { headshot: stored.headshot?.photo, fullbody: stored.fullbody?.photo });
  const observations = observationsSchema.parse(ai.used ? ai.observations : base);
  const id = randomUUID();
  const report = buildReport(quiz, observations, id);
  const token = randomToken(24);

  const rows = await db()<{ ref: string }[]>`
    insert into analyses (id, ref, token_hash, token_sealed, first_name, quiz, observations, observation_source, ai_model, ai_notes, report,
                          headshot_path, fullbody_path, photo_consent_at, source)
    values (${id}, ${REF_PREFIX + "-"} || nextval('analysis_ref_seq')::text, ${sha256(token)}, ${seal(env().APP_SECRET, token)}, ${quiz.firstName},
            ${db().json(quiz as never)}, ${db().json(observations as never)}, ${ai.used ? "ai" : "quiz"}, ${ai.used ? ai.model : null},
            ${ai.used ? null : ai.reason}, ${db().json(report as never)}, ${stored.headshot?.path ?? null}, ${stored.fullbody?.path ?? null},
            ${hasPhotos ? new Date() : null}, ${db().json(sourceSchema.parse(input.source ?? {}) as never)})
    returning ref`;
  await db()`insert into analysis_events (analysis_id, message) values (${id}, ${ai.used ? `Analysed from photos (${ai.model})` : `Analysed from quiz: ${ai.reason}`})`;
  return { id, ref: rows[0]!.ref, token, observationSource: ai.used ? "ai" : "quiz" };
}

// ---------------------------------------------------------------- read

export async function getAnalysisByToken(token: string, q: Queryable = db()): Promise<AnalysisRow | null> {
  if (!token || token.length > 100 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const rows = await q<AnalysisRow[]>`select ${COLUMNS(q)} from analyses where token_hash = ${sha256(token)}`;
  return rows[0] ?? null;
}

export async function getAnalysisById(id: string, q: Queryable = db()): Promise<AnalysisRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const rows = await q<AnalysisRow[]>`select ${COLUMNS(q)} from analyses where id = ${id}`;
  return rows[0] ?? null;
}

export function linkTokenFor(sealed: string): string | null {
  return unseal(env().APP_SECRET, sealed);
}

export type CustomerView =
  | { kind: "preview"; analysis: AnalysisRow; preview: ReportPreview }
  | { kind: "full"; analysis: AnalysisRow; report: Report; final: boolean };

/**
 * What the customer may see. Unpaid customers only ever receive the preview subset — the rest of the
 * report is never sent to the browser.
 */
export function customerView(a: AnalysisRow): CustomerView {
  const report = a.report ? reportSchema.parse(a.report) : buildReport(a.quiz, effectiveObservations(a), a.id);
  // The full report is stripped from preview views so it can't be passed to the browser by accident.
  if (a.status === "preview") return { kind: "preview", analysis: { ...a, report: null }, preview: previewOf(report) };
  return { kind: "full", analysis: a, report, final: a.status === "released" };
}

export async function analysisEvents(id: string, customerOnly = false) {
  return db()<{ id: string; message: string; customerVisible: boolean; createdAt: Date; actorName: string | null }[]>`
    select e.id, e.message, e.customer_visible, e.created_at, p.full_name as actor_name
    from analysis_events e left join profiles p on p.id = e.actor_id
    where e.analysis_id = ${id} ${customerOnly ? db()`and e.customer_visible` : db()``}
    order by e.created_at`;
}

// ---------------------------------------------------------------- customer actions

export async function emailPreviewLink(token: string, emailAddr: string, marketingConsent: boolean) {
  const a = await getAnalysisByToken(token);
  if (!a) throw new AnalysisError("We couldn't find this analysis.");
  await db()`update analyses set email = coalesce(email, ${emailAddr}), marketing_consent = marketing_consent or ${marketingConsent} where id = ${a.id}`;
  const ctx = await emailContext();
  await sendEmail(emailAddr, "preview_link", templates.preview_link(ctx, { name: a.firstName, ref: a.ref, url: reportUrl(token) }), a.id);
}

export async function requestRevision(token: string, rawMessage: string) {
  const { message } = revisionSchema.parse({ message: rawMessage });
  const a = await getAnalysisByToken(token);
  if (!a) throw new AnalysisError("We couldn't find this report.");
  if (a.status === "preview") throw new AnalysisError("Revisions are included once you've unlocked the full report.");
  await db().begin(async (tx) => {
    const open = await tx`select 1 from revision_requests where analysis_id = ${a.id} and status = 'open'`;
    if (open.length) throw new AnalysisError("You already have a revision request open — we'll get back to you soon.");
    await tx`insert into revision_requests (analysis_id, message) values (${a.id}, ${message})`;
    if (a.status === "released") await tx`update analyses set status = 'revision_requested' where id = ${a.id}`;
    await tx`insert into analysis_events (analysis_id, message, customer_visible) values (${a.id}, 'You asked for a revision', true)`;
  });
  if (a.email) {
    const ctx = await emailContext();
    await sendEmail(a.email, "revision_received", templates.revision_received(ctx, { name: a.firstName, ref: a.ref, url: reportUrl(token) }), a.id);
  }
}

/** Emails every report link for an address. Always behaves the same whether or not anything matches. */
export async function sendLinksForEmail(emailAddr: string) {
  const rows = await db()<{ id: string; ref: string; tokenSealed: string; createdAt: Date; status: AnalysisStatus }[]>`
    select id, ref, token_sealed, created_at, status from analyses where email = ${emailAddr} order by created_at desc limit 10`;
  const links = rows
    .map((r) => ({ r, token: linkTokenFor(r.tokenSealed) }))
    .filter((x): x is { r: (typeof rows)[number]; token: string } => Boolean(x.token))
    .map(({ r, token }) => ({ ref: r.ref, url: reportUrl(token), created: formatDate(r.createdAt), status: r.status === "preview" ? "preview" : r.status === "released" ? "final report" : "full report" }));
  if (!links.length) return;
  const ctx = await emailContext();
  await sendEmail(emailAddr, "find_links", templates.find_links(ctx, { links }), rows[0]!.id);
}

// ---------------------------------------------------------------- stylist actions

async function loadForStaff(id: string): Promise<AnalysisRow> {
  const a = await getAnalysisById(id);
  if (!a) throw new AnalysisError("Analysis not found.");
  return a;
}

/** Rebuild the report from (observations + overrides). Discards manual outfit edits. */
export async function applyStylistOverrides(id: string, raw: unknown, actorId: string) {
  const a = await loadForStaff(id);
  const overrides = overridesSchema.parse(raw);
  const effective = applyOverrides(a.observations, overrides);
  const report = buildReport(a.quiz, effective, a.id);
  await db()`update analyses set overrides = ${db().json(overrides as never)}, report = ${db().json(report as never)}, report_edited = false where id = ${id}`;
  await db()`insert into analysis_events (analysis_id, message, actor_id) values (${id}, ${`Observations adjusted: ${Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(", ") || "reset to analysis"}`}, ${actorId})`;
  await audit(actorId, "analysis.overrides", "analysis", id, overrides);
}

const outfitPatchSchema = outfitSchema.pick({ title: true, why: true, pieces: true });

export async function updateOutfit(id: string, outfitId: string, raw: unknown, actorId: string) {
  const a = await loadForStaff(id);
  const patch = outfitPatchSchema.parse(raw);
  const report = reportSchema.parse(a.report);
  const idx = report.outfits.findIndex((o) => o.id === outfitId);
  if (idx < 0) throw new AnalysisError("Outfit not found.");
  report.outfits[idx] = { ...report.outfits[idx]!, ...patch };
  await db()`update analyses set report = ${db().json(report as never)}, report_edited = true where id = ${id}`;
  await audit(actorId, "analysis.outfit_edit", "analysis", id, { outfitId });
}

export async function removeOutfit(id: string, outfitId: string, actorId: string) {
  const a = await loadForStaff(id);
  const report = reportSchema.parse(a.report);
  if (report.outfits.length <= 1) throw new AnalysisError("A report needs at least one outfit.");
  report.outfits = report.outfits.filter((o) => o.id !== outfitId);
  await db()`update analyses set report = ${db().json(report as never)}, report_edited = true where id = ${id}`;
  await audit(actorId, "analysis.outfit_remove", "analysis", id, { outfitId });
}

export async function saveStylistNote(id: string, note: string, actorId: string) {
  const text = z.string().trim().max(4000).parse(note);
  await loadForStaff(id);
  await db()`update analyses set stylist_note = ${text || null} where id = ${id}`;
  await audit(actorId, "analysis.note", "analysis", id);
}

/** Marks the report final, resolves any open revision and emails the customer. */
export async function releaseReport(id: string, actorId: string, response = "") {
  const a = await loadForStaff(id);
  if (a.status === "preview") throw new AnalysisError("This analysis hasn't been paid for yet.");
  if (!a.stylistNote?.trim()) throw new AnalysisError("Add a personal note for the customer before releasing.");
  const wasRevision = a.status === "revision_requested";
  await db().begin(async (tx) => {
    await tx`update analyses set status = 'released', released_at = now(), reviewed_by = ${actorId} where id = ${id}`;
    await tx`update revision_requests set status = 'resolved', response = ${response || null}, resolved_by = ${actorId}, resolved_at = now()
             where analysis_id = ${id} and status = 'open'`;
    await tx`insert into analysis_events (analysis_id, message, customer_visible, actor_id)
             values (${id}, ${wasRevision ? "Revision completed — report updated" : "Stylist review complete — final report released"}, true, ${actorId})`;
  });
  await audit(actorId, "analysis.release", "analysis", id, { revision: wasRevision });
  const tokenRow = await db()<{ tokenSealed: string }[]>`select token_sealed from analyses where id = ${id}`;
  const token = linkTokenFor(tokenRow[0]!.tokenSealed);
  if (a.email && token) {
    const [ctx, store] = await Promise.all([emailContext(), getSettings("store")]);
    await sendEmail(
      a.email,
      "report_released",
      templates.report_released(ctx, { name: a.firstName, ref: a.ref, url: reportUrl(token), stylist: store.stylistName, changed: a.reportEdited || Object.keys(a.overrides).length > 0 }),
      id,
    );
  }
}

export async function photoFor(id: string, kind: "headshot" | "fullbody") {
  const a = await getAnalysisById(id);
  const p = kind === "headshot" ? a?.headshotPath : a?.fullbodyPath;
  if (!a || !p || a.photosDeletedAt) return null;
  return readPhoto(p);
}

// ---------------------------------------------------------------- retention

/**
 * Privacy housekeeping, run daily:
 *  - deletes photos N days after release (or once refunded),
 *  - deletes unpaid previews (and their photos) after M days,
 *  - expires unpaid checkout orders.
 */
export async function runRetention(now = new Date()) {
  const privacy = await getSettings("privacy");
  const pricing = await getSettings("pricing");
  let photos = 0;
  let previews = 0;

  const toStrip = await db()<{ id: string; headshotPath: string | null; fullbodyPath: string | null }[]>`
    select id, headshot_path, fullbody_path from analyses
    where photos_deleted_at is null and (headshot_path is not null or fullbody_path is not null)
      and status = 'released' and released_at < ${now}::timestamptz - make_interval(days => ${privacy.photoRetentionDays})`;
  for (const a of toStrip) {
    await deletePhoto(a.headshotPath);
    await deletePhoto(a.fullbodyPath);
    await db()`update analyses set headshot_path = null, fullbody_path = null, photos_deleted_at = now() where id = ${a.id}`;
    await db()`insert into analysis_events (analysis_id, message, customer_visible) values (${a.id}, 'Your photos were permanently deleted', true)`;
    photos++;
  }

  const stale = await db()<{ id: string; headshotPath: string | null; fullbodyPath: string | null }[]>`
    select a.id, a.headshot_path, a.fullbody_path from analyses a
    where a.status = 'preview' and a.created_at < ${now}::timestamptz - make_interval(days => ${privacy.unpaidRetentionDays})
      and not exists (select 1 from orders o where o.analysis_id = a.id and o.status in ('paid', 'refunded'))`;
  for (const a of stale) {
    await deletePhoto(a.headshotPath);
    await deletePhoto(a.fullbodyPath);
    await db().begin(async (tx) => {
      await tx`delete from orders where analysis_id = ${a.id} and status not in ('paid', 'refunded')`;
      await tx`delete from analyses where id = ${a.id}`;
    });
    previews++;
  }

  const expired = await db()`
    update orders set status = 'expired'
    where status in ('awaiting_payment', 'payment_failed') and created_at < ${now}::timestamptz - make_interval(hours => ${pricing.orderExpiryHours})
    returning id`;
  return { photosDeleted: photos, previewsDeleted: previews, ordersExpired: expired.length };
}

/** Admin: delete a customer's photos immediately (e.g. on request). */
export async function deletePhotosNow(id: string, actorId: string) {
  const a = await loadForStaff(id);
  await deletePhoto(a.headshotPath);
  await deletePhoto(a.fullbodyPath);
  await db()`update analyses set headshot_path = null, fullbody_path = null, photos_deleted_at = now() where id = ${id}`;
  await db()`insert into analysis_events (analysis_id, message, customer_visible, actor_id) values (${id}, 'Your photos were permanently deleted', true, ${actorId})`;
  await audit(actorId, "analysis.photos_deleted", "analysis", id);
}
