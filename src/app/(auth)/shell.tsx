import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <h1 className="text-center text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-center text-sm text-stone">{subtitle}</p>}
      <div className="mt-8 rounded-2xl border border-line bg-paper p-6 sm:p-8">{children}</div>
      {footer && <div className="mt-6 text-center text-sm text-stone">{footer}</div>}
    </>
  );
}
