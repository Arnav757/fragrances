import { getCurrentUser } from "@/lib/auth/session";
import { exportOrdersRows } from "@/lib/services/admin-orders";
import { toCsv } from "@/lib/csv";
import { audit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const rows = await exportOrdersRows(valid(url.searchParams.get("from")), valid(url.searchParams.get("to")));
  const headers = rows[0] ? Object.keys(rows[0]) : ["orderNumber"];
  await audit(user.id, "export.orders", "order", null, { count: rows.length });
  const csv = toCsv(headers, rows.map((r) => headers.map((h) => r[h])));
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
