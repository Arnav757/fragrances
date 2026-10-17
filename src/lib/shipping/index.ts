import "server-only";
import { env } from "../env";
import { getSettings, type CommerceSettings } from "../settings";

export type PincodeCheck = {
  pincode: string;
  serviceable: boolean | null; // null = not known without a courier integration
  message: string;
  estimate: { minDays: number; maxDays: number } | null; // only when backed by configured rules or a courier response
  source: "rules" | "shiprocket" | "none";
};

/** Pluggable courier integration. Manual fulfilment works without one. */
export interface ShippingProvider {
  readonly name: string;
  checkServiceability(pincode: string): Promise<{ serviceable: boolean; etdDays: number | null } | null>;
}

/**
 * Shiprocket serviceability check (https://apiv2.shiprocket.in). Implemented against Shiprocket's
 * documented API but NOT verified with live credentials in this project — test before relying on it.
 */
class ShiprocketProvider implements ShippingProvider {
  readonly name = "Shiprocket";
  private token: { value: string; expires: number } | null = null;
  constructor(
    private email: string,
    private password: string,
    private pickupPincode: string,
  ) {}

  private async auth(): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await res.json()) as { token?: string };
    if (!res.ok || !j.token) throw new Error("Shiprocket authentication failed");
    this.token = { value: j.token, expires: Date.now() + 8 * 86400_000 };
    return j.token;
  }

  async checkServiceability(pincode: string) {
    const token = await this.auth();
    const url = new URL("https://apiv2.shiprocket.in/v1/external/courier/serviceability/");
    url.searchParams.set("pickup_postcode", this.pickupPincode);
    url.searchParams.set("delivery_postcode", pincode);
    url.searchParams.set("weight", "0.5");
    url.searchParams.set("cod", "0");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: { available_courier_companies?: { estimated_delivery_days?: string | number }[] } };
    const couriers = j.data?.available_courier_companies ?? [];
    const days = couriers.map((c) => Number(c.estimated_delivery_days)).filter((n) => Number.isFinite(n) && n > 0);
    return { serviceable: couriers.length > 0, etdDays: days.length ? Math.min(...days) : null };
  }
}

let provider: ShippingProvider | null | undefined;
export function shippingProvider(): ShippingProvider | null {
  if (provider !== undefined) return provider;
  const e = env();
  provider =
    e.SHIPROCKET_EMAIL && e.SHIPROCKET_PASSWORD && e.SHIPROCKET_PICKUP_PINCODE
      ? new ShiprocketProvider(e.SHIPROCKET_EMAIL, e.SHIPROCKET_PASSWORD, e.SHIPROCKET_PICKUP_PINCODE)
      : null;
  return provider;
}

/** Rule-based check (pure, unit-tested). */
export function checkPincodeRules(pincode: string, c: CommerceSettings): PincodeCheck {
  const estimate =
    c.deliveryEstimateMinDays && c.deliveryEstimateMaxDays
      ? { minDays: c.deliveryEstimateMinDays, maxDays: Math.max(c.deliveryEstimateMinDays, c.deliveryEstimateMaxDays) }
      : null;
  if (!/^[1-9]\d{5}$/.test(pincode)) return { pincode, serviceable: false, message: "Enter a valid 6-digit PIN code.", estimate: null, source: "rules" };
  if (c.blockedPincodes.includes(pincode)) {
    return { pincode, serviceable: false, message: "Sorry, we can't deliver to this PIN code at the moment.", estimate: null, source: "rules" };
  }
  if (c.serviceablePrefixes.length) {
    const ok = c.serviceablePrefixes.some((p) => pincode.startsWith(p));
    return ok
      ? { pincode, serviceable: true, message: "We deliver to this PIN code.", estimate, source: "rules" }
      : { pincode, serviceable: false, message: "Sorry, we don't deliver to this PIN code yet.", estimate: null, source: "rules" };
  }
  return {
    pincode,
    serviceable: null,
    message: "We ship across India. Serviceability for this PIN code is confirmed with the courier before dispatch — if we can't deliver, you'll get a full refund.",
    estimate,
    source: "none",
  };
}

export async function checkPincode(pincode: string): Promise<PincodeCheck> {
  const commerce = await getSettings("commerce");
  const ruled = checkPincodeRules(pincode, commerce);
  if (ruled.serviceable === false) return ruled;
  const p = shippingProvider();
  if (!p) return ruled;
  try {
    const r = await p.checkServiceability(pincode);
    if (!r) return ruled;
    return {
      pincode,
      serviceable: r.serviceable,
      message: r.serviceable ? "Courier delivery is available to this PIN code." : "Sorry, couriers don't currently deliver to this PIN code.",
      estimate: r.serviceable && r.etdDays ? { minDays: r.etdDays, maxDays: r.etdDays + 2 } : ruled.estimate,
      source: "shiprocket",
    };
  } catch {
    return ruled;
  }
}
