import { useEffect, useMemo, useRef, useState } from "react";
import {
  categories as allCategories,
  questions as allQuestions,
  type Question,
  type QuestionStatus,
  type QuestionType,
} from "../data/questionBank";
import {
  CheckIcon,
  ChevronDownIcon,
  SearchIcon,
  SmallXIcon,
  UploadIcon,
} from "./icons";

const PAGE_SIZE = 12;

const TYPE_OPTIONS: (QuestionType | "All")[] = [
  "All",
  "Multiple choice",
  "Multiple select",
  "True/False",
  "Fill-in",
];

const STATUS_OPTIONS: (QuestionStatus | "All")[] = [
  "All",
  "Active",
  "Archived",
  "Draft",
];

const USED_IN_OPTIONS = ["Any", "In a quiz", "Not in use"] as const;
type UsedInOption = (typeof USED_IN_OPTIONS)[number];

type CategorySelection =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; categoryKey: string }
  | { kind: "subcategory"; categoryKey: string; subKey: string };

const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

const MoveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3" />
    <path d="M2 12h20M12 2v20" />
  </svg>
);

const ArchiveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h18v3H3zM5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9M10 14h4" />
  </svg>
);

const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v12M7 9l5-5 5 5" />
    <path d="M5 20h14" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M6 6l1 14a1 1 0 001 1h8a1 1 0 001-1l1-14M10 11v6M14 11v6" />
  </svg>
);

const CaretRightIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

function SubtleCheckbox({
  checked,
  indeterminate = false,
  onClick,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onClick: (e: React.MouseEvent) => void;
  label?: string;
}) {
  return (
    <span
      className={`row-checkbox ${checked || indeterminate ? "checked" : ""}`}
      onClick={onClick}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
    >
      {checked && !indeterminate && <CheckIcon />}
      {indeterminate && <span className="row-checkbox-indeterminate" />}
    </span>
  );
}

export function QuestionBankPage() {
  const [selection, setSelection] = useState<CategorySelection>({
    kind: "subcategory",
    categoryKey: "epa-608",
    subKey: "universal",
  });
  const [categorySearch, setCategorySearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "epa-608": true,
  });

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<QuestionType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | "All">("Active");
  const [usedInFilter, setUsedInFilter] = useState<UsedInOption>("Any");

  const [page, setPage] = useState(1);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    new Set(["Q-10421", "Q-10423", "Q-10427"]),
  );

  // Filter by category selection
  const inCategory = useMemo(() => {
    return allQuestions.filter((q) => {
      if (selection.kind === "all") return true;
      if (selection.kind === "uncategorized") return q.categoryPath.length === 0;
      const catLabel = allCategories.find((c) => c.key === selection.categoryKey)?.label;
      if (!catLabel) return false;
      if (selection.kind === "category") {
        return q.categoryPath[0] === catLabel;
      }
      const sub = allCategories
        .find((c) => c.key === selection.categoryKey)
        ?.subcategories?.find((s) => s.key === selection.subKey);
      if (!sub) return false;
      return q.categoryPath[0] === catLabel && q.categoryPath[1] === sub.label;
    });
  }, [selection]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inCategory.filter((row) => {
      if (q && !(row.id.toLowerCase().includes(q) || row.text.toLowerCase().includes(q))) {
        return false;
      }
      if (typeFilter !== "All" && row.type !== typeFilter) return false;
      if (statusFilter !== "All" && row.status !== statusFilter) return false;
      if (usedInFilter === "In a quiz" && row.quizzes.length === 0) return false;
      if (usedInFilter === "Not in use" && row.quizzes.length > 0) return false;
      return true;
    });
  }, [inCategory, query, typeFilter, statusFilter, usedInFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [selection, query, typeFilter, statusFilter, usedInFilter]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  const selectedCount = checkedIds.size;
  const pagedChecked = paged.filter((q) => checkedIds.has(q.id)).length;
  const allOnPageChecked = paged.length > 0 && pagedChecked === paged.length;
  const someOnPageChecked = pagedChecked > 0 && !allOnPageChecked;

  function toggleAllOnPage() {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageChecked) {
        paged.forEach((q) => next.delete(q.id));
      } else {
        paged.forEach((q) => next.add(q.id));
      }
      return next;
    });
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setCheckedIds(new Set());
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Title + counts derived from selection
  const selectionInfo = useMemo(() => {
    if (selection.kind === "all") {
      return { breadcrumb: "All Questions", count: allQuestions.length };
    }
    if (selection.kind === "uncategorized") {
      return { breadcrumb: "Uncategorized", count: 12 };
    }
    const cat = allCategories.find((c) => c.key === selection.categoryKey);
    if (!cat) return { breadcrumb: "—", count: 0 };
    if (selection.kind === "category") {
      return { breadcrumb: cat.label, count: cat.count };
    }
    const sub = cat.subcategories?.find((s) => s.key === selection.subKey);
    return {
      breadcrumb: `${cat.label} / ${sub?.label ?? "—"}`,
      count: sub?.count ?? 0,
    };
  }, [selection]);

  // CSV dropzone — purely visual + accept handler
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dropzoneActive, setDropzoneActive] = useState(false);

  return (
    <div className="main">
      <div className="workspace">
        <div className="qb-page">
          {/* Left rail — categories */}
          <aside className="qb-cats">
            <div className="qb-cats-head">
              <h1 className="qb-cats-title">Question Bank</h1>
              <div className="qb-cats-sub">
                {selectionInfo.breadcrumb} · {selectionInfo.count.toLocaleString()} Questions
              </div>
            </div>

            <div className="qb-cat-search">
              <span className="qb-cat-search-icon"><SearchIcon /></span>
              <input
                className="qb-cat-search-input"
                placeholder="Search 200 categories"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            </div>

            <button className="qb-cat-add">+ Add Category</button>

            <div className="qb-cats-section-label">ALL CATEGORIES</div>

            <div className="qb-cat-list">
              <button
                className={`qb-cat-row qb-cat-row--top ${selection.kind === "all" ? "is-active" : ""}`}
                onClick={() => setSelection({ kind: "all" })}
              >
                <span className="qb-cat-row-label">All Questions</span>
                <span className="qb-cat-row-count">1,089</span>
              </button>
              <button
                className={`qb-cat-row qb-cat-row--top ${selection.kind === "uncategorized" ? "is-active" : ""}`}
                onClick={() => setSelection({ kind: "uncategorized" })}
              >
                <span className="qb-cat-row-label">Uncategorized</span>
                <span className="qb-cat-row-count">12</span>
              </button>

              {allCategories
                .filter((c) =>
                  categorySearch.trim()
                    ? c.label.toLowerCase().includes(categorySearch.trim().toLowerCase())
                    : true,
                )
                .map((cat) => {
                  const hasSubs = !!cat.subcategories?.length;
                  const isOpen = !!openGroups[cat.key];
                  const isActiveCat =
                    selection.kind === "category" && selection.categoryKey === cat.key;
                  const hasActiveSub =
                    selection.kind === "subcategory" && selection.categoryKey === cat.key;
                  return (
                    <div key={cat.key} className="qb-cat-group">
                      <button
                        className={`qb-cat-row ${isActiveCat ? "is-active" : ""}`}
                        onClick={() => {
                          if (hasSubs) {
                            toggleGroup(cat.key);
                          } else {
                            setSelection({ kind: "category", categoryKey: cat.key });
                          }
                        }}
                      >
                        <span className={`qb-cat-caret ${isOpen ? "is-open" : ""} ${hasSubs ? "" : "is-hidden"}`}>
                          <CaretRightIcon />
                        </span>
                        <span className="qb-cat-row-label">{cat.label}</span>
                        <span className="qb-cat-row-count">{cat.count}</span>
                      </button>

                      {hasSubs && isOpen && (
                        <div className="qb-sublist">
                          {cat.subcategories!.map((sub) => {
                            const isActive =
                              hasActiveSub &&
                              selection.kind === "subcategory" &&
                              selection.subKey === sub.key;
                            return (
                              <button
                                key={sub.key}
                                className={`qb-sub-row ${isActive ? "is-active" : ""}`}
                                onClick={() =>
                                  setSelection({
                                    kind: "subcategory",
                                    categoryKey: cat.key,
                                    subKey: sub.key,
                                  })
                                }
                              >
                                <span className="qb-sub-row-label">{sub.label}</span>
                                <span className="qb-sub-row-count">{sub.count}</span>
                              </button>
                            );
                          })}
                          <button className="qb-sub-add">+ Add Subcategory</button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </aside>

          {/* Right pane */}
          <section className="qb-content">
            <div className="qb-search-wrap">
              <span className="search-icon"><SearchIcon /></span>
              <input
                className="qb-search-input"
                placeholder="Search questions by text or ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="search-kbd">
                <span className="kbd-cmd">⌘</span>
                <span className="kbd-letter">K</span>
              </span>
            </div>

            <label
              className={`qb-dropzone ${dropzoneActive ? "is-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropzoneActive(true);
              }}
              onDragLeave={() => setDropzoneActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDropzoneActive(false);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                hidden
                onChange={() => {/* noop in mock */}}
              />
              <div className="qb-dropzone-icon"><UploadIcon /></div>
              <div className="qb-dropzone-text">
                <div className="qb-dropzone-title">Drop CSV file to bulk upload questions</div>
                <div className="qb-dropzone-sub">
                  Categories and subcategories are created automatically from the file.{" "}
                  <a className="qb-dropzone-link" onClick={(e) => e.preventDefault()} href="#">
                    Download template
                  </a>
                </div>
              </div>
              <button
                className="qb-dropzone-btn"
                onClick={(e) => {
                  e.preventDefault();
                  fileRef.current?.click();
                }}
              >
                Browse files
              </button>
            </label>

            <div className="qb-filters-row">
              <div className="qb-filters">
                <SelectPill
                  label="Type"
                  value={typeFilter}
                  options={TYPE_OPTIONS}
                  onChange={(v) => setTypeFilter(v as QuestionType | "All")}
                />
                <SelectPill
                  label="Status"
                  value={statusFilter}
                  options={STATUS_OPTIONS}
                  onChange={(v) => setStatusFilter(v as QuestionStatus | "All")}
                />
                <SelectPill
                  label="Used in"
                  value={usedInFilter}
                  options={[...USED_IN_OPTIONS]}
                  onChange={(v) => setUsedInFilter(v as UsedInOption)}
                />
                <button className="qb-more-filters">+ More filters</button>
              </div>
              <button className="qb-add-question">+ Add Question</button>
            </div>

            {selectedCount > 0 && (
              <div className="qb-bulk-bar">
                <span className="qb-bulk-count">{selectedCount} selected</span>
                <button className="qb-bulk-action">
                  <MoveIcon /> Move to category
                </button>
                <button className="qb-bulk-action">
                  <ArchiveIcon /> Archive
                </button>
                <button className="qb-bulk-action">
                  <ExportIcon /> Export
                </button>
                <button className="qb-bulk-action qb-bulk-action--danger">
                  <TrashIcon /> Delete
                </button>
                <button className="qb-bulk-clear" onClick={clearSelection}>
                  Clear selection
                </button>
              </div>
            )}

            <div className="qb-table-wrap">
              <table className="qb-table">
                <colgroup>
                  <col style={{ width: 44 }} />
                  <col style={{ width: 180 }} />
                  <col />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 260 }} />
                  <col style={{ width: 48 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      className="qb-col-check"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllOnPage();
                      }}
                    >
                      <SubtleCheckbox
                        checked={allOnPageChecked}
                        indeterminate={someOnPageChecked}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllOnPage();
                        }}
                        label="Select all on page"
                      />
                    </th>
                    <th>
                      <span className="qb-th">TYPE <span className="qb-th-caret">▾</span></span>
                    </th>
                    <th>
                      <span className="qb-th">QUESTION <span className="qb-th-caret">▾</span></span>
                    </th>
                    <th><span className="qb-th">STATUS</span></th>
                    <th><span className="qb-th">QUIZ USAGE</span></th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((q) => (
                    <QuestionRow
                      key={q.id}
                      q={q}
                      checked={checkedIds.has(q.id)}
                      onToggle={() => toggleChecked(q.id)}
                    />
                  ))}
                  {paged.length === 0 && (
                    <tr className="qb-empty-row">
                      <td colSpan={6}>
                        <div className="qb-empty">No questions match the current filters.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination qb-pagination">
              <span>
                Showing {filtered.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="pagination-controls">
                <button
                  className="page-btn"
                  disabled={visiblePage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹ Prev
                </button>
                <button
                  className="page-btn"
                  disabled={visiblePage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next ›
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function QuestionRow({
  q,
  checked,
  onToggle,
}: {
  q: Question;
  checked: boolean;
  onToggle: () => void;
}) {
  const isArchived = q.status === "Archived";
  return (
    <tr className={`qb-row ${checked ? "is-checked" : ""} ${isArchived ? "is-archived" : ""}`}>
      <td
        className="qb-col-check"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <SubtleCheckbox checked={checked} onClick={(e) => { e.stopPropagation(); onToggle(); }} label={`Select ${q.id}`} />
      </td>
      <td className="qb-col-type">{q.type}</td>
      <td className="qb-col-text">{q.text}</td>
      <td className="qb-col-status">
        <span className={`qb-status qb-status--${q.status.toLowerCase()}`}>
          <span className="qb-status-dot" />
          {q.status}
        </span>
      </td>
      <td className="qb-col-usage">
        {q.quizzes.length === 0 ? (
          <span className="qb-usage-empty">Not in use</span>
        ) : (
          <>
            <span className="qb-usage-main">
              {q.quizzes.slice(0, 2).join(", ")}
            </span>
            {q.quizzes.length > 2 && (
              <span className="qb-usage-extra"> +{q.quizzes.length - 2}</span>
            )}
          </>
        )}
      </td>
      <td className="qb-col-actions">
        <button
          className="qb-row-more"
          aria-label="More actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreIcon />
        </button>
      </td>
    </tr>
  );
}

function SelectPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="qb-select-pill" ref={ref}>
      <button
        className={`qb-select-pill-btn ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="qb-select-pill-label">{label}:</span>
        <span className="qb-select-pill-value">{value}</span>
        <span className="qb-select-pill-caret">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div className="qb-select-menu">
          {options.map((opt) => (
            <button
              key={opt}
              className={`qb-select-menu-item ${opt === value ? "is-active" : ""}`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
              {opt === value && (
                <span className="qb-select-menu-check"><CheckIcon /></span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Avoid unused-import error when SmallXIcon is not used yet
void SmallXIcon;
