import { companies } from "./companies";
import type { Platform, SubscriptionStatus, User } from "./users";

export type Language = "English" | "Spanish";
export type CareerStage = "Apprentice" | "Journeyman" | "Master";
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

export type SkillBadge = { name: string; mastery: boolean };

export type AwardRecord = {
  id: string;
  certification: string;
  meritTier: MeritTier;
  awardNumber: string;
  dateAwarded: string;
  /** Every Award has a Card; only some have a Certificate. */
  hasCertificate: boolean;
};

export type SubscriptionDetail = {
  status: SubscriptionStatus;
  platform?: Platform;
  startedOn?: string;
  renewsOn?: string;
  offerCode?: string;
};

export type PurchaseKind =
  | "Subscription"
  | "Certification"
  | "Quiz Attempt"
  | "EPA Card";

export type Purchase = {
  date: string;
  item: string;
  kind: PurchaseKind;
  amount: number;
  platform: string;
  receiptId: string;
};

export type EpaCardOrder = {
  certification: string;
  status: EpaStatus;
  orderedOn: string;
  recipient: string;
  shippingAddress: string;
  tracking?: { carrier: string; number: string; url: string; shippedOn: string };
};

export type NateDetail = { connectId: string; name: string; email: string };

export type ProfileFields = {
  language: Language;
  careerStage: CareerStage;
  attribution: string;
  currentCompany?: string;
  zipCode: string;
  industryPreference: string;
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

const TODAY = new Date("2026-06-17");
function daysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysAhead(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const companyIndustry = new Map(companies.map((c) => [c.name, c.industry]));

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
const ZIPS = ["94110", "10025", "77002", "60614", "30303", "85004", "98109", "33130", "19103", "80202", "78701", "97201"];

function industryOf(user: User): string {
  if (user.userType === "B2B" && user.companyName) {
    return companyIndustry.get(user.companyName) ?? "HVAC";
  }
  const pool = ["HVAC", "Electrical", "Plumbing", "Solar", "Refrigeration", "Appliance Repair"];
  return pick(pool, hash(user.id + ":ind"));
}

function awardNumber(seed: number): string {
  return (
    "SC-" +
    (seed % 36 ** 6).toString(36).toUpperCase().padStart(6, "0")
  );
}

export function buildUserProfile(user: User): UserProfile {
  const h = hash(user.id);
  const industry = industryOf(user);
  const skillPool = SKILLS[industry] ?? GENERIC_SKILLS;
  const masteryPool = MASTERY[industry] ?? [];
  const certPool = AWARD_CERTS[industry] ?? GENERIC_CERTS;

  // Skills (badges) — a deterministic slice of the industry pool + generics.
  const skillCount = 4 + (h % 4); // 4–7
  const skills: SkillBadge[] = [];
  for (let i = 0; i < skillCount && i < skillPool.length; i++) {
    skills.push({ name: skillPool[i], mastery: false });
  }
  // One generic skill for variety — pick one not already in the list.
  const extraGeneric = GENERIC_SKILLS.find((g) => !skills.some((s) => s.name === g));
  if (extraGeneric) skills.push({ name: extraGeneric, mastery: false });
  // Mastery Skills (earned when all linked Skills are earned).
  const masteryCount = h % 3 === 0 ? Math.min(2, masteryPool.length) : Math.min(1, masteryPool.length);
  for (let i = 0; i < masteryCount; i++) {
    skills.push({ name: masteryPool[i], mastery: true });
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

  // Subscription details.
  const usesOffer = (h % 4) === 0;
  const subscription: SubscriptionDetail = {
    status: user.subscriptionStatus,
    platform: user.platform,
    startedOn:
      user.subscriptionStatus === "Free Trial"
        ? daysAgo(h % 7)
        : daysAgo(60 + (h % 300)),
    renewsOn:
      user.subscriptionStatus === "Subscriber"
        ? daysAhead(30 - (h % 28))
        : user.subscriptionStatus === "Free Trial"
        ? daysAhead(14 - (h % 7))
        : undefined,
    offerCode:
      usesOffer && user.subscriptionStatus !== "Scholarship"
        ? pick(["WELCOME50", "TRADE20", "SPRING2026", "PARTNER15"], h)
        : undefined,
  };

  // EPA card — HVAC/Refrigeration users who aren't on Free Trial, sometimes.
  const epaEligible = (industry === "HVAC" || industry === "Refrigeration") && user.subscriptionStatus !== "Free Trial";
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

  // NATE — some HVAC/Refrigeration users have completed a NATE exam.
  const nate: NateDetail | undefined =
    (industry === "HVAC" || industry === "Refrigeration") && h % 2 === 0
      ? {
          connectId: "NATE-" + (100000 + (h % 900000)),
          name: user.name,
          email: user.email,
        }
      : undefined;

  // Purchases / bills — subscription receipts + paid certs + quiz attempts + EPA card.
  const purchases: Purchase[] = [];
  const platform = user.platform ?? "Stripe";
  if (user.subscriptionStatus === "Subscriber") {
    const price = 29;
    for (let m = 0; m < 3; m++) {
      purchases.push({
        date: daysAgo(m * 30 + (h % 5)),
        item: "Pro Monthly Subscription",
        kind: "Subscription",
        amount: price,
        platform,
        receiptId: `RC-${(h + m).toString(36).toUpperCase().slice(0, 6)}`,
      });
    }
  } else if (user.subscriptionStatus === "Starter") {
    purchases.push({
      date: daysAgo(40 + (h % 60)),
      item: "Starter Monthly Subscription",
      kind: "Subscription",
      amount: 12,
      platform,
      receiptId: `RC-${h.toString(36).toUpperCase().slice(0, 6)}`,
    });
  }
  if (awards.some((a) => /Job-Ready/.test(a.certification))) {
    purchases.push({
      date: daysAgo(90 + (h % 120)),
      item: `${awards.find((a) => /Job-Ready/.test(a.certification))!.certification} (Certification)`,
      kind: "Certification",
      amount: 180,
      platform: "Stripe",
      receiptId: `RC-${(h + 7).toString(36).toUpperCase().slice(0, 6)}`,
    });
  }
  if (nate) {
    const attempt = 1 + (h % 3);
    purchases.push({
      date: daysAgo(20 + (h % 40)),
      item: `NATE Ready To Work: ${["First", "Second", "Third"][attempt - 1]} Attempt`,
      kind: "Quiz Attempt",
      amount: attempt === 1 ? 60 : attempt === 2 ? 50 : 45,
      platform: "Stripe",
      receiptId: `RC-${(h + 11).toString(36).toUpperCase().slice(0, 6)}`,
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
    });
  }
  purchases.sort((a, b) => b.date.localeCompare(a.date));

  return {
    fields: {
      language: h % 5 === 0 ? "Spanish" : "English",
      careerStage: pick<CareerStage>(["Apprentice", "Journeyman", "Master"], h),
      attribution: pick(ATTRIBUTION, h),
      currentCompany: user.userType === "B2B" ? user.companyName : undefined,
      zipCode: pick(ZIPS, h),
      industryPreference: industry,
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
