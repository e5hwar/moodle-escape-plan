import { useMemo, useState, useRef, useEffect } from "react";
import {
  submissions as seedSubmissions,
  ALL_EXAMS,
  type Submission,
} from "../data/proctoring";
import { ProctoringDetailModal } from "./ProctoringDetailModal";
import { SearchIcon, ChevronDownIcon, CheckIcon } from "./icons";

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

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

export function ProctoringPage() {
  const [list] = useState<Submission[]>(seedSubmissions);
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

  const counts = useMemo(() => {
    return {
      all: list.length,
      proctoring: list.filter((s) => s.kind === "proctoring").length,
      "id-review": list.filter((s) => s.kind === "id-review").length,
      "id-reupload": list.filter((s) => s.kind === "id-reupload").length,
    };
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      if (filter !== "all" && s.kind !== filter) return false;
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
                <div className="pr-th pr-col-candidate">CANDIDATE</div>
                <div className="pr-th pr-col-exam">EXAM</div>
                <div className="pr-th pr-col-grade">GRADE</div>
                <div className="pr-th pr-col-date">SUBMITTED ON</div>
                <div className="pr-th pr-col-review">REVIEW</div>
              </div>
              <div className="pr-tbody">
                {filtered.length === 0 ? (
                  <div className="pr-empty">
                    No submissions match your filters.
                  </div>
                ) : (
                  filtered.map((s) => (
                    <div
                      key={s.id}
                      className="pr-row"
                      onClick={() => openSubmission(s.id)}
                    >
                      <div className="pr-col-candidate">
                        <div className="pr-candidate-name">
                          {s.candidateName}
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
                          className="pr-view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSubmission(s.id);
                          }}
                        >
                          <EyeIcon />
                          <span>View</span>
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

      {active && (
        <ProctoringDetailModal
          submission={active}
          onClose={closeModal}
          onPrev={() => gotoIndex(activeIndex - 1)}
          onNext={() => gotoIndex(activeIndex + 1)}
          hasPrev={activeIndex > 0}
          hasNext={activeIndex < filtered.length - 1}
        />
      )}
    </div>
  );
}
