import Link from "next/link";
import { Wordmark } from "@/components/site/logo";
import { brand } from "@/config/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="mb-10" aria-label="Home">
        <Wordmark name={brand.name} />
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
