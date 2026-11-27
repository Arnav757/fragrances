/**
 * End-to-end check against a running app: quiz → free preview → simulated payment → stylist release.
 * Needs: the app running with ENABLE_MOCK_PAYMENTS=true, and a staff account.
 *   E2E_BASE_URL=http://localhost:3000 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
 * Uses the preinstalled Chromium when PW_CHROMIUM is set (e.g. /opt/pw-browsers/chromium).
 */
import { chromium } from "playwright";

const B = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ADMIN = process.env.E2E_ADMIN_EMAIL;
const PASS = process.env.E2E_ADMIN_PASSWORD;
if (!ADMIN || !PASS) {
  console.error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.");
  process.exit(1);
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${B}/start?utm_source=e2e`);
  const next = () => page.getByTestId("next").click();
  await page.getByLabel("First name").fill("Ekam");
  await page.getByRole("radio", { name: "25–34" }).click(); await next();
  await page.getByRole("radio", { name: "Athletic" }).click(); await next();
  await page.getByRole("radio", { name: /clearly wider/ }).click();
  await page.getByRole("radio", { name: "Flat" }).click(); await next();
  await next();
  await page.getByRole("radio", { name: /green or olive/ }).click();
  await page.getByRole("radio", { name: /tan easily/ }).click();
  await page.getByRole("radio", { name: /Gold looks better/ }).click(); await next();
  await page.getByRole("radio", { name: /Medium/ }).click();
  await page.getByRole("radio", { name: "Black", exact: true }).click(); await next();
  await page.getByRole("radio", { name: "Oval" }).click();
  await page.getByRole("radio", { name: "Stubble" }).click(); await next();
  await page.getByRole("button", { name: "Weekends & casual" }).click();
  await page.getByRole("radio", { name: /Minimal/ }).click(); await next();
  await page.getByRole("radio", { name: /^Value/ }).click(); await next();
  await page.getByTestId("submit-quiz").click();
  await page.waitForURL(/\/s\//, { timeout: 60000 });
  console.log("✓ preview", page.url());

  await page.locator("#contactName").fill("E2E Buyer");
  await page.locator("#email").fill("e2e@example.com");
  await page.locator("#phone").fill("9876543210");
  await page.getByText(/I agree to the/).click();
  await page.getByTestId("pay").click();
  await page.getByTestId("simulate-success").click();
  await page.waitForSelector("text=Stylist review in progress", { timeout: 30000 });
  console.log("✓ paid, full report unlocked");

  const staff = await browser.newPage();
  staff.on("dialog", (d) => d.accept());
  await staff.goto(`${B}/login`);
  await staff.getByLabel("Email").fill(ADMIN);
  await staff.getByLabel("Password").fill(PASS);
  await staff.getByRole("button", { name: "Sign in" }).click();
  await staff.waitForURL(`${B}/admin`);
  await staff.goto(`${B}/admin/reports?q=e2e@example.com&status=queue`);
  await staff.getByRole("link", { name: /^FM-/ }).first().click();
  await staff.getByLabel(/Personal note/).fill("E2E note.");
  await staff.getByRole("button", { name: "Save note" }).click();
  await staff.waitForSelector("text=Note saved");
  await staff.getByTestId("release").click();
  await staff.waitForSelector("text=Released");
  await page.reload();
  await page.waitForSelector("text=Stylist reviewed");
  console.log("✓ released and visible to the customer");
  if (errors.length) throw new Error("Browser errors: " + errors.join("; "));
  console.log("E2E passed");
} finally {
  await browser.close();
}
