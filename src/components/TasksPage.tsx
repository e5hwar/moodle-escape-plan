import { useEffect, useMemo, useState } from "react";
import { tasks as allTasks, type Task } from "../data/tasks";
import { RotaryDialPreview } from "./RotaryDialPreview";
import { Filters, type FilterState, type ColumnState } from "./Filters";
import { SearchIcon, SortIcon } from "./icons";

const PAGE_SIZE = 50;

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

type SortKey =
  | "id"
  | "name"
  | "type"
  | "usedIn"
  | "createdBy"
  | "tags"
  | "dateCreated"
  | "dateModified";
type SortDir = "asc" | "desc";

function compare(a: Task, b: Task, key: SortKey): number {
  switch (key) {
    case "id":
      return a.id.localeCompare(b.id);
    case "name":
      return a.name.localeCompare(b.name);
    case "type":
      return a.type.localeCompare(b.type);
    case "usedIn":
      return (a.usedIn[0] ?? "").localeCompare(b.usedIn[0] ?? "");
    case "createdBy":
      return a.createdBy.localeCompare(b.createdBy);
    case "tags":
      return (a.tags?.[0] ?? "").localeCompare(b.tags?.[0] ?? "");
    case "dateCreated":
      return (Date.parse(a.dateCreated ?? "") || 0) - (Date.parse(b.dateCreated ?? "") || 0);
    case "dateModified":
      return (Date.parse(a.dateModified ?? "") || 0) - (Date.parse(b.dateModified ?? "") || 0);
  }
}

export function TasksPage() {
  const [selectedId, setSelectedId] = useState<string | null>("T-1432");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    creators: ["SkillCat"],
    certifications: [],
    types: [],
    visibilities: [],
    tags: [],
  });
  const [columns, setColumns] = useState<ColumnState>({
    tags: false,
    dateCreated: false,
    dateModified: false,
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "id",
    dir: "desc",
  });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (q && !(
        t.id.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
      )) return false;
      if (filters.creators.length && !filters.creators.includes(t.createdBy)) return false;
      if (filters.certifications.length && !t.usedIn.some((c) => filters.certifications.includes(c))) return false;
      if (filters.types.length && !filters.types.includes(t.type)) return false;
      if (filters.tags.length && !(t.tags ?? []).some((tag) => filters.tags.includes(tag))) return false;
      return true;
    });
  }, [query, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, filters, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);
  const selected = sorted.find((t) => t.id === selectedId) ?? null;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  return (
    <div className="tasks">
      <header className="tasks-header">
        <div>
          <h1 className="tasks-title">Tasks</h1>
        </div>
      </header>

      <div className="tasks-row">
        <div className="tasks-content">
          <div className="search-wrap">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input"
              placeholder="Search Tasks by name, ID, or content…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
          </div>

          <Filters
            filters={filters}
            setFilters={setFilters}
            columns={columns}
            setColumns={setColumns}
          />

          <table className="table table-head">
            <ColGroup columns={columns} />
            <thead>
              <tr>
                <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />
                <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                <SortableHeader col="type" label="Type" className="col-type" sort={sort} toggle={toggleSort} />
                <SortableHeader col="usedIn" label="Used in" className="col-used" sort={sort} toggle={toggleSort} />
                <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} />
                {columns.tags && (
                  <SortableHeader col="tags" label="Tags" className="col-tags" sort={sort} toggle={toggleSort} />
                )}
                {columns.dateCreated && (
                  <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />
                )}
                {columns.dateModified && (
                  <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />
                )}
                <th className="col-actions" />
              </tr>
            </thead>
          </table>

          <div className="tasks-scroll">
            <table className="table table-body">
              <ColGroup columns={columns} />
              <tbody>
                {paged.map((task) => (
                  <TableRow
                    key={task.id}
                    task={task}
                    selected={task.id === selectedId}
                    columns={columns}
                    onClick={() => setSelectedId(task.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>
              Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={visiblePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹ Prev
              </button>
              <button
                className="page-btn"
                disabled={visiblePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next ›
              </button>
            </div>
          </div>
        </div>

        {selected && <RotaryDialPreview task={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

function ColGroup({ columns }: { columns: ColumnState }) {
  return (
    <colgroup>
      <col style={{ width: 100 }} />
      <col />
      <col style={{ width: 160 }} />
      <col style={{ width: 180 }} />
      <col style={{ width: 200 }} />
      {columns.tags && <col style={{ width: 200 }} />}
      {columns.dateCreated && <col style={{ width: 130 }} />}
      {columns.dateModified && <col style={{ width: 130 }} />}
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

function TableRow({
  task,
  selected,
  columns,
  onClick,
}: {
  task: Task;
  selected: boolean;
  columns: ColumnState;
  onClick: () => void;
}) {
  return (
    <tr
      className={`${selected ? "selected" : ""} ${task.draft ? "draft" : ""}`}
      onClick={onClick}
    >
      <td className="col-id">{task.id}</td>
      <td className="col-name">{task.name}</td>
      <td className="col-type">{task.type}</td>
      <td className="col-used">
        {task.usedIn.length === 0 ? (
          "—"
        ) : (
          <>
            {task.usedIn[0]}
            {task.usedIn.length > 1 && (
              <span className="used-extra">+{task.usedIn.length - 1}</span>
            )}
          </>
        )}
      </td>
      <td className="col-creator">{task.createdBy}</td>
      {columns.tags && (
        <td className="col-tags">
          {task.tags && task.tags.length > 0 ? (
            <span className="tag-row">
              {task.tags.slice(0, 2).map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
              {task.tags.length > 2 && (
                <span className="used-extra">+{task.tags.length - 2}</span>
              )}
            </span>
          ) : (
            "—"
          )}
        </td>
      )}
      {columns.dateCreated && <td className="col-date">{task.dateCreated ?? "—"}</td>}
      {columns.dateModified && <td className="col-date">{task.dateModified ?? "—"}</td>}
      <td className="col-actions">
        <button className="row-action-btn lone-dots" aria-label="More" onClick={(e) => e.stopPropagation()}>
          <MoreIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Edit" onClick={(e) => e.stopPropagation()}>
            <PencilIcon />
          </button>
          <button className="row-action-btn" aria-label="Toggle visibility" onClick={(e) => e.stopPropagation()}>
            <EyeIcon />
          </button>
          <button className="row-action-btn" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <MoreIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}
