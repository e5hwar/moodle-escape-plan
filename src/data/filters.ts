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

/** Options for the "Requires Subscription?" filter — the same wording the Task
 * wizard's paywall step uses. */
export const SUBSCRIPTION_OPTIONS = [
  "No: Can Access on Free Trial",
  "Yes: Requires Subscription",
];

// Tags are split into three independent categories. A record carries at most one
// tag per category. Audience is a two-way split that isn't stored symmetrically:
// only "B2B Companies Only" is ever tagged, and an untagged record is "All Users".
export const AUDIENCE_ALL_USERS = "All Users";
export const AUDIENCE_B2B_ONLY = "B2B Companies Only";
/** The audience tag records actually carry. */
export const AUDIENCE_TAGS = [AUDIENCE_B2B_ONLY];
/** Both sides of the split, as the filter menu offers them. */
export const AUDIENCE_OPTIONS = [AUDIENCE_ALL_USERS, AUDIENCE_B2B_ONLY];
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
  { label: "AUDIENCE", tags: AUDIENCE_OPTIONS },
  { label: "PARTNERSHIP", tags: PARTNERSHIP_TAGS },
  { label: "TRADE", tags: TRADE_TAGS },
];

/** A record's audience. Untagged means it reaches everyone, so this always
 * resolves to one of the two AUDIENCE_OPTIONS — there is no "no audience". */
export function audienceOf(tags: string[] | undefined): string {
  return (tags ?? []).includes(AUDIENCE_B2B_ONLY)
    ? AUDIENCE_B2B_ONLY
    : AUDIENCE_ALL_USERS;
}

/** Does a record match a selection from the "Audience/B2B Tags" menu? Every
 * tag is a plain membership test except "All Users", which is the absence of the
 * B2B tag rather than a tag of its own. */
export function matchesTagFilter(
  tags: string[] | undefined,
  selected: readonly string[],
): boolean {
  const list = tags ?? [];
  return selected.some((t) =>
    t === AUDIENCE_ALL_USERS ? !list.includes(AUDIENCE_B2B_ONLY) : list.includes(t),
  );
}

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
  | "audience"
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
  { key: "audience", label: "Audience" },
  { key: "dateCreated", label: "Date Created" },
  { key: "dateModified", label: "Date Modified" },
];

/** Columns that always render (no toggle). */
export const FIXED_COLUMNS: { label: string }[] = [{ label: "Name" }];
