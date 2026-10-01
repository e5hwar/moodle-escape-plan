/* App-wide character limits for free-text fields, per language. Placeholder
   values until each field gets its own (Spotlight's 20/60 copy limits are
   the one exception — see `data/spotlights.ts`).

   Two tiers, both SOFT in that typing never stops:
   - The LIMIT (Figma 1369:1696 "Open + Character Limit" / 1369:1478): past
     it the field's `CharCount` goes negative and red, the label row says
     `limitMessage(max)`, and the page's save / publish gate blocks on
     `isOver`.
   - The SUGGESTED length (Figma 1430:1474 "Character Limit Warning"): where
     the copy starts getting truncated in the app. Past it the shell and the
     counter turn amber and the label row warns — advisory only, no gate.
     NAMES ONLY: descriptions and every rich-text field have no warning tier
     (the user, 2026-10-01) — just the counter and the hard limit. */

/** Names, titles, labels — every short single-line field. */
export const NAME_MAX = 128;
/** Where a name starts getting truncated. */
export const NAME_SUGGESTED = 52;

/** Descriptions and every other long-form field (rich text, notes). No
 *  suggested length — they never warn. */
export const DESCRIPTION_MAX = 512;

/** The suggested length that goes with a limit: only names have one.
 *  Undefined for descriptions and for a field's own limit (Spotlight's), so a
 *  field opts into the warning tier just by passing `NAME_MAX`. */
export function suggestedFor(max: number): number | undefined {
  return max === NAME_MAX ? NAME_SUGGESTED : undefined;
}

/** True when any of the values (one per language) runs past `max`. */
export function isOver(max: number, ...values: (string | undefined | null)[]): boolean {
  return values.some((v) => (v?.length ?? 0) > max);
}

/** Which tier the values sit in for a limit: `"over"` past `max` (blocks),
 *  `"warn"` past its suggested length (advisory), else null. */
export function limitState(
  max: number,
  ...values: (string | undefined | null)[]
): "over" | "warn" | null {
  if (isOver(max, ...values)) return "over";
  const warn = suggestedFor(max);
  return warn !== undefined && isOver(warn, ...values) ? "warn" : null;
}

/** The shell class for a limit's tier — `has-error` / `has-warning` / "". */
export function limitClass(max: number, ...values: (string | undefined | null)[]): string {
  const state = limitState(max, ...values);
  return state === "over" ? "has-error" : state === "warn" ? "has-warning" : "";
}

/** The label-row message for an over-limit field (Figma copy, Spotlight's). */
export function limitMessage(max: number): string {
  return `Use ${max} characters or lesser`;
}

/** The label-row warning past the suggested length (1430:1479, verbatim). */
export const SUGGESTED_WARNING = "*Warning: This will get truncated";

/** The blocked CTA tooltip's bullet for an over-limit field. */
export function limitLabel(field: string, max: number): string {
  return `${field} (${max} characters max)`;
}
