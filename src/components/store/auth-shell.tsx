import type { ReactNode } from "react";
import { Container } from "../ui/misc";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Container size="narrow" className="py-16 lg:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="text-center text-4xl text-ink">{title}</h1>
        {subtitle && <p className="mt-3 text-center text-sm text-stone">{subtitle}</p>}
        <div className="mt-10 border border-line bg-paper p-6 sm:p-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-stone">{footer}</div>}
      </div>
    </Container>
  );
}
