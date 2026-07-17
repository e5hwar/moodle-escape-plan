import { useMemo, useState, useRef, useEffect } from "react";
import {
  submissions as seedSubmissions,
  ALL_EXAMS,
  type ProctoringStatus,
  type Submission,
} from "../data/proctoring";
import { ProctoringDetailModal } from "./ProctoringDetailModal";
import { SearchIcon, ChevronDownIcon, CheckIcon, RowArrowIcon } from "./icons";

const FilterIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h18M6 12h12M10 19h4" />
  </svg>
);

type FilterKey = "all" | "proctoring" | "id-review" | "id-reupload";

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
  const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set());
  const [examOpen, setExamOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const examWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!examOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!examWrapRef.current) return;
      if (!examWrapRef.current.contains(e.target as Node)) setExamOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [examOpen]);

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
      if (selectedExams.size > 0 && !selectedExams.has(s.exam)) return false;
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
  }, [list, filter, query, selectedExams]);

  const activeIndex = activeId
    ? filtered.findIndex((s) => s.id === activeId)
    : -1;
  const active = activeIndex >= 0 ? filtered[activeIndex] : null;

  function toggleExam(name: string) {
    setSelectedExams((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearExams() {
    setSelectedExams(new Set());
  }

  function openSubmission(id: string) {
    setActiveId(id);
  }

  function closeModal() {
    setActiveId(null);
  }

  function gotoIndex(idx: number) {
    if (idx < 0 || idx >= filtered.length) return;
    setActiveId(filtered[idx].id);
  }

  // Decide a submission (accept/reject): it leaves the review queue entirely and
  // whichever submission was next in line (or previous, if this was the last one) opens.
  function decide(id: string, status: ProctoringStatus) {
    const idx = filtered.findIndex((s) => s.id === id);
    const next = idx >= 0 ? filtered[idx + 1] ?? filtered[idx - 1] ?? null : null;
    setList((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    setActiveId(next ? next.id : null);
  }

  // Requesting a reupload moves the submission into the ID Re-uploads tab in a
  // pending/secondary state — it no longer counts toward the stat tiles, but stays
  // visible in the table until it's accepted or rejected.
  function requestReupload(id: string) {
    const idx = filtered.findIndex((s) => s.id === id);
    const next = idx >= 0 ? filtered[idx + 1] ?? filtered[idx - 1] ?? null : null;
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

  const examLabel =
    selectedExams.size === 0
      ? "Select Exams"
      : selectedExams.size === 1
      ? Array.from(selectedExams)[0]
      : `${selectedExams.size} exams`;

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks pr-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Proctoring</h1>
              <div className="tasks-subtitle">
                <span>{counts.all} submissions awaiting review</span>
                <span className="tasks-subtitle-dot" />
                <span>Approve, reject, or request a new ID upload</span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button className="btn-secondary" onClick={onManageIds}>
                Manage IDs
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

          {/* Controls */}
          <div className="pr-controls">
            <div className="pr-search-pill">
              <span className="pr-search-pill-icon">
                <SearchIcon />
              </span>
              <input
                className="pr-search-pill-input"
                placeholder="Search by name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="pr-exam-wrap" ref={examWrapRef}>
              <button
                className={`pr-exam-pill ${examOpen ? "is-open" : ""}`}
                onClick={() => setExamOpen((v) => !v)}
              >
                <span className="pr-exam-pill-icon">
                  <FilterIcon />
                </span>
                <span className="pr-exam-pill-label">{examLabel}</span>
                {selectedExams.size > 0 && (
                  <span className="pr-exam-count">{selectedExams.size}</span>
                )}
                <span className="pr-exam-pill-caret">
                  <ChevronDownIcon />
                </span>
              </button>

              {examOpen && (
                <div className="pr-exam-dropdown">
                  <div className="pr-exam-dropdown-head">
                    <span>Filter by exam</span>
                    {selectedExams.size > 0 && (
                      <button className="pr-exam-clear" onClick={clearExams}>
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="pr-exam-dropdown-list">
                    {ALL_EXAMS.map((name) => {
                      const checked = selectedExams.has(name);
                      return (
                        <button
                          key={name}
                          className="pr-exam-option"
                          onClick={() => toggleExam(name)}
                        >
                          <span
                            className={`pr-exam-check ${checked ? "is-on" : ""}`}
                          >
                            {checked && <CheckIcon />}
                          </span>
                          <span className="pr-exam-option-label">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="tasks-scroll pr-scroll">
            <div className="pr-table">
              <div className="pr-thead">
                <div className="pr-th pr-col-candidate">Candidate</div>
                <div className="pr-th pr-col-exam">Exam</div>
                <div className="pr-th pr-col-grade">Grade</div>
                <div className="pr-th pr-col-date">Submitted On</div>
                <div className="pr-th pr-col-review" aria-hidden />
              </div>
              <div className="pr-tbody">
                {filtered.length === 0 ? (
                  <div className="pr-empty">
                    No submissions match your filters.
                  </div>
                ) : (
                  filtered.map((s) => {
                    const isRequested = s.status === "id-requested";
                    return (
                    <div
                      key={s.id}
                      className={`pr-row ${isRequested ? "pr-row--secondary" : ""}`}
                      onClick={() => openSubmission(s.id)}
                    >
                      <div className="pr-col-candidate">
                        <div className="pr-candidate-name-row">
                          <span className="pr-candidate-name">
                            {s.candidateName}
                          </span>
                          {isRequested && (
                            <span className="pr-status-pill pr-status-pill--requested">
                              Reupload Requested
                            </span>
                          )}
                        </div>
                        <div className="pr-candidate-email">
                          {s.candidateEmail}
                        </div>
                      </div>
                      <div className="pr-col-exam pr-cell-body">{s.exam}</div>
                      <div className="pr-col-grade pr-cell-body">{s.grade}</div>
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
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {active && (
        <ProctoringDetailModal
          submission={active}
          onClose={closeModal}
          onPrev={() => gotoIndex(activeIndex - 1)}
          onNext={() => gotoIndex(activeIndex + 1)}
          hasPrev={activeIndex > 0}
          hasNext={activeIndex < filtered.length - 1}
          onAccept={() => decide(active.id, "accepted")}
          onReject={() => decide(active.id, "rejected")}
          onRequestId={() => requestReupload(active.id)}
          onUpdateName={(name) => updateCandidateName(active.id, name)}
        />
      )}
    </div>
  );
}
