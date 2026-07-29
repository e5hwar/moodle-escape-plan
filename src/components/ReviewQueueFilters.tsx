import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";

/* ── Review queue filters ────────────────────────────────────────────────────
   The filter row inside the review queue popover (Figma 263:1664): one pill per
   primary filter plus a "More Filters" pill holding the rest. These are the
   same components the Review Hands-On table uses and they drive the same state,
   so changing a filter here re-filters the queue in place. ── */

export type QueueFilter = {
  label: string;
  all: string[];
  value: string[];
  onApply: (v: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Gets its own pill; everything else sits behind "More Filters". */
  primary?: boolean;
};

export function QueueFilters({ filters }: { filters: QueueFilter[] }) {
  const primary = filters.filter((f) => f.primary);
  const rest = filters.filter((f) => !f.primary);

  return (
    <>
      {primary.map((f) => (
        <QueuePill key={f.label} filter={f} />
      ))}
      {rest.length > 0 && <MoreFiltersPill filters={rest} />}
    </>
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
          sections={[{ items: f.all }]}
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

/** The remaining filters as one subheaded dropdown (Figma 24:16115). Values are
 * flattened for the shared multi-select, then split back per filter on apply —
 * safe because the option sets don't overlap. */
function MoreFiltersPill({ filters }: { filters: QueueFilter[] }) {
  const activeCount = filters.reduce((n, f) => n + f.value.length, 0);
  const flatValue = filters.flatMap((f) => f.value);

  const applyFlat = (v: string[]) =>
    filters.forEach((f) => f.onApply(v.filter((x) => f.all.includes(x))));

  return (
    <Dropdown
      width={300}
      align="right"
      direction="up"
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More Filters"
          value={activeCount > 0 ? `${activeCount} active` : null}
          open={open}
          toggle={toggle}
          onClear={() => applyFlat([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={filters.map((f) => ({ label: f.label, items: f.all }))}
          value={flatValue}
          onApply={(v) => {
            applyFlat(v);
            close();
          }}
          subsectionStyle
          searchable
          searchPlaceholder="Search filters…"
        />
      )}
    </Dropdown>
  );
}
