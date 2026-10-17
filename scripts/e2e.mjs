/**
 * End-to-end test: guest purchase in test mode → admin supplier fulfilment → delivered.
 *
 * Requirements: the app running at E2E_BASE_URL (default http://localhost:3000) with ENABLE_MOCK_PAYMENTS=true
 * (or Razorpay test keys — not automated here), the demo seed loaded, and an admin account whose
 * credentials are in E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 *
 * Browser: uses CHROMIUM_PATH, a Playwright-installed Chromium, or @sparticuz/chromium as a fallback.
 * Run: npm run test:e2e   (screenshots go to E2E_SHOTS_DIR when set)
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const SHOTS = process.env.E2E_SHOTS_DIR;
if (!ADMIN_PASSWORD) throw new Error("Set E2E_ADMIN_PASSWORD");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

async function launch() {
  if (process.env.CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    return await chromium.launch();
  } catch {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args });
  }
}

const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (name) => console.log(`• ${name}`);

const browser = await launch();
let adminBrowser = null;
try {
  // ---------------------------------------------------------------- customer
  const customer = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await customer.newPage();
  page.setDefaultTimeout(30000);

  step("browse and filter the shop");
  await page.goto(`${BASE}/shop?type=inspired_fragrance&available=1`);
  const cards = page.locator("article");
  assert.ok((await cards.count()) > 0, "expected inspired, available products");

  step("search by note");
  await page.goto(`${BASE}/shop?q=saffron`);
  await page.getByRole("link", { name: /Saffron Leather/ }).first().click();
  await page.waitForURL(/\/products\//);
  await shot(page, "01-product");

  step("add to cart");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByText("Added to your cart").waitFor();
  await page.goto(`${BASE}/cart`);
  await page.getByRole("heading", { name: "Your cart" }).waitFor();

  step("apply demo discount code");
  await page.getByLabel("Discount code").fill("DEMO10");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText(/Code DEMO10 applied|DEMO10/).first().waitFor();
  await shot(page, "02-cart");

  step("checkout as guest");
  await page.getByRole("link", { name: "Checkout" }).click();
  await page.waitForURL(/\/checkout$/);
  await page.getByLabel("Email").fill("e2e.customer@example.com");
  await page.getByLabel("Your name").fill("Asha Verma");
  await page.locator("#phone").fill("9876543210");
  await page.locator("#shipping-fullName").fill("Asha Verma");
  await page.locator("#shipping-phone").fill("9876543210");
  await page.locator("#shipping-line1").fill("12, Lavender Residency, MG Road");
  await page.locator("#shipping-pincode").fill("560001");
  await page.locator("#shipping-city").fill("Bengaluru");
  await page.locator("#shipping-state").selectOption("Karnataka");
  await page.locator("#acceptTerms").check();
  await shot(page, "03-checkout");
  await page.getByRole("button", { name: /Continue to payment/ }).click();
  await page.waitForURL(/\/checkout\/pay\//);
  const orderNumber = page.url().match(/pay\/(NN-\d+)/)?.[1];
  assert.ok(orderNumber, "order number in URL");
  await shot(page, "04-pay");

  step("simulated payment failure, then retry");
  await page.getByRole("button", { name: "Simulate failure" }).click();
  await page.getByText(/simulated payment failed/i).waitFor();
  await page.getByTestId("simulate-success").click();
  await page.waitForURL(/\/order\/NN-/);
  await page.getByRole("heading", { name: "Thank you for your order" }).waitFor();
  await shot(page, "05-confirmation");
  const guestOrderUrl = page.url();

  step("cart is cleared after payment");
  await page.goto(`${BASE}/cart`);
  await page.getByText("Your cart is empty").waitFor();

  step("a stranger cannot open the order without the token");
  const noToken = await fetch(`${BASE}/order/${orderNumber}`);
  assert.equal(noToken.status, 404, "order page without token must 404");
  const badToken = await fetch(`${BASE}/order/${orderNumber}?t=${"0".repeat(40)}`);
  assert.equal(badToken.status, 404, "order page with wrong token must 404");
  const anonAdmin = await fetch(`${BASE}/admin`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonAdmin.status) && anonAdmin.headers.get("location")?.includes("/login"), "admin redirects anonymous users to login");

  // ---------------------------------------------------------------- admin
  // A separate browser process for the admin (some headless builds share cookies between contexts).
  adminBrowser = await launch();
  const adminCtx = await adminBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await adminCtx.newPage();
  admin.setDefaultTimeout(30000);
  step("admin signs in");
  await admin.goto(`${BASE}/login?next=/admin`);
  await admin.getByLabel("Email").fill(ADMIN_EMAIL);
  await admin.getByLabel("Password").fill(ADMIN_PASSWORD);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL((u) => new URL(u).pathname === "/admin");
  await shot(admin, "06-admin-overview");

  step("open the order");
  await admin.goto(`${BASE}/admin/orders?q=${orderNumber}`);
  await admin.getByRole("link", { name: orderNumber }).click();
  await admin.waitForURL(/\/admin\/orders\/[0-9a-f-]+$/);
  const adminOrderUrl = admin.url();
  await admin.getByText("Confirmed", { exact: true }).first().waitFor();

  step("record supplier purchase (draft)");
  await admin.getByRole("button", { name: "Record supplier purchase" }).click();
  await admin.getByText("Supplier purchase recorded as draft.").waitFor();

  step("show and copy supplier message; contains address, no email");
  await admin.getByRole("button", { name: "Show supplier message" }).click();
  const msg = await admin.getByLabel("Supplier message").inputValue();
  assert.match(msg, /Lavender Residency/);
  assert.match(msg, /PREPAID/);
  assert.doesNotMatch(msg, /e2e\.customer@example\.com/, "supplier message must not include customer email");

  step("mark ordered requires explicit confirmation");
  const orderedBtn = admin.getByRole("button", { name: "Mark as ordered" });
  assert.equal(await orderedBtn.isDisabled(), true);
  await admin.getByText(/I confirm I have placed this order/).click();
  await orderedBtn.click();
  await admin.getByText("Marked as ordered with supplier.").waitFor();

  step("supplier confirms, then ship with tracking");
  await admin.getByRole("button", { name: "Supplier confirmed availability" }).click();
  await admin.getByText("Supplier confirmation recorded.").waitFor();
  await admin.getByLabel("Courier").fill("Delhivery");
  await admin.getByLabel("Tracking number").fill("DLV123456789");
  await admin.getByRole("button", { name: "Mark shipped" }).click();
  await admin.getByText("Shipment recorded.").waitFor();
  await shot(admin, "07-admin-order-shipped");

  step("mark delivered");
  await admin.locator("#status-to").selectOption("delivered");
  await admin.getByRole("button", { name: "Update status" }).click();
  await admin.getByText("Status updated.").waitFor();
  await admin.goto(adminOrderUrl);
  await admin.getByText("Delivered", { exact: true }).first().waitFor();

  step("emails were generated (logged) for payment, dispatch and delivery");
  await admin.goto(`${BASE}/admin/emails`);
  for (const t of ["payment_confirmation", "order_dispatched", "delivered"]) {
    assert.ok((await admin.getByRole("cell", { name: t }).count()) > 0, `email ${t} logged`);
  }

  step("customer sees tracking on their order page");
  await page.goto(guestOrderUrl);
  await page.getByText("DLV123456789").first().waitFor();
  await shot(page, "08-customer-delivered");

  step("financial report renders");
  await admin.goto(`${BASE}/admin/reports`);
  await admin.getByRole("cell", { name: /^Estimated contribution/ }).waitFor();
  await shot(admin, "09-report");

  console.log(`\nE2E passed for order ${orderNumber}`);
} catch (e) {
  if (SHOTS) for (const [i, pg] of [browser, adminBrowser].filter(Boolean).flatMap((b) => b.contexts()).flatMap((c) => c.pages()).entries()) await pg.screenshot({ path: `${SHOTS}/failure-${i}.png`, fullPage: true }).catch(() => {});
  throw e;
} finally {
  await browser.close();
  await adminBrowser?.close();
}
