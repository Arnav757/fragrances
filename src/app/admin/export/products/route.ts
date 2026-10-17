import { getCurrentUser } from "@/lib/auth/session";
import { exportProductsRows } from "@/lib/services/admin-catalog";
import { PRODUCT_CSV_HEADERS, toCsv } from "@/lib/csv";
import { audit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/** Exports in the same format the importer accepts (includes confidential supplier columns — admin only). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("Not found", { status: 404 });
  const rows = await exportProductsRows();
  const camel = (h: string) => h.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  await audit(user.id, "export.products", "product", null, { count: rows.length });
  const csv = toCsv([...PRODUCT_CSV_HEADERS], rows.map((r) => PRODUCT_CSV_HEADERS.map((h) => r[camel(h)])));
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
