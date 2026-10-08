/**
 * Merge Accounts / Transfer Subscription data.
 *
 * Every account is a user of the live Users roster (users.ts) — name, email,
 * phone, company and plan are read off it whenever the pickers or the
 * comparison render, so a rename or a cancelled plan shows here at once, and a
 * finished merge or transfer writes straight back into it. What only these
 * flows need is derived per account: how it signs in, its learning-record
 * counts, and the cross-account conflicts that must be resolved before
 * merging.
 *
 * The duplicate "Marcus Rivera" pair (users.ts demo accounts, one of them B2B)
 * drives the happy path and the B2B-must-be-kept guard.
 */

import { formatShortDate } from "../formatDate";
import { mergeablePurchases } from "./userProfile";
import {
  getUsers,
  findAnyUser,
  mergedInto,
  planPriceLabel,
  type SubscriptionStatus,
  type User,
  type UserRole,
  type UserType,
} from "./users";

export type MergeSub = {
  plan: string;
  detail: string;
  price: string;
  active: boolean;
  /** A paid personal plan's billing cycle and where it's billed — together
   *  they're how the Subscription row names it ("Monthly · Stripe"). */
  cycle?: "Monthly" | "Annual";
  platform?: string;
  /** When a paid personal plan next renews, ISO. */
  renewsOn?: string;
  /** Set instead when it has been cancelled but runs to the end of its period. */
  cancelsOn?: string;
};

/** The Renewal Date row's value — the next renewal, or the date a cancelled
 *  plan runs out; empty for plans that don't renew. */
export function renewalLabel(sub: MergeSub): string {
  if (sub.cancelsOn) return `Cancels ${formatShortDate(sub.cancelsOn)}`;
  return sub.renewsOn ? formatShortDate(sub.renewsOn) : "";
}

/** The Subscription row's value: "Monthly · Stripe" for a paid personal plan,
 *  the plan's own name for everything else. */
export function subLabel(sub: MergeSub): string {
  return sub.cycle && sub.platform ? `${sub.cycle} · ${sub.platform}` : sub.plan;
}

/** A one-time purchase that moves with a merge — a paid Certification or a
 *  purchased attempt, off the account's profile (userProfile.ts). */
export type MergeAddon = {
  id: string;
  name: string;
  type: "Certification" | "Quiz Attempt";
  price: string;
};

export type MergeUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  created: string;
  initials: string;
  color: string;
  /** How the account signs in. "Phone" accounts are named by their phone
   *  number everywhere the flows name them; the rest by email (`loginId`). */
  login: string;
  company: string | null;
  /** The Manage-Users facets, so the Select Users picker can filter on the same
   *  vocabulary the rest of the app uses. `userType` is derived from `company`
   *  rather than stored — the two can never disagree that way. */
  role: UserRole;
  subscription: SubscriptionStatus;
  sub: MergeSub;
  addons: MergeAddon[];
  data: Record<string, number>;
};

/** The email or phone the account signs in with. */
export function loginId(u: MergeUser): string {
  return u.login === "Phone" ? u.phone : u.email;
}

export function userTypeOf(u: MergeUser): UserType {
  return u.company ? "B2B" : "B2C";
}

export type RecordSample = { name: string; meta: string };

export type ConflictDef = {
  id: string;
  cat: string;
  kind: string;
  title: string;
  note: string;
  primDetail: string;
  primMeta: string;
  secDetail: string;
  secMeta: string;
};

export const RECORD_KEYS = [
  "Task completions",
  "Quiz attempts",
  "Quiz-Section completions",
  "Hands-On Task submissions",
  "Certifications",
  "Skills",
  "Awards",
  "Path entries",
] as const;

/* The demo accounts' own sign-in and record counts, as the merge happy path
   was written against them. Everyone else's are derived (see below). */
const FIXTURES: Record<string, { login: string; data: Record<string, number> }> = {
  "U-4821": { login: "Google SSO", data: { "Task completions": 142, "Quiz attempts": 38, "Quiz-Section completions": 64, "Hands-On Task submissions": 21, Certifications: 9, Skills: 12, Awards: 5, "Path entries": 3 } },
  "U-7193": { login: "Email + Password", data: { "Task completions": 57, "Quiz attempts": 14, "Quiz-Section completions": 22, "Hands-On Task submissions": 9, Certifications: 4, Skills: 6, Awards: 2, "Path entries": 1 } },
  "U-3360": { login: "Apple SSO", data: { "Task completions": 34, "Quiz attempts": 9, "Quiz-Section completions": 15, "Hands-On Task submissions": 4, Certifications: 2, Skills: 3, Awards: 1, "Path entries": 1 } },
  "U-5582": { login: "Email + Password", data: { "Task completions": 201, "Quiz attempts": 52, "Quiz-Section completions": 88, "Hands-On Task submissions": 31, Certifications: 13, Skills: 18, Awards: 9, "Path entries": 4 } },
  "U-6014": { login: "Google SSO", data: { "Task completions": 12, "Quiz attempts": 3, "Quiz-Section completions": 6, "Hands-On Task submissions": 1, Certifications: 1, Skills: 2, Awards: 0, "Path entries": 1 } },
  "U-2298": { login: "Email + Password", data: { "Task completions": 78, "Quiz attempts": 19, "Quiz-Section completions": 30, "Hands-On Task submissions": 12, Certifications: 5, Skills: 8, Awards: 3, "Path entries": 2 } },
};

/* ── Everyone else ──
   Accounts outside the fixtures get their sign-in method and record counts
   deterministically from their id — same person, same facets as on Users, no
   second list of names to keep in sync. */

function mhash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const LOGINS = ["Email + Password", "Google SSO", "Apple SSO", "Phone"];

/* Whatever the account signs in with — having both contacts on file says
   nothing about which one that is. Only a missing contact rules one out. */
function loginFor(email: string, phone: string, company: string | null, k: number): string {
  if (!email) return "Phone";
  if (!phone) return company ? "Email + Password" : LOGINS[k % 3];
  if (company) return k % 4 === 3 ? "Phone" : "Email + Password";
  return LOGINS[k % LOGINS.length];
}
const AVATAR_COLORS = ["#5b8def", "#c98b3c", "#3ecf8e", "#c678dd", "#e0a458", "#56c2c2", "#e5687a"];

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** The plan a user's subscription means in billing terms — the same plan,
 *  price and dates the Users pill and the Full Profile show. */
function planFor(u: User): MergeSub {
  switch (u.subscriptionStatus) {
    case "Subscriber": {
      const cycle = u.cycle ?? "Monthly";
      const term = u.cancelsOn ? { cancelsOn: u.cancelsOn } : { renewsOn: u.renewsOn };
      return {
        plan: `Pro · ${cycle}`,
        detail: u.cancelsOn ? "Cancelling · runs to the end of the period" : `Active · renews ${cycle === "Annual" ? "annually" : "monthly"}`,
        price: planPriceLabel(cycle),
        active: true,
        cycle,
        platform: u.platform ?? "Stripe",
        ...term,
      };
    }
    case "Free Trial":
      return { plan: "Free Trial", detail: "Trial", price: "", active: false };
    case "Scholarship":
      return { plan: "Scholarship", detail: "Active · sponsored", price: "$0", active: true };
    case "Company Plan":
      return { plan: "Company Plan", detail: `Active · billed to ${u.companyName ?? "the company"}`, price: "Company-billed", active: true };
    case "Cancelled":
      return { plan: "Cancelled", detail: "Subscription ended", price: "", active: false };
    case "Starter":
      return { plan: "Starter", detail: "No active subscription", price: "", active: false };
  }
}


/** Completion counts scaled off one seed, so a heavy account is heavy in every
 *  record type rather than random per row. */
function recordsFor(k: number): Record<string, number> {
  const scale = 0.35 + ((k >>> 4) % 100) / 55;
  const base: Record<string, number> = {
    "Task completions": 96,
    "Quiz attempts": 26,
    "Quiz-Section completions": 44,
    "Hands-On Task submissions": 14,
    Certifications: 6,
    Skills: 9,
    Awards: 4,
    "Path entries": 2,
  };
  const out: Record<string, number> = {};
  for (const key of RECORD_KEYS) out[key] = Math.max(0, Math.round(base[key] * scale));
  return out;
}

/** An account's own record counts — the fixture's, or derived. */
function ownRecords(u: User): Record<string, number> {
  return FIXTURES[u.id]?.data ?? recordsFor(mhash(u.id));
}

/** The account as the Merge / Transfer flows see it, read off the live user.
 *  An account others were merged into counts their records as its own. */
export function mergeUserOf(u: User): MergeUser {
  const k = mhash(u.id);
  const company = u.companyName ?? null;
  const data = { ...ownRecords(u) };
  for (const id of mergedInto(u.id)) {
    const s = findAnyUser(id);
    if (!s) continue;
    for (const [key, n] of Object.entries(ownRecords(s))) data[key] = (data[key] ?? 0) + n;
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    created: formatShortDate(u.joinedOn),
    initials: initialsOf(u.name),
    color: AVATAR_COLORS[k % AVATAR_COLORS.length],
    login: FIXTURES[u.id]?.login ?? loginFor(u.email, u.phone, company, k),
    company,
    role: u.role,
    subscription: u.subscriptionStatus,
    sub: planFor(u),
    addons: mergeablePurchases(u).map((p) => ({
      id: p.key,
      name: p.item,
      type: p.kind as MergeAddon["type"],
      price: `$${p.amount}`,
    })),
    data,
  };
}

/** Every account on the live roster. */
export function getMergeUsers(): MergeUser[] {
  return getUsers().map(mergeUserOf);
}

export function findMergeUser(id: string | null): MergeUser | null {
  const u = id ? getUsers().find((x) => x.id === id) : undefined;
  return u ? mergeUserOf(u) : null;
}

/* The hand-authored head of each category — real-sounding records that lead the
 * list when a category is expanded. Everything past them is generated (see
 * `recordsFor` below), because a category that moves 142 records has to list
 * 142 rows, not four and an apology. */
const RECORD_SEEDS: Record<string, RecordSample[]> = {
  "Task completions": [
    { name: "Refrigerant Charging Procedure", meta: "Mar 8, 2024" },
    { name: "Thermostat Wiring Lab", meta: "Feb 22, 2024" },
    { name: "Recovery Machine Setup", meta: "Feb 3, 2024" },
    { name: "Sweat Soldering Lab", meta: "Jan 19, 2024" },
  ],
  "Quiz attempts": [
    { name: "Airflow Calibration Quiz", meta: "92% · Mar 2024" },
    { name: "Manifold Gauge Use", meta: "88% · Feb 2024" },
    { name: "EPA 608 Type I Final Exam", meta: "90% · Jan 2024" },
  ],
  "Quiz-Section completions": [
    { name: "Core Refrigerant Handling — Sec 2", meta: "Mar 2024" },
    { name: "Recovery & Recycling — Sec 1", meta: "Feb 2024" },
    { name: "Leak Detection — Sec 3", meta: "Feb 2024" },
  ],
  "Hands-On Task submissions": [
    { name: "Tankless Heater Lab", meta: "Approved Mar 2024" },
    { name: "PVC Pipe Joining Lab", meta: "Approved Feb 2024" },
    { name: "Field Visit – Brazing Joints", meta: "Approved Jan 2024" },
  ],
  Certifications: [
    { name: "EPA 608 Universal", meta: "Mar 2024" },
    { name: "HVAC Core Fundamentals", meta: "Feb 2024" },
    { name: "Refrigerant Recovery", meta: "Jan 2024" },
  ],
  Skills: [
    { name: "Refrigerant Handling", meta: "Proficient" },
    { name: "Brazing & Soldering", meta: "Expert" },
    { name: "System Evacuation", meta: "Proficient" },
  ],
  Awards: [
    { name: "EPA 608 Completion", meta: "Earned Jan 2024" },
    { name: "Fast Starter", meta: "Earned Dec 2023" },
  ],
  "Path entries": [
    { name: "HVAC JobReady Path", meta: "In progress · 60%" },
    { name: "Plumbing Fundamentals Path", meta: "Completed" },
  ],
};

/* 32 subjects × the per-category forms has to exceed the largest count in the
   data — Task completions reaches 201, so 32 × 7 = 224 leaves headroom. Add
   subjects here, not a numeric suffix, if a count ever outgrows it. */
const REC_SUBJECTS = [
  "Condenser Coil", "Evaporator Fan", "Compressor Valve", "Capillary Tube",
  "Expansion Valve", "Suction Line", "Discharge Line", "Filter Drier",
  "Condensate Pump", "Blower Motor", "Heat Exchanger", "Flue Vent",
  "Gas Manifold", "Pilot Assembly", "Limit Switch", "Pressure Switch",
  "Contactor Coil", "Capacitor Bank", "Thermostat Wiring", "Zone Damper",
  "Duct Static", "Airflow Balance", "Refrigerant Charge", "Leak Detection",
  "Vacuum Pull", "Brazed Joint", "Flare Fitting", "Line Set",
  "Reversing Valve", "Defrost Board", "Crankcase Heater", "Sight Glass",
];

const REC_FORMS: Record<string, string[]> = {
  "Task completions": ["Lab", "Procedure", "Walkthrough", "Practice", "Checkout", "Drill", "Inspection"],
  "Quiz attempts": ["Quiz", "Check", "Assessment", "Final Exam"],
  "Quiz-Section completions": ["— Sec 1", "— Sec 2", "— Sec 3", "— Sec 4"],
  "Hands-On Task submissions": ["Lab", "Field Visit", "Bench Test", "Site Check"],
  Certifications: ["Certificate", "Credential", "Endorsement"],
  Skills: ["Handling", "Service", "Diagnostics", "Repair"],
  Awards: ["Badge", "Award", "Recognition"],
  "Path entries": ["Path", "Track", "Program"],
};

const REC_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REC_LEVELS = ["Novice", "Proficient", "Expert"];

/** Deterministic per category, so an expanded list never reshuffles. */
function recHash(cat: string): number {
  let h = 2166136261;
  for (let k = 0; k < cat.length; k++) {
    h ^= cat.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/* Walking the subject × form space with a stride COPRIME to its size visits
   every pair exactly once before repeating — a permutation, not a sample. That
   is the difference between a list of distinct records and one littered with
   "Capillary Tube Lab 10", which is what independent hashing produced: 138
   draws from 196 pairs collide constantly (birthday paradox). */
function coprimeStride(size: number, seed: number): number {
  let stride = (seed % size) | 1;
  for (let i = 0; i < size; i++) {
    const candidate = ((stride + i * 2 - 1) % size) + 1;
    if (gcd(candidate, size) === 1) return candidate;
  }
  return 1;
}

function recMeta(cat: string, n: number): string {
  const month = REC_MONTHS[n % 12];
  const year = 2023 + (n % 3);
  switch (cat) {
    case "Task completions":
      return `${month} ${1 + (n % 28)}, ${year}`;
    case "Quiz attempts":
      return `${70 + (n % 30)}% · ${month} ${year}`;
    case "Quiz-Section completions":
      return `${month} ${year}`;
    case "Hands-On Task submissions":
      return `Approved ${month} ${year}`;
    case "Certifications":
      return `${month} ${year}`;
    case "Skills":
      return REC_LEVELS[n % REC_LEVELS.length];
    case "Awards":
      return `Earned ${month} ${year}`;
    default:
      return n % 2 === 0 ? "Completed" : `In progress · ${10 + (n % 9) * 10}%`;
  }
}

/**
 * Every record a category moves — the hand-authored ones first, then generated
 * rows to reach `count`. Expanding a category lists all of it, so the table is
 * the record of what is moving rather than a preview of it.
 */
export function categoryRecords(cat: string, count: number): RecordSample[] {
  const seeds = RECORD_SEEDS[cat] ?? [];
  if (count <= seeds.length) return seeds.slice(0, count);

  const forms = REC_FORMS[cat] ?? ["Record"];
  const pairs = REC_SUBJECTS.length * forms.length;
  const seed = recHash(cat);
  const stride = coprimeStride(pairs, seed);
  const offset = seed % pairs;

  const out = seeds.slice();
  const seen = new Set(out.map((r) => r.name));
  for (let i = 0; out.length < count; i++) {
    const idx = (offset + i * stride) % pairs;
    const subject = REC_SUBJECTS[idx % REC_SUBJECTS.length];
    const form = forms[Math.floor(idx / REC_SUBJECTS.length)];
    const name = `${subject} ${form}`;
    // Only reachable past `pairs` records, which no count here comes near.
    const unique = seen.has(name) ? `${name} ${out.length + 1}` : name;
    seen.add(unique);
    out.push({ name: unique, meta: recMeta(cat, (idx * 37 + seed) % 997) });
  }
  return out;
}

// Cross-account record conflicts. A learner can hold only one of each of these,
// so the merge must keep exactly one side's record.
export const conflictDefs: ConflictDef[] = [
  {
    id: "skill",
    cat: "Skills",
    kind: "SKILL",
    title: "Refrigerant Recovery",
    note: "this skill exists on both accounts at different proficiency. Keep one record.",
    primDetail: "Proficient",
    primMeta: "awarded Feb 2024",
    secDetail: "Expert",
    secMeta: "awarded Aug 2023",
  },
  {
    id: "path",
    cat: "Path entries",
    kind: "PATH",
    title: "EPA 608 Type I — Certification Path",
    note: "a learner can hold only one entry per Path. Keep one progress record.",
    primDetail: "35% complete",
    primMeta: "12 / 34 tasks · active Apr 2025",
    secDetail: "100% complete",
    secMeta: "34 / 34 tasks · finished Jun 2024",
  },
];
