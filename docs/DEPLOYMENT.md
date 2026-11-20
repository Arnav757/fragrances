# Deployment guide

FORMA is a standard Next.js 16 server application. Vercel + Supabase is the simplest path; any Node host works (`npm run build && npm start`).

## Vercel + Supabase

1. **Database** — create a Supabase project (region: Mumbai `ap-south-1` for Indian customers) and run `DATABASE_URL=<pooler url> npm run db:migrate`. Use the transaction pooler URL (port 6543).
2. **Private photo bucket** — Supabase → Storage → New bucket `client-photos`, **Public: off**. The app only ever reads it with the service-role key on the server.
3. **Import** the repo in Vercel (Next.js preset, Node 22). Set the Function Region next to your database (`bom1`). Photo analysis runs inside a server action that can take up to ~60 s, so a plan that allows function durations of 60–90 s is needed (`/start` sets `maxDuration = 90`).
4. **Environment variables** (Production):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase pooler URI |
   | `APP_ENV` | `production` |
   | `SITE_URL` | `https://www.yourdomain.in` |
   | `APP_SECRET` | `openssl rand -base64 48` — keep it stable: it encrypts stored report links |
   | `CRON_SECRET` | another random value |
   | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude API key; model defaults to `claude-opus-5-5` |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | live keys only when going live |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PHOTO_BUCKET` | |

   Never set `ENABLE_MOCK_PAYMENTS` in production — the app refuses to start with it. In production the app also refuses to store photos on local disk.
5. **Cron** — `vercel.json` runs `/api/cron/retention` daily: it deletes photos after release, purges unpaid previews and expires abandoned checkouts. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
6. **Razorpay webhook** — `https://<domain>/api/webhooks/razorpay` with events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
7. **Staff accounts** — `ADMIN_PASSWORD='…' npm run admin:create -- you@yourdomain.in "Your Name"`. Stylists: create the account the same way, then `update profiles set role = 'stylist' where email = '…'` (stylists can review and release but not refund or change settings).
8. **Smoke test** — `GET /api/health` → `{"ok":true}`; run a Razorpay test-mode purchase on staging, and `npm run test:e2e` against staging with mock payments.
