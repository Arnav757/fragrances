import { cn } from "@/lib/utils";

/** Original emblem: a stopper-and-flacon outline enclosing a monogram stroke. */
export function Emblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden fill="none">
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <path d="M11 22.5V10l10 12.5V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
      <path d="M14.2 6.2h3.6" stroke="#b39457" strokeWidth="1.4" />
    </svg>
  );
}

export function Wordmark({ name, className, tone = "dark" }: { name: string; className?: string; tone?: "dark" | "light" }) {
  const [a, b] = name.includes("&") ? name.split("&").map((s) => s.trim()) : [name, null];
  return (
    <span className={cn("inline-flex items-center gap-2.5", tone === "light" ? "text-paper" : "text-ink", className)}>
      <Emblem />
      <span className="font-display text-[1.35rem] leading-none tracking-[0.22em] whitespace-nowrap">
        {a}
        {b && (
          <>
            <span className="mx-1.5 font-light italic text-gold">&amp;</span>
            {b}
          </>
        )}
      </span>
    </span>
  );
}
