import { useState, useMemo, useEffect } from "react";
import { Dropdown } from "./Dropdown";
import {
  PlusCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  SearchIcon,
  CheckIcon,
  EditColumnsIcon,
  DragHandleIcon,
} from "./icons";
import {
  CREATED_BY_IN_HOUSE,
  CREATED_BY_B2B,
  CERTIFICATIONS,
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
  types: string[];
  visibilities: string[];
  tags: string[];
};

export type ColumnState = Record<OptionalColumn, boolean>;

type Props = {
  filters: FilterState;
  setFilters: (next: FilterState) => void;
};

export function Filters({ filters, setFilters }: Props) {
  const moreCount =
    filters.types.length + filters.visibilities.length + filters.tags.length;

  function clearAll() {
    setFilters({
      creators: [],
      certifications: [],
      types: [],
      visibilities: [],
      tags: [],
    });
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
      <button className="filter-clear-link" onClick={clearAll}>
        Clear filters
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function PillTrigger({
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

function summarize(values: string[], all: string[]): string | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  if (values.length === all.length) return "All";
  return `${values.length} selected`;
}

/* ─────────────────────────────────────────────────────────────── */

function CreatedByPill({
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

export function EditColumnsButton({
  columns,
  setColumns,
}: {
  columns: ColumnState;
  setColumns: (c: ColumnState) => void;
}) {
  return (
    <Dropdown
      width={240}
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
        <ColumnsBody value={columns} onApply={(c) => setColumns(c)} />
      )}
    </Dropdown>
  );
}

/* ────────────  Multi-select bodies ──────────── */

function SectionedMultiSelect({
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

  return (
    <>
      {searchable && (
        <div className="dropdown-search">
          <span className="dropdown-search-icon">
            <SearchIcon />
          </span>
          <input
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
                {s.label}
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
  const [draftTypes, setDraftTypes] = useState(types);
  const [draftVis, setDraftVis] = useState(visibilities);
  const [draftTags, setDraftTags] = useState(tags);
  const [hovered, setHovered] = useState<"type" | "visibility" | "tags" | null>(null);
  const [hoveredTop, setHoveredTop] = useState(0);

  useEffect(() => setDraftTypes(types), [types]);
  useEffect(() => setDraftVis(visibilities), [visibilities]);
  useEffect(() => setDraftTags(tags), [tags]);

  function toggleIn(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function applyAll() {
    onApply({ types: draftTypes, visibilities: draftVis, tags: draftTags });
  }

  return (
    <div className="cascading-menu" onMouseLeave={() => setHovered(null)}>
      <div className="cascading-root">
        <div className="dropdown-list">
          <SubmenuRow
            label="Type"
            count={draftTypes.length}
            active={hovered === "type"}
            onHover={(top) => { setHovered("type"); setHoveredTop(top); }}
          />
          <SubmenuRow
            label="Visibility"
            count={draftVis.length}
            active={hovered === "visibility"}
            onHover={(top) => { setHovered("visibility"); setHoveredTop(top); }}
          />
          <SubmenuRow
            label="Categories / Tags"
            count={draftTags.length}
            active={hovered === "tags"}
            onHover={(top) => { setHovered("tags"); setHoveredTop(top); }}
          />
        </div>
        <div className="dropdown-footer">
          <button className="btn-apply" onClick={applyAll}>
            Apply
          </button>
        </div>
      </div>

      {hovered && (
        <div
          className="cascading-sub"
          style={{ top: hoveredTop }}
          onMouseEnter={() => setHovered(hovered)}
        >
          <div className="dropdown-list">
            {hovered === "type" && (
              <div className="dropdown-section">
                {TASK_TYPES.map((t) => (
                  <CheckRow
                    key={t}
                    label={t}
                    checked={draftTypes.includes(t)}
                    onChange={() => toggleIn(draftTypes, setDraftTypes, t)}
                  />
                ))}
              </div>
            )}

            {hovered === "visibility" && (
              <div className="dropdown-section">
                {VISIBILITIES.map((v) => (
                  <CheckRow
                    key={v}
                    label={v}
                    checked={draftVis.includes(v)}
                    onChange={() => toggleIn(draftVis, setDraftVis, v)}
                  />
                ))}
              </div>
            )}

            {hovered === "tags" &&
              TAG_GROUPS.map((group) => (
                <div key={group.label} className="dropdown-subsection">
                  <div className="dropdown-subsection-label">{group.label}</div>
                  {group.tags.map((t) => (
                    <CheckRow
                      key={t}
                      label={t}
                      checked={draftTags.includes(t)}
                      onChange={() => toggleIn(draftTags, setDraftTags, t)}
                    />
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmenuRow({
  label,
  count,
  active,
  onHover,
}: {
  label: string;
  count: number;
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
      {count > 0 && <span className="dropdown-submenu-count">{count}</span>}
      <span className="dropdown-submenu-chevron">›</span>
    </button>
  );
}

function ColumnsBody({
  value,
  onApply,
}: {
  value: ColumnState;
  onApply: (v: ColumnState) => void;
}) {
  const active = OPTIONAL_COLUMNS.filter((c) => value[c.key]);
  const available = OPTIONAL_COLUMNS.filter((c) => !value[c.key]);
  return (
    <div className="dropdown-list cols-menu">
      <div className="dropdown-section">
        <div className="dropdown-section-label">Fixed columns</div>
        {FIXED_COLUMNS.map(({ label }) => (
          <div key={label} className="cols-fixed-row">
            {label}
          </div>
        ))}
      </div>

      <div className="dropdown-section">
        <div className="dropdown-section-label">Active columns</div>
        {active.length === 0 ? (
          <div className="cols-empty">No active columns</div>
        ) : (
          active.map(({ key, label }) => (
            <CheckRow
              key={key}
              label={label}
              checked
              draggable
              onChange={() => onApply({ ...value, [key]: false })}
            />
          ))
        )}
      </div>

      <div className="dropdown-section">
        <div className="dropdown-section-label">Available columns</div>
        {available.length === 0 ? (
          <div className="cols-empty">All columns are active</div>
        ) : (
          available.map(({ key, label }) => (
            <CheckRow
              key={key}
              label={label}
              checked={false}
              onChange={() => onApply({ ...value, [key]: true })}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  draggable = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  draggable?: boolean;
}) {
  return (
    <button className="dropdown-item cols-row" onClick={onChange}>
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
