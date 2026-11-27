# Go-live checklist

Work through this before taking real money. Admin → Overview shows a live list of the technical gaps.

## Business & legal
- [ ] Choose the final brand name (FORMA is provisional) and check trademark and domain availability. Change it in `src/config/brand.ts`.
- [ ] Fill in Admin → Settings → Business: legal name, address, support email, GSTIN, stylist name shown on reports.
- [ ] Have a lawyer review the Privacy Policy, Terms and Refund Policy (Admin → Settings → Pages). Photos of faces and bodies are personal data under India's DPDP Act — the policy must match what you actually do.
- [ ] Confirm the GST treatment of the service (rate and SAC code) with a tax adviser, then tick the confirmation in Settings → Pricing.
- [ ] Decide the prices and review times (Settings → Pricing). Make sure you can staff the promised review times.

## Stylists
- [ ] Hire / brief at least one stylist. Have them review 10+ generated reports for real people and adjust the rules in `src/lib/style/` (palettes, frames, outfit templates) where they disagree.
- [ ] Create stylist accounts (see DEPLOYMENT.md §7).

## Integrations
- [ ] Razorpay live keys + webhook secret, KYC complete, and a live ₹1 test transaction refunded.
- [ ] Resend domain verified; `EMAIL_FROM` set; test that a report link email arrives (check spam).
- [ ] Supabase **private** photo bucket configured.
- [ ] Anthropic API key set and a few real photo analyses checked by a stylist. Confirm your Anthropic account's data-retention terms match the privacy policy.
- [ ] Optional: Amazon Associates tag in Settings → Shop links (links are labelled as affiliate automatically).

## Marketing
- [ ] Use UTM parameters on every ad and influencer link (`?utm_source=instagram&utm_campaign=…`). Admin → Overview shows previews and conversion by source.
- [ ] Create promo codes for campaigns in Admin → Promo codes.
- [ ] Only publish testimonials and "men styled" numbers you can prove. The landing page deliberately ships without any.

## Final checks
- [ ] `npm run check` passes; `npm run test:e2e` passes on staging.
- [ ] Delete any test analyses/orders from the production database.
