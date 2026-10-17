/**
 * Central brand configuration.
 *
 * "NOIR & NOTES" is a provisional working name. Nothing in this project claims that the name,
 * its trademark or any domain is available — check those before launch (see docs/GO_LIVE_CHECKLIST.md).
 * Change the name here; admins can additionally override the displayed store name in /admin/settings.
 */
export const brand = {
  name: "NOIR & NOTES",
  shortName: "Noir & Notes",
  monogram: "N&N",
  tagline: "Curated fragrance, honestly priced.",
  description:
    "A curated fragrance boutique for authentic Middle Eastern perfumes and clearly labelled inspired fragrances, with transparent pricing and honest product information.",
  locale: "en-IN",
  currency: "INR",
  country: "India",
} as const;

export const OCCASIONS = ["Office", "Everyday", "Date Night", "Evening", "Summer", "Winter"] as const;
export const FAMILIES = ["Fresh", "Woody", "Amber", "Oud", "Sweet", "Spicy", "Floral", "Citrus", "Aquatic", "Musk", "Leather", "Fougere"] as const;
export const HOMEPAGE_FAMILIES = ["Fresh", "Woody", "Amber", "Oud", "Sweet", "Spicy"] as const;
export const CONCENTRATIONS = [
  "Parfum",
  "Extrait de Parfum",
  "Eau de Parfum",
  "Eau de Toilette",
  "Eau de Cologne",
  "Attar / Perfume Oil",
  "Body Mist",
  "Other",
] as const;
export const GENDERS = ["Men", "Women", "Unisex"] as const;
export const PRODUCT_TYPES = ["authentic_branded", "inspired_fragrance", "other"] as const;
export const AVAILABILITY = ["available", "awaiting_supplier_confirmation", "out_of_stock", "discontinued"] as const;

export type Occasion = (typeof OCCASIONS)[number];
export type Family = (typeof FAMILIES)[number];
export type Concentration = (typeof CONCENTRATIONS)[number];
export type Gender = (typeof GENDERS)[number];
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type Availability = (typeof AVAILABILITY)[number];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  authentic_branded: "Authentic branded",
  inspired_fragrance: "Inspired fragrance",
  other: "Other",
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "Available to order",
  awaiting_supplier_confirmation: "Awaiting supplier confirmation",
  out_of_stock: "Currently unavailable",
  discontinued: "Discontinued",
};

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
] as const;
