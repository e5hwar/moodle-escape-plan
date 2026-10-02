import { useEffect, useMemo, useState } from "react";
import { renameUser } from "../data/users";
import {
  submissions as seedSubmissions,
  matchesQuery,
  type ProctoringKind,
  type ProctoringStatus,
  type Submission,
} from "../data/proctoring";
import { ProctoringConsole } from "./ProctoringConsole";
import { MultiPill } from "./UsersFilters";
import { FILTER_TIPS } from "../data/filterTips";
import {
  DateRangePill,
  allTimeDateRange,
  isAllTimeRange,
  dateRangeIncludes,
  type DateRangeState,
} from "./DateRangeFilter";
import { ProctoringSearch } from "./ProctoringSearch";
import { ReviewRunsStrip, ReviewRunCard } from "./ReviewRuns";
import { SortIcon, RowChevronIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { TableCols } from "./TableCols";

const PAGE_SIZE = 50;

export type SortKey = "candidate" | "email" | "phone" | "exam" | "submittedAt";
export type SortDir = "asc" | "desc";

// submittedAt is a display string like "November 5th, 2025, 2:30 PM" — strip
// the ordinal suffix so Date.parse can read it.
function readableDate(s: string): string {
  return s.replace(/(\d+)(st|nd|rd|th)/, "$1");
}
function parseSubmittedAt(s: string): number {
  return Date.parse(readableDate(s)) || 0;
}

const TYPE_SEQUENCE: ProctoringKind[] = ["proctoring", "id-review", "id-reupload"];

const SORT_FIELD: Record<Exclude<SortKey, "submittedAt">, (s: Submission) => string> = {
  candidate: (s) => s.candidateName,
  email: (s) => s.candidateEmail,
  phone: (s) => s.candidatePhone,
  exam: (s) => s.exam,
};

function compareRows(a: Submission, b: Submission, key: SortKey): number {
  if (key === "submittedAt") return parseSubmittedAt(a.submittedAt) - parseSubmittedAt(b.submittedAt);
  const field = SORT_FIELD[key];
  const va = field(a).toLowerCase();
  const vb = field(b).toLowerCase();
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
}

/* The kind filter is the "Review Type" pill on the filters row — the shared
   PillTrigger multi-select every other list page uses. It replaced the
   pill-per-kind tab row (which had itself replaced the stat-card tiles): one
   pill holding the same three kinds, so the Quiz filter can sit beside it on
   the same line. No selection means every kind, the way an unapplied filter
   reads everywhere else. */
const REVIEW_TYPE_LABEL: Record<ProctoringKind, string> = {
  proctoring: "Proctored Exams",
  "id-review": "ID Reviews",
  "id-reupload": "ID Re-Uploads",
};
const REVIEW_TYPE_OPTIONS: string[] = TYPE_SEQUENCE.map((k) => REVIEW_TYPE_LABEL[k]);
const KIND_BY_REVIEW_TYPE = new Map<string, ProctoringKind>(
  TYPE_SEQUENCE.map((k) => [REVIEW_TYPE_LABEL[k], k]),
);

/* Short date for the flag's tooltip — "Mar 9, 2026" from the row's own
   "March 9th, 2026, 11:20 AM" display string. */
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function shortDate(display: string): string {
  const t = parseSubmittedAt(display);
  if (!t) return display;
  const d = new Date(t);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** The candidate's name with the "New ID" flag when this row is a re-upload the
 *  candidate has sent back (Figma 994:1081 "Table Pills - Yellow"). */
function CandidateName({ submission }: { submission: Submission }) {
  if (submission.kind !== "id-reupload") return <>{submission.candidateName}</>;
  return (
    <>
      {submission.candidateName}
      <span
        className="pr-name-flag"
        data-tip={
          submission.reuploadedAt ? `Re-Uploaded on ${shortDate(submission.reuploadedAt)}` : undefined
        }
      >
        New ID
      </span>
    </>
  );
}

/* ── Review Runs (the `.rr` strip, shared with Hands-On Submissions) ──
   A run is ONE filter over the pending queue — every Review Type, one or more
   Review Types, or one or more Quizzes — oldest first. A card is that filter
   preset; its number is how many are still pending in it. Suggested cards are
   the fixed four below; Recent cards are the filters that were in force each
   time a review was opened. */
type RunKind = "all" | "type" | "quiz";
/** `values` are ProctoringKinds for a "type" run, quiz names for a "quiz" run. */
type RunKey = { kind: RunKind; values: string[] };

const ALL_RUN: RunKey = { kind: "all", values: [] };

/** Identity: the same filter (whatever the value order) is the same card. */
const runId = (k: RunKey) => `${k.kind}:${[...k.values].sort().join("\u0000")}`;

function inRun(s: Submission, k: RunKey): boolean {
  switch (k.kind) {
    case "all":
      return true;
    case "type":
      return k.values.includes(s.kind);
    case "quiz":
      return k.values.includes(s.exam);
  }
}

function runTitles(k: RunKey): string[] {
  if (k.kind === "all") return ["All Reviews"];
  if (k.kind === "type") return k.values.map((v) => REVIEW_TYPE_LABEL[v as ProctoringKind] ?? v);
  return k.values;
}

/* The second line names the KIND of filter, as on Hands-On; All has none. */
const RUN_SUBTITLE: Record<RunKind, string | null> = {
  all: null,
  type: "Review Type",
  quiz: "Quiz",
};

/* Suggested is a fixed four (user, 2026-09-30): All, then each Review Type —
   minus anything already in Recent or with nothing pending. Recents keep up
   to 5 and the strip never holds more than 7, recents first. */
const SUGGESTED_RUNS: RunKey[] = [
  ALL_RUN,
  ...TYPE_SEQUENCE.map((k): RunKey => ({ kind: "type", values: [k] })),
];
const MAX_RECENT = 5;
const MAX_RUNS = 7;

/* Recents outlive the page: App unmounts it on every navigation, and this
   prototype has no storage layer, so they live at module scope for the
   session. */
let recentRunsStore: RunKey[] = [];

export function ProctoringPage({
  onPendingIdReuploads,
  initialSubmissionId,
  onExitToOrigin,
  originLabel,
}: {
  onPendingIdReuploads?: () => void;
  /** Opens straight into a submission's console — how Pending ID Re-Uploads
   *  hands a row over, so an exam is only ever reviewed in one place. */
  initialSubmissionId?: string;
  /** Where to go when the console handed over by `initialSubmissionId` is
   *  closed: back to the page that sent us, not this page's own table. */
  onExitToOrigin?: () => void;
  /** That page's name, for the console's breadcrumb. */
  originLabel?: string;
}) {
  const [list, setList] = useState<Submission[]>(seedSubmissions);
  // The Review Type pill's applied kinds, as labels — empty means every kind.
  const [reviewTypeFilter, setReviewTypeFilter] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  // Quiz has a pill on the filters row; the search bar can also scope to it.
  const [examFilter, setExamFilter] = useState<string[]>([]);
  /* All Time, not the shared Last 30 Days default: this is a backlog queue, and
     a rolling window would open the page with the longest-waiting submissions —
     the ones it exists to surface — already hidden. */
  const [dateRange, setDateRange] = useState<DateRangeState>(() => allTimeDateRange());
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(initialSubmissionId ?? null);
  /* True while the console is still showing the row another page handed over,
     so closing it goes back there. Cleared the moment the reviewer acts on a
     submission: from then on they're working this page's queue, and exiting
     belongs on this page's table. */
  const [returnToOrigin, setReturnToOrigin] = useState(!!initialSubmissionId);
  // Longest waiting first — the default review-run order, so the table reads
  // in the same order as the console's queue.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedAt", dir: "asc" });
  // Recent runs, newest first — seeded from, and mirrored to, the module store.
  const [recents, setRecents] = useState<RunKey[]>(() => recentRunsStore);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  // Once a submission is accepted/rejected it's off the review queue entirely. A
  // requested reupload doesn't count toward the run cards' counts — only true
  // "pending" items do — and it only surfaces when the Review Type filter asks
  // for ID Re-uploads, never in the unfiltered list.
  const pending = useMemo(() => list.filter((s) => s.status === "pending"), [list]);

  /** The Review Type pill's labels resolved back to kinds. */
  const kinds = useMemo(
    () => reviewTypeFilter.flatMap((label) => KIND_BY_REVIEW_TYPE.get(label) ?? []),
    [reviewTypeFilter],
  );

  // A recent whose queue has been cleared has nothing left to open — it drops
  // out of the strip (and frees its slot) rather than showing a 0.
  const liveRecents = useMemo(
    () => recents.filter((r) => pending.some((s) => inRun(s, r))),
    [recents, pending],
  );

  const suggested = useMemo(() => {
    const taken = new Set(liveRecents.map(runId));
    const room = Math.max(0, MAX_RUNS - liveRecents.length);
    return SUGGESTED_RUNS.filter(
      (k) => !taken.has(runId(k)) && pending.some((s) => inRun(s, k)),
    ).slice(0, room);
  }, [liveRecents, pending]);

  /** Every quiz with something pending — the Quiz pill's option list. */
  const examNames = useMemo(
    () => [...new Set(pending.map((s) => s.exam))].sort((a, b) => a.localeCompare(b)),
    [pending],
  );

  /* All Time IS the Submission Date filter's empty state, so a set range counts
     towards Clear Filters exactly like a chosen Review Type or Quiz. */
  const hasFilters =
    reviewTypeFilter.length + examFilter.length > 0 || !isAllTimeRange(dateRange);

  function clearFilters() {
    setReviewTypeFilter([]);
    setExamFilter([]);
    setDateRange(allTimeDateRange());
  }

  /** Push a run to the front of Recent (a repeat just moves it up); cleared
   *  runs fall away so they never hold a slot. */
  function recordRecent(key: RunKey) {
    const id = runId(key);
    const next = [
      key,
      ...recents.filter((r) => runId(r) !== id && pending.some((s) => inRun(s, r))),
    ].slice(0, MAX_RECENT);
    recentRunsStore = next;
    setRecents(next);
  }

  /* The run the filters describe: Quiz outranks Review Type — the narrower
     filter wins, as Task outranks Certification on Hands-On. Submission Date
     and the search text never count — they scope what the reviewer is looking
     at, not what they are clearing. Neither applied → All Reviews. */
  function runFromFilters(): RunKey {
    if (examFilter.length) return { kind: "quiz", values: examFilter };
    if (kinds.length) return { kind: "type", values: kinds };
    return ALL_RUN;
  }

  /** A card click: reset the filters to the run, oldest first, and open the
   * console on its longest-waiting submission. The console's queue IS the
   * table's filtered+sorted list, so setting the filters is all a run has to
   * do. The card becomes (or moves to the front of) Recent. */
  function startRun(key: RunKey) {
    const first = pending
      .filter((s) => inRun(s, key))
      .sort((a, b) => parseSubmittedAt(a.submittedAt) - parseSubmittedAt(b.submittedAt))[0];
    if (!first) return;
    setReviewTypeFilter(
      key.kind === "type" ? key.values.map((k) => REVIEW_TYPE_LABEL[k as ProctoringKind]) : [],
    );
    setExamFilter(key.kind === "quiz" ? key.values : []);
    setDateRange(allTimeDateRange());
    setQuery("");
    setSort({ key: "submittedAt", dir: "asc" });
    recordRecent(key);
    setReturnToOrigin(false);
    setActiveId(first.id);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      if (s.status === "pending") {
        if (kinds.length > 0 && !kinds.includes(s.kind)) return false;
      } else if (s.status === "id-requested") {
        /* Waiting on the candidate, not on us — never part of this table. The
           Review Type pill used to be able to ask for these; it no longer
           offers ID Re-uploads, and they have their own page instead. */
        return false;
      } else {
        return false;
      }
      if (!dateRangeIncludes(dateRange, readableDate(s.submittedAt))) return false;
      if (examFilter.length > 0 && !examFilter.includes(s.exam)) return false;
      if (q && !matchesQuery(s, q)) return false;
      return true;
    });
  }, [list, kinds, query, examFilter, dateRange]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  /* Paging matches the Hands-On table (same PAGE_SIZE, same footer). The queue
     rarely fills a page, but the "Showing x–y of n" line is the table's standard
     footer, so it's here whatever the count is. */
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(
    () => setPage(1),
    [query, reviewTypeFilter, examFilter, dateRange, sort],
  );
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  /* Normally the open submission is one of the visible rows. The fallback to
     the full list covers a row arrived at from elsewhere that the current
     filters happen to exclude — without it the console would silently refuse
     to open. */
  const active = activeId
    ? sorted.find((s) => s.id === activeId) ?? list.find((s) => s.id === activeId) ?? null
    : null;

  // Prior rejected attempts by this candidate, across any exam — not just the one open now.
  const previousRejected = useMemo(() => {
    if (!active) return [];
    return list.filter(
      (s) => s.candidateEmail === active.candidateEmail && s.status === "rejected" && s.id !== active.id,
    );
  }, [list, active]);

  /** Open the console from a table row: the filters in force become the
   *  newest recent run. */
  function openReview(id: string) {
    recordRecent(runFromFilters());
    openSubmission(id);
  }

  function openSubmission(id: string) {
    // Moving to a different submission means they're working this page's queue.
    if (id !== initialSubmissionId) setReturnToOrigin(false);
    setActiveId(id);
  }

  function closeConsole() {
    if (returnToOrigin && onExitToOrigin) {
      onExitToOrigin();
      return;
    }
    setActiveId(null);
  }

  /* The console's "Exam Reviews" crumb when it was opened from elsewhere:
     leaves that origin behind for this page's own table. The re-upload
     preselection goes with it — it exists only to make the handed-over row
     visible. */
  function exitToSection() {
    setReturnToOrigin(false);
    setReviewTypeFilter([]);
    setActiveId(null);
  }

  // Decide a submission (accept/reject): it leaves the review queue entirely and
  // whichever submission was next in line (or previous, if this was the last one) opens.
  // Rejection reasons are kept on the record so this candidate's later submissions
  // can list them in the Integrity Note's "Rejected Attempts" detail.
  function decide(id: string, status: ProctoringStatus, reasons?: string[]) {
    setReturnToOrigin(false);
    const idx = sorted.findIndex((s) => s.id === id);
    const next = idx >= 0 ? sorted[idx + 1] ?? sorted[idx - 1] ?? null : null;
    setList((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status, ...(reasons?.length ? { rejectionReasons: reasons } : null) }
          : s,
      ),
    );
    setActiveId(next ? next.id : null);
  }

  // Requesting a reupload moves the submission into the ID Re-uploads tab in a
  // pending/secondary state — it no longer counts toward the pill counts, but stays
  // visible in the table until it's accepted or rejected.
  function requestReupload(id: string) {
    setReturnToOrigin(false);
    const idx = sorted.findIndex((s) => s.id === id);
    const next = idx >= 0 ? sorted[idx + 1] ?? sorted[idx - 1] ?? null : null;
    setList((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        /* The prior verification is dropped with the request: it vouched for the
           document being replaced, not for whatever arrives next. This is what
           keeps "Re-Uploaded ID" and "Verified" mutually exclusive — a row can
           never be both. */
        const { idPreviouslyVerified: _dropped, ...rest } = s;
        return { ...rest, status: "id-requested" as const, kind: "id-reupload" as const };
      }),
    );
    setActiveId(next ? next.id : null);
  }

  /* The Name Mismatch banner's commit: the reviewer has decided which name to
     keep, so the ID's detected name matches it from here on and the mismatch is
     resolved. */
  /* One rename, wherever it comes from — the Name Mismatch card's commit, its
     "Use This", or the pop-up behind the candidate's name. Three things have to
     move together or the rename only looks like it worked:
       · the USER's profile (the shared roster), not just this submission —
         otherwise the old name is back the moment you leave the page;
       · every submission this candidate has, not just the open one;
       · the name read off the ID, which settles the mismatch — the admin has
         just told us which name to keep, so the card has nothing left to ask. */
  function renameCandidate(userId: string, name: string) {
    renameUser(userId, name);
    setList((prev) =>
      prev.map((s) =>
        s.userId === userId ? { ...s, candidateName: name, idDetectedName: name } : s,
      ),
    );
  }


  if (active) {
    return (
      <ProctoringConsole
        submission={active}
        queue={sorted}
        previousRejected={previousRejected}
        onGoto={openSubmission}
        onExit={closeConsole}
        // Only while the exit still goes back there — once the reviewer joins
        // this page's queue, the crumb has to follow them (see `returnToOrigin`).
        originLabel={returnToOrigin ? originLabel : undefined}
        onExitToSection={exitToSection}
        onAccept={() => decide(active.id, "accepted")}
        onReject={(details) => decide(active.id, "rejected", details?.reasons)}
        onRequestId={() => requestReupload(active.id)}
        onUpdateName={(name) => renameCandidate(active.userId, name)}
        onRenameUser={renameCandidate}
      />
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks pr-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Exam Reviews</h1>
            </div>
            <div className="tasks-header-actions">
              {/* Pending ID Re-Uploads is reached from here (the slot Name
                  Changes used to hold). No count pill: these rows wait on the
                  CANDIDATE, not on an admin, so a badge beside the review
                  queue's own numbers would read as work to pick up. */}
              <button className="cta-quiet" onClick={onPendingIdReuploads}>
                Pending ID Re-Uploads
              </button>
            </div>
          </header>

          {/* Review Runs — the Hands-On strip (Figma 1392:1793): one row,
              recents first (marked "· Recent"), then suggestions.
              Recent = the filters in force each time a review was opened,
              newest first; Suggested = All, Proctored Exams, ID Reviews, ID
              Re-Uploads. A card narrows the queue to its run and opens the
              console on the longest-waiting submission. Nothing pending → no
              strip. Cards share the row's width equally (`rr--fill`), never
              below 280px. */}
          {pending.length > 0 && (
            <ReviewRunsStrip className="rr--fill">
              <RunCards recents={liveRecents} suggested={suggested} pending={pending} onPick={startRun} />
            </ReviewRunsStrip>
          )}

          {/* Same shell as Hands-On Task Submissions (.tasks-row > .tasks-content):
              it gives the table the flex context that pins the pagination footer
              to the bottom of the page instead of letting it float under a short
              list. */}
          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <ProctoringSearch
                  submissions={pending}
                  exams={examFilter}
                  onExamsChange={setExamFilter}
                  query={query}
                  onCommit={setQuery}
                  secondary
                />
              </div>

              {/* The same filter row every other list page carries: shared
                  PillTrigger pills over one Clear Filters link. */}
              <div className="filters">
                <MultiPill
                  label="Review Type"
                  all={REVIEW_TYPE_OPTIONS}
                  value={reviewTypeFilter}
                  onApply={setReviewTypeFilter}
                  tip={FILTER_TIPS.examReviews.reviewType}
                />
                <MultiPill
                  label="Quiz"
                  all={examNames}
                  value={examFilter}
                  onApply={setExamFilter}
                  searchable
                  searchPlaceholder="Search Quizzes..."
                  width={300}
                  tip={FILTER_TIPS.examReviews.quiz}
                />
                {/* A filter like the two before it, not the right-edge pill
                    Companies parks: on this page the range really does decide
                    whether a row is listed, so it names the date it filters on
                    ("Submission Date"), sits inline, goes dashed at All Time —
                    which narrows nothing, so it IS unapplied — and clears with
                    the rest. `align="left"` opens its wide panel along the row
                    now that it no longer hangs off the right edge. */}
                <DateRangePill
                  label="Submission Date"
                  value={dateRange}
                  onChange={setDateRange}
                  tip={FILTER_TIPS.examReviews.dateRange}
                  allTimeIsEmpty
                  align="left"
                />
                {hasFilters && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Table — the shared .table system the Hands-On Task Submissions
                  page uses, minus Edit Columns (this column set is fixed). */}
              <div
                className="table-xscroll"
                style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}
              >
                <table className="table table-head">
                  <ProctoringColGroup />
                  <thead>
                    <tr>
                      <SortableHeader col="candidate" label="User's Name" className="col-name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="email" label="Email" className="pr-col-email" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="phone" label="Phone" className="pr-col-phone" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="exam" label="Quiz" className="pr-col-exam" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="submittedAt" label="Submitted On" className="pr-col-date" sort={sort} toggle={toggleSort} />
                      <th className="col-actions" />
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className="table table-body">
                    <ProctoringColGroup />
                    <tbody>
                      {paged.map((s) => (
                        <tr key={s.id} onClick={() => openReview(s.id)}>
                          <td className="col-name"><CandidateName submission={s} /></td>
                          {/* Click-to-copy (see CopyCells.tsx) — the two
                              values an admin pastes into a mail client or
                              a phone dialler while chasing a candidate. */}
                          <td className="pr-col-email" data-copyable>{s.candidateEmail}</td>
                          <td className="pr-col-phone" data-copyable>{s.candidatePhone}</td>
                          <td className="pr-col-exam">{s.exam}</td>
                          <td className="pr-col-date">{s.submittedAt}</td>
                          {/* Row-end affordance, identical to the Hands-On
                              Task Submissions table: a centred chevron that
                              hides on row hover, replaced in place by a
                              labelled bar whose own chevron lands on the
                              same pixel. */}
                          <td className="col-actions">
                            <button
                              className="row-action-btn lone-dots row-chevron"
                              aria-label="Review Exam"
                              onClick={(e) => { e.stopPropagation(); openReview(s.id); }}
                            >
                              <RowChevronIcon />
                            </button>
                            <div className="row-action-bar">
                              <button
                                className="row-action-btn row-action-btn--label"
                                onClick={(e) => { e.stopPropagation(); openReview(s.id); }}
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
                          <td colSpan={6} className="u-empty">
                            {query.trim()
                              ? `No submissions match "${query.trim()}".`
                              : "No submissions match these filters."}
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
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><PagePrevIcon /></button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><PageNextIcon /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The strip's cards built from this page's runs — recents first (each
 *  marked "· Recent"), then the suggestions, in one unlabelled row. */
function RunCards({
  recents,
  suggested,
  pending,
  onPick,
}: {
  recents: RunKey[];
  suggested: RunKey[];
  pending: Submission[];
  onPick: (k: RunKey) => void;
}) {
  const runs = [
    ...recents.map((k) => ({ k, recent: true })),
    ...suggested.map((k) => ({ k, recent: false })),
  ];
  return (
    <>
      {runs.map(({ k, recent }) => (
        <ReviewRunCard
          key={runId(k)}
          count={pending.filter((s) => inRun(s, k)).length}
          values={runTitles(k)}
          sub={RUN_SUBTITLE[k.kind]}
          recent={recent}
          onClick={() => onPick(k)}
        />
      ))}
    </>
  );
}

/* Column widths mirror the Hands-On table: an explicit width on every column
   except one left auto, which soaks up the leftover space (.table is
   fixed-layout, so an auto column can only grow past its reserved minimum).
   Name is that column now — same as every other list page.
   Email is fixed at what the longest seeded address needs
   ("andre.dubois@keystoneelectrical.com", ~270px, plus the cell's 2×20px
   padding); Quiz at its longest value ("Building Science Principles
   Certificate", 274px) the same way. */
/* Widened from 240 to fit the "New ID" flag beside the longest name without
   pushing either to an ellipsis (Figma 994:1055). The longest pair
   ("Sophia Andersson" + the flag) measures 209px including the cell's insets,
   so this still clears it. */
const NAME_MIN = 260;
const COL_WIDTHS = { email: 310, phone: 170, quiz: 316, date: 265 };
/** The row-end chevron column — same 40px reserve as the Hands-On table. */
const ACTIONS_WIDTH = 40;
const TABLE_MIN =
  NAME_MIN +
  COL_WIDTHS.email +
  COL_WIDTHS.phone +
  COL_WIDTHS.quiz +
  COL_WIDTHS.date +
  ACTIONS_WIDTH;

function ProctoringColGroup() {
  return (
    <TableCols
      data={[NAME_MIN, COL_WIDTHS.email, COL_WIDTHS.phone, COL_WIDTHS.quiz, COL_WIDTHS.date]}
      trail={[ACTIONS_WIDTH]}
    />
  );
}

function SortableHeader({
  col,
  label,
  className,
  sort,
  toggle,
}: {
  col: SortKey;
  label: string;
  className: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className={className} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
