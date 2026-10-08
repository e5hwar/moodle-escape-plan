import { isoDaysFromToday, sharedStore, todayIso } from "./sharedStore";
import { pooledScholarships } from "./learnerPool";

/* A scholarship names its recipient by id only — who they are (name, email,
   phone) is read off the Users roster wherever it is shown, so a rename there
   shows up here too. Recipients are always B2C: B2B users get Pro through their
   company. */
export type Scholarship = {
  id: string;
  userId: string;
  assignedOn: string; // ISO date
  expiresOn: string; // ISO date
  assignedBy: string;
};

/* Dates count from the real today, so the active ones stay active however
   long the prototype runs. The four users the roster marks "Scholarship" hold
   the active ones; the rest are lapsed history on other B2C accounts. */
const SEED: Scholarship[] = [
  { id: "SC-1031", userId: "U-10376", assignedOn: isoDaysFromToday(-120), expiresOn: isoDaysFromToday(62), assignedBy: "Akash Patel" },
  { id: "SC-1028", userId: "U-10903", assignedOn: isoDaysFromToday(-75), expiresOn: isoDaysFromToday(9), assignedBy: "Maya Chen" },
  { id: "SC-1026", userId: "U-11224", assignedOn: isoDaysFromToday(-30), expiresOn: isoDaysFromToday(150), assignedBy: "Priya Iyer" },
  { id: "SC-1025", userId: "U-11461", assignedOn: isoDaysFromToday(-12), expiresOn: isoDaysFromToday(170), assignedBy: "Akash Patel" },
  { id: "SC-1024", userId: "U-10044", assignedOn: isoDaysFromToday(-420), expiresOn: isoDaysFromToday(-240), assignedBy: "Akash Patel" },
  { id: "SC-1019", userId: "U-10089", assignedOn: isoDaysFromToday(-300), expiresOn: isoDaysFromToday(-120), assignedBy: "Maya Chen" },
  { id: "SC-1003", userId: "U-10203", assignedOn: isoDaysFromToday(-380), expiresOn: isoDaysFromToday(-200), assignedBy: "Diego Ramos" },
  { id: "SC-0991", userId: "U-10291", assignedOn: isoDaysFromToday(-210), expiresOn: isoDaysFromToday(-34), assignedBy: "Maya Chen" },
  // The generated learners on a Scholarship (learnerPool.ts).
  ...pooledScholarships(),
];

/** The live list — Scholarships writes it, and the Users roster reads it to
 *  decide who is on a Scholarship (see users.ts). Shared across tabs. */
export const scholarshipStore = sharedStore<Scholarship[]>("scholarships", SEED);
export const useScholarships = scholarshipStore.use;

/** `expiresOn` is the day access ends, so a scholarship is active only
 *  before it. Revoking just moves that date to today — there is no separate
 *  revoked state, and a revoked one is extended like any expired one. */
export function isScholarshipActive(s: Scholarship, today = todayIso()): boolean {
  return s.expiresOn > today;
}

/** The user's one running scholarship, if any. */
export function activeScholarshipOf(userId: string, list = scholarshipStore.get()): Scholarship | undefined {
  const today = todayIso();
  return list.find((s) => s.userId === userId && isScholarshipActive(s, today));
}
