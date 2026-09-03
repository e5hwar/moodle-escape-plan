import { useEffect, useMemo, useState } from "react";
import {
  tasks as taskLibrary,
  discoverableLabel,
  subscriptionLabel,
  type Task,
} from "../data/tasks";
import { certifications } from "../data/certifications";
import {
  Filters,
  PillTrigger,
  SectionedMultiSelect,
  summarize,
  type FilterState,
} from "./Filters";
import { TasksSearch } from "./TasksSearch";
import { Dropdown } from "./Dropdown";
import { SortIcon, CheckIcon, SmallXIcon, SearchIcon } from "./icons";

/* The library Task picker for the Certification wizard's Add Tasks step. It is a
 * full table view rather than a dropdown: same search bar, filter pills, sorting
 * and column vocabulary as the standalone Tasks page, plus the two things the
 * wizard needs that the page doesn't — multi-select, and a per-row Preview that
 * opens the Task in its own tab (the same ?editTask= route the Hands-On review
 * screen uses) rather than in a side panel. */

/** Opens one of the app's standalone, full-tab pages. */
function openInNewTab(query: string) {
  window.open(`${window.location.origin}${window.location.pathname}?${query}`, "_blank", "noopener");
}

// A Task has no Industry of its own — it inherits the Industries of every
// Certification it is used in. The Industries column checks those against the
// Industry the Certification being built belongs to.
const CERT_INDUSTRY = new Map(certifications.map((c) => [c.name, c.industry]));
const CERT_TYPE = new Map(
  certifications.map((c) => [c.name, c.type as string | undefined]),
);

const ALL_INDUSTRIES = Array.from(
  new Set(certifications.map((c) => c.industry)),
).sort();

function taskIndustries(t: Task): string[] {
  return Array.from(
    new Set(
      t.usedIn
        .map((name) => CERT_INDUSTRY.get(name))
        .filter((i): i is string => !!i),
    ),
  );
}

function taskCertTypes(t: Task): string[] {
  return Array.from(
    new Set(
      t.usedIn
        .map((name) => CERT_TYPE.get(name))
        .filter((v): v is string => !!v),
    ),
  );
}

type SortKey = "name" | "usedIn" | "certType" | "type" | "industries";
type SortDir = "asc" | "desc";

function compare(a: Task, b: Task, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "usedIn":
      return (a.usedIn[0] ?? "").localeCompare(b.usedIn[0] ?? "");
    case "certType":
      return (taskCertTypes(a)[0] ?? "").localeCompare(taskCertTypes(b)[0] ?? "");
    case "type":
      return a.type.localeCompare(b.type);
    case "industries":
      return (taskIndustries(a)[0] ?? "").localeCompare(taskIndustries(b)[0] ?? "");
  }
}

export function AddExistingTasksModal({
  certIndustries,
  destination,
  existingNames,
  onCancel,
  onConfirm,
}: {
  /** Industries the Certification being built belongs to — drives the match check. */
  certIndustries: string[];
  /** Where the picked Tasks land, e.g. "Course 1 › Refrigerant Basics". */
  destination: string;
  /** Names of Tasks already in this Certification — shown as Added, not pickable. */
  existingNames: string[];
  onCancel: () => void;
  onConfirm: (tasks: Task[]) => void;
}) {
  const [committedQuery, setCommittedQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    creators: [],
    certifications: [],
    discoverable: [],
    subscription: [],
    types: [],
    visibilities: [],
    tags: [],
  });
  const [industries, setIndustries] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });
  const [picked, setPicked] = useState<string[]>([]);

  const already = useMemo(() => new Set(existingNames), [existingNames]);
  const certIndustrySet = useMemo(() => new Set(certIndustries), [certIndustries]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const filtered = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    return taskLibrary.filter((t) => {
      if (
        q &&
        !(
          t.id.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q)
        )
      )
        return false;
      if (filters.creators.length && !filters.creators.includes(t.createdBy)) return false;
      if (
        filters.certifications.length &&
        !t.usedIn.some((c) => filters.certifications.includes(c))
      )
        return false;
      if (filters.discoverable.length && !filters.discoverable.includes(discoverableLabel(t)))
        return false;
      if (filters.subscription.length && !filters.subscription.includes(subscriptionLabel(t)))
        return false;
      if (filters.types.length && !filters.types.includes(t.type)) return false;
      if (filters.tags.length && !(t.tags ?? []).some((tag) => filters.tags.includes(tag)))
        return false;
      if (industries.length && !taskIndustries(t).some((i) => industries.includes(i)))
        return false;
      return true;
    });
  }, [committedQuery, filters, industries]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  // Rows already in the Certification can't be picked again — a Task is reused,
  // not duplicated, so adding it twice is meaningless.
  const selectable = sorted.filter((t) => !already.has(t.name));
  const allPicked = selectable.length > 0 && selectable.every((t) => picked.includes(t.id));

  function toggle(t: Task) {
    if (already.has(t.name)) return;
    setPicked((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]));
  }

  function toggleAll() {
    if (allPicked) {
      const ids = new Set(selectable.map((t) => t.id));
      setPicked((p) => p.filter((x) => !ids.has(x)));
    } else {
      setPicked((p) => Array.from(new Set([...p, ...selectable.map((t) => t.id)])));
    }
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  // Natural table width — mirrors <ColGroup>.
  const tableMin =
    44 /* check */ +
    240 /* name */ +
    190 /* used in */ +
    120 /* cert type */ +
    150 /* task type */ +
    190 /* industries */ +
    104 /* preview */;

  function confirm() {
    const byId = new Map(taskLibrary.map((t) => [t.id, t]));
    onConfirm(picked.map((id) => byId.get(id)).filter((t): t is Task => !!t));
  }

  return (
    <div className="cl-modal-overlay" onClick={onCancel}>
      <div className="cl-modal aet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head aet-head">
          <div className="aet-head-text">
            <div className="cl-modal-eyebrow">
              <SearchIcon /> Task Library
            </div>
            <h3 className="cl-modal-title">Add Existing Tasks</h3>
            <p className="cl-modal-sub">
              Pick one or more Tasks from the library — they're reused, not duplicated, so
              edits made elsewhere flow through. Adding to <strong>{destination}</strong>.
            </p>
          </div>
          <button className="co-drawer-close" aria-label="Close" onClick={onCancel}>
            <SmallXIcon />
          </button>
        </div>

        <div className="aet-toolbar">
          <TasksSearch
            tasks={taskLibrary}
            certifications={filters.certifications}
            onCertificationsChange={(c) => setFilters({ ...filters, certifications: c })}
            types={filters.types}
            onTypesChange={(t) => setFilters({ ...filters, types: t })}
            query={committedQuery}
            onCommit={setCommittedQuery}
          />
        </div>

        <Filters
          filters={filters}
          setFilters={setFilters}
          extraPills={
            <IndustryPill value={industries} onApply={setIndustries} />
          }
          extraActive={industries.length}
          onClearExtra={() => setIndustries([])}
        />

        <div className="aet-body">
          <div className="aet-table-col">
            <div
              className="table-xscroll"
              style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}
            >
              <table className="table table-head">
                <ColGroup />
                <thead>
                  <tr>
                    <th className="aet-col-check no-sort">
                      <button
                        className={`checkbox ${allPicked ? "checked" : ""}`}
                        aria-label={allPicked ? "Clear selection" : "Select all"}
                        disabled={selectable.length === 0}
                        onClick={toggleAll}
                      >
                        {allPicked && <CheckIcon />}
                      </button>
                    </th>
                    <SortableHeader
                      col="name"
                      label="Task name"
                      className="aet-col-name"
                      sort={sort}
                      toggle={toggleSort}
                    />
                    <SortableHeader
                      col="usedIn"
                      label="Certifications Used In"
                      className="aet-col-used"
                      sort={sort}
                      toggle={toggleSort}
                    />
                    <SortableHeader
                      col="certType"
                      label="Type"
                      className="aet-col-certtype"
                      sort={sort}
                      toggle={toggleSort}
                    />
                    <SortableHeader
                      col="type"
                      label="Task Type"
                      className="aet-col-type"
                      sort={sort}
                      toggle={toggleSort}
                    />
                    <SortableHeader
                      col="industries"
                      label="Industries"
                      className="aet-col-inds"
                      sort={sort}
                      toggle={toggleSort}
                    />
                    <th className="aet-col-preview no-sort" />
                  </tr>
                </thead>
              </table>

              <div className="tasks-scroll">
                <table className="table table-body">
                  <ColGroup />
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr className="aet-empty-row">
                        <td colSpan={7}>
                          No Tasks match your search and filters.
                        </td>
                      </tr>
                    ) : (
                      sorted.map((t) => (
                        <Row
                          key={t.id}
                          task={t}
                          picked={picked.includes(t.id)}
                          added={already.has(t.name)}
                          certIndustries={certIndustrySet}
                          onToggle={() => toggle(t)}
                          onPreview={() => openInNewTab(`editTask=${t.id}`)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="aet-count">
              Showing {sorted.length} of {taskLibrary.length} Tasks
            </div>
          </div>

        </div>

        <div className="cl-modal-foot aet-foot">
          <span className="aet-selected">
            {picked.length === 0
              ? "No Tasks selected"
              : `${picked.length} Task${picked.length === 1 ? "" : "s"} selected`}
          </span>
          <div className="aet-foot-actions">
            {picked.length > 0 && (
              <button className="aet-clear" onClick={() => setPicked([])}>
                Clear selection
              </button>
            )}
            <button className="btn-save-draft" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn-publish" disabled={picked.length === 0} onClick={confirm}>
              {picked.length > 1 ? `Add ${picked.length} Tasks` : "Add Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: 44 }} />
      <col style={{ width: 240 }} />
      <col style={{ width: 190 }} />
      <col style={{ width: 120 }} />
      <col style={{ width: 150 }} />
      <col style={{ width: 190 }} />
      <col style={{ width: 104 }} />
    </colgroup>
  );
}

function SortableHeader({
  col,
  label,
  className,
  sort,
  toggle,
}: {
  col: SortKey;
  label: string;
  className?: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
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

function Row({
  task,
  picked,
  added,
  certIndustries,
  onToggle,
  onPreview,
}: {
  task: Task;
  picked: boolean;
  added: boolean;
  certIndustries: Set<string>;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const certTypes = taskCertTypes(task);
  const inds = taskIndustries(task);

  return (
    <tr
      className={`aet-row ${picked ? "picked" : ""} ${added ? "added" : ""}`}
      onClick={onToggle}
    >
      <td className="aet-col-check">
        {/* A <button>, not a <span> — the shared table reset strips chrome from
            span/div in data cells, which would leave a bare tick with no box. */}
        <button
          className={`checkbox ${picked ? "checked" : ""} ${added ? "is-disabled" : ""}`}
          aria-label={added ? "Already added" : picked ? "Deselect" : "Select"}
          aria-pressed={picked || added}
          disabled={added}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {(picked || added) && <CheckIcon />}
        </button>
      </td>
      <td className="aet-col-name" data-tip={task.name}>
        <span className="aet-name-text">{task.name}</span>
        {task.finalExam && <span className="aet-flag">Final Exam</span>}
        {added && <span className="aet-added">Added</span>}
      </td>
      <td
        className="aet-col-used"
        data-tip={task.usedIn.length ? task.usedIn.join("\n") : undefined}
      >
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
      <td
        className="aet-col-certtype"
        data-tip={certTypes.length ? certTypes.join("\n") : undefined}
      >
        {certTypes.length === 0 ? (
          "—"
        ) : (
          <>
            {certTypes[0]}
            {certTypes.length > 1 && (
              <span className="used-extra">+{certTypes.length - 1}</span>
            )}
          </>
        )}
      </td>
      {/* Plain text, per the shared table convention — no type badge in a cell. */}
      <td className="aet-col-type">{task.type}</td>
      <td className="aet-col-inds" data-tip={inds.length ? inds.join("\n") : undefined}>
        {inds.length === 0 ? (
          <span className="aet-ind-none">—</span>
        ) : (
          <span className="aet-inds">
            {inds.map((i) => (
              <IndustryChip key={i} name={i} match={certIndustries.has(i)} />
            ))}
          </span>
        )}
      </td>
      <td className="aet-col-preview">
        <button
          className="aet-preview-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          Preview
        </button>
      </td>
    </tr>
  );
}

/** An Industry the Task inherits from a Certification it's used in. Industries
 * the Certification being built belongs to are checked and accented. */
function IndustryChip({ name, match }: { name: string; match: boolean }) {
  return (
    <span className={`aet-ind ${match ? "match" : ""}`} title={match ? `${name} — matches this Certification` : name}>
      {match && (
        <span className="aet-ind-check">
          <CheckIcon />
        </span>
      )}
      {name}
    </span>
  );
}

function IndustryPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, ALL_INDUSTRIES);
  return (
    <Dropdown
      width={260}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Industry"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: ALL_INDUSTRIES }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable
          searchPlaceholder="Search industries…"
        />
      )}
    </Dropdown>
  );
}
