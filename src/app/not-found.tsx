import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-4 text-5xl text-ink">Page not found</h1>
      <Link href="/" className="mt-8 text-sm underline underline-offset-4">Return home</Link>
    </main>
  );
}
