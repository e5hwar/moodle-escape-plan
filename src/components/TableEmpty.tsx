/* "No Results" — Figma 1537:1505. The one empty state every table shows once
 * nothing is left to list: a 20px Medium white title, 4px to a 16px #a8a8a8
 * line, both centred. It takes whatever is left of the table area under the
 * header and sits dead centre in it, so it goes AFTER the table(s) as a direct
 * child of the scroll area (`.table-xscroll`, or `.tasks-scroll` where that is
 * the scroller) — never inside a `<td>`, where the plain-text cell reset would
 * flatten it.
 *
 * A table that can only be empty for want of data, with no search or filters
 * to change, doesn't render empty at all — its section is hidden (Full
 * Profile's Skills and Awards) or unreachable (Version History). */
export function TableEmpty() {
  return (
    <div className="table-empty" role="status">
      <div className="table-empty-title">No Results Found :(</div>
      <div className="table-empty-sub">Try changing your search or filters</div>
    </div>
  );
}
