import { useMemo, useState } from "react";
import {
  submissions as seedSubmissions,
  PROCTORED_EXAMS,
  ID_ONLY_EXAMS,
  type ProctoringStatus,
  type Submission,
} from "../data/proctoring";
import { ProctoringConsole } from "./ProctoringConsole";
import { SearchIcon, RowArrowIcon, SortIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";

const ALL_EXAMS = [...PROCTORED_EXAMS, ...ID_ONLY_EXAMS];

type FilterKey = "all" | "proctoring" | "id-review" | "id-reupload";

export type SortKey = "candidate" | "exam" | "submittedAt";
export type SortDir = "asc" | "desc";

// submittedAt is a display string like "November 5th, 2025, 2:30 PM" — strip
// the ordinal suffix so Date.parse can read it.
function parseSubmittedAt(s: string): number {
  return Date.parse(s.replace(/(\d+)(st|nd|rd|th)/, "$1")) || 0;
}

function compareRows(a: Submission, b: Submission, key: SortKey): number {
  if (key === "submittedAt") return parseSubmittedAt(a.submittedAt) - parseSubmittedAt(b.submittedAt);
  const va = key === "candidate" ? a.candidateName.toLowerCase() : a.exam.toLowerCase();
  const vb = key === "candidate" ? b.candidateName.toLowerCase() : b.exam.toLowerCase();
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [examFilter, setExamFilter] = useState<string[]>([]);
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
      if (q) {
        if (
          !s.candidateName.toLowerCase().includes(q) &&
          !s.candidateEmail.toLowerCase().includes(q) &&
          !s.id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [list, filter, query, examFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

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

  function updateCandidateName(id: string, name: string) {
    setList((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, candidateName: name, idDetectedName: name } : s,
      ),
    );
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

          {/* Search — same styling as Tasks / Users / Manage IDs pages */}
          <div className="toolbar">
            <div className="usearch">
              <div className={`usearch-bar ${searchFocused ? "open" : ""}`}>
                <span className="usearch-icon">
                  <SearchIcon />
                </span>
                <input
                  className="usearch-input"
                  placeholder="Search by candidate name or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                <span className="usearch-kbd">
                  <span className="kbd-cmd">⌘</span>
                  <span className="kbd-letter">K</span>
                </span>
              </div>
            </div>
          </div>

          {/* Filters — same styling as other admin pages */}
          <div className="filters">
            <ExamPill value={examFilter} onApply={setExamFilter} />
            {examFilter.length > 0 && (
              <button className="filter-clear-link" onClick={() => setExamFilter([])}>
                Clear Filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="tasks-scroll pr-scroll">
            <div className="pr-table">
              <div className="pr-thead">
                <SortableTh col="candidate" label="Candidate" className="pr-col-candidate" sort={sort} toggle={toggleSort} />
                <SortableTh col="exam" label="Exam" className="pr-col-exam" sort={sort} toggle={toggleSort} />
                <SortableTh col="submittedAt" label="Submitted On" className="pr-col-date" sort={sort} toggle={toggleSort} />
                <div className="pr-th pr-col-review no-sort" aria-hidden />
              </div>
              <div className="pr-tbody">
                {sorted.length === 0 ? (
                  <div className="pr-empty">
                    No submissions match your filters.
                  </div>
                ) : (
                  sorted.map((s) => (
                    <div
                      key={s.id}
                      className="pr-row"
                      onClick={() => openSubmission(s.id)}
                    >
                      <div className="pr-col-candidate">
                        <div className="pr-candidate-name-row">
                          <span className="pr-candidate-name">
                            {s.candidateName}
                          </span>
                        </div>
                        <div className="pr-candidate-email">
                          {s.candidateEmail}
                        </div>
                      </div>
                      <div className="pr-col-exam pr-cell-body">{s.exam}</div>
                      <div className="pr-col-date pr-cell-body">
                        {s.submittedAt}
                      </div>
                      <div className="pr-col-review">
                        <button
                          className="row-arrow"
                          aria-label="Review submission"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSubmission(s.id);
                          }}
                        >
                          <RowArrowIcon />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableTh({
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
    <div className={`pr-th ${className}`} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </div>
  );
}

function ExamPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  return (
    <Dropdown
      width={300}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Exam"
          value={summarize(value, ALL_EXAMS)}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[
            { label: "Proctored", items: [...PROCTORED_EXAMS] },
            { label: "ID Only", items: [...ID_ONLY_EXAMS] },
          ]}
          subsectionStyle
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable
          searchPlaceholder="Search exams…"
        />
      )}
    </Dropdown>
  );
}
