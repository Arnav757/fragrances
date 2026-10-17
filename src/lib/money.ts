const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format integer paise as Indian rupees, e.g. 249900 -> "₹2,499". */
export function formatINR(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "—";
  return (paise % 100 === 0 ? inrWhole : inrPaise).format(paise / 100);
}

/** Parse a rupee amount typed by an admin ("2,499.50") into paise. Returns null when invalid. */
export function rupeesToPaise(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  const n = typeof input === "number" ? input : Number(String(input).replace(/[,₹\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function paiseToRupeesString(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return (paise / 100).toFixed(2).replace(/\.00$/, "");
}

export function formatRateBp(bp: number): string {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}
