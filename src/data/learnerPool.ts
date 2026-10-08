import type { BillingCycle, Platform, SubscriptionStatus } from "./users";
import { isoDaysFromToday } from "./sharedStore";

/* ── Generated B2C learners ──
 * Every company's employees are on the Users roster, which left Company Plan
 * outnumbering everyone else about seven to one. These 200 self-learners even
 * it out: a deterministic mix of Subscribers (some cancelling), Free Trials,
 * Starters, lapsed Cancelled plans and Scholarships, with names, contacts and
 * platforms drawn from fixed pools so every load reads the same.
 *
 * They live in their own module — not the hand-authored `users` seed — so the
 * pages that hash generated data over that seed (Who Paid, Quiz Attempts,
 * proctoring) don't reshuffle. users.ts adds them to the live roster;
 * scholarships.ts gives the Scholarship ones their records. */

export type PooledLearner = {
  id: string;
  name: string;
  email: string;
  phone: string;
  userType: "B2C";
  role: "Self-Learner";
  subscriptionStatus: SubscriptionStatus;
  platform?: Platform;
  cycle?: BillingCycle;
  /** Any value marks a Subscriber who has cancelled; users.ts sets the date. */
  cancelsOn?: string;
};

const FIRST = [
  "Aiden", "Bella", "Caleb", "Daria", "Elijah", "Fatima", "Gavin", "Hailey", "Isaac", "Jade",
  "Kofi", "Lucia", "Mason", "Nadia", "Omar", "Paige", "Quinn", "Rosa", "Silas", "Talia",
  "Uriel", "Vanessa", "Wyatt", "Ximena", "Yara", "Zane", "Andre", "Brianna", "Cody", "Dalia",
  "Ethan", "Freya", "Gideon", "Hector", "Imani", "Javier", "Keisha", "Logan", "Maya", "Nico",
];
const LAST = [
  "Abbott", "Bishop", "Castillo", "Dawson", "Ellison", "Flores", "Grant", "Hughes", "Ibarra", "Jensen",
  "Kemp", "Lawson", "Moreno", "Nash", "Ortiz", "Porter", "Quintero", "Reyes", "Sutton", "Tate",
  "Underwood", "Vega", "Warner", "Young", "Zamora", "Baxter", "Cortez", "Dunn", "Fowler", "Holt",
];
const DOMAINS = ["gmail.com", "gmail.com", "gmail.com", "yahoo.com", "outlook.com", "icloud.com", "hotmail.com"];
const AREAS = [205, 212, 214, 303, 312, 404, 415, 469, 503, 512, 602, 615, 617, 702, 713, 773, 786, 813, 858, 919];

/* Out of every 20 learners: 8 Subscribers (2 of them cancelling), 3 Free
   Trials, 4 Starters, 3 Cancelled, 2 Scholarships. */
const STATUS_CYCLE: [SubscriptionStatus, boolean][] = [
  ["Subscriber", false], ["Starter", false], ["Subscriber", false], ["Free Trial", false],
  ["Subscriber", true], ["Cancelled", false], ["Subscriber", false], ["Starter", false],
  ["Scholarship", false], ["Subscriber", false], ["Free Trial", false], ["Cancelled", false],
  ["Subscriber", true], ["Starter", false], ["Subscriber", false], ["Free Trial", false],
  ["Scholarship", false], ["Subscriber", false], ["Cancelled", false], ["Starter", false],
];
const PLATFORMS: Platform[] = ["Stripe", "Stripe", "Apple", "Google"];

function h32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const LEARNER_POOL_SIZE = 200;

/* Walking first × last with a stride coprime to both pool sizes gives 200
   distinct names (1200 pairs) with no repeats and no "Name 2" suffixes. */
export const learnerPool: PooledLearner[] = Array.from({ length: LEARNER_POOL_SIZE }, (_, i) => {
  const id = `U-2${String(i + 1).padStart(4, "0")}`;
  const k = h32(id);
  const first = FIRST[(i * 7) % FIRST.length];
  const last = LAST[(i * 11 + Math.floor(i / FIRST.length)) % LAST.length];
  const [status, cancelling] = STATUS_CYCLE[i % STATUS_CYCLE.length];
  // About one in eight signs in by phone alone; one in nine has no phone.
  const noEmail = k % 8 === 0;
  const noPhone = !noEmail && k % 9 === 0;
  const learner: PooledLearner = {
    id,
    name: `${first} ${last}`,
    email: noEmail ? "" : `${first.toLowerCase()}.${last.toLowerCase()}${k % 3 === 0 ? (k % 90) + 10 : ""}@${DOMAINS[k % DOMAINS.length]}`,
    phone: noPhone ? "" : `+1 (${AREAS[k % AREAS.length]}) 555-0${String(100 + (k % 900)).slice(0, 3)}`,
    userType: "B2C",
    role: "Self-Learner",
    subscriptionStatus: status,
  };
  if (status === "Subscriber") {
    learner.platform = PLATFORMS[(k >>> 4) % PLATFORMS.length];
    if (cancelling) learner.cancelsOn = "yes";
  }
  return learner;
});

/** The pooled Scholarship learners' scholarships — assigned 1–6 months ago,
 *  ending 1–6 months out (one in three inside the 14-day "expiring" window). */
export function pooledScholarships(): {
  id: string;
  userId: string;
  assignedOn: string;
  expiresOn: string;
  assignedBy: string;
}[] {
  const ASSIGNERS = ["Akash Patel", "Maya Chen", "Priya Iyer", "Diego Ramos"];
  return learnerPool
    .filter((l) => l.subscriptionStatus === "Scholarship")
    .map((l, i) => {
      const k = h32(l.id + "|sch");
      return {
        id: `SC-2${String(i + 1).padStart(3, "0")}`,
        userId: l.id,
        assignedOn: isoDaysFromToday(-(30 + (k % 150))),
        expiresOn: isoDaysFromToday(i % 3 === 0 ? 2 + (k % 12) : 30 + (k % 150)),
        assignedBy: ASSIGNERS[k % ASSIGNERS.length],
      };
    });
}
