import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <Container size="narrow" className="py-24 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-4 text-5xl text-ink">This page has evaporated</h1>
      <p className="mx-auto mt-4 max-w-md text-sm text-stone">The page you&apos;re looking for doesn&apos;t exist or is no longer available.</p>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/shop">Shop fragrances</ButtonLink>
        <ButtonLink href="/" variant="outline">Home</ButtonLink>
      </div>
    </Container>
  );
}
