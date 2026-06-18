import { useEffect, useMemo, useState } from "react";
import {
  reviewSubmissions as seed,
  type TaskSubmission,
} from "../data/reviewSubmissions";
import { ReviewSearch } from "./ReviewSearch";
import { ReviewSubmissionDetail } from "./ReviewSubmissionDetail";
import { MultiPill, UsersEditColumns } from "./UsersFilters";
import { SortIcon, XCircleIcon, ChevronDownIcon } from "./icons";

const PAGE_SIZE = 50;

/* ── Columns: Name is fixed; the rest are toggleable. Task + Submitted On are
   shown by default; Email / Phone / Created By are the "additional" columns. ── */
type ColKey = "task" | "submittedOn" | "email" | "phone" | "createdBy";
type ColState = Record<ColKey, boolean>;

const DEFAULT_COLUMNS: ColState = {
  task: true,
  submittedOn: true,
  email: false,
  phone: false,
  createdBy: false,
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type ColMeta = {
  key: ColKey;
  label: string;
  className: string;
  width: number;
  render: (s: TaskSubmission) => React.ReactNode;
  sortValue: (s: TaskSubmission) => string | number;
};

const COLS: ColMeta[] = [
  { key: "task", label: "Task", className: "col-rh-task", width: 280, render: (s) => s.taskName, sortValue: (s) => s.taskName.toLowerCase() },
  { key: "submittedOn", label: "Submitted On", className: "col-rh-date", width: 150, render: (s) => formatDate(s.submittedOn), sortValue: (s) => s.submittedOn },
  { key: "email", label: "Email", className: "col-rh-email", width: 220, render: (s) => s.email, sortValue: (s) => s.email.toLowerCase() },
  { key: "phone", label: "Phone Number", className: "col-rh-phone", width: 170, render: (s) => s.phone, sortValue: (s) => s.phone },
  { key: "createdBy", label: "Created By", className: "col-rh-creator", width: 190, render: (s) => s.createdBy, sortValue: (s) => s.createdBy.toLowerCase() },
];
const COL_BY_KEY = new Map(COLS.map((c) => [c.key, c]));

// Adapter so the existing Edit-Columns dropdown (built for the Users page) can
// drive this page's column set. Only the keys present here are shown.
const EDIT_COLUMN_DEFS = [
  { key: "task", label: "Task" },
  { key: "submittedOn", label: "Submitted On" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone Number" },
  { key: "createdBy", label: "Created By" },
] as const;

type SortKey = "name" | ColKey;
type SortDir = "asc" | "desc";

export function ReviewHandsOnPage() {
  const [list, setList] = useState<TaskSubmission[]>(seed);
  const [columns, setColumns] = useState<ColState>(DEFAULT_COLUMNS);
  const [types, setTypes] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [committedQuery, setCommittedQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedOn", dir: "desc" });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const companyNames = useMemo(() => {
    const set = new Set<string>();
    list.forEach((s) => s.companyName && set.add(s.companyName));
    return [...set].sort();
  }, [list]);

  const filtered = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    return list.filter((s) => {
      if (types.length && !types.includes(s.userType)) return false;
      if (companies.length && !(s.companyName && companies.includes(s.companyName))) return false;
      if (tasks.length && !tasks.includes(s.taskName)) return false;
      if (!q) return true;
      return (
        s.userName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.taskName.toLowerCase().includes(q)
      );
    });
  }, [list, committedQuery, types, companies, tasks]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => {
      if (sort.key === "name") return a.userName.localeCompare(b.userName);
      const col = COL_BY_KEY.get(sort.key)!;
      const va = col.sortValue(a);
      const vb = col.sortValue(b);
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb));
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [committedQuery, types, companies, tasks, sort]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const visibleCols = useMemo(() => COLS.filter((c) => columns[c.key]), [columns]);
  const colSpan = visibleCols.length + 1; // name + cols

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function clearFilters() {
    setTypes([]);
    setCompanies([]);
    setTasks([]);
  }

  const open = openId ? list.find((s) => s.id === openId) : null;
  if (open) {
    return (
      <ReviewSubmissionDetail
        submission={open}
        onBack={() => setOpenId(null)}
        onSubmit={() => {
          setList((prev) => prev.filter((s) => s.id !== open.id));
          setOpenId(null);
        }}
      />
    );
  }

  const hasFilters = types.length + companies.length + tasks.length > 0;

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Review Hands-On Tasks</h1>
              <div className="tasks-subtitle">
                <span>{list.length} submissions</span>
                <span className="tasks-subtitle-dot" />
                <span>awaiting review</span>
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <ReviewSearch
                  submissions={list}
                  companies={companies}
                  onCompaniesChange={setCompanies}
                  tasks={tasks}
                  onTasksChange={setTasks}
                  query={committedQuery}
                  onCommit={setCommittedQuery}
                  onOpenSubmission={(s) => setOpenId(s.id)}
                />
              </div>

              <div className="filters">
                <MultiPill label="User Type" all={["B2C", "B2B"]} value={types} onApply={setTypes} />
                <MultiPill
                  label="Company"
                  all={companyNames}
                  value={companies}
                  onApply={setCompanies}
                  searchable
                  searchPlaceholder="Search companies…"
                  width={300}
                />
                {tasks.map((t) => (
                  <span className="filter-applied" key={t}>
                    <button
                      className="filter-applied-clear"
                      aria-label={`Clear ${t}`}
                      onClick={() => setTasks((prev) => prev.filter((x) => x !== t))}
                    >
                      <XCircleIcon />
                    </button>
                    <button className="filter-applied-main">
                      <span className="label">Task</span>
                      <span className="sep" />
                      <span className="value">{t}</span>
                      <span className="caret">
                        <ChevronDownIcon />
                      </span>
                    </button>
                  </span>
                ))}
                {hasFilters && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear filters
                  </button>
                )}
              </div>

              <table className="table table-head">
                <ColGroup cols={visibleCols} />
                <thead>
                  <tr>
                    <SortableHeader col="name" label="User Name" className="col-name" sort={sort} toggle={toggleSort} />
                    {visibleCols.map((c) => (
                      <SortableHeader key={c.key} col={c.key} label={c.label} className={c.className} sort={sort} toggle={toggleSort} />
                    ))}
                    <th className="col-actions">
                      <UsersEditColumns
                        columns={columns}
                        setColumns={setColumns}
                        fixed={[{ label: "User Name" }]}
                        optional={EDIT_COLUMN_DEFS as unknown as { key: string; label: string }[]}
                      />
                    </th>
                  </tr>
                </thead>
              </table>

              <div className="tasks-scroll">
                <table className="table table-body">
                  <ColGroup cols={visibleCols} />
                  <tbody>
                    {paged.map((s) => (
                      <tr key={s.id} onClick={() => setOpenId(s.id)}>
                        <td className="col-name">{s.userName}</td>
                        {visibleCols.map((c) => (
                          <td key={c.key} className={c.className}>
                            {c.render(s)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={colSpan} className="u-empty">
                          {committedQuery.trim()
                            ? `No submissions match "${committedQuery.trim()}".`
                            : "No submissions match these filters."}
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
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColGroup({ cols }: { cols: ColMeta[] }) {
  return (
    <colgroup>
      {/* Explicit width so the fixed-layout name column never collapses to 0
         when many optional columns are enabled. */}
      <col style={{ width: 190 }} />
      {cols.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: 48 }} />
    </colgroup>
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
  className?: string;
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
