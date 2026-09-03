import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  spotlights as seedSpotlights,
  type Spotlight,
} from "../data/spotlights";
import {
  CreateSpotlightPage,
  SpotlightCardPreview,
  type SpotlightDraft,
} from "./CreateSpotlightPage";
import { PrmModal } from "./PrmModal";
import { FullscreenViewer } from "./FullscreenViewer";
import { SearchTrailing } from "./SearchPanelParts";
import { SearchIcon, AddIcon, RowKebabIcon, RowDragIcon, RowEditIcon, RowDeleteIcon, RowEyeIcon, RowEyeOffIcon, MenuPreviewIcon, InfoIcon, ChevronDownSquareIcon } from "./icons";
import defaultSpotlightBg from "../assets/spotlight-default-bg.png";
import spotlightHomePreview from "../assets/spotlight-home-preview.png";
import { formatShortDate } from "../formatDate";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

type DisplayStatus = "active" | "pending" | "ended" | "rejected";

/** The four row actions that change a Spotlight's standing, each confirmed. */
type ConfirmKind = "approve" | "reject" | "disable" | "delete";

const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  active: "Active",
  pending: "In-Review",
  ended: "Ended",
  rejected: "Rejected",
};

/* Figma 558:2082 / 2046 / 2109 / 2141 — the row's status column uses the shared
   Table Pills (109:1237). */
const DISPLAY_STATUS_PILL: Record<DisplayStatus, string> = {
  active: "green",
  pending: "yellow",
  ended: "grey",
  rejected: "red",
};

// An approved Spotlight reads as "Ended" once its end date arrives — which is
// also how a deactivated one reads, since deactivating stamps today's date.
function deriveStatus(s: Spotlight): DisplayStatus {
  if (s.status === "pending") return "pending";
  if (s.status === "rejected") return "rejected";
  return daysUntil(s.endDate) <= 0 ? "ended" : "active";
}

/* 14px square-cap check / cross (Figma 192:385 / 192:388). */
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.17" strokeLinecap="square">
    <path d="M11.42 4.3 6.05 9.67 3.17 6.78" />
  </svg>
);

const CrossIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.17" strokeLinecap="square">
    <path d="M9.89 4.11 4.11 9.89M9.89 9.89 4.11 4.11" />
  </svg>
);

/* Column widths — shared by the sticky head table and the scrolling body table,
   so both resolve their columns identically. `Text` is the flexible column.
   Each width is the Figma cell content + the 24px the 12px cell padding adds
   (the 24px gap between two cells in 558:2082 = 12px of padding on each side).
   Position keeps 76px so its header label fits; the design's own is narrower. */
const SpColGroup = () => (
  <colgroup>
    <col style={{ width: 72 }} />
    <col style={{ width: 144 + 24 }} />
    <col />
    <col style={{ width: 72 + 24 }} />
    <col style={{ width: 103 + 24 }} />
    <col style={{ width: 96 + 24 }} />
    <col style={{ width: 103 + 12 + 16 + 24 }} />
  </colgroup>
);

/* Fixed columns + a floor for the flexible Title & Description column, which is
   the one that absorbs the page's width. Its floor is below the design's 435px —
   keeping 435 would push the actions column off-screen at normal widths. */
const SP_TABLE_MIN = 72 + 168 + 300 + 96 + 127 + 120 + 155;


/* The prototype's "today". Deactivating stamps this as the end date, so it has
   to be the same date `daysUntil` measures against or the row wouldn't flip to
   Ended. */
const TODAY = "2026-05-15";

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const today = new Date(TODAY);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/* The index just past the last Active / In-Review row — where a Spotlight
   joining the queue goes in, ahead of anything archived. */
function endOfLive(arr: Spotlight[]): number {
  return arr.reduce((acc, s, i) => {
    const ds = deriveStatus(s);
    return ds === "active" || ds === "pending" ? i + 1 : acc;
  }, 0);
}

export function SpotlightsPage() {
  // `committed` is the saved order; `list` is the working copy shown in the
  // table. Drag-reordering only touches `list`, so the order diverges until the
  // user saves — Discard (or leaving the page) restores `committed`. Every other
  // action commits to both immediately via `applyBoth`.
  const [committed, setCommitted] = useState<Spotlight[]>(seedSpotlights);
  const [list, setList] = useState<Spotlight[]>(seedSpotlights);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  // Set alongside `creating` when the page was opened from a row's Edit action.
  const [editing, setEditing] = useState<Spotlight | null>(null);
  /* The same editor, opened from an archived row's "Enable": the Spotlight's
     end date has been and gone, so the field starts blank and a date has to be
     picked before it can go back into the queue. */
  const [enabling, setEnabling] = useState(false);
  const [previewing, setPreviewing] = useState<Spotlight | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  /* A just-created Spotlight, dropped into the table so its queue slot can be
     dragged before it is submitted. It lives in `list` only — `committed` does
     not get it until "Submit for Review", so backing out leaves no trace. */
  const [placing, setPlacing] = useState<Spotlight | null>(null);
  const placingRowRef = useRef<HTMLTableRowElement | null>(null);
  const [menu, setMenu] = useState<{ item: Spotlight; rect: DOMRect } | null>(null);
  /* Every action that changes a Spotlight's standing — approve, reject,
     disable, delete — asks first, on the shared confirm shell. */
  const [confirming, setConfirming] = useState<{ kind: ConfirmKind; item: Spotlight } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Source row index kept in a ref so the drop handler never reads a stale value.
  const dragIndexRef = useRef<number | null>(null);

  function applyBoth(fn: (arr: Spotlight[]) => Spotlight[]) {
    setCommitted((prev) => fn(prev));
    setList((prev) => fn(prev));
  }

  /* Land on the new Spotlight rather than at whatever scroll position the table
     happened to be at — it goes in at the end of the queue, which is usually
     off-screen. Keyed on `placing`, so it also re-runs after Continue Editing. */
  useEffect(() => {
    if (!placing) return;
    placingRowRef.current?.scrollIntoView({ block: "center" });
  }, [placing]);

  const dirty = useMemo(
    () =>
      list.map((s) => s.id).join(",") !== committed.map((s) => s.id).join(","),
    [list, committed],
  );

  // Reordering by drag only makes sense against the full, unfiltered queue.
  const canReorder = !query.trim();

  // Only rows still in the Home-Screen queue (active / pending) get a position
  // number; rejected and ended rows are out of the queue.
  const positions = useMemo(() => {
    const m = new Map<string, number>();
    let p = 0;
    list.forEach((s) => {
      const ds = deriveStatus(s);
      if (ds === "active" || ds === "pending") m.set(s.id, ++p);
    });
    return m;
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      if (q && !(
        s.headingEn.toLowerCase().includes(q) ||
        (s.descriptionEn ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.submittedBy.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [list, query]);

  /* Spotlights that are done — ended or rejected — are archived: they fall out
     of the queue and sit behind the collapsed row at the foot of the table
     (564:2244), so the live queue reads top to bottom without them. */
  const [live, archived] = useMemo(() => {
    const a: Spotlight[] = [];
    const l: Spotlight[] = [];
    filtered.forEach((s) => {
      const ds = deriveStatus(s);
      (ds === "ended" || ds === "rejected" ? a : l).push(s);
    });
    return [l, a];
  }, [filtered]);

  // Starting a fresh create abandons any Spotlight still awaiting placement.
  function openCreate() {
    setEditing(null);
    setEnabling(false);
    dropPlacing();
    setCreating(true);
  }

  // No new Spotlight while one is still being placed — the footer owns the page
  // until that one is submitted or dropped.
  useCreateShortcut(openCreate, !creating && !placing);

  function dropPlacing() {
    if (!placing) return;
    setList((l) => l.filter((s) => s.id !== placing.id));
    setPlacing(null);
  }

  // Cancel — nothing is kept, including a placement that was being revised.
  function cancelCreate() {
    setCreating(false);
    setEditing(null);
    setEnabling(false);
    dropPlacing();
  }

  function handleSubmit(draft: SpotlightDraft) {
    // Editing writes the draft back over the existing row, in place: its id,
    // status, submitter and queue slot are all unchanged.
    if (editing) {
      const rewrite = (s: Spotlight): Spotlight => ({
        ...s,
        headingEn: draft.headingEn || s.headingEn,
        headingEs: draft.headingEs || undefined,
        descriptionEn: draft.descriptionEn || undefined,
        descriptionEs: draft.descriptionEs || undefined,
        ctaTextEn: draft.ctaTextEn || undefined,
        ctaTextEs: draft.ctaTextEs || undefined,
        ctaUrl: draft.ctaUrl || undefined,
        endDate: draft.endDate,
        imageHint: draft.imageHint ?? s.imageHint,
      });

      if (enabling) {
        /* Enabling puts an archived Spotlight back in the queue with its new
           end date. One that was approved before (it simply ran out) goes
           straight back to Active; a rejected one was never signed off, so it
           returns as In-Review. Either way it re-enters at the end of the
           queue, and the admin drags it from there. */
        applyBoth((l) => {
          const target = l.find((s) => s.id === editing.id);
          if (!target) return l;
          const revived: Spotlight = {
            ...rewrite(target),
            status: target.status === "rejected" ? "pending" : "approved",
          };
          const without = l.filter((s) => s.id !== editing.id);
          const next = [...without];
          next.splice(endOfLive(without), 0, revived);
          return next;
        });
      } else {
        applyBoth((l) => l.map((s) => (s.id === editing.id ? rewrite(s) : s)));
      }

      setCreating(false);
      setEditing(null);
      setEnabling(false);
      return;
    }

    // Resuming keeps the id it was given the first time round, so returning to
    // the table replaces the provisional row instead of adding a second one.
    const id = placing?.id ?? `SP-${String(Math.floor(Math.random() * 9000) + 1000)}`;
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
      submittedAt: TODAY,
      status: "pending",
    };
    /* Goes into the working copy only, at the end of the live queue (after the
       last Active / In-Review row, ahead of anything archived). The admin drags
       it from there; nothing is committed until "Submit for Review". */
    setList((l) => {
      const without = l.filter((s) => s.id !== id);
      const next = [...without];
      next.splice(endOfLive(without), 0, newSpotlight);
      return next;
    });
    setPlacing(newSpotlight);
    /* A live search would hide the new row and, since dragging is disabled while
       filtering, make it unplaceable — clear it so the queue is whole. */
    setQuery("");
    setCreating(false);
    setEditing(null);
  }

  // "Submit for Review" — the placement is accepted and the queue is committed.
  function submitForReview() {
    setCommitted(list);
    setPlacing(null);
  }

  // "Continue Editing" — pull the provisional row back out and reopen the form
  // with what was typed.
  function continueEditing() {
    if (!placing) return;
    setList((l) => l.filter((s) => s.id !== placing.id));
    setCreating(true);
  }

  function remove(item: Spotlight) {
    applyBoth((l) => l.filter((s) => s.id !== item.id));
  }

  /* Disable — the Spotlight comes off the Home Screen now. It is not a status
     of its own: the row stays approved and its end date is stamped with today,
     so it reads as Ended and archives like any Spotlight that ran its course.
     It moves to the end of the list, the way Reject does, so the stored order
     matches where the row now shows. */
  function disable(item: Spotlight) {
    applyBoth((l) => [
      ...l.filter((s) => s.id !== item.id),
      { ...item, endDate: TODAY },
    ]);
  }

  /* Enable — opens the editor on an archived Spotlight with its (spent) end
     date cleared. Nothing changes until that editor is saved. */
  function enable(item: Spotlight) {
    setEditing(item);
    setEnabling(true);
    setCreating(true);
  }

  // Rejecting archives the Spotlight: it moves to the end of the list so the
  // stored order matches where it now shows — behind the archived row.
  function decline(item: Spotlight) {
    applyBoth((l) => [
      ...l.filter((s) => s.id !== item.id),
      { ...item, status: "rejected" },
    ]);
  }

/* Approving takes the row live where it already sits. There is no position
   step: the queue slot was chosen when the Spotlight was submitted, it is
   visible in the Order column, and it stays draggable afterwards — so asking
   again in a dialog only repeated a decision already made. */
  function approve(item: Spotlight) {
    applyBoth((l) =>
      l.map((s) => (s.id === item.id ? { ...s, status: "approved" } : s)),
    );
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

  // Drag indices are positions in `list`, not in the rendered slice, so the
  // live and archived groups can be rendered separately and still reorder.
  function renderRows(rows: Spotlight[]) {
    return rows.map((s) => {
      const idx = list.indexOf(s);
      return (
        <SpotlightRow
          key={s.id}
          spotlight={s}
          position={positions.get(s.id) ?? null}
          canReorder={canReorder}
          isDragging={dragIndex === idx}
          isOver={overIndex === idx && dragIndex !== idx}
          onOpenMenu={(rect) => setMenu({ item: s, rect })}
          menuOpen={menu?.item.id === s.id}
          isNew={placing?.id === s.id}
          rowRef={placing?.id === s.id ? placingRowRef : undefined}
          onApprove={() => setConfirming({ kind: "approve", item: s })}
          onDecline={() => setConfirming({ kind: "reject", item: s })}
          onDragStart={() => startDrag(idx)}
          onDragEnterRow={() => {
            if (dragIndexRef.current !== null) setOverIndex(idx);
          }}
          onDropRow={() => onRowDrop(idx)}
          onDragEndRow={endDrag}
        />
      );
    });
  }

  // Creating and editing are a full-screen page (not an overlay drawer): it
  // takes over the whole content area, the same way the other wizards do.
  if (creating) {
    return (
      <CreateSpotlightPage
        onClose={cancelCreate}
        onSubmit={handleSubmit}
        editing={editing ?? undefined}
        enabling={enabling}
        resuming={placing ?? undefined}
      />
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks sp-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Spotlight</h1>
              <div className="tasks-subtitle sp-subtitle">
                Home screen banners for announcements, releases, and other highlights
                <button
                  className="sp-info"
                  aria-label="How Spotlights work"
                  aria-describedby="sp-infotip"
                >
                  <InfoIcon />
                </button>
                <SpotlightInfoTip />
              </div>
            </div>
            <div className="tasks-header-actions">
              <button
                className="new-task"
                onClick={openCreate}
                disabled={!!placing}
                title={placing ? "Finish placing the new Spotlight first" : undefined}
              >
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
                placeholder="Search Spotlights by Title, Description, or Creator…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <SearchTrailing active={!!query} onClear={() => setQuery("")} />
            </div>
          </div>

          {/* Two-table layout (as in Tasks): the head table sticks to the top of
              .table-xscroll while only the body table scrolls beneath it. Both
              carry the same <SpColGroup> so the columns stay aligned. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": `${SP_TABLE_MIN}px` } as React.CSSProperties}
          >
            <table className="sp-table table-head">
              <SpColGroup />
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Backdrop</th>
                  <th>Title &amp; Description</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>End Date</th>
                  <th className="sp-th-actions">Actions</th>
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll sp-scroll">
            <table className="sp-table table-body">
              <SpColGroup />
              <tbody>
                {filtered.length === 0 ? (
                  <tr className="sp-empty-row">
                    <td colSpan={7}>
                      No Spotlights match. Try a different filter or search term.
                    </td>
                  </tr>
                ) : (
                  renderRows(live)
                )}

                {/* Archived (ended / rejected) Spotlights live behind this row
                    at the foot of the table (564:2244) — but not while a new
                    Spotlight is being placed. Placement is about the live queue
                    and nothing else, and the archive only puts rows between the
                    dragged row and the end of the list it is being dropped
                    into. The toggle comes back, in whatever state it was left,
                    as soon as the placement is submitted or dropped. */}
                {!placing && archived.length > 0 && (
                  <tr className="sp-archive-row">
                    <td colSpan={7}>
                      <button
                        className={`sp-archive-toggle${showArchived ? " is-open" : ""}`}
                        onClick={() => setShowArchived((v) => !v)}
                        aria-expanded={showArchived}
                      >
                        {showArchived ? "Hide" : "Show"} Archived Spotlights
                        <ChevronDownSquareIcon />
                      </button>
                    </td>
                  </tr>
                )}

                {!placing && showArchived && renderRows(archived)}
              </tbody>
            </table>
            </div>
          </div>

          {/* In flow at the bottom of the page column, not fixed to the viewport,
              so it stops at the left nav — the same way the Create Spotlight
              page's wizard footer does. Two modes: placing a newly created
              Spotlight, or a plain reorder of the committed queue. */}
          {placing ? (
            <footer className="sp-save-footer">
              <div className="sp-save-footer-text">
                Drag to reorder the Spotlight in the queue
              </div>
              <div className="sp-save-footer-actions">
                <button className="btn-save-draft" onClick={continueEditing}>
                  Continue Editing
                </button>
                <button
                  className="btn-publish sp-submit"
                  onClick={submitForReview}
                >
                  Submit for Review
                </button>
              </div>
            </footer>
          ) : dirty ? (
            <footer className="sp-save-footer">
              <div className="sp-save-footer-text">Order Updated</div>
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
          ) : null}
        </div>
      </div>

      {menu && (
        <SpotlightActionsMenu
          rect={menu.rect}
          status={deriveStatus(menu.item)}
          onClose={() => setMenu(null)}
          onEdit={() => {
            setEditing(menu.item);
            setEnabling(false);
            setCreating(true);
          }}
          onEnable={() => enable(menu.item)}
          onPreview={() => setPreviewing(menu.item)}
          onDisable={() => setConfirming({ kind: "disable", item: menu.item })}
          onDelete={() => setConfirming({ kind: "delete", item: menu.item })}
        />
      )}

      {previewing && (
        <SpotlightPreviewModal
          item={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}

      {confirming && (
        <ConfirmActionModal
          kind={confirming.kind}
          item={confirming.item}
          position={positions.get(confirming.item.id) ?? null}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const { kind, item } = confirming;
            if (kind === "approve") approve(item);
            else if (kind === "reject") decline(item);
            else if (kind === "disable") disable(item);
            else remove(item);
            setConfirming(null);
          }}
        />
      )}

    </div>
  );
}

/* The confirm behind Approve / Reject / Disable / Delete — the shared confirm
   shell (Figma 483:588), one copy driven by `kind`. Reject and Delete take the
   red CTA; Approve and Disable do not, because neither loses anything (a
   disabled Spotlight is one Enable away from being live again). */
function ConfirmActionModal({
  kind,
  item,
  position,
  onCancel,
  onConfirm,
}: {
  kind: ConfirmKind;
  item: Spotlight;
  /** The Spotlight's slot in the queue, when it is in one. */
  position: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const name = item.headingEn;
  const copy: Record<ConfirmKind, { title: string; body: React.ReactNode; cta: string; danger?: boolean }> = {
    approve: {
      title: "Approve Spotlight",
      body: (
        <>
          “{name}” goes live on the Home Screen{position !== null ? ` at position ${position}` : ""},
          and stays up until {formatShortDate(item.endDate)}. You can reorder or
          disable it at any time.
        </>
      ),
      cta: "Approve",
    },
    reject: {
      title: "Reject Spotlight",
      body: (
        <>
          “{name}” never goes live. It leaves the queue and moves to the archive,
          where it can still be previewed or deleted.
        </>
      ),
      cta: "Reject",
      danger: true,
    },
    disable: {
      title: "Disable Spotlight",
      body: (
        <>
          “{name}” comes off the Home Screen now and moves to the archive. To put
          it back, Enable it from there with a new end date.
        </>
      ),
      cta: "Disable",
    },
    delete: {
      title: "Delete Spotlight",
      body: (
        <>
          “{name}” ({item.id}) is removed from the Spotlight list. This can't be
          undone.
        </>
      ),
      cta: "Delete",
      danger: true,
    },
  };
  const c = copy[kind];

  return (
    <PrmModal
      title={c.title}
      confirmLabel={c.cta}
      danger={c.danger}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {/* Body copy is children, not `description` — the shell's own convention
          for a confirm (Figma 483:588). */}
      <p className="prm-text">{c.body}</p>
    </PrmModal>
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
  menuOpen,
  isNew,
  rowRef,
}: {
  spotlight: Spotlight;
  /** Queue position — null for rows out of the queue (rejected / ended). */
  position: number | null;
  canReorder: boolean;
  isDragging: boolean;
  isOver: boolean;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
  /** The Spotlight just created and awaiting placement — call it out. */
  isNew: boolean;
  /** Set on that same row so the page can scroll it into view. */
  rowRef?: React.MutableRefObject<HTMLTableRowElement | null>;
  onOpenMenu: (rect: DOMRect) => void;
  onApprove: () => void;
  onDecline: () => void;
  onDragStart: () => void;
  onDragEnterRow: () => void;
  onDropRow: () => void;
  onDragEndRow: () => void;
}) {
  const s = spotlight;
  const ds = deriveStatus(s);
  const isPending = s.status === "pending";
  // Out-of-queue rows (no position) can't be dragged, but still accept drops so
  // queue rows can be moved past them.
  const canDrag = canReorder && position !== null;

  return (
    <tr
      ref={rowRef}
      className={`sp-tr sp-tr--${s.status} ${isDragging ? "is-dragging" : ""} ${
        isOver ? "is-drop-target" : ""
      } ${menuOpen ? "menu-open" : ""} ${isNew ? "is-new" : ""}`}
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnter={canReorder ? onDragEnterRow : undefined}
      onDragOver={canReorder ? (e) => e.preventDefault() : undefined}
      onDrop={canReorder ? onDropRow : undefined}
      onDragEnd={canDrag ? onDragEndRow : undefined}
    >
      <td className="sp-td-pos">
        {/* Every queued row reserves the handle's slot, whether or not the queue
            can be reordered right now — dropping the element while a search is
            on would slide the whole Order column left as you type. Filtering
            just stops it appearing on hover. */}
        {position !== null && (
          <span
            className={`sp-drag-handle${canDrag ? "" : " sp-drag-handle--off"}`}
            aria-hidden
            title={canDrag ? "Drag to reorder" : undefined}
          >
            <RowDragIcon />
          </span>
        )}
        {position !== null && <span className="sp-pos-num">{position}</span>}
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
        <span className={`co-status-pill co-status-pill--${DISPLAY_STATUS_PILL[ds]}`}>
          {DISPLAY_STATUS_LABEL[ds]}
        </span>
      </td>
      <td className="sp-td-by">{s.submittedBy}</td>
      <td className="sp-td-muted">{formatShortDate(s.endDate)}</td>
      {/* The kebab sits beside the decide buttons, not instead of them
          (558:2046) — except while this row is the Spotlight being placed. That
          one has not been submitted yet, so there is nothing to approve, edit
          or delete; the page's footer owns it until "Submit for Review". */}
      <td className="sp-td-actions">
        {isNew ? null : (
        <div className="sp-actions">
        {isPending && (
          <div className="sp-decide">
            <button
              className="sp-decide-btn sp-decide-btn--approve"
              onClick={(e) => {
                e.stopPropagation();
                onApprove();
              }}
            >
              <CheckIcon />
              Approve
            </button>
            <button
              className="sp-decide-btn sp-decide-btn--reject"
              onClick={(e) => {
                e.stopPropagation();
                onDecline();
              }}
            >
              <CrossIcon />
              Reject
            </button>
          </div>
        )}
        <button
          className="sp-kebab"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(e.currentTarget.getBoundingClientRect());
          }}
        >
          <RowKebabIcon />
        </button>
        </div>
        )}
      </td>
    </tr>
  );
}

/* Figma 566:2284 "Spotlight Tooltip" — the copy beside a preview of where the
   banner lands on the app's home screen. Hover-only (no links inside), so it
   stays a CSS :hover / :focus-within card rather than a positioned popover. */
function SpotlightInfoTip() {
  return (
    <span className="sp-infotip" id="sp-infotip" role="tooltip">
      <span className="sp-infotip-text">
        <p>
          Active Spotlight is shown to all users right now (targeting specific
          user groups isn't supported yet).
        </p>
        <p>
          New Spotlights need approval before going live, and you can set where a
          new one should sit in the queue relative to existing ones. Approvers
          can adjust that position before signing off.
        </p>
        <p>
          Once a user dismisses a Spotlight, it won't come back for them even if
          the queue gets reordered later. Spotlights stay active until they're
          manually turned off or their end date passes (max 6 months out).
        </p>
      </span>
      <img className="sp-infotip-img" src={spotlightHomePreview} alt="" />
    </span>
  );
}

function SpotlightPreview({ spotlight }: { spotlight: Spotlight }) {
  // 165×87 artwork tile (558:2070). The prototype has no per-Spotlight image
  // file — only a `imageHint` filename — so this shows the same default artwork
  // the Create Spotlight preview falls back to, tinted by `backgroundColor`
  // when a Spotlight was authored without an image.
  return (
    <div
      className="sp-thumb"
      style={spotlight.backgroundColor ? { background: spotlight.backgroundColor } : undefined}
    >
      {!spotlight.backgroundColor || spotlight.imageHint ? (
        <img className="sp-thumb-img" src={defaultSpotlightBg} alt="" />
      ) : null}
    </div>
  );
}

/* ─────────────── Three-dot row actions menu ─────────────── */
/* Three actions on the shared .u-menu chrome, and which three depends on where
   the Spotlight is in its life:

     Active    Edit · Preview · Disable   — live, so it can be pulled down but
                                            not deleted out from under users
     In-Review Edit · Preview · Delete    — nothing has shipped yet
     Archived  Enable · Preview · Delete  — done; Enable is the way back, and
                                            it reopens the editor for a new
                                            end date rather than editing in
                                            place (the old one has expired)

   Fixed-positioned so it escapes the table's scroll container. */

function SpotlightActionsMenu({
  rect,
  status,
  onClose,
  onEdit,
  onEnable,
  onPreview,
  onDisable,
  onDelete,
}: {
  rect: DOMRect;
  status: DisplayStatus;
  onClose: () => void;
  onEdit: () => void;
  onEnable: () => void;
  onPreview: () => void;
  onDisable: () => void;
  onDelete: () => void;
}) {
  // Ended and Rejected are the two archived states — both sit behind the
  // table's "Show Archived Spotlights" row, and both offer Enable.
  const archived = status === "ended" || status === "rejected";
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
      /* --hug, like every other row menu: three one-word labels have no use for
         the shared panel's 210px floor. */
      className="u-menu u-menu--hug"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {archived ? (
        <button
          className="u-menu-item"
          onClick={() => {
            onEnable();
            onClose();
          }}
        >
          <span className="u-menu-item-icon">
            <RowEyeIcon />
          </span>
          Enable
        </button>
      ) : (
        <button
          className="u-menu-item"
          onClick={() => {
            onEdit();
            onClose();
          }}
        >
          <span className="u-menu-item-icon">
            <RowEditIcon />
          </span>
          Edit
        </button>
      )}
      <button
        className="u-menu-item"
        onClick={() => {
          onPreview();
          onClose();
        }}
      >
        <span className="u-menu-item-icon">
          <MenuPreviewIcon />
        </span>
        Preview
      </button>
      {status === "active" ? (
        <button
          className="u-menu-item"
          onClick={() => {
            onDisable();
            onClose();
          }}
        >
          <span className="u-menu-item-icon">
            <RowEyeOffIcon />
          </span>
          Disable
        </button>
      ) : (
        <button
          className="u-menu-item u-menu-item--danger"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <span className="u-menu-item-icon">
            <RowDeleteIcon />
          </span>
          Delete
        </button>
      )}
    </div>
  );
}

/* How much of the stage the card is allowed to take, and how far it may be
   blown up. The card is authored at the app's 361px phone width; 2x lands it
   near the 630px the Home-Screen banner runs at, and past that it stops reading
   as a banner and starts reading as a wall of type. */
const SP_PREVIEW_FILL = 0.9;
const SP_PREVIEW_MAX_SCALE = 2;

/* Preview — the same Spotlight card the Create page shows in its preview rail
   (556:1975), for a row that already exists, on the shared fullscreen viewer
   rather than a dialog. No zoom or rotate: the card is scaled to the stage
   already, and — unlike the ID card that viewer was built for — it is live,
   with a button that follows the Spotlight's own re-direct. */
function SpotlightPreviewModal({
  item,
  onClose,
}: {
  item: Spotlight;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  /* The card's unscaled layout size. offsetWidth/Height, not a measured rect —
     the element carries the fit transform, so a rect would feed the fit its own
     output. */
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => setNatural({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasCta = Boolean(item.ctaTextEn && item.ctaUrl);

  return (
    <FullscreenViewer
      controls={false}
      hint={
        hasCta
          ? "Click the button to open its re-direct · Esc or Click Outside to Close"
          : "Esc or Click Outside to Close"
      }
      onClose={onClose}
    >
      {({ stage }) => {
        const fit =
          natural.w && natural.h && stage.w && stage.h
            ? Math.max(
                1,
                Math.min(
                  SP_PREVIEW_MAX_SCALE,
                  (stage.w * SP_PREVIEW_FILL) / natural.w,
                  (stage.h * SP_PREVIEW_FILL) / natural.h,
                ),
              )
            : 1;
        return (
          <div
            ref={cardRef}
            className="sp-preview-card"
            style={{ transform: `scale(${fit})` }}
          >
            <SpotlightCardPreview
              title={item.headingEn}
              description={item.descriptionEn ?? ""}
              cta={item.ctaTextEn ?? ""}
              ctaEnabled={Boolean(item.ctaTextEn)}
              ctaHref={hasCta ? item.ctaUrl : undefined}
            />
          </div>
        );
      }}
    </FullscreenViewer>
  );
}
