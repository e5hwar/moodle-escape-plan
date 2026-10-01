/* Characters-left counter for a field with a limit — Figma 1369:1696 "Open +
   Character Limit". Sits at the right edge of a language row (`.lang-field-row`
   / `.rte-lang-row`) and reads `max - length`, so an empty row shows the whole
   limit. Past the limit it goes negative and takes the field-error red
   (1369:1478 "-8"); the field that hosts it flags its shell at the same time
   and the page names the limit in the label row. A limit is SOFT — typing past
   it is allowed, which is what makes that state reachable. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  return (
    <span className={`lang-field-count${left < 0 ? " is-over" : ""}`}>{left}</span>
  );
}
