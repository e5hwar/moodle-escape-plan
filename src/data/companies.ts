export type Tier =
  | "Free Trial"
  | "Essentials"
  | "Growth"
  | "Pro"
  | "Complimentary Access";

export type BillingCycle = "Monthly" | "Annual";
export type Currency = "USD" | "CAD";
export type SignUpChannel = "Self Sign-Up" | "Internal Sign-Up";
export type PaymentCollection = "Automatic" | "Manual";
export type TaxStatus = "Taxable" | "Tax Exempt" | "Reverse Charge";
export type SubscriptionStatus =
  | "Active"
  | "Past Due"
  | "Free Trial"
  | "Trial Expired"
  | "Complimentary"
  | "Canceled";
export type CompanyRole = "Account Holder" | "Admin" | "Member";

export type CompanyUser = {
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
  tier: Tier;
  seats: number;
  industry: string;
  partnership: string;
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
  // Optional billing/subscription fields. When absent (seed data), they are
  // derived deterministically by getCompanyBilling(); when a company is created
  // through the wizard, the chosen values are stored here and take precedence.
  billingCycle?: BillingCycle;
  currency?: Currency;
  signUp?: SignUpChannel;
  payment?: PaymentCollection;
  status?: SubscriptionStatus;
  seatsUsed?: number;
  ratePerSeat?: number;
  taxStatus?: TaxStatus;
  /** Date a scheduled cancellation takes effect (e.g. "Aug 27"). Set when a
   *  subscription is cancelled through the UI; until that date the status pill
   *  reads "Cancels on …", after it reads "Canceled". */
  cancelsOn?: string;
};

export const TAX_STATUSES: TaxStatus[] = ["Taxable", "Tax Exempt", "Reverse Charge"];

export const TIERS: Tier[] = [
  "Free Trial",
  "Essentials",
  "Growth",
  "Pro",
  "Complimentary Access",
];

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "Active",
  "Past Due",
  "Free Trial",
  "Trial Expired",
  "Complimentary",
  "Canceled",
];

export const SIGN_UP_CHANNELS: SignUpChannel[] = ["Self Sign-Up", "Internal Sign-Up"];

/* Columns shown in the Manage Companies table. Company / Email / Tier / Status
 * always render; the rest are toggleable via the Edit Columns button. */
export type CompanyColumn =
  | "seats"
  | "seatsAdded"
  | "seatsRemoved"
  | "industry"
  | "partnership"
  | "signUp"
  | "createdOn";

export const COMPANY_OPTIONAL_COLUMNS: { key: CompanyColumn; label: string }[] = [
  { key: "signUp", label: "Sign-Up" },
  { key: "seats", label: "Seats" },
  { key: "seatsAdded", label: "Added" },
  { key: "seatsRemoved", label: "Removed" },
  { key: "industry", label: "Industry" },
  { key: "partnership", label: "Partnership" },
  { key: "createdOn", label: "Created On" },
];

export const COMPANY_FIXED_COLUMNS: { label: string }[] = [
  { label: "Company" },
  { label: "Email" },
  { label: "Tier" },
  { label: "Status" },
];

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
  {
    id: "CO-001",
    name: "ARS Cooling & Heating",
    email: "admin@arscooling.com",
    tier: "Pro",
    seats: 120,
    industry: "HVAC",
    partnership: "Preferred Partner",
  },
  {
    id: "CO-002",
    name: "Brennan HVAC Solutions",
    email: "training@brennanhvac.com",
    tier: "Growth",
    seats: 45,
    industry: "HVAC",
    partnership: "",
  },
  {
    id: "CO-003",
    name: "Comfort First Services",
    email: "hr@comfortfirst.com",
    tier: "Essentials",
    seats: 18,
    industry: "HVAC",
    partnership: "",
  },
  {
    id: "CO-004",
    name: "Delta Electrical Group",
    email: "ops@deltaelectrical.com",
    tier: "Pro",
    seats: 200,
    industry: "Electrical",
    partnership: "Elite Partner",
  },
  {
    id: "CO-005",
    name: "EverClean Plumbing",
    email: "admin@evercleanplumbing.com",
    tier: "Growth",
    seats: 60,
    industry: "Plumbing",
    partnership: "",
  },
  {
    id: "CO-006",
    name: "FastFix Appliance Repair",
    email: "team@fastfixappliance.com",
    tier: "Free Trial",
    seats: 5,
    industry: "Appliance Repair",
    partnership: "",
  },
  {
    id: "CO-007",
    name: "Green Shield Solar",
    email: "training@greenshieldsolar.com",
    tier: "Essentials",
    seats: 22,
    industry: "Solar",
    partnership: "",
  },
  {
    id: "CO-008",
    name: "Harbor City Mechanical",
    email: "hr@harborcitymech.com",
    tier: "Pro",
    seats: 85,
    industry: "HVAC",
    partnership: "Preferred Partner",
  },
  {
    id: "CO-009",
    name: "Integrity Roofing",
    email: "admin@integrityroofing.com",
    tier: "Free Trial",
    seats: 8,
    industry: "Roofing",
    partnership: "",
    status: "Trial Expired",
  },
  {
    id: "CO-010",
    name: "Jetstream Air Systems",
    email: "ops@jetstreamair.com",
    tier: "Growth",
    seats: 37,
    industry: "HVAC",
    partnership: "",
  },
  {
    id: "CO-011",
    name: "Keystone Electrical",
    email: "safety@keystoneelectrical.com",
    tier: "Essentials",
    seats: 14,
    industry: "Electrical",
    partnership: "",
  },
  {
    id: "CO-012",
    name: "LightPath Solar Co.",
    email: "admin@lightpathsolar.com",
    tier: "Complimentary Access",
    seats: 10,
    industry: "Solar",
    partnership: "NGO Partner",
  },
  {
    id: "CO-013",
    name: "Metro Pipe & Drain",
    email: "training@metropipe.com",
    tier: "Growth",
    seats: 50,
    industry: "Plumbing",
    partnership: "",
  },
  {
    id: "CO-014",
    name: "NorthStar Refrigeration",
    email: "hr@northstarrefrig.com",
    tier: "Pro",
    seats: 95,
    industry: "Refrigeration",
    partnership: "Elite Partner",
  },
  {
    id: "CO-015",
    name: "Onyx Commercial Services",
    email: "admin@onyxcommercial.com",
    tier: "Growth",
    seats: 42,
    industry: "HVAC",
    partnership: "",
  },
  {
    id: "CO-016",
    name: "PeakFit Construction",
    email: "learn@peakfitconstruction.com",
    tier: "Free Trial",
    seats: 3,
    industry: "Construction",
    partnership: "",
  },
  {
    id: "CO-017",
    name: "QuickSpark Electrical",
    email: "admin@quickspark.com",
    tier: "Essentials",
    seats: 28,
    industry: "Electrical",
    partnership: "",
  },
  {
    id: "CO-018",
    name: "Reliable Fire Protection",
    email: "training@reliablefire.com",
    tier: "Pro",
    seats: 130,
    industry: "Fire Protection",
    partnership: "Preferred Partner",
  },
  {
    id: "CO-019",
    name: "Sunridge Utilities",
    email: "ops@sunridgeutils.com",
    tier: "Complimentary Access",
    seats: 15,
    industry: "Utilities",
    partnership: "NGO Partner",
  },
  {
    id: "CO-020",
    name: "Total Comfort HVAC",
    email: "hr@totalcomforthvac.com",
    tier: "Growth",
    seats: 55,
    industry: "HVAC",
    partnership: "",
  },
  {
    id: "CO-021",
    name: "United Mechanical",
    email: "admin@unitedmechanical.com",
    tier: "Pro",
    seats: 175,
    industry: "HVAC",
    partnership: "Elite Partner",
  },
  {
    id: "CO-022",
    name: "Valley View Plumbing",
    email: "training@valleyviewplumbing.com",
    tier: "Essentials",
    seats: 20,
    industry: "Plumbing",
    partnership: "",
  },
  {
    id: "CO-023",
    name: "Wattwise Energy",
    email: "learn@wattwise.com",
    tier: "Free Trial",
    seats: 6,
    industry: "Solar",
    partnership: "",
    status: "Trial Expired",
  },
  {
    id: "CO-024",
    name: "Xcel Roofing & Sheet Metal",
    email: "admin@xcelmetal.com",
    tier: "Growth",
    seats: 33,
    industry: "Roofing",
    partnership: "",
  },
  {
    id: "CO-025",
    name: "Zephyr Climate Control",
    email: "hr@zephyrclimate.com",
    tier: "Pro",
    seats: 110,
    industry: "HVAC",
    partnership: "Preferred Partner",
  },
  {
    // Subscription scheduled to cancel at the end of the cycle — demonstrates
    // the grey "Cancels on …" status pill (vs. an already-ended "Canceled").
    id: "CO-026",
    name: "Apex Mechanical Group",
    email: "billing@apexmech.com",
    tier: "Growth",
    seats: 40,
    industry: "HVAC",
    partnership: "",
    status: "Canceled",
    cancelsOn: "Aug 27",
  },
];

// Distinct industry / partnership values present in the data, used to populate
// the Manage Companies filter pills.
export const COMPANY_INDUSTRIES = Array.from(
  new Set(companies.map((c) => c.industry).filter(Boolean)),
).sort();

export const COMPANY_PARTNERSHIPS = Array.from(
  new Set(companies.map((c) => c.partnership).filter(Boolean)),
).sort();

/* ───────────────── Pricing (Default Rates, per seat) ─────────────────
 * Section 21.3: set per Tier, per cycle, per currency. Annual rates are the
 * effective monthly per-seat cost when billed annually. Free Trial and
 * Complimentary Access are non-billed. */
export const PAID_TIERS: Tier[] = ["Essentials", "Growth", "Pro"];
export const BILLING_CYCLES: BillingCycle[] = ["Monthly", "Annual"];
export const CURRENCIES: Currency[] = ["USD", "CAD"];

export const DEFAULT_RATES: Record<
  "Essentials" | "Growth" | "Pro",
  Record<BillingCycle, Record<Currency, number>>
> = {
  Essentials: {
    Monthly: { USD: 49, CAD: 65 },
    Annual: { USD: 39, CAD: 52 },
  },
  Growth: {
    Monthly: { USD: 79, CAD: 105 },
    Annual: { USD: 63, CAD: 84 },
  },
  Pro: {
    Monthly: { USD: 119, CAD: 159 },
    Annual: { USD: 95, CAD: 127 },
  },
};

export function defaultRate(tier: Tier, cycle: BillingCycle, currency: Currency): number {
  if (tier === "Essentials" || tier === "Growth" || tier === "Pro") {
    return DEFAULT_RATES[tier][cycle][currency];
  }
  return 0;
}

export const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", CAD: "CA$" };

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
  ratePerSeat: number;
  seatsUsed: number;
  seatsTotal: number;
  seatsAdded: number;
  seatsRemoved: number;
  nextBillingDate: string;
  createdOn: string;
  monthlyTotal: number;
  regions: { name: string; seats: number }[];
  /** Days the latest invoice is overdue (drives the red "X Days Past Due" pill). */
  daysPastDue: number;
  /** Date a free trial ends, e.g. "Aug 27" (drives the yellow "Trial Ends On …" pill). */
  trialEndsOn: string;
  /** Effective date of a scheduled cancellation, e.g. "Aug 27". */
  cancelsOn: string;
  /** True when a cancellation is scheduled but the effective date hasn't passed
   *  ("Cancels on …"); false once it has taken effect ("Canceled"). */
  cancelScheduled: boolean;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getCompanyBilling(c: Company): CompanyBilling {
  const h = hash(c.id);

  const status: SubscriptionStatus =
    c.status ??
    (c.tier === "Free Trial"
      ? "Free Trial"
      : c.tier === "Complimentary Access"
      ? "Complimentary"
      : h % 17 === 0
      ? "Canceled"
      : h % 7 === 0
      ? "Past Due"
      : "Active");

  const billingCycle: BillingCycle = c.billingCycle ?? (h % 3 === 0 ? "Annual" : "Monthly");
  const currency: Currency = c.currency ?? (h % 4 === 0 ? "CAD" : "USD");
  const signUp: SignUpChannel = c.signUp ?? (c.partnership ? "Internal Sign-Up" : h % 2 === 0 ? "Self Sign-Up" : "Internal Sign-Up");
  const payment: PaymentCollection =
    c.payment ?? (signUp === "Internal Sign-Up" && h % 3 === 1 ? "Manual" : "Automatic");

  const ratePerSeat = c.ratePerSeat ?? defaultRate(c.tier, billingCycle, currency);
  const seatsTotal = c.seats;
  const seatsUsed = c.seatsUsed ?? Math.max(1, Math.min(seatsTotal, Math.round(seatsTotal * (0.55 + (h % 35) / 100))));
  const seatsAdded = (h >> 2) % 25;
  const seatsRemoved = (h >> 6) % 15;

  const billed = status === "Active";
  const monthlyTotal = billed ? ratePerSeat * seatsTotal : 0;

  // Everyone bills on the 1st (Section 21.5).
  const nextBillingDate =
    status === "Free Trial"
      ? "Trial — no invoice"
      : status === "Trial Expired"
      ? "Trial ended — no access"
      : status === "Complimentary"
      ? "Complimentary — no invoice"
      : status === "Canceled"
      ? "Canceled"
      : `${MONTHS[h % 12]} 1`;

  // Deterministic creation date: spread across 2021–2025.
  const createdYear = 2021 + (h % 5);
  const createdMonth = (h >> 3) % 12;
  const createdDay = 1 + ((h >> 7) % 28);
  const createdOn = `${MONTHS[createdMonth]} ${createdDay}, ${createdYear}`;

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

  // A short month-day date derived from the hash, reused by the status pills.
  const pillDate = `${MONTHS[(h >> 4) % 12]} ${1 + ((h >> 9) % 27)}`;

  // Past Due: invoices fall 1–89 days overdue.
  const daysPastDue = 1 + (h % 89);
  const trialEndsOn = pillDate;
  // A scheduled cancellation set through the UI carries its own effective date;
  // otherwise seed data alternates between scheduled ("Cancels on …") and ended.
  const cancelsOn = c.cancelsOn ?? pillDate;
  const cancelScheduled = c.cancelsOn ? true : (h >> 5) % 2 === 0;

  return {
    status,
    billingCycle,
    currency,
    signUp,
    payment,
    ratePerSeat,
    seatsUsed,
    seatsTotal,
    seatsAdded,
    seatsRemoved,
    nextBillingDate,
    createdOn,
    monthlyTotal,
    regions,
    daysPastDue,
    trialEndsOn,
    cancelsOn,
    cancelScheduled,
  };
}

/* Status pill shown in the Manage Companies table (Figma 109:1237). Maps a
 * subscription status to a colour tone and the label text to print. Only the
 * four statuses below are finalised; the rest fall back to a neutral grey pill
 * until their designs are confirmed. */
export type StatusPillTone = "green" | "red" | "yellow" | "grey" | "purple" | "secondary";

export function getStatusPill(billing: CompanyBilling): { tone: StatusPillTone; label: string } {
  switch (billing.status) {
    case "Active":
      return { tone: "green", label: "Active" };
    case "Past Due":
      return {
        tone: "red",
        label: `${billing.daysPastDue} ${billing.daysPastDue === 1 ? "Day" : "Days"} Past Due`,
      };
    case "Free Trial":
      return { tone: "yellow", label: `Trial Ends On ${billing.trialEndsOn}` };
    case "Trial Expired":
      return { tone: "purple", label: "Trial Ended" };
    case "Complimentary":
      return { tone: "secondary", label: "Complimentary Access" };
    case "Canceled":
      return billing.cancelScheduled
        ? { tone: "grey", label: `Cancels on ${billing.cancelsOn}` }
        : { tone: "grey", label: "Canceled" };
    default:
      return { tone: "grey", label: billing.status };
  }
}

const FIRST = ["James", "Maria", "David", "Sarah", "Michael", "Jessica", "Robert", "Linda", "Carlos", "Emily", "Daniel", "Ashley", "Kevin", "Tonya", "Brian", "Nicole"];
const LAST = ["Rodriguez", "Thompson", "Nguyen", "Patel", "Johnson", "Martinez", "Williams", "Brown", "Garcia", "Davis", "Miller", "Wilson", "Anderson", "Lee", "Walker", "Hall"];

export function getCompanyUsers(c: Company): CompanyUser[] {
  const billing = getCompanyBilling(c);
  const h = hash(c.id);
  const count = Math.max(1, Math.min(8, billing.seatsUsed));
  const domain = c.email.includes("@") ? c.email.split("@")[1] : "company.com";
  const users: CompanyUser[] = [];
  for (let i = 0; i < count; i++) {
    const fn = FIRST[(h + i * 5) % FIRST.length];
    const ln = LAST[(h + i * 7) % LAST.length];
    const role: CompanyRole = i === 0 ? "Account Holder" : i <= 2 && count > 3 ? "Admin" : "Member";
    const status: CompanyUser["status"] = i === 0 ? "Active" : (h + i) % 9 === 0 ? "Invited" : (h + i) % 13 === 0 ? "Deactivated" : "Active";
    users.push({
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
