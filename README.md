# NOIR & NOTES — fragrance ecommerce

A complete storefront, checkout and admin for an India-based online fragrance business that fulfils orders through a wholesaler (order-based dropshipping), built with Next.js 16, TypeScript, Tailwind CSS 4 and Postgres (Supabase in production).

"NOIR & NOTES" is a **provisional working name** set in `src/config/brand.ts`. Nothing here claims the name, trademark or domain is available.

> **Status:** runs locally, production build succeeds and the automated test suite and end-to-end purchase/fulfilment test pass. It is **not production-ready** until the items in [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md) are done — real credentials, business details, tax review, policy review and removing demo data.

---

## What's included

**Storefront** — home (collections, real-data bestsellers, Middle Eastern houses, separate inspired section, browse by occasion/family, recently added, story, consented newsletter), shop with working search/filters/sort/pagination, product pages (gallery, verified-only notes & MRP, availability, PIN check, share, JSON-LD), cart (server-validated discounts, GST, price-change handling), 3-step checkout (guest or account, Razorpay or COD), payment page with retry, order confirmation/status, customer account (profile, password, addresses, orders, cancellation/return requests, verified-purchase reviews), password reset, 9 editable policy/info pages, brands page, 404/error pages, sitemap, robots, Open Graph.

**Admin (`/admin`)** — overview with go-live warnings and orders needing action; order management with search/filters/CSV export; the **supplier fulfilment workflow** (availability → supplier & cost → draft purchase → copyable supplier message → explicit data-sharing confirmation → ordered → supplier confirmed → courier/tracking → shipped → delivered, plus issues, cost corrections, refunds, cancellations, returns, internal notes and full timeline); products (create/edit/archive, images with usage-rights confirmation, confidential supplier offers, CSV import with dry-run, CSV export); brands, collections and GST tax classes; suppliers; discount codes; review moderation; financial report with expenses; settings (store, GST, shipping, COD, homepage, policy pages); email log with previews; audit log.

**Backend** — relational schema with constraints, indexes and FKs; order snapshots; idempotent order creation; server-side pricing and GST (CGST/SGST vs IGST); Razorpay order creation, signature verification, payment fetch and idempotent webhooks; refunds via gateway or manual; emails via Resend or a local outbox; Supabase Storage or local uploads; optional Shiprocket serviceability; Postgres-backed rate limiting; audit logging.

## Architecture decisions (please read)

| Area | Decision | Why |
|---|---|---|
| Database | Postgres via `DATABASE_URL`; migrations in `supabase/migrations` | Works with Supabase in production and plain Postgres locally/in tests. |
| Data access | Server-side only (Server Components, Server Actions, route handlers) | Browser never talks to the DB. Supplier costs never leave the server. |
| RLS | Enabled and **forced** on every table, no policies for Supabase `anon`/`authenticated` roles | Locks down Supabase's auto-generated REST API completely. The app's server role has an explicit pass-through policy. |
| **Auth** | **App-managed** (argon2id hashes, random session tokens stored hashed in Postgres, httpOnly cookies) — **not Supabase Auth** | Docker wasn't available to run local Supabase, and this had to be fully testable here. It runs unchanged on Supabase Postgres. Switching to Supabase Auth later is possible but not done. |
| Payments | Razorpay via REST + HMAC verification; webhooks are the source of truth | No client-side "success" is ever trusted. |
| Test payments | `ENABLE_MOCK_PAYMENTS` simulated gateway when Razorpay keys are absent | Lets the complete flow run without credentials, through the same server verification code. Refused in production. |
| Components | Own small accessible component set in the shadcn/ui style (Radix Dialog, Sonner) | The shadcn CLI couldn't be used in the build environment; components live in `src/components/ui`. |
| Fonts | Self-hosted via Fontsource (Cormorant Garamond, Inter Tight) | No runtime calls to Google Fonts. |
| Caching | Next.js Cache Components disabled; pages render per request | Carts, sessions and live availability; correctness first. |

Money is stored as integer **paise**; GST rates as **basis points** (1800 = 18%).

## Requirements

- Node.js 20.9+ (tested on Node 22)
- PostgreSQL 15+ (local) or a Supabase project

## Run locally

```bash
npm install
cp .env.example .env.local          # then edit: set APP_SECRET (openssl rand -base64 48)
createdb noir                       # or use any Postgres database URL
npm run db:migrate                  # apply supabase/migrations
npm run db:seed                     # demo catalogue (clearly marked as demo)
ADMIN_PASSWORD='choose-a-long-password' npm run admin:create -- you@example.com "Your Name"
npm run dev                         # http://localhost:3000  (admin at /admin)
```

With `ENABLE_MOCK_PAYMENTS=true` and no Razorpay keys, checkout shows a **"Test mode — simulated payment"** panel. A yellow banner on every page says the store is in test mode. Emails appear under **Admin → Email log** and are marked "Logged, not sent".

Remove demo data at any time: `npm run db:seed -- --remove`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` (strict) |
| `npm test` | Vitest unit + integration tests (uses and **wipes** `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Browser end-to-end test against a running server (see below) |
| `npm run check` | lint + typecheck + tests + build |
| `npm run db:migrate` · `db:seed` | Apply migrations · seed/remove demo data |
| `npm run admin:create -- email "Name"` | Create or promote an admin (password from `ADMIN_PASSWORD` or prompt) |

### Tests

`npm test` needs a separate empty database: `createdb noir_test` (or set `TEST_DATABASE_URL`). It covers pricing, GST and discount maths, cart and checkout validation, order creation (server price recalculation, tampered totals, idempotency, unavailable products, COD rules, discount limits), payment signature verification, duplicate/forged/mismatched webhooks, customer order access, admin authorisation of server actions, session handling, password reset, supplier fulfilment transitions, data-sharing confirmation, refunds/cancellations, the financial report, and that public catalogue queries never return supplier costs or unverified data.

`npm run test:e2e` drives a real browser through: shop filters → search → add to cart → discount → guest checkout → failed then successful (simulated) payment → access control on the order link → admin login → supplier purchase → supplier message (checks it contains the address but not the customer's email) → confirmed data sharing → supplier confirmation → shipment → delivered → emails → customer sees tracking → financial report.

```bash
npm run build && npm start &          # with ENABLE_MOCK_PAYMENTS=true and the demo seed
E2E_ADMIN_EMAIL=you@example.com E2E_ADMIN_PASSWORD='…' npm run test:e2e
```
It uses `CHROMIUM_PATH`, a Playwright-installed Chromium (`npx playwright install chromium`), or the bundled `@sparticuz/chromium` fallback.

## External accounts and credentials

See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for step-by-step setup and testing of each:

| Service | Needed for | Env vars | Status in this build |
|---|---|---|---|
| Supabase (or any Postgres) | Database | `DATABASE_URL` | Implemented & tested on Postgres 16 |
| Supabase Storage | Product images | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Implemented, **not tested against live Supabase** |
| Razorpay | Online payments, refunds | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Implemented per Razorpay docs; verification logic tested; **not tested against live Razorpay** |
| Resend | Transactional email | `RESEND_API_KEY`, `EMAIL_FROM` | Implemented, **not tested against live Resend** |
| Shiprocket (optional) | PIN serviceability | `SHIPROCKET_*` | Implemented per docs, **unverified** — manual tracking works without it |
| Hosting (e.g. Vercel) | Running the site | all of the above + `APP_SECRET`, `SITE_URL`, `CRON_SECRET` | See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

## Project layout

```
src/config/brand.ts          brand name, taxonomies (families, occasions…)
src/app/(store)/…            storefront routes
src/app/admin/…              admin routes (every page/action re-checks the admin role in the DB)
src/app/actions/…            server actions (thin; validate + authorise + call services)
src/app/api/…                webhook, cron, health
src/lib/pricing.ts           pure pricing/GST engine
src/lib/services/…           catalogue, cart, orders, payments, fulfilment, reports, auth…
src/lib/payments/gateway.ts  Razorpay + simulated gateway
src/lib/email/…              templates + sending/outbox
supabase/migrations/…        schema + RLS lockdown
scripts/…                    migrate, seed, create-admin, e2e
tests/…                      vitest unit + integration
docs/…                       deployment, integrations, go-live checklist
public/templates/product-import-template.csv
```

## Fulfilment workflow (how you'll use it day to day)

1. A paid (or COD) order appears under **Admin → Overview → Needs action**.
2. Open it. Section **1–5** shows each item's supplier offers, cost and when you last confirmed them. Record the supplier purchase (supplier, quantities, actual unit cost, shipping, GST). This is a draft — nothing is sent.
3. **Show supplier message** → copy it into WhatsApp/email. It contains only the items, SKUs, delivery name/address/phone and whether to collect COD — no customer email, no selling prices.
4. Tick the confirmation and **Mark as ordered** (records who shared customer data and when).
5. When the wholesaler confirms → **Supplier confirmed availability**.
6. When they dispatch → enter courier, tracking number/link and date → **Mark shipped** (customer is emailed).
7. **Update status → Delivered** when delivered. For COD, **Mark COD collected** once the courier remits.
8. Problems → **Report an issue** or **Cancel this purchase** (order goes back to "awaiting supplier purchase"); refunds from the **Refund** panel.
9. Replace estimated costs with invoice figures under **Update actual costs** so the financial report is accurate.

## Security notes

Server-side authorisation everywhere (proxy redirect is only a convenience); Zod validation on every input; prices, discounts, shipping and tax recalculated on the server; Razorpay signatures verified and payments re-fetched; idempotent webhooks; rate limits on login, registration, password reset, checkout, discounts, PIN checks, newsletter and reviews; Server Actions' built-in origin checks; SameSite cookies; argon2id; reset tokens single-use and hashed; uploads type-sniffed and size-limited; Markdown rendered without raw HTML; email previews in a sandboxed iframe; CSV export guarded against formula injection; security headers; audit log for sensitive admin actions. A strict Content-Security-Policy is **not** yet configured (see go-live checklist).
