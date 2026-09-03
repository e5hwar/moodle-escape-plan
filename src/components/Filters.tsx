import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { Dropdown } from "./Dropdown";
import { PlusCircleIcon, XCircleIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon, CheckIcon, EditColumnsIcon, DragHandleIcon } from "./icons";
import {
  CREATED_BY_IN_HOUSE,
  CREATED_BY_B2B,
  CERTIFICATIONS,
  DISCOVERABLE_OPTIONS,
  SUBSCRIPTION_OPTIONS,
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
  /** "Requires Subscription?" — see SUBSCRIPTION_OPTIONS. */
  subscription: string[];
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
    filters.visibilities.length +
    filters.subscription.length +
    filters.tags.length +
    filters.discoverable.length;

  const hasFilters =
    filters.creators.length +
      filters.certifications.length +
      filters.types.length +
      moreCount +
      extraActive >
    0;

  function clearAll() {
    setFilters({
      creators: [],
      certifications: [],
      discoverable: [],
      subscription: [],
      types: [],
      visibilities: [],
      tags: [],
    });
    onClearExtra?.();
  }

  return (
    <div className="filters">
      <TaskTypePill
        value={filters.types}
        onApply={(v) => setFilters({ ...filters, types: v })}
      />
      <CertificationsPill
        value={filters.certifications}
        onApply={(v) => setFilters({ ...filters, certifications: v })}
      />
      <CreatedByPill
        value={filters.creators}
        onApply={(v) => setFilters({ ...filters, creators: v })}
      />
      <MoreFiltersPill
        visibilities={filters.visibilities}
        subscription={filters.subscription}
        tags={filters.tags}
        discoverable={filters.discoverable}
        count={moreCount}
        onApply={(v) =>
          setFilters({
            ...filters,
            visibilities: v.visibilities,
            subscription: v.subscription,
            tags: v.tags,
            discoverable: v.discoverable,
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

/* Every filter menu holds a draft and commits it on Apply. Apply is only live
   while the draft actually differs from what's applied — an untouched menu (or
   one toggled back to where it started) leaves the button disabled, which is
   how filter menus behave everywhere else. Selection order is meaningless, so
   the comparison is set-wise. */
export function sameSelection(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((x) => seen.has(x));
}

/* Cascading "More filters" menus open a submenu on hover but never close one
   on hover-out — a pointer wandering off is not a dismissal, and cutting a
   corner on the way to the submenu used to swallow it. Dismissal is a click:
   inside the card, anywhere that is neither a row nor the open submenu puts the
   submenu away; outside the card, the Dropdown's own outside-click closes both
   at once. True when this click should close the open submenu. */
export function dismissesSubmenu(e: React.MouseEvent) {
  const el = e.target as HTMLElement;
  return !el.closest(".cascading-sub") && !el.closest(".dropdown-submenu-row");
}

export function summarize(values: string[], all: string[]): string | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  if (values.length === all.length) return "All";
  return `${values.length} Selected`;
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
          searchPlaceholder="Search Creators…"
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
          searchPlaceholder="Search Certifications…"
        />
      )}
    </Dropdown>
  );
}

function TaskTypePill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, TASK_TYPES);

  return (
    <Dropdown
      width={220}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Task Type"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...TASK_TYPES] }]}
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

type MoreFilterValues = {
  visibilities: string[];
  subscription: string[];
  tags: string[];
  discoverable: string[];
};

function MoreFiltersPill({
  visibilities,
  subscription,
  tags,
  discoverable,
  count,
  onApply,
}: MoreFilterValues & {
  count: number;
  onApply: (v: MoreFilterValues) => void;
}) {
  const summary = count > 0 ? `${count} Active` : null;

  return (
    <Dropdown
      width={320}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More Filters"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() =>
            onApply({ visibilities: [], subscription: [], tags: [], discoverable: [] })
          }
        />
      )}
    >
      {({ close }) => (
        <MoreFiltersBody
          visibilities={visibilities}
          subscription={subscription}
          tags={tags}
          discoverable={discoverable}
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
        <button
          className="btn-apply"
          disabled={sameSelection(draft, value)}
          onClick={() => onApply(draft)}
        >
          Apply
        </button>
      </div>
    </>
  );
}

/* A stable default for `texts` — an inline {} would be a new object every
   render, and the effect that syncs the draft would never settle. */
const EMPTY_TEXTS: Record<string, string> = {};

/* Geometry of the cascading submenu, mirroring `.cascading-sub` in index.css —
   the flip decision has to know how much room the panel will want before it
   renders, so these two must stay in step with the stylesheet. */
const SUBMENU_WIDTH = 280;
const SUBMENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

/** One row of a "More Filters" menu — hovering it opens its checklist alongside. */
export type CascadingSection = {
  key: string;
  label: string;
  /** A group with a label renders as a titled subsection (e.g. the tag groups).
     Omit when the row is a `text` field instead of a checklist. */
  groups?: { label?: string; items: string[] }[];
  /** Makes the submenu a single free-text field (e.g. Certifications' CEUs and
     Keyword) rather than a checklist. Its value lives in `texts`, not `value`. */
  text?: { placeholder?: string; help?: string; numeric?: boolean };
  /** Adds a search box above this section's checklist (Figma 24:16115) — for
     long option lists (e.g. Quizzes, Feedback Forms) where scanning unaided
     doesn't scale. Omit for short, fixed option sets like Tasks' Type/Visibility. */
  searchPlaceholder?: string;
};

/* The shared "More Filters" body: a list of submenu rows, each revealing its own
   checklist. Used by the Tasks and Question Bank filter rows — pass the sections
   and a {key: values} map.
   Apply lives in the SUBMENU, not on the root list (Figma 28:16530 has no footer;
   774:1243/774:1298, the two submenu states, both carry the Apply footer). The
   draft is shared across submenus, so opening several and applying from the last
   one still commits every change. */
export function CascadingMultiSelect({
  sections,
  value,
  texts = EMPTY_TEXTS,
  onApply,
}: {
  sections: CascadingSection[];
  value: Record<string, string[]>;
  /** Applied values for the `text` sections, keyed the same way. */
  texts?: Record<string, string>;
  onApply: (v: Record<string, string[]>, texts: Record<string, string>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string[]>>(value);
  const [textDraft, setTextDraft] = useState<Record<string, string>>(texts);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredTop, setHoveredTop] = useState(0);
  const [query, setQuery] = useState("");
  // The submenu opens alongside the root panel — to its right by default, and
  // to its LEFT when the pill sits close enough to the window edge that the
  // right side would overflow. Without the flip an off-screen submenu widens
  // the document and scrolls the whole page sideways.
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [flip, setFlip] = useState(false);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => setTextDraft(texts), [texts]);

  /* Text fields are trimmed on apply, so trailing whitespace isn't a change. */
  const trimmedTexts = () =>
    Object.fromEntries(
      Object.entries(textDraft).map(([k, v]) => [k, v.trim()]),
    ) as Record<string, string>;

  const unchanged = sections.every((s) =>
    s.text
      ? (textDraft[s.key] ?? "").trim() === (texts[s.key] ?? "")
      : sameSelection(draft[s.key] ?? [], value[s.key] ?? []),
  );

  const apply = () => onApply(draft, trimmedTexts());

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

  // Measured before paint, so the submenu never shows on the wrong side first.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!hovered || !el) return;
    const { right, left } = el.getBoundingClientRect();
    const needed = SUBMENU_WIDTH + SUBMENU_GAP + VIEWPORT_MARGIN;
    // Only flip when the left side actually has the room the right side lacks.
    setFlip(right + needed > window.innerWidth && left - needed >= 0);
  }, [hovered]);

  return (
    <div
      ref={menuRef}
      className="cascading-menu"
      onClick={(e) => dismissesSubmenu(e) && setHovered(null)}
    >
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
      </div>

      {openSection && (() => {
        const groups = q
          ? (openSection.groups ?? [])
              .map((g) => ({ ...g, items: g.items.filter((i) => i.toLowerCase().includes(q)) }))
              .filter((g) => g.items.length > 0)
          : openSection.groups ?? [];
        return (
          <div
            className={`cascading-sub ${flip ? "is-left" : ""}`}
            style={{ top: hoveredTop }}
          >
            {openSection.text ? (
              <div className="dropdown-list filter-textfield">
                <input
                  className="filter-textfield-input"
                  autoFocus
                  inputMode={openSection.text.numeric ? "decimal" : undefined}
                  placeholder={openSection.text.placeholder}
                  value={textDraft[openSection.key] ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = openSection.text?.numeric
                      ? raw.replace(/[^0-9.]/g, "")
                      : raw;
                    setTextDraft((d) => ({ ...d, [openSection.key]: next }));
                  }}
                  onKeyDown={(e) => e.key === "Enter" && !unchanged && apply()}
                />
                {openSection.text.help && (
                  <div className="filter-textfield-help">{openSection.text.help}</div>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
            <div className="dropdown-footer">
              <button className="btn-apply" disabled={unchanged} onClick={apply}>
                Apply
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function MoreFiltersBody({
  visibilities,
  subscription,
  tags,
  discoverable,
  onApply,
}: MoreFilterValues & { onApply: (v: MoreFilterValues) => void }) {
  const value = useMemo(
    () => ({ visibilities, subscription, tags, discoverable }),
    [visibilities, subscription, tags, discoverable],
  );

  return (
    <CascadingMultiSelect
      sections={[
        { key: "visibilities", label: "Visibility", groups: [{ items: [...VISIBILITIES] }] },
        {
          key: "subscription",
          label: "Requires Subscription?",
          groups: [{ items: [...SUBSCRIPTION_OPTIONS] }],
        },
        {
          key: "tags",
          label: "Audience/B2B Tags",
          groups: TAG_GROUPS.map((g) => ({ label: g.label, items: [...g.tags] })),
        },
        {
          key: "discoverable",
          label: "Discoverable",
          groups: [{ items: [...DISCOVERABLE_OPTIONS] }],
        },
      ]}
      value={value}
      onApply={(v) =>
        onApply({
          visibilities: v.visibilities,
          subscription: v.subscription,
          tags: v.tags,
          discoverable: v.discoverable,
        })
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
      onClick={handle}
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
