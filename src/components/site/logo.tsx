import { cn } from "@/lib/utils";

/** The F. mark: a square-cornered F with a separate signal-orange dot (forma_mark_primary.svg geometry). */
export function Mark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <svg viewBox="0 0 352 463" className={cn("h-6 w-auto", className)} aria-hidden>
      <path fill={tone === "light" ? "#ffffff" : "#17191D"} d="M0 0H352V93H109V182H306V275H109V463H0Z" />
      <circle cx="281" cy="414" r="50" fill="#FF4F2A" />
    </svg>
  );
}

export function Wordmark({ name, className, tone = "dark" }: { name: string; className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", tone === "light" ? "text-white" : "text-ink", className)}>
      <Mark tone={tone} className="h-[1.35rem]" />
      <span className="font-display text-[1.15rem] font-extrabold tracking-[0.14em] whitespace-nowrap">{name}</span>
    </span>
  );
}
