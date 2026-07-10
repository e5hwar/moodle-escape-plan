import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  spotlights as seedSpotlights,
  type Spotlight,
} from "../data/spotlights";
import { CreateSpotlightPanel } from "./CreateSpotlightPanel";
import { QueuePositionPicker } from "./QueuePositionPicker";
import { SearchIcon, AddIcon, SmallXIcon } from "./icons";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

type FilterKey = "all" | "approved" | "pending" | "rejected";

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "All",
  approved: "Active",
  pending: "Pending",
  rejected: "Rejected",
};

type DisplayStatus =
  | "active"
  | "pending"
  | "ended"
  | "rejected"
  | "deactivated";

const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  active: "Active",
  pending: "Pending Review",
  ended: "Ended",
  rejected: "Rejected",
  deactivated: "Deactivated",
};

// An approved Spotlight whose end date has passed reads as "Ended".
function deriveStatus(s: Spotlight): DisplayStatus {
  if (s.status === "pending") return "pending";
  if (s.status === "rejected") return "rejected";
  if (s.status === "deactivated") return "deactivated";
  return daysUntil(s.endDate) < 0 ? "ended" : "active";
}

const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

const DeactivateIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

const CrossIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const GripIcon = () => (
  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden>
    <circle cx="3.5" cy="3" r="1.4" />
    <circle cx="8.5" cy="3" r="1.4" />
    <circle cx="3.5" cy="8" r="1.4" />
    <circle cx="8.5" cy="8" r="1.4" />
    <circle cx="3.5" cy="13" r="1.4" />
    <circle cx="8.5" cy="13" r="1.4" />
  </svg>
);

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const today = new Date("2026-05-15");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function SpotlightsPage() {
  // `committed` is the saved order; `list` is the working copy shown in the
  // table. Drag-reordering only touches `list`, so the order diverges until the
  // user saves — Discard (or leaving the page) restores `committed`. Every other
  // action commits to both immediately via `applyBoth`.
  const [committed, setCommitted] = useState<Spotlight[]>(seedSpotlights);
  const [list, setList] = useState<Spotlight[]>(seedSpotlights);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<{ item: Spotlight; rect: DOMRect } | null>(null);
  const [approving, setApproving] = useState<Spotlight | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Source row index kept in a ref so the drop handler never reads a stale value.
  const dragIndexRef = useRef<number | null>(null);

  function applyBoth(fn: (arr: Spotlight[]) => Spotlight[]) {
    setCommitted((prev) => fn(prev));
    setList((prev) => fn(prev));
  }

  const dirty = useMemo(
    () =>
      list.map((s) => s.id).join(",") !== committed.map((s) => s.id).join(","),
    [list, committed],
  );

  // Reordering by drag only makes sense against the full, unfiltered queue.
  const canReorder = filter === "all" && !query.trim();

  const counts = useMemo(() => {
    const c = { approved: 0, pending: 0, rejected: 0, deactivated: 0 };
    list.forEach((s) => (c[s.status] += 1));
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (q && !(
        s.headingEn.toLowerCase().includes(q) ||
        (s.descriptionEn ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.submittedBy.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [list, query, filter]);

  function openCreate() {
    setCreating(true);
  }

  useCreateShortcut(openCreate, !creating);

  function closeCreate() {
    setCreating(false);
  }

  function handleSubmit(
    draft: {
      headingEn: string;
      headingEs: string;
      descriptionEn: string;
      descriptionEs: string;
      ctaTextEn: string;
      ctaTextEs: string;
      ctaUrl: string;
      endDate: string;
      imageHint?: string;
    },
    insertIndex: number,
  ) {
    const id = `SP-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const newSpotlight: Spotlight = {
      id,
      headingEn: draft.headingEn || "Untitled Spotlight",
      headingEs: draft.headingEs || undefined,
      descriptionEn: draft.descriptionEn || undefined,
      descriptionEs: draft.descriptionEs || undefined,
      ctaTextEn: draft.ctaTextEn || undefined,
      ctaTextEs: draft.ctaTextEs || undefined,
      ctaUrl: draft.ctaUrl || undefined,
      endDate: draft.endDate,
      imageHint: draft.imageHint,
      submittedBy: "You",
      submittedAt: "2026-05-15",
      status: "pending",
    };
    applyBoth((l) => {
      const next = [...l];
      next.splice(insertIndex, 0, newSpotlight);
      return next;
    });
    closeCreate();
  }

  function deactivate(item: Spotlight) {
    applyBoth((l) =>
      l.map((s) => (s.id === item.id ? { ...s, status: "deactivated" } : s)),
    );
  }

  function decline(item: Spotlight) {
    applyBoth((l) =>
      l.map((s) => (s.id === item.id ? { ...s, status: "rejected" } : s)),
    );
  }

  // Approve `item`, moving it to `targetIndex` in the queue (index among the
  // OTHER spotlights) before flipping its status to approved.
  function confirmApprove(item: Spotlight, targetIndex: number) {
    applyBoth((l) => {
      const others = l.filter((s) => s.id !== item.id);
      const approved: Spotlight = { ...item, status: "approved" };
      others.splice(targetIndex, 0, approved);
      return others;
    });
    setApproving(null);
  }

  // ── Drag-to-reorder (working copy only, until saved) ──
  function startDrag(idx: number) {
    dragIndexRef.current = idx;
    setDragIndex(idx);
  }

  function endDrag() {
    dragIndexRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  }

  function onRowDrop(targetIndex: number) {
    const from = dragIndexRef.current;
    setList((l) => {
      if (from === null || from === targetIndex) return l;
      const next = [...l];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    endDrag();
  }

  function saveOrder() {
    setCommitted(list);
  }

  function discardOrder() {
    setList(committed);
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks sp-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Spotlight</h1>
              <div className="tasks-subtitle">
                <span>{counts.approved} active</span>
                <span className="tasks-subtitle-dot" />
                <span>{counts.pending} pending approval</span>
                <span className="tasks-subtitle-dot" />
                <span>shown on the app Home Screen in queue order</span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={openCreate}>
                <AddIcon />
                Create Spotlight
                <span className="cta-kbd">C</span>
              </button>
            </div>
          </header>

          <div className="sp-controls">
            <div className="search-wrap sp-search">
              <span className="search-icon">
                <SearchIcon />
              </span>
              <input
                className="search-input"
                placeholder="Search Spotlights by heading, ID, or submitter…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="search-kbd">
                <span className="kbd-cmd">⌘</span>
                <span className="kbd-letter">K</span>
              </span>
            </div>
            <div className="sp-tabs">
              {(["all", "approved", "pending", "rejected"] as FilterKey[]).map(
                (k) => (
                  <button
                    key={k}
                    className={`sp-tab ${filter === k ? "is-active" : ""}`}
                    onClick={() => setFilter(k)}
                  >
                    {FILTER_LABEL[k]}
                    {k !== "all" && (
                      <span className="sp-tab-count">
                        {k === "approved"
                          ? counts.approved
                          : k === "pending"
                          ? counts.pending
                          : counts.rejected}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="tasks-scroll sp-scroll">
            <table className="sp-table">
              <colgroup>
                <col style={{ width: 76 }} />
                <col style={{ width: 156 }} />
                <col />
                <col style={{ width: 140 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 52 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="sp-th-pos">Position</th>
                  <th>Preview</th>
                  <th>Text</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>End Date</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr className="sp-empty-row">
                    <td colSpan={7}>
                      No Spotlights match. Try a different filter or search term.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const idx = list.indexOf(s);
                    return (
                      <SpotlightRow
                        key={s.id}
                        spotlight={s}
                        position={idx + 1}
                        canReorder={canReorder}
                        isDragging={dragIndex === idx}
                        isOver={overIndex === idx && dragIndex !== idx}
                        onOpenMenu={(rect) => setMenu({ item: s, rect })}
                        onApprove={() => setApproving(s)}
                        onDecline={() => decline(s)}
                        onDragStart={() => startDrag(idx)}
                        onDragEnterRow={() => {
                          if (dragIndexRef.current !== null) setOverIndex(idx);
                        }}
                        onDropRow={() => onRowDrop(idx)}
                        onDragEndRow={endDrag}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {dirty && (
        <footer className="sp-save-footer">
          <div className="sp-save-footer-text">
            <span className="sp-save-footer-dot" />
            Queue order changed — unsaved
          </div>
          <div className="sp-save-footer-actions">
            <button className="btn-save-draft" onClick={discardOrder}>
              Discard
            </button>
            <button
              className="btn-publish sp-submit"
              onClick={saveOrder}
            >
              Save Changes
            </button>
          </div>
        </footer>
      )}

      {menu && (
        <SpotlightActionsMenu
          rect={menu.rect}
          canDeactivate={menu.item.status !== "deactivated"}
          onClose={() => setMenu(null)}
          onDeactivate={() => deactivate(menu.item)}
        />
      )}

      {creating && (
        <>
          <div className="sp-overlay-backdrop" onClick={closeCreate} />
          <CreateSpotlightPanel
            onClose={closeCreate}
            onSubmit={handleSubmit}
            spotlights={list}
          />
        </>
      )}

      {approving && (
        <ApproveSpotlightModal
          item={approving}
          list={list}
          onClose={() => setApproving(null)}
          onConfirm={(idx) => confirmApprove(approving, idx)}
        />
      )}
    </div>
  );
}

function ApproveSpotlightModal({
  item,
  list,
  onClose,
  onConfirm,
}: {
  item: Spotlight;
  list: Spotlight[];
  onClose: () => void;
  onConfirm: (targetIndex: number) => void;
}) {
  // Queue of the OTHER spotlights; the item keeps its current slot by default.
  const others = list.filter((s) => s.id !== item.id);
  const currentIndex = Math.min(list.indexOf(item), others.length);
  const [index, setIndex] = useState(currentIndex);

  return (
    <>
      <div className="sp-overlay-backdrop" onClick={onClose} />
      <div className="sp-modal" role="dialog" aria-modal="true">
        <div className="sp-modal-header">
          <div>
            <div className="sp-panel-eyebrow">APPROVE SPOTLIGHT</div>
            <h2 className="sp-modal-title">{item.headingEn}</h2>
            <p className="sp-modal-sub">
              Set where this Spotlight appears in the queue, then approve. It
              goes live in the position you choose — position 1 shows first.
            </p>
          </div>
          <button className="sp-panel-close" aria-label="Close" onClick={onClose}>
            <SmallXIcon />
          </button>
        </div>

        <div className="sp-modal-body">
          <div className="sp-qpicker-head">
            <label className="form-label">Queue position</label>
          </div>
          <QueuePositionPicker
            items={others}
            index={index}
            onChange={setIndex}
            movingLabel={item.headingEn}
          />
        </div>

        <div className="sp-panel-footer">
          <button className="btn-save-draft" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-publish sp-submit sp-approve-confirm"
            onClick={() => onConfirm(index)}
          >
            <CheckIcon />
            Approve at position {index + 1}
          </button>
        </div>
      </div>
    </>
  );
}

function SpotlightRow({
  spotlight,
  position,
  canReorder,
  isDragging,
  isOver,
  onOpenMenu,
  onApprove,
  onDecline,
  onDragStart,
  onDragEnterRow,
  onDropRow,
  onDragEndRow,
}: {
  spotlight: Spotlight;
  position: number;
  canReorder: boolean;
  isDragging: boolean;
  isOver: boolean;
  onOpenMenu: (rect: DOMRect) => void;
  onApprove: () => void;
  onDecline: () => void;
  onDragStart: () => void;
  onDragEnterRow: () => void;
  onDropRow: () => void;
  onDragEndRow: () => void;
}) {
  const s = spotlight;
  const days = daysUntil(s.endDate);
  const isExpiring = days >= 0 && days <= 7;
  const isExpired = days < 0;
  const ds = deriveStatus(s);
  const isPending = s.status === "pending";

  return (
    <tr
      className={`sp-tr sp-tr--${s.status} ${isDragging ? "is-dragging" : ""} ${
        isOver ? "is-drop-target" : ""
      }`}
      draggable={canReorder}
      onDragStart={canReorder ? onDragStart : undefined}
      onDragEnter={canReorder ? onDragEnterRow : undefined}
      onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
      onDrop={canReorder ? onDropRow : undefined}
      onDragEnd={canReorder ? onDragEndRow : undefined}
    >
      <td className="sp-td-pos">
        {canReorder && (
          <span className="sp-drag-handle" aria-hidden title="Drag to reorder">
            <GripIcon />
          </span>
        )}
        <span className="sp-pos-num">{position}</span>
      </td>
      <td>
        <SpotlightPreview spotlight={s} />
      </td>
      <td className="sp-td-text">
        <div className="sp-cell-name-line">
          <span className="sp-cell-name">{s.headingEn}</span>
        </div>
        {s.descriptionEn && (
          <div className="sp-cell-desc">{s.descriptionEn}</div>
        )}
      </td>
      <td>
        <span className={`sp-status sp-status--${ds}`}>
          {DISPLAY_STATUS_LABEL[ds]}
        </span>
      </td>
      <td className="sp-td-muted">{s.submittedBy}</td>
      <td className="sp-td-muted">
        <span
          className={`sp-enddate ${isExpiring ? "is-warning" : ""} ${
            isExpired ? "is-expired" : ""
          }`}
        >
          {formatDate(s.endDate)}
        </span>
        {!isExpired && days >= 0 && days <= 14 ? (
          <span className="sp-enddate-sub">
            {days === 0 ? "today" : `${days}d left`}
          </span>
        ) : null}
        {isExpired ? <span className="sp-enddate-sub">expired</span> : null}
      </td>
      <td className="sp-td-actions">
        <button
          className="sp-kebab sp-kebab--lone"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(e.currentTarget.getBoundingClientRect());
          }}
        >
          <MoreIcon />
        </button>
        {isPending && (
          <div className="sp-action-bar">
            <button
              className="sp-action-btn sp-action-btn--approve"
              onClick={(e) => {
                e.stopPropagation();
                onApprove();
              }}
            >
              <CheckIcon />
              Approve
            </button>
            <button
              className="sp-action-btn sp-action-btn--decline"
              onClick={(e) => {
                e.stopPropagation();
                onDecline();
              }}
            >
              <CrossIcon />
              Decline
            </button>
            <button
              className="sp-action-btn sp-action-btn--more"
              aria-label="More actions"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMenu(e.currentTarget.getBoundingClientRect());
              }}
            >
              <MoreIcon />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function SpotlightPreview({ spotlight }: { spotlight: Spotlight }) {
  // Compact card mirroring the app's mobile Spotlight UI.
  return (
    <div className="sp-thumb">
      <div className="sp-thumb-img" aria-hidden>
        {spotlight.imageHint ? (
          <span className="sp-thumb-img-tag">IMG</span>
        ) : (
          <span className="sp-thumb-fallback">SP</span>
        )}
      </div>
      <div className="sp-thumb-inner">
        <div className="sp-thumb-heading">{spotlight.headingEn}</div>
        {spotlight.ctaTextEn && (
          <div className="sp-thumb-cta">{spotlight.ctaTextEn}</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Three-dot row actions menu ─────────────── */
/* Fixed-positioned so it escapes the table's scroll container. */

function SpotlightActionsMenu({
  rect,
  canDeactivate,
  onClose,
  onDeactivate,
}: {
  rect: DOMRect;
  canDeactivate: boolean;
  onClose: () => void;
  onDeactivate: () => void;
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
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() {
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

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
      <button
        className="u-menu-item u-menu-item--danger"
        disabled={!canDeactivate}
        onClick={() => {
          onDeactivate();
          onClose();
        }}
      >
        <span className="u-menu-item-icon">
          <DeactivateIcon />
        </span>
        Deactivate
      </button>
    </div>
  );
}
