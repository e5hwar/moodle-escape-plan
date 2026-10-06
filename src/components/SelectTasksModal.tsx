import { useEffect, useMemo, useState } from "react";
import { tasks as taskLibrary, type Task, type TaskType } from "../data/tasks";
import { certifications } from "../data/certifications";
import { PrmModal } from "./PrmModal";
import { TableCols } from "./TableCols";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { FILTER_TIPS } from "../data/filterTips";
import {
  CheckIcon,
  CheckboxDashIcon,
  SortIcon,
  PagePrevIcon,
  PageNextIcon,
} from "./icons";
import { TasksSearch } from "./TasksSearch";
import { TableEmpty } from "./TableEmpty";

/* Select Tasks — Figma 682:2321. A compact version of the Tasks page table
 * inside the shared PrmModal shell: search bar, filter pills, a table carrying
 * the Tasks table's column names (Task Name, Type, Certifications, Date
 * Modified) with a select-all header, and pagination, with Cancel / Continue in the modal's own footer.
 *
 * The Certification builder's Add Existing Tasks is a different picker —
 * SelectRequirementModal, Tasks only — not this one.
 *
 * Selection is staged: the modal owns `picked` and only hands it back on
 * Continue, so Cancel discards. */

const PAGE_SIZE = 50;

const TASK_TYPES: TaskType[] = ["Hands-On Task", "Quiz", "xAPI", "Resource"];

/** Figma 1138:1119 — the Task Visibility pill. A Task carries `hidden`, so the
 *  two options are the two states of that flag. */
const VISIBILITIES = ["Visible", "Hidden"];

/** Cert name → Industry path. A Task has no Industry of its own, so its
 *  Industries are those of the Certifications it is used in — the same way the
 *  Skills page derives a Skill's Certifications through its Tasks. */
const industryOfCert = new Map(certifications.map((c) => [c.name, c.industry]));

type SortKey = "name" | "type" | "certs" | "dateModified";
type SortDir = "asc" | "desc";

/** The node's subtitle is a rule, not decoration: only SkillCat's own Tasks are
 *  eligible. */
function eligible(t: Task) {
  return t.createdBy === "SkillCat";
}

function certsOf(t: Task) {
  return t.usedIn;
}

function industriesOf(t: Task): string[] {
  const out: string[] = [];
  for (const name of t.usedIn) {
    const ind = industryOfCert.get(name);
    if (ind && !out.includes(ind)) out.push(ind);
  }
  return out;
}

function visibilityOf(t: Task) {
  return t.hidden ? "Hidden" : "Visible";
}

function compare(a: Task, b: Task, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "type":
      return a.type.localeCompare(b.type);
    case "certs":
      return certsOf(a).join(", ").localeCompare(certsOf(b).join(", "));
    case "dateModified":
      return (
        (Date.parse(a.dateModified ?? "") || 0) -
        (Date.parse(b.dateModified ?? "") || 0)
      );
  }
}

export function SelectTasksModal({
  value,
  onCancel,
  onConfirm,
}: {
  /** Task ids already chosen on the field — the modal opens pre-ticked. */
  value: string[];
  onCancel: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  /* Opens pre-filtered to the Task types that award Skills — Hands-On and
     Quiz. Clearing the pill reveals xAPI and Resources. */
  const [types, setTypes] = useState<string[]>(["Hands-On Task", "Quiz"]);
  /* Figma 1138:1119 draws this pill APPLIED with "Visible": the picker opens
     showing only Tasks learners can currently see. Clearing it reveals the
     hidden ones. */
  const [vis, setVis] = useState<string[]>(["Visible"]);
  const [certs, setCerts] = useState<string[]>([]);
  const [inds, setInds] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(value);
  const [page, setPage] = useState(1);
  // Default sort is by last edited — newest first.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "dateModified",
    dir: "desc",
  });

  // PrmModal has no key handling of its own, so the owner closes on Escape —
  // except inside the search bar, where Escape abandons the bar's own edit.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if ((e.target as Element | null)?.closest?.(".usearch")) return;
      onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const pool = useMemo(() => taskLibrary.filter(eligible), []);

  const allCerts = useMemo(
    () => Array.from(new Set(pool.flatMap((t) => t.usedIn))).sort(),
    [pool],
  );

  const allIndustries = useMemo(
    () => Array.from(new Set(pool.flatMap(industriesOf))).sort(),
    [pool],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((t) => {
      if (
        q &&
        !(t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
      )
        return false;
      if (types.length && !types.includes(t.type)) return false;
      if (vis.length && !vis.includes(visibilityOf(t))) return false;
      if (certs.length && !t.usedIn.some((c) => certs.includes(c))) return false;
      if (inds.length && !industriesOf(t).some((i) => inds.includes(i)))
        return false;
      return true;
    });
  }, [pool, query, types, vis, certs, inds]);

  /* The Tasks already on the field when the picker opened are pinned to the
     top, ticked, whatever the search, the filters or the SkillCat-only rule
     say — a Skill can already link a Task from elsewhere, and hiding it here
     would leave no way to see or untick it. Pinned by the OPENING value, so
     unticking one doesn't make it jump away mid-edit. */
  const [pinnedIds] = useState(value);
  const sorted = useMemo(() => {
    const order = (arr: Task[]) => {
      const out = [...arr].sort((a, b) => compare(a, b, sort.key));
      return sort.dir === "desc" ? out.reverse() : out;
    };
    const pinned = order(
      pinnedIds.flatMap((id) => {
        const t = taskLibrary.find((x) => x.id === id);
        return t ? [t] : [];
      }),
    );
    return [...pinned, ...order(filtered.filter((t) => !pinnedIds.includes(t.id)))];
  }, [filtered, sort, pinnedIds]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const rows = sorted.slice(start, start + PAGE_SIZE);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  /* Continue only once there's something to hand back: at least one Task
     ticked, and a set that differs from what the field already holds. */
  const changed = picked.length !== value.length || picked.some((id) => !value.includes(id));
  const canContinue = picked.length > 0 && changed;

  /* Select-all covers every row the current search and filters match, not
     just the visible page — the Select Questions / Grant Attempts scope. */
  const pickedHere = useMemo(() => sorted.filter((t) => picked.includes(t.id)).length, [sorted, picked]);
  const allOn = sorted.length > 0 && pickedHere === sorted.length;
  const someOn = pickedHere > 0 && !allOn;

  function toggleAll() {
    const ids = new Set(sorted.map((t) => t.id));
    setPicked((p) =>
      allOn ? p.filter((id) => !ids.has(id)) : [...p, ...sorted.filter((t) => !p.includes(t.id)).map((t) => t.id)],
    );
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  /** Any filter change can shrink the list under the current page. */
  function resetPage<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  return (
    <PrmModal
      title="Select Tasks"
      description="Only Tasks that have been created by SkillCat are shown and can be selected here"
      confirmLabel="Continue"
      pickFull
      confirmDisabled={!canContinue}
      onCancel={onCancel}
      onConfirm={() => onConfirm(picked)}
    >
      <div className="stm">
        <div className="stm-toolbar">
          {/* The Tasks page's own search bar (as Add Requirement uses it):
              Enter applies the query, and a picked Certification / Type
              suggestion lands on the pill below. */}
          <div className="toolbar">
            <TasksSearch
              tasks={pool}
              certifications={certs}
              onCertificationsChange={resetPage(setCerts)}
              types={types}
              onTypesChange={resetPage(setTypes)}
              query={query}
              onCommit={(v) => {
                setQuery(v);
                setPage(1);
              }}
            />
          </div>

          <div className="filters stm-filters">
            <Dropdown
              width={220}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Task Type"
                  tip={FILTER_TIPS.taskPicker.type}
                  /* Only four short types, so name them ("Hands-On Task, Quiz")
                     rather than the shared "2 Selected" — in menu order. */
                  value={
                    types.length > 1 && types.length < TASK_TYPES.length
                      ? TASK_TYPES.filter((t) => types.includes(t)).join(", ")
                      : summarize(types, TASK_TYPES)
                  }
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

            <Dropdown
              width={200}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Task Visibility"
                  tip={FILTER_TIPS.taskPicker.visibility}
                  value={summarize(vis, VISIBILITIES)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setVis)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: VISIBILITIES }]}
                  value={vis}
                  onApply={(v) => {
                    resetPage(setVis)(v);
                    close();
                  }}
                />
              )}
            </Dropdown>

            <Dropdown
              width={260}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Certifications"
                  tip={FILTER_TIPS.taskPicker.certifications}
                  value={summarize(certs, allCerts)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setCerts)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: allCerts }]}
                  value={certs}
                  onApply={(v) => {
                    resetPage(setCerts)(v);
                    close();
                  }}
                />
              )}
            </Dropdown>

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
          </div>
        </div>

        <div className="stm-table-wrap">
          {/* Column-width floor = the sum of COL_WIDTHS — below it the table
              scrolls sideways instead of crushing the cells. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}
          >
            <table className="table table-head stm-table">
              <ColGroup />
              <thead>
                <tr>
                  <th className="stm-col-check no-sort">
                    <button
                      className={`checkbox ${allOn ? "checked" : someOn ? "partial" : ""}`}
                      aria-label={allOn ? "Deselect all" : "Select all"}
                      aria-pressed={allOn}
                      disabled={sorted.length === 0}
                      onClick={toggleAll}
                    >
                      {allOn ? <CheckIcon /> : someOn ? <CheckboxDashIcon /> : null}
                    </button>
                  </th>
                  <Th col="name" label="Task Name" cls="stm-col-name" sort={sort} toggle={toggleSort} />
                  <Th col="type" label="Type" cls="stm-col-type" sort={sort} toggle={toggleSort} />
                  <Th col="certs" label="Certifications" cls="stm-col-certs" sort={sort} toggle={toggleSort} />
                  <Th col="dateModified" label="Date Modified" cls="stm-col-edited" sort={sort} toggle={toggleSort} />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table">
                <ColGroup />
                <tbody>
                  {rows.map((t) => {
                    const on = picked.includes(t.id);
                    return (
                      <tr
                        key={t.id}
                        className={`${on ? "selected" : ""} ${t.hidden ? "task-dim" : ""}`}
                        onClick={() => toggle(t.id)}
                      >
                        <td className="stm-col-check">
                          {/* A <button>, not a <span> — the shared table reset
                              strips chrome from span/div in data cells, which
                              would leave a bare tick with no box. */}
                          <button
                            className={`checkbox ${on ? "checked" : ""}`}
                            aria-label={on ? "Deselect" : "Select"}
                            aria-pressed={on}
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(t.id);
                            }}
                          >
                            {on && <CheckIcon />}
                          </button>
                        </td>
                        {/* `col-name` is the shared Name-column class: it
                            carries the #FFFFFF emphasis this node wants, and
                            it is one of the classes the app-wide "mute every
                            non-Name cell" rule excludes. Without it that rule
                            (five :not()s deep) silently wins. */}
                        <td className="stm-col-name col-name">
                          <span className="tsk-name">{t.name}</span>
                          {/* The Tasks table's Hidden treatment (`.task-dim`):
                              grey pill, muted name, dimmed cells. */}
                          {t.hidden && <span className="pr-name-flag pr-name-flag--grey">Hidden</span>}
                        </td>
                        <td className="stm-col-type">{t.type}</td>
                        <td className="stm-col-certs">
                          <MultiCell values={certsOf(t)} />
                        </td>
                        <td className="stm-col-edited">{t.dateModified ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <TableEmpty />}
          </div>

          <div className="pagination stm-pagination">
            <span className="stm-picked">{picked.length} Selected</span>
            <span>
              Showing {sorted.length === 0 ? 0 : start + 1} -{" "}
              {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
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

/* The app-wide table rule (Spotlights, Name Change Requests…): every column is sized
   to what it holds — Task Name, Type ("Hands-On Task"), Certifications
   ("HVAC JobReady +1"), Date Modified (label + sort caret) — their sum is the
   floor, and on a wider modal the fixed layout spreads the slack across them
   in proportion, so the gaps grow evenly. */
const CHECK_W = 44;
const COL_WIDTHS = [340, 160, 200, 130];
const TABLE_MIN = CHECK_W + COL_WIDTHS.reduce((n, w) => n + w, 0);

/* Check gutter fixed, data columns share the slack — see TableCols. */
function ColGroup() {
  return <TableCols lead={[CHECK_W]} data={COL_WIDTHS} />;
}

/* Figma 682:2582 (Certifications) / 1138:1174 (Industry): a cell holding more
 * than one value shows the FIRST one, ellipsised to the column, then "+N" for
 * the rest — "EPA 608 Universal Certi… +1". The counter is outside the
 * truncating span so it is never the part that gets cut. An empty cell reads
 * as an em dash, the app-wide empty-cell marker (the node draws a hyphen).
 * The whole list is on the tooltip. */
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
  col,
  label,
  cls,
  sort,
  toggle,
}: {
  col: SortKey;
  label: string;
  cls: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className={cls} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
