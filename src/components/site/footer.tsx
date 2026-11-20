import Link from "next/link";
import { Wordmark } from "./logo";
import { Container } from "../ui/misc";

export function Footer({ name, supportEmail, instagram, legalName }: { name: string; supportEmail: string; instagram: string; legalName: string }) {
  const links = [
    ["/start", "Start your analysis"],
    ["/sample", "Sample report"],
    ["/about", "How it works"],
    ["/find", "Find my report"],
    ["/contact", "Contact"],
    ["/privacy", "Privacy"],
    ["/terms", "Terms"],
    ["/refunds", "Refunds"],
  ];
  return (
    <footer className="no-print mt-24 bg-night text-paper/75">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.2fr_2fr]">
        <div>
          <Wordmark name={name} tone="light" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/60">Personal styling for men who&apos;d rather know than guess. Built in India, for Indian men.</p>
          {supportEmail && (
            <a href={`mailto:${supportEmail}`} className="mt-4 inline-block text-sm text-paper hover:underline">
              {supportEmail}
            </a>
          )}
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-paper">
              {label}
            </Link>
          ))}
          {instagram && (
            <a href={instagram} className="hover:text-paper" rel="noopener noreferrer" target="_blank">
              Instagram
            </a>
          )}
        </nav>
      </Container>
      <Container className="border-t border-paper/10 py-6 text-xs text-paper/45">
        © {new Date().getFullYear()} {legalName}. Style guidance, not a guarantee — results depend on the photos and answers you give us.
      </Container>
    </footer>
  );
}
