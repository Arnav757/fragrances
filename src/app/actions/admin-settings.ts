"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { saveSettings } from "@/lib/settings";
import { audit } from "@/lib/services/audit";
import { toActionError, type ActionResult } from "@/lib/forms";
import { db } from "@/lib/db";

export async function saveSettingsAction(key: "store" | "commerce" | "homepage" | "pages", value: unknown): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const k = z.enum(["store", "commerce", "homepage", "pages"]).parse(key);
    const saved = await saveSettings(k, value, actor.id);
    await audit(actor.id, `settings.${k}`, "settings", k, k === "pages" ? { pages: Object.keys(saved as object) } : (saved as Record<string, unknown>));
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return toActionError(e);
  }
}

const expenseSchema = z.object({
  category: z.enum(["advertising", "packaging", "shipping", "software", "other"]),
  description: z.string().trim().min(2).max(200),
  amountPaise: z.number().int().positive(),
  gstPaise: z.number().int().nonnegative().default(0),
  itcEligible: z.boolean().default(false),
  incurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function addExpenseAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const e = expenseSchema.parse(input);
    await db()`insert into expenses (category, description, amount_paise, gst_paise, itc_eligible, incurred_on, created_by)
               values (${e.category}, ${e.description}, ${e.amountPaise}, ${e.gstPaise}, ${e.itcEligible}, ${e.incurredOn}, ${actor.id})`;
    await audit(actor.id, "expense.create", "expense", null, e);
    revalidatePath("/admin/reports");
    return { ok: true, message: "Expense recorded." };
  } catch (e) {
    return toActionError(e);
  }
}
