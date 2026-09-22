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

/** Billing platform — only meaningful when subscriptionStatus is "Subscriber". */
export type Platform = "Stripe" | "Apple" | "Google";

export type User = {
  id: string;
  name: string;
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
  /** Set on a Subscriber who has cancelled but is still inside the paid
   *  period — the table reads "Stripe · Cancels Aug 27, 2026". ISO date. */
  cancelsOn?: string;
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
  "emailVerified" | "phoneVerified" | "joinedOn" | "lastAccess" | "dashboardLastAccess" | "cancelledOn"
>;

const baseUsers: BaseUser[] = [
  { id: "U-10044", name: "Marcus Holloway", email: "marcus.holloway@gmail.com", phone: "+1 (415) 555-0142", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10089", name: "Priya Venkatesan", email: "priya.v@outlook.com", phone: "+1 (213) 555-0181", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-10132", name: "Diego Ramirez", email: "diego.ramirez@arscooling.com", phone: "+1 (832) 555-0117", userType: "B2B", companyName: "ARS Cooling & Heating", role: "Admin", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10157", name: "Ayesha Khan", email: "ayesha.khan@arscooling.com", phone: "+1 (832) 555-0198", userType: "B2B", companyName: "ARS Cooling & Heating", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-10203", name: "Jordan Whitfield", email: "j.whitfield@gmail.com", phone: "+1 (404) 555-0103", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Apple", cancelsOn: "2026-08-27" },
  { id: "U-10248", name: "Sophia Andersson", email: "sophia.a@brennanhvac.com", phone: "+1 (646) 555-0134", userType: "B2B", companyName: "Brennan HVAC Solutions", role: "Manager", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10291", name: "Tyrese Booker", email: "ty.booker@gmail.com", phone: "+1 (470) 555-0166", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-10330", name: "Lena Petrov", email: "lena.petrov@deltaelectrical.com", phone: "+1 (305) 555-0177", userType: "B2B", companyName: "Delta Electrical Group", role: "Admin", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10376", name: "Carlos Mendoza", email: "carlos.mendoza@gmail.com", phone: "+1 (915) 555-0142", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-10412", name: "Hana Yamamoto", email: "hana.y@gmail.com", phone: "+1 (206) 555-0156", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Google" },
  { id: "U-10458", name: "Brandon O'Connor", email: "boconnor@evercleanplumbing.com", phone: "+1 (267) 555-0149", userType: "B2B", companyName: "EverClean Plumbing", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-10491", name: "Naomi Sato", email: "naomi.sato@gmail.com", phone: "+1 (503) 555-0189", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-10537", name: "Ezekiel Adeoye", email: "z.adeoye@deltaelectrical.com", phone: "+1 (404) 555-0121", userType: "B2B", companyName: "Delta Electrical Group", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-10584", name: "Mira Singh", email: "mira.singh@yahoo.com", phone: "+1 (718) 555-0162", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Apple" },
  { id: "U-10618", name: "Felix Becker", email: "felix.becker@harborcitymech.com", phone: "+1 (267) 555-0148", userType: "B2B", companyName: "Harbor City Mechanical", role: "Manager", subscriptionStatus: "Subscriber", platform: "Stripe", cancelsOn: "2026-07-09" },
  { id: "U-10655", name: "Olivia Tran", email: "olivia.tran@gmail.com", phone: "+1 (408) 555-0190", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-10692", name: "Samuel Okafor", email: "sam.okafor@greenshieldsolar.com", phone: "+1 (510) 555-0173", userType: "B2B", companyName: "Green Shield Solar", role: "Admin", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10731", name: "Isabella Rossi", email: "bella.rossi@gmail.com", phone: "+1 (917) 555-0128", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-10778", name: "Kwame Mensah", email: "kwame.m@harborcitymech.com", phone: "+1 (332) 555-0155", userType: "B2B", companyName: "Harbor City Mechanical", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-10814", name: "Grace Liu", email: "grace.liu@gmail.com", phone: "+1 (628) 555-0139", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Google", cancelsOn: "2026-09-02" },
  { id: "U-10859", name: "Mateo Garcia", email: "mateo.garcia@metropipe.com", phone: "+1 (713) 555-0184", userType: "B2B", companyName: "Metro Pipe & Drain", role: "Manager", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10903", name: "Chloe Bennett", email: "chloe.bennett@gmail.com", phone: "+1 (469) 555-0112", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-10948", name: "Raj Patel", email: "raj.patel@northstarrefrig.com", phone: "+1 (646) 555-0107", userType: "B2B", companyName: "NorthStar Refrigeration", role: "Admin", subscriptionStatus: "Cancelled" },
  { id: "U-10987", name: "Emma Schneider", email: "emma.s@gmail.com", phone: "+1 (303) 555-0193", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11021", name: "Andre Dubois", email: "andre.dubois@keystoneelectrical.com", phone: "+1 (215) 555-0146", userType: "B2B", companyName: "Keystone Electrical", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-11066", name: "Zoe Campbell", email: "zoe.campbell@gmail.com", phone: "+1 (480) 555-0175", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11103", name: "Yusuf Demir", email: "yusuf.demir@jetstreamair.com", phone: "+1 (623) 555-0131", userType: "B2B", companyName: "Jetstream Air Systems", role: "Manager", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-11147", name: "Harper Wright", email: "harper.wright@gmail.com", phone: "+1 (615) 555-0168", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-11189", name: "Nina Kowalski", email: "nina.k@onyxcommercial.com", phone: "+1 (312) 555-0159", userType: "B2B", companyName: "Onyx Commercial Services", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-11224", name: "Theo Martin", email: "theo.martin@gmail.com", phone: "+1 (971) 555-0144", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-11268", name: "Devon Riley", email: "devon.riley@gmail.com", phone: "+1 (313) 555-0136", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11302", name: "Alina Volkov", email: "alina.volkov@yahoo.com", phone: "+1 (702) 555-0151", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11347", name: "Malik Johnson", email: "malik.johnson@gmail.com", phone: "+1 (216) 555-0129", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11383", name: "Priscilla Nunez", email: "p.nunez@onyxcommercial.com", phone: "+1 (312) 555-0188", userType: "B2B", companyName: "Onyx Commercial Services", role: "Employee", subscriptionStatus: "Starter" },
  { id: "U-11419", name: "Owen Fitzgerald", email: "owen.fitz@gmail.com", phone: "+1 (802) 555-0164", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11429", name: "Renee Alvarado", email: "renee.alvarado@gmail.com", phone: "+1 (505) 555-0172", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11445", name: "Curtis Nwosu", email: "curtis.nwosu@gmail.com", phone: "+1 (773) 555-0118", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11475", name: "Bianca Ferraro", email: "bianca.ferraro@yahoo.com", phone: "+1 (508) 555-0143", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Cancelled" },
  { id: "U-11524", name: "Josiah Pike", email: "josiah.pike@metropipe.com", phone: "+1 (713) 555-0196", userType: "B2B", companyName: "Metro Pipe & Drain", role: "Employee", subscriptionStatus: "Cancelled" },
  { id: "U-11452", name: "Dominique Carter", email: "dom.carter@jetstreamair.com", phone: "+1 (623) 555-0158", userType: "B2B", companyName: "Jetstream Air Systems", role: "Employee", subscriptionStatus: "Company Plan" },
  { id: "U-11461", name: "Tanvi Iyer", email: "tanvi.iyer@gmail.com", phone: "+1 (669) 555-0127", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-11484", name: "Gabriel Sousa", email: "gabriel.sousa@gmail.com", phone: "+1 (786) 555-0181", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Stripe", cancelsOn: "2026-07-22" },
  { id: "U-11496", name: "Leah Braun", email: "leah.braun@gmail.com", phone: "+1 (414) 555-0135", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11541", name: "Aaron Mbeki", email: "aaron.mbeki@gmail.com", phone: "+1 (901) 555-0163", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-11560", name: "Hallie Nguyen", email: "hallie.nguyen@gmail.com", phone: "+1 (360) 555-0174", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
];

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

export const users: User[] = baseUsers.map((u) => {
  const k = uhash(u.id);
  const isDashboardUser = u.role === "Manager" || u.role === "Admin";
  return {
    ...u,
    // Most emails verified; a deterministic minority not.
    emailVerified: k % 6 !== 0,
    phoneVerified: k % 3 !== 0,
    // Joined 5 months – ~3 years ago.
    joinedOn: isoDaysAgo(150 + (k % 950)),
    // Last access within the past ~45 days (some users more recent than others).
    lastAccess: isoDaysAgo(k % 46),
    // Only Managers/Admins can view the B2B Dashboard, within the past ~90 days.
    dashboardLastAccess: isDashboardUser ? isoDaysAgo(k % 91) : undefined,
    // Upcoming cancellations land 3–60 days out from today (the hand-written
    // seed dates went stale once dates were anchored to the real today).
    cancelsOn: u.cancelsOn ? isoDaysAgo(-(3 + (k % 58))) : undefined,
    // Cancelled plans ended 1–120 days ago.
    cancelledOn: u.subscriptionStatus === "Cancelled" ? isoDaysAgo(1 + (uhash(u.id + "|cancelled") % 120)) : undefined,
  };
});

/* The seed only stores last-access DAYS. The hover tooltip wants a time too,
   so each user gets a deterministic working-hours time (07:00–19:59 Eastern,
   the zone the tooltip always prints) on that day — salted per stamp, and
   never later than "now" for today's visits. */
export function accessMoment(userId: string, isoDay: string, salt: string): Date {
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

/* Users removed from the Manage Users row menu. The mock has no server, and
   other data modules (purchases, proctoring, ID reviews…) have already built
   records off `users` at load, so the roster itself is left intact; the Users
   page reads this set on mount so a removal survives navigating away. */
export const removedUserIds = new Set<string>();
export function removeUser(userId: string): void {
  removedUserIds.add(userId);
}

/* The one place a user's name is changed at runtime. The mock has no server:
   every page seeds its own state from this roster at mount, so an admin renaming
   someone must write back HERE or the change is invisible the moment they
   navigate away. Mutates in place because `users` is what every page reads. */
export function renameUser(userId: string, name: string): void {
  const u = users.find((x) => x.id === userId);
  if (u) u.name = name;
}

/* Manage Users' Edit User modal writes back here for the same reason. A
   changed email or phone is no longer verified. */
export function updateUserContact(userId: string, v: { name: string; email: string; phone: string }): void {
  const u = users.find((x) => x.id === userId);
  if (!u) return;
  u.emailVerified = u.emailVerified && v.email === u.email;
  u.phoneVerified = u.phoneVerified && v.phone === u.phone;
  u.name = v.name;
  u.email = v.email;
  u.phone = v.phone;
}
