"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";

export default function StoreError({ reset, error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container size="narrow" className="py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-4 text-5xl text-ink">We couldn&apos;t load this page</h1>
      <p className="mx-auto mt-4 max-w-md text-sm text-stone">Please try again. If the problem continues, contact us{error.digest ? ` and mention reference ${error.digest}` : ""}.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="outline">Home</ButtonLink>
      </div>
    </Container>
  );
}
