import { useState, useMemo, useEffect, useRef } from "react";
import { Dropdown } from "./Dropdown";
import { PlusCircleIcon, XCircleIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon, CheckIcon, EditColumnsIcon, DragHandleIcon } from "./icons";
import {
  CREATED_BY_IN_HOUSE,
  CREATED_BY_B2B,
  CERTIFICATIONS,
  DISCOVERABLE_OPTIONS,
  FINAL_EXAM_OPTIONS,
  TASK_TYPES,
  VISIBILITIES,
  TAG_GROUPS,
  OPTIONAL_COLUMNS,
  FIXED_COLUMNS,
  type OptionalColumn,
} from "../data/filters";

export type FilterState = {
  creators: string[];
  certifications: string[];
  discoverable: string[];
  finalExam: string[];
  types: string[];
  visibilities: string[];
  tags: string[];
};

export type ColumnState = Record<OptionalColumn, boolean>;

type Props = {
  filters: FilterState;
  setFilters: (next: FilterState) => void;
  /** Extra filter pills appended to the row (e.g. the wizard's Industry pill). */
  extraPills?: React.ReactNode;
  /** How many values the extra pills currently hold — feeds "Clear Filters". */
  extraActive?: number;
  onClearExtra?: () => void;
};

export function Filters({
  filters,
  setFilters,
  extraPills,
  extraActive = 0,
  onClearExtra,
}: Props) {
  const moreCount =
    filters.types.length + filters.visibilities.length + filters.tags.length;

  const hasFilters =
    filters.creators.length +
      filters.certifications.length +
      filters.discoverable.length +
      filters.finalExam.length +
      moreCount +
      extraActive >
    0;

  function clearAll() {
    setFilters({
      creators: [],
      certifications: [],
      discoverable: [],
      finalExam: [],
      types: [],
      visibilities: [],
      tags: [],
    });
    onClearExtra?.();
  }

  return (
    <div className="filters">
      <CreatedByPill
        value={filters.creators}
        onApply={(v) => setFilters({ ...filters, creators: v })}
      />
      <CertificationsPill
        value={filters.certifications}
        onApply={(v) => setFilters({ ...filters, certifications: v })}
      />
      <DiscoverablePill
        value={filters.discoverable}
        onApply={(v) => setFilters({ ...filters, discoverable: v })}
      />
      <FinalExamPill
        value={filters.finalExam}
        onApply={(v) => setFilters({ ...filters, finalExam: v })}
      />
      <MoreFiltersPill
        types={filters.types}
        visibilities={filters.visibilities}
        tags={filters.tags}
        count={moreCount}
        onApply={(v) =>
          setFilters({
            ...filters,
            types: v.types,
            visibilities: v.visibilities,
            tags: v.tags,
          })
        }
      />
      {extraPills}
      {hasFilters && (
        <button className="filter-clear-link" onClick={clearAll}>
          Clear Filters
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

export function PillTrigger({
  label,
  value,
  open,
  toggle,
  onClear,
}: {
  label: string;
  value: string | null;
  open: boolean;
  toggle: () => void;
  onClear?: () => void;
}) {
  if (value && onClear) {
    return (
      <span className={`filter-applied ${open ? "open" : ""}`}>
        <button
          className="filter-applied-clear"
          onClick={onClear}
          aria-label={`Clear ${label}`}
        >
          <XCircleIcon />
        </button>
        <button className="filter-applied-main" onClick={toggle}>
          <span className="label">{label}</span>
          <span className="sep" />
          <span className="value">{value}</span>
          <span className="caret">
            <ChevronDownIcon />
          </span>
        </button>
      </span>
    );
  }
  return (
    <button
      className={`filter-pill-dashed ${open ? "open" : ""}`}
      onClick={toggle}
    >
      <span className="icon">
        <PlusCircleIcon />
      </span>
      {label}
    </button>
  );
}

export function summarize(values: string[], all: string[]): string | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  if (values.length === all.length) return "All";
  return `${values.length} selected`;
}

/* ─────────────────────────────────────────────────────────────── */

/* The Created By pill — in-house and B2B creators as two labelled subsections
   with their own All/None. Shared so every list page's Created By filter is the
   same menu (Tasks, Certifications, Hands-On Task Submissions). */
export function CreatedByPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const all = [...CREATED_BY_IN_HOUSE, ...CREATED_BY_B2B];
  const summary = summarize(value, all);

  return (
    <Dropdown
      width={300}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Created By"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[
            { label: "Made in house", items: CREATED_BY_IN_HOUSE },
            { label: "B2B customers", items: [...CREATED_BY_B2B].sort() },
          ]}
          subsectionStyle
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable
          searchPlaceholder="Search creators…"
        />
      )}
    </Dropdown>
  );
}

function CertificationsPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, CERTIFICATIONS);

  return (
    <Dropdown
      width={300}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Certifications"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: CERTIFICATIONS }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable
          searchPlaceholder="Search certifications…"
        />
      )}
    </Dropdown>
  );
}

function DiscoverablePill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, DISCOVERABLE_OPTIONS);

  return (
    <Dropdown
      width={220}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Discoverable"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: DISCOVERABLE_OPTIONS }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

function FinalExamPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, FINAL_EXAM_OPTIONS);

  return (
    <Dropdown
      width={220}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Final Exam"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: FINAL_EXAM_OPTIONS }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

function MoreFiltersPill({
  types,
  visibilities,
  tags,
  count,
  onApply,
}: {
  types: string[];
  visibilities: string[];
  tags: string[];
  count: number;
  onApply: (v: { types: string[]; visibilities: string[]; tags: string[] }) => void;
}) {
  const summary = count > 0 ? `${count} active` : null;

  return (
    <Dropdown
      width={320}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More filters"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply({ types: [], visibilities: [], tags: [] })}
        />
      )}
    >
      {({ close }) => (
        <MoreFiltersBody
          types={types}
          visibilities={visibilities}
          tags={tags}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

/** Column set for a table's Edit Columns menu. Defaults to the Tasks table. */
export type ColumnDef<K extends string> = { key: K; label: string };

/* ─────────────── Column order ───────────────
   Visibility is a Record<key, boolean>; ORDER is a separate array of every
   optional key, which the Edit Columns menu reorders by drag. Tables render by
   walking the order and dropping anything switched off, so a drag in the menu
   moves the real column. */
export function useColumnOrder<K extends string>(defs: readonly ColumnDef<K>[]) {
  return useState<K[]>(() => defs.map((d) => d.key));
}

/** The visible columns, in the user's order. */
export function orderedColumns<K extends string, D extends ColumnDef<K>>(
  defs: readonly D[],
  order: readonly K[],
  visible: Record<string, boolean>,
): D[] {
  const byKey = new Map(defs.map((d) => [d.key, d] as const));
  const seen = new Set<K>();
  const out: D[] = [];
  order.forEach((k) => {
    const d = byKey.get(k);
    if (d && visible[k]) out.push(d);
    seen.add(k);
  });
  // Defs added since the order was captured fall in at the end.
  defs.forEach((d) => {
    if (!seen.has(d.key) && visible[d.key]) out.push(d);
  });
  return out;
}

/** Move `from` to sit where `to` currently is, keeping everything else stable. */
export function moveKey<K extends string>(order: readonly K[], from: K, to: K): K[] {
  const next = [...order];
  const fi = next.indexOf(from);
  const ti = next.indexOf(to);
  if (fi < 0 || ti < 0 || fi === ti) return next;
  next.splice(ti, 0, ...next.splice(fi, 1));
  return next;
}

export function EditColumnsButton<C extends Record<string, boolean>>({
  columns,
  setColumns,
  optional = OPTIONAL_COLUMNS as unknown as ColumnDef<keyof C & string>[],
  fixed = FIXED_COLUMNS,
  order,
  onOrderChange,
}: {
  columns: C;
  setColumns: (c: C) => void;
  optional?: ColumnDef<keyof C & string>[];
  fixed?: { label: string }[];
  /** Pass both to enable drag-to-reorder. */
  order?: (keyof C & string)[];
  onOrderChange?: (next: (keyof C & string)[]) => void;
}) {
  return (
    <Dropdown
      width={300}
      align="right"
      trigger={({ toggle }) => (
        <button
          className="edit-columns-btn"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-label="Edit columns"
          data-tooltip="Edit Columns"
        >
          <EditColumnsIcon />
        </button>
      )}
    >
      {() => (
        <ColumnsBody
          value={columns}
          optional={optional}
          fixed={fixed}
          onApply={(c) => setColumns(c)}
          order={order}
          onOrderChange={onOrderChange}
        />
      )}
    </Dropdown>
  );
}

/* ────────────  Multi-select bodies ──────────── */

export function SectionedMultiSelect({
  sections,
  value,
  onApply,
  searchable = false,
  searchPlaceholder,
  subsectionStyle = false,
}: {
  sections: { label?: string; items: string[] }[];
  value: string[];
  onApply: (v: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  subsectionStyle?: boolean;
}) {
  const [draft, setDraft] = useState<string[]>(value);
  const [query, setQuery] = useState("");

  useEffect(() => setDraft(value), [value]);

  const filteredSections = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => i.toLowerCase().includes(q)),
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, query]);

  function toggle(item: string) {
    setDraft((d) =>
      d.includes(item) ? d.filter((x) => x !== item) : [...d, item],
    );
  }

  function selectAll(items: string[]) {
    setDraft((d) => Array.from(new Set([...d, ...items])));
  }

  function selectNone(items: string[]) {
    setDraft((d) => d.filter((x) => !items.includes(x)));
  }

  return (
    <>
      {searchable && (
        <div className="dropdown-search">
          <span className="dropdown-search-icon">
            <SearchIcon />
          </span>
          <input
            autoFocus
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <div className="dropdown-list">
        {filteredSections.map((s, i) => (
          <div key={s.label ?? i} className={subsectionStyle ? "dropdown-subsection" : "dropdown-section"}>
            {s.label && (
              <div className={subsectionStyle ? "dropdown-subsection-label" : "dropdown-section-label"}>
                <span>{s.label}</span>
                {s.items.length > 1 && (
                  <span className="dropdown-allnone">
                    <button type="button" onClick={() => selectAll(s.items)}>All</button>
                    <button type="button" onClick={() => selectNone(s.items)}>None</button>
                  </span>
                )}
              </div>
            )}
            {s.items.map((item) => (
              <CheckRow
                key={item}
                label={item}
                checked={draft.includes(item)}
                onChange={() => toggle(item)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="dropdown-footer">
        <button className="btn-apply" onClick={() => onApply(draft)}>
          Apply
        </button>
      </div>
    </>
  );
}

/** One row of a "More filters" menu — hovering it opens its checklist alongside. */
export type CascadingSection = {
  key: string;
  label: string;
  /** A group with a label renders as a titled subsection (e.g. the tag groups). */
  groups: { label?: string; items: string[] }[];
  /** Adds a search box above this section's checklist (Figma 24:16115) — for
     long option lists (e.g. Quizzes, Feedback Forms) where scanning unaided
     doesn't scale. Omit for short, fixed option sets like Tasks' Type/Visibility. */
  searchPlaceholder?: string;
};

/* The shared "More filters" body: a list of submenu rows over one Apply button,
   each row revealing its own checklist. Used by the Tasks and Question Bank
   filter rows — pass the sections and a {key: values} map. */
export function CascadingMultiSelect({
  sections,
  value,
  onApply,
}: {
  sections: CascadingSection[];
  value: Record<string, string[]>;
  onApply: (v: Record<string, string[]>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string[]>>(value);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredTop, setHoveredTop] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => setDraft(value), [value]);

  function toggleIn(sectionKey: string, item: string) {
    setDraft((d) => {
      const list = d[sectionKey] ?? [];
      return {
        ...d,
        [sectionKey]: list.includes(item)
          ? list.filter((x) => x !== item)
          : [...list, item],
      };
    });
  }

  function hover(key: string, top: number) {
    if (key !== hovered) setQuery("");
    setHovered(key);
    setHoveredTop(top);
  }

  const openSection = sections.find((s) => s.key === hovered);
  const q = query.trim().toLowerCase();

  return (
    <div className="cascading-menu" onMouseLeave={() => setHovered(null)}>
      <div className="cascading-root">
        <div className="dropdown-list">
          {sections.map((s) => (
            <SubmenuRow
              key={s.key}
              label={s.label}
              active={hovered === s.key}
              onHover={(top) => hover(s.key, top)}
            />
          ))}
        </div>
        <div className="dropdown-footer">
          <button className="btn-apply" onClick={() => onApply(draft)}>
            Apply
          </button>
        </div>
      </div>

      {openSection && (() => {
        const groups = q
          ? openSection.groups
              .map((g) => ({ ...g, items: g.items.filter((i) => i.toLowerCase().includes(q)) }))
              .filter((g) => g.items.length > 0)
          : openSection.groups;
        return (
          <div
            className="cascading-sub"
            style={{ top: hoveredTop }}
            onMouseEnter={() => setHovered(openSection.key)}
          >
            {openSection.searchPlaceholder && (
              <div className="dropdown-search">
                <span className="dropdown-search-icon">
                  <SearchIcon />
                </span>
                <input
                  autoFocus
                  placeholder={openSection.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
            <div className="dropdown-list">
              {groups.length === 0 ? (
                <div className="cols-empty">
                  {q ? `No matches for "${query.trim()}".` : "Nothing to filter by yet"}
                </div>
              ) : (
                groups.map((group, i) => (
                  <div
                    key={group.label ?? i}
                    className={group.label ? "dropdown-subsection" : "dropdown-section"}
                  >
                    {group.label && (
                      <div className="dropdown-subsection-label">{group.label}</div>
                    )}
                    {group.items.map((item) => (
                      <CheckRow
                        key={item}
                        label={item}
                        checked={(draft[openSection.key] ?? []).includes(item)}
                        onChange={() => toggleIn(openSection.key, item)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function MoreFiltersBody({
  types,
  visibilities,
  tags,
  onApply,
}: {
  types: string[];
  visibilities: string[];
  tags: string[];
  onApply: (v: { types: string[]; visibilities: string[]; tags: string[] }) => void;
}) {
  const value = useMemo(
    () => ({ types, visibilities, tags }),
    [types, visibilities, tags],
  );

  return (
    <CascadingMultiSelect
      sections={[
        { key: "types", label: "Task Type", groups: [{ items: [...TASK_TYPES] }] },
        { key: "visibilities", label: "Visibility", groups: [{ items: [...VISIBILITIES] }] },
        {
          key: "tags",
          label: "Content/Trade Tags",
          groups: TAG_GROUPS.map((g) => ({ label: g.label, items: [...g.tags] })),
        },
      ]}
      value={value}
      onApply={(v) =>
        onApply({ types: v.types, visibilities: v.visibilities, tags: v.tags })
      }
    />
  );
}

function SubmenuRow({
  label,
  active,
  onHover,
}: {
  label: string;
  active: boolean;
  onHover: (top: number) => void;
}) {
  function handle(e: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>) {
    const btn = e.currentTarget;
    const parent = btn.offsetParent as HTMLElement | null;
    // offsetTop is relative to nearest positioned ancestor (the cascading-menu)
    let top = btn.offsetTop;
    let el: HTMLElement | null = btn.parentElement;
    while (el && el !== parent) {
      top += el.offsetTop;
      el = el.parentElement;
    }
    onHover(top);
  }
  return (
    <button
      className={`dropdown-submenu-row ${active ? "active" : ""}`}
      onMouseEnter={handle}
      onFocus={handle}
    >
      <span className="dropdown-submenu-label">{label}</span>
      <span className="dropdown-submenu-chevron"><ChevronRightIcon /></span>
    </button>
  );
}

export function ColumnsBody<C extends Record<string, boolean>>({
  value,
  optional,
  fixed,
  onApply,
  order,
  onOrderChange,
}: {
  value: C;
  optional: ColumnDef<keyof C & string>[];
  fixed: { label: string }[];
  onApply: (v: C) => void;
  /** Every optional key in display order. Omit to disable reordering. */
  order?: (keyof C & string)[];
  onOrderChange?: (next: (keyof C & string)[]) => void;
}) {
  type K = keyof C & string;
  const canReorder = !!order && !!onOrderChange;
  const seq: K[] = order ?? optional.map((c) => c.key);
  const byKey = new Map(optional.map((c) => [c.key, c] as const));
  const inOrder = seq.map((k) => byKey.get(k)).filter(Boolean) as ColumnDef<K>[];
  optional.forEach((c) => {
    if (!seq.includes(c.key)) inOrder.push(c);
  });

  const active = inOrder.filter((c) => value[c.key]);
  const available = inOrder.filter((c) => !value[c.key]);

  /* Drag-to-reorder, same HTML5 pattern the Spotlights queue uses. The source
     key lives in a ref as well as state: state drives the row styling, but the
     ref is what `dropOn` reads, so the drop is correct even when dragstart and
     drop land in the same render tick. */
  const dragRef = useRef<K | null>(null);
  const [dragKey, setDragKey] = useState<K | null>(null);
  const [overKey, setOverKey] = useState<K | null>(null);

  function startDrag(key: K) {
    dragRef.current = key;
    setDragKey(key);
  }

  function endDrag() {
    dragRef.current = null;
    setDragKey(null);
    setOverKey(null);
  }

  function dropOn(target: K) {
    const from = dragRef.current;
    if (from && onOrderChange) onOrderChange(moveKey(seq, from, target));
    endDrag();
  }

  function setAll(on: boolean) {
    const next = { ...value };
    optional.forEach((c) => {
      next[c.key] = on as C[keyof C & string];
    });
    onApply(next);
  }

  const clearAll = () => setAll(false);
  const activateAll = () => setAll(true);

  const setOne = (key: keyof C & string, on: boolean) =>
    onApply({ ...value, [key]: on as C[keyof C & string] });

  return (
    <div className="dropdown-list cols-menu">
      <div className="dropdown-section">
        <div className="dropdown-section-label">Fixed columns</div>
        {fixed.map(({ label }) => (
          <div key={label} className="cols-fixed-row">
            {label}
          </div>
        ))}
      </div>

      <div className="dropdown-section">
        <div className="dropdown-section-label">
          <span>Active columns</span>
          {active.length > 0 && (
            <span className="dropdown-allnone">
              <button type="button" onClick={clearAll}>None</button>
            </span>
          )}
        </div>
        {active.length === 0 ? (
          <div className="cols-empty">No active columns</div>
        ) : (
          active.map(({ key, label }) => (
            <CheckRow
              key={key}
              label={label}
              checked
              draggable={canReorder}
              dragging={dragKey === key}
              dropTarget={overKey === key && dragKey !== key}
              onDragStart={() => startDrag(key)}
              onDragEnter={() => setOverKey(key)}
              onDrop={() => dropOn(key)}
              onDragEnd={endDrag}
              onChange={() => setOne(key, false)}
            />
          ))
        )}
      </div>

      <div className="dropdown-section">
        <div className="dropdown-section-label">
          <span>Available columns</span>
          {available.length > 0 && (
            <span className="dropdown-allnone">
              <button type="button" onClick={activateAll}>All</button>
            </span>
          )}
        </div>
        {available.length === 0 ? (
          <div className="cols-empty">All columns are active</div>
        ) : (
          available.map(({ key, label }) => (
            <CheckRow
              key={key}
              label={label}
              checked={false}
              onChange={() => setOne(key, true)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function CheckRow({
  label,
  checked,
  onChange,
  draggable = false,
  dragging = false,
  dropTarget = false,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  draggable?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
  return (
    <button
      className={`dropdown-item cols-row ${dragging ? "is-dragging" : ""} ${
        dropTarget ? "is-drop-target" : ""
      }`}
      onClick={onChange}
      // Ticking a row must not pull focus off a search box above it — the
      // search stays live so the user can keep typing. Draggable rows keep
      // their default mousedown, which the HTML5 drag needs.
      onMouseDown={draggable ? undefined : (e) => e.preventDefault()}
      draggable={draggable}
      onDragStart={(e) => {
        // Firefox needs payload set or the drag never starts.
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", label);
        onDragStart?.();
      }}
      onDragEnter={onDragEnter}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      onDragEnd={onDragEnd}
    >
      <span className={`checkbox ${checked ? "checked" : ""}`}>
        {checked && <CheckIcon />}
      </span>
      <span className="cols-row-label">{label}</span>
      {draggable && (
        <span className="cols-drag-handle" aria-hidden="true">
          <DragHandleIcon />
        </span>
      )}
    </button>
  );
}
