import { useSyncExternalStore } from "react";
import certThumbSample from "../assets/cert-thumb-sample.jpg";

export type CareerStage = "Pre-Apprentice" | "Apprentice" | "Journeyman" | "Master";
export type CertType = "Unit" | "Credential" | "Program" | "Bundle";
export type CertVisibility = "Visible" | "Hidden" | "Archived";
// Paid certifications are either consumable (a credit/seat is spent on use) or
// non-consumable (one-time purchase, reusable). A cert with no payment model is
// free.
export type CertPayment = "Consumable" | "Non-consumable";
// Time to Complete is a whole number of one of the wizard's four units.
export type CertTimeUnit = "minutes" | "hours" | "days" | "weeks" | "months";

export type Certification = {
  id: string;
  name: string;
  /* Industry tags (the backend tagging model): zero or more keys, each an
     Industry ("hvac") or a Sub-Industry ("hvac-residential") from the live
     Industry list (data/industries). Tagging a Sub-Industry does not tag its
     parent. Stored as keys so a rename shows everywhere at once; labels come
     from `industryTagLabel`. Company-created Certifications are never tagged. */
  industries: string[];
  ceus: string;
  tasks: number;
  createdBy: string;
  // The Details step's description and Time to Complete estimate. Both are
  // optional, so a Certification can be saved without them.
  description?: string;
  timeToComplete?: { value: number; unit: CertTimeUnit };
  dateCreated?: string;
  dateModified?: string;
  visibility?: CertVisibility;
  /* Archive & Replace. Archiving is reversible: Unarchive puts the
     Certification back to the visibility it had before (absent = Visible).
     The replacements (Certification ids) and the bilingual Replacement Alert
     are what enrolled learners see while it is archived; both are kept on
     the record so the page reopens with them, and cleared on Unarchive. */
  visibilityBeforeArchive?: Exclude<CertVisibility, "Archived">;
  replacementIds?: string[];
  replacementAlert?: { en: string; es: string };
  // Career stage and type can be blank — these are filterable as "No Career
  // Stage" / "No Type".
  careerStage?: CareerStage;
  type?: CertType;
  // Payment model. Absent means the certification is free.
  payment?: CertPayment;
  // Consumables only: whether revoking / consuming resets the user's progress
  // on the Certification. Ignored for non-consumables and free certs.
  resetsProgress?: boolean;
  // Free-form keywords matched by the Keyword filter (under More filters).
  keywords?: string[];
  // Category tags — at most one Trade, one Partnership, and one User Type tag.
  // See TRADE_TAGS / PARTNERSHIP_TAGS / AUDIENCE_TAGS in data/filters.
  tags?: string[];
  /* Post-creation setup (Industries, Content Links, Award, Feedback Form) was
     closed with "Mark as Done" — the remaining steps don't apply. In the
     product this is the admin's own persisted flag; the seed carries it for
     every long-established Certification, which an admin settled long ago,
     so only the recently created ones read as still being set up. */
  setupClosed?: boolean;
  /* The Details step's Thumbnail, as a URL. Only one seed Certification has
     one (the sample from Figma 1585:1620), so the preview panel's head is
     seen both with and without it. */
  thumbnail?: string;
  /** The picked thumbnail file's name, size and extension — a blob URL
   *  carries none of them. Absent on the seed. */
  thumbnailFile?: { name: string; size: number; ext: string };

  /* ── Everything else the wizard edits. The seed carries none of these, so a
     seed Certification opens Edit (and its preview panel) on sample structure
     and sample Product IDs; one created or saved this session keeps what was
     entered. ── */
  /** Spanish halves of Name and Description (blank falls back to English). */
  nameEs?: string;
  descriptionEs?: string;
  /** Additional Info › Announcement, EN and ES. */
  announcement?: string;
  announcementEs?: string;
  /** Spanish Keywords, split on commas like `keywords`. */
  keywordsEs?: string[];
  /** The Deep Link slug. Absent → the slugified name (what the seed uses). */
  slug?: string;
  /** Paid only: the store Product IDs, by channel (PriceIdFields). */
  priceIds?: Record<"appleB2c" | "googleB2c" | "stripeB2c" | "stripeB2b", string>;
  /** Add Tasks: Courses › Lessons › Tasks, Access Restrictions included. */
  courses?: CertStoredCourse[];
  /** Completion: the Condition Sets (OR'd; each one's items AND'd). */
  conditionSets?: CertConditionSet[];
  /** Certification ids merged in via Import Courses, in plan order. Stored
   *  by id, never name, so a rename shows everywhere (see certReferences). */
  importedCerts?: string[];
};

/* ── The Certification's stored structure (the wizard's Add Tasks tree and
   Completion criteria). ── */
export type CertTaskKind = "xapi" | "quiz" | "hands-on" | "file";
export type CertStoredTask = {
  id: string;
  name: string;
  kind: CertTaskKind;
  duration?: string;
  /** Access Restriction: open only once `all` / `any` of these Tasks (ids in
   *  this tree) are completed. */
  restriction?: { enabled: boolean; mode: "all" | "any"; taskIds: string[] };
  requiresSubscription?: boolean;
  usedIn?: string[];
};
export type CertStoredLesson = {
  id: string;
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  hidden: boolean;
  tasks: CertStoredTask[];
};
export type CertStoredCourse = {
  id: string;
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  expanded: boolean;
  hidden: boolean;
  children: ({ kind: "task"; task: CertStoredTask } | { kind: "lesson"; lesson: CertStoredLesson })[];
  /** The Certification this Course was imported from (Import Courses). */
  sourceCertId?: string;
};
export type CertConditionSet = {
  id: string;
  items: (
    | { kind: "task"; id: string; name: string; taskKind: CertTaskKind }
    | { kind: "quiz-section"; id: string; name: string; quizName: string }
    /* A required Certification: `id` is the item's own node id, `certId` the
       Certification's. No name is kept — it's read off the live record. */
    | { kind: "cert"; id: string; certId: string }
  )[];
};

/* The Details step's long-form fields, kept apart from the seed rows below so
   each row stays one scannable line. Heat Pump Specialist (hidden) has
   neither yet, so the empty case is covered too. */
const CERT_DETAILS: Record<string, Pick<Certification, "description" | "timeToComplete">> = {
  "C-0421": {
    description: "Covers all four sections of the EPA Section 608 exam (Core, Type I, Type II and Type III), so technicians can certify to handle refrigerant in any system.",
    timeToComplete: { value: 12, unit: "hours" },
  },
  "C-0420": {
    description: "Core plus Type I: recovering refrigerant safely from small appliances holding five pounds or less, such as window units, refrigerators and dehumidifiers.",
    timeToComplete: { value: 3, unit: "hours" },
  },
  "C-0419": {
    description: "Core plus Type II: leak detection, recovery and repair requirements for high-pressure systems, from residential splits to commercial refrigeration.",
    timeToComplete: { value: 3, unit: "hours" },
  },
  "C-0418": {
    description: "Core plus Type III: recovery, leak testing and recharging procedures for low-pressure appliances such as centrifugal chillers.",
    timeToComplete: { value: 3, unit: "hours" },
  },
  "C-0417": {
    description: "Section 609 certification for servicing motor vehicle air conditioning: refrigerant recovery, recycling, and the rules for buying refrigerant.",
    timeToComplete: { value: 2, unit: "hours" },
  },
  "C-0410": {
    description: "An entry-level track built around the NATE Ready-to-Work exam: HVAC fundamentals, safety, tools and basic electrical for technicians starting out.",
    timeToComplete: { value: 4, unit: "weeks" },
  },
  "C-0406": {
    description: "How heat, air and moisture move through a building, and what that means for load calculations, duct design and diagnosing comfort complaints.",
    timeToComplete: { value: 5, unit: "hours" },
  },
  "C-0405": {
    description: "The safety essentials for working with refrigerants, from pressure and PPE to cylinder handling and leak response, packaged for residential crews.",
    timeToComplete: { value: 6, unit: "hours" },
  },
  "C-0398": {
    description: "A multi-week program that takes new technicians from fundamentals to field-ready skills across installation, maintenance and troubleshooting.",
    timeToComplete: { value: 8, unit: "weeks" },
  },
  "C-0376": {
    description: "Brazing copper line sets with oxy-acetylene and air-acetylene: joint prep, nitrogen purging, heat control and inspecting the finished joint.",
    timeToComplete: { value: 90, unit: "minutes" },
  },
  "C-0341": {
    description: "The 10-hour OSHA Outreach course for general industry: hazard recognition, walking-working surfaces, electrical safety and workers' rights.",
    timeToComplete: { value: 10, unit: "hours" },
  },
  "C-0322": {
    description: "The first year of the plumbing apprenticeship: tools and materials, drainage and venting, water supply basics, and reading the plumbing code.",
    timeToComplete: { value: 16, unit: "weeks" },
  },
  "C-0298": {
    description: "A refresher on the National Electrical Code for working electricians, focused on the articles that come up most in the field and on inspections.",
    timeToComplete: { value: 4, unit: "hours" },
  },
  "C-0265": {
    description: "Powered industrial truck training: pre-shift inspection, load handling, stability and safe operation in warehouse environments.",
    timeToComplete: { value: 3, unit: "hours" },
  },
  "C-0242": {
    description: "An introduction to installing solar photovoltaic systems: site assessment, racking, module wiring, inverters and working safely on roofs.",
    timeToComplete: { value: 6, unit: "weeks" },
  },
  "C-0221": {
    description: "Preparation for the Certified Welding Inspector exam: welding processes, codes and standards, discontinuities and visual inspection.",
    timeToComplete: { value: 20, unit: "hours" },
  },
  "C-0588": {
    description: "ARS's onboarding path for new hires: company standards, customer communication, and the core HVAC skills every ARS technician needs.",
    timeToComplete: { value: 2, unit: "weeks" },
  },
  "C-0571": {
    description: "NexTech's readiness track for commercial technicians heading into the field: site safety, equipment basics and service documentation.",
    timeToComplete: { value: 3, unit: "weeks" },
  },
  "C-0559": {
    description: "Premium HVAC Services' standards for residential installs: equipment placement, line set practices, commissioning and the customer walkthrough.",
    timeToComplete: { value: 2, unit: "hours" },
  },
  "C-0540": {
    description: "A short job-site safety refresher for HVACR technicians: lockout/tagout, ladders, electrical hazards and handling refrigerant cylinders.",
    timeToComplete: { value: 45, unit: "minutes" },
  },
  /* The three Certifications still mid-setup (Claude Design "Certification
     Post-Creation Setup", 2026-10-01): created recently, each missing some of
     the four follow-up steps — Industries, Content Links, Award, Feedback Form. */
  "C-0631": {
    description: "The safety essentials for working around boilers: pressure, combustion air, lockout and the pre-start checks every apprentice runs.",
    timeToComplete: { value: 3, unit: "hours" },
  },
  "C-0629": {
    description: "Sizing, line set and mounting practice for ductless mini-split systems, from the pre-install survey to commissioning.",
    timeToComplete: { value: 5, unit: "hours" },
  },
  "C-0624": {
    description: "Permit-required confined spaces: hazard assessment, atmospheric testing, entry roles and rescue planning.",
    timeToComplete: { value: 4, unit: "hours" },
  },
};

const TIME_UNIT_NAMES: Record<CertTimeUnit, [one: string, many: string]> = {
  minutes: ["Minute", "Minutes"],
  hours: ["Hour", "Hours"],
  days: ["Day", "Days"],
  weeks: ["Week", "Weeks"],
  months: ["Month", "Months"],
};

/** "20 Minutes", "1 Hour": a Time to Complete in the words of the wizard's
 *  unit picker. Empty when the Certification doesn't have one. */
export function formatTimeToComplete(time: Certification["timeToComplete"]): string {
  if (!time) return "";
  const [one, many] = TIME_UNIT_NAMES[time.unit];
  return `${time.value} ${time.value === 1 ? one : many}`;
}

const C = (
  id: string,
  name: string,
  industries: string[],
  ceus: string,
  tasks: number,
  createdBy: string,
  dateCreated: string,
  dateModified: string,
  extra: Partial<Certification> = {},
): Certification => ({
  id,
  name,
  industries,
  ceus,
  tasks,
  createdBy,
  dateCreated,
  dateModified,
  visibility: "Visible",
  setupClosed: true,
  ...CERT_DETAILS[id],
  ...extra,
});

export const certifications: Certification[] = [
  C("C-0421", "EPA 608 Universal", ["hvac", "hvac-residential", "hvac-commercial"], "2.4", 13, "SkillCat", "Mar 04, 2024", "Apr 28, 2026", { careerStage: "Journeyman", type: "Credential", payment: "Non-consumable", keywords: ["epa", "608", "refrigerant", "universal"], tags: ["B2B Companies Only"] }),
  C("C-0420", "EPA 608 Type I", ["hvac-residential"], "0.8", 5, "SkillCat", "Mar 04, 2024", "Mar 18, 2026", { careerStage: "Apprentice", type: "Unit", payment: "Consumable", resetsProgress: true, keywords: ["epa", "608", "type i", "refrigerant"] }),
  C("C-0419", "EPA 608 Type II", ["hvac-commercial"], "0.8", 5, "SkillCat", "Mar 04, 2024", "Mar 18, 2026", { careerStage: "Journeyman", type: "Unit", payment: "Consumable", keywords: ["epa", "608", "type ii", "refrigerant"], tags: ["B2B Companies Only"] }),
  C("C-0418", "EPA 608 Type III", ["hvac-commercial"], "0.8", 5, "SkillCat", "Mar 04, 2024", "Mar 18, 2026", { careerStage: "Master", type: "Unit", keywords: ["epa", "608", "type iii", "refrigerant"] }),
  C("C-0417", "EPA 609", ["hvac"], "0.6", 4, "SkillCat", "Mar 04, 2024", "Mar 18, 2026", { careerStage: "Apprentice", type: "Unit", payment: "Consumable", keywords: ["epa", "609", "mvac", "automotive", "refrigerant"] }),
  C("C-0410", "NATE Ready-to-Work", ["hvac", "hvac-residential"], "1.6", 9, "SkillCat", "Feb 12, 2024", "Apr 14, 2026", { careerStage: "Apprentice", type: "Program", keywords: ["nate", "entry", "rtw"] }),
  C("C-0406", "Building Science Principles", ["hvac"], "1.4", 8, "SkillCat", "Jan 29, 2024", "Apr 08, 2026", { careerStage: "Apprentice", type: "Unit", keywords: ["building science", "envelope", "load", "principles"] }),
  C("C-0405", "Refrigerant Safety Bundle", ["hvac-residential"], "1.2", 7, "SkillCat", "Jan 20, 2024", "Apr 02, 2026", { careerStage: "Journeyman", type: "Bundle", payment: "Non-consumable", keywords: ["refrigerant", "safety", "bundle"] }),
  C("C-0398", "HVAC JobReady", ["hvac"], "2.0", 11, "SkillCat", "Jan 08, 2024", "Mar 30, 2026", { careerStage: "Journeyman", type: "Program", keywords: ["hvac", "jobready", "field", "skills"], tags: ["B2B Companies Only", "Commercial HVAC", "NexStar"] }),
  C("C-0376", "Brazing Fundamentals", ["hvac"], "0.6", 4, "SkillCat", "Nov 14, 2023", "Feb 22, 2026", { careerStage: "Apprentice", type: "Unit", keywords: ["brazing", "welding", "fundamentals"] }),
  C("C-0341", "OSHA 10 — General Industry", ["electrical-industrial"], "1.0", 6, "SkillCat", "Sep 02, 2023", "Jan 11, 2026", { careerStage: "Apprentice", type: "Credential", payment: "Consumable", keywords: ["osha", "10", "safety", "general industry"], tags: ["B2B Companies Only", "National Account"] }),
  C("C-0322", "Plumbing Apprentice Year 1", ["plumbing"], "3.2", 18, "SkillCat", "Jul 21, 2023", "Dec 04, 2025", { careerStage: "Apprentice", type: "Program", payment: "Non-consumable", keywords: ["plumbing", "apprentice", "year 1"], thumbnail: certThumbSample }),
  C("C-0298", "Electrical Code Refresher", ["electrical"], "1.4", 8, "SkillCat", "May 30, 2023", "Nov 18, 2025", { careerStage: "Journeyman", type: "Unit", visibility: "Hidden", keywords: ["electrical", "code", "nec", "refresher"] }),
  // Blank career stage — exercises the "No Career Stage" filter. Archived too.
  C("C-0265", "Forklift Operator", ["hvac-industrial"], "0.5", 3, "SkillCat", "Mar 12, 2023", "Oct 08, 2025", { type: "Credential", visibility: "Archived", keywords: ["forklift", "operator", "warehouse", "safety"] }),
  C("C-0242", "Solar PV Installer Basics", ["electrical-residential"], "2.2", 12, "SkillCat", "Jan 18, 2023", "Sep 12, 2025", { careerStage: "Apprentice", type: "Program", payment: "Consumable", resetsProgress: true, keywords: ["solar", "pv", "installer", "renewables"] }),
  C("C-0221", "Welding Inspector Prep", ["plumbing-pipefitting"], "1.8", 10, "SkillCat", "Dec 02, 2022", "Aug 21, 2025", { careerStage: "Master", type: "Credential", payment: "Non-consumable", keywords: ["welding", "inspector", "cwi"] }),
  // Blank type — exercises the "No Type" filter.
  C("C-0612", "Heat Pump Specialist (2026)", ["hvac-residential"], "1.6", 9, "SkillCat", "Apr 02, 2026", "Apr 28, 2026", { visibility: "Hidden", careerStage: "Journeyman", keywords: ["heat pump", "specialist", "hvac"] }),
  // Recently created, setup unfinished (see CERT_DETAILS above). Boiler Safety
  // Basics has no Industry yet — no tags is what "Add Industries" fixes.
  C("C-0631", "Boiler Safety Basics", [], "0.6", 5, "SkillCat", "Oct 01, 2026", "Oct 01, 2026", { setupClosed: false, careerStage: "Apprentice", type: "Credential", keywords: ["boiler", "safety", "lockout"] }),
  C("C-0629", "Ductless Mini-Split Install", ["hvac-residential"], "0.8", 6, "SkillCat", "Sep 29, 2026", "Sep 29, 2026", { setupClosed: false, careerStage: "Journeyman", type: "Unit", keywords: ["mini-split", "ductless", "install"] }),
  C("C-0624", "Confined Space Entry", ["plumbing-service"], "0.4", 4, "SkillCat", "Sep 24, 2026", "Sep 24, 2026", { setupClosed: false, careerStage: "Apprentice", type: "Credential", keywords: ["confined space", "permit", "entry"] }),
  // Company-created certifications — owned by a B2B account, editable only from
  // the B2B Dashboard (exercises the company edit-block flow). Only SkillCat-
  // created Certifications can carry Industry tags, so these have none.
  C("C-0588", "ARS Onboarding Path", [], "1.2", 7, "ARS", "Feb 18, 2026", "Apr 25, 2026", { careerStage: "Apprentice", type: "Program", keywords: ["ars", "onboarding"] }),
  C("C-0571", "NexTech Field Readiness", [], "1.0", 6, "NexTech", "Jan 30, 2026", "Apr 20, 2026", { careerStage: "Journeyman", type: "Program", keywords: ["nextech", "field", "readiness"] }),
  C("C-0559", "Premium HVAC Install Standards", [], "0.9", 5, "Premium HVAC Services", "Jan 12, 2026", "Apr 16, 2026", { careerStage: "Journeyman", type: "Unit", keywords: ["premium", "install", "standards"] }),
  C("C-0540", "HVACR Safety Refresher", [], "0.7", 4, "HVACR", "Dec 05, 2025", "Apr 10, 2026", { careerStage: "Apprentice", type: "Credential", keywords: ["hvacr", "safety", "refresher"] }),
];

/* Tasks reference their Certifications by NAME in `usedIn`, and a few of those
   labels are short aliases rather than the Certification's full name. This is
   the canonical name→Certification resolver for anything walking that edge
   (the Skills table's Certifications / Industry columns). `certLookup.ts` and
   `certPreview.ts` keep their own alias maps because they resolve to cert IDs
   for a different purpose; if those are ever unified, unify them here. */
const USEDIN_ALIASES: Record<string, string> = {
  "NATE RTW": "NATE Ready-to-Work",
  "Safety Bundle": "Refrigerant Safety Bundle",
  "OSHA 10": "OSHA 10 — General Industry",
};

export const CERT_BY_USEDIN: Map<string, Certification> = (() => {
  const byName = new Map(certifications.map((c) => [c.name, c]));
  const m = new Map(byName);
  for (const [alias, name] of Object.entries(USEDIN_ALIASES)) {
    const c = byName.get(name);
    if (c) m.set(alias, c);
  }
  return m;
})();

/** Whether SkillCat made this Certification (as opposed to a B2B company).
 *  Only these can carry Industry tags or be Content Link targets. */
export function isSkillCatCert(c: Pick<Certification, "createdBy">): boolean {
  return c.createdBy === "SkillCat";
}

/* ── The live Certification list ──
 * App owns the Certifications (seed + everything created, edited or deleted
 * this session) and mirrors them here, so pickers and data builders that
 * aren't handed the list (Import Courses, Add Requirement, Content Links, the
 * Industries page) see the same Certifications the Certifications page shows. */
let liveCerts: Certification[] = certifications;
const liveCertListeners = new Set<() => void>();
export function setLiveCerts(list: Certification[]) {
  if (list === liveCerts) return;
  liveCerts = list;
  liveCertListeners.forEach((l) => l());
}
export function getLiveCerts(): Certification[] {
  return liveCerts;
}
export function useLiveCerts(): Certification[] {
  return useSyncExternalStore(
    (l) => {
      liveCertListeners.add(l);
      return () => liveCertListeners.delete(l);
    },
    getLiveCerts,
  );
}
/** The live Certification with this id. */
export function certById(id: string): Certification | undefined {
  return liveCerts.find((c) => c.id === id);
}
/** A referenced Certification's name, read off the live record by id, so a
 *  rename shows wherever it is referenced. */
export function certNameById(id: string): string {
  return certById(id)?.name ?? id;
}

/** Where other Certifications build on this one: each referencing
 *  Certification with the places it does ("Completion Criteria · Condition
 *  Set 2", "Imported Course: …"). Only STORED structure counts — a seed
 *  Certification that was never saved opens on generated sample structure,
 *  which isn't real data (and never requires a Certification anyway). A
 *  referenced Certification can't be deleted. */
export type CertReference = { cert: Certification; where: string[] };
export function certReferences(certId: string, certs: Certification[] = liveCerts): CertReference[] {
  return certs.flatMap((c) => {
    if (c.id === certId) return [];
    const where: string[] = [];
    (c.conditionSets ?? []).forEach((cs, i) => {
      if (cs.items.some((it) => it.kind === "cert" && it.certId === certId))
        where.push(`Completion Criteria · Condition Set ${i + 1}`);
    });
    const courses = (c.courses ?? []).filter((co) => co.sourceCertId === certId);
    courses.forEach((co) => where.push(`Imported Course: ${co.nameEn || "Untitled Course"}`));
    // Still in the Learning Plan with every Course it brought deleted.
    if (courses.length === 0 && c.importedCerts?.includes(certId)) where.push("Imported Courses");
    return where.length ? [{ cert: c, where }] : [];
  });
}
/** Whether this is one of the seed Certifications (it has enrolment history
 *  in the prototype) rather than one created this session. */
const SEED_CERT_IDS = new Set(certifications.map((c) => c.id));
export function isSeedCert(id: string): boolean {
  return SEED_CERT_IDS.has(id);
}

// ─── Filter option constants ──────────────────────────────────────────────────
export const CAREER_STAGES: CareerStage[] = ["Pre-Apprentice", "Apprentice", "Journeyman", "Master"];
export const CERT_TYPES: CertType[] = ["Unit", "Credential", "Program", "Bundle"];
export const CERT_VISIBILITIES: CertVisibility[] = ["Visible", "Hidden", "Archived"];

// Sentinel option labels for filtering certifications that have no value set.
export const NO_CAREER_STAGE = "None";
export const NO_TYPE = "None";

// ─── Table column config (mirrors data/filters.ts for Tasks) ──────────────────
export type CertColumn =
  | "id"
  | "industry"
  | "careerStage"
  | "type"
  | "payment"
  | "tasks"
  | "ceus"
  | "createdBy"
  | "tradeTag"
  | "partnershipTag"
  | "audience"
  | "visibility"
  | "dateCreated"
  | "dateModified";

export const CERT_OPTIONAL_COLUMNS: { key: CertColumn; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "industry", label: "Industries" },
  { key: "careerStage", label: "Career Stage" },
  { key: "type", label: "Type" },
  { key: "payment", label: "Payment" },
  { key: "tasks", label: "Tasks" },
  { key: "ceus", label: "CEUs" },
  { key: "createdBy", label: "Created By" },
  { key: "tradeTag", label: "Trade Tag" },
  { key: "partnershipTag", label: "Partnership Tag" },
  { key: "audience", label: "Audience" },
  { key: "visibility", label: "Visibility" },
  { key: "dateCreated", label: "Date Created" },
  { key: "dateModified", label: "Date Modified" },
];

/** Columns that always render (no toggle). */
export const CERT_FIXED_COLUMNS: { label: string }[] = [{ label: "Name" }];
