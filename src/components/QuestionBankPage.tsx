import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  categories as seedCategories,
  questions as allQuestions,
  shortQuestionType,
  type Category,
  type Question,
  type QuestionStatus,
  type ShortQuestionType,
  type Subcategory,
} from "../data/questionBank";
import {
  CheckIcon,
  ChevronDownIcon,
  SearchIcon,
  SmallXIcon,
  SortIcon,
  UploadIcon,
} from "./icons";

const PAGE_SIZE = 12;

const TYPE_OPTIONS: (ShortQuestionType | "All")[] = ["All", "MCQ", "T/F", "Match"];

const STATUS_OPTIONS: (QuestionStatus | "All")[] = [
  "All",
  "Active",
  "Archived",
  "Draft",
];

const USED_IN_OPTIONS = ["Any", "In a quiz", "Not in use"] as const;
type UsedInOption = (typeof USED_IN_OPTIONS)[number];

type QSortKey = "question" | "type" | "version" | "status" | "usage";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<QuestionStatus, number> = {
  Active: 0,
  Draft: 1,
  Archived: 2,
};

function compareQuestions(a: Question, b: Question, key: QSortKey): number {
  switch (key) {
    case "question":
      return a.text.localeCompare(b.text);
    case "type":
      return shortQuestionType(a.type).localeCompare(shortQuestionType(b.type));
    case "version":
      return a.version - b.version;
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case "usage":
      return a.quizzes.length - b.quizzes.length;
  }
}

type CategorySelection =
  | { kind: "all" }
  | { kind: "category"; categoryKey: string }
  | { kind: "subcategory"; categoryKey: string; subKey: string };

// 3-dot menu target — a category or a subcategory row.
type CatTarget =
  | { kind: "category"; categoryKey: string }
  | { kind: "subcategory"; categoryKey: string; subKey: string };

type CatMenuState = { target: CatTarget; x: number; y: number } | null;

type CatModalState =
  | { kind: "none" }
  | { kind: "new-category" }
  | { kind: "new-sub"; categoryKey: string }
  | { kind: "edit-category"; categoryKey: string }
  | { kind: "edit-sub"; categoryKey: string; subKey: string }
  | { kind: "delete"; target: CatTarget };

const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

const ArchiveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h18v3H3zM5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9M10 14h4" />
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

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5" />
    <path d="M3.05 13a9 9 0 1 0 2.6-6.36L3 8" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);

export function QuestionBankPage({
  onNewQuestion,
  onEditQuestion,
}: {
  onNewQuestion?: (categoryPath?: string[]) => void;
  onEditQuestion?: (question: Question) => void;
} = {}) {
  const [categories, setCategories] = useState<Category[]>(seedCategories);
  const [questions, setQuestions] = useState<Question[]>(allQuestions);
  const [rowMenu, setRowMenu] = useState<{ q: Question; rect: DOMRect } | null>(null);
  const [selection, setSelection] = useState<CategorySelection>({
    kind: "subcategory",
    categoryKey: "epa-608",
    subKey: "universal",
  });
  const [categorySearch, setCategorySearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "epa-608": true,
  });
  const [catMenu, setCatMenu] = useState<CatMenuState>(null);
  const [catModal, setCatModal] = useState<CatModalState>({ kind: "none" });

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ShortQuestionType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | "All">("Active");
  const [usedInFilter, setUsedInFilter] = useState<UsedInOption>("Any");

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: QSortKey; dir: SortDir }>({
    key: "question",
    dir: "asc",
  });

  // Filter by category selection
  const inCategory = useMemo(() => {
    return questions.filter((q) => {
      if (selection.kind === "all") return true;
      const catLabel = categories.find((c) => c.key === selection.categoryKey)?.label;
      if (!catLabel) return false;
      if (selection.kind === "category") {
        return q.categoryPath[0] === catLabel;
      }
      const sub = categories
        .find((c) => c.key === selection.categoryKey)
        ?.subcategories?.find((s) => s.key === selection.subKey);
      if (!sub) return false;
      return q.categoryPath[0] === catLabel && q.categoryPath[1] === sub.label;
    });
  }, [selection, categories, questions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inCategory.filter((row) => {
      if (q && !(row.id.toLowerCase().includes(q) || row.text.toLowerCase().includes(q))) {
        return false;
      }
      if (typeFilter !== "All" && shortQuestionType(row.type) !== typeFilter) return false;
      if (statusFilter !== "All" && row.status !== statusFilter) return false;
      if (usedInFilter === "In a quiz" && row.quizzes.length === 0) return false;
      if (usedInFilter === "Not in use" && row.quizzes.length > 0) return false;
      return true;
    });
  }, [inCategory, query, typeFilter, statusFilter, usedInFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareQuestions(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [selection, query, typeFilter, statusFilter, usedInFilter, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: QSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function showVersionHistory(q: Question) {
    const lines: string[] = [];
    for (let v = q.version; v >= 1; v--) {
      lines.push(`v${v}${v === q.version ? "  — current" : ""}`);
    }
    window.alert(`Version history — ${q.id}\n\n${lines.join("\n")}`);
  }

  // Toggle a question between Active and Archived from the row menu.
  function toggleArchive(id: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, status: q.status === "Archived" ? "Active" : "Archived" }
          : q,
      ),
    );
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ─── Category mutations ───────────────────────────────────────────────────
  function addCategory(label: string) {
    // New categories append to the bottom of the list.
    setCategories((prev) => [
      ...prev,
      { key: `cat-${Date.now()}`, label, count: 0, subcategories: [] },
    ]);
  }

  function addSubcategory(categoryKey: string, label: string) {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.key !== categoryKey) return c;
        const newSub: Subcategory = {
          key: `sub-${Date.now()}`,
          label,
          count: 0,
        };
        return { ...c, subcategories: [...(c.subcategories ?? []), newSub] };
      }),
    );
    // Keep the parent expanded so the new subcategory is visible.
    setOpenGroups((prev) => ({ ...prev, [categoryKey]: true }));
  }

  function renameCategory(key: string, label: string) {
    setCategories((prev) =>
      prev.map((c) => (c.key === key ? { ...c, label } : c)),
    );
  }

  function renameSubcategory(categoryKey: string, subKey: string, label: string) {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.key !== categoryKey) return c;
        return {
          ...c,
          subcategories: c.subcategories?.map((s) =>
            s.key === subKey ? { ...s, label } : s,
          ),
        };
      }),
    );
  }

  function deleteCategory(key: string) {
    setCategories((prev) => prev.filter((c) => c.key !== key));
    if (selection.kind !== "all" && selection.categoryKey === key) {
      setSelection({ kind: "all" });
    }
  }

  function deleteSubcategory(categoryKey: string, subKey: string) {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.key !== categoryKey) return c;
        return {
          ...c,
          subcategories: c.subcategories?.filter((s) => s.key !== subKey),
        };
      }),
    );
    if (selection.kind === "subcategory" && selection.subKey === subKey) {
      setSelection({ kind: "category", categoryKey });
    }
  }

  // A category can be deleted only when it has no questions and no subcategories.
  function categoryIsEmpty(c: Category) {
    return c.count === 0 && !(c.subcategories && c.subcategories.length > 0);
  }

  function openCatMenu(e: React.MouseEvent, target: CatTarget) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCatMenu({ target, x: r.right, y: r.bottom });
  }

  // Title + counts derived from selection
  const selectionInfo = useMemo(() => {
    if (selection.kind === "all") {
      return { breadcrumb: "All Questions", count: allQuestions.length };
    }
    const cat = categories.find((c) => c.key === selection.categoryKey);
    if (!cat) return { breadcrumb: "—", count: 0 };
    if (selection.kind === "category") {
      return { breadcrumb: cat.label, count: cat.count };
    }
    const sub = cat.subcategories?.find((s) => s.key === selection.subKey);
    return {
      breadcrumb: `${cat.label} / ${sub?.label ?? "—"}`,
      count: sub?.count ?? 0,
    };
  }, [selection, categories]);

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

            <div className="qb-cats-section-label">ALL CATEGORIES</div>

            <div className="qb-cat-list">
              <button
                className={`qb-cat-row qb-cat-row--top ${selection.kind === "all" ? "is-active" : ""}`}
                onClick={() => setSelection({ kind: "all" })}
              >
                <span className="qb-cat-row-label">All Questions</span>
                <span className="qb-cat-row-count">1,089</span>
              </button>

              {categories
                .filter((c) =>
                  categorySearch.trim()
                    ? c.label.toLowerCase().includes(categorySearch.trim().toLowerCase())
                    : true,
                )
                .map((cat) => {
                  const isOpen = !!openGroups[cat.key];
                  const isActiveCat =
                    selection.kind === "category" && selection.categoryKey === cat.key;
                  const hasActiveSub =
                    selection.kind === "subcategory" && selection.categoryKey === cat.key;
                  return (
                    <div key={cat.key} className="qb-cat-group">
                      <div className={`qb-cat-row ${isActiveCat ? "is-active" : ""}`}>
                        {/* Every category is expandable so subcategories can be added inside it. */}
                        <button
                          className="qb-cat-caret-btn"
                          onClick={() => toggleGroup(cat.key)}
                          aria-label={isOpen ? "Collapse" : "Expand"}
                        >
                          <span className={`qb-cat-caret ${isOpen ? "is-open" : ""}`}>
                            <CaretRightIcon />
                          </span>
                        </button>
                        <button
                          className="qb-cat-main"
                          onClick={() => setSelection({ kind: "category", categoryKey: cat.key })}
                        >
                          <span className="qb-cat-row-label">{cat.label}</span>
                          <span className="qb-cat-row-count">{cat.count}</span>
                        </button>
                        <button
                          className="qb-cat-menu-btn"
                          aria-label="Category options"
                          onClick={(e) => openCatMenu(e, { kind: "category", categoryKey: cat.key })}
                        >
                          <MoreIcon />
                        </button>
                      </div>

                      {isOpen && (
                        <div className="qb-sublist">
                          {cat.subcategories?.map((sub) => {
                            const isActive =
                              hasActiveSub &&
                              selection.kind === "subcategory" &&
                              selection.subKey === sub.key;
                            return (
                              <div
                                key={sub.key}
                                className={`qb-sub-row ${isActive ? "is-active" : ""}`}
                              >
                                <button
                                  className="qb-sub-main"
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
                                <button
                                  className="qb-cat-menu-btn"
                                  aria-label="Subcategory options"
                                  onClick={(e) =>
                                    openCatMenu(e, {
                                      kind: "subcategory",
                                      categoryKey: cat.key,
                                      subKey: sub.key,
                                    })
                                  }
                                >
                                  <MoreIcon />
                                </button>
                              </div>
                            );
                          })}
                          <button
                            className="qb-sub-add"
                            onClick={() => setCatModal({ kind: "new-sub", categoryKey: cat.key })}
                          >
                            + Add Subcategory
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Add Category sits at the bottom of the category list. */}
              <button
                className="qb-cat-add qb-cat-add--bottom"
                onClick={() => setCatModal({ kind: "new-category" })}
              >
                + Add Category
              </button>
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
                  onChange={(v) => setTypeFilter(v as ShortQuestionType | "All")}
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
              <button
                className="qb-add-question"
                onClick={() => {
                  let path: string[] | undefined;
                  if (selection.kind !== "all") {
                    const cat = categories.find((c) => c.key === selection.categoryKey);
                    if (cat) {
                      path = [cat.label];
                      if (selection.kind === "subcategory") {
                        const sub = cat.subcategories?.find((s) => s.key === selection.subKey);
                        if (sub) path.push(sub.label);
                      }
                    }
                  }
                  onNewQuestion?.(path);
                }}
              >
                + Add Question
              </button>
            </div>

            <div className="table-xscroll" style={{ "--table-min": "886px" } as React.CSSProperties}>
            <table className="table table-head qb-q-table">
              <QbColGroup />
              <thead>
                <tr>
                  <QbHeader col="question" label="Question" sort={sort} toggle={toggleSort} />
                  <QbHeader col="type" label="Type" sort={sort} toggle={toggleSort} />
                  <QbHeader col="version" label="Version" sort={sort} toggle={toggleSort} />
                  <QbHeader col="status" label="Status" sort={sort} toggle={toggleSort} />
                  <QbHeader col="usage" label="Quiz usage" sort={sort} toggle={toggleSort} />
                  <th className="col-actions" />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body qb-q-table">
                <QbColGroup />
                <tbody>
                  {paged.map((q) => (
                    <QuestionRow
                      key={q.id}
                      q={q}
                      onEdit={() => onEditQuestion?.(q)}
                      onOpenMenu={(rect) => setRowMenu({ q, rect })}
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
            </div>

            <div className="pagination qb-pagination">
              <span>
                Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
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

      {/* ─── Question row actions menu (Tasks-style) ─── */}
      {rowMenu && (
        <QuestionActionsMenu
          q={rowMenu.q}
          rect={rowMenu.rect}
          onClose={() => setRowMenu(null)}
          onEdit={() => onEditQuestion?.(rowMenu.q)}
          onArchive={() => toggleArchive(rowMenu.q.id)}
          onPreview={() =>
            window.alert(
              `Preview — ${rowMenu.q.id} (${shortQuestionType(rowMenu.q.type)})\n\n${rowMenu.q.text}`,
            )
          }
          onVersionHistory={() => showVersionHistory(rowMenu.q)}
        />
      )}

      {/* ─── Category 3-dot menu ─── */}
      {catMenu && (() => {
        const target = catMenu.target;
        const cat = categories.find((c) => c.key === target.categoryKey);
        if (!cat) return null;
        const canDelete =
          target.kind === "category"
            ? categoryIsEmpty(cat)
            : (cat.subcategories?.find((s) => s.key === target.subKey)?.count ?? 0) === 0;
        return (
          <>
            <div className="ind-menu-backdrop" onClick={() => setCatMenu(null)} />
            <div
              className="ind-row-menu"
              style={{ top: catMenu.y + 4, left: catMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="ind-row-menu-item"
                onClick={() => {
                  setCatModal(
                    target.kind === "category"
                      ? { kind: "edit-category", categoryKey: target.categoryKey }
                      : {
                          kind: "edit-sub",
                          categoryKey: target.categoryKey,
                          subKey: target.subKey,
                        },
                  );
                  setCatMenu(null);
                }}
              >
                <PencilIcon /> Edit
              </button>
              <button
                className="ind-row-menu-item ind-row-menu-item--danger"
                disabled={!canDelete}
                title={canDelete ? undefined : "Only empty categories can be deleted"}
                onClick={() => {
                  if (!canDelete) return;
                  setCatModal({ kind: "delete", target });
                  setCatMenu(null);
                }}
              >
                <TrashIcon /> Delete
              </button>
            </div>
          </>
        );
      })()}

      {/* ─── Category add / edit / delete modals ─── */}
      {catModal.kind === "new-category" && (
        <CatNameModal
          title="New Category"
          submitLabel="Create Category"
          defaultValue=""
          existingNames={categories.map((c) => c.label.toLowerCase())}
          onSubmit={(label) => {
            addCategory(label);
            setCatModal({ kind: "none" });
          }}
          onCancel={() => setCatModal({ kind: "none" })}
        />
      )}

      {catModal.kind === "new-sub" && (() => {
        const parent = categories.find((c) => c.key === catModal.categoryKey);
        if (!parent) return null;
        return (
          <CatNameModal
            title={`New Subcategory in ${parent.label}`}
            submitLabel="Create Subcategory"
            defaultValue=""
            existingNames={(parent.subcategories ?? []).map((s) => s.label.toLowerCase())}
            onSubmit={(label) => {
              addSubcategory(catModal.categoryKey, label);
              setCatModal({ kind: "none" });
            }}
            onCancel={() => setCatModal({ kind: "none" })}
          />
        );
      })()}

      {catModal.kind === "edit-category" && (() => {
        const cat = categories.find((c) => c.key === catModal.categoryKey);
        if (!cat) return null;
        return (
          <CatNameModal
            title="Rename Category"
            submitLabel="Save"
            defaultValue={cat.label}
            existingNames={categories
              .filter((c) => c.key !== catModal.categoryKey)
              .map((c) => c.label.toLowerCase())}
            onSubmit={(label) => {
              renameCategory(catModal.categoryKey, label);
              setCatModal({ kind: "none" });
            }}
            onCancel={() => setCatModal({ kind: "none" })}
          />
        );
      })()}

      {catModal.kind === "edit-sub" && (() => {
        const parent = categories.find((c) => c.key === catModal.categoryKey);
        const sub = parent?.subcategories?.find((s) => s.key === catModal.subKey);
        if (!parent || !sub) return null;
        return (
          <CatNameModal
            title={`Rename Subcategory in ${parent.label}`}
            submitLabel="Save"
            defaultValue={sub.label}
            existingNames={(parent.subcategories ?? [])
              .filter((s) => s.key !== catModal.subKey)
              .map((s) => s.label.toLowerCase())}
            onSubmit={(label) => {
              renameSubcategory(catModal.categoryKey, catModal.subKey, label);
              setCatModal({ kind: "none" });
            }}
            onCancel={() => setCatModal({ kind: "none" })}
          />
        );
      })()}

      {catModal.kind === "delete" && (() => {
        const target = catModal.target;
        const cat = categories.find((c) => c.key === target.categoryKey);
        if (!cat) return null;
        const label =
          target.kind === "category"
            ? cat.label
            : `${cat.label} / ${cat.subcategories?.find((s) => s.key === target.subKey)?.label ?? "—"}`;
        return (
          <CatDeleteConfirm
            label={label}
            isCategory={target.kind === "category"}
            onConfirm={() => {
              if (target.kind === "category") {
                deleteCategory(target.categoryKey);
              } else {
                deleteSubcategory(target.categoryKey, target.subKey);
              }
              setCatModal({ kind: "none" });
            }}
            onCancel={() => setCatModal({ kind: "none" })}
          />
        );
      })()}
    </div>
  );
}

function CatNameModal({
  title,
  submitLabel,
  defaultValue,
  existingNames,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  defaultValue: string;
  existingNames: string[];
  onSubmit: (label: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const trimmed = value.trim();
  const isDuplicate = !!trimmed && existingNames.includes(trimmed.toLowerCase());
  const isValid = !!trimmed && !isDuplicate;

  return (
    <div className="ind-modal-overlay" onClick={onCancel}>
      <div className="ind-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ind-modal-head">
          <h3 className="ind-modal-title">{title}</h3>
          <button className="ind-modal-close" aria-label="Close" onClick={onCancel}>
            <SmallXIcon />
          </button>
        </div>
        <div className="ind-modal-body">
          <label className="ind-field">
            <span className="ind-field-label">
              Name <span className="ind-field-required">*</span>
            </span>
            <input
              autoFocus
              className="ind-field-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValid) onSubmit(trimmed);
              }}
              placeholder="e.g. EPA 608"
            />
            <span className="ind-field-help">
              {isDuplicate ? (
                <span className="ind-field-error">A category with this name already exists.</span>
              ) : (
                "Must be unique."
              )}
            </span>
          </label>
        </div>
        <div className="ind-modal-foot">
          <button className="ind-btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="ind-btn-primary"
            disabled={!isValid}
            onClick={() => isValid && onSubmit(trimmed)}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function CatDeleteConfirm({
  label,
  isCategory,
  onConfirm,
  onCancel,
}: {
  label: string;
  isCategory: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="ind-modal-overlay" onClick={onCancel}>
      <div className="ind-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ind-modal-head">
          <h3 className="ind-modal-title">
            Delete {isCategory ? "Category" : "Subcategory"}?
          </h3>
          <button className="ind-modal-close" aria-label="Close" onClick={onCancel}>
            <SmallXIcon />
          </button>
        </div>
        <div className="ind-modal-body">
          <p className="ind-modal-text">
            Delete <strong>{label}</strong>? This can't be undone.
          </p>
          <ul className="ind-modal-list">
            <li>
              This {isCategory ? "category" : "subcategory"} is empty — no questions
              {isCategory ? " or subcategories" : ""} will be affected.
            </li>
          </ul>
        </div>
        <div className="ind-modal-foot">
          <button className="ind-btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="ind-btn-danger" onClick={onConfirm}>
            Delete {isCategory ? "Category" : "Subcategory"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QbColGroup() {
  return (
    <colgroup>
      <col />
      <col style={{ width: 96 }} />
      <col style={{ width: 92 }} />
      <col style={{ width: 120 }} />
      <col style={{ width: 230 }} />
      <col style={{ width: 48 }} />
    </colgroup>
  );
}

function QbHeader({
  col,
  label,
  sort,
  toggle,
}: {
  col: QSortKey;
  label: string;
  sort: { key: QSortKey; dir: SortDir };
  toggle: (k: QSortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className={`qb-col-${col}`} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}

function QuestionRow({
  q,
  onEdit,
  onOpenMenu,
}: {
  q: Question;
  onEdit: () => void;
  onOpenMenu: (rect: DOMRect) => void;
}) {
  const isArchived = q.status === "Archived";
  return (
    <tr className={`qb-row ${isArchived ? "is-archived" : ""}`}>
      <td className="qb-col-question">
        <div className="qb-q-text">{q.text}</div>
      </td>
      <td className="qb-col-type">
        <span className="qb-type-tag">{shortQuestionType(q.type)}</span>
      </td>
      <td className="qb-col-version">v{q.version}</td>
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
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(e.currentTarget.getBoundingClientRect());
          }}
        >
          <MoreIcon />
        </button>
        <div className="row-action-bar">
          <button
            className="row-action-btn"
            aria-label="Edit"
            title="Edit question"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <PencilIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More actions"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMenu(e.currentTarget.getBoundingClientRect());
            }}
          >
            <MoreIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* Tasks-style fixed-position row actions menu for a question. */
function QuestionActionsMenu({
  q,
  rect,
  onClose,
  onEdit,
  onArchive,
  onPreview,
  onVersionHistory,
}: {
  q: Question;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onPreview: () => void;
  onVersionHistory: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    let left = rect.right - w;
    if (left < 8) left = 8;
    setPos({ top, left });
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

  const item = (
    icon: JSX.Element,
    label: string,
    onPick: () => void,
    opts?: { disabled?: boolean; title?: string },
  ) => (
    <button
      className="u-menu-item"
      disabled={opts?.disabled}
      title={opts?.title}
      onClick={(e) => {
        e.stopPropagation();
        if (opts?.disabled) return;
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      {label}
    </button>
  );

  const isArchived = q.status === "Archived";
  // A question that's used in a Quiz can't be archived (but can still be unarchived).
  const inUse = q.quizzes.length > 0;
  const blockArchive = !isArchived && inUse;

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        left: pos ? pos.left : rect.right - 210,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{q.id}</div>
        <div className="u-menu-head-id">{shortQuestionType(q.type)} · v{q.version}</div>
      </div>
      <div className="u-menu-divider" />
      {item(<PencilIcon />, "Edit", onEdit)}
      {item(<EyeIcon />, "Preview", onPreview)}
      {item(<HistoryIcon />, "Version history", onVersionHistory)}
      <div className="u-menu-divider" />
      {item(
        <ArchiveIcon />,
        isArchived ? "Unarchive" : "Archive",
        onArchive,
        blockArchive
          ? { disabled: true, title: "In use in a quiz — remove it from all quizzes before archiving" }
          : undefined,
      )}
      {blockArchive && (
        <div className="u-menu-note">Used in {q.quizzes.length} quiz{q.quizzes.length === 1 ? "" : "zes"} — can't archive</div>
      )}
    </div>
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
