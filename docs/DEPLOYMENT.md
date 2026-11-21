# Deployment guide

FORMA is a standard Next.js 16 server application. Vercel + Supabase is the simplest path; any Node host works (`npm run build && npm start`).

## Vercel (no terminal needed)

The `vercel-build` script runs on every Vercel deploy: it applies any new database migrations (safely, under a lock), creates the first admin if you ask it to, then builds. So a deploy is all clicks:

1. **Import** the repo in Vercel: Add New → Project → pick the repository. Framework preset: Next.js (detected). Node 22.
2. **Database** — in the project, Storage → Create/Connect → **Supabase** (or Neon). Pick a region close to your users (Mumbai `ap-south-1` for India). Vercel adds the connection variables automatically; the app reads `DATABASE_URL` or, for Supabase, `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`.
3. **Environment variables** (Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `APP_SECRET` | `openssl rand -base64 48` — keep it stable: it encrypts stored report links |
   | `CRON_SECRET` | another random value |
   | `SITE_URL` | your site URL, e.g. `https://forma.vercel.app` (no trailing slash) |
   | `APP_ENV` | `staging` for a test site, `production` for real customers |
   | `ENABLE_MOCK_PAYMENTS` | `true` **only** for a staging/test site (refused in production) |
   | `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | your studio login (password 12+ characters). Used once, only if no admin exists; never changes an existing account. Remove after first sign-in. |
   | `ANTHROPIC_API_KEY` | optional — enables photo analysis |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | required for real payments |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | required to actually send report links |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PHOTO_BUCKET` | private photo storage (required in production) |

4. **Deploy** (Deployments → Redeploy if the first build ran before the variables were set). The build log shows `migrations applied: …` and `bootstrap admin: created …`.
5. Sign in at `/login`, then remove the `BOOTSTRAP_ADMIN_*` variables.

Use separate databases for preview and production deployments: migrations run against whichever database a deployment's variables point to.

### Remaining production setup

- **Private photo bucket** — Supabase → Storage → New bucket `client-photos`, **Public: off**. The app only ever reads it with the service-role key on the server. In production, photos are never stored on local disk.
- **Function duration** — photo analysis runs inside a server action that can take up to ~60 s (`/start` sets `maxDuration = 90`); make sure your Vercel plan allows it.
- **Cron** — `vercel.json` runs `/api/cron/retention` daily (photo deletion, unpaid-preview cleanup, checkout expiry). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
- **Razorpay webhook** — `https://<domain>/api/webhooks/razorpay` with events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
- **Stylist accounts** — `ADMIN_PASSWORD='…' npm run admin:create -- stylist@… "Name"`, then `update profiles set role = 'stylist' where email = '…'` (stylists review and release; they can't refund or change settings).
- **Smoke test** — `GET /api/health` → `{"ok":true}`; run a Razorpay test-mode purchase on staging, and `npm run test:e2e` against staging with simulated payments.

## Other hosts

Any Node host works: set the same variables, run `npm run db:migrate` (and optionally `npm run db:bootstrap-admin`) on deploy, then `npm run build && npm start`.
