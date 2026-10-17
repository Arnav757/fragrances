import "server-only";
import { env } from "../env";
import { hmacSha256Hex, randomToken, safeEqual } from "../auth/crypto";

export type GatewayPayment = {
  id: string;
  orderId: string | null;
  amountPaise: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string | null;
  feePaise: number | null;
  feeTaxPaise: number | null;
  errorCode: string | null;
  errorDescription: string | null;
  raw: unknown;
};

export interface PaymentGateway {
  readonly provider: "razorpay" | "mock";
  readonly publicKeyId: string;
  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  verifyCheckoutSignature(gatewayOrderId: string, paymentId: string, signature: string): boolean;
  fetchPayment(paymentId: string, expectedAmountPaise: number): Promise<GatewayPayment>;
  refund(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<{ id: string; status: string }>;
}

export class GatewayError extends Error {}

/** Checkout signature per Razorpay docs: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function checkoutSignature(secret: string, gatewayOrderId: string, paymentId: string): string {
  return hmacSha256Hex(secret, `${gatewayOrderId}|${paymentId}`);
}

/** Webhook signature per Razorpay docs: HMAC_SHA256(raw request body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  return safeEqual(hmacSha256Hex(secret, rawBody), signature);
}

class RazorpayGateway implements PaymentGateway {
  readonly provider = "razorpay" as const;
  constructor(
    readonly publicKeyId: string,
    private readonly secret: string,
  ) {}

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: "Basic " + Buffer.from(`${this.publicKeyId}:${this.secret}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T;
    if (!res.ok) throw new GatewayError(json.error?.description ?? `Razorpay request failed (${res.status})`);
    return json;
  }

  async createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
    const o = await this.call<{ id: string }>("POST", "/orders", {
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    });
    return { id: o.id };
  }

  verifyCheckoutSignature(gatewayOrderId: string, paymentId: string, signature: string) {
    return safeEqual(checkoutSignature(this.secret, gatewayOrderId, paymentId), signature);
  }

  async fetchPayment(paymentId: string): Promise<GatewayPayment> {
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new GatewayError("Invalid payment id");
    const p = await this.call<{
      id: string;
      order_id: string | null;
      amount: number;
      currency: string;
      status: GatewayPayment["status"];
      method: string | null;
      fee: number | null;
      tax: number | null;
      error_code: string | null;
      error_description: string | null;
    }>("GET", `/payments/${paymentId}`);
    return {
      id: p.id,
      orderId: p.order_id,
      amountPaise: p.amount,
      currency: p.currency,
      status: p.status,
      method: p.method,
      feePaise: p.fee ?? null,
      feeTaxPaise: p.tax ?? null,
      errorCode: p.error_code,
      errorDescription: p.error_description,
      raw: p,
    };
  }

  async refund(paymentId: string, amountPaise: number, notes: Record<string, string>) {
    const r = await this.call<{ id: string; status: string }>("POST", `/payments/${paymentId}/refund`, { amount: amountPaise, notes });
    return { id: r.id, status: r.status };
  }
}

/**
 * Local/test-only simulated gateway. It exercises exactly the same server-side verification code
 * path (HMAC signature + amount check) but moves no money. Refuses to exist when APP_ENV=production.
 */
class MockGateway implements PaymentGateway {
  readonly provider = "mock" as const;
  readonly publicKeyId = "mock_key";
  constructor(private readonly secret: string) {}

  async createOrder() {
    return { id: `mock_order_${randomToken(10).replace(/[^A-Za-z0-9]/g, "")}` };
  }
  verifyCheckoutSignature(gatewayOrderId: string, paymentId: string, signature: string) {
    return safeEqual(checkoutSignature(this.secret, gatewayOrderId, paymentId), signature);
  }
  /** Simulates the browser-side checkout: produces a payment id and a valid signature. */
  simulate(gatewayOrderId: string) {
    const paymentId = `mock_pay_${randomToken(10).replace(/[^A-Za-z0-9]/g, "")}`;
    return { paymentId, signature: checkoutSignature(this.secret, gatewayOrderId, paymentId) };
  }
  async fetchPayment(paymentId: string, expectedAmountPaise: number): Promise<GatewayPayment> {
    return {
      id: paymentId,
      orderId: null,
      amountPaise: expectedAmountPaise,
      currency: "INR",
      status: "captured",
      method: "simulated",
      feePaise: 0,
      feeTaxPaise: 0,
      errorCode: null,
      errorDescription: null,
      raw: { simulated: true },
    };
  }
  async refund() {
    return { id: `mock_rfnd_${randomToken(8).replace(/[^A-Za-z0-9]/g, "")}`, status: "processed" };
  }
}

export function getGateway(): PaymentGateway | null {
  const e = env();
  if (e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET) return new RazorpayGateway(e.RAZORPAY_KEY_ID, e.RAZORPAY_KEY_SECRET);
  if (e.ENABLE_MOCK_PAYMENTS && e.APP_ENV !== "production") return new MockGateway(hmacSha256Hex(e.APP_SECRET, "mock-gateway"));
  return null;
}

export function getMockGateway(): MockGateway | null {
  const g = getGateway();
  return g instanceof MockGateway ? g : null;
}
