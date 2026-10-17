# Go-live checklist

Work through every item. Several are legal/tax questions — this list is a prompt to get proper advice, not the advice itself.

## Business & legal (India)
- [ ] Choose the final brand name; run a trademark search (IP India) and check domain availability. Update `src/config/brand.ts` and the favicon (`src/app/icon.svg`, `components/store/logo.tsx`) if the name changes.
- [ ] Business entity registered; **GST registration** obtained if required for your turnover/inter-state online sales (online sellers often need it regardless of turnover — confirm with a CA).
- [ ] Confirm the HSN code(s) and GST rate(s) for each product category with your CA → **Admin → Brands, collections & tax**, then mark each class *verified*.
- [ ] Set your registered state (**Admin → Settings → Commerce**) so CGST/SGST vs IGST is correct; decide GST on shipping/COD fees with your CA; tick "tax setup reviewed".
- [ ] Decide how you'll issue **GST tax invoices** (numbering, GSTIN, place of supply). This app records the data (taxable value, CGST/SGST/IGST, HSN per line) but does **not** generate statutory invoices — use your accounting software or add an invoice generator.
- [ ] Consumer Protection (E-Commerce) Rules, 2020: publish legal entity name, address, customer-care contact and grievance officer details; return/refund/cancellation policies; country of origin where applicable; total price including all charges before checkout. Fill **Admin → Settings → Store details** and review every policy page.
- [ ] Legal Metrology (Packaged Commodities) rules: product listings must show the declarations required for pre-packaged goods (MRP, net quantity, manufacturer/importer, country of origin, etc.). Add these fields to descriptions/images for each product.
- [ ] Imported perfumes: confirm your wholesaler's goods are legitimately imported (importer details on packs) and that you may resell them; keep their invoices.
- [ ] Inspired fragrances: never use designer brand names or logos in product names, images or ads in a way that suggests affiliation; get advice on any comparative wording.
- [ ] Have a lawyer review Terms, Privacy, Returns, Shipping and Authenticity pages (**Admin → Settings → Pages**).
- [ ] Privacy: align with the Digital Personal Data Protection Act, 2023 as its rules take effect — notice, consent for marketing, data retention, grievance contact, processor agreements (Razorpay, Resend, Supabase, hosting, your wholesaler).

## Supplier
- [ ] Written agreement with the wholesaler: prices (incl./excl. GST), dispatch times, plain packaging, no price slips in parcels, damage/return policy, COD handling and remittance, data protection for customer addresses.
- [ ] Record the supplier and each product's offer (SKU, cost, GST, ITC) in the admin.
- [ ] Only mark products *Available to order* once supply is confirmed.

## Catalogue
- [ ] Remove demo data: `npm run db:seed -- --remove` (or archive each demo product).
- [ ] Real products with accurate descriptions, verified notes/MRP only, licensed or own photos.
- [ ] Review max-per-order limits and discount codes (delete `DEMO10`).

## Payments
- [ ] Razorpay KYC complete; live keys set; live webhook created with all listed events; auto-capture enabled.
- [ ] `ENABLE_MOCK_PAYMENTS` removed; `APP_ENV=production`.
- [ ] One real low-value live order paid, refunded and reconciled in the admin.
- [ ] COD enabled **only** if your wholesaler/courier actually supports it; COD fee and max value set.

## Email
- [ ] Domain verified in Resend (SPF/DKIM); `EMAIL_FROM` uses it; test every template from staging.

## Security & operations
- [ ] Long random `APP_SECRET` and `CRON_SECRET`; hourly cron for `/api/cron/expire-orders`.
- [ ] Admin accounts use long unique passwords; only trusted people are admins. (Two-factor auth is not implemented — consider adding it.)
- [ ] Verify RLS lockdown on Supabase (see INTEGRATIONS.md §1).
- [ ] Add a Content-Security-Policy suited to your final third parties (Razorpay checkout, analytics).
- [ ] Backups enabled; error monitoring (e.g. Sentry) and uptime checks added.
- [ ] Analytics/ads pixels only with an updated privacy policy and, where needed, consent.
- [ ] `npm run check` and the e2e test pass on the release; review **Admin → Overview** — no warnings left.
