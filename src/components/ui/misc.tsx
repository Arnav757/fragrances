import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ children, className, size = "default" }: { children: ReactNode; className?: string; size?: "default" | "narrow" | "wide" }) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-10", size === "narrow" ? "max-w-3xl" : size === "wide" ? "max-w-[1440px]" : "max-w-7xl", className)}>
      {children}
    </div>
  );
}

type Tone = "neutral" | "gold" | "success" | "danger" | "warning" | "dark" | "outline";
const tones: Record<Tone, string> = {
  neutral: "bg-sand text-charcoal",
  gold: "bg-gold-soft text-gold-deep",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  dark: "bg-ink text-paper",
  outline: "border border-line text-stone",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide", tones[tone], className)}>{children}</span>
  );
}

export function SectionHeading({ eyebrow, title, description, action, className, align = "left" }: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between", align === "center" && "items-center text-center sm:flex-col sm:items-center", className)}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className="text-3xl leading-[1.1] text-ink sm:text-[2.6rem]">{title}</h2>
        {description && <p className="mt-3 text-sm leading-relaxed text-stone sm:text-[0.95rem]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center border border-dashed border-line bg-paper/60 px-6 py-16 text-center">
      {icon && <div className="mb-4 text-mist">{icon}</div>}
      <h3 className="text-2xl text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-stone">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "neutral", title, children, className }: { tone?: "neutral" | "warning" | "danger" | "success"; title?: string; children: ReactNode; className?: string }) {
  const t = {
    neutral: "border-line bg-paper text-charcoal",
    warning: "border-warning/30 bg-warning/5 text-charcoal",
    danger: "border-danger/30 bg-danger/5 text-charcoal",
    success: "border-success/30 bg-success/5 text-charcoal",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("border px-4 py-3 text-sm leading-relaxed", t, className)}>
      {title && <p className="mb-0.5 font-medium text-ink">{title}</p>}
      {children}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-stone">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {it.href ? (
              <Link href={it.href} className="hover:text-ink">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-charcoal">
                {it.label}
              </span>
            )}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}
