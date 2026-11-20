import type { Metadata } from "next";
import { Container } from "@/components/ui/misc";
import { FindForm } from "@/components/report/small-forms";

export const metadata: Metadata = { title: "Find my report", robots: { index: false } };

export default function FindPage() {
  return (
    <Container size="narrow" className="py-16 lg:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-center text-4xl">Find my report</h1>
        <p className="mt-3 text-center text-sm text-stone">Enter the email you used and we&apos;ll send you every report link linked to it.</p>
        <div className="mt-10 rounded-2xl border border-line bg-paper p-6 sm:p-8">
          <FindForm />
        </div>
      </div>
    </Container>
  );
}
