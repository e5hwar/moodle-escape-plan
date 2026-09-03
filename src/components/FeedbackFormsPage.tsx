import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  activeLinks,
  feedbackForms as seedForms,
  formResponses,
  makeDuplicateForm,
  nextFormId,
  type FeedbackForm,
  type FormStatus,
} from "../data/feedbackForms";
import {
  KeyCommandIcon,
  SearchIcon,
  SortIcon,
  AddIcon,
  RowEditIcon,
  RowKebabIcon,
  RowDeleteIcon,
  MenuResponsesIcon,
  MenuArchiveReplaceIcon,
  CopyIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
} from "./icons";
import { Dropdown } from "./Dropdown";
import {
  EditColumnsButton,
  PillTrigger,
  SectionedMultiSelect,
  summarize,
  useColumnOrder,
  orderedColumns,
} from "./Filters";
import {
  DateRangePill,
  defaultDateRange,
  dateRangeIncludes,
  type DateRangeState,
} from "./DateRangeFilter";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<FormStatus, string> = {
  active: "Active",
  disabled: "Disabled",
  deleted: "Deleted",
};

/* Deleted forms never reach the list, so the pill offers the two live
   states. */
const STATUS_OPTIONS = ["Active", "Disabled"];

/* Dates read the way every other table writes them — short month, zero-padded
   day ("Apr 03, 2026"), so the column stays flush down its left edge. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${m[3]}, ${m[1]}`;
}

/* The Responses column counts what landed inside the Date Range, so the pill
   answers "how many responses in this period?" rather than hiding forms. The
   mocked response sets are a sample of each form's real total, so the in-range
   share is scaled back up to `responseCount`. */
function responsesInRange(f: FeedbackForm, range: DateRangeState): number {
  const all = formResponses[f.id] ?? [];
  if (all.length === 0) return 0;
  const hits = all.filter((r) => dateRangeIncludes(range, r.submittedAt)).length;
  return Math.round((hits / all.length) * f.responseCount);
}

/* ─────────── Column registry ───────────
   Name is the fixed column; everything else is optional and reorderable from
   the Edit Columns menu, so the table walks `orderedColumns(...)`. Status left
   the table — it lives on the Status filter pill instead. */
type FbColumn =
  | "id"
  | "questions"
  | "triggers"
  | "responses"
  | "createdOn"
  | "lastModified"
  | "createdBy";

type FbColMeta = {
  key: FbColumn;
  label: string;
  className: string;
  width: number;
  sortable?: boolean;
  /* True when the cell value is derived from the Date Range filter. */
  dateScoped?: boolean;
  render: (f: FeedbackForm, range: DateRangeState) => React.ReactNode;
};

const FB_COLS: FbColMeta[] = [
  { key: "id", label: "ID", className: "col-id", width: 100, render: (f) => f.id },
  {
    key: "questions",
    label: "Questions",
    className: "col-type",
    width: 120,
    render: (f) => {
      const actives = activeLinks(f).length;
      const inactive = f.questions.length - actives;
      return (
        <>
          {actives}
          {inactive > 0 && <span className="fb-faint"> · {inactive} inactive</span>}
        </>
      );
    },
  },
  {
    key: "triggers",
    label: "Triggers",
    className: "col-used",
    width: 190,
    sortable: false,
    render: (f) =>
      f.triggers.length === 0 ? (
        <span className="fb-faint">—</span>
      ) : (
        <>
          {f.triggers[0].refName}
          {f.triggers.length > 1 && <span className="used-extra">+{f.triggers.length - 1}</span>}
        </>
      ),
  },
  {
    key: "responses",
    label: "Responses",
    className: "col-type",
    width: 140,
    dateScoped: true,
    render: (f, range) => responsesInRange(f, range).toLocaleString(),
  },
  {
    key: "createdOn",
    label: "Created On",
    className: "col-date",
    width: 140,
    render: (f) => formatDate(f.createdAt),
  },
  {
    key: "lastModified",
    label: "Last Modified",
    className: "col-date",
    width: 140,
    render: (f) => formatDate(f.updatedAt),
  },
  {
    key: "createdBy",
    label: "Created By",
    className: "col-creator",
    width: 180,
    sortable: false,
    render: (f) => f.createdBy,
  },
];

const FB_FIXED_COLUMNS = [{ label: "Name" }];

type SortKey = "name" | FbColumn;
type SortDir = "asc" | "desc";

function compare(
  a: FeedbackForm,
  b: FeedbackForm,
  key: SortKey,
  range: DateRangeState,
): number {
  switch (key) {
    case "id": return a.id.localeCompare(b.id);
    case "name": return (a.name || "").localeCompare(b.name || "");
    case "questions": return activeLinks(a).length - activeLinks(b).length;
    case "triggers": return a.triggers.length - b.triggers.length;
    case "responses": return responsesInRange(a, range) - responsesInRange(b, range);
    case "createdOn": return (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
    case "lastModified": return (Date.parse(a.updatedAt) || 0) - (Date.parse(b.updatedAt) || 0);
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
  }
}

type Props = {
  forms: FeedbackForm[];
  onOpen: (id: string, creating?: boolean) => void;
  onViewResponses: (id: string) => void;
  onCreate: (form: FeedbackForm) => void;
  onUpdate: (form: FeedbackForm) => void;
  onDelete: (id: string) => void;
  onBackToCerts?: () => void;
};

export function FeedbackFormsPage({
  forms,
  onOpen,
  onViewResponses,
  onCreate,
  onUpdate,
  onDelete,
  onBackToCerts,
}: Props) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<{ statuses: string[]; creators: string[] }>({
    statuses: [],
    creators: [],
  });
  // The Date Range never hides a form — it scopes the Responses column to a
  // period (default Last 30 Days). Every form is always listed.
  const [dateRange, setDateRange] = useState<DateRangeState>(() => defaultDateRange());
  const [menu, setMenu] = useState<{ form: FeedbackForm; rect: DOMRect } | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "id", dir: "desc" });
  const [page, setPage] = useState(1);
  const [columns, setColumns] = useState<Record<FbColumn, boolean>>({
    id: true,
    questions: true,
    triggers: true,
    responses: true,
    createdOn: true,
    lastModified: true,
    createdBy: true,
  });
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useColumnOrder(FB_COLS);
  const visibleCols = useMemo(() => orderedColumns(FB_COLS, order, columns), [columns, order]);
  useCreateShortcut(() => createBlank());

  const creators = useMemo(
    () => [...new Set(forms.map((f) => f.createdBy))].sort((a, b) => a.localeCompare(b)),
    [forms],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return forms.filter((f) => {
      if (f.status === "deleted") return false;
      if (filters.statuses.length && !filters.statuses.includes(STATUS_LABEL[f.status])) return false;
      if (filters.creators.length && !filters.creators.includes(f.createdBy)) return false;
      if (q && !(
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.createdBy.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [forms, query, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key, dateRange));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort, dateRange]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, filters, dateRange, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  // Natural table width so columns scroll horizontally instead of crushing.
  const tableMin = 260 + 40 + visibleCols.reduce((sum, c) => sum + c.width, 0);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  /* Create goes straight into the wizard — no starting-point pop-up, and no
     draft state: the form is live from the moment it exists, named in the
     wizard's Details step. Duplicating an existing form lives in that form's
     row menu. */
  function handleCreated(form: FeedbackForm) {
    onCreate(form);
    onOpen(form.id, true);
  }

  function createBlank() {
    const today = new Date().toISOString().slice(0, 10);
    handleCreated({
      id: nextFormId(forms),
      name: "",
      status: "active",
      questions: [],
      triggers: [],
      createdBy: "You",
      createdAt: today,
      updatedAt: today,
      responseCount: 0,
    });
  }

  function duplicateForm(src: FeedbackForm) {
    handleCreated(makeDuplicateForm(forms, src));
  }

  function setStatus(form: FeedbackForm, status: FormStatus) {
    onUpdate({ ...form, status, updatedAt: new Date().toISOString().slice(0, 10) });
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks fb-page">
          <header className="tasks-header">
            {/* This page is reached from the Certifications header button (it
                no longer has its own sidebar entry), so the crumb is the way back. */}
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Content</span>
                <ChevronRightIcon />
                <button className="rvc-crumb" onClick={onBackToCerts} title="Back to Certifications">
                  Certifications
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Feedback</span>
              </nav>
              <h1 className="tasks-title">Feedback Forms</h1>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={createBlank}>
                <AddIcon />
                Create Form
                <span className="cta-kbd">C</span>
              </button>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <div className="search-wrap sp-search">
                  <span className="search-icon">
                    <SearchIcon />
                  </span>
                  <input
                    className="search-input"
                    placeholder="Search Forms..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span className="search-kbd">
                    <span className="kbd-cmd"><KeyCommandIcon /></span>
                    <span className="kbd-letter">K</span>
                  </span>
                </div>
              </div>

              <div className="filters">
                <MultiPill
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={filters.statuses}
                  onApply={(v) => setFilters((p) => ({ ...p, statuses: v }))}
                />
                <MultiPill
                  label="Created By"
                  options={creators}
                  value={filters.creators}
                  onApply={(v) => setFilters((p) => ({ ...p, creators: v }))}
                />
                {filters.statuses.length + filters.creators.length > 0 && (
                  <button
                    className="filter-clear-link"
                    onClick={() => setFilters({ statuses: [], creators: [] })}
                  >
                    Clear Filters
                  </button>
                )}
                {/* Date Range holds the row's right edge and always has a
                    value — it scopes the Responses count, so Clear Filters
                    leaves it alone. */}
                <span className="filters-end">
                  <DateRangePill value={dateRange} onChange={setDateRange} />
                </span>
              </div>

              <div className="co-table-row">
                <div className="co-table-col">
                  <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
                    <table className="table table-head">
                      <FbColGroup cols={visibleCols} />
                      <thead>
                        <tr>
                          <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                          {visibleCols.map((c) => (
                            <SortableHeader
                              key={c.key}
                              col={c.key}
                              label={c.label}
                              className={c.className}
                              sort={sort}
                              toggle={toggleSort}
                              sortable={c.sortable !== false}
                              dateScoped={c.dateScoped}
                            />
                          ))}
                          <th className="col-actions">
                            <EditColumnsButton
                              columns={columns}
                              setColumns={setColumns}
                              optional={FB_COLS}
                              fixed={FB_FIXED_COLUMNS}
                              order={order}
                              onOrderChange={setOrder}
                            />
                          </th>
                        </tr>
                      </thead>
                    </table>

                    <div className="tasks-scroll">
                      <table className="table table-body">
                        <FbColGroup cols={visibleCols} />
                        <tbody>
                          {paged.length === 0 ? (
                            <tr>
                              <td colSpan={visibleCols.length + 2} className="u-empty">
                                No Feedback Forms match. Try a different filter or search term.
                              </td>
                            </tr>
                          ) : (
                            paged.map((f) => (
                              <FormRow
                                key={f.id}
                                form={f}
                                cols={visibleCols}
                                range={dateRange}
                                onClick={() => onOpen(f.id)}
                                onEdit={() => onOpen(f.id)}
                                onOpenMenu={(rect) => setMenu({ form: f, rect })}
                                menuOpen={menu?.form.id === f.id}
                              />
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pagination">
                    <span>
                      Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                    </span>
                    <div className="pagination-controls">
                      <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeftIcon /></button>
                      <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRightIcon /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <FormActionsMenu
          form={menu.form}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEdit={() => onOpen(menu.form.id)}
          onViewResponses={() => onViewResponses(menu.form.id)}
          onDuplicate={() => duplicateForm(menu.form)}
          onToggleActive={() =>
            setStatus(menu.form, menu.form.status === "active" ? "disabled" : "active")
          }
          onDelete={() => onDelete(menu.form.id)}
        />
      )}
    </div>
  );
}

/* Status / Created By filter pills — the shared pill + multi-select body every
   other list page uses. */
function MultiPill({
  label,
  options,
  value,
  onApply,
}: {
  label: string;
  options: string[];
  value: string[];
  onApply: (v: string[]) => void;
}) {
  return (
    <Dropdown
      width={240}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label={label}
          value={summarize(value, options)}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: options }]}
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

function FbColGroup({ cols }: { cols: FbColMeta[] }) {
  return (
    <colgroup>
      <col style={{ width: 260 }} />
      {cols.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function FormRow({
  form,
  cols,
  range,
  onClick,
  onEdit,
  onOpenMenu,
  menuOpen,
}: {
  form: FeedbackForm;
  cols: FbColMeta[];
  range: DateRangeState;
  onClick: () => void;
  onEdit: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  return (
    <tr className={menuOpen ? "menu-open" : ""} onClick={onClick}>
      <td className={`col-name ${form.name ? "" : "fb-faint"}`} data-tip={form.name || undefined}>
        {form.name || "Untitled form"}
      </td>
      {cols.map((c) => (
        <td
          key={c.key}
          className={c.className}
          data-tip={
            c.key === "triggers" && form.triggers.length
              ? form.triggers.map((t) => t.refName).join("\n")
              : c.key === "createdBy"
                ? form.createdBy
                : undefined
          }
        >
          {c.render(form, range)}
        </td>
      ))}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button
            className="row-action-btn"
            aria-label="Edit"
            title="Edit form"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <RowEditIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
          >
            <RowKebabIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

function SortableHeader({
  col, label, className, sort, toggle, sortable = true, dateScoped = false,
}: {
  col: SortKey;
  label: string;
  className?: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
  /* Marks a column whose values are counted inside the Date Range filter — it
     renders the calendar glyph ahead of the label (Figma 79:445). */
  dateScoped?: boolean;
}) {
  const tip = dateScoped ? "Counted within the selected date range" : undefined;
  const mark = dateScoped ? (
    <span className="th-date-icon"><CalendarIcon /></span>
  ) : null;
  if (!sortable) {
    return (
      <th className={`${className ?? ""} no-sort`.trim()} data-tip={tip} title={tip}>
        <span className="th-content">{mark}{label}</span>
      </th>
    );
  }
  const active = sort.key === col;
  return (
    <th className={className} onClick={() => toggle(col)} data-tip={tip} title={tip}>
      <span className="th-content">
        {mark}
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}

/* ─────────────── Three-dot row actions menu (Figma 807:1204) ─────────────── */
/* Fixed-positioned so it escapes the table's scroll container. */

function FormActionsMenu({
  form,
  rect,
  onClose,
  onEdit,
  onViewResponses,
  onDuplicate,
  onToggleActive,
  onDelete,
}: {
  form: FeedbackForm;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onViewResponses: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    /* Right-anchored to the trigger — the kebab is the action bar's last cell,
       so the open menu's right edge lines up with the bar's. Using `right`
       rather than (rect.right - measuredWidth) keeps that exact: the first-pass
       width measurement is unreliable, because the fallback `left` shrink-to-
       fits the menu against the viewport before it has been placed. */
    setPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() {
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item = (icon: JSX.Element, label: string, onPick: () => void) => (
    <button
      className="u-menu-item"
      onClick={(e) => {
        e.stopPropagation();
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      {label}
    </button>
  );

  // Responses are the permanent record of what users answered, so a form that
  // collected any can never be deleted — only deactivated.
  const canDelete = form.responseCount === 0;

  return (
    <div
      ref={ref}
      className="u-menu u-menu--hug"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {item(<RowEditIcon />, "Edit Questions & Triggers", onEdit)}
      {item(<CopyIcon />, "Duplicate Form", onDuplicate)}
      {item(<MenuResponsesIcon />, "View Responses", onViewResponses)}
      {item(
        <MenuArchiveReplaceIcon />,
        form.status === "active" ? "Deactivate Form" : "Activate Form",
        onToggleActive,
      )}
      <button
        className="u-menu-item u-menu-item--danger"
        disabled={!canDelete}
        onClick={(e) => {
          e.stopPropagation();
          if (!canDelete) return;
          onDelete();
          onClose();
        }}
      >
        <span className="u-menu-item-icon"><RowDeleteIcon /></span>
        {/* The reason sits INSIDE the button as a second line, so the row can
            top-align the glyph against the label (807:1258). */}
        <span className="u-menu-item-text">
          <span>Delete Form</span>
          {!canDelete && (
            <span className="u-menu-item-sub">
              Feedback Forms with responses cannot be deleted
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

export { seedForms };
