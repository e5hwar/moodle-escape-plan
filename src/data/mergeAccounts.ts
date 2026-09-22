/**
 * Demo data for the Merge Accounts flow.
 *
 * A small pool of learner accounts plus the supporting fixtures the wizard
 * needs: sample completion records (shown when a record row is expanded) and
 * the cross-account conflicts that must be resolved before merging.
 *
 * Two accounts share the name "Marcus Rivera" so the happy-path demo (a likely
 * duplicate) works out of the box. One of them is B2B (belongs to a company),
 * which lets the B2B-must-be-primary guard be demonstrated by swapping roles.
 */

import { formatShortDate } from "../formatDate";
import {
  users,
  type SubscriptionStatus,
  type UserRole,
  type UserType,
} from "./users";

export type MergeSub = {
  plan: string;
  detail: string;
  price: string;
  active: boolean;
};

export type MergeAddon = {
  id: string;
  name: string;
  type: string;
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

const baseMergeUsers: MergeUser[] = [
  {
    id: "U-4821",
    name: "Marcus Rivera",
    email: "marcus.rivera@gmail.com",
    phone: "+1 (415) 555-0182",
    created: "Mar 4, 2023",
    initials: "MR",
    color: "#5b8def",
    login: "Google SSO",
    role: "Self-Learner",
    subscription: "Subscriber",
    company: null,
    sub: { plan: "Pro · Annual", detail: "Active · renews Mar 12, 2026", price: "$199/yr", active: true },
    addons: [
      { id: "epa608t1", name: "EPA 608 Type I Certification", type: "Certification", price: "$49" },
      { id: "quizpack", name: "12 Quiz Attempts Pack", type: "Quiz attempts", price: "$19" },
    ],
    data: { "Task completions": 142, "Quiz attempts": 38, "Quiz-Section completions": 64, "Hands-On Task submissions": 21, Certifications: 9, Skills: 12, Awards: 5, "Path entries": 3 },
  },
  {
    id: "U-7193",
    name: "Marcus Rivera",
    email: "m.rivera@acmehvac.com",
    phone: "+1 (415) 555-0147",
    created: "Jan 18, 2024",
    initials: "MR",
    color: "#c98b3c",
    login: "Email + Password",
    role: "Employee",
    subscription: "Subscriber",
    company: "Acme HVAC Co.",
    sub: { plan: "Team seat", detail: "Active · managed by Acme HVAC Co.", price: "Company-billed", active: true },
    addons: [
      { id: "epa608t1", name: "EPA 608 Type I Certification", type: "Certification", price: "$49" },
      { id: "natertw", name: "NATE RTW Certification", type: "Certification", price: "$59" },
    ],
    data: { "Task completions": 57, "Quiz attempts": 14, "Quiz-Section completions": 22, "Hands-On Task submissions": 9, Certifications: 4, Skills: 6, Awards: 2, "Path entries": 1 },
  },
  {
    id: "U-3360",
    name: "Jordan Lee",
    email: "jordan.lee@outlook.com",
    phone: "+1 (503) 555-0119",
    created: "Aug 11, 2023",
    initials: "JL",
    color: "#3ecf8e",
    login: "Apple SSO",
    role: "Self-Learner",
    subscription: "Starter",
    company: null,
    sub: { plan: "Free", detail: "No active subscription", price: "", active: false },
    addons: [],
    data: { "Task completions": 34, "Quiz attempts": 9, "Quiz-Section completions": 15, "Hands-On Task submissions": 4, Certifications: 2, Skills: 3, Awards: 1, "Path entries": 1 },
  },
  {
    id: "U-5582",
    name: "Tanya Okafor",
    email: "tanya.o@gmail.com",
    phone: "+1 (312) 555-0173",
    created: "Feb 2, 2022",
    initials: "TO",
    color: "#c678dd",
    login: "Email + Password",
    role: "Self-Learner",
    subscription: "Subscriber",
    company: null,
    sub: { plan: "Pro · Monthly", detail: "Active · renews monthly", price: "$24/mo", active: true },
    addons: [{ id: "epa608u", name: "EPA 608 Universal Certification", type: "Certification", price: "$79" }],
    data: { "Task completions": 201, "Quiz attempts": 52, "Quiz-Section completions": 88, "Hands-On Task submissions": 31, Certifications: 13, Skills: 18, Awards: 9, "Path entries": 4 },
  },
  {
    id: "U-6014",
    name: "Devon Brooks",
    email: "devon.brooks@yahoo.com",
    phone: "+1 (646) 555-0150",
    created: "Nov 23, 2023",
    initials: "DB",
    color: "#e0a458",
    login: "Google SSO",
    role: "Self-Learner",
    subscription: "Starter",
    company: null,
    sub: { plan: "Free", detail: "No active subscription", price: "", active: false },
    addons: [],
    data: { "Task completions": 12, "Quiz attempts": 3, "Quiz-Section completions": 6, "Hands-On Task submissions": 1, Certifications: 1, Skills: 2, Awards: 0, "Path entries": 1 },
  },
  {
    id: "U-2298",
    name: "Priya Nair",
    email: "priya.nair@acmehvac.com",
    phone: "+1 (415) 555-0190",
    created: "May 9, 2024",
    initials: "PN",
    color: "#56c2c2",
    login: "Email + Password",
    role: "Manager",
    subscription: "Subscriber",
    company: "Acme HVAC Co.",
    sub: { plan: "Team seat", detail: "Active · managed by Acme HVAC Co.", price: "Company-billed", active: true },
    data: { "Task completions": 78, "Quiz attempts": 19, "Quiz-Section completions": 30, "Hands-On Task submissions": 12, Certifications: 5, Skills: 8, Awards: 3, "Path entries": 2 },
    addons: [],
  },
];

/* ── The rest of the pool ──
   The six accounts above are hand-authored because the demo leans on them (the
   duplicate "Marcus Rivera" pair, one of them B2B, drives the happy path and
   the B2B-must-be-kept guard). The Select Users picker needs a real table's
   worth of rows behind its User Type / Subscription / Company / Role filters,
   though, so the remaining accounts are lifted from the Manage Users pool and
   given merge fixtures deterministically — same person, same facets, no second
   list of names to keep in sync. */

function mhash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const LOGINS = ["Email + Password", "Google SSO", "Apple SSO"];
const AVATAR_COLORS = ["#5b8def", "#c98b3c", "#3ecf8e", "#c678dd", "#e0a458", "#56c2c2", "#e5687a"];

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** The plan a Manage-Users subscription status means in billing terms. B2B
 *  Subscribers sit on a company-billed seat rather than their own plan. */
function planFor(status: SubscriptionStatus, company: string | null, k: number): MergeSub {
  switch (status) {
    case "Subscriber":
      return company
        ? { plan: "Team seat", detail: `Active · managed by ${company}`, price: "Company-billed", active: true }
        : k % 2 === 0
        ? { plan: "Pro · Annual", detail: "Active · renews annually", price: "$199/yr", active: true }
        : { plan: "Pro · Monthly", detail: "Active · renews monthly", price: "$24/mo", active: true };
    case "Free Trial":
      return { plan: "Free trial", detail: `Trial · ${3 + (k % 11)} days left`, price: "", active: false };
    case "Scholarship":
      return { plan: "Scholarship", detail: "Active · sponsored seat", price: "$0", active: true };
    case "Company Plan":
      return { plan: "Team seat", detail: `Active · billed to ${company ?? "the company"}`, price: "Company-billed", active: true };
    case "Cancelled":
      return { plan: "Cancelled", detail: "Subscription ended", price: "", active: false };
    case "Starter":
      return { plan: "Free", detail: "No active subscription", price: "", active: false };
  }
}

const ADDON_POOL: MergeAddon[] = [
  { id: "epa608t1", name: "EPA 608 Type I Certification", type: "Certification", price: "$49" },
  { id: "epa608u", name: "EPA 608 Universal Certification", type: "Certification", price: "$79" },
  { id: "natertw", name: "NATE RTW Certification", type: "Certification", price: "$59" },
  { id: "quizpack", name: "12 Quiz Attempts Pack", type: "Quiz attempts", price: "$19" },
];

/** Completion counts scaled off one seed, so a heavy account is heavy in every
 *  record type rather than random per row. */
function recordsFor(k: number): Record<string, number> {
  const scale = 0.35 + ((k >> 4) % 100) / 55;
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

const derivedUsers: MergeUser[] = users.map((u) => {
  const k = mhash(u.id);
  const company = u.companyName ?? null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    created: formatShortDate(u.joinedOn),
    initials: initialsOf(u.name),
    color: AVATAR_COLORS[k % AVATAR_COLORS.length],
    login: company ? "Email + Password" : LOGINS[k % LOGINS.length],
    company,
    role: u.role,
    subscription: u.subscriptionStatus,
    sub: planFor(u.subscriptionStatus, company, k),
    // Most accounts carry no one-time purchases; a deterministic third do.
    addons: k % 3 === 0 ? [ADDON_POOL[k % ADDON_POOL.length]] : [],
    data: recordsFor(k),
  };
});

export const mergeUsers: MergeUser[] = [...baseMergeUsers, ...derivedUsers];

/* The hand-authored head of each category — real-sounding records that lead the
 * list when a category is expanded. Everything past them is generated (see
 * `recordsFor` below), because a category that moves 142 records has to list
 * 142 rows, not four and an apology. */
const RECORD_SEEDS: Record<string, RecordSample[]> = {
  "Task completions": [
    { name: "Refrigerant Charging Procedure", meta: "T-2350 · Mar 8, 2024" },
    { name: "Thermostat Wiring Lab", meta: "T-2165 · Feb 22, 2024" },
    { name: "Recovery Machine Setup", meta: "T-1855 · Feb 3, 2024" },
    { name: "Sweat Soldering Lab", meta: "T-1488 · Jan 19, 2024" },
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
    { name: "Tankless Heater Lab", meta: "T-1321 · approved Mar 2024" },
    { name: "PVC Pipe Joining Lab", meta: "T-1555 · approved Feb 2024" },
    { name: "Field Visit – Brazing Joints", meta: "T-1432 · approved Jan 2024" },
  ],
  Certifications: [
    { name: "EPA 608 Universal", meta: "C-410 · Mar 2024" },
    { name: "HVAC Core Fundamentals", meta: "C-288 · Feb 2024" },
    { name: "Refrigerant Recovery", meta: "C-152 · Jan 2024" },
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
      return `T-${1000 + (n % 1800)} · ${month} ${1 + (n % 28)}, ${year}`;
    case "Quiz attempts":
      return `${70 + (n % 30)}% · ${month} ${year}`;
    case "Quiz-Section completions":
      return `${month} ${year}`;
    case "Hands-On Task submissions":
      return `T-${1000 + (n % 1800)} · approved ${month} ${year}`;
    case "Certifications":
      return `C-${100 + (n % 800)} · ${month} ${year}`;
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
