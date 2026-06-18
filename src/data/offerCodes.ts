export type BillingPlan = "monthly" | "annual";

export type Platform = "apple" | "google" | "stripe";

/** Offer codes are always pushed to all three storefronts. */
export const ALL_PLATFORMS: Platform[] = ["apple", "google", "stripe"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  apple: "Apple",
  google: "Google",
  stripe: "Stripe",
};

export type OfferCode = {
  id: string;
  code: string;
  plan: BillingPlan;
  /** Countries/regions the code is valid in. Empty array = all regions. */
  regions: string[];
  platforms: Platform[];
  createdOn: string; // ISO date
  expiresOn: string; // ISO date
  createdBy: string;
};

/** Common storefront regions selectable when creating an offer code. */
export const REGION_BANK: string[] = [
  "United States",
  "Canada",
  "United Kingdom",
  "Ireland",
  "Australia",
  "New Zealand",
  "India",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Sweden",
  "Brazil",
  "Mexico",
  "Japan",
  "South Korea",
  "Singapore",
  "United Arab Emirates",
  "South Africa",
];

export const offerCodes: OfferCode[] = [
  {
    id: "OC-2041",
    code: "SUMMERPRO25",
    plan: "annual",
    regions: ["United States", "Canada"],
    platforms: ALL_PLATFORMS,
    createdOn: "2026-05-02",
    expiresOn: "2026-08-31",
    createdBy: "Akash Patel",
  },
  {
    id: "OC-2038",
    code: "WELCOME10",
    plan: "monthly",
    regions: [],
    platforms: ALL_PLATFORMS,
    createdOn: "2026-04-18",
    expiresOn: "2026-12-31",
    createdBy: "Maya Chen",
  },
  {
    id: "OC-2031",
    code: "TRADESCHOOL50",
    plan: "annual",
    regions: ["United States"],
    platforms: ALL_PLATFORMS,
    createdOn: "2026-03-22",
    expiresOn: "2026-07-15",
    createdBy: "Akash Patel",
  },
  {
    id: "OC-2024",
    code: "EULAUNCH",
    plan: "monthly",
    regions: ["United Kingdom", "Germany", "France", "Spain", "Italy"],
    platforms: ALL_PLATFORMS,
    createdOn: "2026-02-10",
    expiresOn: "2026-06-30",
    createdBy: "Priya Iyer",
  },
  {
    id: "OC-2017",
    code: "SPRINGSAVE",
    plan: "annual",
    regions: ["Australia", "New Zealand"],
    platforms: ALL_PLATFORMS,
    createdOn: "2026-01-28",
    expiresOn: "2026-05-01",
    createdBy: "Maya Chen",
  },
  {
    id: "OC-2009",
    code: "NEWYEAR2026",
    plan: "monthly",
    regions: ["India"],
    platforms: ALL_PLATFORMS,
    createdOn: "2025-12-26",
    expiresOn: "2026-02-28",
    createdBy: "Diego Ramos",
  },
  {
    id: "OC-2002",
    code: "BLACKFRIDAY",
    plan: "annual",
    regions: [],
    platforms: ALL_PLATFORMS,
    createdOn: "2025-11-20",
    expiresOn: "2025-12-02",
    createdBy: "Akash Patel",
  },
];
