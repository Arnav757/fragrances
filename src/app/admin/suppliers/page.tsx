import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { listSuppliers } from "@/lib/services/admin-catalog";
import { PageHeader, Table } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  await requireAdminPage();
  const rows = await listSuppliers();
  return (
    <div>
      <PageHeader title="Suppliers" description="Confidential — never shown to customers." actions={<ButtonLink href="/admin/suppliers/new" size="sm">New supplier</ButtonLink>} />
      {rows.length === 0 ? (
        <EmptyState title="No suppliers yet" action={<ButtonLink href="/admin/suppliers/new">Add your wholesaler</ButtonLink>} />
      ) : (
        <Table>
          <thead><tr><th>Supplier</th><th>Contact</th><th>Dispatch</th><th className="text-right">Products</th><th className="text-right">Open purchases</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/admin/suppliers/${s.id}`} className="font-medium hover:underline">{s.name}</Link> {!s.isActive && <Badge>Inactive</Badge>}</td>
                <td className="text-xs">{s.contactName ?? "—"}<p className="text-stone">{s.phone ?? s.email ?? ""}</p></td>
                <td className="text-xs">{s.dispatchEstimate ?? "—"}</td>
                <td className="text-right">{s.productCount}</td>
                <td className="text-right">{s.openPurchases}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
