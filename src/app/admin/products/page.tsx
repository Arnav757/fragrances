import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { adminListProducts } from "@/lib/services/admin-catalog";
import { AVAILABILITY, AVAILABILITY_LABEL, PRODUCT_TYPE_LABEL } from "@/config/brand";
import { formatINR } from "@/lib/money";
import { PageHeader, Table } from "@/components/admin/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Products" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const rows = await adminListProducts({ q: sp.q, status: sp.status, availability: sp.availability });
  const awaiting = rows.filter((r) => r.availability === "awaiting_supplier_confirmation" && r.isActive).length;
  return (
    <div>
      <PageHeader
        title="Products"
        description={`${rows.length} product${rows.length === 1 ? "" : "s"}${awaiting ? ` · ${awaiting} awaiting supplier confirmation` : ""}`}
        actions={
          <>
            <ButtonLink href="/admin/products/import" variant="outline" size="sm">Import CSV</ButtonLink>
            <ButtonLink href="/admin/export/products" variant="outline" size="sm">Export CSV</ButtonLink>
            <ButtonLink href="/admin/products/new" size="sm">New product</ButtonLink>
          </>
        }
      />
      <form className="mb-6 grid gap-3 sm:grid-cols-4" method="get">
        <Input name="q" placeholder="Search name, brand, slug" defaultValue={sp.q} aria-label="Search products" className="sm:col-span-2" />
        <Select name="availability" defaultValue={sp.availability ?? ""} aria-label="Availability">
          <option value="">Any availability</option>
          {AVAILABILITY.map((a) => <option key={a} value={a}>{AVAILABILITY_LABEL[a]}</option>)}
        </Select>
        <div className="flex gap-2">
          <Select name="status" defaultValue={sp.status ?? ""} aria-label="Visibility">
            <option value="">Visible & hidden</option>
            <option value="active">Visible</option>
            <option value="hidden">Hidden</option>
          </Select>
          <Button type="submit" variant="secondary">Filter</Button>
        </div>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No products" description="Create a product or import a CSV." action={<ButtonLink href="/admin/products/new">New product</ButtonLink>} />
      ) : (
        <Table>
          <thead>
            <tr><th>Product</th><th>Type</th><th>Availability</th><th className="text-right">Price</th><th className="text-right">Supplier cost</th><th className="text-right">Margin (pre-tax est.)</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={p.isActive ? "" : "opacity-60"}>
                <td>
                  <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.brandName} {p.name}</Link>
                  <p className="text-xs text-stone">
                    {p.sizeMl ? `${p.sizeMl} ml · ` : ""}{p.imageCount} image{p.imageCount === 1 ? "" : "s"} · {p.supplierCount} supplier{p.supplierCount === 1 ? "" : "s"}
                    {p.isDemo && <Badge tone="warning" className="ml-2">Demo</Badge>}
                    {!p.isActive && <Badge className="ml-2">Hidden</Badge>}
                  </p>
                </td>
                <td className="text-xs">{PRODUCT_TYPE_LABEL[p.productType]}</td>
                <td className="text-xs">{AVAILABILITY_LABEL[p.availability]}</td>
                <td className="text-right tabular-nums">{formatINR(p.sellingPricePaise)}</td>
                <td className="text-right text-stone tabular-nums">{p.preferredCostPaise != null ? formatINR(p.preferredCostPaise) : "—"}</td>
                <td className="text-right text-stone tabular-nums">{p.preferredCostPaise != null ? formatINR(p.sellingPricePaise - p.preferredCostPaise) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="mt-4 text-xs text-stone">Margin here is selling price minus preferred supplier cost, before GST, shipping, fees and discounts. See the financial report for contribution.</p>
    </div>
  );
}
