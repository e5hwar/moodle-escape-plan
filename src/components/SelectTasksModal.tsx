import { useEffect, useMemo, useState } from "react";
import { tasks as taskLibrary, type Task, type TaskType } from "../data/tasks";
import { PrmModal } from "./PrmModal";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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

type SortKey = "name" | "type" | "certs" | "dateModified";
type SortDir = "asc" | "desc";

/** The node's subtitle is a rule, not decoration: only SkillCat's own Tasks are
 *  eligible. */
function eligible(t: Task) {
  return t.createdBy === "SkillCat";
}

function certsOf(t: Task) {
  return t.usedIn.join(", ");
}

function compare(a: Task, b: Task, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "type":
      return a.type.localeCompare(b.type);
    case "certs":
      return certsOf(a).localeCompare(certsOf(b));
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
  const [certs, setCerts] = useState<string[]>([]);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((t) => {
      if (
        q &&
        !(t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
      )
        return false;
      if (types.length && !types.includes(t.type)) return false;
      if (certs.length && !t.usedIn.some((c) => certs.includes(c))) return false;
      return true;
    });
  }, [pool, query, types, certs]);

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
      onCancel={onCancel}
      onConfirm={() => onConfirm(picked)}
    >
      <div className="stm">
        <div className="stm-toolbar">
          <div className="search-wrap stm-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input stm-search-input"
              placeholder="Search Tasks"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
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
              width={260}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Certifications"
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
          </div>
        </div>

        <div className="stm-table-wrap">
          {/* Column-width floor, per the shared table convention — below it the
              table scrolls sideways instead of crushing the cells. 44 check +
              240 name + 136 type + 224 certs + 126 edited. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": "770px" } as React.CSSProperties}
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
                      <td colSpan={5}>No Tasks match your search and filters.</td>
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
                          <td className="stm-col-certs">{certsOf(t) || ""}</td>
                          <td className="stm-col-edited">{t.dateModified ?? ""}</td>
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
      <col style={{ width: 126 }} />
    </colgroup>
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
