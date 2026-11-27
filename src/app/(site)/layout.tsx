import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { DevBanner } from "@/components/site/dev-banner";
import { getSettings, storeName } from "@/lib/settings";

// Brand name, prices and policy pages are editable in the studio, so pages render per request.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const store = await getSettings("store");
  const name = storeName(store);
  return (
    <>
      <DevBanner />
      <Header name={name} />
      <main id="main">{children}</main>
      <Footer name={name} supportEmail={store.supportEmail} instagram={store.instagram} legalName={store.legalBusinessName || name} />
    </>
  );
}
