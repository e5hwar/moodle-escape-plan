/* Award Templates — the reusable Card/Certificate designs an Award is built
   from. This was the "Design Templates" tab of the Awards page; it lives on
   Product Config now, since a template is platform configuration rather than a
   piece of content. The Awards page still *reads* templates (the Award wizard
   picks one), it just no longer manages them. */
import { useEffect, useMemo, useState } from "react";
import {
  awards as seedAwards,
  awardsUsingTemplate,
  certName,
  templateUsageCount,
  TEMPLATE_COLS,
  type Award,
  type AwardDesignTemplate,
  type TemplateColKey,
} from "../data/awards";
import {
  ActionsMenu,
  ColumnsMenu,
  ConfirmModal,
  RowActions,
  SortableHeader,
  type SortDir,
} from "./AwardTableParts";
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { SearchTrailing } from "./SearchPanelParts";

const PAGE_SIZE = 50;

/* Award Templates' delete gate: a template in use can't be deleted, and the
   warning names the Awards holding it. */
const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

type Modal =
  | { kind: "none" }
  | { kind: "delete-blocked"; template: AwardDesignTemplate; linked: Award[] }
  | { kind: "delete"; template: AwardDesignTemplate };

export function AwardTemplatesSection({
  templates,
  onEdit,
  onDelete,
  onEditLinkedAward,
}: {
  templates: AwardDesignTemplate[];
  onEdit: (template: AwardDesignTemplate) => void;
  onDelete: (id: string) => void;
  /** Leaves Product Config for the Awards page, on the Award that blocks a
   *  delete. Omitted when there is nowhere to go. */
  onEditLinkedAward?: (award: Award) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ rect: DOMRect; id: string } | null>(null);
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [cols, setCols] = useState<Record<TemplateColKey, boolean>>({
    id: true, usage: true, createdBy: true, dateCreated: false, dateModified: true,
  });

  useEffect(() => setPage(1), [query, sort]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter(
      (t) => !q || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
    );
  }, [templates, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareTemplate(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: string) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function requestDelete(t: AwardDesignTemplate) {
    const linked = awardsUsingTemplate(t.id, seedAwards);
    if (linked.length > 0) setModal({ kind: "delete-blocked", template: t, linked });
    else setModal({ kind: "delete", template: t });
  }

  const tableMin =
    72 /* thumb */ + 240 + 40 +
    (cols.id ? 100 : 0) + (cols.usage ? 130 : 0) + (cols.createdBy ? 150 : 0) +
    (cols.dateCreated ? 130 : 0) + (cols.dateModified ? 130 : 0);

  return (
    <div className="pc-table-body">
      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon"><SearchIcon /></span>
          <input
            className="search-input"
            placeholder="Search Templates by Name or ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SearchTrailing active={!!query} onClear={() => setQuery("")} />
        </div>
      </div>

      <div className="co-table-row">
        <div className="co-table-col">
          <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
            <table className="table table-head">
              <TemplateColGroup cols={cols} />
              <thead>
                <tr>
                  <th className="aw-col-thumb" />
                  <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                  {cols.id && <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />}
                  {cols.usage && <SortableHeader col="usage" label="Used By" className="col-used" sort={sort} toggle={toggleSort} />}
                  {cols.createdBy && <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} sortable={false} />}
                  {cols.dateCreated && <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />}
                  {cols.dateModified && <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />}
                  <th className="col-actions">
                    <ColumnsMenu optional={TEMPLATE_COLS} fixed="Name" value={cols} onChange={(v) => setCols(v as Record<TemplateColKey, boolean>)} />
                  </th>
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body">
                <TemplateColGroup cols={cols} />
                <tbody>
                  {paged.map((t) => (
                    <TemplateRow
                      key={t.id}
                      template={t}
                      cols={cols}
                      usage={templateUsageCount(t.id, seedAwards)}
                      selected={t.id === selectedId}
                      onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                      onEdit={() => onEdit(t)}
                      onMenu={(rect) => setMenu({ rect, id: t.id })}
                      menuOpen={menu?.id === t.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pagination">
            <span>
              Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeftIcon /></button>
              <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRightIcon /></button>
            </div>
          </div>
        </div>
      </div>

      {menu && (() => {
        const t = templates.find((x) => x.id === menu.id);
        if (!t) return null;
        const usage = templateUsageCount(t.id, seedAwards);
        return (
          <ActionsMenu
            rect={menu.rect}
            title={t.name}
            subtitle={`${t.id} · ${usage} use${usage === 1 ? "" : "s"}`}
            archiveLabel="Template"
            onClose={() => setMenu(null)}
            onEdit={() => onEdit(t)}
            onDelete={() => requestDelete(t)}
          />
        );
      })()}

      {modal.kind === "delete-blocked" && (
        <ConfirmModal
          title="Can’t delete this template"
          confirmLabel={onEditLinkedAward ? "Edit linked Awards" : "Close"}
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => {
            const first = modal.linked[0];
            setModal({ kind: "none" });
            onEditLinkedAward?.(first);
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

      {modal.kind === "delete" && (
        <ConfirmModal
          title="Delete this Design Template?"
          confirmLabel="Delete Template"
          danger
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => {
            onDelete(modal.template.id);
            if (selectedId === modal.template.id) setSelectedId(null);
            setModal({ kind: "none" });
          }}
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

function compareTemplate(a: AwardDesignTemplate, b: AwardDesignTemplate, key: string): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "id": return a.id.localeCompare(b.id);
    case "usage": return templateUsageCount(a.id, seedAwards) - templateUsageCount(b.id, seedAwards);
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "dateCreated": return (Date.parse(a.dateCreated) || 0) - (Date.parse(b.dateCreated) || 0);
    case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
    default: return 0;
  }
}

function TemplateColGroup({ cols }: { cols: Record<TemplateColKey, boolean> }) {
  return (
    <colgroup>
      <col style={{ width: 72 }} />
      <col style={{ width: 240 }} />
      {cols.id && <col style={{ width: 100 }} />}
      {cols.usage && <col style={{ width: 130 }} />}
      {cols.createdBy && <col style={{ width: 150 }} />}
      {cols.dateCreated && <col style={{ width: 130 }} />}
      {cols.dateModified && <col style={{ width: 130 }} />}
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function TemplateRow({
  template, cols, usage, selected, onClick, onEdit, onMenu, menuOpen,
}: {
  template: AwardDesignTemplate;
  cols: Record<TemplateColKey, boolean>;
  usage: number;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  return (
    <tr className={`${selected ? "selected" : ""} ${menuOpen ? "menu-open" : ""}`} onClick={onClick}>
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
