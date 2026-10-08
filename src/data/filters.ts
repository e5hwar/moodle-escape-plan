import { getB2BConfig, subscribeB2BConfig } from "./productConfig";
import { useMemo } from "react";
import { useLiveCerts } from "./certifications";

export const CREATED_BY_IN_HOUSE = ["SkillCat"];

export const CREATED_BY_B2B = [
  "ARS",
  "HVACR",
  "NexTech",
  "Premium HVAC Services",
];

/** The Tasks Certifications filter's options: every Certification in the
 *  live list, by name — the canonical names Tasks resolve their `usedIn`
 *  aliases to (`taskCertifications`), so the filter, its search and a
 *  Certification's "View All Tasks" speak the same names. */
export function useCertificationOptions(): string[] {
  const certs = useLiveCerts();
  return useMemo(
    () => [...new Set(certs.map((c) => c.name))].sort((a, b) => a.localeCompare(b)),
    [certs],
  );
}

export const TASK_TYPES = [
  "xAPI",
  "Quiz",
  "Hands-On Task",
  "Resource",
  "ID Upload",
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
/* Trade and Partnership values are the ones Product Config's B2B Management
   offers — what the Task and Certification wizards let an admin pick — so a
   value picked there shows in every Tags column and filter. They follow the
   SAVED lists live: on each Product Config save these arrays are refilled in
   place, so every importer sees the new values on its next render. A value
   removed in Product Config leaves these lists (and is stripped from every
   record that carried it — App's removeB2BValue). "HVACR" stays recognised:
   a legacy partnership tag older records carry that the list never had. */
export const PARTNERSHIP_TAGS: string[] = [];
export const TRADE_TAGS: string[] = [];
const union = (...lists: string[][]) => [...new Set(lists.flat())];
function syncTagLists() {
  const { partnerships, trades } = getB2BConfig();
  PARTNERSHIP_TAGS.splice(0, Infinity, ...union(partnerships, ["HVACR"]));
  TRADE_TAGS.splice(0, Infinity, ...union(trades));
}
syncTagLists();
subscribeB2BConfig(syncTagLists);

export const TAG_GROUPS: { label: string; tags: string[] }[] = [
  { label: "AUDIENCE", tags: AUDIENCE_OPTIONS },
  { label: "PARTNERSHIP", tags: PARTNERSHIP_TAGS },
  { label: "TRADE", tags: TRADE_TAGS },
];

/** A record's audience. Untagged means it reaches everyone, so this always
 * resolves to one of the two AUDIENCE_OPTIONS — there is no "no audience".
 * A Trade or Partnership tag excludes B2C users just as the explicit tag does
 * (the Audience step's own copy: "B2C is still excluded if you set a Trade or
 * Partnership"), so either one also reads "B2B Companies Only". The Audience
 * columns, the Audience filter and the Feedback Form trigger picker
 * (`allUsersOnly`) all resolve through this one rule. */
export function audienceOf(tags: string[] | undefined): string {
  const list = tags ?? [];
  return list.some(
    (t) => t === AUDIENCE_B2B_ONLY || TRADE_TAGS.includes(t) || PARTNERSHIP_TAGS.includes(t),
  )
    ? AUDIENCE_B2B_ONLY
    : AUDIENCE_ALL_USERS;
}

/** Does a record match a selection from the "Audience/B2B Tags" menu? The two
 * Audience options test the record's resolved audience (`audienceOf`); every
 * other tag is a plain membership test. */
export function matchesTagFilter(
  tags: string[] | undefined,
  selected: readonly string[],
): boolean {
  const list = tags ?? [];
  return selected.some((t) =>
    t === AUDIENCE_ALL_USERS || t === AUDIENCE_B2B_ONLY ? audienceOf(list) === t : list.includes(t),
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
