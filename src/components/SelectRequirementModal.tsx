import { useEffect, useMemo, useState, type ReactNode } from "react";
import { tasks as taskLibrary, subscriptionLabel, type Task } from "../data/tasks";
import { certifications, CERT_VISIBILITIES, type Certification } from "../data/certifications";
import { AUDIENCE_ALL_USERS, SUBSCRIPTION_OPTIONS, VISIBILITIES, audienceOf } from "../data/filters";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";
import { PrmModal } from "./PrmModal";
import { Dropdown } from "./Dropdown";
import {
  CertificationsPill,
  PillTrigger,
  SectionedMultiSelect,
  TaskTypePill,
  summarize,
} from "./Filters";
import {
  CareerStagePill,
  IndustryPill,
  TypePill,
  certMatches,
  type CertFilterState,
} from "./CertFilters";
import { FILTER_TIPS } from "../data/filterTips";
import {
  CheckIcon,
  RowChevronIcon,
  SortIcon,
  PagePrevIcon,
  PageNextIcon,
} from "./icons";
import { TasksSearch } from "./TasksSearch";
import { CertificationsSearch } from "./CertificationsSearch";

/* Add Requirement — the Certification wizard's Completion Criteria picker.
 *
 * It used to be a 340px dropdown with its own tiny result list. It is now the
 * shared table-picker (Figma 682:2321, `.stm-*`) that Select Tasks / Select
 * Questions run on, with the app's own `.tabbar` over
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
 * with both tabs, Feedback Forms' "Add Trigger"; Certifications only, the
 * builder's "Import Courses" and Content Links' add-link pickers (which
 * replaced the old graph-shaped SelectCertificationsModal and its Level /
 * Enrolled columns, 2026-10-05). The builder passes `onPreviewTask`, which
 * gives every Task row Select Questions' row-end "Preview ›". */

const PAGE_SIZE = 50;

/** What the modal hands back — the source rows. The wizard turns these into
 *  its own Completion Items, so the picker stays free of the wizard's model. */
export type RequirementPick =
  | { kind: "task"; task: Task }
  | { kind: "cert"; cert: Certification };

type Tab = "task" | "cert";

/* Columns, filters and their names are the Tasks and Certifications tables'
   own (TasksPage / CertificationsPage, Filters / CertFilters): the same pills,
   options and match rules, and both tabs open sorted by Date Modified, newest
   first — the tables' default. */
type TaskSortKey = "name" | "type" | "certs" | "dateModified";
type CertSortKey = "name" | "industry" | "careerStage" | "dateModified";
type SortDir = "asc" | "desc";

type TaskFilterState = {
  types: string[];
  certifications: string[];
  visibilities: string[];
  /** "Requires Subscription?" — SUBSCRIPTION_OPTIONS / `subscriptionLabel`. */
  subscription: string[];
};
const NO_TASK_FILTERS: TaskFilterState = { types: [], certifications: [], visibilities: [], subscription: [] };
const NO_CERT_FILTERS: CertFilterState = {
  industries: [],
  careerStages: [],
  types: [],
  creators: [],
  visibilities: [],
  tags: [],
  setup: [],
};

/** Only SkillCat's own content can gate a Certification — the same rule the
 *  Select Tasks node states in its subtitle. */
const bySkillCat = (r: { createdBy: string }) => r.createdBy === "SkillCat";
/** …and, where every learner must be able to reach it (a Feedback Form's
 *  trigger), no Audience/B2B tag — the All Users audience. */
const forAllUsers = (r: { createdBy: string; tags?: string[] }) =>
  bySkillCat(r) && audienceOf(r.tags) === AUDIENCE_ALL_USERS;

const dateOf = (d?: string) => Date.parse(d ?? "") || 0;
/** The Tasks table's Visibility value. */
const taskVisibility = (t: Task) => (t.hidden ? "Hidden" : "Visible");

function compareTask(a: Task, b: Task, key: TaskSortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "type":
      return a.type.localeCompare(b.type);
    case "certs":
      return a.usedIn.join(", ").localeCompare(b.usedIn.join(", "));
    case "dateModified":
      return dateOf(a.dateModified) - dateOf(b.dateModified);
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
    case "dateModified":
      return dateOf(a.dateModified) - dateOf(b.dateModified);
  }
}

export function SelectRequirementModal({
  existingNames,
  preselectedNames,
  certPool: certPoolProp,
  only,
  title = "Add Requirement",
  description = "Pick what a learner must complete for this Condition Set. Everything added to one set is required.",
  confirmNoun = "Requirement",
  confirmVerb = "Add",
  confirmBlocked = false,
  header,
  confirmLabel,
  allowEmpty = false,
  lockedTip = "Already in this Condition Set",
  lockedFlag,
  allCreators,
  allUsersOnly,
  certFirst,
  onPreviewTask,
  onCancel,
  onConfirm,
}: {
  /** Names already in this Condition Set — those rows open ticked and locked. */
  existingNames: string[];
  /** Certifications ticked when the modal opens but still clickable — so
   *  reopening the picker doubles as "manage what's already picked" (the
   *  Certification builder's Import Courses). Nothing on the Tasks tab. */
  preselectedNames?: string[];
  /** Catalog for the Certifications tab. Defaults to every Certification;
   *  Content Links passes only the ones its graph can link. */
  certPool?: Certification[];
  /** Restrict the modal to one kind: the tab row is hidden and only that
   *  catalog is listed. */
  only?: Tab;
  title?: string;
  description?: string;
  /** Singular noun in the confirm button — "Add Requirement" / "Add 3 Tasks". */
  confirmNoun?: string;
  /** The confirm button's verb — "Assign 3 Certifications" (Industries). */
  confirmVerb?: string;
  /** Holds the confirm back for a reason of the caller's (Assign Industries:
   *  no destination chosen yet). */
  confirmBlocked?: boolean;
  /** A row above the search bar — Assign Industries' "Add to" destination. */
  header?: ReactNode;
  /** A fixed confirm label instead of the counted "Add N …" one. */
  confirmLabel?: string;
  /** Lets confirm go through with nothing ticked — for a picker that also
   *  clears an existing selection. */
  allowEmpty?: boolean;
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
  /** List only SkillCat-made, All Users (no Audience/B2B tag) Tasks AND
   *  Certifications — what a Feedback Form may trigger on. */
  allUsersOnly?: boolean;
  /** Certifications tab first (and open on it) — Add Triggers. */
  certFirst?: boolean;
  /** Adds a row-end "Preview ›" to every Task row — the Select Questions
   *  affordance: a resting chevron that becomes a labelled bar on hover. */
  onPreviewTask?: (task: Task) => void;
  onCancel: () => void;
  onConfirm: (picks: RequirementPick[]) => void;
}) {
  const [tab, setTab] = useState<Tab>(only ?? (certFirst ? "cert" : "task"));
  const [query, setQuery] = useState("");
  const [taskFilters, setTaskFilters] = useState<TaskFilterState>(NO_TASK_FILTERS);
  const [certFilters, setCertFilters] = useState<CertFilterState>(NO_CERT_FILTERS);
  const [pickedTasks, setPickedTasks] = useState<string[]>([]);
  const [pickedCerts, setPickedCerts] = useState<string[]>(() =>
    preselectedNames?.length
      ? certifications.filter((c) => preselectedNames.includes(c.name)).map((c) => c.id)
      : [],
  );
  const [page, setPage] = useState(1);
  const [taskSort, setTaskSort] = useState<{ key: TaskSortKey; dir: SortDir }>({
    key: "dateModified",
    dir: "desc",
  });
  const [certSort, setCertSort] = useState<{ key: CertSortKey; dir: SortDir }>({
    key: "dateModified",
    dir: "desc",
  });

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      /* An open search-suggestion panel takes the first Escape (the page
         search closes it itself); only the next one closes the modal. */
      if (document.querySelector(".usearch-panel")) return;
      onCancel();
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
    () =>
      allUsersOnly
        ? taskLibrary.filter(forAllUsers)
        : allCreators
          ? taskLibrary
          : taskLibrary.filter(bySkillCat),
    [allCreators, allUsersOnly],
  );
  const certPool = useMemo(() => {
    const base = certPoolProp ?? certifications;
    return allUsersOnly ? base.filter(forAllUsers) : base;
  }, [certPoolProp, allUsersOnly]);

  const q = query.trim().toLowerCase();

  // The Tasks table's match rule for these four filters (TasksPage).
  const taskRows = useMemo(() => {
    const f = taskFilters;
    const rows = taskPool.filter((t) => {
      if (q && !(t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q)))
        return false;
      if (f.types.length && !f.types.includes(t.type)) return false;
      if (f.certifications.length && !t.usedIn.some((c) => f.certifications.includes(c))) return false;
      if (f.visibilities.length && !f.visibilities.includes(taskVisibility(t))) return false;
      if (f.subscription.length && !f.subscription.includes(subscriptionLabel(t))) return false;
      return true;
    });
    rows.sort((a, b) => compareTask(a, b, taskSort.key));
    return taskSort.dir === "desc" ? rows.reverse() : rows;
  }, [taskPool, q, taskFilters, taskSort]);

  // The Certifications table's own rule, search included (`certMatches`).
  const certRows = useMemo(() => {
    const rows = certPool.filter((c) => certMatches(c, query, certFilters));
    rows.sort((a, b) => compareCert(a, b, certSort.key));
    return certSort.dir === "desc" ? rows.reverse() : rows;
  }, [certPool, query, certFilters, certSort]);

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
  function setTaskF(patch: Partial<TaskFilterState>) {
    setTaskFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }
  function setCertF(patch: Partial<CertFilterState>) {
    setCertFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function confirm() {
    const picks: RequirementPick[] = [
      ...taskPool.filter((t) => pickedTasks.includes(t.id)).map((task) => ({ kind: "task" as const, task })),
      ...certPool
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
        confirmLabel ??
        (pickedCount > 1
          ? `${confirmVerb} ${pickedCount} ${confirmNoun}s`
          : `${confirmVerb} ${confirmNoun}`)
      }
      confirmDisabled={(!allowEmpty && pickedCount === 0) || confirmBlocked}
      pickFull
      className="srq"
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className="stm">
        {header}
        {/* The shared tab row (Figma 659:896) — full-bleed inside the card, so
            its hairline reads as a divider rather than a floating rule. A
            single-kind modal has nothing to switch between, so it has none. */}
        {!only && (
        <div className="tabbar srq-tabs">
          {(certFirst ? (["cert", "task"] as const) : (["task", "cert"] as const)).map((k) => (
            <button
              key={k}
              className={`tab ${tab === k ? "is-active" : ""}`}
              onClick={() => switchTab(k)}
            >
              {k === "task" ? "Tasks" : "Certifications"}
            </button>
          ))}
        </div>
        )}

        <div className="stm-toolbar">
          {/* The pages' own search bars (TasksSearch / CertificationsSearch —
              the Deep Link modal reuses the Certifications one the same way):
              Enter applies the query, and a picked Certification / Type /
              Industry / Career Stage suggestion lands on the pill below. */}
          <div className="toolbar">
            {tab === "task" ? (
              <TasksSearch
                tasks={taskPool}
                certifications={taskFilters.certifications}
                onCertificationsChange={(v) => setTaskF({ certifications: v })}
                types={taskFilters.types}
                onTypesChange={(v) => setTaskF({ types: v })}
                query={query}
                onCommit={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
              />
            ) : (
              <CertificationsSearch
                certifications={certPool}
                industries={certFilters.industries}
                onIndustriesChange={(v) => setCertF({ industries: v })}
                careerStages={certFilters.careerStages}
                onCareerStagesChange={(v) => setCertF({ careerStages: v })}
                types={certFilters.types}
                onTypesChange={(v) => setCertF({ types: v })}
                query={query}
                onCommit={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
              />
            )}
          </div>

          <div className="filters stm-filters">
            {tab === "task" ? (
              <>
                <TaskTypePill
                  value={taskFilters.types}
                  onApply={(v) => setTaskF({ types: v })}
                  tip={FILTER_TIPS.taskPicker.type}
                />
                <CertificationsPill
                  value={taskFilters.certifications}
                  onApply={(v) => setTaskF({ certifications: v })}
                  tip={FILTER_TIPS.taskPicker.certifications}
                />
                <ListPill
                  label="Visibility"
                  tip={FILTER_TIPS.taskPicker.visibility}
                  options={VISIBILITIES}
                  value={taskFilters.visibilities}
                  onApply={(v) => setTaskF({ visibilities: v })}
                />
                <ListPill
                  label="Requires Subscription?"
                  tip={FILTER_TIPS.taskPicker.subscription}
                  options={SUBSCRIPTION_OPTIONS}
                  value={taskFilters.subscription}
                  onApply={(v) => setTaskF({ subscription: v })}
                  width={300}
                />
              </>
            ) : (
              <>
                <IndustryPill
                  value={certFilters.industries}
                  onApply={(v) => setCertF({ industries: v })}
                  tip={FILTER_TIPS.certPicker.industry}
                />
                <CareerStagePill
                  value={certFilters.careerStages}
                  onApply={(v) => setCertF({ careerStages: v })}
                  tip={FILTER_TIPS.certPicker.careerStage}
                />
                <TypePill
                  value={certFilters.types}
                  onApply={(v) => setCertF({ types: v })}
                  tip={FILTER_TIPS.certPicker.type}
                />
                <ListPill
                  label="Visibility"
                  tip={FILTER_TIPS.certPicker.visibility}
                  options={CERT_VISIBILITIES}
                  value={certFilters.visibilities}
                  onApply={(v) => setCertF({ visibilities: v })}
                />
              </>
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
                      <Th label="Type" cls="stm-col-type" active={taskSort.key === "type"} dir={taskSort.dir} onClick={() => toggleSort(setTaskSort, "type")} />
                      <Th label="Certifications" cls="stm-col-certs" active={taskSort.key === "certs"} dir={taskSort.dir} onClick={() => toggleSort(setTaskSort, "certs")} />
                      <Th label="Date Modified" cls="stm-col-edited" active={taskSort.key === "dateModified"} dir={taskSort.dir} onClick={() => toggleSort(setTaskSort, "dateModified")} />
                      {preview && <th className="col-actions no-sort" />}
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className={`table table-body stm-table${preview ? " stm-table--preview" : ""}`}>
                    <TaskColGroup preview={preview} />
                    <tbody>
                      {pagedTasks.map((t) => {
                        const locked = taken.has(t.name);
                        const on = locked || pickedTasks.includes(t.id);
                        return (
                          <tr
                            key={t.id}
                            className={rowClass(locked, on)}
                            data-tip={locked ? tipFor(t.name) : undefined}
                            onClick={() => !locked && toggleTask(t.id)}
                          >
                            {/* A locked row has no checkbox at all — a
                                filled one read as "already picked". Its
                                flag and tip say why it can't be added. */}
                            <td className="stm-col-check">
                              {!locked && (
                                <button
                                  className={`checkbox ${on ? "checked" : ""}`}
                                  aria-label={on ? "Deselect" : "Select"}
                                  aria-pressed={on}
                                  tabIndex={-1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTask(t.id);
                                  }}
                                >
                                  {on && <CheckIcon />}
                                </button>
                              )}
                            </td>
                            {/* `col-name` is the shared Name-column class —
                                without it the app-wide "mute every non-Name
                                cell" rule wins and the name greys out. */}
                            <td className="stm-col-name col-name">{nameCell(t.name, locked)}</td>
                            <td className="stm-col-type">{t.type}</td>
                            <td className="stm-col-certs">
                              <MultiCell values={t.usedIn} />
                            </td>
                            <td className="stm-col-edited">{t.dateModified ?? "—"}</td>
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
                      })}
                    </tbody>
                  </table>
                </div>
                {pagedTasks.length === 0 && <TableEmpty />}
              </>
            ) : (
              <>
                <table className="table table-head stm-table">
                  <CertColGroup />
                  <thead>
                    <tr>
                      <th className="stm-col-check no-sort" />
                      <Th label="Name" cls="stm-col-name" active={certSort.key === "name"} dir={certSort.dir} onClick={() => toggleSort(setCertSort, "name")} />
                      <Th label="Industries" cls="stm-col-certs" active={certSort.key === "industry"} dir={certSort.dir} onClick={() => toggleSort(setCertSort, "industry")} />
                      <Th label="Career Stage" cls="stm-col-type" active={certSort.key === "careerStage"} dir={certSort.dir} onClick={() => toggleSort(setCertSort, "careerStage")} />
                      <Th label="Date Modified" cls="stm-col-edited" active={certSort.key === "dateModified"} dir={certSort.dir} onClick={() => toggleSort(setCertSort, "dateModified")} />
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className="table table-body stm-table">
                    <CertColGroup />
                    <tbody>
                      {pagedCerts.map((c) => {
                        const locked = taken.has(c.name);
                        const on = locked || pickedCerts.includes(c.id);
                        return (
                          <tr
                            key={c.id}
                            className={rowClass(locked, on)}
                            data-tip={locked ? tipFor(c.name) : undefined}
                            onClick={() => !locked && toggleCert(c.id)}
                          >
                            {/* A locked row has no checkbox at all — a
                                filled one read as "already picked". Its
                                flag and tip say why it can't be added. */}
                            <td className="stm-col-check">
                              {!locked && (
                                <button
                                  className={`checkbox ${on ? "checked" : ""}`}
                                  aria-label={on ? "Deselect" : "Select"}
                                  aria-pressed={on}
                                  tabIndex={-1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCert(c.id);
                                  }}
                                >
                                  {on && <CheckIcon />}
                                </button>
                              )}
                            </td>
                            <td className="stm-col-name col-name">{nameCell(c.name, locked)}</td>
                            <td className="stm-col-certs">{c.industry || "—"}</td>
                            <td className="stm-col-type">{c.careerStage ?? "—"}</td>
                            <td className="stm-col-edited">{c.dateModified ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {pagedCerts.length === 0 && <TableEmpty />}
              </>
            )}
          </div>

          <div className="pagination stm-pagination">
            <span className="stm-picked">{pickedCount} Selected</span>
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
 * Task", Certifications one name + "+N", Industries "Plumbing › Service & …",
 * Career Stage "Journeyman", Tasks the header and its caret. Their sum is the
 * floor; on a wider modal the slack spreads across the data columns in
 * proportion, so the gaps grow evenly instead of Name swallowing it all. The
 * check gutter and the Preview column stay fixed. */
const CHECK_W = 44;
const PREVIEW_W = 104;
/* Name gets the widest base (480) so a locked row's "Mapped to <form>" /
   "In <Course › Lesson>" flag has room before it ellipsizes. */
const TASK_COLS = [480, 160, 220, 130];
const CERT_COLS = [480, 220, 160, 130];
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
    <span title={values.join(", ")}>
      {values[0]}
      {values.length > 1 && <>{" "}<span className="used-extra">+{values.length - 1}</span></>}
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

/* A plain fixed-option filter pill (Visibility, Requires Subscription?) — the
   tables keep these under More Filters; here each is a pill of its own. Same
   Dropdown + PillTrigger + checklist body as every filter pill. */
function ListPill({
  label,
  tip,
  options,
  value,
  onApply,
  width = 220,
}: {
  label: string;
  tip: string;
  options: readonly string[];
  value: string[];
  onApply: (v: string[]) => void;
  width?: number;
}) {
  return (
    <Dropdown
      width={width}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label={label}
          tip={tip}
          value={summarize(value, [...options])}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...options] }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}
