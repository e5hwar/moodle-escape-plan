import { SUGGESTED_WARNING, isOver, limitMessage, limitState, suggestedFor } from "../data/fieldLimits";

/* Characters-left counter for a field with a limit — Figma 1369:1696 "Open +
   Character Limit". Sits at the right edge of a language row (`.lang-field-row`
   / `.rte-lang-row`) and reads `max - length`, so an empty row shows the whole
   limit. Past the limit's suggested length (`suggestedFor`, names only) it
   turns amber (1430:1474 — per row, so a short Spanish row stays grey beside
   a long English one) unless `warn={false}` (a rich-text field); past the limit itself it goes negative and takes the
   field-error red (1369:1478 "-8"). The field that hosts it flags its shell
   at the same time and the page names the limit in the label row. A limit is
   SOFT — typing past it is allowed, which is what makes those states
   reachable. */
export function CharCount({ value, max, warn: warns = true }: { value: string; max: number; warn?: boolean }) {
  const left = max - value.length;
  const warn = warns ? suggestedFor(max) : undefined;
  const tone =
    left < 0 ? " is-over" : warn !== undefined && value.length > warn ? " is-warn" : "";
  return <span className={`lang-field-count${tone}`}>{left}</span>;
}

/* The label-row message for a field past its limit (`.form-label-error`,
   Spotlight's "Use 20 characters or lesser" copy), or — short of that but past
   the suggested length — the amber truncation warning (1430:1479). Renders
   nothing while every value fits, so a label can carry it beside its own
   "cannot be left empty" message — the two never show together, an empty
   value being under any limit.

   Rich-text fields never warn: pass `warn={false}`, or — for a label over a
   mix (Match pairs: rich-text question, plain answer) — the rich-text values
   as `quietValues`, which count toward the hard limit only. */
export function LimitError({
  max,
  values,
  quietValues = [],
  warn = true,
}: {
  max: number;
  values: (string | undefined | null)[];
  quietValues?: (string | undefined | null)[];
  warn?: boolean;
}) {
  if (isOver(max, ...values, ...quietValues)) {
    return <span className="form-label-error">{limitMessage(max)}</span>;
  }
  if (warn && limitState(max, ...values) === "warn") {
    return <span className="form-label-warning">{SUGGESTED_WARNING}</span>;
  }
  return null;
}
