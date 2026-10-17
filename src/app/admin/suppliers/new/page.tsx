import { requireAdminPage } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { SupplierForm } from "@/components/admin/entity-forms";

export const metadata = { title: "New supplier" };

export default async function NewSupplier() {
  await requireAdminPage();
  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/admin/suppliers", label: "Suppliers" }} title="New supplier" />
      <SupplierForm id={null} />
    </div>
  );
}
