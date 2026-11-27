import Link from "next/link";
import { Wordmark } from "./logo";
import { ButtonLink } from "../ui/button";
import { Container } from "../ui/misc";

export function Header({ name }: { name: string }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/70 bg-ivory/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label={`${name} home`}>
          <Wordmark name={name} />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link href="/sample" className="hidden rounded-full px-3 py-2 text-sm text-charcoal hover:bg-sand sm:block">
            Sample report
          </Link>
          <Link href="/about" className="hidden rounded-full px-3 py-2 text-sm text-charcoal hover:bg-sand md:block">
            How it works
          </Link>
          <Link href="/find" className="hidden rounded-full px-3 py-2 text-sm text-charcoal hover:bg-sand md:block">
            Find my report
          </Link>
          <ButtonLink href="/start" size="sm">
            Start free
          </ButtonLink>
        </nav>
      </Container>
    </header>
  );
}
