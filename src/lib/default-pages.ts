/**
 * Default policy and information pages (Markdown). Editable in /admin/settings → Pages.
 * {{tokens}} are filled from store settings at render time. These are starting drafts written to be
 * honest about how the business operates; they must be reviewed (ideally by a lawyer) before launch.
 */
export const PAGE_KEYS = ["about", "contact", "faq", "shipping", "returns", "privacy", "terms", "authenticity", "payment"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_META: Record<PageKey, { path: string; title: string; description: string }> = {
  about: { path: "/about", title: "About Us", description: "Who we are and how we work." },
  contact: { path: "/contact", title: "Contact Us", description: "How to reach customer support." },
  faq: { path: "/faq", title: "Frequently Asked Questions", description: "Answers to common questions about orders, delivery and fragrances." },
  shipping: { path: "/shipping-policy", title: "Shipping Policy", description: "How and when orders are dispatched and delivered." },
  returns: { path: "/returns", title: "Returns & Refunds", description: "Cancellations, returns and refunds." },
  privacy: { path: "/privacy", title: "Privacy Policy", description: "How we collect, use and protect your personal data." },
  terms: { path: "/terms", title: "Terms & Conditions", description: "The terms that apply when you use this website and place orders." },
  authenticity: { path: "/authenticity", title: "Authenticity Policy", description: "Authentic branded perfumes and inspired fragrances explained." },
  payment: { path: "/payment-information", title: "Payment Information", description: "Accepted payment methods and how payments are processed." },
};

export const DEFAULT_PAGES: Record<PageKey, string> = {
  about: `## Our story

{{storeName}} is an online fragrance boutique based in India. We curate Middle Eastern perfumery — authentic products from established houses such as Lattafa, Afnan, Armaf and Rasasi — alongside a separate, clearly labelled range of inspired fragrances sold under their own names.

## How we work

We are a small, independent retailer. Many products are sourced to order from our trade partners once you place an order, which lets us keep prices accessible without holding large amounts of stock. Each product page shows its current availability, and we only accept payment for products we can reasonably fulfil.

## What we promise

- **Honest listings.** Every product is labelled as either an authentic branded perfume or an inspired fragrance. They are never presented as the same thing.
- **Verified information only.** We publish fragrance notes, MRP and other details only after checking them.
- **Transparent pricing.** The price you see at checkout includes applicable taxes; shipping is shown before you pay.
- **Real support.** We are responsible for your order from checkout to delivery, including returns and refunds under our policies.
`,
  contact: `## Customer support

We're happy to help with orders, delivery, product questions and returns.

- **Email:** {{supportEmail}}
- **Phone / WhatsApp:** {{supportPhone}}
- **Support hours:** {{supportHours}}

Please include your order number (for example, NN-1001) so we can help you faster.

## Business details

{{legalBusinessName}}
{{businessAddress}}
`,
  faq: `## Are your perfumes authentic?

Products listed as **Authentic branded** are genuine products of the named brand, sourced through our trade partners. Products listed as **Inspired fragrance** are separate products sold under their own brand names — they are not the original designer fragrance and are not affiliated with any designer brand. See our [Authenticity Policy](/authenticity).

## Why do some products say "Awaiting supplier confirmation"?

Many products are sourced to order. When we haven't yet confirmed that our partner can supply an item, it can't be purchased. This protects you from paying for something we can't deliver.

## How long does delivery take?

Orders are dispatched after our partner confirms them. You'll receive an email with the courier and tracking number once your order ships. See our [Shipping Policy](/shipping-policy).

## Do you offer Cash on Delivery?

{{codStatus}}

## Can I cancel my order?

You can request a cancellation from your account until the order has been dispatched. See [Returns & Refunds](/returns).

## Will the packaging carry your branding?

Orders may be dispatched directly by our trade partner in plain, protective packaging.
`,
  shipping: `## Where we deliver

We deliver to addresses in India. A small number of PIN codes may not be serviceable by our courier partners; if that happens we'll contact you before dispatch and offer a full refund if we can't deliver.

## Shipping charges

- Standard shipping: {{flatShipping}}
- Free shipping on orders of {{freeShippingThreshold}} or more (after discounts)

Shipping charges are always shown in your cart before you pay.

## Dispatch

Many items are sourced to order. Once your order is confirmed we place it with our trade partner, who dispatches it directly to you. You'll receive an email with the courier name and tracking number when it ships.

## Delivery times

Delivery times depend on your location and the courier. We don't promise a delivery date unless one is shown at checkout.

## Damaged or incorrect items

Please contact us within 48 hours of delivery with photos of the package and product. See [Returns & Refunds](/returns).
`,
  returns: `## Cancellations

You can request a cancellation from your account at any time before your order is dispatched. If you've already paid online, approved cancellations are refunded to your original payment method.

## Returns

Because fragrances are personal-care products, we can accept returns only for items that are **damaged in transit, defective, or not what you ordered**, reported within {{returnWindowDays}} days of delivery. Products must be unused and in their original packaging where possible.

To start a return, open the order in your account and choose **Request a return**, or contact us at {{supportEmail}}.

## Refunds

- Online payments are refunded to the original payment method. Banks and payment providers typically take several working days to credit the amount after we initiate it.
- Cash-on-delivery orders are refunded by bank transfer after we verify your details.
- Shipping charges are refunded when the return is due to our error or a damaged/incorrect item.

We'll email you when a refund is initiated.
`,
  privacy: `## Who we are

This website is operated by {{legalBusinessName}} ("we", "us"). Contact: {{supportEmail}}.

## What we collect

- **Order information:** name, email, phone number, delivery and billing addresses, order contents.
- **Account information:** if you register, your name, email and a securely hashed password.
- **Payment information:** payments are processed by our payment provider (Razorpay). We do **not** receive or store your card number, CVV, UPI PIN or banking passwords. We store the payment reference and status.
- **Newsletter:** your email address and the consent you gave, if you subscribe.
- **Technical data:** essential cookies to keep you signed in and remember your cart.

## How we use it

To process and deliver your order, provide customer support, handle returns and refunds, meet legal and tax obligations, and — only if you opt in — send you newsletters.

## Who we share it with

- **Our fulfilment partners** receive only the details needed to dispatch your order (name, delivery address, phone number and the items ordered).
- **Courier companies** for delivery.
- **Payment provider** (Razorpay) to process payments.
- **Email provider** to send order emails.

We don't sell your personal data.

## Retention and your rights

We keep order records for as long as required for tax and legal purposes. You may ask us to access, correct or delete your personal data, or withdraw consent for marketing, by emailing {{supportEmail}}.
`,
  terms: `## About these terms

These terms apply when you use this website and place orders with {{legalBusinessName}}.

## Products and information

We work to describe products accurately. **Authentic branded** products are genuine products of the named brand. **Inspired fragrances** are separate products sold under their own names and are not affiliated with or endorsed by any designer brand. Product images may be representative where marked.

## Prices and payment

Prices are in Indian Rupees and include applicable taxes unless stated otherwise. The total payable, including shipping, is shown before you pay. If a price is listed incorrectly due to an error, we will contact you and you may cancel for a full refund.

## Order acceptance

An order is accepted when we confirm it by email. We may decline or cancel an order — with a full refund — if an item becomes unavailable from our partners, if delivery isn't possible, or if we suspect fraud.

## Delivery, cancellations and returns

See our [Shipping Policy](/shipping-policy) and [Returns & Refunds](/returns).

## Contact

{{supportEmail}}
`,
  authenticity: `## Two clearly separated categories

**Authentic branded perfumes** are genuine products manufactured by the named brand (for example Lattafa, Afnan, Armaf or Rasasi) and sourced through trade partners.

**Inspired fragrances** are products sold under their own brand names. They are not the original designer fragrance, are not made by or affiliated with any designer brand, and we never sell them as such.

Every product page states which category it belongs to.

## Our checks

- We source from trade partners we have a working relationship with.
- We publish product details such as fragrance notes and MRP only after verifying them.
- If you have any concern about a product you received, contact us at {{supportEmail}} with your order number and photos, and we'll investigate.
`,
  payment: `## Accepted payment methods

Online payments are processed securely by **Razorpay**, which supports UPI, cards, net banking and wallets, depending on availability.

{{codStatus}}

## Security

Payment details are entered on Razorpay's secure checkout. We never see or store your card number, CVV, UPI PIN or banking credentials.

## Payment confirmation

Your order is confirmed only after our server verifies the payment with Razorpay. If money was debited but your order shows as unpaid, please don't pay again — contact us at {{supportEmail}} and we'll reconcile it.

## Failed payments

If a payment fails, you can retry from your order page. Any amount debited for a failed payment is typically reversed automatically by your bank or payment provider.
`,
};
