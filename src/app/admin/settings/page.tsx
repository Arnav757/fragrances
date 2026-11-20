import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/admin/ui";
import { PagesForm, PricingForm, PrivacyForm, ShopForm, StoreForm } from "@/components/admin/forms";
import { requireAdminPage } from "@/lib/auth/session";
import { getPages, getSettings } from "@/lib/settings";
import { PAGE_META } from "@/lib/default-pages";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPage();
  const [store, pricing, shop, privacy, pages] = await Promise.all([getSettings("store"), getSettings("pricing"), getSettings("shop"), getSettings("privacy"), getPages()]);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Panel title="Business"><StoreForm v={store} /></Panel>
        <Panel title="Pricing & review times"><PricingForm v={pricing} /></Panel>
        <Panel title="Shop links"><ShopForm v={shop} /></Panel>
        <Panel title="Privacy & retention"><PrivacyForm v={privacy} /></Panel>
        <Panel title="Pages"><PagesForm pages={pages} labels={Object.fromEntries(Object.entries(PAGE_META).map(([k, m]) => [k, m.title]))} /></Panel>
      </div>
    </>
  );
}
