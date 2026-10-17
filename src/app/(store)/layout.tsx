import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { DevBanner } from "@/components/store/dev-banner";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <DevBanner />
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
