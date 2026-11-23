"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth/session";
import { AnalysisError, applyStylistOverrides, deletePhotosNow, releaseReport, removeOutfit, saveStylistNote, updateOutfit } from "@/lib/services/analyses";
import { PaymentError, refundOrder } from "@/lib/services/payments";
import { confirmUpi, rejectUpi } from "@/lib/services/upi";
import { saveSettings, type SettingsKey } from "@/lib/settings";
import { audit } from "@/lib/services/audit";
import { discountSchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { toActionError, type ActionResult } from "@/lib/forms";
import { rupeesToPaise } from "@/lib/money";

const id = z.uuid();
const reportPath = (aid: string) => `/admin/reports/${aid}`;

export async function overridesAction(analysisId: string, raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireStaff();
    await applyStylistOverrides(id.parse(analysisId), raw, u.id);
    revalidatePath(reportPath(analysisId));
    return { ok: true, message: "Report rebuilt from your corrections." };
  } catch (e) {
    return toActionError(e, [AnalysisError]);
  }
}

export async function saveNoteAction(analysisId: string, note: string): Promise<ActionResult> {
  try {
    const u = await requireStaff();
    await saveStylistNote(id.parse(analysisId), note, u.id);
    revalidatePath(reportPath(analysisId));
    return { ok: true, message: "Note saved." };
  } catch (e) {
    return toActionError(e, [AnalysisError]);
  }
}

export async function updateOutfitAction(analysisId: string, outfitId: string, raw: unknown): Promise<ActionResult> {
  try {
    const u = await requireStaff();
    await updateOutfit(id.parse(analysisId), z.string().max(40).parse(outfitId), raw, u.id);
    revalidatePath(reportPath(analysisId));
    return { ok: true, message: "Outfit updated." };
  } catch (e) {
    return toActionError(e, [AnalysisError]);
  }
}

export async function removeOutfitAction(analysisId: string, outfitId: string): Promise<ActionResult> {
  try {
    const u = await requireStaff();
    await removeOutfit(id.parse(analysisId), z.string().max(40).parse(outfitId), u.id);
    revalidatePath(reportPath(analysisId));
    return { ok: true, message: "Outfit removed." };
  } catch (e) {
    return toActionError(e, [AnalysisError]);
  }
}

export async function releaseAction(analysisId: string, response: string): Promise<ActionResult> {
  try {
    const u = await requireStaff();
    await releaseReport(id.parse(analysisId), u.id, z.string().max(2000).parse(response ?? ""));
    revalidatePath(reportPath(analysisId));
    revalidatePath("/admin/reports");
    return { ok: true, message: "Released — the customer has been emailed." };
  } catch (e) {
    return toActionError(e, [AnalysisError]);
  }
}

export async function deletePhotosAction(analysisId: string): Promise<ActionResult> {
  try {
    const u = await requireStaff();
    await deletePhotosNow(id.parse(analysisId), u.id);
    revalidatePath(reportPath(analysisId));
    return { ok: true, message: "Photos deleted." };
  } catch (e) {
    return toActionError(e, [AnalysisError]);
  }
}

export async function refundAction(orderId: string, reason: string): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    await refundOrder(id.parse(orderId), u.id, z.string().max(300).parse(reason ?? ""));
    revalidatePath("/admin/orders");
    return { ok: true, message: "Refund initiated." };
  } catch (e) {
    return toActionError(e, [PaymentError]);
  }
}

export async function confirmUpiAction(paymentId: string): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    const r = await confirmUpi(id.parse(paymentId), u.id);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true, message: r.result === "duplicate_payment" ? "Recorded — but this report was already unlocked. Refund this payment." : "Payment confirmed. Report unlocked and the customer emailed." };
  } catch (e) {
    return toActionError(e, [PaymentError]);
  }
}

export async function rejectUpiAction(paymentId: string, reason: string): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    await rejectUpi(id.parse(paymentId), u.id, z.string().max(300).parse(reason ?? ""));
    revalidatePath("/admin/orders");
    return { ok: true, message: "Marked as not received. The customer can pay again." };
  } catch (e) {
    return toActionError(e, [PaymentError]);
  }
}

export async function saveSettingsAction(key: SettingsKey | "pages", value: unknown): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    await saveSettings(z.enum(["store", "pricing", "shop", "privacy", "payments", "pages"]).parse(key), value, u.id);
    await audit(u.id, "settings.update", "settings", key);
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createDiscountAction(raw: Record<string, string>): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    const d = discountSchema.parse(raw);
    const value = d.type === "percent" ? Math.round(d.value * 100) : rupeesToPaise(d.value);
    if (!value || (d.type === "percent" && value > 10000)) return { ok: false, message: "Enter a valid amount.", errors: { value: "Invalid" } };
    const rows = await db()<{ id: string }[]>`
      insert into discounts (code, description, type, value, max_uses, ends_at)
      values (${d.code.toUpperCase()}, ${d.description || null}, ${d.type}, ${value}, ${d.maxUses ?? null}, ${d.endsAt ? new Date(d.endsAt) : null})
      on conflict (code) do nothing returning id`;
    if (!rows[0]) return { ok: false, message: "That code already exists.", errors: { code: "Already exists" } };
    await audit(u.id, "discount.create", "discount", rows[0].id, { code: d.code });
    revalidatePath("/admin/discounts");
    return { ok: true, message: "Code created." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleDiscountAction(discountId: string, active: boolean): Promise<ActionResult> {
  try {
    const u = await requireAdmin();
    await db()`update discounts set is_active = ${active} where id = ${id.parse(discountId)}`;
    await audit(u.id, active ? "discount.enable" : "discount.disable", "discount", discountId);
    revalidatePath("/admin/discounts");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
