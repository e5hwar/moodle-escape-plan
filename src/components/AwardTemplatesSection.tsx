/* Award Templates — the reusable Card/Certificate designs an Award is built
   from. This was the "Design Templates" tab of the Awards page; it lives on
   Product Config now, since a template is platform configuration rather than a
   piece of content. The Awards page still *reads* templates (the Award wizard
   picks one), it just no longer manages them. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  ConfirmModal,
  RowActions,
  SortableHeader,
  type SortDir,
} from "./AwardTableParts";
import { SearchIcon, PagePrevIcon, PageNextIcon, WarnTriangleIcon } from "./icons";
import { NoteCard } from "./NoteCard";
import { SearchTrailing } from "./SearchPanelParts";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";
import { EditColumnsButton, orderedColumns, useColumnOrder } from "./Filters";

const PAGE_SIZE = 50;

type Modal =
  | { kind: "none" }
  | { kind: "delete-blocked"; template: AwardDesignTemplate; linked: Award[] }
  | { kind: "delete"; template: AwardDesignTemplate };

export function AwardTemplatesSection({
  templates,
  onEdit,
  onDelete,
  onEditLinkedAward,
  onModalChange,
}: {
  templates: AwardDesignTemplate[];
  onEdit: (template: AwardDesignTemplate) => void;
  onDelete: (id: string) => void;
  /** Leaves Product Config for the Awards page, on the Award that blocks a
   *  delete. Omitted when there is nowhere to go. */
  onEditLinkedAward?: (award: Award) => void;
  /** A confirm (or a row menu) opened or closed — the page's Create shortcut
   *  stands down while one is up. */
  onModalChange?: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ rect: DOMRect; id: string } | null>(null);
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [cols, setCols] = useState<Record<TemplateColKey, boolean>>({
    background: true, id: true, usage: true, createdBy: true, dateCreated: false, dateModified: true,
  });
  const [order, setOrder] = useColumnOrder(TEMPLATE_COLS);
  const shown = orderedColumns(TPL_COL_DEFS, order, cols);

  useEffect(() => setPage(1), [query, sort]);
  const overlayUp = modal.kind !== "none" || menu !== null;
  useEffect(() => {
    onModalChange?.(overlayUp);
  }, [overlayUp, onModalChange]);
  // Leaving the tab with one open mustn't leave the shortcut switched off.
  useEffect(() => () => onModalChange?.(false), [onModalChange]);

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

  const tableMin = THUMB_W + NAME_W + 40 + shown.reduce((n, c) => n + c.width, 0);

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
              <TemplateColGroup shown={shown} />
              <thead>
                <tr>
                  <th className="aw-col-thumb" />
                  <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                  {shown.map((c) => (
                    <SortableHeader
                      key={c.key}
                      col={c.key}
                      label={c.label}
                      className={c.className}
                      sort={sort}
                      toggle={toggleSort}
                      sortable={c.sortable !== false}
                    />
                  ))}
                  <th className="col-actions">
                    {/* The shared Edit Columns menu (28:16625): All / None and
                        drag-to-reorder, like every other list table. */}
                    <EditColumnsButton
                      columns={cols}
                      setColumns={setCols}
                      optional={TEMPLATE_COLS}
                      fixed={[{ label: "Name" }]}
                      order={order}
                      onOrderChange={setOrder}
                    />
                  </th>
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body">
                <TemplateColGroup shown={shown} />
                <tbody>
                  {paged.map((t) => (
                    <TemplateRow
                      key={t.id}
                      template={t}
                      shown={shown}
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
            {paged.length === 0 && <TableEmpty />}
          </div>

          <div className="pagination">
            <span>
              Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><PagePrevIcon /></button>
              <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><PageNextIcon /></button>
            </div>
          </div>
        </div>
      </div>

      {menu && (() => {
        const t = templates.find((x) => x.id === menu.id);
        if (!t) return null;
        return (
          <ActionsMenu
            rect={menu.rect}
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
          {/* Award Templates' delete gate: a template in use can't be
              deleted, and the warning names the Awards holding it. */}
          <NoteCard
            tone="danger"
            icon={<WarnTriangleIcon />}
            title={`${modal.template.name} is used by ${modal.linked.length} Award${
              modal.linked.length === 1 ? "" : "s"
            } and can’t be deleted.`}
            body={
              <>
                Unlink it from each Award’s Card or Certificate design first, then delete it.
                <span className="sk-warn-chips">
                  {modal.linked.map((a) => (
                    <span key={a.id} className="sk-chip">{certName(a)}</span>
                  ))}
                </span>
              </>
            }
          />
        </ConfirmModal>
      )}

      {modal.kind === "delete" && (
        <ConfirmModal
          title="Delete this Design Template?"
          confirmLabel="Delete Template"
          danger
          doubleConfirm={
            <>
              <strong>{modal.template.name}</strong> will be permanently deleted. This can’t be
              undone.
            </>
          }
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
    case "background": return a.background.localeCompare(b.background);
    case "id": return a.id.localeCompare(b.id);
    case "usage": return templateUsageCount(a.id, seedAwards) - templateUsageCount(b.id, seedAwards);
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "dateCreated": return (Date.parse(a.dateCreated) || 0) - (Date.parse(b.dateCreated) || 0);
    case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
    default: return 0;
  }
}

/* The optional columns, in TEMPLATE_COLS order; Edit Columns reorders them.
   One datum per column (the plain-text cell rule): the background image's file
   name is its own column rather than a second line under the template name. */
type TplCol = {
  key: TemplateColKey;
  label: string;
  className: string;
  width: number;
  sortable?: boolean;
  render: (t: AwardDesignTemplate, usage: number) => ReactNode;
};
const THUMB_W = 72;
const NAME_W = 240;
const TPL_COL_DEFS: TplCol[] = [
  { key: "background", label: "Background Image", className: "aw-col-bg", width: 220, render: (t) => t.background },
  { key: "id", label: "ID", className: "col-id", width: 100, render: (t) => t.id },
  {
    key: "usage",
    label: "Used By",
    className: "col-used",
    width: 130,
    render: (_t, usage) => (usage === 0 ? "Unused" : `${usage} Award${usage === 1 ? "" : "s"}`),
  },
  { key: "createdBy", label: "Created By", className: "col-creator", width: 150, sortable: false, render: (t) => t.createdBy },
  { key: "dateCreated", label: "Date Created", className: "col-date", width: 130, render: (t) => t.dateCreated },
  { key: "dateModified", label: "Date Modified", className: "col-date", width: 130, render: (t) => t.dateModified },
];

function TemplateColGroup({ shown }: { shown: TplCol[] }) {
  return <TableCols data={[THUMB_W, NAME_W, ...shown.map((c) => c.width)]} trail={[40]} />;
}

function TemplateRow({
  template, shown, usage, selected, onClick, onEdit, onMenu, menuOpen,
}: {
  template: AwardDesignTemplate;
  shown: TplCol[];
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
        {/* A placeholder, not the artwork (user, 2026-10-07). */}
        <span className="art-ph aw-row-thumb">Image</span>
      </td>
      <td className="col-name">{template.name}</td>
      {shown.map((c) => (
        <td key={c.key} className={c.className}>
          {c.render(template, usage)}
        </td>
      ))}
      <RowActions onEdit={onEdit} onMenu={onMenu} editTitle="Edit Template" />
    </tr>
  );
}
