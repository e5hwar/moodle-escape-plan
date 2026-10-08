import { companies } from "./companies";
import { certOverridesOf } from "./completions";
import { activeScholarshipOf } from "./scholarships";
import { isoAddMonths, isoOf, sharedStore, todayDate } from "./sharedStore";
import {
  findAnyUser,
  mergedInto,
  PLAN_PRICE,
  planPriceLabel,
  type BillingCycle,
  type Platform,
  type SubscriptionStatus,
  type User,
} from "./users";

export type Language = "English" | "Spanish";
// Goal selected during onboarding ("Which best describes you?").
export type OnboardingGoal =
  | "Looking for First Trades Job"
  | "Exploring Careers in the Skilled Trades"
  | "Focussed on Advancing Career"
  | "Other";
export type MeritTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export type EpaStatus =
  | "Order received"
  | "Accepted"
  | "In production"
  | "Shipped"
  | "Delivered"
  | "Action needed"
  | "Canceled"
  | "Refunded";

export type SkillBadge = {
  name: string;
  mastery: boolean;
  /** When the learner earned it — the Full Profile's Skills table sorts on this. */
  dateAwarded: string;
};

export type AwardRecord = {
  id: string;
  certification: string;
  meritTier: MeritTier;
  awardNumber: string;
  dateAwarded: string;
  /** Every Award has a Card; only some have a Certificate. */
  hasCertificate: boolean;
};

/** The profile's Subscription card — every date and figure read off the
 *  user record, so it says what the Users pill says. */
export type SubscriptionDetail = {
  status: SubscriptionStatus;
  platform?: Platform;
  cycle?: BillingCycle;
  /** "$24/mo" / "$199/yr" — personal plans only. */
  price?: string;
  startedOn?: string;
  /** A personal plan's next renewal. */
  renewsOn?: string;
  /** Set once the plan has been cancelled — it runs until this date. */
  cancelsOn?: string;
  /** When a Free Trial or a Scholarship ends, or a Cancelled plan ended. */
  endsOn?: string;
  offerCode?: string;
};

export type PurchaseKind =
  | "Subscription"
  | "Certification"
  | "Quiz Attempt"
  | "EPA Card";

/** Consumable certifications never expire (V1): access lasts until an admin
 *  revokes it from Who Paid. Non-consumables are lifetime. */
export type CertAccess = "Active" | "Revoked";
/** A purchased quiz attempt is either unused, mid-attempt, or used up. */
export type AttemptState = "Available" | "In Progress" | "Completed";

export type Purchase = {
  date: string;
  item: string;
  kind: PurchaseKind;
  amount: number;
  platform: string;
  receiptId: string;
  /** Certification purchases — whether the cert is consumable (revocable) or lifetime. */
  consumable?: boolean;
  /** Consumable certifications only — current access state. */
  certAccess?: CertAccess;
  /** Consumable certifications only — when an admin revoked access. */
  revokedOn?: string;
  /** Quiz Attempt purchases — whether the attempt is still available, in progress, or used. */
  attemptState?: AttemptState;
  /** Stripe/Google certs & quiz attempts that have already been refunded. */
  refunded?: boolean;
  /** Bought by the user's company rather than the user (B2B only) — the
   *  table flags it "Company Paid" beside the item (Figma 1290:2943). */
  companyPaid?: boolean;
  /** Stable id for this purchase — what a refund is recorded against
   *  (receipt ids aren't unique on their own). */
  key: string;
};

/* Refunds an admin issued from the Full Profile, by purchase key. Shared, like
   every other edit to a user, and the one thing that revokes an Award: a
   refunded Certification takes its Award with it. */
const refundStore = sharedStore<Record<string, true>>("refunds", {});
export const useRefunds = refundStore.use;
export function refundPurchase(key: string): void {
  refundStore.set((prev) => ({ ...prev, [key]: true }));
}

/** The Certification a purchase bought — "EPA 608 Universal (Certification)"
 *  → "EPA 608 Universal". */
function certOfPurchase(p: Purchase): string | null {
  return p.kind === "Certification" ? p.item.replace(/\s*\(Certification\)$/, "") : null;
}

export type EpaCardOrder = {
  certification: string;
  status: EpaStatus;
  orderedOn: string;
  recipient: string;
  shippingAddress: string;
  tracking?: { carrier: string; number: string; url: string; shippedOn: string };
};

export type NateDetail = { connectId: string; firstName: string; lastName: string; email: string };

export type ProfileFields = {
  language: Language;
  goal: OnboardingGoal;
  attribution: string;
  currentCompany?: string;
  zipCode: string;
  industryPreference: string;
  notificationPreference: "Enabled" | "Disabled";
};

export type UserProfile = {
  fields: ProfileFields;
  skills: SkillBadge[];
  portfolioUrl: string;
  awards: AwardRecord[];
  subscription: SubscriptionDetail;
  purchases: Purchase[];
  epaCard?: EpaCardOrder;
  nate?: NateDetail;
};

/* ── deterministic helpers (stable per user, no run-time randomness) ── */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const pick = <T,>(arr: T[], n: number): T => arr[n % arr.length];

/* The real today — the same clock the Users roster's renewals, trial ends and
   scholarship expiries count from, so the profile and the pill agree. */
const TODAY = todayDate();
/** Reference "today" for the generated data. */
export const PROFILE_TODAY = TODAY;
function daysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return isoOf(d);
}

/* A company can carry several trades; a user profile shows ONE industry, so
   it takes the company's first (primary) trade. Companies with none on file
   are absent from the map and fall back below. */
const companyIndustry = new Map(
  companies.filter((c) => c.industry.length > 0).map((c) => [c.name, c.industry[0]]),
);

const SKILLS: Record<string, string[]> = {
  HVAC: ["Refrigerant Handling", "Brazing & Soldering", "Superheat & Subcooling", "Electrical Diagnostics", "Airflow Balancing", "Heat Pump Service", "Combustion Analysis", "Thermostat Wiring"],
  Electrical: ["Circuit Analysis", "Conduit Bending", "Panel Installation", "Motor Controls", "Grounding & Bonding", "NEC Code Lookup"],
  Plumbing: ["Pipe Sizing", "Copper Soldering", "Drain Cleaning", "Backflow Prevention", "Fixture Installation"],
  Solar: ["PV Array Layout", "Inverter Setup", "Rapid Shutdown", "Roof Mounting", "String Sizing"],
  Refrigeration: ["Compressor Replacement", "Leak Detection", "Charging Procedures", "Defrost Controls"],
  "Appliance Repair": ["Appliance Diagnostics", "Sealed System Repair", "Control Board Testing"],
};
const MASTERY: Record<string, string[]> = {
  HVAC: ["HVAC Master Technician", "EPA 608 Certified"],
  Electrical: ["Master Electrician"],
  Plumbing: ["Master Plumber"],
  Solar: ["Certified Solar Installer"],
  Refrigeration: ["Refrigeration Specialist"],
  "Appliance Repair": ["Appliance Master Tech"],
};
const GENERIC_SKILLS = ["Workplace Safety", "Tool Identification", "Blueprint Reading", "Customer Service"];

const AWARD_CERTS: Record<string, string[]> = {
  HVAC: ["Intro to HVAC", "Using a Multimeter", "EPA 608 Universal", "Heat Pump Specialist", "Job-Ready HVAC Technician"],
  Electrical: ["Intro to Electrical", "Residential Wiring", "NEC Fundamentals", "Job-Ready Electrician"],
  Plumbing: ["Intro to Plumbing", "Drain & Sewer", "Job-Ready Plumber"],
  Solar: ["Solar PV Basics", "Grid-Tied Systems", "Job-Ready Solar Installer"],
  Refrigeration: ["Commercial Refrigeration", "EPA 608 Type II"],
  "Appliance Repair": ["Appliance Repair Basics", "Sealed Systems"],
};
const GENERIC_CERTS = ["Workplace Safety 101"];

const MERIT_TIERS: MeritTier[] = ["Bronze", "Silver", "Gold", "Platinum"];
const ATTRIBUTION = ["Google Ads", "Organic Search", "App Store Search", "TikTok Campaign", "Referral", "YouTube", "Partner: Snap-on", "Trade Show"];
const GOALS: OnboardingGoal[] = ["Looking for First Trades Job", "Exploring Careers in the Skilled Trades", "Focussed on Advancing Career", "Other"];
const ZIPS = ["94110", "10025", "77002", "60614", "30303", "85004", "98109", "33130", "19103", "80202", "78701", "97201"];

// Pools for NATE form entries — a user may register under a slightly different
// name or personal email than the one on their SkillCat profile.
const NATE_FIRST_NAMES = ["Robert", "Michael", "James", "David", "Daniel", "Christopher", "Matthew", "Anthony", "Joshua", "Andrew", "William", "Joseph"];
const NATE_LAST_NAMES = ["Johnson", "Williams", "Brown", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson"];
const NATE_EMAILS = ["rjohnson@outlook.com", "mwilliams@yahoo.com", "jbrown1987@gmail.com", "dgarcia@icloud.com", "danielm@gmail.com", "chris.davis@hotmail.com", "matt.tech@gmail.com", "anthony.hvac@yahoo.com", "jharris@gmail.com", "andrew.l@outlook.com", "wmoore@gmail.com", "joe.tech@icloud.com"];

export const ZIP_LOCATIONS: Record<string, { city: string; state: string; country: string }> = {
  "94110": { city: "San Francisco", state: "CA", country: "USA" },
  "10025": { city: "New York", state: "NY", country: "USA" },
  "77002": { city: "Houston", state: "TX", country: "USA" },
  "60614": { city: "Chicago", state: "IL", country: "USA" },
  "30303": { city: "Atlanta", state: "GA", country: "USA" },
  "85004": { city: "Phoenix", state: "AZ", country: "USA" },
  "98109": { city: "Seattle", state: "WA", country: "USA" },
  "33130": { city: "Miami", state: "FL", country: "USA" },
  "19103": { city: "Philadelphia", state: "PA", country: "USA" },
  "80202": { city: "Denver", state: "CO", country: "USA" },
  "78701": { city: "Austin", state: "TX", country: "USA" },
  "97201": { city: "Portland", state: "OR", country: "USA" },
};

function industryOf(user: User): string {
  if (user.userType === "B2B" && user.companyName) {
    return companyIndustry.get(user.companyName) ?? "HVAC";
  }
  const pool = ["HVAC", "Electrical", "Plumbing", "Solar", "Refrigeration", "Appliance Repair"];
  return pick(pool, hash(user.id + ":ind"));
}

/* A plain Skill is earned somewhere in the last 60–420 days, spread so no two
   in a list share a date — the Skills table sorts on it. */
function skillDate(h: number, i: number): string {
  return daysAgo(60 + ((h + i * 37) % 360) + i);
}

function awardNumber(seed: number): string {
  return (
    "SC-" +
    (seed % 36 ** 6).toString(36).toUpperCase().padStart(6, "0")
  );
}

function ownProfile(user: User): UserProfile {
  const h = hash(user.id);
  const industry = industryOf(user);
  const skillPool = SKILLS[industry] ?? GENERIC_SKILLS;
  const masteryPool = MASTERY[industry] ?? [];
  const certPool = AWARD_CERTS[industry] ?? GENERIC_CERTS;

  // Skills (badges) — a deterministic slice of the industry pool + generics.
  const skillCount = 4 + (h % 4); // 4–7
  const skills: SkillBadge[] = [];
  for (let i = 0; i < skillCount && i < skillPool.length; i++) {
    skills.push({ name: skillPool[i], mastery: false, dateAwarded: skillDate(h, i) });
  }
  // One generic skill for variety — pick one not already in the list.
  const extraGeneric = GENERIC_SKILLS.find((g) => !skills.some((s) => s.name === g));
  if (extraGeneric)
    skills.push({ name: extraGeneric, mastery: false, dateAwarded: skillDate(h, skills.length) });
  // Mastery Skills (earned when all linked Skills are earned) — so a Mastery
  // Skill is always dated after the plain Skills, inside the last 60 days.
  const masteryCount = h % 3 === 0 ? Math.min(2, masteryPool.length) : Math.min(1, masteryPool.length);
  for (let i = 0; i < masteryCount; i++) {
    skills.push({
      name: masteryPool[i],
      mastery: true,
      dateAwarded: daysAgo(5 + ((h + i * 17) % 55)),
    });
  }

  // Awards — one per completed Certification.
  const awardCount = 2 + (h % 3); // 2–4
  const awards: AwardRecord[] = [];
  for (let i = 0; i < awardCount && i < certPool.length; i++) {
    const cert = certPool[i];
    const isEpa = /EPA/.test(cert);
    const isJobReady = /Job-Ready|Specialist|Master/.test(cert);
    awards.push({
      id: `${user.id}-A${i}`,
      certification: cert,
      meritTier: pick(MERIT_TIERS, h + i * 7),
      awardNumber: awardNumber(h + i * 101),
      dateAwarded: daysAgo(30 + ((h + i * 53) % 300)),
      // Every Award has a Card; EPA is card-only, Job-Ready always has a Certificate.
      hasCertificate: isEpa ? false : isJobReady ? true : (h + i) % 2 === 0,
    });
  }

  // Subscription details — off the user record (the Users pill's source).
  const subscription = subscriptionOf(user, h);

  // EPA card — HVAC/Refrigeration users, sometimes.
  const epaEligible = industry === "HVAC" || industry === "Refrigeration";
  const epaStatuses: EpaStatus[] = ["Order received", "Accepted", "In production", "Shipped", "Delivered", "Action needed", "Canceled", "Refunded"];
  let epaCard: EpaCardOrder | undefined;
  if (epaEligible && h % 3 !== 2) {
    const status = pick(epaStatuses, h);
    const epaType = pick(["EPA 608 Universal", "EPA 608 Type I", "EPA 608 Type II", "EPA 608 Type III"], h + 5);
    const shipped = status === "Shipped" || status === "Delivered";
    epaCard = {
      certification: epaType,
      status,
      orderedOn: daysAgo(7 + (h % 40)),
      recipient: user.name,
      shippingAddress: `${100 + (h % 8900)} Main St, ${pick(["Austin, TX", "Denver, CO", "Phoenix, AZ", "Chicago, IL", "Miami, FL"], h)} ${pick(ZIPS, h)}`,
      tracking: shipped
        ? {
            carrier: pick(["USPS", "UPS", "FedEx"], h),
            number: "1Z" + (h % 36 ** 8).toString(36).toUpperCase().padStart(8, "0"),
            url: "https://tools.usps.com/go/TrackConfirmAction",
            shippedOn: daysAgo(2 + (h % 5)),
          }
        : undefined,
    };
  }

  // NATE — any user may have filled in the NATE form in the app; it is not tied
  // to industry preference or any other profile attribute. The name and email
  // they enter on the NATE form can differ from their profile.
  const nate: NateDetail | undefined =
    hash(user.id + ":nate") % 3 === 0
      ? {
          connectId: String(100000 + (h % 900000)),
          firstName: pick(NATE_FIRST_NAMES, hash(user.id + ":natefirst")),
          lastName: pick(NATE_LAST_NAMES, hash(user.id + ":natelast")),
          email: pick(NATE_EMAILS, hash(user.id + ":nateemail")),
        }
      : undefined;

  // Purchases / bills — subscription receipts + paid certs + quiz attempts + EPA card.
  // A company seat has no personal receipts (the company is billed), and a
  // Free Trial or Starter learner has bought nothing — only a physical EPA
  // card order, which anyone can place.
  const purchases: Purchase[] = subscriptionReceipts(user, subscription, h);
  const buys = user.subscriptionStatus !== "Free Trial" && user.subscriptionStatus !== "Starter";
  if (buys && awards.some((a) => /Job-Ready/.test(a.certification))) {
    // Job-Ready credential — purchased Certifications are permanent.
    purchases.push({
      date: daysAgo(90 + (h % 120)),
      item: `${awards.find((a) => /Job-Ready/.test(a.certification))!.certification} (Certification)`,
      kind: "Certification",
      amount: 180,
      platform: pick(["Stripe", "Google"], h + 4),
      receiptId: `RC-${(h + 7).toString(36).toUpperCase().slice(0, 6)}`,
      key: "", // set once the list is complete
      consumable: false,
      refunded: false,
    });
  }
  if (buys && (industry === "HVAC" || industry === "Refrigeration")) {
    // EPA 608 — a one-time purchase like any other Certification: it doesn't expire.
    purchases.push({
      date: daysAgo(120 + (h % 200)),
      item: `${pick(["EPA 608 Universal", "EPA 608 Type II"], h)} (Certification)`,
      kind: "Certification",
      amount: 45,
      platform: pick(["Stripe", "Google"], h + 2),
      receiptId: `RC-${(h + 17).toString(36).toUpperCase().slice(0, 6)}`,
      key: "", // set once the list is complete
      consumable: false,
      refunded: false,
    });
  }
  if (buys && nate) {
    const attempt = 1 + (h % 3);
    purchases.push({
      date: daysAgo(20 + (h % 40)),
      item: `NATE Ready To Work: ${["First", "Second", "Third"][attempt - 1]} Attempt`,
      kind: "Quiz Attempt",
      amount: attempt === 1 ? 60 : attempt === 2 ? 50 : 45,
      platform: pick(["Stripe", "Google"], h + 6),
      receiptId: `RC-${(h + 11).toString(36).toUpperCase().slice(0, 6)}`,
      key: "", // set once the list is complete
      attemptState: pick<AttemptState>(["Available", "In Progress", "Completed"], h + 1),
      refunded: false,
    });
  }
  if (buys && awards.some((a) => /Job-Ready/.test(a.certification))) {
    // A purchased certification-exam attempt tied to the Job-Ready track.
    purchases.push({
      date: daysAgo(15 + (h % 30)),
      item: `${industry} Certification Exam Attempt`,
      kind: "Quiz Attempt",
      amount: 25,
      platform: pick(["Stripe", "Google"], h + 8),
      receiptId: `RC-${(h + 19).toString(36).toUpperCase().slice(0, 6)}`,
      key: "", // set once the list is complete
      attemptState: pick<AttemptState>(["Available", "In Progress", "Completed"], h + 5),
      refunded: false,
    });
  }
  if (epaCard && epaCard.status !== "Canceled" && epaCard.status !== "Refunded") {
    purchases.push({
      date: epaCard.orderedOn,
      item: `${epaCard.certification} Physical Card`,
      kind: "EPA Card",
      amount: 60,
      platform: "Stripe",
      receiptId: `RC-${(h + 13).toString(36).toUpperCase().slice(0, 6)}`,
      key: "", // set once the list is complete
    });
  }
  purchases.sort((a, b) => b.date.localeCompare(a.date));

  // Certifications an admin awarded (or withdrew) in Manage Completions.
  for (const ov of certOverridesOf(user.id)) {
    if (ov.state === "complete") {
      if (!awards.some((a) => a.certification === ov.certName)) {
        const k = hash(user.id + ov.certName);
        awards.push({
          id: `${user.id}-M-${k.toString(36)}`,
          certification: ov.certName,
          meritTier: pick(MERIT_TIERS, k),
          awardNumber: awardNumber(k),
          dateAwarded: ov.on,
          hasCertificate: !/EPA/.test(ov.certName) && k % 2 === 0,
        });
      }
    }
    /* Marking a Certification incomplete never takes its Award away — the
       Award was earned when it was issued. Only a refund revokes one. */
  }

  /* Every purchase gets its key; a company's own purchases for a B2B user are
     flagged as Company Paid (deterministic, like the rest). Refunds recorded
     this session apply, and a refunded Certification revokes its Award. */
  const refunds = refundStore.get();
  purchases.forEach((p) => {
    p.key = `${user.id}|${p.date}|${p.item}|${p.receiptId}`;
    if (user.userType === "B2B" && p.kind !== "Subscription") p.companyPaid = hash(p.key) % 3 !== 0;
    if (refunds[p.key]) p.refunded = true;
  });
  for (const p of purchases) {
    const cert = p.refunded ? certOfPurchase(p) : null;
    if (!cert) continue;
    const i = awards.findIndex((a) => a.certification === cert);
    if (i >= 0) awards.splice(i, 1);
  }

  return {
    fields: {
      language: h % 5 === 0 ? "Spanish" : "English",
      goal: pick(GOALS, hash(user.id + ":goal")),
      attribution: pick(ATTRIBUTION, h),
      currentCompany: user.userType === "B2B" ? user.companyName : undefined,
      zipCode: pick(ZIPS, h),
      industryPreference: industry,
      notificationPreference: hash(user.id + ":notif") % 4 === 0 ? "Disabled" : "Enabled",
    },
    skills,
    portfolioUrl: `https://skillcat.app/p/${user.id.toLowerCase()}`,
    awards,
    subscription,
    purchases,
    epaCard,
    nate,
  };
}

/** A user's full profile. An account others were merged into also carries
 *  what came across with them — their Skills, Awards and purchases (one-time
 *  Certifications, attempts, physical cards), each listed once. */
export function buildUserProfile(user: User): UserProfile {
  const own = ownProfile(user);
  const secondaries = mergedInto(user.id)
    .map((id) => findAnyUser(id))
    .filter((u): u is User => !!u);
  if (!secondaries.length) return own;
  const skills = [...own.skills];
  const awards = [...own.awards];
  const purchases = [...own.purchases];
  for (const s of secondaries) {
    const p = ownProfile(s);
    p.skills.forEach((x) => skills.some((y) => y.name === x.name) || skills.push(x));
    p.awards.forEach((x) => awards.some((y) => y.certification === x.certification) || awards.push(x));
    // Every purchase moves — two of the same item are two purchases.
    purchases.push(...p.purchases.filter((x) => x.kind !== "Subscription"));
  }
  purchases.sort((a, b) => b.date.localeCompare(a.date));
  return { ...own, skills, awards, purchases };
}

/** One-time purchases a merge would move: paid Certifications and purchased
 *  attempts (Merge Accounts' Review step lists them). */
export function mergeablePurchases(user: User): Purchase[] {
  return buildUserProfile(user).purchases.filter(
    (p) => (p.kind === "Certification" || p.kind === "Quiz Attempt") && !p.refunded,
  );
}

function subscriptionOf(user: User, h: number): SubscriptionDetail {
  const status = user.subscriptionStatus;
  const personal = user.userType === "B2C" && (status === "Subscriber" || status === "Cancelled");
  const offerCode =
    personal && h % 4 === 0 ? pick(["WELCOME50", "TRADE20", "SPRING2026", "PARTNER15"], h) : undefined;
  switch (status) {
    case "Subscriber": {
      const cycle = user.cycle ?? "Monthly";
      const renews = user.renewsOn ?? isoAddMonths(isoOf(TODAY), 1);
      return {
        status,
        platform: user.platform,
        cycle,
        price: planPriceLabel(cycle),
        // A few cycles back from the renewal the plan is paid up to.
        startedOn: cycle === "Annual" ? isoAddMonths(renews, -12 * (1 + (h % 2))) : isoAddMonths(renews, -(2 + (h % 10))),
        renewsOn: user.cancelsOn ? undefined : renews,
        cancelsOn: user.cancelsOn,
        offerCode,
      };
    }
    case "Free Trial":
      return {
        status,
        startedOn: user.trialEndsOn ? isoAddDays(user.trialEndsOn, -14) : undefined,
        endsOn: user.trialEndsOn,
      };
    case "Scholarship": {
      const sch = activeScholarshipOf(user.id);
      return { status, startedOn: sch?.assignedOn, endsOn: sch?.expiresOn ?? user.scholarshipEndsOn };
    }
    case "Company Plan":
      return { status, startedOn: user.joinedOn };
    case "Cancelled":
      return { status, endsOn: user.cancelledOn, offerCode };
    case "Starter":
      return { status };
  }
}

function isoAddDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + n));
}

/** A personal plan's receipts — one per cycle already paid, at the plan's own
 *  price, back to when it started (the last three). */
function subscriptionReceipts(user: User, sub: SubscriptionDetail, h: number): Purchase[] {
  if (user.subscriptionStatus !== "Subscriber" || user.userType !== "B2C" || !sub.cycle) return [];
  const months = sub.cycle === "Annual" ? 12 : 1;
  const end = sub.cancelsOn ?? sub.renewsOn!;
  const out: Purchase[] = [];
  for (let m = 1; m <= 3; m++) {
    const date = isoAddMonths(end, -months * m);
    if (sub.startedOn && date < sub.startedOn) break;
    out.push({
      date,
      item: `Pro ${sub.cycle} Subscription`,
      kind: "Subscription",
      amount: PLAN_PRICE[sub.cycle],
      platform: user.platform ?? "Stripe",
      receiptId: `RC-${(h + m).toString(36).toUpperCase().slice(0, 6)}`,
      key: "", // set once the list is complete
    });
  }
  return out;
}
