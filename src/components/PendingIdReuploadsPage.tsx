import { useEffect, useMemo, useState } from "react";
import {
  pendingIdReuploads as seed,
  matchesQuery,
  type Submission,
} from "../data/proctoring";
import { SortIcon, ChevronLeftIcon, ChevronRightIcon, RowChevronIcon } from "./icons";
import { ProctoringSearch } from "./ProctoringSearch";
import { MultiPill } from "./UsersFilters";
import { FILTER_TIPS } from "../data/filterTips";

const PAGE_SIZE = 50;

/* Column widths. Email is left out of the colgroup (it's the flexible column)
   but still books its share of the width floor, so it can't be squeezed below
   what a full address needs. Both date columns hold the same long form —
   "November 11th, 2025, 9:05 AM" — so they share one width. */
const COL_WIDTHS = { name: 205, email: 296, phone: 160, quiz: 250, date: 242 };
/** The row-end chevron column, the same 40px reserve the Exam Reviews table uses. */
const ACTIONS_WIDTH = 40;
const TABLE_MIN =
  COL_WIDTHS.name +
  COL_WIDTHS.email +
  COL_WIDTHS.phone +
  COL_WIDTHS.quiz +
  COL_WIDTHS.date * 2 +
  ACTIONS_WIDTH;

type SortKey = "candidate" | "email" | "phone" | "exam" | "submittedAt" | "requestedAt";
type SortDir = "asc" | "desc";

/** submittedAt is a display string like "November 5th, 2025, 2:30 PM" — strip
 *  the ordinal suffix so Date.parse can read it. Same reader the Exam Reviews
 *  table uses, kept local so the two pages can't drift apart silently. */
function parseSubmittedAt(s: string): number {
  return Date.parse(s.replace(/(\d+)(st|nd|rd|th)/, "$1")) || 0;
}

function compare(a: Submission, b: Submission, key: SortKey): number {
  switch (key) {
    case "candidate":
      return a.candidateName.localeCompare(b.candidateName);
    case "email":
      return a.candidateEmail.localeCompare(b.candidateEmail);
    case "phone":
      return a.candidatePhone.localeCompare(b.candidatePhone);
    case "exam":
      return a.exam.localeCompare(b.exam);
    case "submittedAt":
      return parseSubmittedAt(a.submittedAt) - parseSubmittedAt(b.submittedAt);
    case "requestedAt":
      return (
        parseSubmittedAt(a.reuploadRequestedAt ?? "") -
        parseSubmittedAt(b.reuploadRequestedAt ?? "")
      );
  }
}

export function PendingIdReuploadsPage({
  onBack,
  onReview,
}: {
  onBack?: () => void;
  /** Opens the submission in the Exam Reviews console — the same console the
   *  review queue opens, so there is only one place an exam is reviewed. */
  onReview?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  // The search bar.s Quiz scope, applied the same way Exam Reviews applies it.
  const [examFilter, setExamFilter] = useState<string[]>([]);
  // Longest-waiting first, matching the review queue's own default ordering.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "submittedAt",
    dir: "asc",
  });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return seed.filter((s) => {
      if (examFilter.length > 0 && !examFilter.includes(s.exam)) return false;
      if (q && !matchesQuery(s, q)) return false;
      return true;
    });
  }, [query, examFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, sort, examFilter]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  /** Every quiz present in this queue — the Quiz pill's option list. */
  const examNames = useMemo(
    () => [...new Set(seed.map((s) => s.exam))].sort((a, b) => a.localeCompare(b)),
    [],
  );

  const hasFilters = examFilter.length > 0;

  function clearFilters() {
    setExamFilter([]);
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks sch-page">
          <header className="tasks-header">
            {/* Reached from the Exam Reviews header, the same way Name Changes
                used to be — so the crumb is the way back. */}
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Operations</span>
                <ChevronRightIcon />
                <button className="rvc-crumb" onClick={onBack} title="Back to Exam Reviews">
                  Exam Reviews
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Pending ID Re-Uploads</span>
              </nav>
              <h1 className="tasks-title">Pending ID Re-Uploads</h1>
              <div className="tasks-subtitle">
                <span>
                  No action needed here. These are users who were asked to re-upload their ID and
                  haven't sent one back yet. They will be added to the Review Queue as soon as an
                  ID is added
                </span>
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              {/* The Exam Reviews search bar, not a plain input: same ⌘K bar,
                  same Quiz scope, scoped to this page's rows. */}
              <div className="toolbar">
                <ProctoringSearch
                  submissions={seed}
                  exams={examFilter}
                  onExamsChange={setExamFilter}
                  query={query}
                  onCommit={setQuery}
                />
              </div>

              {/* Quiz gets a pill of its own, as on Exam Reviews. */}
              <div className="filters">
                <MultiPill
                  label="Quiz"
                  all={examNames}
                  value={examFilter}
                  onApply={setExamFilter}
                  searchable
                  searchPlaceholder="Search Quizzes..."
                  width={300}
                  tip={FILTER_TIPS.examReviews.reuploadQuiz}
                />
                {hasFilters && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Six columns don't fit a narrow page, so the table carries a
                  width floor and scrolls horizontally past it rather than
                  crushing the email column — the same `--table-min` machinery
                  the Exam Reviews table uses. */}
              <div
                className="table-xscroll"
                style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}
              >
              <div className="tasks-scroll">
                {/* Plain `.table`, not the `.sch-table` shell: the rows open the
                    review console now, so this wants the base table's pointer
                    cursor and 12px inset rather than the shell's `cursor:
                    default` and 16px. */}
                <table className="table">
                  <colgroup>
                    <col style={{ width: COL_WIDTHS.name }} />
                    {/* Email is the flexible column — it absorbs whatever slack a
                        wide viewport leaves, and never drops below the share of
                        TABLE_MIN reserved for it. */}
                    <col />
                    <col style={{ width: COL_WIDTHS.phone }} />
                    <col style={{ width: COL_WIDTHS.quiz }} />
                    <col style={{ width: COL_WIDTHS.date }} />
                    <col style={{ width: COL_WIDTHS.date }} />
                    <col style={{ width: ACTIONS_WIDTH }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader col="candidate" label="User's Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="email" label="Email" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="phone" label="Phone" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="exam" label="Quiz" sort={sort} toggle={toggleSort} />
                      {/* Two distinct dates: "Submitted On" is the candidate's
                          original attempt (the value the Exam Reviews table
                          shows), "Re-Upload Requested On" is when an admin asked
                          for a new ID — always the later of the two, and the
                          one this page's chase is measured from. */}
                      <SortableHeader col="submittedAt" label="Submitted On" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="requestedAt" label="Re-Upload Requested On" sort={sort} toggle={toggleSort} />
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((s) => (
                      <tr key={s.id} onClick={() => onReview?.(s.id)}>
                        <td className="col-name">{s.candidateName}</td>
                        {/* Click-to-copy (see CopyCells.tsx) — same pair as the
                            Exam Reviews table, for the same re-upload chase. */}
                        <td className="col-u-email" data-copyable>{s.candidateEmail}</td>
                        <td className="col-u-phone" data-copyable>{s.candidatePhone}</td>
                        <td>{s.exam}</td>
                        <td>{s.submittedAt}</td>
                        <td>{s.reuploadRequestedAt ?? "—"}</td>
                        {/* Same row-end affordance as the Exam Reviews table: a
                            resting chevron that hides on row hover, replaced in
                            place by the labelled bar. */}
                        <td className="col-actions">
                          <button
                            className="row-action-btn lone-dots row-chevron"
                            aria-label="Review Exam"
                            onClick={(e) => { e.stopPropagation(); onReview?.(s.id); }}
                          >
                            <RowChevronIcon />
                          </button>
                          <div className="row-action-bar">
                            <button
                              className="row-action-btn row-action-btn--label"
                              onClick={(e) => { e.stopPropagation(); onReview?.(s.id); }}
                            >
                              Review Exam
                              <RowChevronIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={7} className="sch-empty">
                          {query.trim()
                            ? `No users match "${query.trim()}".`
                            : "No ID re-uploads are outstanding."}
                        </td>
                      </tr>
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
  );
}

function SortableHeader({
  col,
  label,
  sort,
  toggle,
}: {
  col: SortKey;
  label: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
