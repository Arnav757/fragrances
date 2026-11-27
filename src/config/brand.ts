/**
 * Central brand configuration.
 *
 * "FORMA" is a provisional working name. Nothing in this project claims that the name, its trademark
 * or any domain is available — check those before launch (see docs/GO_LIVE_CHECKLIST.md).
 * Change the name here; admins can additionally override the displayed name in /admin/settings.
 */
export const brand = {
  name: "FORMA",
  tagline: "Your personal style system.",
  description:
    "Personal styling for Indian men: your body frame, colours and face shape analysed from two photos and a 3-minute quiz, with 20 outfits built for you and checked by a real stylist.",
  locale: "en-IN",
  currency: "INR",
  country: "India",
} as const;

/** Reference prefix shown to customers, e.g. FM-10001. */
export const REF_PREFIX = "FM";
