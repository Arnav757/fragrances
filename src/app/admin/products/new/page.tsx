import { requireAdminPage } from "@/lib/auth/session";
import { listBrandsAdmin, listCollectionsAdmin, listTaxClasses } from "@/lib/services/admin-catalog";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { Notice } from "@/components/ui/misc";

export const metadata = { title: "New product" };

export default async function NewProduct() {
  await requireAdminPage();
  const [brands, collections, taxes] = await Promise.all([listBrandsAdmin(), listCollectionsAdmin(), listTaxClasses()]);
  return (
    <div>
      <PageHeader back={{ href: "/admin/products", label: "Products" }} title="New product" description="Images and supplier offers can be added after the product is created." />
      {brands.length === 0 ? (
        <Notice tone="warning">Create a brand first under Brands, collections &amp; tax.</Notice>
      ) : (
        <ProductForm initial={null} brands={brands} collections={collections} taxClasses={taxes} />
      )}
    </div>
  );
}
