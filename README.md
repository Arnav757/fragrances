# FORMA — personal styling for Indian men

A personal style service: a 3-minute quiz and two optional photos produce a man's **body frame, colour palette and face shape**, then **20 complete outfits** built from them, linked to shops and reviewed by a real stylist. Built with Next.js 16, TypeScript, Tailwind CSS 4, Postgres (Supabase in production), Razorpay and the Claude API.

"FORMA" is a **provisional working name** set in `src/config/brand.ts`. Nothing here claims the name, trademark or domain is available.

> **Status:** runs locally; typecheck, lint, the test suite, the production build and the end-to-end purchase/review test pass. It is **not production-ready** until the items in [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md) are done — real credentials, legal review of the policies, GST review, and a stylist checking the styling rules.

## How it compares to typical online styling reports

| | FORMA | Typical service |
|---|---|---|
| Results before paying | Free preview: frame, colour family, face shape, 2 outfits | Pay first |
| First results | Seconds to a minute | Days |
| Price | Shown on the landing page | Often hidden until checkout |
| Report | Interactive web page: outfit filters, illustrated outfits, shop links, wardrobe checklist, save as PDF | Static PDF |
| Human review | Every paid report reviewed, corrected and annotated by a stylist; revisions built in | Varies |
| Indian context | Palettes written for South Asian skin; kurtas, bandhgalas, Nehru jackets, puja and wedding looks | Often generic |
| Privacy | Photos resized in the browser (EXIF/GPS stripped), stored privately, auto-deleted | Rarely stated |

## The customer journey

1. **`/start`** — 10 quick steps (name, height, build, shoulder/waist, fit problems, three undertone tests, skin depth, hair, face, beard, glasses, occasions, style, budget) and two optional photos. UTM parameters are captured for attribution.
2. **Instant analysis** — quiz rules give a baseline; with photos and an API key, Claude refines it (`src/lib/ai/analyze.ts`). The report is generated deterministically from the result (`src/lib/style/`).
3. **`/s/<secret-token>`** — the free preview. Locked sections are never sent to the browser. A checkout panel (standard / priority review, promo codes, Razorpay) sits beside it; customers can also email themselves the link.
4. **After payment** the full report opens immediately, marked "stylist review in progress", and the customer gets the link by email.
5. **Stylist studio (`/admin`)** — the review queue ordered by deadline. The stylist sees the photos, answers and analysis, can correct frame/undertone/depth/contrast/face (the report rebuilds), edit or remove individual outfits, writes a personal note and releases. The customer is emailed.
6. **Revisions** — the customer can ask for one from the report page; it returns to the queue.
7. **Retention** — a daily job deletes photos after release and purges unpaid previews.

No customer accounts: each report is reached through a long random link (stored only as a hash, plus an encrypted copy so **/find** can email it again).

## What's in the code

| Path | What |
|---|---|
| `src/lib/style/` | The styling engine: quiz schema, six palettes, five frames, six face shapes, ~40 outfit templates, report builder and preview. Pure TypeScript, fully unit-tested. |
| `src/lib/ai/analyze.ts` | Claude vision call with structured output; never blocks the customer. |
| `src/lib/services/analyses.ts` | Create, view, stylist edits, release, revisions, retention. |
| `src/lib/services/payments.ts` | Server-side pricing, discounts, Razorpay orders, signature + amount verification, idempotent webhooks, refunds. |
| `src/app/(site)` | Landing page, quiz, report, sample report, find-my-report, policy pages. |
| `src/app/admin` | Stylist studio: overview (queue, funnel, sources), reports, review workspace, orders & refunds, promo codes, settings, email log, audit log. |
| `supabase/migrations` | Schema; RLS forced on every table. |

Stylists can review and release; only admins can refund, change settings or create promo codes.

## Run locally

```bash
npm install
cp .env.example .env.local          # then set APP_SECRET (openssl rand -base64 48)
createdb forma                      # or use any Postgres database URL
npm run db:migrate
ADMIN_PASSWORD='choose-a-long-password' npm run admin:create -- you@example.com "Your Name"
npm run dev                         # http://localhost:3000 — studio at /admin
```

With `ENABLE_MOCK_PAYMENTS=true` and no Razorpay keys, checkout shows a **simulated payment** panel. Without `ANTHROPIC_API_KEY`, analyses use quiz answers only. Without Resend, emails appear in **Studio → Email log** marked "logged, not sent". A banner on every page lists what's simulated.

## Deploy to Vercel

Import the repo, add a Supabase or Neon database from the Vercel Storage tab, set `APP_SECRET`, `CRON_SECRET`, `SITE_URL`, `APP_ENV` and `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`, and deploy. Migrations and the first admin are handled by the build (`vercel-build`). Details in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run check` | Lint, typecheck, tests and build |
| `npm test` | Unit + integration tests (needs Postgres; uses `TEST_DATABASE_URL`, which is wiped) |
| `npm run test:e2e` | Browser test against a running app: quiz → preview → simulated payment → stylist release. Needs `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` |
| `npm run db:migrate` | Apply migrations (also runs automatically on every Vercel deploy) |
| `npm run db:bootstrap-admin` | Create the first admin from `BOOTSTRAP_ADMIN_*` if no admin exists |
| `npm run admin:create -- email "Name"` | Create or promote an admin |

## Docs

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel + Supabase
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — Claude, Razorpay, Resend, storage, how photo analysis works
- [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md)
