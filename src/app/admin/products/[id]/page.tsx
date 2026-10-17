import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth/session";
import { adminGetProduct, listBrandsAdmin, listCollectionsAdmin, listSuppliers, listTaxClasses } from "@/lib/services/admin-catalog";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ImageManager, OfferManager, ProductForm } from "@/components/admin/product-form";
import { Notice } from "@/components/ui/misc";

export const metadata = { title: "Edit product" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const { created } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const [data, brands, collections, taxes, suppliers] = await Promise.all([adminGetProduct(id), listBrandsAdmin(), listCollectionsAdmin(), listTaxClasses(), listSuppliers()]);
  if (!data) notFound();
  const p = data.product;
  return (
    <div>
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title={p.name}
        description={<>/{p.slug} · {p.isActive ? <Link href={`/products/${p.slug}`} className="underline" target="_blank">View on store</Link> : "Hidden from the store"}</>}
      />
      {created && <Notice tone="success" className="mb-6">Product created. Add images and a supplier offer below.</Notice>}
      {p.isDemo && <Notice tone="warning" className="mb-6">This is a demo product. Replace or archive it before launch.</Notice>}
      <div className="grid gap-8 2xl:grid-cols-[1fr_440px]">
        <ProductForm initial={{ ...p, id }} brands={brands} collections={collections} taxClasses={taxes} />
        <div className="space-y-6">
          <Panel title="Images"><ImageManager productId={id} images={data.images} /></Panel>
          <Panel title="Suppliers & costs (confidential)">
            <OfferManager productId={id} offers={data.offers} suppliers={suppliers.filter((s) => s.isActive)} sellingPricePaise={p.sellingPricePaise} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
