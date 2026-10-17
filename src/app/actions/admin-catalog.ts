"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import {
  AdminError,
  addProductImage,
  archiveProduct,
  importProductsCsv,
  saveBrand,
  saveCollection,
  saveDiscount,
  saveProduct,
  saveSupplier,
  saveTaxClass,
  upsertOffer,
  type ImportPreview,
} from "@/lib/services/admin-catalog";
import { deleteStoredImage, storeProductImage, UploadError } from "@/lib/storage";
import { audit } from "@/lib/services/audit";
import { toActionError, type ActionResult } from "@/lib/forms";
import { db } from "@/lib/db";

const known = [AdminError, UploadError];

export async function saveProductAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  let newId: string;
  try {
    const actor = await requireAdmin();
    newId = await saveProduct(id, input, actor);
    revalidatePath("/", "layout");
  } catch (e) {
    return toActionError(e, known);
  }
  if (!id) redirect(`/admin/products/${newId}?created=1`);
  return { ok: true, data: { id: newId }, message: "Product saved." };
}

export async function archiveProductAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await archiveProduct(z.uuid().parse(id), actor);
    revalidatePath("/", "layout");
    return { ok: true, message: "Product archived and hidden from the store." };
  } catch (e) {
    return toActionError(e, known);
  }
}

export async function uploadImageAction(productId: string, form: FormData): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, message: "Choose an image to upload." };
    if (form.get("rights") !== "yes") return { ok: false, message: "Confirm you have the right to use this image." };
    const alt = String(form.get("alt") ?? "").slice(0, 200);
    const stored = await storeProductImage(file);
    await addProductImage(z.uuid().parse(productId), { ...stored, alt, usageRightsConfirmed: true }, actor);
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Image uploaded." };
  } catch (e) {
    return toActionError(e, known);
  }
}

export async function deleteImageAction(productId: string, imageId: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const rows = await db()<{ storagePath: string | null }[]>`delete from product_images where id = ${z.uuid().parse(imageId)} and product_id = ${productId} returning storage_path`;
    if (rows[0]) await deleteStoredImage(rows[0].storagePath);
    await audit(actor.id, "product.image_delete", "product", productId, { imageId });
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Image removed." };
  } catch (e) {
    return toActionError(e, known);
  }
}

export async function saveOfferAction(productId: string, input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await upsertOffer(z.uuid().parse(productId), input, actor);
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Supplier offer saved." };
  } catch (e) {
    return toActionError(e, known);
  }
}

export async function deleteOfferAction(productId: string, supplierId: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await db()`delete from product_supplier_offers where product_id = ${productId} and supplier_id = ${supplierId}`;
    await audit(actor.id, "product.supplier_offer_delete", "product", productId, { supplierId });
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Supplier offer removed." };
  } catch (e) {
    return toActionError(e, known);
  }
}

export async function importCsvAction(form: FormData): Promise<ActionResult<ImportPreview>> {
  try {
    const actor = await requireAdmin();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a CSV file." };
    if (file.size > 2 * 1024 * 1024) return { ok: false, message: "CSV files must be 2 MB or smaller." };
    const text = await file.text();
    const r = await importProductsCsv(text, { commit: form.get("commit") === "yes" }, actor);
    if (r.ok && form.get("commit") === "yes") revalidatePath("/", "layout");
    return { ok: true, data: r };
  } catch (e) {
    return toActionError(e, known);
  }
}

function simpleSave(fn: (id: string | null, input: unknown, actor: { id: string }) => Promise<unknown>, path: string) {
  return async (id: string | null, input: unknown): Promise<ActionResult> => {
    try {
      const actor = await requireAdmin();
      await fn(id, input, actor);
      revalidatePath(path);
      revalidatePath("/", "layout");
      return { ok: true, message: "Saved." };
    } catch (e) {
      return toActionError(e, known);
    }
  };
}

export async function saveBrandAction(id: string | null, input: unknown) {
  return simpleSave(saveBrand, "/admin/catalog")(id, input);
}
export async function saveCollectionAction(id: string | null, input: unknown) {
  return simpleSave(saveCollection, "/admin/catalog")(id, input);
}
export async function saveTaxClassAction(id: string | null, input: unknown) {
  return simpleSave(saveTaxClass, "/admin/catalog")(id, input);
}
export async function saveDiscountAction(id: string | null, input: unknown) {
  return simpleSave(saveDiscount, "/admin/discounts")(id, input);
}

export async function saveSupplierAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  let sid: string;
  try {
    const actor = await requireAdmin();
    sid = await saveSupplier(id, input, actor);
    revalidatePath("/admin/suppliers");
  } catch (e) {
    return toActionError(e, known);
  }
  if (!id) redirect(`/admin/suppliers/${sid}`);
  return { ok: true, data: { id: sid }, message: "Supplier saved." };
}

export async function moderateReviewAction(id: string, status: "approved" | "rejected"): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const r = await db()<{ productId: string }[]>`update reviews set status = ${z.enum(["approved", "rejected"]).parse(status)} where id = ${z.uuid().parse(id)} returning product_id`;
    await audit(actor.id, `review.${status}`, "review", id);
    revalidatePath("/admin/reviews");
    if (r[0]) revalidatePath("/products/[slug]", "page");
    return { ok: true, message: `Review ${status}.` };
  } catch (e) {
    return toActionError(e, known);
  }
}
