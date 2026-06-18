export type UserType = "B2C" | "B2B";

/** Self-Learner is the only B2C role; the rest are B2B-only. */
export type UserRole = "Self-Learner" | "Employee" | "Manager" | "Admin";

export type SubscriptionStatus =
  | "Starter"
  | "Subscriber"
  | "Scholarship"
  | "Free Trial";

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
  /** ISO date the user joined SkillCat. */
  joinedOn: string;
  /** ISO date of the user's most recent access. */
  lastAccess: string;
};

/** Identity/role fields authored by hand; date + verification flags are
 *  augmented deterministically below so we don't hand-maintain 30 rows. */
type BaseUser = Omit<
  User,
  "emailVerified" | "phoneVerified" | "joinedOn" | "lastAccess"
>;

const baseUsers: BaseUser[] = [
  { id: "U-10044", name: "Marcus Holloway", email: "marcus.holloway@gmail.com", phone: "+1 (415) 555-0142", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10089", name: "Priya Venkatesan", email: "priya.v@outlook.com", phone: "+1 (213) 555-0181", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-10132", name: "Diego Ramirez", email: "diego.ramirez@arscooling.com", phone: "+1 (832) 555-0117", userType: "B2B", companyName: "ARS Cooling & Heating", role: "Admin", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10157", name: "Ayesha Khan", email: "ayesha.khan@arscooling.com", phone: "+1 (832) 555-0198", userType: "B2B", companyName: "ARS Cooling & Heating", role: "Employee", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10203", name: "Jordan Whitfield", email: "j.whitfield@gmail.com", phone: "+1 (404) 555-0103", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Apple" },
  { id: "U-10248", name: "Sophia Andersson", email: "sophia.a@brennanhvac.com", phone: "+1 (646) 555-0134", userType: "B2B", companyName: "Brennan HVAC Solutions", role: "Manager", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10291", name: "Tyrese Booker", email: "ty.booker@gmail.com", phone: "+1 (470) 555-0166", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-10330", name: "Lena Petrov", email: "lena.petrov@deltaelectrical.com", phone: "+1 (305) 555-0177", userType: "B2B", companyName: "Delta Electrical Group", role: "Admin", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10376", name: "Carlos Mendoza", email: "carlos.mendoza@gmail.com", phone: "+1 (915) 555-0142", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-10412", name: "Hana Yamamoto", email: "hana.y@gmail.com", phone: "+1 (206) 555-0156", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Google" },
  { id: "U-10458", name: "Brandon O'Connor", email: "boconnor@evercleanplumbing.com", phone: "+1 (267) 555-0149", userType: "B2B", companyName: "EverClean Plumbing", role: "Employee", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10491", name: "Naomi Sato", email: "naomi.sato@gmail.com", phone: "+1 (503) 555-0189", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-10537", name: "Ezekiel Adeoye", email: "z.adeoye@deltaelectrical.com", phone: "+1 (404) 555-0121", userType: "B2B", companyName: "Delta Electrical Group", role: "Employee", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10584", name: "Mira Singh", email: "mira.singh@yahoo.com", phone: "+1 (718) 555-0162", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Apple" },
  { id: "U-10618", name: "Felix Becker", email: "felix.becker@harborcitymech.com", phone: "+1 (267) 555-0148", userType: "B2B", companyName: "Harbor City Mechanical", role: "Manager", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10655", name: "Olivia Tran", email: "olivia.tran@gmail.com", phone: "+1 (408) 555-0190", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-10692", name: "Samuel Okafor", email: "sam.okafor@greenshieldsolar.com", phone: "+1 (510) 555-0173", userType: "B2B", companyName: "Green Shield Solar", role: "Admin", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10731", name: "Isabella Rossi", email: "bella.rossi@gmail.com", phone: "+1 (917) 555-0128", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-10778", name: "Kwame Mensah", email: "kwame.m@harborcitymech.com", phone: "+1 (332) 555-0155", userType: "B2B", companyName: "Harbor City Mechanical", role: "Employee", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10814", name: "Grace Liu", email: "grace.liu@gmail.com", phone: "+1 (628) 555-0139", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Google" },
  { id: "U-10859", name: "Mateo Garcia", email: "mateo.garcia@metropipe.com", phone: "+1 (713) 555-0184", userType: "B2B", companyName: "Metro Pipe & Drain", role: "Manager", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10903", name: "Chloe Bennett", email: "chloe.bennett@gmail.com", phone: "+1 (469) 555-0112", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
  { id: "U-10948", name: "Raj Patel", email: "raj.patel@northstarrefrig.com", phone: "+1 (646) 555-0107", userType: "B2B", companyName: "NorthStar Refrigeration", role: "Admin", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-10987", name: "Emma Schneider", email: "emma.s@gmail.com", phone: "+1 (303) 555-0193", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Starter" },
  { id: "U-11021", name: "Andre Dubois", email: "andre.dubois@keystoneelectrical.com", phone: "+1 (215) 555-0146", userType: "B2B", companyName: "Keystone Electrical", role: "Employee", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-11066", name: "Zoe Campbell", email: "zoe.campbell@gmail.com", phone: "+1 (480) 555-0175", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Subscriber", platform: "Apple" },
  { id: "U-11103", name: "Yusuf Demir", email: "yusuf.demir@jetstreamair.com", phone: "+1 (623) 555-0131", userType: "B2B", companyName: "Jetstream Air Systems", role: "Manager", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-11147", name: "Harper Wright", email: "harper.wright@gmail.com", phone: "+1 (615) 555-0168", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Free Trial" },
  { id: "U-11189", name: "Nina Kowalski", email: "nina.k@onyxcommercial.com", phone: "+1 (312) 555-0159", userType: "B2B", companyName: "Onyx Commercial Services", role: "Employee", subscriptionStatus: "Subscriber", platform: "Stripe" },
  { id: "U-11224", name: "Theo Martin", email: "theo.martin@gmail.com", phone: "+1 (971) 555-0144", userType: "B2C", role: "Self-Learner", subscriptionStatus: "Scholarship" },
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
const USERS_TODAY = new Date("2026-06-17");
function isoDaysAgo(n: number): string {
  const d = new Date(USERS_TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const users: User[] = baseUsers.map((u) => {
  const k = uhash(u.id);
  return {
    ...u,
    // Most emails verified; a deterministic minority not.
    emailVerified: k % 6 !== 0,
    phoneVerified: k % 3 !== 0,
    // Joined 5 months – ~3 years ago.
    joinedOn: isoDaysAgo(150 + (k % 950)),
    // Last access within the past ~45 days (some users more recent than others).
    lastAccess: isoDaysAgo(k % 46),
  };
});
