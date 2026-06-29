import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  attempts as seed,
  attemptDuration,
  ATTEMPT_QUIZ_NAMES,
  type Attempt,
} from "../data/attempts";
import { Dropdown } from "./Dropdown";
import {
  SortIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  XCircleIcon,
  PlusCircleIcon,
  CheckIcon,
} from "./icons";

const PAGE_SIZE = 50;

const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </svg>
);

type SortKey =
  | "name"
  | "email"
  | "phone"
  | "attemptNumber"
  | "status"
  | "startedAt"
  | "completedAt"
  | "duration"
  | "grade";
type SortDir = "asc" | "desc";

/** Parse the "Mon DD, YYYY · h:mm AM" stamp to a sortable epoch. */
function stampTime(s: string | null): number {
  if (!s) return 0;
  const [datePart, timePart] = s.split(" · ");
  const t = new Date(`${datePart} ${timePart}`).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function durationMinutes(a: Attempt): number {
  if (!a.completedAt) return -1;
  return Math.round((stampTime(a.completedAt) - stampTime(a.startedAt)) / 60000);
}

type Filters = {
  name: string;
  email: string;
  phone: string;
  quiz: string | null;
};

export function AttemptsPage({
  quizName,
  onBack,
  onViewAttempt,
}: {
  /** The Task selected on the Tasks page — pre-fills the Quiz filter. */
  quizName: string;
  onBack: () => void;
  onViewAttempt: (attempt: Attempt) => void;
}) {
  const [list, setList] = useState<Attempt[]>(seed);
  const [filters, setFilters] = useState<Filters>({
    name: "",
    email: "",
    phone: "",
    quiz: quizName,
  });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "startedAt",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ attempt: Attempt; rect: DOMRect } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fn = filters.name.trim().toLowerCase();
    const fe = filters.email.trim().toLowerCase();
    const fp = filters.phone.replace(/\D/g, "");
    return list.filter((a) => {
      if (filters.quiz && a.quizName !== filters.quiz) return false;
      if (fn && !a.name.toLowerCase().includes(fn)) return false;
      if (fe && !a.email.toLowerCase().includes(fe)) return false;
      if (fp && !a.phone.replace(/\D/g, "").includes(fp)) return false;
      if (q && !(
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        a.quizName.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [list, filters, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "name": return a.name.localeCompare(b.name);
        case "email": return a.email.localeCompare(b.email);
        case "phone": return a.phone.localeCompare(b.phone);
        case "attemptNumber": return a.attemptNumber - b.attemptNumber;
        case "status": return a.status.localeCompare(b.status);
        case "startedAt": return stampTime(a.startedAt) - stampTime(b.startedAt);
        case "completedAt": return stampTime(a.completedAt) - stampTime(b.completedAt);
        case "duration": return durationMinutes(a) - durationMinutes(b);
        case "grade": return (a.grade ?? -1) - (b.grade ?? -1);
      }
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [filters, search, sort]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function deleteAttempt(a: Attempt) {
    const ok = window.confirm(
      `Delete ${a.name}’s attempt #${a.attemptNumber} on “${a.quizName}”? This can’t be undone.`,
    );
    if (!ok) return;
    setList((prev) => prev.filter((x) => x.id !== a.id));
  }

  const hasFilters =
    !!filters.name || !!filters.email || !!filters.phone || !!filters.quiz;

  function clearFilters() {
    setFilters({ name: "", email: "", phone: "", quiz: null });
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <button className="attempts-back" onClick={onBack}>
                <ChevronLeftIcon />
                Tasks
              </button>
              <h1 className="tasks-title">Attempts</h1>
              <div className="tasks-subtitle">
                <span>{filtered.length} attempt{filtered.length === 1 ? "" : "s"}</span>
                {filters.quiz && (
                  <>
                    <span className="tasks-subtitle-dot" />
                    <span>{filters.quiz}</span>
                  </>
                )}
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <div className="search-wrap">
                  <span className="search-icon"><SearchIcon /></span>
                  <input
                    className="search-input"
                    placeholder="Search by name, email, or phone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
                </div>
              </div>

              <div className="filters">
                <TextFilterPill
                  label="Name"
                  value={filters.name}
                  placeholder="Filter by name…"
                  onApply={(v) => setFilters((f) => ({ ...f, name: v }))}
                />
                <TextFilterPill
                  label="Email"
                  value={filters.email}
                  placeholder="Filter by email…"
                  onApply={(v) => setFilters((f) => ({ ...f, email: v }))}
                />
                <TextFilterPill
                  label="Phone Number"
                  value={filters.phone}
                  placeholder="Filter by phone…"
                  onApply={(v) => setFilters((f) => ({ ...f, phone: v }))}
                />
                <QuizFilterPill
                  value={filters.quiz}
                  options={ATTEMPT_QUIZ_NAMES}
                  onApply={(v) => setFilters((f) => ({ ...f, quiz: v }))}
                />
                {hasFilters && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="attempts-scroll">
                <table className="table attempts-table" style={{ width: 1610 }}>
                  <colgroup>
                    <col style={{ width: 170 }} />
                    <col style={{ width: 210 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 210 }} />
                    <col style={{ width: 210 }} />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 40 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader col="name" label="Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="email" label="Email" sort={sort} toggle={toggleSort} sortable={false} />
                      <SortableHeader col="phone" label="Phone Number" sort={sort} toggle={toggleSort} sortable={false} />
                      <SortableHeader col="attemptNumber" label="Attempt" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="status" label="Status" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="startedAt" label="Started" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="completedAt" label="Completed" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="duration" label="Duration" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="grade" label="Grade" sort={sort} toggle={toggleSort} />
                      <th className="att-col-view" />
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((a) => (
                      <AttemptRow
                        key={a.id}
                        attempt={a}
                        onView={() => onViewAttempt(a)}
                        onOpenMenu={(rect) => setMenu({ attempt: a, rect })}
                      />
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={11} className="u-empty">
                          {hasFilters || search.trim()
                            ? "No attempts match these filters."
                            : "No attempts yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>
                  Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <AttemptActionsMenu
          attempt={menu.attempt}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onDelete={() => deleteAttempt(menu.attempt)}
        />
      )}
    </div>
  );
}

function AttemptRow({
  attempt: a,
  onView,
  onOpenMenu,
}: {
  attempt: Attempt;
  onView: () => void;
  onOpenMenu: (rect: DOMRect) => void;
}) {
  const completed = a.status === "Completed";
  return (
    <tr>
      <td className="att-col-name">{a.name}</td>
      <td className="att-col-email">{a.email}</td>
      <td className="att-col-phone">{a.phone}</td>
      <td className="att-col-attempt">#{a.attemptNumber}</td>
      <td className="att-col-status">
        <span className={`att-status ${completed ? "att-status--done" : "att-status--progress"}`}>
          <span className="att-status-dot" />
          {a.status}
        </span>
      </td>
      <td className="att-col-date">{a.startedAt}</td>
      <td className="att-col-date">{a.completedAt ?? "—"}</td>
      <td className="att-col-duration">{attemptDuration(a)}</td>
      <td className="att-col-grade">
        {a.grade === null ? (
          <span className="att-grade-empty">—</span>
        ) : (
          <span className="att-grade">
            <span className="att-grade-track">
              <span
                className={`att-grade-fill ${a.grade >= 70 ? "pass" : "fail"}`}
                style={{ width: `${a.grade}%` }}
              />
            </span>
            <span className="att-grade-num">{a.grade}%</span>
          </span>
        )}
      </td>
      <td className="att-col-view">
        <button
          className="att-view-btn"
          onClick={(e) => { e.stopPropagation(); onView(); }}
        >
          View Attempt
        </button>
      </td>
      <td className="col-actions">
        <button
          className="row-action-btn att-dots"
          aria-label="More"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        >
          <MoreIcon />
        </button>
      </td>
    </tr>
  );
}

/* ─────────────── Three-dot row actions menu ─────────────── */

function AttemptActionsMenu({
  attempt: a,
  rect,
  onClose,
  onDelete,
}: {
  attempt: Attempt;
  rect: DOMRect;
  onClose: () => void;
  onDelete: () => void;
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
    function onScroll() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        left: pos ? pos.left : rect.right - 210,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{a.name}</div>
        <div className="u-menu-head-id">Attempt #{a.attemptNumber} · {a.quizName}</div>
      </div>
      <div className="u-menu-divider" />
      <button
        className="u-menu-item u-menu-item--danger"
        onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
      >
        <span className="u-menu-item-icon"><TrashIcon /></span>
        Delete Attempt
      </button>
    </div>
  );
}

/* ─────────────── Filter pills ─────────────── */

function TextFilterPill({
  label,
  value,
  placeholder,
  onApply,
}: {
  label: string;
  value: string;
  placeholder: string;
  onApply: (v: string) => void;
}) {
  return (
    <Dropdown
      width={260}
      trigger={({ open, toggle }) =>
        value ? (
          <span className={`filter-applied ${open ? "open" : ""}`}>
            <button className="filter-applied-clear" aria-label={`Clear ${label}`} onClick={() => onApply("")}>
              <XCircleIcon />
            </button>
            <button className="filter-applied-main" onClick={toggle}>
              <span className="label">{label}</span>
              <span className="sep" />
              <span className="value">{value}</span>
              <span className="caret"><ChevronDownIcon /></span>
            </button>
          </span>
        ) : (
          <button className={`filter-pill-dashed ${open ? "open" : ""}`} onClick={toggle}>
            <span className="icon"><PlusCircleIcon /></span>
            {label}
          </button>
        )
      }
    >
      {({ close }) => (
        <TextFilterBody
          value={value}
          placeholder={placeholder}
          onApply={(v) => { onApply(v); close(); }}
        />
      )}
    </Dropdown>
  );
}

function TextFilterBody({
  value,
  placeholder,
  onApply,
}: {
  value: string;
  placeholder: string;
  onApply: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="att-filter-body">
      <input
        ref={inputRef}
        className="att-filter-input"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onApply(draft.trim()); }}
      />
      <div className="dropdown-footer">
        <button className="btn-apply" onClick={() => onApply(draft.trim())}>Apply</button>
      </div>
    </div>
  );
}

function QuizFilterPill({
  value,
  options,
  onApply,
}: {
  value: string | null;
  options: string[];
  onApply: (v: string | null) => void;
}) {
  return (
    <Dropdown
      width={300}
      trigger={({ open, toggle }) =>
        value ? (
          <span className={`filter-applied ${open ? "open" : ""}`}>
            <button className="filter-applied-clear" aria-label="Clear Quiz Name" onClick={() => onApply(null)}>
              <XCircleIcon />
            </button>
            <button className="filter-applied-main" onClick={toggle}>
              <span className="label">Quiz Name</span>
              <span className="sep" />
              <span className="value">{value}</span>
              <span className="caret"><ChevronDownIcon /></span>
            </button>
          </span>
        ) : (
          <button className={`filter-pill-dashed ${open ? "open" : ""}`} onClick={toggle}>
            <span className="icon"><PlusCircleIcon /></span>
            Quiz Name
          </button>
        )
      }
    >
      {({ close }) => (
        <QuizFilterBody
          value={value}
          options={options}
          onApply={(v) => { onApply(v); close(); }}
        />
      )}
    </Dropdown>
  );
}

function QuizFilterBody({
  value,
  options,
  onApply,
}: {
  value: string | null;
  options: string[];
  onApply: (v: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);
  return (
    <>
      <div className="dropdown-search">
        <span className="dropdown-search-icon"><SearchIcon /></span>
        <input
          placeholder="Search quizzes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <div className="dropdown-list">
        <div className="dropdown-section">
          {results.length === 0 && <div className="cols-empty">No quizzes match.</div>}
          {results.map((o) => (
            <button key={o} className="dropdown-item cols-row" onClick={() => onApply(o)}>
              <span className={`checkbox att-radio ${value === o ? "checked" : ""}`}>
                {value === o && <CheckIcon />}
              </span>
              <span className="cols-row-label">{o}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function SortableHeader({
  col,
  label,
  sort,
  toggle,
  sortable = true,
}: {
  col: SortKey;
  label: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
}) {
  if (!sortable) {
    return (
      <th className={`att-col-${col} no-sort`.trim()}>
        <span className="th-content">{label}</span>
      </th>
    );
  }
  const active = sort.key === col;
  return (
    <th className={`att-col-${col}`} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
