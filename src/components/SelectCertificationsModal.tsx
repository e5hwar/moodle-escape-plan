import { useEffect, useMemo, useState } from "react";
import { nodes as contentNodes, type ContentNode } from "../data/contentLinks";
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

/* Select Certifications — the shared table-picker chrome (Figma 682:2321,
 * `.stm-*`) that Select Tasks / Select Users / Select Questions already run on,
 * here over the Certification catalog. Opened from a Content Links section's
 * "+" button.
 *
 * Like Select Questions, rows that can't be added (already linked in this
 * section, or the Certification being edited) stay visible as ticked + locked
 * rather than disappearing, so the admin can see what's already taken.
 *
 * Selection is staged: the modal owns `picked` and only hands it back on
 * confirm, so Cancel / Escape discards. */

const PAGE_SIZE = 50;

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

type SortKey = "name" | "industry" | "level" | "tasksCount" | "enrolled";
type SortDir = "asc" | "desc";

function compare(a: ContentNode, b: ContentNode, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "industry":
      return (a.industry ?? "").localeCompare(b.industry ?? "");
    case "level":
      return LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);
    case "tasksCount":
      return a.tasksCount - b.tasksCount;
    case "enrolled":
      return (a.enrolled ?? 0) - (b.enrolled ?? 0);
  }
}

export function SelectCertificationsModal({
  title,
  description,
  confirmLabel = "Add Links",
  locked,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  /** Already linked in this section (plus the focused Certification itself) —
   *  shown ticked and un-clickable. */
  locked: Set<string>;
  onCancel: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
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

  // The page links Certifications to Certifications, so Courses and Tasks in
  // the content graph are not offered here.
  const pool = useMemo(
    () => contentNodes.filter((n) => n.kind === "Certification"),
    [],
  );

  const allIndustries = useMemo(
    () =>
      Array.from(new Set(pool.map((n) => n.industry).filter(Boolean))).sort() as string[],
    [pool],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((n) => {
      if (
        q &&
        !(
          n.name.toLowerCase().includes(q) ||
          (n.industry ?? "").toLowerCase().includes(q)
        )
      )
        return false;
      if (industries.length && !industries.includes(n.industry ?? "")) return false;
      if (levels.length && !levels.includes(n.level)) return false;
      return true;
    });
  }, [pool, query, industries, levels]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const rows = sorted.slice(start, start + PAGE_SIZE);

  function toggle(id: string) {
    if (locked.has(id)) return;
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
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      confirmDisabled={picked.length === 0}
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
              autoFocus
              className="search-input stm-search-input"
              placeholder="Search Certifications"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="filters stm-filters">
            <Dropdown
              width={260}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Industry"
                  value={summarize(industries, allIndustries)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setIndustries)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: allIndustries }]}
                  value={industries}
                  onApply={(v) => {
                    resetPage(setIndustries)(v);
                    close();
                  }}
                />
              )}
            </Dropdown>

            <Dropdown
              width={220}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Level"
                  value={summarize(levels, LEVELS)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setLevels)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: LEVELS }]}
                  value={levels}
                  onApply={(v) => {
                    resetPage(setLevels)(v);
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
              240 name + 200 industry + 136 level + 90 tasks + 110 enrolled. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": "820px" } as React.CSSProperties}
          >
            <table className="table table-head stm-table scm-table">
              <ColGroup />
              <thead>
                <tr>
                  {/* Spacer only — the node's header carries a Radial Button
                      with a transparent border to hold the column, not a
                      select-all control. */}
                  <th className="stm-col-check no-sort" />
                  <Th col="name" label="Certification" cls="scm-col-name" sort={sort} toggle={toggleSort} />
                  <Th col="industry" label="Industry" cls="scm-col-industry" sort={sort} toggle={toggleSort} />
                  <Th col="level" label="Level" cls="scm-col-level" sort={sort} toggle={toggleSort} />
                  <Th col="tasksCount" label="Tasks" cls="scm-col-tasks" sort={sort} toggle={toggleSort} />
                  <Th col="enrolled" label="Enrolled" cls="scm-col-enrolled" sort={sort} toggle={toggleSort} />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table scm-table">
                <ColGroup />
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="stm-empty-row">
                      <td colSpan={6}>
                        No Certifications match your search and filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((n) => {
                      const isLocked = locked.has(n.id);
                      const on = isLocked || picked.includes(n.id);
                      return (
                        <tr
                          key={n.id}
                          className={`${on ? "selected" : ""}${isLocked ? " is-locked" : ""}`}
                          onClick={() => toggle(n.id)}
                        >
                          <td className="stm-col-check">
                            {/* A <button>, not a <span> — the shared table reset
                                strips chrome from span/div in data cells, which
                                would leave a bare tick with no box. */}
                            <button
                              className={`checkbox ${on ? "checked" : ""}`}
                              aria-label={on ? "Deselect" : "Select"}
                              aria-pressed={on}
                              disabled={isLocked}
                              tabIndex={-1}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(n.id);
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
                          <td className="scm-col-name col-name">{n.name}</td>
                          <td className="scm-col-industry">{n.industry ?? ""}</td>
                          <td className="scm-col-level">{n.level}</td>
                          <td className="scm-col-tasks">{n.tasksCount}</td>
                          <td className="scm-col-enrolled">
                            {n.enrolled?.toLocaleString() ?? ""}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pagination stm-pagination">
            <span className="scm-picked">
              {picked.length} selected
            </span>
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
      <col style={{ width: 200 }} />
      <col style={{ width: 136 }} />
      <col style={{ width: 90 }} />
      <col style={{ width: 110 }} />
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
