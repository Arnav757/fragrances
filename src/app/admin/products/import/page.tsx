import { requireAdminPage } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { ImportForm } from "@/components/admin/import-form";
import { PRODUCT_CSV_HEADERS } from "@/lib/csv";
import { AVAILABILITY, CONCENTRATIONS, FAMILIES, GENDERS, OCCASIONS, PRODUCT_TYPES } from "@/config/brand";

export const metadata = { title: "Import products" };

export default async function ImportPage() {
  await requireAdminPage();
  return (
    <div className="max-w-4xl">
      <PageHeader back={{ href: "/admin/products", label: "Products" }} title="Import products from CSV" description="Rows are matched on slug: existing products are updated, new ones created. The import is all-or-nothing." />
      <div className="mb-8 space-y-3 text-sm text-charcoal">
        <p>
          <a href="/templates/product-import-template.csv" className="underline" download>Download the template</a> — or export your current products, edit, and re-import.
        </p>
        <details className="border border-line bg-paper p-4">
          <summary className="cursor-pointer font-medium">Column reference</summary>
          <ul className="mt-3 space-y-1 text-xs leading-relaxed">
            <li><strong>Columns:</strong> {PRODUCT_CSV_HEADERS.join(", ")}</li>
            <li><strong>Required:</strong> slug, name, brand, product_type, selling_price_inr, availability. Brands are created if missing; suppliers and tax classes must already exist.</li>
            <li><strong>product_type:</strong> {PRODUCT_TYPES.join(", ")}</li>
            <li><strong>availability:</strong> {AVAILABILITY.join(", ")}</li>
            <li><strong>concentration:</strong> {CONCENTRATIONS.join(", ")}</li>
            <li><strong>fragrance_family:</strong> {FAMILIES.join(", ")}</li>
            <li><strong>gender:</strong> {GENDERS.join(", ")}</li>
            <li><strong>occasions / notes:</strong> separate multiple values with | (e.g. {OCCASIONS.slice(0, 2).join("|")})</li>
            <li><strong>true/false columns:</strong> notes_verified, mrp_verified, is_active, supplier_cost_includes_gst, supplier_itc_eligible</li>
            <li>Prices are in rupees. Only fill notes and MRP you have verified.</li>
          </ul>
        </details>
      </div>
      <ImportForm />
    </div>
  );
}
