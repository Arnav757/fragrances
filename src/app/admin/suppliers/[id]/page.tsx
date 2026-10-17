import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth/session";
import { getSupplier } from "@/lib/services/admin-catalog";
import { PageHeader, Panel } from "@/components/admin/ui";
import { SupplierForm } from "@/components/admin/entity-forms";
import { formatINR } from "@/lib/money";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Supplier" };

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await getSupplier(id);
  if (!data) notFound();
  return (
    <div>
      <PageHeader back={{ href: "/admin/suppliers", label: "Suppliers" }} title={data.supplier.name} />
      <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
        <SupplierForm id={id} initial={data.supplier} />
        <Panel title={`Products supplied (${data.products.length})`}>
          {data.products.length === 0 ? (
            <p className="text-sm text-stone">Add supplier offers from each product&apos;s page.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.products.map((p) => (
                <li key={p.productId} className="flex justify-between gap-3 py-2">
                  <Link href={`/admin/products/${p.productId}`} className="hover:underline">{p.brandName} {p.productName} {p.isPreferred && <Badge tone="gold">Preferred</Badge>}</Link>
                  <span className="text-xs whitespace-nowrap text-stone">{p.supplierSku ?? "—"} · {p.costPaise != null ? formatINR(p.costPaise) : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
