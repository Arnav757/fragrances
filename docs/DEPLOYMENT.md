# Deployment guide

The app is a standard Next.js 16 server application. Vercel + Supabase is the simplest path; any Node host (Railway, Render, a VPS with `npm run build && npm start`) works too.

## Vercel + Supabase

1. **Database** — set up Supabase and run migrations as in [INTEGRATIONS.md §1](INTEGRATIONS.md). Use the transaction pooler URL.
2. **Repository** — push this project to GitHub (`.env*` files are git-ignored; keep it that way).
3. **Import** the repo in Vercel. Framework preset: Next.js. Build command `npm run build`, Node 20+ (22 recommended).
4. **Environment variables** (Project → Settings → Environment Variables). For *Production*:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase pooler URI |
   | `APP_ENV` | `production` |
   | `SITE_URL` | `https://www.yourdomain.in` |
   | `APP_SECRET` | `openssl rand -base64 48` (keep it stable — changing it invalidates guest order links) |
   | `CRON_SECRET` | another random value |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | live keys only when going live |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | |

   Do **not** set `ENABLE_MOCK_PAYMENTS` in production — the app refuses to start with it. For a *Preview/Staging* environment use `APP_ENV=staging`, Razorpay **test** keys and a separate database.
5. **Cron** — add `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/expire-orders", "schedule": "0 * * * *" }] }
   ```
   Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
6. **Domain** — add your domain in Vercel, then set `SITE_URL` to it and redeploy.
7. **Razorpay webhook** — point it at `https://<domain>/api/webhooks/razorpay`.
8. **Smoke test** — `GET /api/health` returns `{"ok":true}`; place a Razorpay *test-mode* order on staging end-to-end before switching production to live keys.

## Other hosts

```bash
npm ci
npm run build
APP_ENV=production node_modules/.bin/next start -p 3000
```
Run behind HTTPS (cookies are `Secure` in production). If the proxy terminates TLS, forward `X-Forwarded-For`/`X-Forwarded-Host` and set `X-Real-IP` to the client address (rate limiting uses `X-Real-IP`, else the last `X-Forwarded-For` entry, because the first entry can be forged by the client). Product image uploads require Supabase Storage on any host without a persistent disk.

## Backups and operations

- Enable Supabase point-in-time recovery or daily backups. Orders, payments and audit logs are your accounting trail.
- Export orders monthly (Admin → Orders → Export CSV) for your accountant.
- Watch **Admin → Overview** warnings and **Email log** failures.
- Rotate `RAZORPAY_*`, `RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` if anyone with access leaves.
