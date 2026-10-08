import { useEffect, useMemo, useState } from "react";
import {
  useReviewedQuizNames,
  useSubmissions,
  isPendingIdReupload,
  matchesQuery,
  type Submission,
} from "../data/proctoring";
import { SortIcon, RowChevronIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { ProctoringSearch } from "./ProctoringSearch";
import { MultiPill } from "./UsersFilters";
import { FILTER_TIPS } from "../data/filterTips";
import {
  DateRangePill,
  allTimeDateRange,
  isAllTimeRange,
  dateRangeIncludes,
  type DateRangeState,
} from "./DateRangeFilter";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";
import { useToast } from "./useToast";

const PAGE_SIZE = 50;

/* Content-sized base widths: their sum is the width floor and the slack is
   shared in proportion (see the TableCols below). Both date columns hold the same long form —
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
function readableDate(s: string): string {
  return s.replace(/(\d+)(st|nd|rd|th)/, "$1");
}
function parseSubmittedAt(s: string): number {
  return Date.parse(readableDate(s)) || 0;
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

/** What this page was showing — handed out with a row so App can put it back
 *  when the console returns here. */
export type PendingIdListState = {
  query: string;
  examFilter: string[];
  sort: { key: SortKey; dir: SortDir };
  submittedRange: DateRangeState;
  requestedRange: DateRangeState;
};

export function PendingIdReuploadsPage({
  onBack,
  onReview,
  restore,
  flash,
  onFlashDone,
}: {
  onBack?: () => void;
  /** Opens the submission in the Exam Reviews console — the same console the
   *  review queue opens, so there is only one place an exam is reviewed.
   *  `queueIds` is this page's filtered, sorted list: the console's queue, so
   *  Skip and ←/→ walk it. `state` is what to restore on the way back. */
  onReview?: (id: string, queueIds: string[], state: PendingIdListState) => void;
  /** The filters, sort and page the console was opened from. */
  restore?: PendingIdListState | null;
  /** A decision made in the console on this page's queue ("ID Approved"). */
  flash?: string | null;
  onFlashDone?: () => void;
}) {
  const [, toastNode] = useToast(flash, onFlashDone);
  /* The live list Exam Reviews writes to: a re-upload requested in the console
     shows up here, and a row decided from here leaves. */
  const all = useSubmissions();
  const rows = useMemo(() => all.filter(isPendingIdReupload), [all]);
  const [query, setQuery] = useState(restore?.query ?? "");
  // The search bar's Quiz scope, applied the same way Exam Reviews applies it.
  const [examFilter, setExamFilter] = useState<string[]>(restore?.examFilter ?? []);
  // Oldest request first — the longest chase leads, the date this page is
  // measured from (user, 2026-10-02).
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(
    restore?.sort ?? { key: "requestedAt", dir: "asc" },
  );
  const [page, setPage] = useState(1);
  /* One range per date column, both the Exam Reviews pill: All Time is the
     unapplied, dashed state, so neither narrows anything until it's set. */
  const [submittedRange, setSubmittedRange] = useState<DateRangeState>(
    () => restore?.submittedRange ?? allTimeDateRange(),
  );
  const [requestedRange, setRequestedRange] = useState<DateRangeState>(
    () => restore?.requestedRange ?? allTimeDateRange(),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((s) => {
      if (examFilter.length > 0 && !examFilter.includes(s.exam)) return false;
      if (q && !matchesQuery(s, q)) return false;
      if (!dateRangeIncludes(submittedRange, readableDate(s.submittedAt))) return false;
      if (!isAllTimeRange(requestedRange)) {
        if (!s.reuploadRequestedAt) return false;
        if (!dateRangeIncludes(requestedRange, readableDate(s.reuploadRequestedAt))) return false;
      }
      return true;
    });
  }, [rows, query, examFilter, submittedRange, requestedRange]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, sort, examFilter, submittedRange, requestedRange]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  /** Every Quiz Exam Reviews reviews — the Quiz pill's option list, the same
   *  live list Exam Reviews offers, so an applied Quiz can't vanish when its
   *  last row leaves. */
  const examNames = useReviewedQuizNames();

  function review(id: string) {
    onReview?.(
      id,
      sorted.map((s) => s.id),
      { query, examFilter, sort, submittedRange, requestedRange },
    );
  }

  const hasFilters =
    examFilter.length > 0 || !isAllTimeRange(submittedRange) || !isAllTimeRange(requestedRange);

  function clearFilters() {
    setExamFilter([]);
    setSubmittedRange(allTimeDateRange());
    setRequestedRange(allTimeDateRange());
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <>
    <div className="main">
      <div className="workspace">
        <div className="tasks sch-page">
          {/* Reached from the Exam Reviews header, the same way Name Changes
              used to be — so the crumb is the way back. */}
          <nav className="rvc-crumbs" aria-label="Breadcrumb">
            <button className="rvc-crumb" onClick={onBack} title="Back to Exam Reviews">
              Exam Reviews
            </button>
          </nav>
          <header className="tasks-header">
            <div className="rvc-pagehead">
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
                  submissions={rows}
                  quizzes={examNames}
                  exams={examFilter}
                  onExamsChange={setExamFilter}
                  query={query}
                  onCommit={setQuery}
                  secondary
                />
              </div>

              {/* Quiz gets a pill of its own, as on Exam Reviews, then one
                  Exam Reviews date pill per date column, in column order — inline, dashed at
                  All Time, cleared with the rest; `align="left"` + the pill's
                  overlay keep the wide panel on screen. */}
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
                <DateRangePill
                  label="Re-Upload Request Date"
                  value={requestedRange}
                  onChange={setRequestedRange}
                  tip={FILTER_TIPS.examReviews.reuploadRequested}
                  allTimeIsEmpty
                  align="left"
                />
                <DateRangePill
                  label="Submission Date"
                  value={submittedRange}
                  onChange={setSubmittedRange}
                  tip={FILTER_TIPS.examReviews.reuploadSubmitted}
                  allTimeIsEmpty
                  align="left"
                />
                {hasFilters && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Six columns don't fit a narrow page, so the table carries a
                  width floor and scrolls horizontally past it rather than
                  crushing the columns — the same `--table-min` machinery
                  the Exam Reviews table uses. */}
              <div
                className="table-xscroll"
                style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}
              >
              <div className="tasks-scroll">
                {/* Plain `.table`, not the `.sch-table` shell: the rows open the
                    review console now, so this wants the base table's pointer
                    cursor rather than the shell's `cursor: default`. */}
                <table className="table">
                  {/* The shared width rule: every column keeps its base width
                      and shares the slack in proportion; the chevron gutter
                      stays fixed. */}
                  <TableCols
                    data={[
                      COL_WIDTHS.name,
                      COL_WIDTHS.email,
                      COL_WIDTHS.phone,
                      COL_WIDTHS.quiz,
                      COL_WIDTHS.date,
                      COL_WIDTHS.date,
                    ]}
                    trail={[ACTIONS_WIDTH]}
                  />
                  <thead>
                    <tr>
                      <SortableHeader col="candidate" label="User's Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="email" label="Email" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="phone" label="Phone" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="exam" label="Quiz" sort={sort} toggle={toggleSort} />
                      {/* Two distinct dates: "Re-Upload Requested On" is when an
                          admin asked for a new ID — the one this page's chase is
                          measured from, so it leads and sorts the page — and
                          "Submitted On" is the candidate's original attempt (the
                          value the Exam Reviews table shows), always earlier. */}
                      <SortableHeader col="requestedAt" label="Re-Upload Requested On" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="submittedAt" label="Submitted On" sort={sort} toggle={toggleSort} />
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((s) => (
                      <tr key={s.id} onClick={() => review(s.id)}>
                        <td className="col-name">{s.candidateName}</td>
                        {/* Click-to-copy (see CopyCells.tsx) — same pair as the
                            Exam Reviews table, for the same re-upload chase. */}
                        <td className="col-u-email" data-copyable>{s.candidateEmail}</td>
                        <td className="col-u-phone" data-copyable>{s.candidatePhone}</td>
                        <td>{s.exam}</td>
                        <td>{s.reuploadRequestedAt ?? "—"}</td>
                        <td>{s.submittedAt}</td>
                        {/* Same row-end affordance as the Exam Reviews table: a
                            resting chevron that hides on row hover, replaced in
                            place by the labelled bar. */}
                        <td className="col-actions">
                          <button
                            className="row-action-btn lone-dots row-chevron"
                            aria-label="Review Exam"
                            onClick={(e) => { e.stopPropagation(); review(s.id); }}
                          >
                            <RowChevronIcon />
                          </button>
                          <div className="row-action-bar">
                            <button
                              className="row-action-btn row-action-btn--label"
                              onClick={(e) => { e.stopPropagation(); review(s.id); }}
                            >
                              Review Exam
                              <RowChevronIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paged.length === 0 && <TableEmpty />}
              </div>

              <div className="pagination">
                <span>
                  Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><PagePrevIcon /></button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><PageNextIcon /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {toastNode}
    </>
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
