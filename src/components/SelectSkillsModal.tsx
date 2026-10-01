import { useEffect, useMemo, useState } from "react";
import { SKILL_STATUSES, type Skill } from "../data/skills";
import {
  skillTaskNames,
  skillCertifications,
  skillIndustries,
  INDUSTRY_OPTIONS,
  matchesIndustry,
} from "../data/skillGraph";
import { PrmModal } from "./PrmModal";
import { TableCols } from "./TableCols";
import { MultiPill } from "./UsersFilters";
import { FILTER_TIPS } from "../data/filterTips";
import { CheckIcon, SearchIcon, SortIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { SearchTrailing } from "./SearchPanelParts";

/* Select Skills — the Mastery Skill wizard's Linked Skills picker. The same
 * table-picker chrome as Select Tasks (Figma 682:2321, `.stm-*`, full-screen
 * PrmModal): search, filter pills, a compact Skills table carrying the Skills
 * table's column names with a select-all header, and pagination, with Cancel /
 * Continue in the modal footer.
 *
 * Selection is staged: the modal owns `picked` and only hands it back on
 * Continue, so Cancel discards. */

const PAGE_SIZE = 50;

type SortKey = "name" | "tasks" | "certs" | "industry" | "dateModified";
type SortDir = "asc" | "desc";

const uniq = (xs: string[]) => [...new Set(xs)];

function compare(a: Skill, b: Skill, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "tasks":
      return skillTaskNames(a).join(", ").localeCompare(skillTaskNames(b).join(", "));
    case "certs":
      return uniq(skillCertifications(a)).join(", ").localeCompare(uniq(skillCertifications(b)).join(", "));
    case "industry":
      return skillIndustries(a).join(", ").localeCompare(skillIndustries(b).join(", "));
    case "dateModified":
      return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
  }
}

export function SelectSkillsModal({
  skills,
  value,
  onCancel,
  onConfirm,
}: {
  /** Every Skill on the page (Mastery Skills are not candidates). */
  skills: Skill[];
  /** Skill ids already chosen on the field — the modal opens pre-ticked. */
  value: string[];
  onCancel: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  /* Opens on Active Skills only — an archived Skill can't be earned, so it
     would make the Mastery Skill unearnable. Clearing the pill reveals them. */
  const [statuses, setStatuses] = useState<string[]>(["Active"]);
  const [taskF, setTaskF] = useState<string[]>([]);
  const [certs, setCerts] = useState<string[]>([]);
  const [inds, setInds] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(value);
  const [page, setPage] = useState(1);
  // Default sort is by last edited — newest first, as Select Tasks opens.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "dateModified", dir: "desc" });

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const allTasks = useMemo(() => uniq(skills.flatMap(skillTaskNames)).sort(), [skills]);
  const allCerts = useMemo(() => uniq(skills.flatMap(skillCertifications)).sort(), [skills]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (q && !(s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))) return false;
      if (statuses.length && !statuses.includes(s.status)) return false;
      if (taskF.length && !skillTaskNames(s).some((t) => taskF.includes(t))) return false;
      if (certs.length && !skillCertifications(s).some((c) => certs.includes(c))) return false;
      if (inds.length && !matchesIndustry(s, inds)) return false;
      return true;
    });
  }, [skills, query, statuses, taskF, certs, inds]);

  /* The Skills already on the field when the picker opened are pinned to the
     top, ticked, whatever the search or filters say — hiding one would leave
     no way to see or untick it. Pinned by the OPENING value, so unticking one
     doesn't make it jump away mid-edit. */
  const [pinnedIds] = useState(value);
  const sorted = useMemo(() => {
    const order = (arr: Skill[]) => {
      const out = [...arr].sort((a, b) => compare(a, b, sort.key));
      return sort.dir === "desc" ? out.reverse() : out;
    };
    const pinned = order(
      pinnedIds.flatMap((id) => {
        const s = skills.find((x) => x.id === id);
        return s ? [s] : [];
      }),
    );
    return [...pinned, ...order(filtered.filter((s) => !pinnedIds.includes(s.id)))];
  }, [skills, filtered, sort, pinnedIds]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const rows = sorted.slice(start, start + PAGE_SIZE);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  /* Continue only once there's something to hand back: at least one Skill
     ticked, and a set that differs from what the field already holds. */
  const changed = picked.length !== value.length || picked.some((id) => !value.includes(id));
  const canContinue = picked.length > 0 && changed;

  /* Select-all covers every row the current search and filters match, not
     just the visible page — the Select Tasks / Select Questions scope. */
  const pickedHere = useMemo(() => sorted.filter((s) => picked.includes(s.id)).length, [sorted, picked]);
  const allOn = sorted.length > 0 && pickedHere === sorted.length;
  const someOn = pickedHere > 0 && !allOn;

  function toggleAll() {
    const ids = new Set(sorted.map((s) => s.id));
    setPicked((p) =>
      allOn ? p.filter((id) => !ids.has(id)) : [...p, ...sorted.filter((s) => !p.includes(s.id)).map((s) => s.id)],
    );
  }

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  /** Any filter change can shrink the list under the current page. */
  function resetPage(set: (v: string[]) => void) {
    return (v: string[]) => {
      set(v);
      setPage(1);
    };
  }

  const tips = FILTER_TIPS.skillPicker;

  return (
    <PrmModal
      title="Select Skills"
      description="Choose the Skills that make up this Mastery Skill"
      confirmLabel="Continue"
      pickFull
      confirmDisabled={!canContinue}
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
              className="search-input"
              placeholder="Search Skills..."
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
            <MultiPill label="Status" all={[...SKILL_STATUSES]} value={statuses} onApply={resetPage(setStatuses)} width={200} tip={tips.status} />
            <MultiPill
              label="Linked Task"
              all={allTasks}
              value={taskF}
              onApply={resetPage(setTaskF)}
              searchable
              searchPlaceholder="Search Tasks..."
              width={300}
              tip={tips.task}
            />
            <MultiPill
              label="Certifications"
              all={allCerts}
              value={certs}
              onApply={resetPage(setCerts)}
              searchable
              searchPlaceholder="Search Certifications..."
              width={300}
              tip={tips.certifications}
            />
            <MultiPill
              label="Industries"
              all={INDUSTRY_OPTIONS}
              value={inds}
              onApply={resetPage(setInds)}
              searchable
              searchPlaceholder="Search Industries/Sub-Industries..."
              width={300}
              tip={tips.industry}
            />
          </div>
        </div>

        <div className="stm-table-wrap">
          {/* Column-width floor = the sum of COL_WIDTHS — below it the table
              scrolls sideways instead of crushing the cells. */}
          <div className="table-xscroll" style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}>
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
                      {allOn ? <CheckIcon /> : someOn ? <span className="checkbox-dash" /> : null}
                    </button>
                  </th>
                  {/* The Skills table's own column names, in its order. */}
                  <Th col="name" label="Skill Name" cls="stm-col-name" sort={sort} toggle={toggleSort} />
                  <Th col="industry" label="Industries" cls="stm-col-industry" sort={sort} toggle={toggleSort} />
                  <Th col="tasks" label="Linked Tasks" cls="stm-col-certs" sort={sort} toggle={toggleSort} />
                  <Th col="certs" label="Linked Certifications" cls="stm-col-certs" sort={sort} toggle={toggleSort} />
                  <Th col="dateModified" label="Date Modified" cls="stm-col-edited" sort={sort} toggle={toggleSort} />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table">
                <ColGroup />
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="stm-empty-row">
                      <td colSpan={6}>No Skills match your search and filters.</td>
                    </tr>
                  ) : (
                    rows.map((s) => {
                      const on = picked.includes(s.id);
                      return (
                        <tr key={s.id} className={`${on ? "selected" : ""} ${s.status === "Archived" ? "task-dim" : ""}`} onClick={() => toggle(s.id)}>
                          <td className="stm-col-check">
                            {/* A <button>, not a <span> — the shared table reset
                                strips chrome from spans in data cells. */}
                            <button
                              className={`checkbox ${on ? "checked" : ""}`}
                              aria-label={on ? "Deselect" : "Select"}
                              aria-pressed={on}
                              tabIndex={-1}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(s.id);
                              }}
                            >
                              {on && <CheckIcon />}
                            </button>
                          </td>
                          {/* `col-name` carries the white Name emphasis and is
                              exempt from the app-wide muted-cell rule. */}
                          <td className="stm-col-name col-name">
                            <span className="tsk-name">{s.name}</span>
                            {/* The shared dim-row treatment (`.task-dim`) — reads
                                exactly as an archived row on the Skills table. */}
                            {s.status === "Archived" && <span className="pr-name-flag pr-name-flag--grey">Archived</span>}
                          </td>
                          <td className="stm-col-industry"><MultiCell values={skillIndustries(s)} /></td>
                          <td className="stm-col-certs"><MultiCell values={skillTaskNames(s)} /></td>
                          <td className="stm-col-certs"><MultiCell values={uniq(skillCertifications(s))} /></td>
                          <td className="stm-col-edited">{s.dateModified || "—"}</td>
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
              Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                <PagePrevIcon />
              </button>
              <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                <PageNextIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PrmModal>
  );
}

/* The app-wide table rule: every column is sized to what it holds —
   Skill Name, Industries (top-level only, "HVAC +1"), Linked Tasks (the
   longest names), Linked Certifications (its label sets the width), Date
   Modified (label + sort caret). Their sum is the floor; on a wider modal the
   fixed layout spreads the slack across them in proportion. */
const CHECK_W = 44;
const COL_WIDTHS = [340, 140, 280, 200, 130];
const TABLE_MIN = CHECK_W + COL_WIDTHS.reduce((n, w) => n + w, 0);

/* Check gutter fixed, data columns share the slack — see TableCols. */
function ColGroup() {
  return <TableCols lead={[CHECK_W]} data={COL_WIDTHS} />;
}

/* First value ellipsised, then "+N" for the rest — Select Tasks' cell. */
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
  col, label, cls, sort, toggle,
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
