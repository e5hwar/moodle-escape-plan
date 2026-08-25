import { useEffect, useMemo, useState } from "react";
import {
  submissions as seedSubmissions,
  matchesQuery,
  reuploadStatusOf,
  type ProctoringKind,
  type ProctoringStatus,
  type Submission,
} from "../data/proctoring";
import { nameChangeRequests } from "../data/nameChangeRequests";
import { ProctoringConsole } from "./ProctoringConsole";
import { ProctoringSearch } from "./ProctoringSearch";
import { SectionHeading } from "./SectionHeading";
import { useLandingMorph } from "../hooks/useLandingMorph";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { LandingOverlay, BackToSearch, type LandingCol, type LandingRow } from "./LandingMorph";
import {
  SortIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RunMoveUpIcon,
  RunMoveDownIcon,
} from "./icons";

const PAGE_SIZE = 50;

type FilterKey = "all" | ProctoringKind;

export type SortKey = "candidate" | "type" | "email" | "exam" | "submittedAt";
export type SortDir = "asc" | "desc";

// submittedAt is a display string like "November 5th, 2025, 2:30 PM" — strip
// the ordinal suffix so Date.parse can read it.
function parseSubmittedAt(s: string): number {
  return Date.parse(s.replace(/(\d+)(st|nd|rd|th)/, "$1")) || 0;
}

const KIND_LABEL: Record<ProctoringKind, string> = {
  proctoring: "Proctoring",
  "id-review": "ID Review",
  "id-reupload": "ID Re-upload",
};

/* The run card names the types the way Figma 300:363 does — "Proctored Exams",
   not the table/pill wording above. */
const RUN_TYPE_LABEL: Record<ProctoringKind, string> = {
  proctoring: "Proctored Exams",
  "id-review": "ID Reviews",
  "id-reupload": "ID Re-Uploads",
};

const TYPE_SEQUENCE: ProctoringKind[] = ["proctoring", "id-review", "id-reupload"];

/** How many quiz rows the By Quiz card lists before "+ N more" (Figma 714:1515). */
const QUIZ_ROWS = 3;

/* A run's grouping: the queue is ordered by this sequence, longest-waiting
   first WITHIN each group, so the reviewer clears one type (or one quiz)
   before the next begins. `null` = the table's plain column sort. */
type RunOrder = { field: "kind" | "exam"; sequence: string[] } | null;

function rankOf(s: Submission, order: RunOrder): number {
  if (!order) return 0;
  const i = order.sequence.indexOf(order.field === "kind" ? s.kind : s.exam);
  // Anything outside the sequence sorts after it rather than jumping to the front.
  return i === -1 ? order.sequence.length : i;
}

const SORT_FIELD: Record<Exclude<SortKey, "submittedAt">, (s: Submission) => string> = {
  candidate: (s) => s.candidateName,
  type: (s) => KIND_LABEL[s.kind],
  email: (s) => s.candidateEmail,
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

/* The kind filter — a pill per tab, always visible beside the search bar (the
   "User Reviews 6B" reference's one-row filter; it replaced the stat-card
   tiles). */
const FILTER_LABEL: Record<FilterKey, string> = {
  all: "All",
  proctoring: "Proctoring",
  "id-review": "ID Reviews",
  "id-reupload": "ID Re-uploads",
};

function waitDaysOf(s: Submission): number {
  const t = parseSubmittedAt(s.submittedAt);
  return t ? Math.max(0, Math.floor((Date.now() - t) / 86_400_000)) : 0;
}

/* Landing-morph columns — mirror the table's columns (key, label, width) so
   the p=1 hand-off to the real table lines up. Type and Email are visible in
   the landing state; Email's cell crossfades from "N days waiting" to the
   address as the table forms. */
const LM_COLS: LandingCol[] = [
  { key: "type", label: "Type", width: 140, fixed: true },
  { key: "email", label: "Email", width: 310, fixed: true },
  { key: "quiz", label: "Quiz", width: 316 },
  { key: "date", label: "Submitted On", width: 265 },
];

export function ProctoringPage({ onNameChanges }: { onNameChanges?: () => void }) {
  const [list, setList] = useState<Submission[]>(seedSubmissions);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  // Both filters are applied from inside the search bar — this page has no pills.
  const [examFilter, setExamFilter] = useState<string[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Longest waiting first — the landing's framing, and the default review-run
  // order, so the table below the morph reads in the same order as the queue.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedAt", dir: "asc" });
  // The order the By Type card walks the queue in — reordered by its arrows.
  const [typeOrder, setTypeOrder] = useState<ProctoringKind[]>(TYPE_SEQUENCE);
  // Set while a By Type / By Quiz run is active; overrides the column sort.
  const [runOrder, setRunOrder] = useState<RunOrder>(null);

  // Landing morph — the page opens as the review-run landing and the wheel (or
  // any search / pill / row interaction) morphs it into the table view.
  const morph = useLandingMorph();

  function toggleSort(key: SortKey) {
    // Sorting by a column is an explicit override of a run's grouping.
    setRunOrder(null);
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function moveType(from: number, to: number) {
    setTypeOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  // Once a submission is accepted/rejected it's off the review queue entirely. A
  // requested reupload doesn't count toward the pill counts — only true "pending"
  // items do — and it only surfaces under the ID Re-uploads tab, never under "All".
  const pending = useMemo(() => list.filter((s) => s.status === "pending"), [list]);

  const counts = useMemo(() => {
    return {
      all: pending.length,
      proctoring: pending.filter((s) => s.kind === "proctoring").length,
      "id-review": pending.filter((s) => s.kind === "id-review").length,
      "id-reupload": pending.filter((s) => s.kind === "id-reupload").length,
    };
  }, [pending]);

  /* ── "Start a review run" cards: the landing overview of everything pending.
     Computed from the full pending queue, not the filtered table — the cards
     describe the whole queue whatever the pills beside the search say. ── */
  const quizRanked = useMemo(() => {
    const byQuiz = new Map<string, number>();
    pending.forEach((s) => byQuiz.set(s.exam, (byQuiz.get(s.exam) ?? 0) + 1));
    return [...byQuiz.entries()].sort((a, b) => b[1] - a[1]);
  }, [pending]);

  /** Start a run: clear the filters, order the whole pending queue by the run's
   * grouping (longest wait first within each group), and open the console on
   * its first submission. The console's queue IS the table's filtered+sorted
   * list, so ordering the table is all a run has to do — the reviewer then
   * walks the entire queue in that sequence rather than one scope at a time. */
  function startRun(order: RunOrder) {
    const first = [...pending].sort(
      (a, b) =>
        rankOf(a, order) - rankOf(b, order) ||
        parseSubmittedAt(a.submittedAt) - parseSubmittedAt(b.submittedAt),
    )[0];
    if (!first) return;
    setFilter("all");
    setExamFilter([]);
    setCompanyFilter([]);
    setQuery("");
    setSort({ key: "submittedAt", dir: "asc" });
    setRunOrder(order);
    setActiveId(first.id);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      if (s.status === "pending") {
        if (filter !== "all" && s.kind !== filter) return false;
      } else if (s.status === "id-requested") {
        if (filter !== "id-reupload") return false;
      } else {
        return false;
      }
      if (examFilter.length > 0 && !examFilter.includes(s.exam)) return false;
      if (companyFilter.length > 0 && !(s.companyName && companyFilter.includes(s.companyName)))
        return false;
      if (q && !matchesQuery(s, q)) return false;
      return true;
    });
  }, [list, filter, query, examFilter, companyFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    // A run's grouping wins until the reviewer clicks a column header.
    if (runOrder) {
      return arr.sort(
        (a, b) =>
          rankOf(a, runOrder) - rankOf(b, runOrder) ||
          parseSubmittedAt(a.submittedAt) - parseSubmittedAt(b.submittedAt),
      );
    }
    arr.sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort, runOrder]);

  /* Paging matches the Hands-On table (same PAGE_SIZE, same footer). The queue
     rarely fills a page, but the "Showing x–y of n" line is the table's standard
     footer, so it's here whatever the count is. */
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, filter, examFilter, companyFilter, sort, runOrder]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  /* Status is a re-uploads-only column: it distinguishes "we've asked, the
     candidate hasn't sent it" from "sent, waiting on us". On All (and the other
     tabs) there's nothing to distinguish — only the To Review ones appear there
     — so the column would be a single repeated value, and it's dropped. */
  const showStatus = filter === "id-reupload";

  const active = activeId ? sorted.find((s) => s.id === activeId) ?? null : null;

  /* The three run cards carry keycaps (Figma 713:1358 / 714:1478 / 714:1542),
     so each CTA has the matching letter shortcut. Live only on the landing —
     the console binds its own A/R/I keys. */
  const runnable = !active && pending.length > 0;
  useCreateShortcut(() => startRun(null), runnable, "s");
  useCreateShortcut(() => startRun({ field: "kind", sequence: typeOrder }), runnable, "t");
  useCreateShortcut(
    () => startRun({ field: "exam", sequence: quizRanked.map(([name]) => name) }),
    runnable,
    "q",
  );

  // Prior rejected attempts by this candidate, across any exam — not just the one open now.
  const previousRejected = useMemo(() => {
    if (!active) return [];
    return list.filter(
      (s) => s.candidateEmail === active.candidateEmail && s.status === "rejected" && s.id !== active.id,
    );
  }, [list, active]);

  function openSubmission(id: string) {
    setActiveId(id);
  }

  function closeConsole() {
    setActiveId(null);
  }

  // Decide a submission (accept/reject): it leaves the review queue entirely and
  // whichever submission was next in line (or previous, if this was the last one) opens.
  // Rejection reasons are kept on the record so this candidate's later submissions
  // can list them in the Integrity Note's "Rejected Attempts" detail.
  function decide(id: string, status: ProctoringStatus, reasons?: string[]) {
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
    const idx = sorted.findIndex((s) => s.id === id);
    const next = idx >= 0 ? sorted[idx + 1] ?? sorted[idx - 1] ?? null : null;
    setList((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "id-requested", kind: "id-reupload" } : s,
      ),
    );
    setActiveId(next ? next.id : null);
  }

  /* The Name Mismatch banner's commit: the reviewer has decided which name to
     keep, so the ID's detected name matches it from here on and the mismatch is
     resolved. */
  function updateCandidateName(id: string, name: string) {
    setList((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, candidateName: name, idDetectedName: name } : s,
      ),
    );
  }

  /* A plain rename from the user-details card. Unlike the banner it leaves the
     name read off the ID alone — renaming the user doesn't change what the
     document says, so a rename that disagrees with it raises the mismatch
     rather than silently clearing it. */
  function renameCandidate(id: string, name: string) {
    setList((prev) => prev.map((s) => (s.id === id ? { ...s, candidateName: name } : s)));
  }

  // The Status column exists only on the ID Re-uploads tab — insert it into the
  // landing columns there too so the p=1 hand-off stays column-aligned.
  const lmCols = showStatus
    ? [...LM_COLS.slice(0, 3), { key: "status", label: "Status", width: STATUS_WIDTH }, LM_COLS[3]]
    : LM_COLS;

  const landingRows: LandingRow[] = sorted.slice(0, 24).map((s) => {
    const days = waitDaysOf(s);
    return {
      key: s.id,
      name: s.candidateName,
      cells: {
        type: KIND_LABEL[s.kind],
        email: (
          <span className="prl-swap">
            <span className="prl-swap-real">{s.candidateEmail}</span>
            <span className="prl-swap-wait">
              {days} day{days === 1 ? "" : "s"} waiting
            </span>
          </span>
        ),
        quiz: s.exam,
        ...(showStatus ? { status: <ReuploadStatusPill submission={s} /> } : null),
        date: s.submittedAt,
      },
    };
  });

  if (active) {
    return (
      <ProctoringConsole
        submission={active}
        queue={sorted}
        previousRejected={previousRejected}
        examFilter={examFilter}
        sort={sort}
        onSort={toggleSort}
        onGoto={openSubmission}
        onExit={closeConsole}
        onAccept={() => decide(active.id, "accepted")}
        onReject={(details) => decide(active.id, "rejected", details?.reasons)}
        onRequestId={() => requestReupload(active.id)}
        onUpdateName={(name) => updateCandidateName(active.id, name)}
        onRenameUser={(_userId, name) => renameCandidate(active.id, name)}
      />
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks lm pr-page" ref={morph.rootRef}>
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Exam Reviews</h1>
            </div>
            <div className="tasks-header-actions">
              {/* Name Change Requests left the sidebar and is reached from here
                  (same move Skills/Question Bank made on the Tasks header); the
                  pill carries the open-request count. */}
              <button className="cta-quiet" onClick={onNameChanges}>
                Name Changes
                <span className="co-status-pill co-status-pill--accent">
                  {nameChangeRequests.length}
                </span>
              </button>
            </div>
          </header>

          {/* Start a Review Run (Figma 685:2654 "Cards") — the landing's hero;
              it collapses away as the wheel morphs the landing into the table.
              Card shells/CTAs are the shared .btn-publish / .btn-save-draft;
              only the card chrome is new (.run-*). */}
          {pending.length > 0 && (
            <section className="run-section">
              <SectionHeading label="Start a Review Run" />
              <div className="run-cards">
                {/* Oldest first (300:311) — the recommended run: no grouping,
                    just the whole queue longest-waiting first. */}
                <div className="run-card run-card--rec">
                  <div className="run-head">
                    <div className="run-headtext">
                      <span className="run-title">Oldest first</span>
                      <span className="run-sub">Longest wait first</span>
                    </div>
                    <span className="run-badge">Recommended</span>
                  </div>
                  <div className="run-countblock">
                    <span className="run-countlabel">Pending:</span>
                    <span className="run-count">{pending.length}</span>
                  </div>
                  <button className="btn-publish run-cta" onClick={() => startRun(null)}>
                    Start Review
                    <span className="run-kbd">S</span>
                  </button>
                </div>

                {/* By type (300:363) — the arrows set the sequence the run walks,
                    so the reviewer clears one type before the next begins. */}
                <div className="run-card">
                  <div className="run-headtext">
                    <span className="run-title">By type</span>
                    <span className="run-sub">One review type at a time</span>
                  </div>
                  <div className="run-list">
                    <div className="run-items">
                      {typeOrder.map((kind, i) => (
                        <div key={kind} className="run-item">
                          <span className="run-item-label">
                            {RUN_TYPE_LABEL[kind]}
                            <span className="run-item-count">· {counts[kind]}</span>
                          </span>
                          <span className="run-item-arrows">
                            {i > 0 && (
                              <button
                                className="run-arrow"
                                onClick={() => moveType(i, i - 1)}
                                aria-label={`Move ${RUN_TYPE_LABEL[kind]} earlier`}
                              >
                                <RunMoveUpIcon />
                              </button>
                            )}
                            {i < typeOrder.length - 1 && (
                              <button
                                className="run-arrow"
                                onClick={() => moveType(i, i + 1)}
                                aria-label={`Move ${RUN_TYPE_LABEL[kind]} later`}
                              >
                                <RunMoveDownIcon />
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn-save-draft run-cta"
                    onClick={() => startRun({ field: "kind", sequence: typeOrder })}
                  >
                    Review by type
                    <span className="run-kbd">T</span>
                  </button>
                </div>

                {/* By quiz (714:1515) — no arrows; the busiest quiz leads. */}
                <div className="run-card">
                  <div className="run-headtext">
                    <span className="run-title">By quiz</span>
                    <span className="run-sub">One quiz back-to-back</span>
                  </div>
                  <div className="run-list">
                    <div className="run-items">
                      {quizRanked.slice(0, QUIZ_ROWS).map(([name, n]) => (
                        <div key={name} className="run-item">
                          <span className="run-item-label">
                            {name}
                            <span className="run-item-count">· {n}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    {quizRanked.length > QUIZ_ROWS && (
                      <p className="run-more">+ {quizRanked.length - QUIZ_ROWS} more</p>
                    )}
                  </div>
                  <button
                    className="btn-save-draft run-cta"
                    onClick={() =>
                      startRun({ field: "exam", sequence: quizRanked.map(([name]) => name) })
                    }
                  >
                    Review by quiz
                    <span className="run-kbd">Q</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Same shell as Hands-On Task Submissions (.tasks-row > .tasks-content):
              it gives the table the flex context that pins the pagination footer
              to the bottom of the page instead of letting it float under a short
              list. */}
          <div className="tasks-row">
            <div className="tasks-content">
              {/* Search and filters belong to the EXPANDED table only — the
                  collapsed view is the run cards plus the list, and both rows
                  fade in with the table chrome (see `.tasks.lm.pr-page` in
                  index.css). The Quiz/Company scopes are applied from inside
                  the bar; the kind pills are the rest of the filter row. */}
              <div className="toolbar">
                <ProctoringSearch
                  submissions={pending}
                  exams={examFilter}
                  onExamsChange={setExamFilter}
                  companies={companyFilter}
                  onCompaniesChange={setCompanyFilter}
                  query={query}
                  onCommit={(q) => {
                    setQuery(q);
                    morph.showTable();
                  }}
                />
              </div>

              <div className="filters prl-kinds">
                {(Object.keys(FILTER_LABEL) as FilterKey[]).map((k) => (
                  <button
                    key={k}
                    className={`lm-pill ${filter === k ? "is-active" : ""}`}
                    aria-pressed={filter === k}
                    onClick={() => setFilter(k)}
                  >
                    {FILTER_LABEL[k]} {counts[k]}
                  </button>
                ))}
              </div>

              <div className="lm-stage">
                <LandingOverlay
                  caption="Longest waiting"
                  total={sorted.length}
                  columns={lmCols}
                  rows={landingRows}
                  nameLabel="User's Name"
                  nameWidth={NAME_MIN}
                  actionsWidth={0}
                  onShowAll={morph.showTable}
                  onRowClick={(row) => openSubmission(row.key)}
                />
                <div className="lm-table">
                  {/* Table — the shared .table system the Hands-On Task Submissions
                      page uses, minus Edit Columns (this column set is fixed). */}
                  <div
                    className="table-xscroll"
                    style={{ "--table-min": `${showStatus ? TABLE_MIN + STATUS_WIDTH : TABLE_MIN}px` } as React.CSSProperties}
                  >
                    <table className="table table-head">
                      <ProctoringColGroup showStatus={showStatus} />
                      <thead>
                        <tr>
                          <SortableHeader col="candidate" label="User's Name" className="col-name" sort={sort} toggle={toggleSort} />
                          <SortableHeader col="type" label="Type" className="pr-col-type" sort={sort} toggle={toggleSort} />
                          <SortableHeader col="email" label="Email" className="pr-col-email" sort={sort} toggle={toggleSort} />
                          <SortableHeader col="exam" label="Quiz" className="pr-col-exam" sort={sort} toggle={toggleSort} />
                          {showStatus && (
                            <th className="col-status no-sort">
                              <span className="th-content">Status</span>
                            </th>
                          )}
                          <SortableHeader col="submittedAt" label="Submitted On" className="pr-col-date" sort={sort} toggle={toggleSort} />
                        </tr>
                      </thead>
                    </table>

                    <div className="tasks-scroll">
                      <table className="table table-body">
                        <ProctoringColGroup showStatus={showStatus} />
                        <tbody>
                          {paged.map((s) => (
                            <tr key={s.id} onClick={() => openSubmission(s.id)}>
                              <td className="col-name">{s.candidateName}</td>
                              <td className="pr-col-type">{KIND_LABEL[s.kind]}</td>
                              <td className="pr-col-email">{s.candidateEmail}</td>
                              <td className="pr-col-exam">{s.exam}</td>
                              {showStatus && (
                                <td className="col-status">
                                  <ReuploadStatusPill submission={s} />
                                </td>
                              )}
                              <td className="pr-col-date">{s.submittedAt}</td>
                            </tr>
                          ))}
                          {paged.length === 0 && (
                            <tr>
                              <td colSpan={showStatus ? 6 : 5} className="u-empty">
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
                    <BackToSearch onClick={morph.showLanding} />
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
    </div>
  );
}

/* Column widths mirror the Hands-On table: an explicit width on every column
   except one left auto, which soaks up the leftover space (.table is
   fixed-layout, so an auto column can only grow past its reserved minimum).
   Name is that column now — same as every other list page, and it's what lets
   the landing morph's flexible name track hand off to the table pixel-exact.
   Email is fixed at what the longest seeded address needs
   ("andre.dubois@keystoneelectrical.com", ~270px, plus the cell's 2×20px
   padding); Quiz at its longest value ("Building Science Principles
   Certificate", 274px) the same way. */
const NAME_MIN = 240;
const COL_WIDTHS = { type: 140, email: 310, quiz: 316, date: 265 };
const TABLE_MIN =
  NAME_MIN + COL_WIDTHS.type + COL_WIDTHS.email + COL_WIDTHS.quiz + COL_WIDTHS.date;

/** Wide enough for the "To Review" pill plus the cell's 2×20px padding. */
const STATUS_WIDTH = 130;

function ProctoringColGroup({ showStatus }: { showStatus: boolean }) {
  return (
    <colgroup>
      {/* Name carries its 240px minimum here (not left auto) so a stretched
          table distributes slack across ALL columns proportionally — that's
          the regime the landing overlay's track formula reproduces. An auto
          column would swallow the slack alone and bump every column at the
          morph hand-off. */}
      <col style={{ width: NAME_MIN }} />
      <col style={{ width: COL_WIDTHS.type }} />
      <col style={{ width: COL_WIDTHS.email }} />
      <col style={{ width: COL_WIDTHS.quiz }} />
      {showStatus && <col style={{ width: STATUS_WIDTH }} />}
      <col style={{ width: COL_WIDTHS.date }} />
    </colgroup>
  );
}

/* Figma "Table Pills" — Requested is the grey pill (83:512, #737373), To Review
   the green one (80:483, #14b867). Both already exist as `.co-status-pill--*`;
   `.col-status` on the cell is what re-enables their chrome past the table's
   strip-all-pills rule. */
function ReuploadStatusPill({ submission }: { submission: Submission }) {
  const status = reuploadStatusOf(submission);
  return (
    <span className={`co-status-pill co-status-pill--${status === "Requested" ? "grey" : "green"}`}>
      {status}
    </span>
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
