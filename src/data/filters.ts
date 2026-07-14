export const CREATED_BY_IN_HOUSE = ["SkillCat"];

export const CREATED_BY_B2B = [
  "ARS",
  "HVACR",
  "NexTech",
  "Premium HVAC Services",
];

export const CERTIFICATIONS = [
  "EPA 608 Type I",
  "EPA 608 Type II",
  "EPA 608 Type III",
  "EPA 608 Universal",
  "HVAC Field Skills",
  "NATE RTW",
  "OSHA 10",
  "OSHA 30",
  "Safety Bundle",
];

export const TASK_TYPES = [
  "xAPI",
  "Quiz",
  "Hands-On Task",
  "Resource",
];

export const VISIBILITIES = ["Hidden", "Visible"];

export const DISCOVERABLE_OPTIONS = ["Discoverable", "Not discoverable"];

export const FINAL_EXAM_OPTIONS = ["Final Exam", "Not Final Exam"];

// Tags are split into three independent categories. A record carries at most one
// tag per category. "All-User" is no longer a tag — it's the default (blank) user
// type, so User Type tags are only "B2B-Only".
export const USER_TYPE_TAGS = ["B2B-Only"];
export const PARTNERSHIP_TAGS = ["NexStar", "HVACR"];
export const TRADE_TAGS = [
  "Residential HVAC",
  "Commercial HVAC",
  "Residential Plumbing",
  "Commercial Plumbing",
  "MultiFamily Maintenance",
  "Hotel Maintenance",
];

export const TAG_GROUPS: { label: string; tags: string[] }[] = [
  { label: "USER TYPE", tags: USER_TYPE_TAGS },
  { label: "PARTNERSHIP", tags: PARTNERSHIP_TAGS },
  { label: "TRADE", tags: TRADE_TAGS },
];

/** The tag a record carries within a category, or undefined if none. */
export function pickTag(
  tags: string[] | undefined,
  category: readonly string[],
): string | undefined {
  return (tags ?? []).find((t) => category.includes(t));
}

/** All tags a record carries within a category (Trade and Partnership allow more
 * than one; preserves the category's own ordering). */
export function pickTags(
  tags: string[] | undefined,
  category: readonly string[],
): string[] {
  return category.filter((t) => (tags ?? []).includes(t));
}

export type OptionalColumn =
  | "id"
  | "type"
  | "paid"
  | "usedIn"
  | "createdBy"
  | "tradeTag"
  | "partnershipTag"
  | "userTypeTag"
  | "dateCreated"
  | "dateModified";

export const OPTIONAL_COLUMNS: { key: OptionalColumn; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "type", label: "Type" },
  { key: "paid", label: "Paid" },
  { key: "usedIn", label: "Used in" },
  { key: "createdBy", label: "Created By" },
  { key: "tradeTag", label: "Trade Tag" },
  { key: "partnershipTag", label: "Partnership Tag" },
  { key: "userTypeTag", label: "User Type Tag" },
  { key: "dateCreated", label: "Date Created" },
  { key: "dateModified", label: "Date Modified" },
];

/** Columns that always render (no toggle). */
export const FIXED_COLUMNS: { label: string }[] = [{ label: "Name" }];
