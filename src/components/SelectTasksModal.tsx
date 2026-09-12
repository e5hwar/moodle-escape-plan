import { useEffect, useMemo, useState } from "react";
import { tasks as taskLibrary, type Task, type TaskType } from "../data/tasks";
import { certifications } from "../data/certifications";
import { PrmModal } from "./PrmModal";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchClearIcon,
  SearchIcon,
  SortIcon,
} from "./icons";

/* Select Tasks — Figma 682:2321. A compact version of the Tasks page table
 * inside the shared PrmModal shell: search bar, two filter pills, a 5-column
 * table and pagination, with Cancel / Continue in the modal's own footer.
 *
 * Distinct from AddExistingTasksModal (the Certification wizard's Task Library),
 * which is a much larger surface with a preview panel, Industries and cert
 * types. This one is deliberately the smaller sibling.
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

type SortKey = "name" | "type" | "certs" | "industry" | "dateModified";
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
    case "industry":
      return industriesOf(a).join(", ").localeCompare(industriesOf(b).join(", "));
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
  const [types, setTypes] = useState<string[]>([]);
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

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
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

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const rows = sorted.slice(start, start + PAGE_SIZE);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
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
      pick
      pickWide
      onCancel={onCancel}
      onConfirm={() => onConfirm(picked)}
    >
      <div className="stm">
        <div className="stm-toolbar">
          <div className="search-wrap stm-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            {/* The picker opens ready to type — searching is the first thing
                anyone does here, and nothing else on the card wants focus. */}
            <input
              className="search-input stm-search-input"
              placeholder="Search Tasks..."
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {/* Shared clear ✕ (Figma 902:3585): appears only once there is
                something to clear, and keeps focus in the field. */}
            {query && (
              <button
                type="button"
                className="search-clear"
                aria-label="Clear search"
                title="Clear search"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <SearchClearIcon />
              </button>
            )}
          </div>

          <div className="filters stm-filters">
            <Dropdown
              width={220}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Task Type"
                  tip="Filter by Task Type"
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

            <Dropdown
              width={200}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Task Visibility"
                  tip="Filter by whether the Task is visible to learners"
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
                  tip="Filter by the Certifications a Task is used in"
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
                  label="Industry"
                  tip="Filter by the Industry a Task’s Certifications belong to"
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
          {/* Column-width floor, per the shared table convention — below it the
              table scrolls sideways instead of crushing the cells. 44 check +
              240 name + 136 type + 224 certs + 184 industry + 126 edited. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": "954px" } as React.CSSProperties}
          >
            <table className="table table-head stm-table">
              <ColGroup />
              <thead>
                <tr>
                  {/* Spacer only — the node's header carries a Radial Button
                      with a transparent border to hold the column, not a
                      select-all control. */}
                  <th className="stm-col-check no-sort" />
                  <Th col="name" label="Task Name" cls="stm-col-name" sort={sort} toggle={toggleSort} />
                  <Th col="type" label="Task Type" cls="stm-col-type" sort={sort} toggle={toggleSort} />
                  <Th col="certs" label="Certifications" cls="stm-col-certs" sort={sort} toggle={toggleSort} />
                  <Th col="industry" label="Industry" cls="stm-col-industry" sort={sort} toggle={toggleSort} />
                  <Th col="dateModified" label="Edited On" cls="stm-col-edited" sort={sort} toggle={toggleSort} />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table">
                <ColGroup />
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="stm-empty-row">
                      <td colSpan={6}>No Tasks match your search and filters.</td>
                    </tr>
                  ) : (
                    rows.map((t) => {
                      const on = picked.includes(t.id);
                      return (
                        <tr
                          key={t.id}
                          className={on ? "selected" : ""}
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
                          <td className="stm-col-name col-name">{t.name}</td>
                          <td className="stm-col-type">{t.type}</td>
                          <td className="stm-col-certs">
                            <MultiCell values={certsOf(t)} />
                          </td>
                          <td className="stm-col-industry">
                            <MultiCell values={industriesOf(t)} />
                          </td>
                          <td className="stm-col-edited">{t.dateModified ?? "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pagination stm-pagination">
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
                <ChevronLeftIcon />
              </button>
              <button
                className="page-btn"
                disabled={visiblePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PrmModal>
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: 44 }} />
      <col />
      <col style={{ width: 136 }} />
      <col style={{ width: 224 }} />
      <col style={{ width: 184 }} />
      <col style={{ width: 126 }} />
    </colgroup>
  );
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
    <span className="stm-multi" title={values.join(", ")}>
      <span className="stm-multi-first">{values[0]}</span>
      {values.length > 1 && (
        <span className="stm-multi-more">+{values.length - 1}</span>
      )}
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
