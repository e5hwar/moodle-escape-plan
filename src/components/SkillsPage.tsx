import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  skills as seedSkills,
  masterySkills as seedMastery,
  masteryUsing,
  criteriaSummary,
  criteriaRule,
  taskById,
  skillById,
  fmtHolders,
  SKILL_STATUSES,
  type Skill,
  type MasterySkill,
} from "../data/skills";
import { CREATED_BY_IN_HOUSE, CREATED_BY_B2B } from "../data/filters";
import { Dropdown } from "./Dropdown";
import { PillTrigger, summarize, SectionedMultiSelect, CheckRow } from "./Filters";
import { NewSkillWizard, SkillBadge } from "./NewSkillWizard";
import { SearchIcon, SortIcon, AddIcon, EditColumnsIcon, RowEditIcon, RowKebabIcon, MenuArchiveIcon, RowDeleteIcon, MenuPlaceholderIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

const PAGE_SIZE = 50;

/* ─────────────── Local icons ─────────────── */
const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

type Tab = "skills" | "mastery";
type SortDir = "asc" | "desc";

type Mode =
  | { kind: "list" }
  | { kind: "new-skill" }
  | { kind: "edit-skill"; skill: Skill }
  | { kind: "new-mastery" }
  | { kind: "edit-mastery"; mastery: MasterySkill };

type Modal =
  | { kind: "none" }
  | { kind: "archive-skill"; skill: Skill; linked: MasterySkill[] }
  | { kind: "delete-skill-blocked"; skill: Skill; linked: MasterySkill[] }
  | { kind: "delete-skill"; skill: Skill }
  | { kind: "delete-mastery"; mastery: MasterySkill };

const ALL_CREATORS = [...CREATED_BY_IN_HOUSE, ...CREATED_BY_B2B];

type SkillColKey = "id" | "tasks" | "criteria" | "mastery" | "status" | "holders" | "dateCreated" | "dateModified";
type MasteryColKey = "id" | "skills" | "status" | "holders" | "dateCreated" | "dateModified";

const SKILL_COLS: { key: SkillColKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "tasks", label: "Tasks" },
  { key: "criteria", label: "Criteria" },
  { key: "mastery", label: "Mastery Skills" },
  { key: "status", label: "Status" },
  { key: "holders", label: "Holders" },
  { key: "dateCreated", label: "Date Created" },
  { key: "dateModified", label: "Date Modified" },
];
const MASTERY_COLS: { key: MasteryColKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "skills", label: "Skills" },
  { key: "status", label: "Status" },
  { key: "holders", label: "Holders" },
  { key: "dateCreated", label: "Date Created" },
  { key: "dateModified", label: "Date Modified" },
];

export function SkillsPage() {
  const [tab, setTab] = useState<Tab>("skills");
  const [skills, setSkills] = useState<Skill[]>(seedSkills);
  const [mastery, setMastery] = useState<MasterySkill[]>(seedMastery);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  useCreateShortcut(
    () => setMode(tab === "skills" ? { kind: "new-skill" } : { kind: "new-mastery" }),
    mode.kind === "list",
  );
  const [menu, setMenu] = useState<{ rect: DOMRect; tab: Tab; id: string } | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [creatorFilter, setCreatorFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "id", dir: "desc" });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [skillCols, setSkillCols] = useState<Record<SkillColKey, boolean>>({
    id: true, tasks: true, criteria: false, mastery: true, status: true, holders: true, dateCreated: false, dateModified: false,
  });
  const [masteryCols, setMasteryCols] = useState<Record<MasteryColKey, boolean>>({
    id: true, skills: true, status: true, holders: true, dateCreated: false, dateModified: false,
  });

  // Reset paging/sort context when switching tabs or filtering.
  useEffect(() => setPage(1), [query, statusFilter, creatorFilter, sort, tab]);

  /* ─── Mutations ─── */
  function upsertSkill(s: Skill) {
    setSkills((prev) => {
      const i = prev.findIndex((x) => x.id === s.id);
      if (i < 0) return [s, ...prev];
      const next = [...prev]; next[i] = s; return next;
    });
  }
  function upsertMastery(m: MasterySkill) {
    setMastery((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i < 0) return [m, ...prev];
      const next = [...prev]; next[i] = m; return next;
    });
  }
  function setSkillStatus(id: string, status: Skill["status"]) {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }
  function setMasteryStatus(id: string, status: MasterySkill["status"]) {
    setMastery((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }
  function deleteSkill(id: string) {
    setSkills((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function deleteMastery(id: string) {
    setMastery((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  /* ─── Menu actions ─── */
  function archiveSkill(s: Skill) {
    if (s.status === "Archived") { setSkillStatus(s.id, "Active"); return; }
    const linked = masteryUsing(s.id, mastery);
    if (linked.length > 0) setModal({ kind: "archive-skill", skill: s, linked });
    else setSkillStatus(s.id, "Archived");
  }
  function requestDeleteSkill(s: Skill) {
    const linked = masteryUsing(s.id, mastery);
    if (linked.length > 0) setModal({ kind: "delete-skill-blocked", skill: s, linked });
    else setModal({ kind: "delete-skill", skill: s });
  }

  /* ─── Derived list ─── */
  const activeSkillCount = skills.filter((s) => s.status === "Active").length;
  const activeMasteryCount = mastery.filter((m) => m.status === "Active").length;

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (q && !(s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))) return false;
      if (statusFilter.length && !statusFilter.includes(s.status)) return false;
      if (creatorFilter.length && !creatorFilter.includes(s.createdBy)) return false;
      return true;
    });
  }, [skills, query, statusFilter, creatorFilter]);

  const filteredMastery = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mastery.filter((m) => {
      if (q && !(m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))) return false;
      if (statusFilter.length && !statusFilter.includes(m.status)) return false;
      if (creatorFilter.length && !creatorFilter.includes(m.createdBy)) return false;
      return true;
    });
  }, [mastery, query, statusFilter, creatorFilter]);

  const sortedSkills = useMemo(() => {
    const arr = [...filteredSkills].sort((a, b) => compareSkill(a, b, sort.key, mastery));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filteredSkills, sort, mastery]);

  const sortedMastery = useMemo(() => {
    const arr = [...filteredMastery].sort((a, b) => compareMastery(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filteredMastery, sort]);

  const rows = tab === "skills" ? sortedSkills : sortedMastery;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);

  function toggleSort(key: string) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const sc = skillCols;
  const mc = masteryCols;
  const skillTableMin =
    240 /* name */ + 40 /* actions */ +
    (sc.id ? 100 : 0) + (sc.tasks ? 200 : 0) + (sc.criteria ? 110 : 0) + (sc.mastery ? 200 : 0) +
    (sc.status ? 110 : 0) + (sc.holders ? 110 : 0) +
    (sc.dateCreated ? 130 : 0) + (sc.dateModified ? 130 : 0);
  const masteryTableMin =
    240 + 40 +
    (mc.id ? 100 : 0) + (mc.skills ? 200 : 0) + (mc.status ? 110 : 0) +
    (mc.holders ? 110 : 0) +
    (mc.dateCreated ? 130 : 0) + (mc.dateModified ? 130 : 0);

  /* ─── Wizard routing (after all hooks) ─── */
  if (mode.kind === "new-skill" || mode.kind === "edit-skill") {
    return (
      <NewSkillWizard
        kind="skill"
        editingSkill={mode.kind === "edit-skill" ? mode.skill : undefined}
        allSkills={skills}
        allMastery={mastery}
        onClose={() => setMode({ kind: "list" })}
        onSaveSkill={(s) => upsertSkill(s)}
        onSaveMastery={() => {}}
      />
    );
  }
  if (mode.kind === "new-mastery" || mode.kind === "edit-mastery") {
    return (
      <NewSkillWizard
        kind="mastery"
        editingMastery={mode.kind === "edit-mastery" ? mode.mastery : undefined}
        allSkills={skills}
        allMastery={mastery}
        onClose={() => setMode({ kind: "list" })}
        onSaveSkill={() => {}}
        onSaveMastery={(m) => upsertMastery(m)}
      />
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Skills</h1>
              <div className="tasks-subtitle">
                {tab === "skills"
                  ? `${skills.length} Skills · ${activeSkillCount} Active`
                  : `${mastery.length} Mastery Skills · ${activeMasteryCount} Active`}
              </div>
            </div>
            <div className="tasks-header-actions">
              <button
                className="new-task"
                onClick={() => setMode(tab === "skills" ? { kind: "new-skill" } : { kind: "new-mastery" })}
              >
                <AddIcon />
                {tab === "skills" ? "Create Skill" : "Create Mastery Skill"}
                <span className="cta-kbd">C</span>
              </button>
            </div>
          </header>

          <div className="sk-tabbar">
            <button className={`sk-tab ${tab === "skills" ? "is-active" : ""}`} onClick={() => setTab("skills")}>
              Skills <span className="sk-tab-count">{skills.length}</span>
            </button>
            <button className={`sk-tab ${tab === "mastery" ? "is-active" : ""}`} onClick={() => setTab("mastery")}>
              Mastery Skills <span className="sk-tab-count">{mastery.length}</span>
            </button>
          </div>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <div className="search-wrap">
                  <span className="search-icon"><SearchIcon /></span>
                  <input
                    className="search-input"
                    placeholder={tab === "skills" ? "Search Skills by name or ID…" : "Search Mastery Skills by name or ID…"}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
                </div>
              </div>

              <div className="filters">
                <StatusPill value={statusFilter} onApply={setStatusFilter} />
                <CreatedByPill value={creatorFilter} onApply={setCreatorFilter} />
                {(statusFilter.length > 0 || creatorFilter.length > 0) && (
                  <button
                    className="filter-clear-link"
                    onClick={() => { setStatusFilter([]); setCreatorFilter([]); }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="co-table-row">
                <div className="co-table-col">
                  {tab === "skills" ? (
                    <div className="table-xscroll" style={{ "--table-min": `${skillTableMin}px` } as React.CSSProperties}>
                      <table className="table table-head">
                        <SkillColGroup cols={sc} />
                        <thead>
                          <tr>
                            <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                            {sc.id && <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />}
                            {sc.tasks && <SortableHeader col="tasks" label="Tasks" className="col-used" sort={sort} toggle={toggleSort} sortable={false} />}
                            {sc.criteria && <SortableHeader col="criteria" label="Criteria" className="col-type" sort={sort} toggle={toggleSort} />}
                            {sc.mastery && <SortableHeader col="mastery" label="Mastery Skills" className="col-used" sort={sort} toggle={toggleSort} />}
                            {sc.status && <SortableHeader col="status" label="Status" className="col-type" sort={sort} toggle={toggleSort} />}
                            {sc.holders && <SortableHeader col="holders" label="Holders" className="col-type" sort={sort} toggle={toggleSort} />}
                            {sc.dateCreated && <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />}
                            {sc.dateModified && <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />}
                            <th className="col-actions">
                              <ColumnsMenu optional={SKILL_COLS} fixed="Name" value={sc} onChange={(v) => setSkillCols(v as Record<SkillColKey, boolean>)} />
                            </th>
                          </tr>
                        </thead>
                      </table>

                      <div className="tasks-scroll">
                        <table className="table table-body">
                          <SkillColGroup cols={sc} />
                          <tbody>
                            {(paged as Skill[]).map((s) => (
                              <SkillRow
                                key={s.id}
                                skill={s}
                                cols={sc}
                                masteryLinked={masteryUsing(s.id, mastery)}
                                selected={s.id === selectedId}
                                onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                                onEdit={() => setMode({ kind: "edit-skill", skill: s })}
                                onMenu={(rect) => setMenu({ rect, tab: "skills", id: s.id })}
                                menuOpen={menu?.tab === "skills" && menu.id === s.id}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="table-xscroll" style={{ "--table-min": `${masteryTableMin}px` } as React.CSSProperties}>
                      <table className="table table-head">
                        <MasteryColGroup cols={mc} />
                        <thead>
                          <tr>
                            <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                            {mc.id && <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />}
                            {mc.skills && <SortableHeader col="skills" label="Skills" className="col-used" sort={sort} toggle={toggleSort} />}
                            {mc.status && <SortableHeader col="status" label="Status" className="col-type" sort={sort} toggle={toggleSort} />}
                            {mc.holders && <SortableHeader col="holders" label="Holders" className="col-type" sort={sort} toggle={toggleSort} />}
                            {mc.dateCreated && <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />}
                            {mc.dateModified && <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />}
                            <th className="col-actions">
                              <ColumnsMenu optional={MASTERY_COLS} fixed="Name" value={mc} onChange={(v) => setMasteryCols(v as Record<MasteryColKey, boolean>)} />
                            </th>
                          </tr>
                        </thead>
                      </table>

                      <div className="tasks-scroll">
                        <table className="table table-body">
                          <MasteryColGroup cols={mc} />
                          <tbody>
                            {(paged as MasterySkill[]).map((m) => (
                              <MasteryRow
                                key={m.id}
                                mastery={m}
                                cols={mc}
                                selected={m.id === selectedId}
                                onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                                onEdit={() => setMode({ kind: "edit-mastery", mastery: m })}
                                onMenu={(rect) => setMenu({ rect, tab: "mastery", id: m.id })}
                                menuOpen={menu?.tab === "mastery" && menu.id === m.id}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="pagination">
                    <span>
                      Showing {rows.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}
                    </span>
                    <div className="pagination-controls">
                      <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeftIcon /></button>
                      <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRightIcon /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (() => {
        if (menu.tab === "skills") {
          const s = skills.find((x) => x.id === menu.id);
          if (!s) return null;
          return (
            <ActionsMenu
              rect={menu.rect}
              title={s.name}
              subtitle={`${s.id} · ${criteriaSummary(s)}`}
              archived={s.status === "Archived"}
              archiveLabel="Skill"
              onClose={() => setMenu(null)}
              onEdit={() => setMode({ kind: "edit-skill", skill: s })}
              onArchive={() => archiveSkill(s)}
              onDelete={() => requestDeleteSkill(s)}
            />
          );
        }
        const m = mastery.find((x) => x.id === menu.id);
        if (!m) return null;
        return (
          <ActionsMenu
            rect={menu.rect}
            title={m.name}
            subtitle={`${m.id} · ${m.skillIds.length} Skill${m.skillIds.length === 1 ? "" : "s"}`}
            archived={m.status === "Archived"}
            archiveLabel="Mastery Skill"
            onClose={() => setMenu(null)}
            onEdit={() => setMode({ kind: "edit-mastery", mastery: m })}
            onArchive={() => setMasteryStatus(m.id, m.status === "Archived" ? "Active" : "Archived")}
            onDelete={() => setModal({ kind: "delete-mastery", mastery: m })}
          />
        );
      })()}

      {/* ─── Confirmation flows ─── */}
      {modal.kind === "archive-skill" && (
        <ConfirmModal
          title="Archive this Skill?"
          confirmLabel="Archive Skill"
          danger
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { setSkillStatus(modal.skill.id, "Archived"); setModal({ kind: "none" }); }}
        >
          <div className="form-warning" style={{ marginBottom: 0 }}>
            <span className="form-warning-icon"><WarnIcon /></span>
            <div>
              <strong>{modal.linked.length} Mastery Skill{modal.linked.length === 1 ? "" : "s"} will become unearnable for new users.</strong>{" "}
              <strong>{modal.skill.name}</strong> is one of their required Skills, and an archived Skill can’t be earned. Existing holders keep everything. Ideally remove this Skill from each Mastery Skill’s criteria first.
              <div className="sk-warn-chips">
                {modal.linked.map((m) => (
                  <span key={m.id} className="sk-chip"><SkillBadge emoji={m.image} size={18} mastery />{m.name}</span>
                ))}
              </div>
            </div>
          </div>
        </ConfirmModal>
      )}

      {modal.kind === "delete-skill-blocked" && (
        <ConfirmModal
          title="Can’t delete this Skill"
          confirmLabel="Edit Mastery Skills"
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => {
            const first = modal.linked[0];
            setModal({ kind: "none" });
            setTab("mastery");
            setMode({ kind: "edit-mastery", mastery: first });
          }}
        >
          <div className="form-warning" style={{ marginBottom: 0 }}>
            <span className="form-warning-icon"><WarnIcon /></span>
            <div>
              <strong>{modal.skill.name}</strong> is referenced by {modal.linked.length} Mastery Skill{modal.linked.length === 1 ? "" : "s"} and can’t be deleted. Remove it from their criteria first, then delete it.
              <div className="sk-warn-chips">
                {modal.linked.map((m) => (
                  <span key={m.id} className="sk-chip"><SkillBadge emoji={m.image} size={18} mastery />{m.name}</span>
                ))}
              </div>
            </div>
          </div>
        </ConfirmModal>
      )}

      {modal.kind === "delete-skill" && (
        <ConfirmModal
          title="Delete this Skill?"
          confirmLabel="Delete Skill"
          danger
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { deleteSkill(modal.skill.id); setModal({ kind: "none" }); }}
        >
          <p className="sk-modal-text">
            Delete <strong>{modal.skill.name}</strong> ({modal.skill.id})? This permanently removes it from the{" "}
            <strong>{fmtHolders(modal.skill.holders)}</strong> user{modal.skill.holders === 1 ? "" : "s"} who earned it — they will no longer hold this Skill. This can’t be undone.
          </p>
        </ConfirmModal>
      )}

      {modal.kind === "delete-mastery" && (
        <ConfirmModal
          title="Delete this Mastery Skill?"
          confirmLabel="Delete Mastery Skill"
          danger
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { deleteMastery(modal.mastery.id); setModal({ kind: "none" }); }}
        >
          <p className="sk-modal-text">
            Delete <strong>{modal.mastery.name}</strong> ({modal.mastery.id})? This removes it from the{" "}
            <strong>{fmtHolders(modal.mastery.holders)}</strong> user{modal.mastery.holders === 1 ? "" : "s"} who earned it. The constituent Skills are not affected. This can’t be undone.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

/* ─────────────── Sorting ─────────────── */

function compareSkill(a: Skill, b: Skill, key: string, mastery: MasterySkill[]): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "id": return a.id.localeCompare(b.id);
    case "criteria": return a.taskIds.length - b.taskIds.length;
    case "mastery": return masteryUsing(a.id, mastery).length - masteryUsing(b.id, mastery).length;
    case "status": return a.status.localeCompare(b.status);
    case "holders": return a.holders - b.holders;
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "dateCreated": return (Date.parse(a.dateCreated) || 0) - (Date.parse(b.dateCreated) || 0);
    case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
    default: return 0;
  }
}

function compareMastery(a: MasterySkill, b: MasterySkill, key: string): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "id": return a.id.localeCompare(b.id);
    case "skills": return a.skillIds.length - b.skillIds.length;
    case "status": return a.status.localeCompare(b.status);
    case "holders": return a.holders - b.holders;
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "dateCreated": return (Date.parse(a.dateCreated) || 0) - (Date.parse(b.dateCreated) || 0);
    case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
    default: return 0;
  }
}

/* ─────────────── Rows ─────────────── */

function SkillColGroup({ cols }: { cols: Record<SkillColKey, boolean> }) {
  return (
    <colgroup>
      <col style={{ width: 240 }} />
      {cols.id && <col style={{ width: 100 }} />}
      {cols.tasks && <col style={{ width: 200 }} />}
      {cols.criteria && <col style={{ width: 110 }} />}
      {cols.mastery && <col style={{ width: 200 }} />}
      {cols.status && <col style={{ width: 110 }} />}
      {cols.holders && <col style={{ width: 110 }} />}
      {cols.dateCreated && <col style={{ width: 130 }} />}
      {cols.dateModified && <col style={{ width: 130 }} />}
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function StatusBadge({ status }: { status: Skill["status"] }) {
  return <span className={`sk-status sk-status--${status.toLowerCase()}`}>{status}</span>;
}

/** First name in a list, plus a "+N" pill when there are more. */
function NamesCell({ names }: { names: string[] }) {
  if (names.length === 0) return <>—</>;
  const extra = names.length - 1;
  return (
    <span className="sk-tasks-cell">
      <span className="sk-tasks-name">{names[0]}</span>
      {extra > 0 && <span className="sk-tasks-more">+{extra}</span>}
    </span>
  );
}

/** Awarding Tasks: first Task name, plus a "+N" pill when the Skill has more. */
function TasksCell({ skill }: { skill: Skill }) {
  const names = skill.taskIds.map((id) => taskById(id)?.name ?? id);
  return <NamesCell names={names} />;
}

function SkillRow({
  skill, cols, masteryLinked, selected, onClick, onEdit, onMenu, menuOpen,
}: {
  skill: Skill;
  cols: Record<SkillColKey, boolean>;
  masteryLinked: MasterySkill[];
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const archived = skill.status === "Archived";
  return (
    <tr className={`${selected ? "selected" : ""} ${archived ? "task-hidden" : ""} ${menuOpen ? "menu-open" : ""}`} onClick={onClick}>
      <td className="col-name">
        {skill.name}
        {archived && <span className="hidden-badge">Archived</span>}
      </td>
      {cols.id && <td className="col-id">{skill.id}</td>}
      {cols.tasks && <td className="col-used"><TasksCell skill={skill} /></td>}
      {cols.criteria && <td className="col-type">{criteriaRule(skill)}</td>}
      {cols.mastery && <td className="col-used"><NamesCell names={masteryLinked.map((m) => m.name)} /></td>}
      {cols.status && <td className="col-type"><StatusBadge status={skill.status} /></td>}
      {cols.holders && <td className="col-type">{fmtHolders(skill.holders)}</td>}
      {cols.dateCreated && <td className="col-date">{skill.dateCreated}</td>}
      {cols.dateModified && <td className="col-date">{skill.dateModified}</td>}
      <RowActions onEdit={onEdit} onMenu={onMenu} editTitle="Edit Skill" />
    </tr>
  );
}

function MasteryColGroup({ cols }: { cols: Record<MasteryColKey, boolean> }) {
  return (
    <colgroup>
      <col style={{ width: 240 }} />
      {cols.id && <col style={{ width: 100 }} />}
      {cols.skills && <col style={{ width: 200 }} />}
      {cols.status && <col style={{ width: 110 }} />}
      {cols.holders && <col style={{ width: 110 }} />}
      {cols.dateCreated && <col style={{ width: 130 }} />}
      {cols.dateModified && <col style={{ width: 130 }} />}
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function MasteryRow({
  mastery, cols, selected, onClick, onEdit, onMenu, menuOpen,
}: {
  mastery: MasterySkill;
  cols: Record<MasteryColKey, boolean>;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const archived = mastery.status === "Archived";
  return (
    <tr className={`${selected ? "selected" : ""} ${archived ? "task-hidden" : ""} ${menuOpen ? "menu-open" : ""}`} onClick={onClick}>
      <td className="col-name">
        {mastery.name}
        {archived && <span className="hidden-badge">Archived</span>}
      </td>
      {cols.id && <td className="col-id">{mastery.id}</td>}
      {cols.skills && <td className="col-used"><NamesCell names={mastery.skillIds.map((id) => skillById(id)?.name ?? id)} /></td>}
      {cols.status && <td className="col-type"><StatusBadge status={mastery.status} /></td>}
      {cols.holders && <td className="col-type">{fmtHolders(mastery.holders)}</td>}
      {cols.dateCreated && <td className="col-date">{mastery.dateCreated}</td>}
      {cols.dateModified && <td className="col-date">{mastery.dateModified}</td>}
      <RowActions onEdit={onEdit} onMenu={onMenu} editTitle="Edit Mastery Skill" />
    </tr>
  );
}

function RowActions({
  onEdit, onMenu, editTitle,
}: {
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
  editTitle: string;
}) {
  return (
    <td className="col-actions">
      <button
        className="row-action-btn lone-dots"
        aria-label="More"
        onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget.getBoundingClientRect()); }}
      >
        <RowKebabIcon />
      </button>
      <div className="row-action-bar">
        <button className="row-action-btn" aria-label="Edit" title={editTitle} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <RowEditIcon />
        </button>
        <button className="row-action-btn" aria-label="More" onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget.getBoundingClientRect()); }}>
          <RowKebabIcon />
        </button>
      </div>
    </td>
  );
}

function SortableHeader({
  col, label, className, sort, toggle, sortable = true,
}: {
  col: string;
  label: string;
  className?: string;
  sort: { key: string; dir: SortDir };
  toggle: (k: string) => void;
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

/* ─────────────── Actions menu (fixed-positioned) ─────────────── */

function ActionsMenu({
  rect, title, subtitle, archived, archiveLabel, onClose, onArchive, onEdit, onDelete,
}: {
  rect: DOMRect;
  title: string;
  subtitle: string;
  archived: boolean;
  archiveLabel: string;
  onClose: () => void;
  onArchive: () => void;
  onEdit: () => void;
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
    function onDoc(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) onClose(); }
    function onScroll() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item = (icon: JSX.Element, label: string, onPick: () => void, danger = false) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
      onClick={(e) => { e.stopPropagation(); onPick(); onClose(); }}
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
        <div className="u-menu-head-name">{title}</div>
        <div className="u-menu-head-id">{subtitle}</div>
      </div>
      {archived
        ? item(<MenuPlaceholderIcon />, `Unarchive ${archiveLabel}`, onArchive)
        : item(<MenuArchiveIcon />, `Archive ${archiveLabel}`, onArchive)}
      {item(<RowEditIcon />, "Edit", onEdit)}
      {item(<RowDeleteIcon />, "Delete", onDelete, true)}
    </div>
  );
}

/* ─────────────── Confirm modal ─────────────── */

function ConfirmModal({
  title, confirmLabel, danger = false, children, onCancel, onConfirm,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="cl-modal-overlay" onClick={onCancel}>
      <div className="cl-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">{title}</h3>
        </div>
        <div style={{ padding: "0 24px 8px" }}>{children}</div>
        <div className="cl-modal-foot">
          <button className="btn-save-draft" onClick={onCancel}>Cancel</button>
          <button className={danger ? "sk-btn-danger" : "btn-publish"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Filters ─────────────── */

function StatusPill({ value, onApply }: { value: string[]; onApply: (v: string[]) => void }) {
  const summary = summarize(value, SKILL_STATUSES);
  return (
    <Dropdown
      width={200}
      trigger={({ open, toggle }) => (
        <PillTrigger label="Status" value={summary} open={open} toggle={toggle} onClear={() => onApply([])} />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...SKILL_STATUSES] }]}
          value={value}
          onApply={(v) => { onApply(v); close(); }}
        />
      )}
    </Dropdown>
  );
}

function CreatedByPill({ value, onApply }: { value: string[]; onApply: (v: string[]) => void }) {
  const summary = summarize(value, ALL_CREATORS);
  return (
    <Dropdown
      width={300}
      trigger={({ open, toggle }) => (
        <PillTrigger label="Created By" value={summary} open={open} toggle={toggle} onClear={() => onApply([])} />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[
            { label: "Made in house", items: CREATED_BY_IN_HOUSE },
            { label: "B2B customers", items: [...CREATED_BY_B2B].sort() },
          ]}
          subsectionStyle
          searchable
          searchPlaceholder="Search creators…"
          value={value}
          onApply={(v) => { onApply(v); close(); }}
        />
      )}
    </Dropdown>
  );
}

/* ─────────────── Columns editor ─────────────── */

function ColumnsMenu({
  optional, fixed, value, onChange,
}: {
  optional: { key: string; label: string }[];
  fixed: string;
  value: Record<string, boolean>;
  onChange: (v: Record<string, boolean>) => void;
}) {
  const active = optional.filter((c) => value[c.key]);
  const available = optional.filter((c) => !value[c.key]);
  return (
    <Dropdown
      width={240}
      align="right"
      trigger={({ toggle }) => (
        <button
          className="edit-columns-btn"
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          aria-label="Edit columns"
          data-tooltip="Edit Columns"
        >
          <EditColumnsIcon />
        </button>
      )}
    >
      {() => (
        <div className="dropdown-list cols-menu">
          <div className="dropdown-section">
            <div className="dropdown-section-label">Fixed columns</div>
            <div className="cols-fixed-row">{fixed}</div>
          </div>
          <div className="dropdown-section">
            <div className="dropdown-section-label">Active columns</div>
            {active.length === 0 ? (
              <div className="cols-empty">No active columns</div>
            ) : (
              active.map((c) => (
                <CheckRow key={c.key} label={c.label} checked draggable onChange={() => onChange({ ...value, [c.key]: false })} />
              ))
            )}
          </div>
          <div className="dropdown-section">
            <div className="dropdown-section-label">Available columns</div>
            {available.length === 0 ? (
              <div className="cols-empty">All columns are active</div>
            ) : (
              available.map((c) => (
                <CheckRow key={c.key} label={c.label} checked={false} onChange={() => onChange({ ...value, [c.key]: true })} />
              ))
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
