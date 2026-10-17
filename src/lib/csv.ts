import Papa from "papaparse";

/** Neutralise spreadsheet formula injection when exporting user-controlled text. */
export function csvSafe(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("|") : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return Papa.unparse({ fields: headers, data: rows.map((r) => r.map(csvSafe)) }, { newline: "\r\n" });
}

export function parseCsv(text: string): { rows: Record<string, string>[]; errors: string[] } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return { rows: res.data, errors: res.errors.slice(0, 20).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`) };
}

export const PRODUCT_CSV_HEADERS = [
  "slug",
  "name",
  "brand",
  "product_type",
  "description",
  "size_ml",
  "concentration",
  "fragrance_family",
  "top_notes",
  "heart_notes",
  "base_notes",
  "notes_verified",
  "gender",
  "occasions",
  "selling_price_inr",
  "mrp_inr",
  "mrp_verified",
  "tax_class",
  "availability",
  "is_active",
  "max_per_order",
  "supplier",
  "supplier_sku",
  "supplier_reference",
  "supplier_cost_inr",
  "supplier_cost_includes_gst",
  "supplier_itc_eligible",
] as const;
