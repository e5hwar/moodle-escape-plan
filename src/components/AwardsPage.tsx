import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  awards as seedAwards,
  designTemplates as seedTemplates,
  certName,
  certForAward,
  appearanceSummary,
  awardsUsingTemplate,
  templateUsageCount,
  fmtHolders,
  MERIT_HEX,
  MERIT_ORDER,
  MERIT_TIERS,
  AWARD_STATUSES,
  AWARD_COLS,
  TEMPLATE_COLS,
  type Award,
  type AwardDesignTemplate,
  type AwardColKey,
  type TemplateColKey,
} from "../data/awards";
import { Dropdown } from "./Dropdown";
import { PillTrigger, summarize, SectionedMultiSelect, CheckRow } from "./Filters";
import { NewAwardWizard } from "./NewAwardWizard";
import { NewDesignTemplateWizard } from "./NewDesignTemplateWizard";
import { SearchIcon, SortIcon, EnterKeyIcon, AddIcon, EditColumnsIcon } from "./icons";

const PAGE_SIZE = 50;

/* ─────────────── Local icons ─────────────── */
const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);
const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" />
  </svg>
);
const ArchiveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M9 12h6" />
  </svg>
);
const UnarchiveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M12 18v-6M9.5 14.5 12 12l2.5 2.5" />
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </svg>
);
const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

type Tab = "awards" | "templates";
type SortDir = "asc" | "desc";

type Mode =
  | { kind: "list" }
  | { kind: "new-award" }
  | { kind: "edit-award"; award: Award }
  | { kind: "new-template" }
  | { kind: "edit-template"; template: AwardDesignTemplate };

type Modal =
  | { kind: "none" }
  | { kind: "delete-award"; award: Award }
  | { kind: "delete-template-blocked"; template: AwardDesignTemplate; linked: Award[] }
  | { kind: "delete-template"; template: AwardDesignTemplate };

export function AwardsPage() {
  const [tab, setTab] = useState<Tab>("awards");
  const [awards, setAwards] = useState<Award[]>(seedAwards);
  const [templates, setTemplates] = useState<AwardDesignTemplate[]>(seedTemplates);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [menu, setMenu] = useState<{ rect: DOMRect; tab: Tab; id: string } | null>(null);

  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "tier", dir: "asc" });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [awardCols, setAwardCols] = useState<Record<AwardColKey, boolean>>({
    id: true, tier: true, appearances: true, status: true, holders: true, createdBy: false, dateCreated: false, dateModified: false,
  });
  const [templateCols, setTemplateCols] = useState<Record<TemplateColKey, boolean>>({
    id: true, usage: true, createdBy: true, dateCreated: false, dateModified: true,
  });

  useEffect(() => setPage(1), [query, tierFilter, statusFilter, sort, tab]);

  /* ─── Mutations ─── */
  function upsertAward(a: Award) {
    setAwards((prev) => {
      const i = prev.findIndex((x) => x.id === a.id);
      if (i < 0) return [a, ...prev];
      const next = [...prev]; next[i] = a; return next;
    });
  }
  function upsertTemplate(t: AwardDesignTemplate) {
    setTemplates((prev) => {
      const i = prev.findIndex((x) => x.id === t.id);
      if (i < 0) return [t, ...prev];
      const next = [...prev]; next[i] = t; return next;
    });
  }
  function setAwardStatus(id: string, status: Award["status"]) {
    setAwards((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }
  function deleteAward(id: string) {
    setAwards((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function deleteTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  /* ─── Menu actions ─── */
  function requestDeleteTemplate(t: AwardDesignTemplate) {
    const linked = awardsUsingTemplate(t.id, awards);
    if (linked.length > 0) setModal({ kind: "delete-template-blocked", template: t, linked });
    else setModal({ kind: "delete-template", template: t });
  }

  /* ─── Derived list ─── */
  const activeAwardCount = awards.filter((a) => a.status === "Active").length;

  const filteredAwards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return awards.filter((a) => {
      if (q && !(a.id.toLowerCase().includes(q) || certName(a).toLowerCase().includes(q))) return false;
      if (tierFilter.length && !tierFilter.includes(a.meritTier)) return false;
      if (statusFilter.length && !statusFilter.includes(a.status)) return false;
      return true;
    });
  }, [awards, query, tierFilter, statusFilter]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (q && !(t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [templates, query]);

  const sortedAwards = useMemo(() => {
    const arr = [...filteredAwards].sort((a, b) => compareAward(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filteredAwards, sort]);

  const sortedTemplates = useMemo(() => {
    const arr = [...filteredTemplates].sort((a, b) => compareTemplate(a, b, sort.key, awards));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filteredTemplates, sort, awards]);

  const rows = tab === "awards" ? sortedAwards : sortedTemplates;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);

  function toggleSort(key: string) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const ac = awardCols;
  const tc = templateCols;
  const awardTableMin =
    240 /* name */ + 48 /* actions */ +
    (ac.id ? 100 : 0) + (ac.tier ? 120 : 0) + (ac.appearances ? 160 : 0) +
    (ac.status ? 110 : 0) + (ac.holders ? 110 : 0) + (ac.createdBy ? 150 : 0) +
    (ac.dateCreated ? 130 : 0) + (ac.dateModified ? 130 : 0);
  const templateTableMin =
    72 /* thumb */ + 240 + 48 +
    (tc.id ? 100 : 0) + (tc.usage ? 130 : 0) + (tc.createdBy ? 150 : 0) +
    (tc.dateCreated ? 130 : 0) + (tc.dateModified ? 130 : 0);

  /* ─── Wizard routing (after all hooks) ─── */
  if (mode.kind === "new-award" || mode.kind === "edit-award") {
    return (
      <NewAwardWizard
        editingAward={mode.kind === "edit-award" ? mode.award : undefined}
        allAwards={awards}
        templates={templates}
        onClose={() => setMode({ kind: "list" })}
        onSave={(a) => upsertAward(a)}
        onCreateTemplate={() => setMode({ kind: "new-template" })}
      />
    );
  }
  if (mode.kind === "new-template" || mode.kind === "edit-template") {
    return (
      <NewDesignTemplateWizard
        editingTemplate={mode.kind === "edit-template" ? mode.template : undefined}
        allTemplates={templates}
        onClose={() => setMode({ kind: "list" })}
        onSave={(t) => upsertTemplate(t)}
      />
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Awards</h1>
              <div className="tasks-subtitle">
                {tab === "awards"
                  ? `${awards.length} Awards · ${activeAwardCount} Active`
                  : `${templates.length} Design Templates`}
              </div>
            </div>
            <div className="tasks-header-actions">
              <button
                className="new-task"
                onClick={() => setMode(tab === "awards" ? { kind: "new-award" } : { kind: "new-template" })}
              >
                <AddIcon />
                {tab === "awards" ? "Create Award" : "Create Design Template"}
                <span className="cta-kbd"><EnterKeyIcon /></span>
              </button>
            </div>
          </header>

          <div className="sk-tabbar">
            <button className={`sk-tab ${tab === "awards" ? "is-active" : ""}`} onClick={() => setTab("awards")}>
              Awards <span className="sk-tab-count">{awards.length}</span>
            </button>
            <button className={`sk-tab ${tab === "templates" ? "is-active" : ""}`} onClick={() => setTab("templates")}>
              Design Templates <span className="sk-tab-count">{templates.length}</span>
            </button>
          </div>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <div className="search-wrap">
                  <span className="search-icon"><SearchIcon /></span>
                  <input
                    className="search-input"
                    placeholder={tab === "awards" ? "Search Awards by Certification or ID…" : "Search templates by name or ID…"}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
                </div>
              </div>

              {tab === "awards" && (
                <div className="filters">
                  <TierPill value={tierFilter} onApply={setTierFilter} />
                  <StatusPill value={statusFilter} onApply={setStatusFilter} />
                  {(tierFilter.length > 0 || statusFilter.length > 0) && (
                    <button
                      className="filter-clear-link"
                      onClick={() => { setTierFilter([]); setStatusFilter([]); }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}

              <div className="co-table-row">
                <div className="co-table-col">
                  {tab === "awards" ? (
                    <div className="table-xscroll" style={{ "--table-min": `${awardTableMin}px` } as React.CSSProperties}>
                      <table className="table table-head">
                        <AwardColGroup cols={ac} />
                        <thead>
                          <tr>
                            <SortableHeader col="name" label="Certification" className="col-name" sort={sort} toggle={toggleSort} />
                            {ac.id && <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />}
                            {ac.tier && <SortableHeader col="tier" label="Merit Tier" className="col-type" sort={sort} toggle={toggleSort} />}
                            {ac.appearances && <SortableHeader col="appearances" label="Appearances" className="col-used" sort={sort} toggle={toggleSort} sortable={false} />}
                            {ac.status && <SortableHeader col="status" label="Status" className="col-type" sort={sort} toggle={toggleSort} />}
                            {ac.holders && <SortableHeader col="holders" label="Holders" className="col-type" sort={sort} toggle={toggleSort} />}
                            {ac.createdBy && <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} sortable={false} />}
                            {ac.dateCreated && <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />}
                            {ac.dateModified && <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />}
                            <th className="col-actions">
                              <ColumnsMenu optional={AWARD_COLS} fixed="Certification" value={ac} onChange={(v) => setAwardCols(v as Record<AwardColKey, boolean>)} />
                            </th>
                          </tr>
                        </thead>
                      </table>

                      <div className="tasks-scroll">
                        <table className="table table-body">
                          <AwardColGroup cols={ac} />
                          <tbody>
                            {(paged as Award[]).map((a) => (
                              <AwardRow
                                key={a.id}
                                award={a}
                                cols={ac}
                                selected={a.id === selectedId}
                                onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                                onEdit={() => setMode({ kind: "edit-award", award: a })}
                                onMenu={(rect) => setMenu({ rect, tab: "awards", id: a.id })}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="table-xscroll" style={{ "--table-min": `${templateTableMin}px` } as React.CSSProperties}>
                      <table className="table table-head">
                        <TemplateColGroup cols={tc} />
                        <thead>
                          <tr>
                            <th className="aw-col-thumb" />
                            <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                            {tc.id && <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />}
                            {tc.usage && <SortableHeader col="usage" label="Used By" className="col-used" sort={sort} toggle={toggleSort} />}
                            {tc.createdBy && <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} sortable={false} />}
                            {tc.dateCreated && <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />}
                            {tc.dateModified && <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />}
                            <th className="col-actions">
                              <ColumnsMenu optional={TEMPLATE_COLS} fixed="Name" value={tc} onChange={(v) => setTemplateCols(v as Record<TemplateColKey, boolean>)} />
                            </th>
                          </tr>
                        </thead>
                      </table>

                      <div className="tasks-scroll">
                        <table className="table table-body">
                          <TemplateColGroup cols={tc} />
                          <tbody>
                            {(paged as AwardDesignTemplate[]).map((t) => (
                              <TemplateRow
                                key={t.id}
                                template={t}
                                cols={tc}
                                usage={templateUsageCount(t.id, awards)}
                                selected={t.id === selectedId}
                                onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                                onEdit={() => setMode({ kind: "edit-template", template: t })}
                                onMenu={(rect) => setMenu({ rect, tab: "templates", id: t.id })}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="pagination">
                    <span>
                      Showing {rows.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}
                    </span>
                    <div className="pagination-controls">
                      <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                      <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (() => {
        if (menu.tab === "awards") {
          const a = awards.find((x) => x.id === menu.id);
          if (!a) return null;
          return (
            <ActionsMenu
              rect={menu.rect}
              title={certName(a)}
              subtitle={`${a.id} · ${a.meritTier}`}
              archived={a.status === "Archived"}
              archiveLabel="Award"
              onClose={() => setMenu(null)}
              onEdit={() => setMode({ kind: "edit-award", award: a })}
              onArchive={() => setAwardStatus(a.id, a.status === "Archived" ? "Active" : "Archived")}
              onDelete={() => setModal({ kind: "delete-award", award: a })}
            />
          );
        }
        const t = templates.find((x) => x.id === menu.id);
        if (!t) return null;
        return (
          <ActionsMenu
            rect={menu.rect}
            title={t.name}
            subtitle={`${t.id} · ${templateUsageCount(t.id, awards)} use${templateUsageCount(t.id, awards) === 1 ? "" : "s"}`}
            archiveLabel="Template"
            onClose={() => setMenu(null)}
            onEdit={() => setMode({ kind: "edit-template", template: t })}
            onDelete={() => requestDeleteTemplate(t)}
          />
        );
      })()}

      {/* ─── Confirmation flows ─── */}
      {modal.kind === "delete-award" && (
        <ConfirmModal
          title="Delete this Award?"
          confirmLabel="Delete Award"
          danger
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { deleteAward(modal.award.id); setModal({ kind: "none" }); }}
        >
          <p className="sk-modal-text">
            Delete the Award for <strong>{certName(modal.award)}</strong> ({modal.award.id})? This
            permanently removes it from the <strong>{fmtHolders(modal.award.holders)}</strong> user
            {modal.award.holders === 1 ? "" : "s"} who earned it — their Card and Certificate, and
            the public verification page, will no longer be valid. This can’t be undone.
          </p>
        </ConfirmModal>
      )}

      {modal.kind === "delete-template-blocked" && (
        <ConfirmModal
          title="Can’t delete this template"
          confirmLabel="Edit linked Awards"
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => {
            const first = modal.linked[0];
            setModal({ kind: "none" });
            setTab("awards");
            setMode({ kind: "edit-award", award: first });
          }}
        >
          <div className="form-warning" style={{ marginBottom: 0 }}>
            <span className="form-warning-icon"><WarnIcon /></span>
            <div>
              <strong>{modal.template.name}</strong> is used by {modal.linked.length} Award
              {modal.linked.length === 1 ? "" : "s"} and can’t be deleted. Unlink it from each
              Award’s Card or Certificate design first, then delete it.
              <div className="sk-warn-chips">
                {modal.linked.map((a) => (
                  <span key={a.id} className="sk-chip">{certName(a)}</span>
                ))}
              </div>
            </div>
          </div>
        </ConfirmModal>
      )}

      {modal.kind === "delete-template" && (
        <ConfirmModal
          title="Delete this Design Template?"
          confirmLabel="Delete Template"
          danger
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { deleteTemplate(modal.template.id); setModal({ kind: "none" }); }}
        >
          <p className="sk-modal-text">
            Delete <strong>{modal.template.name}</strong> ({modal.template.id})? No Awards reference
            it, so nothing issued is affected. This can’t be undone.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

/* ─────────────── Sorting ─────────────── */

function compareAward(a: Award, b: Award, key: string): number {
  switch (key) {
    case "name": return certName(a).localeCompare(certName(b));
    case "id": return a.id.localeCompare(b.id);
    case "tier": return MERIT_ORDER[a.meritTier] - MERIT_ORDER[b.meritTier];
    case "appearances": return appearanceSummary(a).localeCompare(appearanceSummary(b));
    case "status": return a.status.localeCompare(b.status);
    case "holders": return a.holders - b.holders;
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "dateCreated": return (Date.parse(a.dateCreated) || 0) - (Date.parse(b.dateCreated) || 0);
    case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
    default: return 0;
  }
}

function compareTemplate(a: AwardDesignTemplate, b: AwardDesignTemplate, key: string, awards: Award[]): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "id": return a.id.localeCompare(b.id);
    case "usage": return templateUsageCount(a.id, awards) - templateUsageCount(b.id, awards);
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "dateCreated": return (Date.parse(a.dateCreated) || 0) - (Date.parse(b.dateCreated) || 0);
    case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
    default: return 0;
  }
}

/* ─────────────── Rows ─────────────── */

function AwardColGroup({ cols }: { cols: Record<AwardColKey, boolean> }) {
  return (
    <colgroup>
      <col />
      {cols.id && <col style={{ width: 100 }} />}
      {cols.tier && <col style={{ width: 120 }} />}
      {cols.appearances && <col style={{ width: 160 }} />}
      {cols.status && <col style={{ width: 110 }} />}
      {cols.holders && <col style={{ width: 110 }} />}
      {cols.createdBy && <col style={{ width: 150 }} />}
      {cols.dateCreated && <col style={{ width: 130 }} />}
      {cols.dateModified && <col style={{ width: 130 }} />}
      <col style={{ width: 48 }} />
    </colgroup>
  );
}

function TierPill_({ tier }: { tier: Award["meritTier"] }) {
  return (
    <span className="aw-tier-pill" style={{ "--tier": MERIT_HEX[tier] } as React.CSSProperties}>
      <span className="aw-tier-pill-dot" />
      {tier}
    </span>
  );
}

function StatusBadge({ status }: { status: Award["status"] }) {
  return <span className={`sk-status sk-status--${status.toLowerCase()}`}>{status}</span>;
}

function AwardRow({
  award, cols, selected, onClick, onEdit, onMenu,
}: {
  award: Award;
  cols: Record<AwardColKey, boolean>;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
}) {
  const archived = award.status === "Archived";
  const cert = certForAward(award);
  return (
    <tr className={`${selected ? "selected" : ""} ${archived ? "task-hidden" : ""}`} onClick={onClick}>
      <td className="col-name">
        {certName(award)}
        {cert && <span className="aw-cert-industry">{cert.industry}</span>}
        {archived && <span className="hidden-badge">Archived</span>}
      </td>
      {cols.id && <td className="col-id">{award.id}</td>}
      {cols.tier && <td className="col-type"><TierPill_ tier={award.meritTier} /></td>}
      {cols.appearances && <td className="col-used">{appearanceSummary(award)}</td>}
      {cols.status && <td className="col-type"><StatusBadge status={award.status} /></td>}
      {cols.holders && <td className="col-type">{fmtHolders(award.holders)}</td>}
      {cols.createdBy && <td className="col-creator">{award.createdBy}</td>}
      {cols.dateCreated && <td className="col-date">{award.dateCreated}</td>}
      {cols.dateModified && <td className="col-date">{award.dateModified}</td>}
      <RowActions onEdit={onEdit} onMenu={onMenu} editTitle="Edit Award" />
    </tr>
  );
}

function TemplateColGroup({ cols }: { cols: Record<TemplateColKey, boolean> }) {
  return (
    <colgroup>
      <col style={{ width: 72 }} />
      <col />
      {cols.id && <col style={{ width: 100 }} />}
      {cols.usage && <col style={{ width: 130 }} />}
      {cols.createdBy && <col style={{ width: 150 }} />}
      {cols.dateCreated && <col style={{ width: 130 }} />}
      {cols.dateModified && <col style={{ width: 130 }} />}
      <col style={{ width: 48 }} />
    </colgroup>
  );
}

function TemplateRow({
  template, cols, usage, selected, onClick, onEdit, onMenu,
}: {
  template: AwardDesignTemplate;
  cols: Record<TemplateColKey, boolean>;
  usage: number;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
}) {
  return (
    <tr className={selected ? "selected" : ""} onClick={onClick}>
      <td className="aw-col-thumb">
        <span className="aw-row-thumb" style={{ background: template.swatch }} />
      </td>
      <td className="col-name">
        {template.name}
        <span className="aw-cert-industry">{template.background}</span>
      </td>
      {cols.id && <td className="col-id">{template.id}</td>}
      {cols.usage && <td className="col-used">{usage === 0 ? "Unused" : `${usage} Award${usage === 1 ? "" : "s"}`}</td>}
      {cols.createdBy && <td className="col-creator">{template.createdBy}</td>}
      {cols.dateCreated && <td className="col-date">{template.dateCreated}</td>}
      {cols.dateModified && <td className="col-date">{template.dateModified}</td>}
      <RowActions onEdit={onEdit} onMenu={onMenu} editTitle="Edit Template" />
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
        <MoreIcon />
      </button>
      <div className="row-action-bar">
        <button className="row-action-btn" aria-label="Edit" title={editTitle} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <PencilIcon />
        </button>
        <button className="row-action-btn" aria-label="More" onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget.getBoundingClientRect()); }}>
          <MoreIcon />
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
  archived?: boolean;
  archiveLabel: string;
  onClose: () => void;
  onArchive?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    let left = rect.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    setPos({ top, left });
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
        left: pos ? pos.left : rect.right - 210,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{title}</div>
        <div className="u-menu-head-id">{subtitle}</div>
      </div>
      <div className="u-menu-divider" />
      {onArchive &&
        (archived
          ? item(<UnarchiveIcon />, `Unarchive ${archiveLabel}`, onArchive)
          : item(<ArchiveIcon />, `Archive ${archiveLabel}`, onArchive))}
      {item(<PencilIcon />, "Edit", onEdit)}
      <div className="u-menu-divider" />
      {item(<TrashIcon />, "Delete", onDelete, true)}
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

function TierPill({ value, onApply }: { value: string[]; onApply: (v: string[]) => void }) {
  const summary = summarize(value, MERIT_TIERS);
  return (
    <Dropdown
      width={200}
      trigger={({ open, toggle }) => (
        <PillTrigger label="Merit Tier" value={summary} open={open} toggle={toggle} onClear={() => onApply([])} />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...MERIT_TIERS] }]}
          value={value}
          onApply={(v) => { onApply(v); close(); }}
        />
      )}
    </Dropdown>
  );
}

function StatusPill({ value, onApply }: { value: string[]; onApply: (v: string[]) => void }) {
  const summary = summarize(value, AWARD_STATUSES);
  return (
    <Dropdown
      width={200}
      trigger={({ open, toggle }) => (
        <PillTrigger label="Status" value={summary} open={open} toggle={toggle} onClear={() => onApply([])} />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...AWARD_STATUSES] }]}
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
