/* Landing-morph chrome (Claude Design "Tasks Landing 6B") — the pieces a list
 * page renders around its existing table so it can open as the search-first
 * landing driven by useLandingMorph. All motion lives in the `.tasks.lm` CSS;
 * these components only supply markup and click-throughs.
 *
 * Page wiring:
 *   <div className="tasks lm" ref={morph.rootRef} data-lm="landing">
 *     …header + toolbar…
 *     <div className="lm-filter-slot">
 *       <LandingPills pills={…} />
 *       <Filters … />                        ← existing row
 *     </div>
 *     <div className="lm-stage">
 *       <LandingOverlay … />
 *       <div className="lm-table"> …existing table + pagination… </div>
 *     </div>
 *   </div>
 */

import { KeepScrollingIcon } from "./icons";

export type LandingPill = { key: string; label: string; onPick: () => void };

/** Most frequent values of a field across the page's rows — used to pick the
 * data-driven "Suggested" pills (e.g. the most-used certification). */
export function topValues<T>(
  items: T[],
  pick: (item: T) => string | string[] | undefined,
  n = 1,
): string[] {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const v = pick(item);
    (Array.isArray(v) ? v : v ? [v] : []).forEach((s) =>
      counts.set(s, (counts.get(s) ?? 0) + 1),
    );
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map((e) => e[0]);
}

/** One data column of the morphing list (Name is built in). `fixed` columns are
 * visible in the landing state (the design's "Type" slot); the rest grow in
 * from zero width as the list becomes the table. `width` is the matching real
 * table column's px width so the p=1 hand-off to the real table lines up. */
export type LandingCol = {
  key: string;
  label: string;
  width: number;
  fixed?: boolean;
};

export type LandingRow = {
  key: string;
  name: React.ReactNode;
  /** Cell content per LandingCol key — mirror the real table's default cells. */
  cells: Record<string, React.ReactNode>;
  /** Muted treatment for rows that are hidden / unused / archived. */
  dim?: boolean;
};

const PillPlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
    <line x1="8" y1="5.4" x2="8" y2="10.6" stroke="currentColor" strokeWidth="1.3" />
    <line x1="5.4" y1="8" x2="10.6" y2="8" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

/** One continuous filter row for both states (the reference's pill row): the
 * "Suggested" label collapses away, the suggested pills stay put, and the real
 * Filters row (passed as children) slides in after them as the row widens from
 * its centered 660px landing width to full width — the same pills transition
 * between states instead of one set crossfading into another. */
export function LandingFilterRow({
  pills,
  children,
}: {
  pills: LandingPill[];
  children: React.ReactNode;
}) {
  return (
    <div className="lm-filter-slot">
      <span className="lm-suggested-label">Suggested</span>
      <span className="lm-pills">
        {pills.map((p) => (
          <button key={p.key} className="lm-pill" onClick={p.onPick}>
            <PillPlusIcon />
            {p.label}
          </button>
        ))}
      </span>
      <div className="lm-filters-flow">{children}</div>
    </div>
  );
}

/** The landing layer over the table: caption row, the morphing list (columns
 * grow in and a header row slides in as the gesture progresses — the design's
 * "the list becomes the table"), and the "keep scrolling" hint. The real table
 * replaces it only at p=1, via a short aligned crossfade in CSS. */
export function LandingOverlay({
  caption,
  total,
  rows,
  columns,
  leadColumns = [],
  nameLabel = "Name",
  nameWidth = 240,
  actionsWidth = 40,
  onShowAll,
  onRowClick,
}: {
  caption: string;
  total: number;
  rows: LandingRow[];
  /** Data columns after Name, in the real table's order. */
  columns: LandingCol[];
  /** Columns before Name (e.g. the Certifications table leads with ID). */
  leadColumns?: LandingCol[];
  nameLabel?: string;
  /** The real table's Name column width. The name track morphs from flexible
   * (landing) to this minimum, so when the table overflows at its --table-min
   * the p=1 hand-off is pixel-exact. */
  nameWidth?: number;
  /** The real table's ⋯ actions gutter. Pass 0 for tables with no actions
   * column (Proctoring) so no gutter track is reserved or drawn. */
  actionsWidth?: number;
  onShowAll: () => void;
  onRowClick?: (row: LandingRow) => void;
}) {
  // Non-fixed tracks grow from 0 with the morph; the trailing 40px gutter is
  // the real table's actions column. Each track's END size mirrors the fixed-
  // layout table it hands off to: when the container is wider than the summed
  // column widths, Chrome stretches every column in proportion to its
  // specified width (verified: td = W × container/total to 0.1px), and below
  // that sum the table overflows at exact pixel widths — `max(Wpx, W×100%/total)`
  // reproduces both regimes, so the hand-off never bumps at any viewport.
  const totalWidth =
    nameWidth + [...leadColumns, ...columns].reduce((s, c) => s + c.width, 0) + actionsWidth;
  const share = (w: number) => `max(${w}px, ${w} * 100% / ${totalWidth})`;
  const track = (c: LandingCol) =>
    c.fixed
      ? `calc(${c.width}px * (1 - var(--lm)) + ${share(c.width)} * var(--lm))`
      : `calc(${share(c.width)} * var(--lm))`;
  const template = [
    ...leadColumns.map(track),
    // Name absorbs the leftover: in the stretch regime the other tracks leave
    // exactly nameWidth × scale free, in the overflow regime 1fr bottoms out
    // at the minimum — both match the real table's Name column.
    `minmax(calc(${nameWidth}px * var(--lm)), 1fr)`,
    ...columns.map(track),
    ...(actionsWidth > 0 ? [`calc(${share(actionsWidth)} * var(--lm))`] : []),
  ].join(" ");

  const cells = (r: LandingRow) => (
    <>
      {leadColumns.map((c) => (
        <span key={c.key} className="lm-cell lm-cell--grow">{r.cells[c.key]}</span>
      ))}
      <span className="lm-cell lm-cell--name">{r.name}</span>
      {columns.map((c) => (
        <span key={c.key} className={`lm-cell${c.fixed ? "" : " lm-cell--grow"}`}>
          {r.cells[c.key]}
        </span>
      ))}
      {actionsWidth > 0 && <span className="lm-cell lm-cell--grow lm-cell--dots">⋯</span>}
    </>
  );

  return (
    <div className="lm-land" style={{ "--lmtw": totalWidth } as React.CSSProperties}>
      <div className="lm-caption">
        <span className="lm-caption-label">{caption}</span>
        <button className="lm-caption-all" onClick={onShowAll}>
          all {total} ↓
        </button>
      </div>
      <div className="lm-list">
        <div className="lm-head" style={{ gridTemplateColumns: template }}>
          {leadColumns.map((c) => (
            <span key={c.key} className="lm-cell lm-cell--grow">{c.label}</span>
          ))}
          <span className="lm-cell">{nameLabel}</span>
          {columns.map((c) => (
            <span key={c.key} className={`lm-cell${c.fixed ? "" : " lm-cell--grow"}`}>
              {c.label}
            </span>
          ))}
          {actionsWidth > 0 && <span className="lm-cell" />}
        </div>
        {rows.map((r) => (
          <div
            key={r.key}
            className={`lm-row ${r.dim ? "lm-row--dim" : ""}`}
            style={{ gridTemplateColumns: template }}
            onClick={() => onRowClick?.(r)}
          >
            {cells(r)}
          </div>
        ))}
      </div>
      <div className="lm-hint-wrap">
        {/* Figma 716:1648 "Minimal State - Keep Scrolling" — a full-width bar
            with a top rule, not the pill it replaced. */}
        <button className="lm-hint" onClick={onShowAll}>
          <KeepScrollingIcon />
          Keep scrolling to see the table
        </button>
      </div>
    </div>
  );
}

/** "↑ Back to search" — placed as the first child of the page's .pagination
 * row; returns the page to the landing state. */
export function BackToSearch({ onClick }: { onClick: () => void }) {
  return (
    <button className="lm-back" onClick={onClick}>
      ↑ Back to search
    </button>
  );
}
