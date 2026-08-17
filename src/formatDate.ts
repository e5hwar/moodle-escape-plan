/* Shared short-date formatting: "Sep 27, 2027".
 *
 * The month is spelled from this table rather than left to
 * `toLocaleDateString({ month: "short" })`, which is NOT reliably three
 * characters — recent CLDR abbreviates September as the four-letter "Sept" in
 * en-US, so the built-in format renders "Sept 27, 2027" on newer runtimes and
 * "Sep 27, 2027" on older ones.
 *
 * The ISO string is split rather than parsed into a `Date`, so a "YYYY-MM-DD"
 * value can't shift a day either way depending on the viewer's timezone.
 */

export const MONTHS_3 = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Formats a "YYYY-MM-DD" date; anything else is returned unchanged. */
export function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = MONTHS_3[Number(m[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(m[3])}, ${m[1]}`;
}
