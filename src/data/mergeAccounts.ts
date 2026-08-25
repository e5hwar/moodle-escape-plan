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
    created: "March 4, 2023",
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
    data: { "Task completions": 142, "Quiz attempts": 38, "Quiz-Section completions": 64, "Hands-On Task submissions": 21, Skills: 12, Awards: 5, "Path entries": 3 },
  },
  {
    id: "U-7193",
    name: "Marcus Rivera",
    email: "m.rivera@acmehvac.com",
    phone: "+1 (415) 555-0147",
    created: "January 18, 2024",
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
    data: { "Task completions": 57, "Quiz attempts": 14, "Quiz-Section completions": 22, "Hands-On Task submissions": 9, Skills: 6, Awards: 2, "Path entries": 1 },
  },
  {
    id: "U-3360",
    name: "Jordan Lee",
    email: "jordan.lee@outlook.com",
    phone: "+1 (503) 555-0119",
    created: "August 11, 2023",
    initials: "JL",
    color: "#3ecf8e",
    login: "Apple SSO",
    role: "Self-Learner",
    subscription: "Starter",
    company: null,
    sub: { plan: "Free", detail: "No active subscription", price: "—", active: false },
    addons: [],
    data: { "Task completions": 34, "Quiz attempts": 9, "Quiz-Section completions": 15, "Hands-On Task submissions": 4, Skills: 3, Awards: 1, "Path entries": 1 },
  },
  {
    id: "U-5582",
    name: "Tanya Okafor",
    email: "tanya.o@gmail.com",
    phone: "+1 (312) 555-0173",
    created: "February 2, 2022",
    initials: "TO",
    color: "#c678dd",
    login: "Email + Password",
    role: "Self-Learner",
    subscription: "Subscriber",
    company: null,
    sub: { plan: "Pro · Monthly", detail: "Active · renews monthly", price: "$24/mo", active: true },
    addons: [{ id: "epa608u", name: "EPA 608 Universal Certification", type: "Certification", price: "$79" }],
    data: { "Task completions": 201, "Quiz attempts": 52, "Quiz-Section completions": 88, "Hands-On Task submissions": 31, Skills: 18, Awards: 9, "Path entries": 4 },
  },
  {
    id: "U-6014",
    name: "Devon Brooks",
    email: "devon.brooks@yahoo.com",
    phone: "+1 (646) 555-0150",
    created: "November 23, 2023",
    initials: "DB",
    color: "#e0a458",
    login: "Google SSO",
    role: "Self-Learner",
    subscription: "Starter",
    company: null,
    sub: { plan: "Free", detail: "No active subscription", price: "—", active: false },
    addons: [],
    data: { "Task completions": 12, "Quiz attempts": 3, "Quiz-Section completions": 6, "Hands-On Task submissions": 1, Skills: 2, Awards: 0, "Path entries": 1 },
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
    data: { "Task completions": 78, "Quiz attempts": 19, "Quiz-Section completions": 30, "Hands-On Task submissions": 12, Skills: 8, Awards: 3, "Path entries": 2 },
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

/** Human-readable account-created date, matching the hand-authored rows. */
function longDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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
      return { plan: "Free trial", detail: `Trial · ${3 + (k % 11)} days left`, price: "—", active: false };
    case "Scholarship":
      return { plan: "Scholarship", detail: "Active · sponsored seat", price: "$0", active: true };
    case "Starter":
      return { plan: "Free", detail: "No active subscription", price: "—", active: false };
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
    created: longDate(u.joinedOn),
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

export const recordSamples: Record<string, RecordSample[]> = {
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
    { name: "HVAC Field Skills Path", meta: "In progress · 60%" },
    { name: "Plumbing Fundamentals Path", meta: "Completed" },
  ],
};

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
