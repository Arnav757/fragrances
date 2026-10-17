# External integrations — setup and testing

Each integration is optional during development. When one isn't configured the app says so (admin warnings, the test-mode banner) and never pretends it worked.

## 1. Supabase — database

1. Create a project at supabase.com (choose the Mumbai region for Indian customers).
2. **Project Settings → Database → Connection string**. Use the *transaction pooler* URI (port 6543) for serverless hosting, or the direct URI for a long-running server. Set it as `DATABASE_URL`.
3. Apply the schema from your machine: `DATABASE_URL='<uri>' npm run db:migrate` (or `supabase db push` with the Supabase CLI — the files are standard SQL migrations).
4. Do **not** seed demo data in production. Create your admin: `DATABASE_URL='<uri>' ADMIN_PASSWORD='…' npm run admin:create -- you@yourdomain.in "Your Name"`.
5. Check the lockdown: in the Supabase SQL editor, `select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';` — every row should be `true, true`. Calling the REST API with the anon key should return no rows for any table.

The app connects as the role in `DATABASE_URL` (normally `postgres`). The lockdown migration grants that role a pass-through policy; if you connect with a different role, add the same policy for it.

## 2. Supabase Storage — product images

1. **Storage → New bucket** named `product-images`, **Public** bucket (images are public product photos).
2. Set `SUPABASE_URL` (Project URL) and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role). The service key is server-only; never expose it to the browser.
3. Redeploy (the image host is read by `next.config.ts` at build time).
4. Test: Admin → Products → a product → upload a JPEG. It should appear with a `…supabase.co/storage/v1/object/public/product-images/…` URL.

Only upload photos you took or are licensed to use and that show the actual product.

## 3. Razorpay — payments

1. Sign up at razorpay.com and complete KYC. Start in **Test mode**.
2. **Account & Settings → API Keys** → generate test keys → `RAZORPAY_KEY_ID` (`rzp_test_…`), `RAZORPAY_KEY_SECRET`.
3. **Account & Settings → Webhooks → Add**: URL `https://<your-domain>/api/webhooks/razorpay`, a strong secret → `RAZORPAY_WEBHOOK_SECRET`. Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
4. **Payment capture**: enable automatic capture (Settings → Payment capture). If payments arrive only "authorised", the order shows "Payment authorised — awaiting confirmation" until captured.
5. Remove `ENABLE_MOCK_PAYMENTS` once keys are set (keys take precedence anyway).
6. Test in test mode: place an order, pay with Razorpay's documented test card/UPI details, confirm the order becomes *Confirmed / Paid*; check **Admin → order → Payments** shows the payment and, after the webhook arrives, the fee. Test a failed payment and retry. Test a gateway refund from the admin and confirm `refund.processed` updates it.
7. For local webhook testing, expose your dev server with a tunnel (e.g. `ngrok http 3000`) and point a test webhook at it.
8. Go live: switch to live keys (`rzp_live_…`) and a live webhook only after the go-live checklist.

How it works: the server creates a Razorpay order for the exact server-computed total; after checkout the browser sends `payment_id/order_id/signature`, the server verifies the HMAC **and** fetches the payment from Razorpay to check status and amount. Webhooks are verified against the raw body, de-duplicated by `x-razorpay-event-id`, and processed idempotently. Card data never touches this server.

## 4. Resend — email

1. Create an account at resend.com, add and verify your sending domain (DNS records).
2. Create an API key → `RESEND_API_KEY`. Set `EMAIL_FROM` (e.g. `NOIR & NOTES <orders@yourdomain.in>`) and optionally `EMAIL_REPLY_TO` (your support inbox).
3. Test: place a test order; **Admin → Email log** should show the email as **Sent** with no error. If it shows **Failed**, the error column explains why.

Templates: order confirmation (COD), payment confirmation (online), dispatched, tracking update, delivered, cancellation, refund status, password reset — in `src/lib/email/templates.ts`.

## 5. Shiprocket (optional)

Manual courier + tracking entry works without any integration. If your fulfilment uses Shiprocket, set `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` (an API user) and `SHIPROCKET_PICKUP_PINCODE` (your supplier's pickup PIN). The product page PIN checker will then ask Shiprocket's serviceability API. This client (`src/lib/shipping/index.ts`) follows Shiprocket's public docs but **has not been tested with real credentials** — verify before relying on it. The `ShippingProvider` interface lets you add another courier aggregator.

There is no supplier/wholesaler API integration: the supplier workflow is deliberately manual, with an explicit confirmation before customer data is shared.

## 6. Scheduled job

Unpaid online orders are cancelled after the configured window (default 24 h) whenever the admin overview loads, and via `GET /api/cron/expire-orders` with header `Authorization: Bearer $CRON_SECRET`. Schedule it hourly (Vercel Cron, GitHub Actions, or any cron service).
