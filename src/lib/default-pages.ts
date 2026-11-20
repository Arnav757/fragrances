/**
 * Default policy and information pages (Markdown). Editable in /admin/settings → Pages.
 * {{tokens}} are filled from settings at render time. These are starting drafts written to describe how
 * the service actually works; they must be reviewed (ideally by a lawyer) before launch.
 */
export const PAGE_KEYS = ["about", "contact", "privacy", "terms", "refunds"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_META: Record<PageKey, { path: string; title: string; description: string }> = {
  about: { path: "/about", title: "How it works", description: "How the analysis, the report and the stylist review work." },
  contact: { path: "/contact", title: "Contact", description: "How to reach us." },
  privacy: { path: "/privacy", title: "Privacy Policy", description: "How we collect, use, protect and delete your photos and data." },
  terms: { path: "/terms", title: "Terms of Service", description: "The terms that apply when you use this service." },
  refunds: { path: "/refunds", title: "Refund Policy", description: "Revisions and refunds." },
};

export const DEFAULT_PAGES: Record<PageKey, string> = {
  about: `## What {{storeName}} does

{{storeName}} gives you a personal style system: what suits your body frame, which colours work with your skin, what to do with your face shape, and 20 complete outfits built from all of that.

## The three steps

1. **Answer a short quiz and add two photos** (optional but recommended): a headshot in daylight and a full-length photo. It takes about three minutes.
2. **See your free preview straight away.** We show your frame, your colour family, your face shape and two sample outfits before you pay anything.
3. **Unlock the full report.** You get it immediately as an interactive page. A stylist then reviews it, corrects anything that's off, adds a personal note and releases the final version within {{standardHours}} hours ({{priorityHours}} hours with priority review).

## How the analysis works

Your answers are scored with a set of fit and colour rules our stylists wrote. When you add photos, an AI model looks at them to check your proportions, skin undertone, depth and face shape, and corrects the rules where your photos disagree with your answers. A human stylist then reviews every paid report before it's marked final.

The AI part is a tool, not the stylist. It can be wrong — especially with poor lighting — which is why every paid report gets a human review, and why you can ask for a revision.

## What you'll need

- Good daylight, no filters, no sunglasses
- A plain background if you can
- Clothes that show your shape (a fitted tee is ideal)
`,
  contact: `## Get in touch

- Email: {{supportEmail}}
- WhatsApp: {{whatsapp}}

Please include your reference number (it starts with **FM-** and is on your report page and in every email) so we can find your report quickly.

Lost your link? Use [Find my report](/find) and we'll email it to you.
`,
  privacy: `_Last updated: draft — review before launch._

This policy explains how {{legalBusinessName}} ("we") handles your information when you use {{storeName}}.

## What we collect

- **Quiz answers** — your first name, age range, height, build and style preferences.
- **Photos** (optional) — a headshot and a full-length photo, only if you upload them.
- **Contact details** — your email and mobile number when you buy, or if you ask us to email your link.
- **Payment details** — handled by Razorpay. We never see or store your card or UPI details; we receive a payment reference and status.
- **Basic technical data** — IP address for security and rate-limiting, and the campaign that brought you here (for example an Instagram ad).

## How we use your photos

Your photos are used **only** to produce your style analysis.

- They are stored in private storage that is not publicly accessible.
- If photo analysis is switched on, they are sent to our AI provider (Anthropic) to analyse proportions, colouring and face shape. They are not used to train AI models under our provider's commercial terms.
- Our stylists may view them while reviewing your report.
- They are **deleted automatically {{photoRetentionDays}} days** after your report is finalised, or after {{unpaidRetentionDays}} days if you don't buy. You can ask us to delete them sooner at any time.
- We never publish your photos or use them in marketing.

## Marketing

We only send marketing emails if you tick the box asking for them. You can unsubscribe at any time.

## Your rights

You can ask to see, correct or delete your data by writing to {{supportEmail}}. We'll respond within 30 days.

## Who we share data with

Razorpay (payments), Anthropic (photo analysis), our email provider (sending your report link) and our hosting and database providers. Each processes data only to provide their service to us.
`,
  terms: `_Last updated: draft — review before launch._

## The service

{{storeName}} provides personalised style guidance based on your answers and photos. It is advice about clothing, colour and grooming. It is not medical advice.

## Your report

- The free preview is a partial result.
- After payment you get the full interactive report immediately, followed by a stylist-reviewed final version within the review time shown at checkout.
- Shop links are searches at third-party stores. We don't sell clothes, aren't responsible for third-party products, and some links may earn us a commission at no cost to you (they're labelled).

## Your link

Your report is reached through a private link. Anyone with the link can open it, so treat it like a password. We can send you a new copy of the link but cannot change who you've shared it with.

## Fair use

Please only upload photos of yourself, and only if you are 18 or over.

## Contact

{{legalBusinessName}} · {{businessAddress}} · {{supportEmail}}
`,
  refunds: `_Last updated: draft — review before launch._

## Revisions

Every paid report includes revisions. If something in your final report doesn't feel right — a colour, a fit note, an outfit — use **Ask for a revision** on your report page and a stylist will update it.

## Refunds

- If we haven't released your stylist-reviewed report within the promised time, you can ask for a full refund.
- If you're unhappy after a revision, write to {{supportEmail}} within 7 days of your final report and we'll refund you.
- Refunds go back to your original payment method through Razorpay. Banks can take 5–7 working days to show them.
`,
};
