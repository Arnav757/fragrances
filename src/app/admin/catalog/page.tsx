import { requireAdminPage } from "@/lib/auth/session";
import { listBrandsAdmin, listCollectionsAdmin, listTaxClasses } from "@/lib/services/admin-catalog";
import { PageHeader, Panel } from "@/components/admin/ui";
import { BrandForm, CollectionForm, TaxClassForm } from "@/components/admin/entity-forms";
import { Badge, Notice } from "@/components/ui/misc";
import { formatRateBp } from "@/lib/money";

export const metadata = { title: "Brands, collections & tax" };

export default async function CatalogPage() {
  await requireAdminPage();
  const [brands, collections, taxes] = await Promise.all([listBrandsAdmin(), listCollectionsAdmin(), listTaxClasses()]);
  return (
    <div className="space-y-8">
      <PageHeader title="Brands, collections & tax" />
      <Panel title="Tax classes (GST)">
        <Notice tone="warning" className="mb-4">
          GST rates and HSN codes are configuration, not legal advice. Confirm each class with your chartered accountant and mark it verified before going live. Rates
          can change — review them periodically.
        </Notice>
        <ul className="divide-y divide-line">
          {taxes.map((t) => (
            <li key={t.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-stone">HSN {t.hsnCode ?? "—"} · {formatRateBp(t.gstRateBp)}</span>
                {t.isVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
              </div>
              {t.notes && <p className="mt-1 text-xs text-stone">{t.notes}</p>}
              <div className="mt-2"><TaxClassForm initial={t} /></div>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-line pt-4"><TaxClassForm /></div>
      </Panel>
      <Panel title={`Brands (${brands.length})`}>
        <ul className="divide-y divide-line">
          {brands.map((b) => (
            <li key={b.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{b.name}</span>
                <span className="text-stone">{b.productCount} products · {b.origin ?? "origin not set"}</span>
                {b.isMiddleEastern && <Badge tone="gold">Middle Eastern</Badge>}
                {!b.isActive && <Badge>Inactive</Badge>}
              </div>
              <div className="mt-2"><BrandForm initial={b} /></div>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-line pt-4"><BrandForm /></div>
      </Panel>
      <Panel title={`Collections (${collections.length})`}>
        <ul className="divide-y divide-line">
          {collections.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-stone">{c.productCount} products · /shop?collection={c.slug}</span>
                {c.isFeatured && <Badge tone="gold">Featured</Badge>}
              </div>
              <div className="mt-2"><CollectionForm initial={c} /></div>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-line pt-4"><CollectionForm /></div>
      </Panel>
    </div>
  );
}
