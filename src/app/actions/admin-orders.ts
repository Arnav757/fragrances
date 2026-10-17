"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import {
  changeOrderStatus,
  createSupplierPurchase,
  FulfillmentError,
  markCodCollected,
  markPurchaseConfirmed,
  markPurchaseOrdered,
  recordPurchaseIssue,
  recordRefund,
  recordShipment,
  resolveRequest,
  supplierOrderMessage,
  updatePurchaseCosts,
} from "@/lib/services/fulfillment";
import { audit } from "@/lib/services/audit";
import { ORDER_STATUSES } from "@/lib/order-status";
import { toActionError, type ActionResult } from "@/lib/forms";
import { db } from "@/lib/db";

const known = [FulfillmentError];
const id = z.uuid();

async function run<T>(orderId: string | null, fn: (actor: { id: string }) => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const actor = await requireAdmin();
    const data = await fn(actor);
    if (orderId) revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin");
    return { ok: true, data, message };
  } catch (e) {
    return toActionError(e, known);
  }
}

export async function changeStatusAction(orderId: string, to: string, note: string, notify: boolean) {
  return run(orderId, (a) => changeOrderStatus(id.parse(orderId), z.enum(ORDER_STATUSES).parse(to), a, note.slice(0, 500) || null, notify), "Status updated.");
}

export async function createPurchaseAction(orderId: string, input: unknown) {
  return run(orderId, (a) => createSupplierPurchase(id.parse(orderId), input as never, a), "Supplier purchase recorded as draft.");
}

export async function markOrderedAction(orderId: string, poId: string, supplierReference: string, confirmDataShare: boolean) {
  return run(orderId, (a) => markPurchaseOrdered(id.parse(poId), { supplierReference, confirmDataShare }, a), "Marked as ordered with supplier.");
}

export async function markConfirmedAction(orderId: string, poId: string) {
  return run(orderId, (a) => markPurchaseConfirmed(id.parse(poId), a), "Supplier confirmation recorded.");
}

export async function recordShipmentAction(orderId: string, input: unknown) {
  return run(orderId, (a) => recordShipment(id.parse(orderId), input as never, a), "Shipment recorded.");
}

export async function purchaseIssueAction(orderId: string, poId: string, issue: string, cancel: boolean) {
  return run(orderId, (a) => recordPurchaseIssue(id.parse(poId), issue, cancel, a), "Issue recorded.");
}

export async function updateCostsAction(orderId: string, poId: string, input: unknown) {
  return run(orderId, (a) => updatePurchaseCosts(id.parse(poId), input as never, a), "Costs updated.");
}

/** Returns the supplier message text. Copying it is logged, as it contains customer delivery details. */
export async function supplierMessageAction(orderId: string, poId: string) {
  return run(orderId, async (a) => {
    const text = await supplierOrderMessage(id.parse(poId));
    await audit(a.id, "supplier_po.message_copied", "supplier_purchase_order", poId, { orderId });
    return text;
  });
}

export async function refundAction(orderId: string, input: unknown) {
  return run(orderId, (a) => recordRefund(id.parse(orderId), input as never, a), "Refund recorded.");
}

export async function resolveRequestAction(orderId: string, requestId: string, decision: "approved" | "rejected", note: string) {
  return run(orderId, (a) => resolveRequest(id.parse(requestId), z.enum(["approved", "rejected"]).parse(decision), note.slice(0, 500), a), "Request updated.");
}

export async function codCollectedAction(orderId: string) {
  return run(orderId, (a) => markCodCollected(id.parse(orderId), a), "COD marked as collected.");
}

export async function saveInternalNotesAction(orderId: string, notes: string) {
  return run(orderId, async (a) => {
    await db()`update orders set internal_notes = ${notes.slice(0, 5000) || null} where id = ${id.parse(orderId)}`;
    await audit(a.id, "order.notes", "order", orderId, {});
  }, "Notes saved.");
}
