import { useLayoutEffect, useRef, useState } from "react";
import { Dropdown } from "./Dropdown";
import {
  PillTrigger,
  SectionedMultiSelect,
  CascadingMultiSelect,
  summarize,
} from "./Filters";

/* ── Review queue filters ────────────────────────────────────────────────────
   The filter row inside the review queue popover (Figma 263:1664). These are the
   same components the submissions table uses and they drive the same state, so
   changing a filter here re-filters the queue in place.

   The row is ONE line, always. Applied filters get a pill first (a reviewer
   needs to see what's narrowing the queue), then the default pills — Status and
   Created By — if they still fit. Everything that doesn't make the line lives
   behind "More Filters", the same cascading menu the table uses. ── */

export type QueueFilter = {
  label: string;
  all: string[];
  value: string[];
  onApply: (v: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown as a pill when nothing is applied — Status and Created By. */
  primary?: boolean;
  /** Splits the options into labelled subsections with their own All/None — how
   * Created By is drawn everywhere else. Defaults to one flat list of `all`. */
  sections?: { label?: string; items: string[] }[];
};

export function QueueFilters({ filters }: { filters: QueueFilter[] }) {
  /* Candidates for a pill, in priority order: applied first, then the defaults.
     Anything else is a "More Filters" row from the outset. */
  const candidates = [
    ...filters.filter((f) => f.value.length > 0),
    ...filters.filter((f) => f.value.length === 0 && f.primary),
  ];
  const rest = filters.filter((f) => !candidates.includes(f));

  const rowRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(candidates.length);

  /* Fit pass: render every candidate, measure, then drop the ones past the end
     of the line into "More Filters". Re-runs whenever the pills change (their
     applied values change their width) or the panel resizes. */
  const fingerprint = filters.map((f) => `${f.label}:${f.value.join("|")}`).join(",");
  useLayoutEffect(() => {
    setShown(candidates.length);
  }, [fingerprint, candidates.length]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    function measure() {
      if (!row) return;
      const gap = 8;
      const avail = row.clientWidth - (moreRef.current?.offsetWidth ?? 0) - gap;
      let used = 0;
      let fits = 0;
      for (const el of Array.from(row.querySelectorAll<HTMLElement>("[data-qpill]"))) {
        used += el.offsetWidth + gap;
        if (used > avail) break;
        fits++;
      }
      setShown((prev) => (prev === fits ? prev : fits));
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  });

  const pills = candidates.slice(0, shown);
  const overflow = [...candidates.slice(shown), ...rest];

  return (
    <div className="rvc-qfilters" ref={rowRef}>
      {pills.map((f) => (
        <span data-qpill key={f.label}>
          <QueuePill filter={f} />
        </span>
      ))}
      {overflow.length > 0 && (
        <div className="rvc-qfilters-more" ref={moreRef}>
          <MoreFiltersPill filters={overflow} />
        </div>
      )}
    </div>
  );
}

/** A single filter pill — dashed "+ Label" when empty, applied "Label | value"
 * with a clear button once set (Figma 12:15164 / 12:15221). */
function QueuePill({ filter: f }: { filter: QueueFilter }) {
  return (
    <Dropdown
      width={f.searchable ? 300 : 260}
      align="right"
      direction="up"
      trigger={({ open, toggle }) => (
        <PillTrigger
          label={f.label}
          value={summarize(f.value, f.all)}
          open={open}
          toggle={toggle}
          onClear={() => f.onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={f.sections ?? [{ items: f.all }]}
          subsectionStyle={!!f.sections}
          value={f.value}
          onApply={(v) => {
            f.onApply(v);
            close();
          }}
          searchable={f.searchable}
          searchPlaceholder={f.searchPlaceholder}
        />
      )}
    </Dropdown>
  );
}

/** Everything that didn't fit the line, in the table's cascading menu: a row
 * per filter revealing its own checklist, over one Apply. */
function MoreFiltersPill({ filters }: { filters: QueueFilter[] }) {
  const activeCount = filters.reduce((n, f) => n + f.value.length, 0);
  const value = Object.fromEntries(filters.map((f) => [f.label, f.value]));

  return (
    <Dropdown
      width={260}
      align="right"
      direction="up"
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More Filters"
          value={activeCount > 0 ? `${activeCount} Active` : null}
          open={open}
          toggle={toggle}
          onClear={() => filters.forEach((f) => f.onApply([]))}
        />
      )}
    >
      {({ close }) => (
        <CascadingMultiSelect
          /* No search boxes here: the submenu opens at the right edge of the
             popover, where an autofocused input scrolls the page sideways. The
             lists behind these rows are short enough to scan. */
          sections={filters.map((f) => ({
            key: f.label,
            label: f.label,
            groups: f.sections ?? [{ items: f.all }],
          }))}
          value={value}
          onApply={(v) => {
            filters.forEach((f) => f.onApply(v[f.label] ?? []));
            close();
          }}
        />
      )}
    </Dropdown>
  );
}
