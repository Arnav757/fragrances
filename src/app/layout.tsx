import type { Metadata, Viewport } from "next";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";
import "@fontsource-variable/inter-tight";
import "./globals.css";
import { Toaster } from "sonner";
import { brand } from "@/config/brand";
import { getSettings, storeName } from "@/lib/settings";
import { env } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getSettings("store").catch(() => null);
  const name = store ? storeName(store) : brand.name;
  return {
    metadataBase: new URL(env().SITE_URL),
    title: { default: `${name} — Middle Eastern fragrances, honestly priced`, template: `%s | ${name}` },
    description: brand.description,
    applicationName: name,
    openGraph: { type: "website", siteName: name, locale: "en_IN", description: brand.description },
    twitter: { card: "summary_large_image" },
    robots: env().APP_ENV === "production" ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#f6f1e8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-none !border-line !bg-paper !text-ink !font-sans !shadow-lg",
              description: "!text-stone",
            },
          }}
        />
      </body>
    </html>
  );
}
