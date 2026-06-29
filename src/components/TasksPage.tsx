import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { tasks as allTasks, discoverableLabel, finalExamLabel, isPaid, type Task, type TaskType } from "../data/tasks";
// ARCHIVED: RotaryDialPreview side panel — kept for future use; re-enable by uncommenting
// the import below and the <RotaryDialPreview /> render at the bottom of <div className="tasks-row">.
// import { RotaryDialPreview } from "./RotaryDialPreview";
import { Filters, EditColumnsButton, type FilterState, type ColumnState } from "./Filters";
import { SortIcon, PackageIcon, QuizIcon, HandsOnIcon, IdCardIcon, FileIcon, LinkIcon, GlobeIcon, AddIcon, SmallXIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { TasksSearch } from "./TasksSearch";
import type { TaskTypeKey } from "./Footer";

const TASK_TYPE_OPTIONS: { key: TaskTypeKey; label: string; icon: () => JSX.Element; shortcut: string }[] = [
  { key: "xapi", label: "xAPI / SCORM", icon: PackageIcon, shortcut: "X" },
  { key: "quiz", label: "Quiz", icon: QuizIcon, shortcut: "Q" },
  { key: "hands-on", label: "Hands-On Task", icon: HandsOnIcon, shortcut: "H" },
  { key: "id-upload", label: "ID Upload", icon: IdCardIcon, shortcut: "I" },
  { key: "file", label: "File", icon: FileIcon, shortcut: "F" },
  { key: "deep-link", label: "Deep Link", icon: LinkIcon, shortcut: "D" },
  { key: "url", label: "URL", icon: GlobeIcon, shortcut: "U" },
];

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

const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.16 2.92M6.6 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a9.3 9.3 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a2.6 2.6 0 0 0 3.7 3.7" />
    <path d="M2 2l20 20" />
  </svg>
);

const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

const ReportIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </svg>
);

const AttemptsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </svg>
);

const PayersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/** View Attempts is only meaningful for graded/launchable Task types. */
const ATTEMPTS_TYPES: TaskType[] = ["Quiz", "Hands-On Task", "xAPI"];

type SortKey =
  | "id"
  | "name"
  | "type"
  | "paid"
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
    case "paid":
      // Free (false) sorts before Paid (true).
      return Number(isPaid(a)) - Number(isPaid(b));
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

export function TasksPage({
  onNewTask,
  onEditTask,
  onViewAttempts,
  onViewPayers,
}: {
  onNewTask: (t: TaskTypeKey) => void;
  onEditTask: (task: Task) => void;
  onViewAttempts: (task: Task) => void;
  onViewPayers: (task: Task) => void;
}) {
  // Local working copy so visibility toggles and deletes persist in-session.
  const [taskList, setTaskList] = useState<Task[]>(allTasks);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [menu, setMenu] = useState<{ task: Task; rect: DOMRect } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Search bar: committedQuery only changes on Enter. The certification filter is
  // shared with the Filters row (filters.certifications) and applies on Enter.
  const [committedQuery, setCommittedQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    creators: ["SkillCat"],
    certifications: [],
    discoverable: [],
    finalExam: [],
    types: [],
    visibilities: [],
    tags: [],
  });
  const [columns, setColumns] = useState<ColumnState>({
    id: true,
    type: true,
    paid: true,
    usedIn: true,
    createdBy: true,
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
    const q = committedQuery.trim().toLowerCase();
    return taskList.filter((t) => {
      if (q && !(
        t.id.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
      )) return false;
      if (filters.creators.length && !filters.creators.includes(t.createdBy)) return false;
      if (filters.certifications.length && !t.usedIn.some((c) => filters.certifications.includes(c))) return false;
      if (filters.discoverable.length && !filters.discoverable.includes(discoverableLabel(t))) return false;
      if (filters.finalExam.length && !filters.finalExam.includes(finalExamLabel(t))) return false;
      if (filters.types.length && !filters.types.includes(t.type)) return false;
      if (filters.tags.length && !(t.tags ?? []).some((tag) => filters.tags.includes(tag))) return false;
      return true;
    });
  }, [committedQuery, filters, taskList]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [committedQuery, filters, sort]);

  // Keyboard shortcuts: "C" opens the Create Task menu; once open, each task
  // type's letter (Q, X, H, …) launches that wizard. Ignored while typing in a
  // field or with a modifier held.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (!createMenuOpen) {
        if (key === "c") {
          e.preventDefault();
          setCreateMenuOpen(true);
        }
        return;
      }
      if (e.key === "Escape") {
        setCreateMenuOpen(false);
        return;
      }
      const option = TASK_TYPE_OPTIONS.find((o) => o.shortcut.toLowerCase() === key);
      if (option) {
        e.preventDefault();
        setCreateMenuOpen(false);
        onNewTask(option.key);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [createMenuOpen, onNewTask]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const selected = selectedId ? taskList.find((t) => t.id === selectedId) ?? null : null;
  const panelOpen = selected !== null;

  // Natural table width so columns scroll horizontally instead of crushing on a
  // narrow page. Mirrors the visible columns in <ColGroup>; optional columns are
  // hidden while the side panel is open (compact mode), so they don't count then.
  const tableMin =
    240 /* name */ +
    40 /* actions */ +
    (columns.id ? 100 : 0) +
    (!panelOpen
      ? (columns.type ? 160 : 0) +
        (columns.paid ? 110 : 0) +
        (columns.usedIn ? 180 : 0) +
        (columns.createdBy ? 200 : 0) +
        (columns.tags ? 200 : 0) +
        (columns.dateCreated ? 130 : 0) +
        (columns.dateModified ? 130 : 0)
      : 0);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function toggleVisibility(task: Task) {
    // Access Restriction chains gate other content, so the Task can't be hidden
    // while it's still part of one. Unhiding is always allowed.
    if (task.accessRestricted && !task.hidden) {
      window.alert(
        `“${task.name}” is part of an Access Restriction chain and cannot be hidden ` +
          `until it is removed from that chain.`,
      );
      return;
    }
    // Hiding a Task used by multiple Certifications affects all of them — surface
    // the full list before applying.
    if (!task.hidden && task.usedIn.length > 1) {
      const ok = window.confirm(
        `“${task.name}” is used in ${task.usedIn.length} certifications:\n\n` +
          task.usedIn.map((c) => `•  ${c}`).join("\n") +
          `\n\nHiding it will affect all of them. Continue?`,
      );
      if (!ok) return;
    }
    setTaskList((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, hidden: !t.hidden } : t)),
    );
  }

  function deleteTask(task: Task) {
    const ok = window.confirm(
      `Delete “${task.name}” (${task.id})? This can’t be undone.`,
    );
    if (!ok) return;
    setTaskList((prev) => prev.filter((t) => t.id !== task.id));
    if (selectedId === task.id) setSelectedId(null);
  }

  return (
    <div className="tasks">
      <header className="tasks-header">
        <div>
          <h1 className="tasks-title">Tasks</h1>
          <div className="tasks-subtitle">
            {taskList.length} tasks · standalone &amp; certification content
          </div>
        </div>
        <div className="tasks-header-actions">
          <Dropdown
            align="right"
            width={220}
            open={createMenuOpen}
            onOpenChange={setCreateMenuOpen}
            trigger={({ toggle }) => (
              <button className="new-task" onClick={toggle}>
                <AddIcon />
                Create Task
                <span className="cta-kbd">C</span>
              </button>
            )}
          >
            {({ close }) => (
              <div className="menu">
                {TASK_TYPE_OPTIONS.map(({ key, label, icon: Icon, shortcut }) => (
                  <button
                    key={key}
                    className="menu-item"
                    onClick={() => {
                      onNewTask(key);
                      close();
                    }}
                  >
                    <span className="menu-item-icon">
                      <Icon />
                    </span>
                    {label}
                    <span className="menu-item-kbd">{shortcut}</span>
                  </button>
                ))}
              </div>
            )}
          </Dropdown>
        </div>
      </header>

      <div className="tasks-row">
        <div className="tasks-content">
          <div className="toolbar">
            <TasksSearch
              tasks={taskList}
              certifications={filters.certifications}
              onCertificationsChange={(c) => setFilters((prev) => ({ ...prev, certifications: c }))}
              types={filters.types}
              onTypesChange={(t) => setFilters((prev) => ({ ...prev, types: t }))}
              query={committedQuery}
              onCommit={setCommittedQuery}
            />
          </div>

          <Filters filters={filters} setFilters={setFilters} />

          <div className="co-table-row">
            <div className="co-table-col">
              <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
              <table className="table table-head">
                <ColGroup columns={columns} compact={panelOpen} />
                <thead>
                  <tr>
                    {columns.id && (
                      <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />
                    )}
                    <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                    {columns.type && !panelOpen && (
                      <SortableHeader col="type" label="Type" className="col-type" sort={sort} toggle={toggleSort} />
                    )}
                    {columns.paid && !panelOpen && (
                      <SortableHeader col="paid" label="Paid" className="col-type" sort={sort} toggle={toggleSort} />
                    )}
                    {columns.usedIn && !panelOpen && (
                      <SortableHeader col="usedIn" label="Used in" className="col-used" sort={sort} toggle={toggleSort} sortable={false} />
                    )}
                    {columns.createdBy && !panelOpen && (
                      <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} sortable={false} />
                    )}
                    {columns.tags && !panelOpen && (
                      <SortableHeader col="tags" label="Tags" className="col-tags" sort={sort} toggle={toggleSort} sortable={false} />
                    )}
                    {columns.dateCreated && !panelOpen && (
                      <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />
                    )}
                    {columns.dateModified && !panelOpen && (
                      <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />
                    )}
                    <th className="col-actions">
                      <EditColumnsButton columns={columns} setColumns={setColumns} />
                    </th>
                  </tr>
                </thead>
              </table>

              <div className="tasks-scroll">
                <table className="table table-body">
                  <ColGroup columns={columns} compact={panelOpen} />
                  <tbody>
                    {paged.map((task) => (
                      <TableRow
                        key={task.id}
                        task={task}
                        selected={task.id === selectedId}
                        columns={columns}
                        compact={panelOpen}
                        onClick={() => setSelectedId(task.id === selectedId ? null : task.id)}
                        onEdit={() => onEditTask(task)}
                        onToggleVisibility={() => toggleVisibility(task)}
                        onOpenMenu={(rect) => setMenu({ task, rect })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
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
                    ‹
                  </button>
                  <button
                    className="page-btn"
                    disabled={visiblePage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            {selected && (
              <TaskPanel task={selected} onClose={() => setSelectedId(null)} />
            )}
          </div>
        </div>
      </div>

      {menu && (
        <TaskActionsMenu
          task={menu.task}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onCompletionReport={() =>
            window.alert(`Opening the Completion Report for “${menu.task.name}”…`)
          }
          onViewAttempts={() => onViewAttempts(menu.task)}
          onViewPayers={() => onViewPayers(menu.task)}
          onDelete={() => deleteTask(menu.task)}
        />
      )}
    </div>
  );
}

function ColGroup({ columns, compact }: { columns: ColumnState; compact?: boolean }) {
  return (
    <colgroup>
      {columns.id && <col style={{ width: 100 }} />}
      <col style={{ width: 240 }} />
      {columns.type && !compact && <col style={{ width: 160 }} />}
      {columns.paid && !compact && <col style={{ width: 110 }} />}
      {columns.usedIn && !compact && <col style={{ width: 180 }} />}
      {columns.createdBy && !compact && <col style={{ width: 200 }} />}
      {columns.tags && !compact && <col style={{ width: 200 }} />}
      {columns.dateCreated && !compact && <col style={{ width: 130 }} />}
      {columns.dateModified && !compact && <col style={{ width: 130 }} />}
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function SortableHeader({
  col,
  label,
  className,
  sort,
  toggle,
  sortable = true,
}: {
  col: SortKey;
  label: string;
  className?: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
}) {
  if (!sortable) {
    return (
      <th className={`${className ?? ""} no-sort`.trim()}>
        <span className="th-content">{label}</span>
      </th>
    );
  }
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
  compact,
  onClick,
  onEdit,
  onToggleVisibility,
  onOpenMenu,
}: {
  task: Task;
  selected: boolean;
  columns: ColumnState;
  compact?: boolean;
  onClick: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onOpenMenu: (rect: DOMRect) => void;
}) {
  return (
    <tr
      className={`${selected ? "selected" : ""} ${task.draft ? "draft" : ""} ${task.hidden ? "task-hidden" : ""}`}
      onClick={onClick}
    >
      {columns.id && <td className="col-id">{task.id}</td>}
      <td className="col-name">
        {task.name}
        {task.hidden && <span className="hidden-badge">Hidden</span>}
      </td>
      {columns.type && !compact && <td className="col-type">{task.type}</td>}
      {columns.paid && !compact && (
        <td className="col-type">
          {isPaid(task) ? (
            <span className="pay-badge pay-badge--paid">Paid</span>
          ) : (
            <span className="pay-badge pay-badge--free">Free</span>
          )}
        </td>
      )}
      {columns.usedIn && !compact && (
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
      )}
      {columns.createdBy && !compact && <td className="col-creator">{task.createdBy}</td>}
      {columns.tags && !compact && (
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
      {columns.dateCreated && !compact && <td className="col-date">{task.dateCreated ?? "—"}</td>}
      {columns.dateModified && !compact && <td className="col-date">{task.dateModified ?? "—"}</td>}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        >
          <MoreIcon />
        </button>
        <div className="row-action-bar">
          <button
            className="row-action-btn"
            aria-label="Edit"
            title="Edit task"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <PencilIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label={task.hidden ? "Make visible" : "Hide task"}
            title={task.hidden ? "Make visible" : "Hide task"}
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          >
            {task.hidden ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
          >
            <MoreIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────── Three-dot row actions menu ─────────────── */
/* Fixed-positioned so it escapes the table's scroll container. */

function TaskActionsMenu({
  task,
  rect,
  onClose,
  onCompletionReport,
  onViewAttempts,
  onViewPayers,
  onDelete,
}: {
  task: Task;
  rect: DOMRect;
  onClose: () => void;
  onCompletionReport: () => void;
  onViewAttempts: () => void;
  onViewPayers: () => void;
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
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    setPos({ top, left });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() {
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const showAttempts = ATTEMPTS_TYPES.includes(task.type);

  const item = (
    icon: JSX.Element,
    label: string,
    onPick: () => void,
    danger = false,
  ) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      {label}
    </button>
  );

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        left: pos ? pos.left : rect.right - 210,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{task.name}</div>
        <div className="u-menu-head-id">{task.id} · {task.type}</div>
      </div>
      <div className="u-menu-divider" />
      {item(<ReportIcon />, "Open Completion Report", onCompletionReport)}
      {showAttempts && item(<AttemptsIcon />, "View Attempts", onViewAttempts)}
      {/* Only paid Tasks have payers to view. */}
      {isPaid(task) && item(<PayersIcon />, "View who paid", onViewPayers)}
      <div className="u-menu-divider" />
      {item(<TrashIcon />, "Delete", onDelete, true)}
    </div>
  );
}

/* ─────────────── Task preview side panel ─────────────── */

const TYPE_ICON: Record<TaskType, () => JSX.Element> = {
  xAPI: PackageIcon,
  Quiz: QuizIcon,
  "Hands-On Task": HandsOnIcon,
  "ID Upload": IdCardIcon,
  File: FileIcon,
  URL: GlobeIcon,
};

function TaskPanel({ task, onClose }: { task: Task; onClose: () => void }) {
  const TypeIcon = TYPE_ICON[task.type] ?? FileIcon;

  const detail = (label: string, value: React.ReactNode) => (
    <div className="co-dt-item">
      <div className="co-dt-label">{label}</div>
      <div className="co-dt-value">{value}</div>
    </div>
  );

  return (
    <aside className="co-panel">
      <div className="co-panel-head">
        <div className="co-drawer-title-row">
          <div className="co-drawer-avatar"><TypeIcon /></div>
          <div className="co-drawer-titles">
            <div className="co-drawer-name">{task.name}</div>
            <div className="co-drawer-id">{task.id} · {task.type}</div>
          </div>
        </div>
        <button className="co-drawer-close" aria-label="Close" onClick={onClose}>
          <SmallXIcon />
        </button>
      </div>

      <div className="co-panel-pills">
        <span className="co-pill-muted">{task.type}</span>
        {task.draft ? (
          <span className="co-pill-muted">Draft</span>
        ) : (
          <span className="co-pill-muted">{task.visibility ?? "Visible · published"}</span>
        )}
        <span className="co-pill-muted">{task.createdBy}</span>
      </div>

      <div className="co-panel-body">
        {task.description && <p className="task-panel-desc">{task.description}</p>}

        <div className="co-detail-grid">
          {detail("Created by", task.createdBy)}
          {detail("Type", task.type)}
          {detail("Date created", task.dateCreated ?? "—")}
          {detail("Date modified", task.dateModified ?? "—")}
          {detail("Time to complete", task.timeToComplete ?? "—")}
          {detail("Submissions", task.submissions ?? "—")}
        </div>

        <div className="co-section-title" style={{ marginTop: 18, marginBottom: 10 }}>
          Used in
          <span className="co-section-meta">{task.usedIn.length} certification{task.usedIn.length === 1 ? "" : "s"}</span>
        </div>
        {task.usedIn.length === 0 ? (
          <div className="co-dt-value">Not used in any certification yet.</div>
        ) : (
          <div className="task-panel-chips">
            {task.usedIn.map((c) => (
              <span className="task-panel-chip" key={c}>{c}</span>
            ))}
          </div>
        )}

        {task.tags && task.tags.length > 0 && (
          <>
            <div className="co-section-title" style={{ marginTop: 18, marginBottom: 10 }}>Tags</div>
            <div className="task-panel-chips">
              {task.tags.map((t) => (
                <span className="task-panel-chip" key={t}>{t}</span>
              ))}
            </div>
          </>
        )}

        {task.requirements && (
          <>
            <div className="co-section-title" style={{ marginTop: 18, marginBottom: 10 }}>Requirements</div>
            <p className="task-panel-desc">{task.requirements}</p>
          </>
        )}
      </div>
    </aside>
  );
}
