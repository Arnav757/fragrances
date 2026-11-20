import { cn } from "@/lib/utils";

/** Original mark: a tailor's square framing an "F" stroke — form, measured. */
export function Mark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const box = tone === "light" ? "#fbfaf7" : "#121212";
  const stroke = tone === "light" ? "#121212" : "#fbfaf7";
  return (
    <svg viewBox="0 0 28 28" className={cn("h-6 w-6", className)} aria-hidden fill="none">
      <rect x="1" y="1" width="26" height="26" rx="7" fill={box} />
      <path d="M9 20V8h10M9 14h7" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="19.5" r="1.8" fill="#b0502a" />
    </svg>
  );
}

export function Wordmark({ name, className, tone = "dark" }: { name: string; className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", tone === "light" ? "text-paper" : "text-ink", className)}>
      <Mark tone={tone} />
      <span className="font-display text-[1.15rem] font-bold tracking-[0.18em] whitespace-nowrap">{name}</span>
    </span>
  );
}
