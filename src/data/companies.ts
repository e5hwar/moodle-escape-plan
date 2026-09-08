import type { User } from "./users";

/* The paid PLAN a company is on. Free Trial and Free Access are NOT tiers —
 * they are subscription STATUSES (see SubscriptionStatus), and a company in one
 * of those states carries no tier at all (Company.tier is optional). */
export type Tier = "Essentials" | "Growth" | "Professional";

export type BillingCycle = "Monthly" | "Annual";
/** An ISO 4217 code. The platform publishes default rates in USD and CAD only
 *  (see DEFAULT_RATES), but a company can be billed in any currency, so this is
 *  the open code rather than that pair — `defaultRate` and `currencySymbol`
 *  each fall back for a currency the rate table doesn't cover. */
export type Currency = string;
export type SignUpChannel = "Self Sign-Up" | "Internal Sign-Up";
/* How the company pays. "Invoice" is billed by emailed invoice rather than a
 * card on file — it was called "Manual" until the Payment Method column named
 * the two options for admins. */
export type PaymentCollection = "Automatic" | "Invoice";
export type TaxStatus = "Taxable" | "Tax Exempt" | "Reverse Charge";
export type SubscriptionStatus =
  | "Active"
  /** Created on an automatic-payment subscription, but the account holder has
   *  not yet added a payment method through the Stripe link. The plan is fully
   *  configured — tier, seats, cycle, price — it simply has not billed yet. */
  | "Pending Payment Setup"
  | "Past Due"
  | "Free Trial"
  | "Trial Expired"
  | "Free Access"
  | "Free Access Ended"
  | "Canceled";
// Mirrors the B2B roles used across the app (Manage Users): Admins and
// Managers carry a role tag in pickers; plain Employees show none.
export type CompanyRole = "Account Holder" | "Admin" | "Manager" | "Employee";

export type CompanyUser = {
  /** "U-9<company digits><index>" — resolvable via findCompanyUserProfile, so
   *  a company employee's profile link works like a Manage Users one. */
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  region: string;
  seat: "Assigned" | "Unassigned";
  status: "Active" | "Invited" | "Deactivated";
  lastActive: string;
};

export type Company = {
  id: string;
  name: string;
  email: string;
  /** Absent exactly when the subscription doesn't bill — a company on a trial
   *  (running or ended) or a Free Access grant (running or ended) is on no
   *  plan at all, so its Tier cell reads "—". See isBilledStatus. */
  tier?: Tier;
  seats: number;
  /** A company can work in several trades, or have none on file yet. The
   *  Industry column shows the first with a "+N" for the rest, or an em dash
   *  when the list is empty. */
  industry: string[];
  /** Partnership programmes the company belongs to. Same multi-value shape as
   *  `industry`; most companies belong to none. */
  partnership: string[];
  address?: string;
  /** Structured address captured by the Create Company form (Figma 101:337). The
   *  flat `address` above is kept as a composed one-line string for display. */
  addressParts?: {
    country?: string;
    line1?: string;
    line2?: string;
    city?: string;
    pin?: string;
    state?: string;
  };
  contactName?: string;
  phone?: string;
  /** "YYYY-MM-DD" — the day the company was actually created, stored by the
   *  wizard. Seed companies have none and fall back to a date derived from
   *  their id, so the Date Range presets always have rows in range. */
  createdAt?: string;
  // Optional billing/subscription fields. When absent (seed data), they are
  // derived deterministically by getCompanyBilling(); when a company is created
  // through the wizard, the chosen values are stored here and take precedence.
  billingCycle?: BillingCycle;
  currency?: Currency;
  signUp?: SignUpChannel;
  payment?: PaymentCollection;
  status?: SubscriptionStatus;
  seatsUsed?: number;
  /** Per seat, in the unit `billingCycle` bills in: per month on Monthly, per
   *  year on Annual (see DEFAULT_RATES). */
  ratePerSeat?: number;
  taxStatus?: TaxStatus;
  /** Date a scheduled cancellation takes effect, as "Mon D, YYYY" (e.g.
   *  "Aug 27, 2026"). Set when a subscription is cancelled through the UI. The
   *  date is the source of truth for which pill shows: before it the status
   *  reads "Cancels Aug 27, 2026", on or after it just "Canceled". */
  cancelsOn?: string;
  /** End date for a Free Access grant (e.g. "Aug 27, 2026"). Required whenever
   *  status is "Free Access". */
  freeAccessEndDate?: string;
  /** Why the subscription was cancelled — one of CANCELLATION_REASONS, picked
   *  in the Cancel Subscription flow. Surfaced on the status pill's hover. */
  cancellationReason?: string;
  /** Customer Success Manager assigned to this account. */
  assignedCsm?: string;
  /** Sales representative assigned to this account. */
  assignedSalesRep?: string;
};

/* The Stripe payment link for a company. Stand-in for the real Stripe call:
 * the same company always gets the same URL, so the wizard's success screen and
 * the row menu's "Copy Payment Link" agree. */
export function stripePaymentLink(email: string, name: string): string {
  let h = 0;
  for (let i = 0; i < (email + name).length; i++) h = (h * 31 + (email + name).charCodeAt(i)) >>> 0;
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  let seed = h;
  for (let i = 0; i < 14; i++) { code += chars[seed % chars.length]; seed = (seed * 1664525 + 1013904223) >>> 0; }
  return `https://buy.stripe.com/${code}`;
}

/** Today as "YYYY-MM-DD" — the stamp the wizard writes on a new company. */
export function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const TAX_STATUSES: TaxStatus[] = ["Taxable", "Tax Exempt", "Reverse Charge"];

export const TIERS: Tier[] = ["Essentials", "Growth", "Professional"];

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "Active",
  "Pending Payment Setup",
  "Past Due",
  "Free Trial",
  "Trial Expired",
  "Free Access",
  "Free Access Ended",
  "Canceled",
];

/* Statuses that actually collect money. Everything else — a running trial, an
 * expired one, a complimentary grant, a grant that has ended — pays nothing and
 * is on no plan at all, so its Tier, Billing Cycle, Payment Method and Price
 * all read "—" (Company.tier is absent for exactly these). A Canceled
 * subscription billed right up to its effective date, so it counts. */
export function isBilledStatus(status: SubscriptionStatus): boolean {
  return (
    status === "Active" ||
    status === "Pending Payment Setup" ||
    status === "Past Due" ||
    status === "Canceled"
  );
}

export const SIGN_UP_CHANNELS: SignUpChannel[] = ["Self Sign-Up", "Internal Sign-Up"];

/* Internal owners assignable to an account (Figma 101:337 — Company details).
 * They live here rather than in the wizard so the Companies table's Assigned
 * CSM / Assigned Sales Rep columns can seed a value for companies created
 * before the fields existed. */
// Alphabetical, the way the pickers list them.
export const CSM_OPTIONS = ["Corinne Hayes", "Leanna Olbinsky", "Simran Phulwani"];
export const SALES_REP_OPTIONS = ["Brendan Arsenault", "Elliot Ling", "Ruchir Shah"];

export const PAYMENT_COLLECTIONS: PaymentCollection[] = ["Automatic", "Invoice"];

/* How long an overdue account keeps working before access is cut off. Drives
 * the Past Due pill's hover ("45 days past due. Company loses access on …"),
 * so the two halves of that sentence can never disagree. */
export const PAST_DUE_GRACE_DAYS = 60;

/* Columns shown in the Manage Companies table. Only Company and Status are
 * fixed; everything else is toggleable via the Edit Columns button. Fixed
 * columns always lead the table, so the optional ones follow them — Account
 * Holder, Tier and Seats are optional but ON by default, which makes the
 * default table read Company · Status · Account Holder · Tier · Seats. */
export type CompanyColumn =
  | "accountHolder"
  | "tier"
  | "seats"
  | "seatChanges"
  | "payment"
  | "industry"
  | "partnership"
  | "signUp"
  | "billingCycle"
  | "createdOn"
  | "canceledOn"
  | "trialEndDate"
  | "dashboardLastAccess"
  | "price"
  | "salesRep"
  | "csm";

/* Listed in the order the table renders them — after the fixed columns — so
 * the Edit Columns menu reads left-to-right the way the table does. */
export const COMPANY_OPTIONAL_COLUMNS: { key: CompanyColumn; label: string }[] = [
  { key: "accountHolder", label: "Account Holder" },
  { key: "tier", label: "Tier" },
  { key: "seats", label: "Seats" },
  { key: "seatChanges", label: "Seat Changes" },
  { key: "signUp", label: "Sign-Up Method" },
  { key: "billingCycle", label: "Billing Cycle" },
  { key: "payment", label: "Payment Method" },
  { key: "industry", label: "Industry" },
  { key: "partnership", label: "Partnership" },
  { key: "createdOn", label: "Created On" },
  { key: "canceledOn", label: "Canceled On" },
  { key: "trialEndDate", label: "Trial End Date" },
  { key: "price", label: "Price" },
  { key: "salesRep", label: "Assigned Sales Rep" },
  { key: "csm", label: "Assigned CSM" },
  { key: "dashboardLastAccess", label: "Last Access" },
];

export const COMPANY_FIXED_COLUMNS: { label: string }[] = [
  { label: "Company" },
  { label: "Status" },
];

/* The table's starting columns — Account Holder, Tier, Seats, Seat Changes and
 * the trailing Last Access on, the rest off. Exported so the page and the
 * landing-morph preview can't drift apart. */
export const COMPANY_DEFAULT_COLUMNS: Record<CompanyColumn, boolean> = {
  accountHolder: true,
  tier: true,
  seats: true,
  seatChanges: true,
  signUp: false,
  billingCycle: false,
  payment: false,
  industry: false,
  partnership: false,
  createdOn: false,
  canceledOn: false,
  trialEndDate: false,
  price: false,
  salesRep: false,
  csm: false,
  dashboardLastAccess: true,
};

// Reasons an admin can pick when cancelling a B2B subscription. Editable under
// Product Config → B2B Management; the Cancel Subscription flow reads the same list.
export const CANCELLATION_REASONS = [
  "Too expensive",
  "Not enough content for our industry",
  "Switching to a competitor",
  "Company restructuring / budget cut",
  "Low user adoption",
  "Missing features we need",
];

export const companies: Company[] = [
  /* Created through the wizard on an automatic-payment subscription and still
     waiting for the account holder to add a card. Every plan column is filled —
     it is a fully configured subscription that simply has not billed yet. Its
     creation date is stamped at load so it stays the most recent row however
     long this seed data lives. */
  {
    id: "CO-090",
    name: "Cascade Mechanical Group",
    email: "ops@cascademech.com",
    tier: "Growth",
    seats: 24,
    seatsUsed: 24,
    industry: ["HVAC", "Plumbing"],
    partnership: ["NexStar"],
    address: "412 SW Alder St, Portland, Oregon, 97204, United States",
    addressParts: {
      country: "United States",
      line1: "412 SW Alder St",
      city: "Portland",
      pin: "97204",
      state: "Oregon",
    },
    contactName: "Marisol Vega",
    phone: "+1 503 555 0142",
    createdAt: todayStamp(),
    status: "Pending Payment Setup",
    billingCycle: "Monthly",
    currency: "USD",
    signUp: "Internal Sign-Up",
    payment: "Automatic",
    ratePerSeat: 40,
    taxStatus: "Taxable",
    assignedCsm: "Leanna Olbinsky",
    assignedSalesRep: "Brendan Arsenault",
  },
  {
    id: "CO-001",
    name: "ARS Cooling & Heating",
    email: "admin@arscooling.com",
    tier: "Professional",
    seats: 120,
    industry: ["HVAC", "Refrigeration"],
    partnership: ["Preferred Partner", "NGO Partner"],
  },
  {
    id: "CO-002",
    name: "Brennan HVAC Solutions",
    email: "training@brennanhvac.com",
    tier: "Growth",
    seats: 45,
    industry: ["HVAC"],
    partnership: [],
  },
  {
    id: "CO-003",
    name: "Comfort First Services",
    email: "hr@comfortfirst.com",
    tier: "Essentials",
    seats: 18,
    industry: ["HVAC"],
    partnership: [],
  },
  {
    id: "CO-004",
    name: "Delta Electrical Group",
    email: "ops@deltaelectrical.com",
    tier: "Professional",
    seats: 200,
    industry: ["Electrical", "Solar"],
    partnership: ["Elite Partner"],
  },
  {
    id: "CO-005",
    name: "EverClean Plumbing",
    email: "admin@evercleanplumbing.com",
    tier: "Growth",
    seats: 60,
    industry: ["Plumbing"],
    partnership: [],
  },
  {
    id: "CO-006",
    name: "FastFix Appliance Repair",
    email: "team@fastfixappliance.com",
    seats: 5,
    industry: ["Appliance Repair"],
    partnership: [],
    status: "Free Trial",
  },
  {
    id: "CO-007",
    name: "Green Shield Solar",
    email: "training@greenshieldsolar.com",
    tier: "Essentials",
    seats: 22,
    industry: [],
    partnership: [],
  },
  {
    id: "CO-008",
    name: "Harbor City Mechanical",
    email: "hr@harborcitymech.com",
    tier: "Professional",
    seats: 85,
    industry: ["HVAC", "Plumbing", "Refrigeration"],
    partnership: ["Preferred Partner"],
  },
  {
    id: "CO-009",
    name: "Integrity Roofing",
    email: "admin@integrityroofing.com",
    seats: 8,
    industry: ["Roofing"],
    partnership: [],
    status: "Trial Expired",
  },
  {
    id: "CO-010",
    name: "Jetstream Air Systems",
    email: "ops@jetstreamair.com",
    tier: "Growth",
    seats: 37,
    industry: ["HVAC", "Electrical"],
    partnership: [],
  },
  {
    id: "CO-011",
    name: "Keystone Electrical",
    email: "safety@keystoneelectrical.com",
    tier: "Essentials",
    seats: 14,
    industry: ["Electrical"],
    partnership: [],
  },
  {
    id: "CO-012",
    name: "LightPath Solar Co.",
    email: "admin@lightpathsolar.com",
    seats: 10,
    industry: ["Solar"],
    partnership: ["NGO Partner"],
    status: "Free Access",
    freeAccessEndDate: "2026-11-30",
  },
  {
    id: "CO-013",
    name: "Metro Pipe & Drain",
    email: "training@metropipe.com",
    tier: "Growth",
    seats: 50,
    industry: [],
    partnership: [],
  },
  {
    id: "CO-014",
    name: "NorthStar Refrigeration",
    email: "hr@northstarrefrig.com",
    tier: "Professional",
    seats: 95,
    industry: ["Refrigeration"],
    partnership: ["Elite Partner"],
  },
  {
    id: "CO-015",
    name: "Onyx Commercial Services",
    email: "admin@onyxcommercial.com",
    tier: "Growth",
    seats: 42,
    industry: ["HVAC"],
    partnership: [],
  },
  {
    id: "CO-016",
    name: "PeakFit Construction",
    email: "learn@peakfitconstruction.com",
    seats: 3,
    industry: ["Construction"],
    partnership: [],
    status: "Free Trial",
  },
  {
    id: "CO-017",
    name: "QuickSpark Electrical",
    email: "admin@quickspark.com",
    tier: "Essentials",
    seats: 28,
    industry: ["Electrical"],
    partnership: [],
  },
  {
    id: "CO-018",
    name: "Reliable Fire Protection",
    email: "training@reliablefire.com",
    tier: "Professional",
    seats: 130,
    industry: ["Fire Protection", "Electrical"],
    partnership: ["Preferred Partner", "Elite Partner"],
  },
  {
    id: "CO-019",
    name: "Sunridge Utilities",
    email: "ops@sunridgeutils.com",
    seats: 15,
    industry: ["Utilities", "Solar"],
    partnership: ["NGO Partner"],
    status: "Free Access",
    freeAccessEndDate: "2027-02-28",
  },
  {
    id: "CO-020",
    name: "Total Comfort HVAC",
    email: "hr@totalcomforthvac.com",
    tier: "Growth",
    seats: 55,
    industry: ["HVAC"],
    partnership: [],
  },
  {
    id: "CO-021",
    name: "United Mechanical",
    email: "admin@unitedmechanical.com",
    tier: "Professional",
    seats: 175,
    industry: ["HVAC", "Plumbing"],
    partnership: ["Elite Partner", "NGO Partner"],
  },
  {
    id: "CO-022",
    name: "Valley View Plumbing",
    email: "training@valleyviewplumbing.com",
    tier: "Essentials",
    seats: 20,
    industry: ["Plumbing"],
    partnership: [],
  },
  {
    id: "CO-023",
    name: "Wattwise Energy",
    email: "learn@wattwise.com",
    seats: 6,
    industry: [],
    partnership: ["NGO Partner"],
    status: "Trial Expired",
  },
  {
    id: "CO-024",
    name: "Xcel Roofing & Sheet Metal",
    email: "admin@xcelmetal.com",
    tier: "Growth",
    seats: 33,
    industry: ["Roofing", "Construction"],
    partnership: [],
  },
  {
    id: "CO-025",
    name: "Zephyr Climate Control",
    email: "hr@zephyrclimate.com",
    tier: "Professional",
    seats: 110,
    industry: ["HVAC"],
    partnership: ["Preferred Partner"],
  },
  {
    // Subscription scheduled to cancel at the end of the cycle — demonstrates
    // the grey "Cancels on …" status pill (vs. an already-ended "Canceled").
    id: "CO-026",
    name: "Apex Mechanical Group",
    email: "billing@apexmech.com",
    tier: "Growth",
    seats: 40,
    industry: ["HVAC", "Refrigeration"],
    partnership: [],
    status: "Canceled",
    cancelsOn: "Aug 27, 2026",
  },
  {
    // Cancellation that has already taken effect — demonstrates the plain
    // "Canceled" pill (same grey tone as the scheduled "Cancels …" one above).
    id: "CO-029",
    name: "Bluecrest Plumbing Co.",
    email: "accounts@bluecrestplumbing.com",
    tier: "Essentials",
    seats: 18,
    industry: ["Plumbing"],
    partnership: [],
    status: "Canceled",
    cancelsOn: "Mar 12, 2026",
  },
  {
    // Free Access grant that has run past its end date — demonstrates the
    // grey "Free Access Ended" status pill.
    id: "CO-027",
    name: "Cascade Roofing Collective",
    email: "admin@cascaderoofing.com",
    seats: 8,
    industry: ["Roofing"],
    partnership: ["NGO Partner"],
    status: "Free Access",
    freeAccessEndDate: "2026-03-01",
  },
  {
    id: "CO-028",
    name: "Ironclad Fire & Safety",
    email: "training@ironcladfire.com",
    seats: 12,
    industry: ["Fire Protection", "Construction"],
    partnership: ["Preferred Partner"],
    status: "Free Access",
    freeAccessEndDate: "2026-05-15",
  },
];

// Distinct industry / partnership values present in the data, used to populate
// the Manage Companies filter pills.
/* Both fields are multi-value, so the pickers list every value ANY company
 * carries — flattened, de-duplicated and alphabetical. */
export const COMPANY_INDUSTRIES = Array.from(
  new Set(companies.flatMap((c) => c.industry)),
).sort();

export const COMPANY_PARTNERSHIPS = Array.from(
  new Set(companies.flatMap((c) => c.partnership)),
).sort();

/* ───────────────── Pricing (Default Rates, per seat) ─────────────────
 * Section 21.3: set per Tier, per cycle, per currency. A rate is quoted in the
 * unit its own cycle bills in: a Monthly rate is per seat per MONTH, an Annual
 * one per seat per YEAR, priced at ten months' worth (two months free for
 * paying up front). `monthlyRate` puts the two on one scale. Every tier is a
 * paid plan; whether a company is actually billed is a matter of STATUS, not tier
 * (see isBilledStatus) — a trialing company is on a plan it doesn't pay for. */
export const BILLING_CYCLES: BillingCycle[] = ["Monthly", "Annual"];
export const CURRENCIES: Currency[] = ["USD", "CAD"];

export const DEFAULT_RATES: Record<
  Tier,
  Record<BillingCycle, Record<Currency, number>>
> = {
  Essentials: {
    Monthly: { USD: 30, CAD: 40 },
    Annual: { USD: 300, CAD: 400 },
  },
  Growth: {
    Monthly: { USD: 40, CAD: 53 },
    Annual: { USD: 400, CAD: 530 },
  },
  Professional: {
    Monthly: { USD: 50, CAD: 67 },
    Annual: { USD: 500, CAD: 670 },
  },
};

/** A cycle-native per-seat rate expressed per month, so an annual rate can be
 *  compared with a monthly one or summed into a monthly-equivalent total. */
export function monthlyRate(rate: number, cycle: BillingCycle): number {
  return cycle === "Annual" ? rate / 12 : rate;
}

/** The published rate, falling back to USD for a currency the table doesn't
 *  price — those are set by hand on the company, not defaulted. */
export function defaultRate(tier: Tier, cycle: BillingCycle, currency: Currency): number {
  const byCurrency = DEFAULT_RATES[tier][cycle];
  return byCurrency[currency] ?? byCurrency.USD;
}

export const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", CAD: "CA$" };

/** The prefix to print an amount with. A currency with no symbol on file shows
 *  its code instead ("JPY 82.00") rather than an empty prefix. The separator is
 *  a NON-BREAKING space: the per-seat field renders the prefix as its own flex
 *  item, where a trailing ordinary space would collapse to "JPY82.00". */
export function currencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOL[currency] ?? `${currency} `;
}

export const REGIONS = ["Headquarters", "North", "South", "East", "West", "Field Crews"];

// Small deterministic hash so derived demo data is stable per company.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export type CompanyBilling = {
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currency: Currency;
  signUp: SignUpChannel;
  payment: PaymentCollection;
  /** Per seat, in the unit `billingCycle` bills in (see DEFAULT_RATES). */
  ratePerSeat: number;
  seatsUsed: number;
  seatsTotal: number;
  /** Net seat movement across the account's WHOLE history, signed: positive if
   *  it took on seats, negative if it gave them up, 0 if it never moved. The
   *  table's Seat Changes column is date-scoped and sums getSeatEvents inside
   *  the selected range instead of reading this. */
  seatChange: number;
  nextBillingDate: string;
  createdOn: string;
  monthlyTotal: number;
  regions: { name: string; seats: number }[];
  /** Date a free trial ends, e.g. "Oct 27, 2026" (drives the yellow
   *  "Free Trial Ends …" pill). */
  trialEndsOn: string;
  /** Effective date of a cancellation, e.g. "Aug 27, 2026". */
  cancelsOn: string;
  /** True while `cancelsOn` is still in the future ("Cancels Aug 27, 2026");
   *  false once that date has passed ("Canceled"). */
  cancelScheduled: boolean;
  /** Why the subscription was cancelled — shown on the status pill's hover. */
  cancellationReason: string;
  /** How many days the latest invoice is overdue (Past Due accounts). */
  daysPastDue: number;
  /** Date a Past Due account loses access if the invoice stays unpaid. */
  accessEndsOn: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The admin tool's notion of "today" (matches APP_TODAY in NewCompanyWizard),
// used to tell whether a Free Access grant has run past its end date.
const APP_TODAY = new Date(2026, 5, 24);

/* Every company date the UI prints carries its year — "Aug 27, 2026", not
 * "Aug 27" (Figma 652:925). One formatter/parser pair so the status pills, the
 * Canceled On / Trial End Date columns and the stored `cancelsOn` all agree. */
function fmtDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}
/** Reads a "Mon D, YYYY" string back into a Date; null if it isn't one. */
function parseDate(s: string): Date | null {
  const m = /^([A-Za-z]{3})\w* (\d{1,2}), (\d{4})$/.exec(s.trim());
  const mo = m ? MONTHS.indexOf(m[1]) : -1;
  return m && mo >= 0 ? new Date(Number(m[3]), mo, Number(m[2])) : null;
}

export function getCompanyBilling(c: Company): CompanyBilling {
  const h = hash(c.id);

  // Tier says which PLAN a company is on, never whether it pays — so a trial or
  // a complimentary grant is a status the record carries explicitly, and seed
  // companies without one fall to the paying spread.
  const declared: SubscriptionStatus =
    c.status ?? (h % 17 === 0 ? "Canceled" : h % 7 === 0 ? "Past Due" : "Active");

  // A Free Access grant past its end date reads "Free Access Ended" even if the
  // record still says "Free Access" — the date is the source of truth once set.
  const freeAccessEnded =
    declared === "Free Access" &&
    !!c.freeAccessEndDate &&
    new Date(c.freeAccessEndDate) < APP_TODAY;

  const status: SubscriptionStatus = freeAccessEnded ? "Free Access Ended" : declared;

  const billingCycle: BillingCycle = c.billingCycle ?? (h % 3 === 0 ? "Annual" : "Monthly");
  const currency: Currency = c.currency ?? (h % 4 === 0 ? "CAD" : "USD");
  const signUp: SignUpChannel = c.signUp ?? (c.partnership ? "Internal Sign-Up" : h % 2 === 0 ? "Self Sign-Up" : "Internal Sign-Up");
  const payment: PaymentCollection =
    c.payment ?? (signUp === "Internal Sign-Up" && h % 3 === 1 ? "Invoice" : "Automatic");

  // No tier means no plan and so no rate — Price reads "—" for those anyway.
  const ratePerSeat = c.ratePerSeat ?? (c.tier ? defaultRate(c.tier, billingCycle, currency) : 0);
  const seatsTotal = c.seats;
  const seatsUsed = c.seatsUsed ?? Math.max(1, Math.min(seatsTotal, Math.round(seatsTotal * (0.55 + (h % 35) / 100))));
  // Net across the account's whole history. The Seat Changes column shows only
  // what falls inside the page's Date Range and computes its own figure.
  const seatChange = getTotalSeatChange(c);

  // Monthly-equivalent: an annual rate is a yearly figure, so it is divided
  // back down before it joins a "per month" total.
  const monthlyTotal =
    status === "Active" ? monthlyRate(ratePerSeat, billingCycle) * seatsTotal : 0;

  // Everyone bills on the 1st (Section 21.5).
  const nextBillingDate =
    status === "Free Trial"
      ? "Trial — no invoice"
      : status === "Trial Expired"
      ? "Trial ended — no access"
      : status === "Free Access"
      ? "Free Access — no invoice"
      : status === "Free Access Ended"
      ? "Free Access ended — no access"
      : status === "Canceled"
      ? "Canceled"
      : status === "Pending Payment Setup"
      ? "Awaiting payment method"
      : `${MONTHS[h % 12]} 1`;

  // Deterministic creation date, counted back from the REAL current date so the
  // Companies page's Date Range presets (Last 7/30/90 days…) always have
  // companies in range: about half land in the last 30 days, a quarter in the
  // last 90, and the rest reach back ~3 years. Salted — the sequential CO-nnn
  // ids leave `h` itself too correlated to spread these buckets.
  const created = companyCreatedDate(c);
  const createdOn = `${MONTHS[created.getMonth()]} ${created.getDate()}, ${created.getFullYear()}`;

  // Region split — distribute used seats across 1–3 regions deterministically.
  const regionCount = 1 + (h % 3);
  const regions: { name: string; seats: number }[] = [];
  let remaining = seatsTotal;
  for (let i = 0; i < regionCount; i++) {
    const last = i === regionCount - 1;
    const give = last ? remaining : Math.max(1, Math.round(seatsTotal / regionCount));
    const seats = Math.min(remaining, give);
    regions.push({ name: REGIONS[(h + i) % REGIONS.length], seats });
    remaining -= seats;
    if (remaining <= 0) break;
  }

  // Status-pill dates sit on the right side of "today": a trial that is still
  // running ends in the future, and a cancellation is either still scheduled
  // (future) or already in effect (past).
  // Salted: the sequential CO-nnn ids leave `h`'s high bits too correlated, so
  // reusing them here lands every trial on the same day.
  const ht = hash(c.id + "trial");
  // A running trial ends in the future; an expired one ended in the past. Both
  // carry a real date — "Trial Expired" is a trial that HAS an end date, not
  // one without.
  const trialEndsOn =
    declared === "Trial Expired"
      ? fmtDate(addDays(APP_TODAY, -(1 + (ht % 90))))
      : fmtDate(addDays(APP_TODAY, 1 + (ht % 75)));
  // A cancellation set through the UI carries its own effective date; seed data
  // alternates between the two cases. Either way the DATE decides which pill
  // shows, so a stored cancelsOn that has since passed reads "Canceled".
  const hx = hash(c.id + "cancel");
  const cancelsOn =
    c.cancelsOn ??
    // `>>>`, not `>>`: hash is unsigned, and a signed shift past 2^31 would
    // flip the offset's sign and put a "scheduled" cancellation in the past.
    fmtDate(addDays(APP_TODAY, hx % 2 === 0 ? 1 + ((hx >>> 3) % 60) : -(1 + ((hx >>> 3) % 400))));
  const cancelScheduled = (parseDate(cancelsOn)?.getTime() ?? 0) > APP_TODAY.getTime();

  // Why the subscription ended. Set explicitly by the Cancel Subscription flow;
  // seed companies get a deterministic one so the pill's hover always has a
  // reason to show.
  const cancellationReason =
    c.cancellationReason ?? CANCELLATION_REASONS[hash(c.id + "reason") % CANCELLATION_REASONS.length];

  // How overdue the latest invoice is, and the date access is cut off if it
  // stays unpaid — the grace period runs PAST_DUE_GRACE_DAYS from the due date,
  // so an account 45 days down has 15 left.
  const daysPastDue = 1 + (hash(c.id + "overdue") % PAST_DUE_GRACE_DAYS);
  const accessEndsOn = fmtDate(addDays(APP_TODAY, PAST_DUE_GRACE_DAYS - daysPastDue));

  return {
    status,
    billingCycle,
    currency,
    signUp,
    payment,
    ratePerSeat,
    seatsUsed,
    seatsTotal,
    seatChange,
    nextBillingDate,
    createdOn,
    monthlyTotal,
    regions,
    trialEndsOn,
    cancelsOn,
    cancelScheduled,
    cancellationReason,
    daysPastDue,
    accessEndsOn,
  };
}

/* Status pill shown in the Manage Companies table (Figma 109:1237, labels
 * re-synced from 652:925). Maps a subscription status to a colour tone and the
 * label to print. Pills that carry a date print it in full — the year matters
 * when a cancellation or a trial end is months out. Both ENDED states (Trial
 * Ended, Free Access Ended) and both CANCELLED ones (still scheduled, already
 * in effect) share the grey tone: they all mean "no access", so the tone reads
 * as the outcome and the label supplies the detail. */
export type StatusPillTone = "green" | "red" | "yellow" | "grey" | "purple" | "secondary";

export function getStatusPill(billing: CompanyBilling): { tone: StatusPillTone; label: string } {
  switch (billing.status) {
    case "Active":
      return { tone: "green", label: "Active" };
    case "Past Due":
      return { tone: "red", label: "Past Due" };
    case "Pending Payment Setup":
      return { tone: "red", label: "Pending Payment Setup" };
    case "Free Trial":
      return { tone: "yellow", label: `Free Trial Ends ${billing.trialEndsOn}` };
    case "Trial Expired":
      return { tone: "grey", label: "Trial Ended" };
    case "Free Access":
      return { tone: "secondary", label: "Free Access" };
    case "Free Access Ended":
      return { tone: "grey", label: "Free Access Ended" };
    case "Canceled":
      return billing.cancelScheduled
        ? { tone: "grey", label: `Cancels ${billing.cancelsOn}` }
        : { tone: "grey", label: "Canceled" };
    default:
      return { tone: "grey", label: billing.status };
  }
}

/** One seat movement: how many seats the company took on or gave up, and when.
 *  A company only ever moves one way, so every event for a given company shares
 *  a sign — narrowing the Date Range shows fewer movements, never a direction
 *  the account never went. */
export type SeatEvent = { date: string; delta: number };

/* Seat movements over the last two years, so the Companies page's Date Range
 * selector has something real to narrow: the Seat Changes column sums the
 * events inside the selected window, and a window containing none reads "—".
 * Roughly a sixth of accounts never moved at all and have no events.
 *
 * `>>>`, not `>>`: hash is unsigned, and a signed shift past 2^31 goes negative
 * and would flip a growing account into a shrinking one. */
export function getSeatEvents(company: Company): SeatEvent[] {
  /* An account still waiting on its payment method has never billed a seat. It
     holds exactly the seats it was created with, so there is no movement to
     report and every seat-derived figure reads empty.

     This reads the DECLARED status rather than getCompanyBilling's: that
     function calls getTotalSeatChange, so asking it here would recurse. Nothing
     derives "Pending Payment Setup" anyway — it is only ever set explicitly. */
  if (company.status === "Pending Payment Setup") return [];
  const h = hash(company.id + "seatchange");
  const bucket = h % 6;
  if (bucket === 0) return [];
  const direction = bucket === 1 ? -1 : 1;
  const count = 2 + ((h >>> 3) % 5);
  /* Counted back from the REAL current date, not APP_TODAY — the Date Range
     presets are built from the real clock, so events anchored to the app's
     fixed "today" would fall outside every window and the column would read
     "—" for everyone. Same reasoning as createdOn in getCompanyBilling. */
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: count }, (_, i) => {
    const hi = hash(`${company.id}seat${i}`);
    /* The newest movement lands inside the last three weeks so the default
       Last 30 Days window has something to report for most accounts; the rest
       reach back about two years, so widening the range genuinely adds to the
       figure rather than just repeating it. */
    const daysAgo = i === 0 ? (hi >>> 2) % 21 : 21 + ((hi >>> 2) % 700);
    return {
      date: fmtDate(addDays(today, -daysAgo)),
      delta: direction * (1 + ((hi >>> 5) % 8)),
    };
  });
}

/** Net seat movement across a company's whole history — the range-independent
 *  figure. The table's Seat Changes column sums only the events inside the
 *  selected Date Range instead; see seatChangeIn in CompaniesPage. */
export function getTotalSeatChange(company: Company): number {
  return getSeatEvents(company).reduce((n, e) => n + e.delta, 0);
}

/* Detail behind a status pill, shown on hover (the shared `data-tip` tooltip).
 * Only the statuses that carry a "why" or a "what happens next" have one; the
 * rest return null and the pill stays a plain label. */
export function getStatusTip(billing: CompanyBilling): string | null {
  switch (billing.status) {
    case "Past Due":
      return `${billing.daysPastDue} ${billing.daysPastDue === 1 ? "day" : "days"} past due. Company loses access on ${billing.accessEndsOn}`;
    case "Canceled":
      return `Reason: ${billing.cancellationReason}`;
    default:
      return null;
  }
}

/* "Canceled On" column (Manage Companies) — the date a subscription actually
 * ended. Only set once cancellation has taken effect; a subscription that's
 * merely scheduled to cancel ("Cancels …") hasn't ended yet, so it reads
 * "—" here until that date passes. */
export function getCanceledOn(billing: CompanyBilling): string {
  if (billing.status === "Canceled" && !billing.cancelScheduled) return billing.cancelsOn;
  return "—";
}

/* Effective date of a cancellation taken "at the end of the current billing
 * cycle" — the next occurrence of the billing day, as a full "Mon D, YYYY" so
 * the stored `cancelsOn` can be compared against today. `nextBillingDate` is
 * kept year-less for the wizard's cycle maths, hence the resolve here. */
export function getCancelEffectiveDate(billing: CompanyBilling): string {
  const mo = MONTHS.indexOf(billing.nextBillingDate.slice(0, 3));
  if (mo < 0) return fmtDate(addDays(APP_TODAY, 30));
  const thisYear = new Date(APP_TODAY.getFullYear(), mo, 1);
  return fmtDate(
    thisYear.getTime() > APP_TODAY.getTime()
      ? thisYear
      : new Date(APP_TODAY.getFullYear() + 1, mo, 1),
  );
}

/* "Trial End Date" column (Manage Companies) — only meaningful while a
 * company is actually on a Free Trial; every other status reads "—". */
export function getTrialEndDate(billing: CompanyBilling): string {
  return billing.status === "Free Trial" ? billing.trialEndsOn : "—";
}

/* "Dashboard Last Access" column (Manage Companies) — the last time a Manager
 * or Admin at the company viewed the B2B Dashboard. Deterministic per company;
 * roughly 1 in 6 accounts have never logged into the dashboard (null). */
/* The day a company was created: the wizard's own stamp when it has one, and
 * otherwise a date derived from the id — bucketed so the Companies page's Date
 * Range presets (Last 7/30/90 days…) always have companies in range. About half
 * land in the last 30 days, a quarter in the last 90, the rest reach back about
 * three years. Salted, because the sequential CO-nnn ids leave the plain hash
 * too correlated to spread the buckets. */
export function companyCreatedDate(c: Company): Date {
  if (c.createdAt) {
    const [y, m, d] = c.createdAt.split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  const hc = hash(c.id + "age");
  const bucket = hc % 4;
  const daysBack =
    bucket <= 1 ? (hc >> 3) % 30 : bucket === 2 ? 30 + ((hc >> 3) % 60) : 90 + ((hc >> 3) % 1000);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack);
}

/** Whole days between a past date and today, floored at 0. */
function daysAgo(d: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86400000));
}

export function getDashboardLastAccessDays(company: Company): number | null {
  // An account still waiting on its payment method has never reached the
  // dashboard — there is nothing to sign in to yet — so the day it was created
  // is the most recent thing that happened to it.
  if (company.status === "Pending Payment Setup") return daysAgo(companyCreatedDate(company));
  const h = hash(company.id + "dashboard");
  if (h % 6 === 0) return null;
  return 1 + (h % 60);
}

export function getDashboardLastAccess(company: Company): string {
  const days = getDashboardLastAccessDays(company);
  if (days === null) return "Never";
  if (days === 0) return "Today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/* "Price" column (Manage Companies) — the per-seat rate a company pays, same
 * value shown on its Manage Subscription page. Only meaningful while the
 * subscription actually bills; a trial or a complimentary grant reads "—". */
export function getCompanyPriceValue(company: Company): number | null {
  const billing = getCompanyBilling(company);
  return isBilledStatus(billing.status) ? billing.ratePerSeat : null;
}

/* "Assigned CSM" / "Assigned Sales Rep" columns. Both are OPTIONAL: the
 * wizard stores an explicit choice, and an account that has not been handed
 * to anyone yet has none — those cells read "—". Seed companies get a
 * deterministic owner, except for a slice left deliberately unassigned so the
 * blank state is visible in the table (same shape as getCompanyPhone).
 * Both return "" for unassigned; callers render the dash. */
export function getAssignedCsm(company: Company): string {
  if (company.assignedCsm) return company.assignedCsm;
  const h = hash(company.id + "csm");
  return h % 4 === 0 ? "" : CSM_OPTIONS[h % CSM_OPTIONS.length];
}

/* The account holder's phone. The create/edit wizard captures one; seed
 * companies mostly have nothing on file, so about two in three get a
 * deterministic number and the rest stay blank — the user-details hover card
 * drops its Phone row entirely when there is none (Figma 436:572). */
export function getCompanyPhone(company: Company): string {
  if (company.phone) return company.phone;
  const h = hash(company.id + "phone");
  if (h % 3 === 0) return "";
  return `+1 (${212 + (h % 700)}) 555-01${String(h % 100).padStart(2, "0")}`;
}

export function getAssignedSalesRep(company: Company): string {
  if (company.assignedSalesRep) return company.assignedSalesRep;
  const h = hash(company.id + "rep");
  return h % 3 === 0 ? "" : SALES_REP_OPTIONS[h % SALES_REP_OPTIONS.length];
}

export function getCompanyPrice(company: Company): string {
  const rate = getCompanyPriceValue(company);
  if (rate === null) return "—";
  return `${getCompanyBilling(company).currency} ${rate.toFixed(2)}`;
}

/* ── Outstanding balance ──
 * What a company still owes at the moment it cancels. Cancelling ends the
 * SUBSCRIPTION, not the debt: an invoice that already went unpaid stays
 * payable, and seats added during the current cycle are still billed on the
 * final invoice. Both are derived rather than stored — same as every other
 * billing figure in this module.
 *
 * Only a billed account can owe anything. A trial or a Free Access grant was
 * never invoiced, so its balance is zero. */
export type OutstandingBalance = {
  currency: Currency;
  /** An invoice past its due date and still unpaid. Only a Past Due account
   *  carries one; it is one cycle's recurring charge. */
  overdue: number;
  /** How overdue that invoice is, for the row's subtext. 0 when none. */
  daysPastDue: number;
  /** Seats added this cycle — still billed, prorated, on the final invoice.
   *  Seats REMOVED create no credit here, so this never goes negative. */
  pendingSeats: number;
  pendingSeatCharge: number;
  /** overdue + pendingSeatCharge. Zero means nothing is owed. */
  total: number;
};

/* Seats added inside the CURRENT billing cycle — the ones that land, prorated,
 * on the final invoice. `billing.seatChange` is the account's whole-history net
 * movement, a much larger number and the wrong one to bill against, so this
 * sums the seat EVENTS inside the cycle instead.
 *
 * The window is the cycle's own LENGTH counted back from today: ~30 days for a
 * monthly plan, a year for an annual one. Anchoring to the stored
 * nextBillingDate is not possible here — that date runs on the app's fixed
 * APP_TODAY while seat events are dated off the real clock (see getSeatEvents),
 * so the two calendars would not line up. Counting back keeps both sides on
 * one clock and gives the cycle now running.
 *
 * Removals are ignored: giving up seats produces no charge to collect. */
function seatsAddedThisCycle(company: Company, billing: CompanyBilling): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cycleDays = billing.billingCycle === "Annual" ? 365 : 30;
  const cycleStart = addDays(today, -cycleDays);
  return getSeatEvents(company).reduce((sum, e) => {
    if (e.delta <= 0) return sum;
    const d = new Date(e.date);
    return Number.isNaN(d.getTime()) || d < cycleStart ? sum : sum + e.delta;
  }, 0);
}
export function getOutstandingBalance(company: Company): OutstandingBalance {
  const billing = getCompanyBilling(company);
  const empty = {
    currency: billing.currency,
    overdue: 0,
    daysPastDue: 0,
    pendingSeats: 0,
    pendingSeatCharge: 0,
    total: 0,
  };
  if (!isBilledStatus(billing.status)) return empty;

  // The unpaid invoice is one cycle's recurring total — ratePerSeat is quoted
  // in the cycle's own unit, so rate x seats is that cycle's charge.
  const overdue = billing.status === "Past Due" ? billing.ratePerSeat * company.seats : 0;
  const daysPastDue = billing.status === "Past Due" ? billing.daysPastDue : 0;
  const pendingSeats = seatsAddedThisCycle(company, billing);
  const pendingSeatCharge = pendingSeats * billing.ratePerSeat;

  return {
    currency: billing.currency,
    overdue,
    daysPastDue,
    pendingSeats,
    pendingSeatCharge,
    total: overdue + pendingSeatCharge,
  };
}

// Deterministic fake Stripe customer id, stable per company — stands in for
// the real id Stripe would assign when a subscription is created.
const CUS_ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export function getStripeCustomerId(company: Company): string {
  let seed = hash(company.id);
  let id = "";
  for (let i = 0; i < 14; i++) {
    id += CUS_ID_CHARS[seed % CUS_ID_CHARS.length];
    seed = (seed * 1664525 + 1013904223) >>> 0;
  }
  return `cus_${id}`;
}

const FIRST =["James", "Maria", "David", "Sarah", "Michael", "Jessica", "Robert", "Linda", "Carlos", "Emily", "Daniel", "Ashley", "Kevin", "Tonya", "Brian", "Nicole"];
const LAST = ["Rodriguez", "Thompson", "Nguyen", "Patel", "Johnson", "Martinez", "Williams", "Brown", "Garcia", "Davis", "Miller", "Wilson", "Anderson", "Lee", "Walker", "Hall"];

/* "U-9" + the company's digits + the roster index — unique across companies
   (index is a single digit; rosters cap at 8) and outside the hand-authored
   users.ts id range, so the two namespaces never collide. */
function companyUserId(c: Company, i: number): string {
  return `U-9${c.id.replace(/\D/g, "").padStart(3, "0")}${i}`;
}

/* Company employees are generated, not part of the Manage Users roster, but
   their profile links must still resolve. This finds the employee behind a
   companyUserId and rebuilds them as a full User record for the standalone
   `?profile=` page (deterministic, like everything else derived here). */
export function findCompanyUserProfile(id: string): User | null {
  if (!/^U-9\d{4}$/.test(id)) return null;
  for (const c of companies) {
    const u = getCompanyUsers(c).find((x) => x.id === id);
    if (!u) continue;
    const h = hash(u.id + u.email);
    const isLead = u.role === "Account Holder" || u.role === "Admin" || u.role === "Manager";
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone:
        u.email === c.email && c.phone
          ? c.phone
          : `+1 (${212 + (h % 700)}) 555-01${String(h % 100).padStart(2, "0")}`,
      emailVerified: true,
      phoneVerified: h % 3 !== 0,
      userType: "B2B",
      companyName: c.name,
      role: u.role === "Account Holder" ? "Admin" : u.role,
      subscriptionStatus: "Subscriber",
      platform: "Stripe",
      joinedOn: `202${4 + (h % 2)}-${String((h % 12) + 1).padStart(2, "0")}-${String((h % 27) + 1).padStart(2, "0")}`,
      lastAccess: `2026-0${5 + (h % 2)}-${String((h % 22) + 1).padStart(2, "0")}`,
      ...(isLead
        ? { dashboardLastAccess: `2026-06-${String((h % 20) + 1).padStart(2, "0")}` }
        : {}),
    };
  }
  return null;
}

export function getCompanyUsers(c: Company): CompanyUser[] {
  const billing = getCompanyBilling(c);
  const h = hash(c.id);
  const count = Math.max(1, Math.min(8, billing.seatsUsed));
  const domain = c.email.includes("@") ? c.email.split("@")[1] : "company.com";
  const users: CompanyUser[] = [];
  for (let i = 0; i < count; i++) {
    const fn = FIRST[(h + i * 5) % FIRST.length];
    const ln = LAST[(h + i * 7) % LAST.length];
    const role: CompanyRole =
      i === 0 ? "Account Holder" : i <= 2 && count > 3 ? (i === 1 ? "Admin" : "Manager") : "Employee";
    const status: CompanyUser["status"] = i === 0 ? "Active" : (h + i) % 9 === 0 ? "Invited" : (h + i) % 13 === 0 ? "Deactivated" : "Active";
    users.push({
      id: companyUserId(c, i),
      name: `${fn} ${ln}`,
      email: i === 0 ? c.email : `${fn.toLowerCase()}.${ln.toLowerCase()}@${domain}`,
      role,
      region: billing.regions[(h + i) % billing.regions.length]?.name ?? REGIONS[0],
      seat: "Assigned",
      status,
      lastActive: status === "Invited" ? "—" : `${(h + i * 3) % 27 + 1}d ago`,
    });
  }
  return users;
}
