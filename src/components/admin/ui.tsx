import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-xs text-stone hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-3xl text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warning" }) {
  return (
    <div className={cn("rounded-2xl border bg-paper p-5", tone === "warning" ? "border-warning/40" : "border-line")}>
      <p className="text-[0.6875rem] tracking-[0.14em] text-stone uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone">{hint}</p>}
    </div>
  );
}

export function Panel({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-paper", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          {title && <h2 className="text-[0.6875rem] font-medium tracking-[0.14em] text-ink uppercase">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:tracking-[0.1em] [&_th]:text-stone [&_th]:uppercase">
        {children}
      </table>
    </div>
  );
}

const ANALYSIS_TONE: Record<string, [string, string]> = {
  preview: ["Preview (unpaid)", "bg-sand text-stone"],
  paid: ["Needs review", "bg-warning/10 text-warning"],
  revision_requested: ["Revision requested", "bg-danger/10 text-danger"],
  released: ["Released", "bg-success/10 text-success"],
};

export function AnalysisStatusBadge({ status }: { status: string }) {
  const [label, tone] = ANALYSIS_TONE[status] ?? [status, "bg-sand text-stone"];
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap", tone)}>{label}</span>;
}

const ORDER_TONE: Record<string, string> = {
  paid: "text-success",
  awaiting_payment: "text-warning",
  payment_failed: "text-danger",
  expired: "text-stone",
  refunded: "text-stone",
};

export function OrderStatusText({ status }: { status: string }) {
  return <span className={cn("text-xs whitespace-nowrap", ORDER_TONE[status])}>{status.replace(/_/g, " ")}</span>;
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-stone">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
