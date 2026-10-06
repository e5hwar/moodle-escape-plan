/* Shared table chrome for the two Award tables — the Awards list on the Awards
   page and the Award Templates tab on Product Config. They were one page with
   two tabs until the Templates tab moved to Product Config; these parts are
   what both sides kept using. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PrmModal } from "./PrmModal";
import { SortIcon, RowEditIcon, RowKebabIcon, MenuArchiveIcon, RowDeleteIcon, MenuPlaceholderIcon } from "./icons";

export type SortDir = "asc" | "desc";

export function RowActions({
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

export function SortableHeader({
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

export function ActionsMenu({
  rect, archived, archiveLabel, onClose, onArchive, onEdit, onDelete, onViewRecipients,
}: {
  rect: DOMRect;
  archived?: boolean;
  archiveLabel: string;
  onClose: () => void;
  onArchive?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewRecipients?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
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
      {onViewRecipients && item(<MenuPlaceholderIcon />, "View recipients", onViewRecipients)}
      {onArchive &&
        (archived
          ? item(<MenuPlaceholderIcon />, `Unarchive ${archiveLabel}`, onArchive)
          : item(<MenuArchiveIcon />, `Archive ${archiveLabel}`, onArchive))}
      {item(<RowEditIcon />, "Edit", onEdit)}
      {item(<RowDeleteIcon />, "Delete", onDelete, true)}
    </div>
  );
}

/* ─────────────── Confirm modal ─────────────── */

export function ConfirmModal({
  title, confirmLabel, danger = false, doubleConfirm, children, onCancel, onConfirm,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  /** See PrmModal — every deletion asks twice. */
  doubleConfirm?: React.ReactNode;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <PrmModal
      title={title}
      confirmLabel={confirmLabel}
      danger={danger}
      doubleConfirm={doubleConfirm}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <div className="prm-content">{children}</div>
    </PrmModal>
  );
}
