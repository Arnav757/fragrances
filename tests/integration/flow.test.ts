import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { SAMPLE_QUIZ } from "@/lib/style/quiz";
import {
  AnalysisError,
  applyStylistOverrides,
  createAnalysis,
  customerView,
  getAnalysisByToken,
  releaseReport,
  requestRevision,
  runRetention,
  saveStylistNote,
  sendLinksForEmail,
  updateOutfit,
} from "@/lib/services/analyses";
import { confirmCheckoutPayment, createOrder, ensureGatewayOrder, handleRazorpayWebhook, markOrderPaid, PaymentError, quote } from "@/lib/services/payments";
import { checkoutSignature } from "@/lib/payments/gateway";
import { getMockGateway } from "@/lib/payments/gateway";
import { hmacSha256Hex } from "@/lib/auth/crypto";
import { saveSettings } from "@/lib/settings";

const checkout = (over: Record<string, unknown> = {}) => ({
  contactName: "Test Buyer",
  email: "buyer@example.com",
  phone: "+91 98765 43210",
  plan: "standard",
  discountCode: "",
  marketingConsent: false,
  acceptTerms: true,
  ...over,
});

async function newAnalysis(quiz = SAMPLE_QUIZ) {
  return createAnalysis({ quiz, headshot: null, fullbody: null, photoConsent: false, source: { utm_source: "instagram" } });
}

async function pay(token: string, over: Record<string, unknown> = {}) {
  const o = await createOrder(token, checkout(over));
  const g = await ensureGatewayOrder(o.orderId);
  const sim = getMockGateway()!.simulate(g.gatewayOrderId);
  const r = await confirmCheckoutPayment({ orderId: o.orderId, gatewayOrderId: g.gatewayOrderId, paymentId: sim.paymentId, signature: sim.signature });
  return { ...o, gatewayOrderId: g.gatewayOrderId, paymentId: sim.paymentId, result: r };
}

async function staff() {
  const r = await db()<{ id: string }[]>`
    insert into profiles (email, password_hash, full_name, role) values ('stylist@example.com', 'x', 'Meera', 'stylist')
    on conflict (email) do update set role = excluded.role returning id`;
  return r[0]!.id;
}

beforeAll(async () => {
  await db()`delete from settings`;
});

describe("creating an analysis", () => {
  it("builds a quiz-based report and a secret link without storing the raw token", async () => {
    const a = await newAnalysis();
    expect(a.ref).toMatch(/^FM-\d+$/);
    expect(a.observationSource).toBe("quiz");
    const row = await getAnalysisByToken(a.token);
    expect(row?.status).toBe("preview");
    expect(row?.source).toEqual({ utmSource: "instagram" }); // postgres.js camelCases JSON keys on read
    const raw = await db()<{ tokenHash: string; tokenSealed: string }[]>`select token_hash, token_sealed from analyses where id = ${a.id}`;
    expect(raw[0]!.tokenHash).not.toContain(a.token);
    expect(raw[0]!.tokenSealed).not.toContain(a.token);
    expect(await getAnalysisByToken("not-a-real-token")).toBeNull();
    expect(await getAnalysisByToken("../../etc")).toBeNull();
  });

  it("rejects invalid answers and photos without consent", async () => {
    await expect(createAnalysis({ quiz: { ...SAMPLE_QUIZ, heightCm: 20 }, headshot: null, fullbody: null, photoConsent: false })).rejects.toThrow();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "a.jpg", { type: "image/jpeg" });
    await expect(createAnalysis({ quiz: SAMPLE_QUIZ, headshot: file, fullbody: null, photoConsent: false })).rejects.toThrow(AnalysisError);
  });

  it("rejects files that aren't really images, whatever they claim to be", async () => {
    const fake = new File([new TextEncoder().encode("<script>alert(1)</script>")], "a.jpg", { type: "image/jpeg" });
    await expect(createAnalysis({ quiz: SAMPLE_QUIZ, headshot: fake, fullbody: null, photoConsent: true })).rejects.toThrow(/JPEG, PNG or WebP/);
  });

  it("stores real photos privately and records why AI wasn't used", async () => {
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const a = await createAnalysis({ quiz: SAMPLE_QUIZ, headshot: new File([png], "h.png"), fullbody: null, photoConsent: true });
    const row = await getAnalysisByToken(a.token);
    expect(row?.headshotPath).toMatch(/^local:\d{4}-\d{2}\/[A-Za-z0-9]+\.png$/);
    expect(row?.aiNotes).toMatch(/not configured/);
  });

  it("shows unpaid customers only the preview", async () => {
    const a = await newAnalysis();
    const v = customerView((await getAnalysisByToken(a.token))!);
    expect(v.kind).toBe("preview");
    expect(JSON.stringify(v)).not.toContain('"avoidList"');
  });
});

describe("payment", () => {
  it("prices on the server and applies discount codes", async () => {
    await db()`insert into discounts (code, type, value) values ('INSTA20', 'percent', 2000) on conflict do nothing`;
    const q = await quote("standard", "insta20");
    expect(q.listPaise).toBe(149900);
    expect(q.discountPaise).toBe(29980);
    expect(q.totalPaise).toBe(119920);
    expect(q.taxPaise).toBe(18293);
    await expect(quote("standard", "NOPE")).rejects.toThrow(PaymentError);
  });

  it("unlocks the report, starts the review clock and emails the link", async () => {
    const a = await newAnalysis();
    const p = await pay(a.token, { plan: "priority", discountCode: "INSTA20" });
    expect(p.result.result).toBe("paid");
    const row = (await getAnalysisByToken(a.token))!;
    expect(row.status).toBe("paid");
    expect(row.plan).toBe("priority");
    expect(row.email).toBe("buyer@example.com");
    expect(row.phone).toBe("9876543210");
    expect(row.dueAt!.getTime() - row.paidAt!.getTime()).toBeCloseTo(24 * 3600_000, -4);
    expect(customerView(row).kind).toBe("full");
    const used = await db()<{ usedCount: number }[]>`select used_count from discounts where code = 'INSTA20'`;
    expect(used[0]!.usedCount).toBeGreaterThanOrEqual(1);
    const mail = await db()<{ template: string; textBody: string }[]>`select template, text_body from email_outbox where analysis_id = ${a.id}`;
    expect(mail.map((m) => m.template)).toContain("payment_confirmation");
    expect(mail[0]!.textBody).toContain(`/s/${a.token}`);
  });

  it("is idempotent across callback and webhook", async () => {
    const a = await newAnalysis();
    const p = await pay(a.token);
    const again = await markOrderPaid(p.gatewayOrderId, { id: p.paymentId, orderId: p.gatewayOrderId, amountPaise: p.totalPaise, currency: "INR", status: "captured", method: "upi", feePaise: null, feeTaxPaise: null, errorCode: null, errorDescription: null, raw: {} }, "mock");
    expect(again.result).toBe("already_paid");
    const n = await db()<{ n: number }[]>`select count(*)::int as n from payments where provider_payment_id = ${p.paymentId}`;
    expect(n[0]!.n).toBe(1);
  });

  it("rejects bad signatures and amount mismatches", async () => {
    const a = await newAnalysis();
    const o = await createOrder(a.token, checkout());
    const g = await ensureGatewayOrder(o.orderId);
    await expect(confirmCheckoutPayment({ orderId: o.orderId, gatewayOrderId: g.gatewayOrderId, paymentId: "mock_pay_x", signature: "deadbeef" })).rejects.toThrow(/signature/);
    await expect(
      markOrderPaid(g.gatewayOrderId, { id: "pay_wrong", orderId: g.gatewayOrderId, amountPaise: 100, currency: "INR", status: "captured", method: null, feePaise: null, feeTaxPaise: null, errorCode: null, errorDescription: null, raw: {} }, "mock"),
    ).rejects.toThrow(/amount/);
    expect((await getAnalysisByToken(a.token))!.status).toBe("preview");
  });

  it("flags a second payment on an already-unlocked report for refund", async () => {
    const a = await newAnalysis();
    const o2 = await createOrder(a.token, checkout());
    const g2 = await ensureGatewayOrder(o2.orderId);
    await pay(a.token);
    const sim = getMockGateway()!.simulate(g2.gatewayOrderId);
    const r = await confirmCheckoutPayment({ orderId: o2.orderId, gatewayOrderId: g2.gatewayOrderId, paymentId: sim.paymentId, signature: sim.signature });
    expect(r.result).toBe("duplicate_payment");
    const ev = await db()<{ message: string }[]>`select message from analysis_events where analysis_id = ${a.id} and message like 'ACTION NEEDED%'`;
    expect(ev).toHaveLength(1);
    await expect(createOrder(a.token, checkout())).rejects.toThrow(/already unlocked/);
  });

  it("verifies webhook signatures and deduplicates events", async () => {
    const a = await newAnalysis();
    const o = await createOrder(a.token, checkout());
    const g = await ensureGatewayOrder(o.orderId);
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_hook1", order_id: g.gatewayOrderId, amount: o.totalPaise, currency: "INR", status: "captured", method: "upi" } } } });
    expect((await handleRazorpayWebhook(body, "bad", "evt_1")).status).toBe(401);
    const sig = hmacSha256Hex("test-webhook-secret", body);
    expect((await handleRazorpayWebhook(body, sig, "evt_1")).body).toBe("ok");
    expect((await handleRazorpayWebhook(body, sig, "evt_1")).body).toBe("duplicate");
    expect((await getAnalysisByToken(a.token))!.status).toBe("paid");
    expect(checkoutSignature("s", "o", "p")).toHaveLength(64);
  });
});

describe("stylist review", () => {
  it("corrects, edits, requires a note, releases and handles revisions", async () => {
    const actor = await staff();
    const a = await newAnalysis();
    await expect(releaseReport(a.id, actor)).rejects.toThrow(/paid/);
    await pay(a.token);

    await applyStylistOverrides(a.id, { undertone: "cool", depth: "deep" }, actor);
    let row = (await getAnalysisByToken(a.token))!;
    expect(row.report!.colour.name).toBe("Cool Deep");

    const first = row.report!.outfits[0]!;
    await updateOutfit(a.id, first.id, { title: "Custom look", why: first.why, pieces: first.pieces }, actor);
    row = (await getAnalysisByToken(a.token))!;
    expect(row.report!.outfits[0]!.title).toBe("Custom look");
    expect(row.reportEdited).toBe(true);

    await expect(releaseReport(a.id, actor)).rejects.toThrow(/note/);
    await saveStylistNote(a.id, "Lean into navy and white.", actor);
    await releaseReport(a.id, actor);
    row = (await getAnalysisByToken(a.token))!;
    expect(row.status).toBe("released");
    const v = customerView(row);
    expect(v.kind === "full" && v.final).toBe(true);

    await expect(requestRevision(a.token, "short")).rejects.toThrow();
    await requestRevision(a.token, "I get compliments in navy — can it go in?");
    await expect(requestRevision(a.token, "Another one please, navy?")).rejects.toThrow(/already/);
    expect((await getAnalysisByToken(a.token))!.status).toBe("revision_requested");
    await releaseReport(a.id, actor, "Added navy");
    const rev = await db()<{ status: string; response: string }[]>`select status, response from revision_requests where analysis_id = ${a.id}`;
    expect(rev[0]).toMatchObject({ status: "resolved", response: "Added navy" });

    const audit = await db()<{ action: string }[]>`select action from audit_logs where entity_id = ${a.id}`;
    expect(audit.map((x) => x.action)).toEqual(expect.arrayContaining(["analysis.overrides", "analysis.outfit_edit", "analysis.release"]));
  });

  it("refuses revisions before payment", async () => {
    const a = await newAnalysis();
    await expect(requestRevision(a.token, "Please change the colours")).rejects.toThrow(/unlocked/);
  });
});

describe("privacy", () => {
  it("emails existing links for an address and nothing otherwise", async () => {
    const a = await newAnalysis();
    await pay(a.token, { email: "finder@example.com" });
    await sendLinksForEmail("finder@example.com");
    await sendLinksForEmail("nobody@example.com");
    const mail = await db()<{ toEmail: string; textBody: string }[]>`select to_email, text_body from email_outbox where template = 'find_links'`;
    expect(mail).toHaveLength(1);
    expect(mail[0]!.textBody).toContain(a.token);
  });

  it("deletes photos after release and purges stale unpaid previews", async () => {
    await saveSettings("privacy", { photoRetentionDays: 30, unpaidRetentionDays: 14 }, null);
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const actor = await staff();
    const kept = await createAnalysis({ quiz: SAMPLE_QUIZ, headshot: new File([png], "h.png"), fullbody: null, photoConsent: true });
    await pay(kept.token);
    await saveStylistNote(kept.id, "Note", actor);
    await releaseReport(kept.id, actor);
    const stale = await newAnalysis();
    await createOrder(stale.token, checkout()); // abandoned checkout

    const later = new Date(Date.now() + 40 * 86400_000);
    const r = await runRetention(later);
    expect(r.photosDeleted).toBeGreaterThanOrEqual(1);
    expect(r.previewsDeleted).toBeGreaterThanOrEqual(1);
    const k = (await getAnalysisByToken(kept.token))!;
    expect(k.headshotPath).toBeNull();
    expect(k.photosDeletedAt).not.toBeNull();
    expect(await getAnalysisByToken(stale.token)).toBeNull();
  });
});
