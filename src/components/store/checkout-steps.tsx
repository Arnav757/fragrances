import { cn } from "@/lib/utils";

const steps = ["Cart", "Details", "Payment", "Confirmation"];

export function CheckoutSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 text-[0.6875rem] tracking-[0.12em] uppercase sm:gap-4" aria-label="Checkout progress">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2 sm:gap-4" aria-current={i === current ? "step" : undefined}>
          <span className={cn(i === current ? "text-ink" : i < current ? "text-stone" : "text-mist")}>{s}</span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-line sm:w-10" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
