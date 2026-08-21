import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { tasks as allTasks, discoverableLabel, finalExamLabel, isPaid, type Task, type TaskType } from "../data/tasks";
// ARCHIVED: RotaryDialPreview side panel — kept for future use; re-enable by uncommenting
// the import below and the <RotaryDialPreview /> render at the bottom of <div className="tasks-row">.
// import { RotaryDialPreview } from "./RotaryDialPreview";
import {
  Filters,
  EditColumnsButton,
  useColumnOrder,
  orderedColumns,
  type FilterState,
  type ColumnState,
} from "./Filters";
import type { OptionalColumn } from "../data/filters";
import { pickTag, pickTags, TRADE_TAGS, PARTNERSHIP_TAGS, USER_TYPE_TAGS } from "../data/filters";
import { SortIcon, PackageIcon, QuizIcon, HandsOnIcon, FileIcon, AddIcon, SmallXIcon, RowEditIcon, RowEyeIcon, RowEyeOffIcon, RowKebabIcon, RowDeleteIcon, MenuPlaceholderIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { TasksSearch } from "./TasksSearch";
import type { TaskTypeKey } from "./Footer";
import { useLandingMorph } from "../hooks/useLandingMorph";
import { LandingFilterRow, LandingOverlay, BackToSearch, topValues, type LandingCol, type LandingPill, type LandingRow } from "./LandingMorph";

/* Landing-morph columns — mirror the table's default visible columns (key,
   label, width) so the p=1 hand-off to the real table lines up. */
const LM_COLS: LandingCol[] = [
  { key: "id", label: "ID", width: 100 },
  { key: "type", label: "Type", width: 160, fixed: true },
  { key: "paid", label: "Paid", width: 110 },
  { key: "used", label: "Used in", width: 180 },
  { key: "creator", label: "Created By", width: 200 },
];

const TASK_TYPE_OPTIONS: { key: TaskTypeKey; label: string; icon: () => JSX.Element; shortcut: string }[] = [
  { key: "xapi", label: "xAPI / SCORM", icon: PackageIcon, shortcut: "X" },
  { key: "quiz", label: "Quiz", icon: QuizIcon, shortcut: "Q" },
  { key: "hands-on", label: "Hands-On Task", icon: HandsOnIcon, shortcut: "H" },
  { key: "file", label: "Resource", icon: FileIcon, shortcut: "F" },
];

const PAGE_SIZE = 50;

/** View Attempts is only meaningful for graded/launchable Task types. */
const ATTEMPTS_TYPES: TaskType[] = ["Quiz", "Hands-On Task", "xAPI"];

type SortKey =
  | "id"
  | "name"
  | "type"
  | "paid"
  | "usedIn"
  | "createdBy"
  | "tradeTag"
  | "partnershipTag"
  | "userTypeTag"
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
    case "tradeTag":
      return (pickTag(a.tags, TRADE_TAGS) ?? "").localeCompare(pickTag(b.tags, TRADE_TAGS) ?? "");
    case "partnershipTag":
      return (pickTag(a.tags, PARTNERSHIP_TAGS) ?? "").localeCompare(pickTag(b.tags, PARTNERSHIP_TAGS) ?? "");
    case "userTypeTag":
      return (pickTag(a.tags, USER_TYPE_TAGS) ?? "").localeCompare(pickTag(b.tags, USER_TYPE_TAGS) ?? "");
    case "dateCreated":
      return (Date.parse(a.dateCreated ?? "") || 0) - (Date.parse(b.dateCreated ?? "") || 0);
    case "dateModified":
      return (Date.parse(a.dateModified ?? "") || 0) - (Date.parse(b.dateModified ?? "") || 0);
  }
}


/* ─────────── Column registry ───────────
   One entry per optional column: width, cell class, sortability, and how the
   cell renders. The table walks `orderedColumns(...)` so dragging a row in the
   Edit Columns menu moves the real column. `keepCompact` marks the columns that
   survive the side-panel's compact mode. */
type TaskColMeta = {
  key: OptionalColumn;
  label: string;
  className: string;
  width: number;
  sortable?: boolean;
  keepCompact?: boolean;
  tip?: (t: Task) => string | undefined;
  render: (t: Task) => React.ReactNode;
};

const TASK_COLS: TaskColMeta[] = [
  { key: "id", label: "ID", className: "col-id", width: 100, keepCompact: true, render: (t) => t.id },
  { key: "type", label: "Type", className: "col-type", width: 160, render: (t) => t.type },
  {
    key: "paid", label: "Paid", className: "col-type", width: 110,
    render: (t) =>
      isPaid(t) ? (
        <span className="pay-badge pay-badge--paid">Paid</span>
      ) : (
        <span className="pay-badge pay-badge--free">Free</span>
      ),
  },
  {
    key: "usedIn", label: "Used in", className: "col-used", width: 180, sortable: false,
    tip: (t) => (t.usedIn.length ? t.usedIn.join("\n") : undefined),
    render: (t) =>
      t.usedIn.length === 0 ? (
        "—"
      ) : (
        <>
          {t.usedIn[0]}
          {t.usedIn.length > 1 && <span className="used-extra">+{t.usedIn.length - 1}</span>}
        </>
      ),
  },
  {
    key: "createdBy", label: "Created By", className: "col-creator", width: 200, sortable: false,
    tip: (t) => t.createdBy, render: (t) => t.createdBy,
  },
  {
    key: "tradeTag", label: "Trade Tag", className: "col-tags", width: 210, sortable: false,
    tip: (t) => tagTip(pickTags(t.tags, TRADE_TAGS)), render: (t) => <TagText tags={pickTags(t.tags, TRADE_TAGS)} />,
  },
  {
    key: "partnershipTag", label: "Partnership Tag", className: "col-tags", width: 160, sortable: false,
    tip: (t) => tagTip(pickTags(t.tags, PARTNERSHIP_TAGS)),
    render: (t) => <TagText tags={pickTags(t.tags, PARTNERSHIP_TAGS)} />,
  },
  {
    key: "userTypeTag", label: "User Type Tag", className: "col-tags", width: 150, sortable: false,
    render: (t) => pickTag(t.tags, USER_TYPE_TAGS) ?? "—",
  },
  { key: "dateCreated", label: "Date Created", className: "col-date", width: 130, render: (t) => t.dateCreated ?? "—" },
  { key: "dateModified", label: "Date Modified", className: "col-date", width: 130, render: (t) => t.dateModified ?? "—" },
];

function tagTip(tags: string[]): string | undefined {
  return tags.length ? tags.join("\n") : undefined;
}

function TagText({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <>—</>;
  return (
    <>
      {tags[0]}
      {tags.length > 1 && <span className="used-extra">+{tags.length - 1}</span>}
    </>
  );
}

export function TasksPage({
  onNewTask,
  onEditTask,
  onOpenCompanyDashboard,
  onViewAttempts,
  onViewPayers,
}: {
  onNewTask: (t: TaskTypeKey) => void;
  onEditTask: (task: Task) => void;
  onOpenCompanyDashboard: (companyName: string) => void;
  onViewAttempts: (task: Task) => void;
  onViewPayers: (task: Task) => void;
}) {
  // Local working copy so visibility toggles and deletes persist in-session.
  const [taskList, setTaskList] = useState<Task[]>(allTasks);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [menu, setMenu] = useState<{ task: Task; rect: DOMRect } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Set when someone tries to edit a Task owned by a company — company Tasks are
  // managed from the B2B Dashboard, not here.
  const [blockedEdit, setBlockedEdit] = useState<Task | null>(null);
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
    tradeTag: false,
    partnershipTag: false,
    userTypeTag: false,
    dateCreated: false,
    dateModified: false,
  });
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useColumnOrder(TASK_COLS);
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

  // Landing morph — the page opens as the search-first landing and the wheel
  // (or any search / pill / row interaction) morphs it into the table view.
  const morph = useLandingMorph();

  const topCert = useMemo(() => topValues(taskList, (t) => t.usedIn)[0], [taskList]);

  const suggestedPills: LandingPill[] = [
    {
      key: "hands-on",
      label: "Hands-On Task",
      onPick: () => {
        setFilters((prev) => ({ ...prev, types: Array.from(new Set([...prev.types, "Hands-On Task"])) }));
        morph.showTable();
      },
    },
    {
      key: "quiz",
      label: "Quiz",
      onPick: () => {
        setFilters((prev) => ({ ...prev, types: Array.from(new Set([...prev.types, "Quiz"])) }));
        morph.showTable();
      },
    },
    {
      key: "final-exam",
      label: "Final Exam",
      onPick: () => {
        setFilters((prev) => ({ ...prev, finalExam: ["Final Exam"] }));
        morph.showTable();
      },
    },
    ...(topCert
      ? [{
          key: "top-cert",
          label: topCert,
          onPick: () => {
            setFilters((prev) => ({ ...prev, certifications: Array.from(new Set([...prev.certifications, topCert])) }));
            morph.showTable();
          },
        }]
      : []),
  ];

  const landingRows: LandingRow[] = sorted.slice(0, 24).map((t) => ({
    key: t.id,
    name: t.name,
    dim: t.hidden || t.usedIn.length === 0,
    cells: {
      id: t.id,
      type: t.type,
      paid: isPaid(t) ? "Paid" : "Free",
      used:
        t.usedIn.length === 0
          ? "—"
          : t.usedIn.length === 1
            ? t.usedIn[0]
            : `${t.usedIn[0]} +${t.usedIn.length - 1}`,
      creator: t.createdBy,
    },
  }));

  const selected = selectedId ? taskList.find((t) => t.id === selectedId) ?? null : null;
  const panelOpen = selected !== null;

  // Column display order — reordered by dragging in the Edit Columns menu.
  // The side panel's compact mode drops every column that isn't `keepCompact`.
  const visibleCols = useMemo(
    () => orderedColumns(TASK_COLS, order, columns).filter((c) => !panelOpen || c.keepCompact),
    [columns, order, panelOpen],
  );

  // Natural table width so columns scroll horizontally instead of crushing on a
  // narrow page. Mirrors the visible columns in <ColGroup>; optional columns are
  // hidden while the side panel is open (compact mode), so they don't count then.
  const tableMin =
    240 /* name */ + 40 /* actions */ + visibleCols.reduce((sum, c) => sum + c.width, 0);

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

  function editTask(task: Task) {
    // Tasks created by a company are owned by that company's B2B account and can
    // only be edited from the B2B Dashboard. Everything else is SkillCat-owned.
    if (task.createdBy !== "SkillCat") {
      setBlockedEdit(task);
      return;
    }
    onEditTask(task);
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
    <div className="tasks lm" ref={morph.rootRef}>
      <header className="tasks-header">
        <div>
          <h1 className="tasks-title">Tasks</h1>
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
              onCommit={(q) => {
                setCommittedQuery(q);
                morph.showTable();
              }}
            />
          </div>

          <LandingFilterRow pills={suggestedPills}>
              <Filters filters={filters} setFilters={setFilters} />
            </LandingFilterRow>

          <div className="lm-stage">
          <LandingOverlay
            caption="Recently created"
            total={sorted.length}
            columns={LM_COLS}
            rows={landingRows}
            onShowAll={morph.showTable}
            onRowClick={(row) => {
              setSelectedId(row.key);
              morph.showTable();
            }}
          />
          <div className="lm-table">
          <div className="co-table-row">
            <div className="co-table-col">
              <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
              <table className="table table-head">
                <ColGroup cols={visibleCols} />
                <thead>
                  <tr>
                    <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                    {visibleCols.map((c) => (
                      <SortableHeader
                        key={c.key}
                        col={c.key as SortKey}
                        label={c.label}
                        className={c.className}
                        sort={sort}
                        toggle={toggleSort}
                        sortable={c.sortable !== false}
                      />
                    ))}
                    <th className="col-actions">
                      <EditColumnsButton
                        columns={columns}
                        setColumns={setColumns}
                        order={order}
                        onOrderChange={setOrder}
                      />
                    </th>
                  </tr>
                </thead>
              </table>

              <div className="tasks-scroll">
                <table className="table table-body">
                  <ColGroup cols={visibleCols} />
                  <tbody>
                    {paged.map((task) => (
                      <TableRow
                        key={task.id}
                        task={task}
                        selected={task.id === selectedId}
                        cols={visibleCols}
                        onClick={() => setSelectedId(task.id === selectedId ? null : task.id)}
                        onEdit={() => editTask(task)}
                        onToggleVisibility={() => toggleVisibility(task)}
                        onOpenMenu={(rect) => setMenu({ task, rect })}
                        menuOpen={menu?.task.id === task.id}
                      />
                    ))}
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
                  <button
                    className="page-btn"
                    disabled={visiblePage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  ><ChevronLeftIcon /></button>
                  <button
                    className="page-btn"
                    disabled={visiblePage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  ><ChevronRightIcon /></button>
                </div>
              </div>
            </div>

            {selected && (
              <TaskPanel task={selected} onClose={() => setSelectedId(null)} />
            )}
          </div>
          </div>
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

      {blockedEdit && (
        <CompanyEditBlockedModal
          task={blockedEdit}
          onClose={() => setBlockedEdit(null)}
          onOpenDashboard={() => {
            onOpenCompanyDashboard(blockedEdit.createdBy);
            setBlockedEdit(null);
          }}
        />
      )}
    </div>
  );
}

function CompanyEditBlockedModal({
  task,
  onClose,
  onOpenDashboard,
}: {
  task: Task;
  onClose: () => void;
  onOpenDashboard: () => void;
}) {
  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Can't edit this task here</h3>
          <p className="cl-modal-sub">
            Tasks created by a company can only be edited from the B2B Dashboard.
            Login as <strong>{task.createdBy}</strong> to make changes.
          </p>
        </div>
        <div className="cl-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-publish" onClick={onOpenDashboard}>
            Open Company Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/** Renders a category's tags like the "Used in" column — first value plus a
 * "+N" overflow badge. Trade and Partnership categories allow more than one;
 * hovering the cell shows the full list via a native tooltip. */

function ColGroup({ cols }: { cols: TaskColMeta[] }) {
  return (
    <colgroup>
      <col style={{ width: 240 }} />
      {cols.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
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
  cols,
  onClick,
  onEdit,
  onToggleVisibility,
  onOpenMenu,
  menuOpen,
}: {
  task: Task;
  selected: boolean;
  /** Visible optional columns, already in the user's order. */
  cols: TaskColMeta[];
  onClick: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  return (
    <tr
      className={`${selected ? "selected" : ""} ${task.draft ? "draft" : ""} ${task.hidden ? "task-hidden" : ""} ${menuOpen ? "menu-open" : ""}`}
      onClick={onClick}
    >
      <td className="col-name" data-tip={task.name}>
        {task.name}
        {task.hidden && <span className="hidden-badge">Hidden</span>}
      </td>
      {cols.map((c) => (
        <td key={c.key} className={c.className} data-tip={c.tip?.(task)}>
          {c.render(task)}
        </td>
      ))}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button
            className="row-action-btn"
            aria-label="Edit"
            title="Edit task"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <RowEditIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label={task.hidden ? "Make visible" : "Hide task"}
            title={task.hidden ? "Make visible" : "Hide task"}
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          >
            {task.hidden ? <RowEyeOffIcon /> : <RowEyeIcon />}
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
          >
            <RowKebabIcon />
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
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    /* Right-anchored to the trigger — the kebab is the action bar's last cell,
       so the open menu's right edge lines up with the bar's. Using `right`
       rather than (rect.right - measuredWidth) keeps that exact: the first-pass
       width measurement is unreliable, because the fallback `left` shrink-to-
       fits the menu against the viewport before it has been placed. */
    setPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
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
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{task.name}</div>
        <div className="u-menu-head-id">{task.id} · {task.type}</div>
      </div>
      {item(<MenuPlaceholderIcon />, "Open Completion Report", onCompletionReport)}
      {showAttempts && item(<MenuPlaceholderIcon />, "View Attempts", onViewAttempts)}
      {/* Only paid Tasks have payers to view. */}
      {isPaid(task) && item(<MenuPlaceholderIcon />, "View who paid", onViewPayers)}
      {item(<RowDeleteIcon />, "Delete", onDelete, true)}
    </div>
  );
}

/* ─────────────── Task preview side panel ─────────────── */

const TYPE_ICON: Record<TaskType, () => JSX.Element> = {
  xAPI: PackageIcon,
  Quiz: QuizIcon,
  "Hands-On Task": HandsOnIcon,
  Resource: FileIcon,
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
