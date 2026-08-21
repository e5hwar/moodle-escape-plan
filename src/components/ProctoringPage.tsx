import { useEffect, useMemo, useState } from "react";
import {
  submissions as seedSubmissions,
  matchesQuery,
  reuploadStatusOf,
  type ProctoringStatus,
  type Submission,
} from "../data/proctoring";
import { ProctoringConsole } from "./ProctoringConsole";
import { ProctoringSearch } from "./ProctoringSearch";
import { SortIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const PAGE_SIZE = 50;

type FilterKey = "all" | "proctoring" | "id-review" | "id-reupload";

export type SortKey = "candidate" | "email" | "phone" | "exam" | "submittedAt";
export type SortDir = "asc" | "desc";

// submittedAt is a display string like "November 5th, 2025, 2:30 PM" — strip
// the ordinal suffix so Date.parse can read it.
function parseSubmittedAt(s: string): number {
  return Date.parse(s.replace(/(\d+)(st|nd|rd|th)/, "$1")) || 0;
}

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

const FILTER_TITLE: Record<FilterKey, string> = {
  all: "ALL",
  proctoring: "PROCTORING",
  "id-review": "ID REVIEWS",
  "id-reupload": "ID RE-UPLOADS",
};

export function ProctoringPage({ onManageIds }: { onManageIds?: () => void }) {
  const [list, setList] = useState<Submission[]>(seedSubmissions);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  // Both filters are applied from inside the search bar — this page has no pills.
  const [examFilter, setExamFilter] = useState<string[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedAt", dir: "desc" });

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  // Once a submission is accepted/rejected it's off the review queue entirely. A
  // requested reupload doesn't count toward the stat tiles — only true "pending"
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
    const arr = [...filtered].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  /* Paging matches the Hands-On table (same PAGE_SIZE, same footer). The queue
     rarely fills a page, but the "Showing x–y of n" line is the table's standard
     footer, so it's here whatever the count is. */
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, filter, examFilter, companyFilter, sort]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  /* Status is a re-uploads-only column: it distinguishes "we've asked, the
     candidate hasn't sent it" from "sent, waiting on us". On All (and the other
     tabs) there's nothing to distinguish — only the To Review ones appear there
     — so the column would be a single repeated value, and it's dropped. */
  const showStatus = filter === "id-reupload";

  const active = activeId ? sorted.find((s) => s.id === activeId) ?? null : null;

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
  // pending/secondary state — it no longer counts toward the stat tiles, but stays
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
        <div className="tasks pr-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Proctoring & ID Review</h1>
            </div>
            <div className="tasks-header-actions">
              {/* Design system Secondary Button (Figma 73:495) — .btn-save-draft is
                  this codebase's mapping of it; .btn-secondary is an older
                  off-spec style (wrong padding, fill and type size). */}
              <button className="btn-save-draft" onClick={onManageIds}>
                View All IDs
              </button>
            </div>
          </header>

          {/* Stat cards / filter tiles */}
          <div className="pr-stats">
            {(["all", "proctoring", "id-review", "id-reupload"] as FilterKey[]).map(
              (k) => (
                <button
                  key={k}
                  className={`pr-stat ${filter === k ? "is-active" : ""}`}
                  onClick={() => setFilter(k)}
                  aria-pressed={filter === k}
                >
                  <span className="pr-stat-label">{FILTER_TITLE[k]}</span>
                  <span className="pr-stat-value">{counts[k]}</span>
                </button>
              ),
            )}
          </div>

          {/* Same shell as Hands-On Task Submissions (.tasks-row > .tasks-content):
              it gives the table the flex context that pins the pagination footer
              to the bottom of the page instead of letting it float under a short
              list. */}
          <div className="tasks-row">
            <div className="tasks-content">
              {/* Search — the Users / Hands-On Task combobox, with this page's two
                  scopes (Quiz, Company) applied from inside the bar. There is no
                  filter-pill row: the bar's chips are the applied-filter UI. */}
              <div className="toolbar">
                <ProctoringSearch
                  submissions={pending}
                  exams={examFilter}
                  onExamsChange={setExamFilter}
                  companies={companyFilter}
                  onCompaniesChange={setCompanyFilter}
                  query={query}
                  onCommit={setQuery}
                />
              </div>

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
                      <SortableHeader col="email" label="Email" className="pr-col-email" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="phone" label="Phone" className="pr-col-phone" sort={sort} toggle={toggleSort} />
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
                          <td className="pr-col-email">{s.candidateEmail}</td>
                          <td className="pr-col-phone">{s.candidatePhone}</td>
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

/* Column widths mirror the Hands-On table: an explicit width on every column
   except one left auto, which soaks up the leftover space (.table is
   fixed-layout, so an auto column can only grow past its reserved minimum).
   Email is that column — it's the one that genuinely benefits from extra room.
   Quiz is fixed at exactly what its longest value needs: "Building Science
   Principles Certificate" measures 274px, plus the cell's 2×20px padding. */
const QUIZ_WIDTH = 316;
const COL_WIDTHS = { name: 190, phone: 170, quiz: QUIZ_WIDTH, date: 265 };
/* Email absorbs all the slack, so it's the column that grows on a wide screen.
   Its reserved minimum is what it gets when there is no slack — at a 1440
   viewport the table has ~1110px and the fixed columns want 941 of it, so
   without this the column would collapse to ~169px and cut most addresses.
   Reserving 250 keeps it readable and lets the table scroll horizontally
   instead, which is what `--table-min` is for. */
const EMAIL_MIN = 250;
const TABLE_MIN =
  COL_WIDTHS.name + EMAIL_MIN + COL_WIDTHS.phone + COL_WIDTHS.quiz + COL_WIDTHS.date;

/** Wide enough for the "To Review" pill plus the cell's 2×20px padding. */
const STATUS_WIDTH = 130;

function ProctoringColGroup({ showStatus }: { showStatus: boolean }) {
  return (
    <colgroup>
      <col style={{ width: COL_WIDTHS.name }} />
      <col />
      <col style={{ width: COL_WIDTHS.phone }} />
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
