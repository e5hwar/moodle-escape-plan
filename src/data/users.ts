import { useSyncExternalStore } from "react";
import { getLiveCompanies, subscribeLiveCompanies, companyEmployeesAsUsers, findCompanyUserProfile } from "./companies";
import { activeScholarshipOf, scholarshipStore, type Scholarship } from "./scholarships";
import { isoAddMonths, sharedStore, todayIso } from "./sharedStore";
import { closeRequestsOf } from "./nameChangeRequests";
import { learnerPool } from "./learnerPool";

export type UserType = "B2C" | "B2B";

/** Self-Learner is the only B2C role; the rest are B2B-only. */
export type UserRole = "Self-Learner" | "Employee" | "Manager" | "Admin";

export type SubscriptionStatus =
  | "Starter"
  | "Subscriber"
  | "Company Plan"
  | "Scholarship"
  | "Free Trial"
  | "Cancelled";

export type BillingCycle = "Monthly" | "Annual";

/** Billing platform — only meaningful when subscriptionStatus is "Subscriber". */
export type Platform = "Stripe" | "Apple" | "Google";

export type User = {
  id: string;
  name: string;
  /** Only one of email/phone is required — the other may be "" (not on file). */
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  userType: UserType;
  /** Only present for B2B users. */
  companyName?: string;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  /** Only present when subscriptionStatus is "Subscriber". */
  platform?: Platform;
  /** A Subscriber's billing cycle — the Subscription pill reads "Monthly · Apple".
   *  Only present when subscriptionStatus is "Subscriber". */
  cycle?: BillingCycle;
  /** Set on a Subscriber who has cancelled but is still inside the paid
   *  period — the table reads "Stripe · Cancels Aug 27, 2026". ISO date. */
  cancelsOn?: string;
  /** ISO date a Subscriber's plan next renews — the profile's Renews row, and
   *  the date a cancellation lands on (`cancelsOn` takes this value). */
  renewsOn?: string;
  /** ISO date a "Scholarship" user's scholarship expires — derived from the
   *  Scholarships list, never stored (see `getUsers`). */
  scholarshipEndsOn?: string;
  /** ISO date a "Free Trial" user's trial ends — the Subscription pill reads
   *  "Free Trial Ends Oct 9, 2026". */
  trialEndsOn?: string;
  /** ISO date a "Cancelled" user's plan ended. Drives the Subscription
   *  column's date and its sort (most recently cancelled first when desc). */
  cancelledOn?: string;
  /** ISO date the user joined SkillCat. */
  joinedOn: string;
  /** ISO date of the user's most recent access to the SkillCat app. */
  lastAccess: string;
  /** ISO date this user (a B2B Manager/Admin) last viewed the B2B Dashboard.
   *  Only ever set for role "Manager" or "Admin" — everyone else has no
   *  Dashboard access, so the column reads "—" for them. */
  dashboardLastAccess?: string;
};

/** Identity/role fields authored by hand; date + verification flags are
 *  augmented deterministically below so we don't hand-maintain 30 rows. */
type BaseUser = Omit<
  User,
  "emailVerified" | "phoneVerified" | "joinedOn" | "lastAccess" | "dashboardLastAccess" | "cancelledOn" | "trialEndsOn" | "cycle" | "renewsOn" | "scholarshipEndsOn"
>;

const baseUsers: BaseUser[] = [
  { id: "U-10044", name: "Marcus Holloway", email: "marcus.holloway@gmail.com", phone: "+1 (415) 555-0142", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10089", name: "Priya Venkatesan", email: "priya.v@outlook.com", phone: "+1 (213) 555-0181", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-10132", name: "Diego Ramirez", email: "diego.ramirez@arscooling.com", phone: "+1 (832) 555-0117", userType: "B2B", companyName: "ARS Cooling & Heating", role: "Admin", subscriptionStatus: "Company Plan" },
  { id: "U-10157", name: "Ayesha Khan", email: "ayesha.khan@arscooling.com", phone: "+1 (832) 555-0198", userType: "B2B", companyName: "ARS Cooling & Heating", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-10203", name: "Jordan Whitfield", email: "j.whitfield@gmail.com", phone: "+1 (404) 555-0103", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Apple", cancelsOn: "2026-08-27" },
  { id: "U-10248", name: "Sophia Andersson", email: "sophia.a@brennanhvac.com", phone: "", userType: "B2B", companyName: "Brennan HVAC Solutions", role: "Manager", subscriptionStatus: "Company Plan" },
  { id: "U-10291", name: "Tyrese Booker", email: "", phone: "+1 (470) 555-0166", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-10330", name: "Lena Petrov", email: "lena.petrov@deltaelectrical.com", phone: "+1 (305) 555-0177", userType: "B2B", companyName: "Delta Electrical Group", role: "Admin", subscriptionStatus: "Company Plan" },
  { id: "U-10376", name: "Carlos Mendoza", email: "carlos.mendoza@gmail.com", phone: "+1 (915) 555-0142", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-10412", name: "Hana Yamamoto", email: "hana.y@gmail.com", phone: "+1 (206) 555-0156", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Google" },
  { id: "U-10458", name: "Brandon O'Connor", email: "boconnor@evercleanplumbing.com", phone: "+1 (267) 555-0149", userType: "B2B", companyName: "EverClean Plumbing", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-10491", name: "Naomi Sato", email: "naomi.sato@gmail.com", phone: "+1 (503) 555-0189", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-10537", name: "Ezekiel Adeoye", email: "z.adeoye@deltaelectrical.com", phone: "+1 (404) 555-0121", userType: "B2B", companyName: "Delta Electrical Group", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-10584", name: "Mira Singh", email: "mira.singh@yahoo.com", phone: "+1 (718) 555-0162", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Apple" },
  { id: "U-10618", name: "Felix Becker", email: "felix.becker@harborcitymech.com", phone: "+1 (267) 555-0148", userType: "B2B", companyName: "Harbor City Mechanical", role: "Manager", subscriptionStatus: "Company Plan" },
  { id: "U-10655", name: "Olivia Tran", email: "olivia.tran@gmail.com", phone: "+1 (408) 555-0190", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-10692", name: "Samuel Okafor", email: "sam.okafor@greenshieldsolar.com", phone: "+1 (510) 555-0173", userType: "B2B", companyName: "Green Shield Solar", role: "Admin", subscriptionStatus: "Company Plan" },
  { id: "U-10731", name: "Isabella Rossi", email: "bella.rossi@gmail.com", phone: "+1 (917) 555-0128", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-10778", name: "Kwame Mensah", email: "kwame.m@harborcitymech.com", phone: "", userType: "B2B", companyName: "Harbor City Mechanical", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-10814", name: "Grace Liu", email: "grace.liu@gmail.com", phone: "", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Google", cancelsOn: "2026-09-02" },
  { id: "U-10859", name: "Mateo Garcia", email: "mateo.garcia@metropipe.com", phone: "+1 (713) 555-0184", userType: "B2B", companyName: "Metro Pipe & Drain", role: "Manager", subscriptionStatus: "Company Plan" },
  { id: "U-10903", name: "Chloe Bennett", email: "chloe.bennett@gmail.com", phone: "+1 (469) 555-0112", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-10948", name: "Raj Patel", email: "raj.patel@northstarrefrig.com", phone: "+1 (646) 555-0107", userType: "B2B", companyName: "NorthStar Refrigeration", role: "Admin", subscriptionStatus: "Company Plan" },
  { id: "U-10987", name: "Emma Schneider", email: "emma.s@gmail.com", phone: "+1 (303) 555-0193", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11021", name: "Andre Dubois", email: "andre.dubois@keystoneelectrical.com", phone: "+1 (215) 555-0146", userType: "B2B", companyName: "Keystone Electrical", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-11066", name: "Zoe Campbell", email: "zoe.campbell@gmail.com", phone: "+1 (480) 555-0175", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11103", name: "Yusuf Demir", email: "yusuf.demir@jetstreamair.com", phone: "+1 (623) 555-0131", userType: "B2B", companyName: "Jetstream Air Systems", role: "Manager", subscriptionStatus: "Company Plan" },
  { id: "U-11147", name: "Harper Wright", email: "harper.wright@gmail.com", phone: "+1 (615) 555-0168", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-11189", name: "Nina Kowalski", email: "nina.k@onyxcommercial.com", phone: "+1 (312) 555-0159", userType: "B2B", companyName: "Onyx Commercial Services", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-11224", name: "Theo Martin", email: "theo.martin@gmail.com", phone: "+1 (971) 555-0144", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-11268", name: "Devon Riley", email: "", phone: "+1 (313) 555-0136", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11302", name: "Alina Volkov", email: "alina.volkov@yahoo.com", phone: "+1 (702) 555-0151", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11347", name: "Malik Johnson", email: "", phone: "+1 (216) 555-0129", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11383", name: "Priscilla Nunez", email: "p.nunez@onyxcommercial.com", phone: "+1 (312) 555-0188", userType: "B2B", companyName: "Onyx Commercial Services", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-11419", name: "Owen Fitzgerald", email: "owen.fitz@gmail.com", phone: "+1 (802) 555-0164", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11429", name: "Renee Alvarado", email: "renee.alvarado@gmail.com", phone: "+1 (505) 555-0172", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11445", name: "Curtis Nwosu", email: "curtis.nwosu@gmail.com", phone: "+1 (773) 555-0118", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11475", name: "Bianca Ferraro", email: "bianca.ferraro@yahoo.com", phone: "+1 (508) 555-0143", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11524", name: "Josiah Pike", email: "josiah.pike@metropipe.com", phone: "+1 (713) 555-0196", userType: "B2B", companyName: "Metro Pipe & Drain", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-11452", name: "Dominique Carter", email: "dom.carter@jetstreamair.com", phone: "+1 (623) 555-0158", userType: "B2B", companyName: "Jetstream Air Systems", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-11461", name: "Tanvi Iyer", email: "tanvi.iyer@gmail.com", phone: "+1 (669) 555-0127", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-11484", name: "Gabriel Sousa", email: "gabriel.sousa@gmail.com", phone: "+1 (786) 555-0181", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Stripe", cancelsOn: "2026-07-22" },
  { id: "U-11496", name: "Leah Braun", email: "leah.braun@gmail.com", phone: "", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11541", name: "Aaron Mbeki", email: "aaron.mbeki@gmail.com", phone: "+1 (901) 555-0163", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-11560", name: "Hallie Nguyen", email: "hallie.nguyen@gmail.com", phone: "+1 (360) 555-0174", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
];

/** The status a user files under in Subscription filters and sorts. A
 *  Subscriber with an upcoming cancellation ("Cancels Nov 15, 2026") counts as
 *  Cancelled, not Subscriber — the raw status stays "Subscriber" because they
 *  keep access until `cancelsOn`. */
export function subscriptionFilterStatus(u: Pick<User, "subscriptionStatus" | "cancelsOn">): SubscriptionStatus {
  return u.subscriptionStatus === "Subscriber" && u.cancelsOn ? "Cancelled" : u.subscriptionStatus;
}

/** What the Subscription column says for a user — the Users table's pill
 *  label and the plain text every Users-table modal (Select Users, Grant Free
 *  Attempts) shows, so the wording can't drift: "Monthly · Apple" for a
 *  paying Subscriber, "Cancels Nov 15, 2026" once they've cancelled inside the
 *  paid period, "Free Trial Ends Oct 10, 2026", else the status itself. */
export function subscriptionText(
  u: Pick<User, "subscriptionStatus" | "platform" | "cycle" | "cancelsOn" | "trialEndsOn" | "scholarshipEndsOn">,
): string {
  const date = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  switch (u.subscriptionStatus) {
    case "Subscriber":
      return u.cancelsOn ? `Cancels ${date(u.cancelsOn)}` : `${u.cycle ?? "Monthly"} · ${u.platform ?? "Stripe"}`;
    case "Free Trial":
      return u.trialEndsOn ? `Free Trial Ends ${date(u.trialEndsOn)}` : "Free Trial";
    case "Scholarship":
      return u.scholarshipEndsOn ? `Scholarship Ends ${date(u.scholarshipEndsOn)}` : "Scholarship";
    default:
      return u.subscriptionStatus;
  }
}

/* ── Deterministic augmentation: join date, last access, verification flags ── */
function uhash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// Anchored to the real today (local midnight) so "Today" / "N days ago" on
// the Users page reads true — same anchoring as Companies' last-access stamps.
const USERS_TODAY = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
})();
function isoDaysAgo(n: number): string {
  const d = new Date(USERS_TODAY);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cycleOf(k: number): BillingCycle {
  return k % 2 === 0 ? "Annual" : "Monthly";
}

function augment(u: BaseUser): User {
  const k = uhash(u.id);
  // The next renewal sits inside the current cycle: 1–30 days out on a
  // monthly plan, 1–365 on an annual one.
  const renewsOn =
    u.subscriptionStatus === "Subscriber"
      ? isoDaysAgo(-(1 + (k % (cycleOf(k) === "Annual" ? 365 : 30))))
      : undefined;
  const isDashboardUser = u.role === "Manager" || u.role === "Admin";
  return {
    ...u,
    // Most emails verified; a deterministic minority not. A missing contact
    // (see User.email/phone) is never verified.
    emailVerified: !!u.email && k % 6 !== 0,
    phoneVerified: !!u.phone && k % 3 !== 0,
    // Joined 5 months – ~3 years ago.
    joinedOn: isoDaysAgo(150 + (k % 950)),
    // Last access within the past ~45 days (some users more recent than others).
    lastAccess: isoDaysAgo(k % 46),
    // Only Managers/Admins can view the B2B Dashboard, within the past ~90 days.
    dashboardLastAccess: isDashboardUser ? isoDaysAgo(k % 91) : undefined,
    // Subscribers split between monthly and annual plans.
    cycle: u.subscriptionStatus === "Subscriber" ? cycleOf(k) : undefined,
    renewsOn,
    // A cancellation runs to the end of the period already paid for, so it
    // lands on the renewal date (the seed's own dates only flag who).
    cancelsOn: u.cancelsOn && renewsOn ? renewsOn : undefined,
    // Free trials end 1–14 days out.
    trialEndsOn: u.subscriptionStatus === "Free Trial" ? isoDaysAgo(-(1 + (uhash(u.id + "|trial") % 14))) : undefined,
    // Cancelled plans ended 1–120 days ago.
    cancelledOn: u.subscriptionStatus === "Cancelled" ? isoDaysAgo(1 + (uhash(u.id + "|cancelled") % 120)) : undefined,
  };
}

/** The hand-authored roster. Kept for the pages that only need a stable list
 *  of people to hang generated data on (Who Paid, Quiz Attempts, proctoring);
 *  names and contacts follow edits (see `compute`). Everything that shows or
 *  changes a user reads the LIVE roster instead — `getUsers` / `useUsers`. */
export const users: User[] = baseUsers.map(augment);

/* The Merge / Transfer demo accounts — the duplicate "Marcus Rivera" pair the
   merge happy path leans on, and a few more learners. They are real users of
   the live roster (Users lists them, their profiles open), kept out of the
   `users` seed above so the pages that hash generated data over it don't
   reshuffle. */
const demoUsers: User[] = (
  [
    { id: "U-4821", name: "Marcus Rivera", email: "marcus.rivera@gmail.com", phone: "+1 (415) 555-0182", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Stripe" },
    { id: "U-7193", name: "Marcus Rivera", email: "m.rivera@arscooling.com", phone: "+1 (415) 555-0147", userType: "B2B", companyName: "ARS Cooling & Heating", role: "Employee", subscriptionStatus: "Company Plan" },
    { id: "U-3360", name: "Jordan Lee", email: "jordan.lee@outlook.com", phone: "+1 (503) 555-0119", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
    { id: "U-5582", name: "Tanya Okafor", email: "tanya.o@gmail.com", phone: "+1 (312) 555-0173", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Stripe" },
    { id: "U-6014", name: "Devon Brooks", email: "devon.brooks@yahoo.com", phone: "+1 (646) 555-0150", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
    { id: "U-2298", name: "Priya Nair", email: "priya.nair@arscooling.com", phone: "+1 (415) 555-0190", userType: "B2B", companyName: "ARS Cooling & Heating", role: "Manager", subscriptionStatus: "Company Plan" },
  ] as BaseUser[]
).map(augment);

/* 200 generated self-learners (learnerPool.ts) — they keep the live roster
   from being mostly Company Plan. Live-roster only, like the demo accounts. */
const pooledUsers: User[] = (learnerPool as BaseUser[]).map(augment);

/* Each account's name as first registered, before any rename — what an ID
   document uploaded back then reads (manageIds.ts). Captured at load, before
   any edit is laid over the seed. Company employees are regenerated unedited. */
const ORIGINAL_NAMES = new Map([...users, ...demoUsers, ...pooledUsers].map((u) => [u.id, u.name] as const));
export function originalName(id: string): string | undefined {
  return ORIGINAL_NAMES.get(id) ?? findCompanyUserProfile(id)?.name;
}

/* The seed only stores last-access DAYS. The hover tooltip wants a time too,
   so each user gets a deterministic working-hours time (07:00–19:59 Eastern,
   the zone the tooltip always prints) on that day — salted per stamp, and
   never later than "now" for today's visits. */
const momentCache = new Map<string, Date>();
export function accessMoment(userId: string, isoDay: string, salt: string): Date {
  // Sorting asks for this on every comparison, and the zone maths isn't cheap.
  const key = `${userId}|${isoDay}|${salt}`;
  const hit = momentCache.get(key);
  if (hit) return hit;
  const m = computeMoment(userId, isoDay, salt);
  momentCache.set(key, m);
  return m;
}
function computeMoment(userId: string, isoDay: string, salt: string): Date {
  const h = uhash(`${userId}|${salt}`);
  const [y, m, d] = isoDay.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 7 + (h % 13), h % 60);
  // ET's UTC offset on that day (EST/EDT): read the wall clock back in ET.
  const et = new Date(new Date(wall).toLocaleString("en-US", { timeZone: "America/New_York" }));
  const utc = new Date(new Date(wall).toLocaleString("en-US", { timeZone: "UTC" }));
  const at = wall + (utc.getTime() - et.getTime());
  const now = Date.now() - 5 * 60000;
  return new Date(Math.min(at, now));
}

/* ── Plans ── one price list, so the pill, the profile, its receipts and the
   Merge comparison all quote the same figure. */
export const PLAN_PRICE: Record<BillingCycle, number> = { Monthly: 24, Annual: 199 };
export function planPriceLabel(cycle: BillingCycle): string {
  return cycle === "Annual" ? `$${PLAN_PRICE.Annual}/yr` : `$${PLAN_PRICE.Monthly}/mo`;
}

/** A plan the learner pays for themselves (Stripe, Apple or Google). Company
 *  Plan, Scholarship and Free Trial are not personal plans. */
export function hasPersonalPlan(u: Pick<User, "subscriptionStatus">): boolean {
  return u.subscriptionStatus === "Subscriber";
}

/** Cancelling is only offered where we can do it: a personal plan billed by
 *  Stripe or Google (Apple subscriptions are managed by Apple), not already
 *  cancelling, on a B2C account (company seats are billed to the company). */
export function canCancelSubscription(u: User): boolean {
  return (
    u.userType === "B2C" &&
    u.subscriptionStatus === "Subscriber" &&
    !u.cancelsOn &&
    (u.platform === "Stripe" || u.platform === "Google")
  );
}

/** Free-text match on what the Users-style tables show: name, email and phone.
 *  The phone matches on DIGITS, from three up — "(415) 555", "415-555-0142"
 *  and "4155550142" all find "+1 (415) 555-0142". */
export function matchesUserQuery(q: string, u: { name: string; email?: string; phone?: string }): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  if (u.name.toLowerCase().includes(s)) return true;
  if ((u.email ?? "").toLowerCase().includes(s)) return true;
  if ((u.phone ?? "").toLowerCase().includes(s)) return true;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 3 && (u.phone ?? "").replace(/\D/g, "").includes(digits);
}

/* ── The live roster ──
   Every page that shows or edits a user reads this: the seed roster, the merge
   demo accounts and every company's employees (so Companies › View Employees
   and the Company filter land on real rows), with this session's edits laid
   over them. Edits are patches keyed by user id — `null` clears a field — and
   a merged-away account is recorded against the one it merged into. The store
   is shared across tabs (sharedStore.ts), so the Full Profile — its own tab —
   and the Users page always agree. */
type Patch = Partial<Record<keyof User, unknown>>;
type UsersState = {
  patches: Record<string, Patch>;
  /** Merged-away account id → the id of the account it merged into. */
  removed: Record<string, string>;
};
const userStore = sharedStore<UsersState>("users", { patches: {}, removed: {} });

function applyPatch(target: Record<string, unknown>, patch: Patch | undefined) {
  if (!patch) return;
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete target[k];
    else target[k] = v;
  }
}

/** A scholarship is the Scholarships list's to give and take: an active one
 *  makes the user a Scholarship user; once it is revoked or runs out, they
 *  drop to Starter. */
function withScholarship(u: User, list: Scholarship[]): User {
  if (u.userType !== "B2C") return u;
  const s = activeScholarshipOf(u.id, list);
  if (s) {
    const rest = { ...u };
    delete rest.platform;
    delete rest.cycle;
    delete rest.renewsOn;
    delete rest.cancelsOn;
    delete rest.trialEndsOn;
    delete rest.cancelledOn;
    return { ...rest, subscriptionStatus: "Scholarship", scholarshipEndsOn: s.expiresOn };
  }
  return u.subscriptionStatus === "Scholarship" ? { ...u, subscriptionStatus: "Starter" } : u;
}

let cache: { key: unknown[]; list: User[]; all: User[] } | null = null;
function compute() {
  const st = userStore.get();
  const companies = getLiveCompanies();
  const sch = scholarshipStore.get();
  const key = [st, companies, sch, todayIso()];
  if (cache && cache.key.every((k, i) => k === key[i])) return cache;
  const seedEmails = new Set([...users, ...demoUsers].map((u) => u.email).filter(Boolean));
  const employees = companyEmployeesAsUsers(companies).filter((u) => !seedEmails.has(u.email));
  const seed = new Set<User>(users);
  const all = [...users, ...demoUsers, ...pooledUsers, ...employees].map((u) => {
    // Seed objects take the patch in place as well, for the pages that hold
    // the seed array — a renamed learner reads renamed on Quiz Attempts too.
    if (seed.has(u)) applyPatch(u as unknown as Record<string, unknown>, st.patches[u.id]);
    const next = { ...u } as unknown as Record<string, unknown>;
    applyPatch(next, st.patches[u.id]);
    return withScholarship(next as unknown as User, sch);
  });
  cache = { key, all, list: all.filter((u) => !st.removed[u.id]) };
  return cache;
}

/** The live roster (merged-away accounts excluded). */
export function getUsers(): User[] {
  return compute().list;
}
function subscribeAll(l: () => void) {
  const a = userStore.subscribe(l);
  const b = scholarshipStore.subscribe(l);
  const c = subscribeLiveCompanies(l);
  return () => {
    a();
    b();
    c();
  };
}
export function useUsers(): User[] {
  return useSyncExternalStore(subscribeAll, getUsers);
}
export function findUser(id: string | null | undefined): User | undefined {
  return id ? getUsers().find((u) => u.id === id) : undefined;
}
export function useUser(id: string | null | undefined): User | undefined {
  const list = useUsers();
  return id ? list.find((u) => u.id === id) : undefined;
}
/** Any account, merged-away ones included — what a merged profile reads its
 *  Secondary's records from. */
export function findAnyUser(id: string): User | undefined {
  return compute().all.find((u) => u.id === id);
}
/** The accounts merged into this one, directly or through an earlier merge. */
export function mergedInto(primaryId: string): string[] {
  const removed = userStore.get().removed;
  const out: string[] = [];
  const walk = (id: string) => {
    for (const [sec, prim] of Object.entries(removed)) {
      if (prim === id && !out.includes(sec)) {
        out.push(sec);
        walk(sec);
      }
    }
  };
  walk(primaryId);
  return out;
}

export function patchUser(id: string, patch: Patch): void {
  userStore.set((prev) => ({
    ...prev,
    patches: { ...prev.patches, [id]: { ...prev.patches[id], ...patch } },
  }));
}

/* A name change from anywhere — an approved Name Change Request, Edit User,
   Exam Reviews' rename — lands here, so every page that names the user
   follows. */
export function renameUser(userId: string, name: string): void {
  patchUser(userId, { name });
}

/* Edit User (Users table and Full Profile) writes back here. A changed email
   or phone is no longer verified. */
export function updateUserContact(userId: string, v: { name: string; email: string; phone: string }): void {
  const u = findUser(userId);
  if (!u) return;
  patchUser(userId, {
    name: v.name,
    email: v.email,
    phone: v.phone,
    emailVerified: u.emailVerified && v.email === u.email,
    phoneVerified: u.phoneVerified && v.phone === u.phone,
  });
}

/** Cancels at the end of the period already paid for: the plan keeps running
 *  until its renewal date, which becomes `cancelsOn`. */
export function cancelSubscription(userId: string): void {
  const u = findUser(userId);
  if (!u || !canCancelSubscription(u)) return;
  patchUser(userId, { cancelsOn: u.renewsOn ?? isoAddMonths(todayIso(), 1) });
}

const NO_PLAN: Patch = { platform: null, cycle: null, renewsOn: null, cancelsOn: null, trialEndsOn: null };

function revokeActiveScholarship(userId: string) {
  const today = todayIso();
  scholarshipStore.set((list) =>
    list.map((s) =>
      s.userId === userId && s.expiresOn > today ? { ...s, expiresOn: today } : s,
    ),
  );
}

/** Transfer Subscription: the source's plan — a paid plan with its billing and
 *  renewal, or a scholarship — moves onto the destination, whose own plan is
 *  replaced; the source drops to Starter. */
export function transferSubscription(srcId: string, dstId: string): void {
  const src = findUser(srcId);
  const dst = findUser(dstId);
  if (!src || !dst) return;
  if (src.subscriptionStatus === "Scholarship") {
    const sch = activeScholarshipOf(srcId);
    if (!sch) return;
    revokeActiveScholarship(dstId);
    patchUser(dstId, { ...NO_PLAN, subscriptionStatus: "Starter", cancelledOn: null });
    scholarshipStore.set((list) => list.map((s) => (s.id === sch.id ? { ...s, userId: dstId } : s)));
    patchUser(srcId, { ...NO_PLAN, subscriptionStatus: "Starter" });
    return;
  }
  if (!hasPersonalPlan(src)) return;
  revokeActiveScholarship(dstId);
  patchUser(dstId, {
    ...NO_PLAN,
    subscriptionStatus: "Subscriber",
    platform: src.platform,
    cycle: src.cycle,
    renewsOn: src.renewsOn,
    cancelsOn: src.cancelsOn ?? null,
    cancelledOn: null,
  });
  patchUser(srcId, { ...NO_PLAN, subscriptionStatus: "Starter" });
}

/** What a merge does with the two accounts' plans. Only a personal plan
 *  (Stripe / Apple / Google) is in question:
 *  - one side has one → it ends up on the Primary (`carry` when it comes from
 *    the Secondary — replacing a Primary's scholarship, which ends);
 *  - both have one that is still renewing → blocked until one is cancelled. A
 *    plan already cancelling runs out on its own, so it never blocks — the
 *    renewing one wins;
 *  - a company account can't take a personal plan on top of its Company Plan,
 *    so a Secondary still renewing one blocks that merge too. */
export function mergePlanOutcome(
  p: User,
  s: User,
): { carry: boolean; blocked: null | "both" | "company" } {
  const pPlan = hasPersonalPlan(p);
  const sPlan = hasPersonalPlan(s);
  if (p.userType === "B2B" && sPlan && !s.cancelsOn) return { carry: false, blocked: "company" };
  if (pPlan && sPlan && !p.cancelsOn && !s.cancelsOn) return { carry: false, blocked: "both" };
  const carry = p.userType === "B2C" && sPlan && (!pPlan || (!!p.cancelsOn && !s.cancelsOn));
  return { carry, blocked: null };
}

/** Merge Accounts: the Secondary leaves the roster, recorded against the
 *  Primary, whose profile picks up its records and purchases (userProfile.ts),
 *  and its open Name Change Requests close. Its personal plan carries over per
 *  `mergePlanOutcome` — ending the Primary's scholarship if it had one; its
 *  scholarship history moves across too, a running one ended first when the
 *  Primary keeps a plan of its own. */
export function mergeAccounts(primaryId: string, secondaryId: string): void {
  const p = findUser(primaryId);
  const s = findUser(secondaryId);
  if (!p || !s) return;
  const { carry, blocked } = mergePlanOutcome(p, s);
  if (blocked) return;
  if (carry) {
    // The paid plan replaces a scholarship: it ends today.
    revokeActiveScholarship(primaryId);
    patchUser(primaryId, {
      ...NO_PLAN,
      subscriptionStatus: "Subscriber",
      platform: s.platform,
      cycle: s.cycle,
      renewsOn: s.renewsOn,
      cancelsOn: s.cancelsOn ?? null,
      cancelledOn: null,
    });
  }
  const primaryHasPlan =
    carry || p.subscriptionStatus === "Subscriber" || p.subscriptionStatus === "Company Plan" || p.subscriptionStatus === "Scholarship";
  if (primaryHasPlan) revokeActiveScholarship(secondaryId);
  scholarshipStore.set((list) => list.map((x) => (x.userId === secondaryId ? { ...x, userId: primaryId } : x)));
  userStore.set((prev) => ({ ...prev, removed: { ...prev.removed, [secondaryId]: primaryId } }));
  closeRequestsOf(secondaryId, "Merge");
}
