import { useEffect, useMemo, useState } from "react";
import { tasks as taskLibrary, type Task, type TaskType } from "../data/tasks";
import { certifications, type Certification } from "../data/certifications";
import { TableCols } from "./TableCols";
import { PrmModal } from "./PrmModal";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { FILTER_TIPS } from "../data/filterTips";
import {
  CheckIcon,
  RowChevronIcon,
  SearchIcon,
  SortIcon,
  PagePrevIcon,
  PageNextIcon,
} from "./icons";
import { SearchTrailing } from "./SearchPanelParts";

/* Add Requirement — the Certification wizard's Completion Criteria picker.
 *
 * It used to be a 340px dropdown with its own tiny result list. It is now the
 * shared table-picker (Figma 682:2321, `.stm-*`) that Select Tasks / Select
 * Certifications / Select Questions run on, with the app's own `.tabbar` over
 * the table so one modal covers both requirement kinds. Each tab keeps its own
 * search, filter, sort and page, and both share one staged selection — so a
 * single trip can add two Tasks and a Certification to the Condition Set.
 *
 * Selection is staged: the modal owns `picked` and only hands it back on
 * confirm, so Cancel / Escape discards. Rows already in this Condition Set stay
 * visible as ticked + locked (the Select Questions rule), so it is obvious why
 * they can't be added twice.
 *
 * Tasks only, it is also the Certification builder's "Add Existing Tasks";
 * with both tabs, Feedback Forms' "Add Trigger". The builder passes
 * `onPreviewTask`, which gives every Task row Select Questions' row-end
 * "Preview ›". */

const PAGE_SIZE = 50;

const TASK_TYPES: TaskType[] = ["Hands-On Task", "Quiz", "xAPI", "Resource"];

/** What the modal hands back — the source rows. The wizard turns these into
 *  its own Completion Items, so the picker stays free of the wizard's model. */
export type RequirementPick =
  | { kind: "task"; task: Task }
  | { kind: "cert"; cert: Certification };

type Tab = "task" | "cert";

type TaskSortKey = "name" | "type" | "certs";
type CertSortKey = "name" | "industry" | "careerStage" | "tasks";
type SortDir = "asc" | "desc";

/** Only SkillCat's own content can gate a Certification — the same rule the
 *  Select Tasks node states in its subtitle. */
const eligible = (t: Task) => t.createdBy === "SkillCat";

function compareTask(a: Task, b: Task, key: TaskSortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "type":
      return a.type.localeCompare(b.type);
    case "certs":
      return a.usedIn.join(", ").localeCompare(b.usedIn.join(", "));
  }
}

function compareCert(a: Certification, b: Certification, key: CertSortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "industry":
      return a.industry.localeCompare(b.industry);
    case "careerStage":
      return (a.careerStage ?? "").localeCompare(b.careerStage ?? "");
    case "tasks":
      return a.tasks - b.tasks;
  }
}

export function SelectRequirementModal({
  existingNames,
  only,
  title = "Add Requirement",
  description = "Pick what a learner must complete for this Condition Set. Everything added to one set is required.",
  confirmNoun = "Requirement",
  lockedTip = "Already in this Condition Set",
  lockedFlag,
  allCreators,
  onPreviewTask,
  onCancel,
  onConfirm,
}: {
  /** Names already in this Condition Set — those rows open ticked and locked. */
  existingNames: string[];
  /** Restrict the modal to one kind: the tab row is hidden and only that
   *  catalog is listed. */
  only?: Tab;
  title?: string;
  description?: string;
  /** Singular noun in the confirm button — "Add Requirement" / "Add 3 Tasks". */
  confirmNoun?: string;
  /** Hover line on a locked row — one sentence, or one per row name. */
  lockedTip?: string | ((name: string) => string);
  /** A locked row names what holds it in a grey flag beside its name and
   *  reads as a dimmed row rather than a ticked one, so it never looks
   *  "preselected". Every caller passes one ("Mapped to <form>", "In
   *  <Course › Lesson>", "In this Condition Set"). */
  lockedFlag?: (name: string) => string | undefined;
  /** List every library Task, company-created ones included, instead of only
   *  SkillCat's (the Certification builder's Add Existing Tasks). */
  allCreators?: boolean;
  /** Adds a row-end "Preview ›" to every Task row — the Select Questions
   *  affordance: a resting chevron that becomes a labelled bar on hover. */
  onPreviewTask?: (task: Task) => void;
  onCancel: () => void;
  onConfirm: (picks: RequirementPick[]) => void;
}) {
  const [tab, setTab] = useState<Tab>(only ?? "task");
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [inds, setInds] = useState<string[]>([]);
  const [pickedTasks, setPickedTasks] = useState<string[]>([]);
  const [pickedCerts, setPickedCerts] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [taskSort, setTaskSort] = useState<{ key: TaskSortKey; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });
  const [certSort, setCertSort] = useState<{ key: CertSortKey; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const taken = useMemo(() => new Set(existingNames), [existingNames]);

  /* A locked row's look and words. Without `lockedFlag` it stays the plain
     ticked + locked row (no caller does that now); with it, the row dims (`.task-dim`, the shared
     dim-row treatment) and the name carries a grey flag saying what holds it.
     The tip sits on the whole row — a disabled checkbox can't be relied on to
     show one. */
  const tipFor = (name: string) =>
    typeof lockedTip === "function" ? lockedTip(name) : lockedTip;
  const rowClass = (locked: boolean, on: boolean) =>
    locked && lockedFlag ? "task-dim is-locked" : on ? "selected" : "";
  function nameCell(name: string, locked: boolean) {
    const flag = locked ? lockedFlag?.(name) : undefined;
    if (!flag) return name;
    return (
      <>
        <span className="tsk-name">{name}</span>
        <span className="pr-name-flag pr-name-flag--grey stm-lock-flag">
          <span>{flag}</span>
        </span>
      </>
    );
  }

  const taskPool = useMemo(
    () => (allCreators ? taskLibrary : taskLibrary.filter(eligible)),
    [allCreators],
  );
  const allIndustries = useMemo(
    () => Array.from(new Set(certifications.map((c) => c.industry))).sort(),
    [],
  );

  const q = query.trim().toLowerCase();

  const taskRows = useMemo(() => {
    const rows = taskPool.filter((t) => {
      if (q && !(t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q))) return false;
      if (types.length && !types.includes(t.type)) return false;
      return true;
    });
    rows.sort((a, b) => compareTask(a, b, taskSort.key));
    return taskSort.dir === "desc" ? rows.reverse() : rows;
  }, [taskPool, q, types, taskSort]);

  const certRows = useMemo(() => {
    const rows = certifications.filter((c) => {
      if (q && !(c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))) return false;
      if (inds.length && !inds.includes(c.industry)) return false;
      return true;
    });
    rows.sort((a, b) => compareCert(a, b, certSort.key));
    return certSort.dir === "desc" ? rows.reverse() : rows;
  }, [q, inds, certSort]);

  const total = tab === "task" ? taskRows.length : certRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const pagedTasks = taskRows.slice(start, start + PAGE_SIZE);
  const pagedCerts = certRows.slice(start, start + PAGE_SIZE);

  const pickedCount = pickedTasks.length + pickedCerts.length;

  /** Task rows carry the Preview column only when there is a Preview to run. */
  const preview = tab === "task" && !!onPreviewTask;

  /** Switching tab starts that tab's list at the top; the staged picks stay. */
  function switchTab(next: Tab) {
    setTab(next);
    setQuery("");
    setPage(1);
  }

  function toggleTask(id: string) {
    setPickedTasks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function toggleCert(id: string) {
    setPickedCerts((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  /** Any filter change can shrink the list under the current page. */
  function resetPage<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  function confirm() {
    const picks: RequirementPick[] = [
      ...taskPool.filter((t) => pickedTasks.includes(t.id)).map((task) => ({ kind: "task" as const, task })),
      ...certifications
        .filter((c) => pickedCerts.includes(c.id))
        .map((cert) => ({ kind: "cert" as const, cert })),
    ];
    onConfirm(picks);
  }

  return (
    <PrmModal
      title={title}
      description={description}
      confirmLabel={
        pickedCount > 1 ? `Add ${pickedCount} ${confirmNoun}s` : `Add ${confirmNoun}`
      }
      confirmDisabled={pickedCount === 0}
      pickFull
      className="srq"
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className="stm">
        {/* The shared tab row (Figma 659:896) — full-bleed inside the card, so
            its hairline reads as a divider rather than a floating rule. A
            single-kind modal has nothing to switch between, so it has none. */}
        {!only && (
        <div className="tabbar srq-tabs">
          <button
            className={`tab ${tab === "task" ? "is-active" : ""}`}
            onClick={() => switchTab("task")}
          >
            Tasks
          </button>
          <button
            className={`tab ${tab === "cert" ? "is-active" : ""}`}
            onClick={() => switchTab("cert")}
          >
            Certifications
          </button>
        </div>
        )}

        <div className="stm-toolbar">
          <div className="search-wrap stm-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input"
              placeholder={tab === "task" ? "Search Tasks..." : "Search Certifications..."}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            <SearchTrailing
              active={!!query}
              onClear={() => {
                setQuery("");
                setPage(1);
              }}
            />
          </div>

          <div className="filters stm-filters">
            {tab === "task" ? (
              <Dropdown
                width={220}
                trigger={({ open, toggle: t }) => (
                  <PillTrigger
                    label="Task Type"
                    tip={FILTER_TIPS.taskPicker.type}
                    value={summarize(types, TASK_TYPES)}
                    open={open}
                    toggle={t}
                    onClear={() => resetPage(setTypes)([])}
                  />
                )}
              >
                {({ close }) => (
                  <SectionedMultiSelect
                    sections={[{ items: [...TASK_TYPES] }]}
                    value={types}
                    onApply={(v) => {
                      resetPage(setTypes)(v);
                      close();
                    }}
                  />
                )}
              </Dropdown>
            ) : (
              <Dropdown
                width={300}
                trigger={({ open, toggle: t }) => (
                  <PillTrigger
                    label="Industries"
                    tip={FILTER_TIPS.taskPicker.industry}
                    value={summarize(inds, allIndustries)}
                    open={open}
                    toggle={t}
                    onClear={() => resetPage(setInds)([])}
                  />
                )}
              >
                {({ close }) => (
                  <SectionedMultiSelect
                    sections={[{ items: allIndustries }]}
                    value={inds}
                    onApply={(v) => {
                      resetPage(setInds)(v);
                      close();
                    }}
                  />
                )}
              </Dropdown>
            )}
          </div>
        </div>

        <div className="stm-table-wrap">
          {/* Column-width floor = the active tab's columns + gutters — below
              it the table scrolls sideways instead of crushing the cells. */}
          <div
            className="table-xscroll"
            style={
              {
                "--table-min": `${
                  tab === "task"
                    ? CHECK_W + sum(TASK_COLS) + (preview ? PREVIEW_W : 0)
                    : CHECK_W + sum(CERT_COLS)
                }px`,
              } as React.CSSProperties
            }
          >
            {tab === "task" ? (
              <>
                <table className={`table table-head stm-table${preview ? " stm-table--preview" : ""}`}>
                  <TaskColGroup preview={preview} />
                  <thead>
                    <tr>
                      <th className="stm-col-check no-sort" />
                      <Th label="Task Name" cls="stm-col-name" active={taskSort.key === "name"} dir={taskSort.dir} onClick={() => toggleSort(setTaskSort, "name")} />
                      <Th label="Task Type" cls="stm-col-type" active={taskSort.key === "type"} dir={taskSort.dir} onClick={() => toggleSort(setTaskSort, "type")} />
                      <Th label="Certifications" cls="stm-col-certs" active={taskSort.key === "certs"} dir={taskSort.dir} onClick={() => toggleSort(setTaskSort, "certs")} />
                      {preview && <th className="col-actions no-sort" />}
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className={`table table-body stm-table${preview ? " stm-table--preview" : ""}`}>
                    <TaskColGroup preview={preview} />
                    <tbody>
                      {pagedTasks.length === 0 ? (
                        <tr className="stm-empty-row">
                          <td colSpan={preview ? 5 : 4}>No Tasks match your search and filters.</td>
                        </tr>
                      ) : (
                        pagedTasks.map((t) => {
                          const locked = taken.has(t.name);
                          const on = locked || pickedTasks.includes(t.id);
                          return (
                            <tr
                              key={t.id}
                              className={rowClass(locked, on)}
                              data-tip={locked ? tipFor(t.name) : undefined}
                              onClick={() => !locked && toggleTask(t.id)}
                            >
                              <td className="stm-col-check">
                                <button
                                  className={`checkbox ${on ? "checked" : ""}`}
                                  aria-label={on ? "Deselect" : "Select"}
                                  aria-pressed={on}
                                  disabled={locked}
                                  tabIndex={-1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!locked) toggleTask(t.id);
                                  }}
                                >
                                  {on && <CheckIcon />}
                                </button>
                              </td>
                              {/* `col-name` is the shared Name-column class —
                                  without it the app-wide "mute every non-Name
                                  cell" rule wins and the name greys out. */}
                              <td className="stm-col-name col-name">{nameCell(t.name, locked)}</td>
                              <td className="stm-col-type">{t.type}</td>
                              <td className="stm-col-certs">
                                <MultiCell values={t.usedIn} />
                              </td>
                              {/* Row-end Preview, the same two layers as
                                  Select Questions': a resting chevron that
                                  hides on hover and a labelled bar in its
                                  place. Both stop the click — the row itself
                                  ticks the checkbox. */}
                              {onPreviewTask && (
                                <td className="col-actions">
                                  <button
                                    className="row-action-btn lone-dots row-chevron"
                                    aria-label={`Preview ${t.name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPreviewTask(t);
                                    }}
                                  >
                                    <RowChevronIcon />
                                  </button>
                                  <div className="row-action-bar">
                                    <button
                                      className="row-action-btn row-action-btn--label"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPreviewTask(t);
                                      }}
                                    >
                                      Preview
                                      <RowChevronIcon />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <table className="table table-head stm-table">
                  <CertColGroup />
                  <thead>
                    <tr>
                      <th className="stm-col-check no-sort" />
                      <Th label="Certification" cls="stm-col-name" active={certSort.key === "name"} dir={certSort.dir} onClick={() => toggleSort(setCertSort, "name")} />
                      <Th label="Industries" cls="stm-col-certs" active={certSort.key === "industry"} dir={certSort.dir} onClick={() => toggleSort(setCertSort, "industry")} />
                      <Th label="Career Stage" cls="stm-col-type" active={certSort.key === "careerStage"} dir={certSort.dir} onClick={() => toggleSort(setCertSort, "careerStage")} />
                      <Th label="Tasks" cls="stm-col-edited" active={certSort.key === "tasks"} dir={certSort.dir} onClick={() => toggleSort(setCertSort, "tasks")} />
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className="table table-body stm-table">
                    <CertColGroup />
                    <tbody>
                      {pagedCerts.length === 0 ? (
                        <tr className="stm-empty-row">
                          <td colSpan={5}>No Certifications match your search and filters.</td>
                        </tr>
                      ) : (
                        pagedCerts.map((c) => {
                          const locked = taken.has(c.name);
                          const on = locked || pickedCerts.includes(c.id);
                          return (
                            <tr
                              key={c.id}
                              className={rowClass(locked, on)}
                              data-tip={locked ? tipFor(c.name) : undefined}
                              onClick={() => !locked && toggleCert(c.id)}
                            >
                              <td className="stm-col-check">
                                <button
                                  className={`checkbox ${on ? "checked" : ""}`}
                                  aria-label={on ? "Deselect" : "Select"}
                                  aria-pressed={on}
                                  disabled={locked}
                                  tabIndex={-1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!locked) toggleCert(c.id);
                                  }}
                                >
                                  {on && <CheckIcon />}
                                </button>
                              </td>
                              <td className="stm-col-name col-name">{nameCell(c.name, locked)}</td>
                              <td className="stm-col-certs">{c.industry}</td>
                              <td className="stm-col-type">{c.careerStage ?? "—"}</td>
                              <td className="stm-col-edited">{c.tasks}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="pagination stm-pagination">
            <span>
              Showing {total === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, total)} of {total}
            </span>
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={visiblePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <PagePrevIcon />
              </button>
              <button
                className="page-btn"
                disabled={visiblePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <PageNextIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PrmModal>
  );
}

/** Shared by both tabs' sort buttons — each tab keeps its own sort state, so
 *  the setter and key come from the caller. */
function toggleSort<K extends string>(
  set: (fn: (prev: { key: K; dir: SortDir }) => { key: K; dir: SortDir }) => void,
  key: K,
) {
  set((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
}

/* The shared width rule ([[table-conventions]], `TableCols`): every data
 * column has a content-sized base width — Name fits a long Task / Cert name
 * (and a locked row's flag, which ellipsizes first), Task Type "Hands-On
 * Task", Certifications one name + "+N", Industries "OSHA & Safety › …",
 * Career Stage "Journeyman", Tasks the header and its caret. Their sum is the
 * floor; on a wider modal the slack spreads across the data columns in
 * proportion, so the gaps grow evenly instead of Name swallowing it all. The
 * check gutter and the Preview column stay fixed. */
const CHECK_W = 44;
const PREVIEW_W = 104;
const TASK_COLS = [340, 160, 220];
const CERT_COLS = [340, 220, 160, 100];
const sum = (ws: number[]) => ws.reduce((n, w) => n + w, 0);

function TaskColGroup({ preview }: { preview?: boolean }) {
  return <TableCols lead={[CHECK_W]} data={TASK_COLS} trail={preview ? [PREVIEW_W] : []} />;
}

function CertColGroup() {
  return <TableCols lead={[CHECK_W]} data={CERT_COLS} />;
}

/* A cell holding more than one value shows the FIRST, ellipsised to the column,
 * then "+N" for the rest; the whole list is on the tooltip. */
function MultiCell({ values }: { values: string[] }) {
  if (values.length === 0) return <>—</>;
  return (
    <span className="stm-multi" title={values.join(", ")}>
      <span className="stm-multi-first">{values[0]}</span>
      {values.length > 1 && <span className="stm-multi-more">+{values.length - 1}</span>}
    </span>
  );
}

function Th({
  label,
  cls,
  active,
  dir,
  onClick,
}: {
  label: string;
  cls: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className={cls} onClick={onClick}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? dir : undefined} />
      </span>
    </th>
  );
}
