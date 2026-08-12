export type CareerStage = "Apprentice" | "Journeyman" | "Master";
export type CertType = "Unit" | "Credential" | "Program" | "Bundle";
export type CertVisibility = "Visible" | "Hidden" | "Archived";
// Paid certifications are either consumable (a credit/seat is spent on use) or
// non-consumable (one-time purchase, reusable). A cert with no payment model is
// free.
export type CertPayment = "Consumable" | "Non-consumable";

export type Certification = {
  id: string;
  name: string;
  industry: string;
  ceus: string;
  tasks: number;
  createdBy: string;
  draft?: boolean;
  dateCreated?: string;
  dateModified?: string;
  visibility?: CertVisibility;
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
  // See TRADE_TAGS / PARTNERSHIP_TAGS / USER_TYPE_TAGS in data/filters.
  tags?: string[];
};

const C = (
  id: string,
  name: string,
  industry: string,
  ceus: string,
  tasks: number,
  createdBy: string,
  dateCreated: string,
  dateModified: string,
  extra: Partial<Certification> = {},
): Certification => ({
  id,
  name,
  industry,
  ceus,
  tasks,
  createdBy,
  dateCreated,
  dateModified,
  visibility: "Visible",
  ...extra,
});

export const certifications: Certification[] = [
  C("C-0421", "EPA 608 Universal", "HVAC", "2.4", 13, "SkillCat", "Mar 04, 2024", "Apr 28, 2026", { careerStage: "Journeyman", type: "Credential", payment: "Non-consumable", keywords: ["epa", "608", "refrigerant", "universal"], tags: ["B2B-Only", "NexStar", "HVACR", "Commercial HVAC", "Residential HVAC"] }),
  C("C-0420", "EPA 608 Type I", "HVAC › Residential", "0.8", 5, "SkillCat", "Mar 04, 2024", "Mar 18, 2026", { careerStage: "Apprentice", type: "Unit", payment: "Consumable", resetsProgress: true, keywords: ["epa", "608", "type i", "refrigerant"], tags: ["Residential HVAC"] }),
  C("C-0419", "EPA 608 Type II", "HVAC › Commercial", "0.8", 5, "SkillCat", "Mar 04, 2024", "Mar 18, 2026", { careerStage: "Journeyman", type: "Unit", payment: "Consumable", keywords: ["epa", "608", "type ii", "refrigerant"], tags: ["B2B-Only", "Commercial HVAC"] }),
  C("C-0418", "EPA 608 Type III", "HVAC › Commercial", "0.8", 5, "SkillCat", "Mar 04, 2024", "Mar 18, 2026", { careerStage: "Master", type: "Unit", keywords: ["epa", "608", "type iii", "refrigerant"], tags: ["Commercial HVAC"] }),
  C("C-0417", "EPA 609", "HVAC", "0.6", 4, "SkillCat", "Mar 04, 2024", "Mar 18, 2026", { careerStage: "Apprentice", type: "Unit", payment: "Consumable", keywords: ["epa", "609", "mvac", "automotive", "refrigerant"], tags: ["HVACR", "Residential HVAC"] }),
  C("C-0410", "NATE Ready-to-Work", "HVAC", "1.6", 9, "SkillCat", "Feb 12, 2024", "Apr 14, 2026", { careerStage: "Apprentice", type: "Program", keywords: ["nate", "entry", "rtw"], tags: ["NexStar", "HVACR", "Residential HVAC", "Commercial HVAC"] }),
  C("C-0405", "Refrigerant Safety Bundle", "HVAC › Residential", "1.2", 7, "SkillCat", "Jan 20, 2024", "Apr 02, 2026", { careerStage: "Journeyman", type: "Bundle", payment: "Non-consumable", keywords: ["refrigerant", "safety", "bundle"], tags: ["Residential HVAC"] }),
  C("C-0398", "HVAC Field Skills", "HVAC", "2.0", 11, "SkillCat", "Jan 08, 2024", "Mar 30, 2026", { careerStage: "Journeyman", type: "Program", keywords: ["hvac", "field", "skills"], tags: ["B2B-Only", "Commercial HVAC"] }),
  C("C-0376", "Brazing Fundamentals", "Welding", "0.6", 4, "SkillCat", "Nov 14, 2023", "Feb 22, 2026", { careerStage: "Apprentice", type: "Unit", keywords: ["brazing", "welding", "fundamentals"] }),
  C("C-0341", "OSHA 10 — General Industry", "OSHA & Safety › General Industry", "1.0", 6, "SkillCat", "Sep 02, 2023", "Jan 11, 2026", { careerStage: "Apprentice", type: "Credential", payment: "Consumable", keywords: ["osha", "10", "safety", "general industry"], tags: ["B2B-Only"] }),
  C("C-0322", "Plumbing Apprentice Year 1", "Plumbing", "3.2", 18, "SkillCat", "Jul 21, 2023", "Dec 04, 2025", { careerStage: "Apprentice", type: "Program", payment: "Non-consumable", keywords: ["plumbing", "apprentice", "year 1"], tags: ["Residential Plumbing"] }),
  C("C-0298", "Electrical Code Refresher", "Electrical", "1.4", 8, "SkillCat", "May 30, 2023", "Nov 18, 2025", { careerStage: "Journeyman", type: "Unit", visibility: "Hidden", keywords: ["electrical", "code", "nec", "refresher"] }),
  // Blank career stage — exercises the "No Career Stage" filter. Archived too.
  C("C-0265", "Forklift Operator", "OSHA & Safety › General Industry", "0.5", 3, "SkillCat", "Mar 12, 2023", "Oct 08, 2025", { type: "Credential", visibility: "Archived", keywords: ["forklift", "operator", "warehouse", "safety"] }),
  C("C-0242", "Solar PV Installer Basics", "Solar & Renewables › Solar PV", "2.2", 12, "SkillCat", "Jan 18, 2023", "Sep 12, 2025", { careerStage: "Apprentice", type: "Program", payment: "Consumable", resetsProgress: true, keywords: ["solar", "pv", "installer", "renewables"], tags: ["MultiFamily Maintenance"] }),
  C("C-0221", "Welding Inspector Prep", "Welding", "1.8", 10, "SkillCat", "Dec 02, 2022", "Aug 21, 2025", { careerStage: "Master", type: "Credential", payment: "Non-consumable", keywords: ["welding", "inspector", "cwi"] }),
  // Blank type — exercises the "No Type" filter.
  C("C-0612", "Heat Pump Specialist (2026)", "HVAC › Residential", "1.6", 9, "SkillCat", "Apr 02, 2026", "Apr 28, 2026", { draft: true, careerStage: "Journeyman", keywords: ["heat pump", "specialist", "hvac"], tags: ["Residential HVAC"] }),
  // Company-created certifications — owned by a B2B account, editable only from
  // the B2B Dashboard (exercises the company edit-block flow).
  C("C-0588", "ARS Onboarding Path", "HVAC", "1.2", 7, "ARS", "Feb 18, 2026", "Apr 25, 2026", { careerStage: "Apprentice", type: "Program", keywords: ["ars", "onboarding"] }),
  C("C-0571", "NexTech Field Readiness", "HVAC › Commercial", "1.0", 6, "NexTech", "Jan 30, 2026", "Apr 20, 2026", { careerStage: "Journeyman", type: "Program", keywords: ["nextech", "field", "readiness"] }),
  C("C-0559", "Premium HVAC Install Standards", "HVAC › Residential", "0.9", 5, "Premium HVAC Services", "Jan 12, 2026", "Apr 16, 2026", { careerStage: "Journeyman", type: "Unit", keywords: ["premium", "install", "standards"] }),
  C("C-0540", "HVACR Safety Refresher", "OSHA & Safety › General Industry", "0.7", 4, "HVACR", "Dec 05, 2025", "Apr 10, 2026", { careerStage: "Apprentice", type: "Credential", keywords: ["hvacr", "safety", "refresher"] }),
];

// ─── Filter option constants ──────────────────────────────────────────────────
export const CAREER_STAGES: CareerStage[] = ["Apprentice", "Journeyman", "Master"];
export const CERT_TYPES: CertType[] = ["Unit", "Credential", "Program", "Bundle"];
export const CERT_VISIBILITIES: CertVisibility[] = ["Visible", "Hidden", "Archived"];

// Sentinel option labels for filtering certifications that have no value set.
export const NO_CAREER_STAGE = "No Career Stage";
export const NO_TYPE = "No Type";

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
  | "userTypeTag"
  | "visibility"
  | "dateCreated"
  | "dateModified";

export const CERT_OPTIONAL_COLUMNS: { key: CertColumn; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "industry", label: "Industry" },
  { key: "careerStage", label: "Career Stage" },
  { key: "type", label: "Type" },
  { key: "payment", label: "Payment" },
  { key: "tasks", label: "Tasks" },
  { key: "ceus", label: "CEUs" },
  { key: "createdBy", label: "Created By" },
  { key: "tradeTag", label: "Trade Tag" },
  { key: "partnershipTag", label: "Partnership Tag" },
  { key: "userTypeTag", label: "User Type Tag" },
  { key: "visibility", label: "Visibility" },
  { key: "dateCreated", label: "Date Created" },
  { key: "dateModified", label: "Date Modified" },
];

/** Columns that always render (no toggle). */
export const CERT_FIXED_COLUMNS: { label: string }[] = [{ label: "Name" }];
