/* Shared table chrome for the two Award tables — the Awards list on the Awards
   page and the Award Templates tab on Product Config. They were one page with
   two tabs until the Templates tab moved to Product Config; these parts are
   what both sides kept using. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dropdown } from "./Dropdown";
import { CheckRow } from "./Filters";
import { PrmModal } from "./PrmModal";
import { SortIcon, EditColumnsIcon, RowEditIcon, RowKebabIcon, MenuArchiveIcon, RowDeleteIcon, MenuPlaceholderIcon } from "./icons";

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
  rect, title, subtitle, archived, archiveLabel, onClose, onArchive, onEdit, onDelete, onViewRecipients,
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
      <div className="u-menu-head">
        <div className="u-menu-head-name">{title}</div>
        <div className="u-menu-head-id">{subtitle}</div>
      </div>
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
    <PrmModal
      title={title}
      confirmLabel={confirmLabel}
      danger={danger}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <div className="prm-content">{children}</div>
    </PrmModal>
  );
}

/* ─────────────── Columns editor ─────────────── */

export function ColumnsMenu({
  optional, fixed, value, onChange,
}: {
  optional: { key: string; label: string }[];
  fixed: string;
  value: Record<string, boolean>;
  onChange: (v: Record<string, boolean>) => void;
}) {
  // Available columns read alphabetically — it is a lookup list, not an
  // ordering (see ColumnsBody in Filters.tsx).
  const active = optional.filter((c) => value[c.key]);
  const available = optional
    .filter((c) => !value[c.key])
    .sort((a, b) => a.label.localeCompare(b.label));
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
