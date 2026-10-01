import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { tasks as allTasks, discoverableLabel, subscriptionLabel, isPaid, type Task, type TaskType } from "../data/tasks";
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
import { pickTag, pickTags, matchesTagFilter, audienceOf, TRADE_TAGS, PARTNERSHIP_TAGS } from "../data/filters";
import { SortIcon, AddIcon, RowEditIcon, RowEyeIcon, RowEyeOffIcon, RowKebabIcon, RowDeleteIcon, MenuPaidIcon, MenuAttemptsIcon, MenuProgressIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { PrmModal } from "./PrmModal";
import { TasksSearch } from "./TasksSearch";
import type { TaskTypeKey } from "./Footer";
import { useCollapsingHeader } from "../hooks/useCollapsingHeader";
import { CERT_BY_USEDIN } from "../data/certifications";
import { TaskSummary, useTaskPreview } from "./NewTaskWizard";
import { PreviewPanel, PreviewScreen, formatCount, seededInt, timeAgo, type PreviewStat } from "./PreviewPanel";
import { SubscriptionMark } from "./NewCertificationWizard";
import { ConfirmCard } from "./ConfirmCard";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const TASK_TYPE_OPTIONS: { key: TaskTypeKey; label: string; shortcut: string }[] = [
  { key: "xapi", label: "xAPI Module", shortcut: "X" },
  { key: "quiz", label: "Quiz", shortcut: "Q" },
  { key: "hands-on", label: "Hands-On Task", shortcut: "H" },
  { key: "file", label: "Resource", shortcut: "R" },
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
  | "audience"
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
    case "audience":
      return audienceOf(a.tags).localeCompare(audienceOf(b.tags));
    case "dateCreated":
      return (Date.parse(a.dateCreated ?? "") || 0) - (Date.parse(b.dateCreated ?? "") || 0);
    case "dateModified":
      return (Date.parse(a.dateModified ?? "") || 0) - (Date.parse(b.dateModified ?? "") || 0);
  }
}


/* ─────────── Column registry ───────────
   One entry per optional column: width, cell class, sortability, and how the
   cell renders. The table walks `orderedColumns(...)` so dragging a row in the
   Edit Columns menu moves the real column. */
type TaskColMeta = {
  key: OptionalColumn;
  label: string;
  className: string;
  width: number;
  sortable?: boolean;
  tip?: (t: Task) => string | undefined;
  render: (t: Task) => React.ReactNode;
};

const TASK_COLS: TaskColMeta[] = [
  { key: "id", label: "Task ID", className: "col-id", width: 100, render: (t) => t.id },
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
    key: "audience", label: "Audience", className: "col-tags", width: 150, sortable: false,
    render: (t) => audienceOf(t.tags),
  },
  { key: "dateCreated", label: "Date Created", className: "col-date", width: 130, render: (t) => t.dateCreated ?? "" },
  { key: "dateModified", label: "Date Modified", className: "col-date", width: 130, render: (t) => t.dateModified ?? "" },
];

function tagTip(tags: string[]): string | undefined {
  return tags.length ? tags.join("\n") : undefined;
}

function TagText({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <>
      {tags[0]}
      {tags.length > 1 && <span className="used-extra">+{tags.length - 1}</span>}
    </>
  );
}

export function TasksPage({
  initialCertificationFilter,
  onNewTask,
  onEditTask,
  onOpenCompanyDashboard,
  onViewAttempts,
  onViewPayers,
  onManageProgress,
  onOpenQuestionBank,
  onOpenSkills,
  extraTasks,
}: {
  /** Deep link from a Certification's "View All Tasks" — seeds the
   *  Certifications filter and opens straight on the table. */
  initialCertificationFilter?: string;
  onNewTask: (t: TaskTypeKey) => void;
  onEditTask: (task: Task) => void;
  onOpenCompanyDashboard: (companyName: string) => void;
  onViewAttempts: (task: Task) => void;
  onViewPayers: (task: Task) => void;
  onManageProgress: (task: Task) => void;
  onOpenQuestionBank?: () => void;
  onOpenSkills?: () => void;
  /** Tasks published from the wizard this session, newest first. */
  extraTasks?: Task[];
}) {
  // Local working copy so visibility toggles and deletes persist in-session.
  const [taskList, setTaskList] = useState<Task[]>(() => [...(extraTasks ?? []), ...allTasks]);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [menu, setMenu] = useState<{ task: Task; rect: DOMRect } | null>(null);
  // Set when someone tries to edit a Task owned by a company — company Tasks are
  // managed from the B2B Dashboard, not here.
  const [blockedEdit, setBlockedEdit] = useState<Task | null>(null);
  // The Task awaiting a Hide confirmation (Figma 667:884). Unhiding is instant;
  // only hiding routes through the modal.
  const [hideTarget, setHideTarget] = useState<Task | null>(null);
  // Set when the Task can't be hidden at all — it still gates other content
  // through an Access Restriction chain.
  const [blockedHide, setBlockedHide] = useState<Task | null>(null);
  // The Task awaiting a Delete confirmation — the same 667:884 shell as Hide,
  // in its destructive variant.
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  // The Task whose row was clicked — read back in the side drawer, the way a
  // Certification row opens its own. Held by id so the drawer follows the
  // working copy (a hide or delete from elsewhere updates or closes it).
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const drawerTask = drawerId ? taskList.find((t) => t.id === drawerId) : undefined;
  // Search bar: committedQuery only changes on Enter. The certification filter is
  // shared with the Filters row (filters.certifications) and applies on Enter.
  const [committedQuery, setCommittedQuery] = useState("");
  // Arriving from a Certification's "View All Tasks" applies that Certification
  // and NOTHING else — not even the page's usual "Created By: SkillCat"
  // default, which would hide the Cert's company-authored Tasks.
  const [filters, setFilters] = useState<FilterState>({
    creators: initialCertificationFilter ? [] : ["SkillCat"],
    certifications: initialCertificationFilter ? [initialCertificationFilter] : [],
    discoverable: [],
    subscription: [],
    types: [],
    visibilities: [],
    tags: [],
  });
  const [columns, setColumns] = useState<ColumnState>({
    id: false,
    type: true,
    paid: false,
    usedIn: true,
    createdBy: false,
    tradeTag: false,
    partnershipTag: false,
    audience: false,
    dateCreated: false,
    dateModified: true,
  });
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useColumnOrder(TASK_COLS);
  // Default sort: most recently edited first.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "dateModified",
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
      if (filters.subscription.length && !filters.subscription.includes(subscriptionLabel(t))) return false;
      if (filters.types.length && !filters.types.includes(t.type)) return false;
      if (filters.tags.length && !matchesTagFilter(t.tags, filters.tags)) return false;
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
      // The Create menu (z 500) would open above the drawer's scrim.
      if (drawerId) return;
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
  }, [createMenuOpen, drawerId, onNewTask]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  // The page's one scroller — the Certifications page's collapsing header: the
  // landing header folds away over the first stretch of scroll with the table
  // glued beneath it, and the rows scroll under the pinned header after that.
  // Arriving from a Certification's "View All Tasks" is a deep link — the
  // filter is already set, so the page opens collapsed, on the table.
  const head = useCollapsingHeader(Boolean(initialCertificationFilter));
  const { scrollToFirstRow } = head;

  // A new query, filter, sort or page starts the list at its first row. A
  // collapsed header stays collapsed; one still open is left as it is.
  useLayoutEffect(() => {
    scrollToFirstRow();
  }, [committedQuery, filters, sort, visiblePage, scrollToFirstRow]);

  // The landing's summary line: the whole library, not the filtered rows (the
  // pagination footer counts those), and the Certifications it spans — a short
  // `usedIn` alias ("NATE RTW") counts as the Certification it stands for.
  const catalog = useMemo(
    () => ({
      tasks: taskList.length,
      certifications: new Set(
        taskList.flatMap((t) => t.usedIn.map((name) => CERT_BY_USEDIN.get(name)?.id ?? name)),
      ).size,
    }),
    [taskList],
  );

  // Column display order — reordered by dragging in the Edit Columns menu.
  const visibleCols = useMemo(
    () => orderedColumns(TASK_COLS, order, columns),
    [columns, order],
  );

  // Natural table width so columns scroll horizontally instead of crushing on a
  // narrow page. Mirrors the visible columns in <ColGroup>.
  const tableMin =
    240 /* name */ + 40 /* actions */ + visibleCols.reduce((sum, c) => sum + c.width, 0);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function setHidden(task: Task, hidden: boolean) {
    setTaskList((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, hidden } : t)),
    );
  }

  function toggleVisibility(task: Task) {
    // Unhiding restores the Task straight away — only hiding needs confirming.
    if (task.hidden) {
      setHidden(task, false);
      return;
    }
    // Access Restriction chains gate other content, so the Task can't be hidden
    // while it's still part of one.
    if (task.accessRestricted) {
      setBlockedHide(task);
      return;
    }
    // Hiding pulls the Task out of every Certification carrying it, so the full
    // list goes in front of the confirm (Figma 667:884).
    setHideTarget(task);
  }

  // A row menu opened from the preview panel's kebab: every item closes the
  // panel first, so the modal or page it opens isn't left under the panel.
  function closePanelThen(run: () => void) {
    setDrawerId(null);
    run();
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
    // Deleting routes through the shared confirm modal (Figma 667:884), not the
    // browser's own dialog.
    setDeleteTarget(task);
  }

  function confirmDelete(task: Task) {
    setTaskList((prev) => prev.filter((t) => t.id !== task.id));
    setDeleteTarget(null);
  }

  return (
    /* The Certifications page's collapsing header (Claude Design
       "Certifications Prototype"): the page is ONE scroller — the table's own
       `.table-xscroll` — opening on the landing, where the large title, the
       library summary and the Large search bar sit straight on top of the real
       table. The first stretch of scroll collapses that header into the
       standard table header with the rows glued beneath it; after that the
       rows scroll under the pinned header. See useCollapsingHeader and the
       `.tasks.clh` rules in index.css. */
    <div className="tasks clh">
      <div className="co-table-col">
        <div
          ref={head.scrollRef}
          className="table-xscroll clh-scroll"
          style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}
        >
          <div className="clh-canvas">
            <div ref={head.headerRef} className="clh-head">
              {/* The header's pieces are its direct children, so each can pin
                  inside it (see the `.tasks.clh` rules). The action buttons
                  keep a `.tasks-header` of their own for their button styles. */}
              <header className="tasks-header clh-actions">
                {/* Figma 633:1865 — Skills and Question Bank used to live in the
                    sidebar's Content group; they are now reached from here, left of the
                    Create Task CTA. */}
                <div className="tasks-header-actions">
                  <button className="cta-quiet" onClick={() => onOpenSkills?.()}>
                    Skills
                  </button>
                  <button className="cta-quiet" onClick={() => onOpenQuestionBank?.()}>
                    Question Bank
                  </button>
                  {/* Figma 724:1010 "Create Task Options": label + shortcut badge, no
                      icons, on the panel's own 174px shell. */}
                  <Dropdown
                    align="right"
                    width="auto"
                    panelClass="ct-menu"
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
                      <>
                        {TASK_TYPE_OPTIONS.map(({ key, label, shortcut }) => (
                          <button
                            key={key}
                            className="ct-menu-item"
                            onClick={() => {
                              onNewTask(key);
                              close();
                            }}
                          >
                            <span className="ct-menu-label">{label}</span>
                            <span className="ct-menu-kbd">{shortcut}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </Dropdown>
                </div>
              </header>
              <h1 className="tasks-title">Tasks</h1>
              {/* The landing's summary line — Figma 1356:1864's copy
                  ("3210 Tasks · Across 230 Certifications"). It fades as the
                  header collapses. */}
              <p className="tasks-subtitle clh-sub">
                {`${plural(catalog.tasks, "Task", "Tasks")} · Across ${plural(
                  catalog.certifications,
                  "Certification",
                  "Certifications",
                )}`}
              </p>

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
            </div>

            <table ref={head.theadRef} className="table table-head">
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
                      cols={visibleCols}
                      onOpen={() => setDrawerId(task.id)}
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
        </div>

        <div className="pagination">
          <span>
            Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="pagination-controls">
            <button
              className="page-btn"
              disabled={visiblePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            ><PagePrevIcon /></button>
            <button
              className="page-btn"
              disabled={visiblePage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            ><PageNextIcon /></button>
          </div>
        </div>
      </div>

      {menu && (
        <TaskActionsMenu
          task={menu.task}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEdit={() => closePanelThen(() => editTask(menu.task))}
          onToggleVisibility={() => closePanelThen(() => toggleVisibility(menu.task))}
          onViewPayers={() => closePanelThen(() => onViewPayers(menu.task))}
          onViewAttempts={() => closePanelThen(() => onViewAttempts(menu.task))}
          onManageProgress={() => closePanelThen(() => onManageProgress(menu.task))}
          onDelete={() => closePanelThen(() => deleteTask(menu.task))}
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

      {hideTarget && (
        <HideTaskModal
          task={hideTarget}
          onCancel={() => setHideTarget(null)}
          onConfirm={() => {
            setHidden(hideTarget, true);
            setHideTarget(null);
          }}
        />
      )}

      {blockedHide && (
        <HideBlockedModal task={blockedHide} onClose={() => setBlockedHide(null)} />
      )}

      {deleteTarget && (
        <DeleteTaskModal
          task={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => confirmDelete(deleteTarget)}
        />
      )}

      {drawerTask && (
        <TaskDrawer
          key={drawerTask.id}
          task={drawerTask}
          onClose={() => setDrawerId(null)}
          /* Closes the panel first: editing opens the wizard, or — for a
             company-owned Task — the blocked-edit modal, which would
             otherwise sit under the panel. */
          onEdit={() => {
            setDrawerId(null);
            editTask(drawerTask);
          }}
          onMore={(rect) => setMenu({ task: drawerTask, rect })}
        />
      )}
    </div>
  );
}

/** A Task's row preview panel ("Preview Panel 3a"): the record — meta,
 *  actions, its figures, then the wizard's review cards (Details) and the
 *  Certifications it's in (Used In) — beside the Task as a learner sees it. */
function TaskDrawer({
  task,
  onClose,
  onEdit,
  onMore,
}: {
  task: Task;
  onClose: () => void;
  onEdit: () => void;
  onMore: (rect: DOMRect) => void;
}) {
  // The Certifications carrying it, by their canonical names (usedIn holds
  // aliases such as "NATE RTW").
  const certs = useMemo(
    () =>
      [...new Set(task.usedIn)].map((u) => {
        const c = CERT_BY_USEDIN.get(u);
        return { name: c?.name ?? u, industry: c?.industry };
      }),
    [task.usedIn],
  );
  const pv = useTaskPreview(task, certs);
  const graded = task.type === "Quiz" || task.type === "Hands-On Task";
  const attempts = seededInt(task.id, "attempts", 90, 5200);
  const rate = seededInt(task.id, "rate", graded ? 58 : 70, graded ? 92 : 97);
  const stats: PreviewStat[] = task.hidden
    ? [
        { count: "—", title: graded ? "Attempts" : "Completions", sub: "Hidden from learners" },
        { count: "—", title: graded ? "Pass Rate" : "Completion Rate", sub: "Hidden from learners" },
      ]
    : [
        {
          count: formatCount(attempts),
          title: graded ? "Attempts" : "Completions",
          sub: `+${seededInt(task.id, "month", 6, 180)} / month`,
        },
        {
          count: `${rate}%`,
          title: graded ? "Pass Rate" : "Completion Rate",
          sub: graded ? "Of attempts" : "Of starters",
        },
      ];
  stats.push({ count: String(certs.length), title: "Used In", sub: certs.length === 1 ? "Certification" : "Certifications" });
  const edited = task.dateModified && `Edited ${task.dateModified}${timeAgo(task.dateModified) ? ` (${timeAgo(task.dateModified)})` : ""}`;

  return (
    <PreviewPanel
      title={task.name}
      description={task.description}
      meta={[
        <span className="pp-id">{task.id}</span>,
        pv.typeLabel,
        pv.time,
        task.finalExam && "Final Exam",
        <span className={`co-status-pill co-status-pill--${task.hidden ? "grey" : "green"}`}>
          {task.hidden ? "Hidden" : "Visible"}
        </span>,
        task.requiresSubscription ? (
          <>
            <SubscriptionMark />
            Subscription
          </>
        ) : (
          "Free Trial"
        ),
        edited,
      ]}
      onEdit={onEdit}
      onMore={onMore}
      stats={stats}
      tabs={[
        { key: "details", label: "Details", content: <TaskSummary task={task} /> },
        {
          key: "used-in",
          label: `Used In · ${certs.length}`,
          content: (
            <div className="confirm-cards">
              <ConfirmCard title={`Certifications · ${certs.length}`} tableBody={certs.length > 0}>
                {certs.length > 0 ? (
                  <div className="ctb-tasktable">
                    {certs.map((c) => (
                      <div key={c.name} className="cdr-task">
                        <div className="cdr-task-name-row">
                          <span className="cdr-task-name">{c.name}</span>
                        </div>
                        {c.industry && <span className="ctb-row-meta">{c.industry}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="form-help">Not in any Certification yet.</p>
                )}
              </ConfirmCard>
            </div>
          ),
        },
      ]}
      preview={(device) => <PreviewScreen device={device} model={pv.screen} lock={<SubscriptionMark />} />}
      onClose={onClose}
    />
  );
}

/** Hide confirmation — Figma 667:884 "General Modal". The heading names the
 *  Task, the description states what hiding does, and the content slot lists
 *  every Certification the Task currently sits in. */
function HideTaskModal({
  task,
  onCancel,
  onConfirm,
}: {
  task: Task;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <PrmModal
      title={`Hide “${task.name}”`}
      confirmLabel="Hide Task"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="prm-content">Hiding the Task temporarily removes it for all users.</p>
      {task.usedIn.length > 0 && (
        <div className="prm-content">
          <p>
            This Task is currently in the following Certification(s). Hiding it removes it
            temporarily from here.
          </p>
          <ul>
            {task.usedIn.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </PrmModal>
  );
}

/** Delete confirmation — the same Figma 667:884 "General Modal" as Hide, in its
 *  destructive variant. The heading names the Task, and the content slot spells
 *  out that the delete is permanent plus every Certification it will leave. */
function DeleteTaskModal({
  task,
  onCancel,
  onConfirm,
}: {
  task: Task;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <PrmModal
      title={`Delete “${task.name}”`}
      confirmLabel="Delete Task"
      danger
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="prm-content">
        Deleting the Task ({task.id}) removes it permanently. This can't be undone.
      </p>
      {task.usedIn.length > 0 && (
        <div className="prm-content">
          <p>
            This Task is currently in the following Certification(s). Deleting it removes
            it from every one of them.
          </p>
          <ul>
            {task.usedIn.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </PrmModal>
  );
}

/** Access Restriction chains gate other content, so a Task inside one can't be
 *  hidden until it leaves the chain — acknowledgment only, no CTA to confirm. */
function HideBlockedModal({ task, onClose }: { task: Task; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <PrmModal
      title={`Can't hide “${task.name}”`}
      confirmLabel="Okay"
      hideCancel
      onCancel={onClose}
      onConfirm={onClose}
    >
      <p className="prm-content">
        This Task is part of an Access Restriction chain. Hiding it would break the
        content it gates. Remove the Task from that chain first, then hide it.
      </p>
    </PrmModal>
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
    <PrmModal
      title="Can't edit this task here"
      confirmLabel="Open Company Dashboard"
      onCancel={onClose}
      onConfirm={onOpenDashboard}
    >
      <p className="prm-content">
        Tasks created by a company can only be edited from the B2B Dashboard.
        Login as <strong>{task.createdBy}</strong> to make changes.
      </p>
    </PrmModal>
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
  cols,
  onOpen,
  onEdit,
  onToggleVisibility,
  onOpenMenu,
  menuOpen,
}: {
  task: Task;
  /** Visible optional columns, already in the user's order. */
  cols: TaskColMeta[];
  /** Row click — opens the Task's drawer. The row's buttons stop propagation. */
  onOpen: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  return (
    <tr
      className={`${task.hidden ? "task-dim" : ""} ${menuOpen ? "menu-open" : ""}`}
      onClick={onOpen}
    >
      <td className="col-name" data-tip={task.name}>
        <span className="tsk-name">{task.name}</span>
        {/* Hidden reads exactly as an archived Skill row (1126:1686): grey pill
            beside a muted name, every other cell dimmed — see `.task-dim` in
            the CSS, which shares the Skills rules. */}
        {task.hidden && <span className="pr-name-flag pr-name-flag--grey">Hidden</span>}
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
  onEdit,
  onToggleVisibility,
  onViewPayers,
  onViewAttempts,
  onManageProgress,
  onDelete,
}: {
  task: Task;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onViewPayers: () => void;
  onViewAttempts: () => void;
  onManageProgress: () => void;
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
      {item(<RowEditIcon />, "Edit Task", onEdit)}
      {item(
        task.hidden ? <RowEyeIcon /> : <RowEyeOffIcon />,
        task.hidden ? "Make Visible" : "Make Hidden",
        onToggleVisibility,
      )}
      {/* Only paid Tasks have payers to view. */}
      {isPaid(task) && item(<MenuPaidIcon />, "View Who Paid", onViewPayers)}
      {showAttempts && item(<MenuAttemptsIcon />, "View All Attempts", onViewAttempts)}
      {item(<MenuProgressIcon />, "Manage User Progress", onManageProgress)}
      {item(<RowDeleteIcon />, "Delete Task", onDelete, true)}
    </div>
  );
}

