/* The app-wide table width rule, in one place: every data column has a
 * content-sized base width, their sum (plus the gutters) is the table's
 * `--table-min` floor, and on a wider page the slack spreads across the DATA
 * columns in proportion to those widths. The gutter columns — the row
 * checkbox and the 3-dot actions column — stay at their fixed widths.
 *
 * How: gutters are px `<col>`s; data columns are PERCENTAGES of their share of
 * the data total. With `table-layout: fixed`, Chrome gives the px columns
 * their width first and scales the percentages (which sum to 100%) into what
 * is left, so at the floor they resolve to exactly the base widths. Plain px
 * data columns would let the gutters take a share too (40 → ~51px on a wide
 * Skills table); `calc((100% - 40px) * k)` on a `<col>` is ignored by Chrome. */

type Width = number | false | null | undefined;

export function TableCols({
  lead = [],
  data,
  trail = [],
}: {
  /** Fixed gutters before the data — the row checkbox. */
  lead?: number[];
  /** Base widths of the data columns; falsy entries (hidden columns) drop out. */
  data: Width[];
  /** Fixed gutters after the data — the 3-dot actions column. */
  trail?: number[];
}) {
  const widths = data.filter((w): w is number => typeof w === "number" && w > 0);
  const total = widths.reduce((n, w) => n + w, 0) || 1;
  return (
    <colgroup>
      {lead.map((w, i) => (
        <col key={`l${i}`} style={{ width: w }} />
      ))}
      {widths.map((w, i) => (
        <col key={`d${i}`} style={{ width: `${(w / total) * 100}%` }} />
      ))}
      {trail.map((w, i) => (
        <col key={`t${i}`} style={{ width: w }} />
      ))}
    </colgroup>
  );
}
