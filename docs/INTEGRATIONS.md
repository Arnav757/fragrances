# Integrations

| Integration | Without it | Configure |
|---|---|---|
| **Postgres / Supabase** | Required | `DATABASE_URL`, `npm run db:migrate`. RLS is forced on every table with no policies for Supabase's public API roles. |
| **Claude API** (photo analysis) | Analyses use quiz answers only; photos are still shown to the stylist | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`. See `src/lib/ai/analyze.ts`. |
| **Razorpay** | Customers can't pay (or simulated payments in dev with `ENABLE_MOCK_PAYMENTS=true`) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| **Resend** (email) | Emails are written to Admin → Email log and **not sent** | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` |
| **Supabase Storage** (photos) | Photos go to `./.data/photos` (dev only; refused in production) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PHOTO_BUCKET` (private bucket) |
| **Shop links** | — | Admin → Settings → Shop links. Links are retailer *searches*, not product picks. |

## How photo analysis works

1. The browser resizes photos to ≤1400 px JPEG (strips EXIF/GPS) before upload.
2. The server checks magic bytes, stores the photo privately, and builds a baseline from the quiz answers (`src/lib/style/observe.ts`).
3. If a key is configured, Claude receives both photos plus the answers and returns structured JSON (frame, undertone, depth, contrast, face shape, confidence, short notes). Low-confidence calls never override the customer's own answers (`mergeObservations`).
4. Refusals, timeouts, unusable photos and API errors never block the customer: the quiz baseline is used and the reason is shown to the stylist.
5. The report itself is generated deterministically by `src/lib/style/report.ts` from the observations — the AI never writes outfits or prices, so output is consistent and reviewable.
