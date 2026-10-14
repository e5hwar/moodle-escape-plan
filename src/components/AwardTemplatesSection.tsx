/* Award Templates — the reusable Card/Certificate designs an Award is built
   from. This was the "Design Templates" tab of the Awards page; it lives on
   Product Config now, since a template is platform configuration rather than a
   piece of content. The Awards page still *reads* templates (the Award wizard
   picks one), it just no longer manages them.

   2026-10-13 (user): no search and no Edit Columns — a fixed Template Name ·
   Preview · Used By · Date Modified · Date Created set, on Spotlight-height
   rows so the preview reads at a useful size. */
import { useEffect, useMemo, useState } from "react";
import {
  awards as seedAwards,
  templateUsageCount,
  type AwardDesignTemplate,
} from "../data/awards";
import { ConfirmModal, RowActions, SortableHeader, type SortDir } from "./AwardTableParts";
import { PagePrevIcon, PageNextIcon, RowEditIcon, RowDeleteIcon } from "./icons";
import { RowMenu } from "./RowMenu";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";
import { useListState, useResetPageOnChange } from "../hooks/useListState";

const PAGE_SIZE = 50;

/* A template an Award uses can't be deleted — the menu keeps Delete, greyed,
   with this reason under it (Figma 668:942). */
const DELETE_USED_REASON = "Templates currently used cannot be deleted";

/* Template Name · Preview (144×76 + 24) · Used By · Date Modified · Date
   Created, then the unlabelled 40px kebab column. */
const COL_WIDTHS = [264, 144 + 24, 130, 140, 140];
const TABLE_MIN = COL_WIDTHS.reduce((a, b) => a + b, 0) + 40;

export function AwardTemplatesSection({
  templates,
  onEdit,
  onDelete,
  onModalChange,
}: {
  templates: AwardDesignTemplate[];
  onEdit: (template: AwardDesignTemplate) => void;
  onDelete: (id: string) => void;
  /** A confirm (or a row menu) opened or closed — the page's Create shortcut
   *  stands down while one is up. */
  onModalChange?: (open: boolean) => void;
}) {
  // Kept for the session (spec review 2026-10-09: every list restores).
  const [sort, setSort] = useListState<{ key: string; dir: SortDir }>("award-templates:sort", { key: "name", dir: "asc" });
  const [page, setPage] = useListState("award-templates:page", 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ rect: DOMRect; id: string } | null>(null);
  const [deleting, setDeleting] = useState<AwardDesignTemplate | null>(null);

  useResetPageOnChange(setPage, [sort]);
  const overlayUp = deleting !== null || menu !== null;
  useEffect(() => {
    onModalChange?.(overlayUp);
  }, [overlayUp, onModalChange]);
  // Leaving the tab with one open mustn't leave the shortcut switched off.
  useEffect(() => () => onModalChange?.(false), [onModalChange]);

  const sorted = useMemo(() => {
    const arr = [...templates].sort((a, b) => compareTemplate(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [templates, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: string) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const header = { sort, toggle: toggleSort };

  return (
    <div className="pc-table-body">
      <div className="co-table-row">
        <div className="co-table-col">
          <div className="table-xscroll" style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}>
            <table className="table table-head">
              <TemplateColGroup />
              <thead>
                <tr>
                  <SortableHeader col="name" label="Template Name" className="col-name" {...header} />
                  <SortableHeader col="preview" label="Preview" sortable={false} {...header} />
                  <SortableHeader col="usage" label="Used By" className="col-used" {...header} />
                  <SortableHeader col="dateModified" label="Date Modified" className="col-date" {...header} />
                  <SortableHeader col="dateCreated" label="Date Created" className="col-date" {...header} />
                  <th className="col-actions" />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body aw-tpl-table">
                <TemplateColGroup />
                <tbody>
                  {paged.map((t) => (
                    <TemplateRow
                      key={t.id}
                      template={t}
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
        const used = templateUsageCount(t.id, seedAwards) > 0;
        return (
          <RowMenu
            rect={menu.rect}
            className="aw-tpl-menu"
            onClose={() => setMenu(null)}
            items={[
              { label: "Edit", icon: <RowEditIcon />, onPick: () => onEdit(t) },
              {
                label: "Delete",
                icon: <RowDeleteIcon />,
                danger: true,
                disabled: used,
                sub: used ? DELETE_USED_REASON : undefined,
                onPick: () => setDeleting(t),
              },
            ]}
          />
        );
      })()}

      {deleting && (
        <ConfirmModal
          title="Delete this Design Template?"
          confirmLabel="Delete Template"
          danger
          doubleConfirm={
            <>
              <strong>{deleting.name}</strong> will be permanently deleted. This can’t be
              undone.
            </>
          }
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            onDelete(deleting.id);
            if (selectedId === deleting.id) setSelectedId(null);
            setDeleting(null);
          }}
        >
          <p className="sk-modal-text">
            Delete <strong>{deleting.name}</strong>? No Awards use it, so nothing issued is
            affected. This can’t be undone.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

function compareTemplate(a: AwardDesignTemplate, b: AwardDesignTemplate, key: string): number {
  switch (key) {
    case "usage": return templateUsageCount(a.id, seedAwards) - templateUsageCount(b.id, seedAwards);
    case "dateCreated": return (Date.parse(a.dateCreated) || 0) - (Date.parse(b.dateCreated) || 0);
    case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
    default: return a.name.localeCompare(b.name);
  }
}

function TemplateColGroup() {
  return <TableCols data={COL_WIDTHS} trail={[40]} />;
}

function TemplateRow({
  template, usage, selected, onClick, onEdit, onMenu, menuOpen,
}: {
  template: AwardDesignTemplate;
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
      <td className="col-name">{template.name}</td>
      <td className="aw-col-thumb">
        {/* A placeholder, not the artwork (user, 2026-10-07). */}
        <span className="art-ph aw-row-thumb">Image</span>
      </td>
      <td className="col-used">{usage === 0 ? "—" : `${usage} Award${usage === 1 ? "" : "s"}`}</td>
      <td className="col-date">{template.dateModified}</td>
      <td className="col-date">{template.dateCreated}</td>
      <RowActions onEdit={onEdit} onMenu={onMenu} editTitle="Edit Template" />
    </tr>
  );
}
