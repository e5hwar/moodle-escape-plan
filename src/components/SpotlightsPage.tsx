import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  daysUntil,
  spotlightToday,
  type Spotlight,
} from "../data/spotlights";
import {
  CreateSpotlightPage,
  SpotlightCardPreview,
  SpotlightThumb,
  type SpotlightDraft,
} from "./CreateSpotlightPage";
import { PrmModal } from "./PrmModal";
import { CopiedToast } from "./CopiedToast";
import { FullscreenViewer } from "./FullscreenViewer";
import { SearchTrailing } from "./SearchPanelParts";
import { SearchIcon, AddIcon, RowKebabIcon, RowDragIcon, RowEditIcon, RowDeleteIcon, RowEyeIcon, RowEyeOffIcon, MenuPreviewIcon, InfoIcon14, ChevronDownSquareIcon } from "./icons";
import spotlightHomePreview from "../assets/spotlight-home-preview.png";
import { formatShortDate } from "../formatDate";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { useLeaveGuard } from "./LeaveGuard";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";

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

// A Spotlight runs THROUGH its end date and reads as "Ended" the day after.
// One still In-Review when that day comes ends too — it can no longer be
// approved. A disabled one reads as Ended at once (its end date is today).
function deriveStatus(s: Spotlight): DisplayStatus {
  if (s.status === "rejected") return "rejected";
  if (s.disabled || daysUntil(s.endDate) < 0) return "ended";
  return s.status === "pending" ? "pending" : "active";
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
   so both resolve their columns identically. Each width is the cell content +
   the 24px the 12px cell padding adds (the 24px gap between two cells in
   558:2082 = 12px of padding on each side). Order keeps 72px so its header
   label fits; the design's own is narrower.

   Title & Description is sized to the copy limits (SPOTLIGHT_TITLE_MAX /
   SPOTLIGHT_DESCRIPTION_MAX), not to the page: 300px holds a 20-character title
   on one line (~170px even in capitals) and a 60-character description in two
   (the worst word-wrap measured ~290px).

   Actions holds only the 103px Approve / Reject block — that pair is what its
   header names. The 16px 3-dot menu is on every row, so it gets its own
   unlabelled column after it; at the floor width the two sit the design's 24px
   apart (898:3575), one cell's padding each side of the column line.

   Every column carries a width, like the other list tables: their sum is the
   table's floor (below it the table scrolls sideways), and on a wider page the
   fixed layout spreads the slack across all of them in proportion to these
   widths. A bare <col /> would make one column swallow all of it. */
const SP_TEXT_W = 300 + 24;
const SP_COL_WIDTHS = [72, 144 + 24, SP_TEXT_W, 84 + 24, 103 + 24, 96 + 24, 103 + 24, 16 + 24];
/* The last width is the kebab gutter: it stays fixed, the rest take the slack. */
const SpColGroup = () => (
  <TableCols data={SP_COL_WIDTHS.slice(0, -1)} trail={SP_COL_WIDTHS.slice(-1)} />
);

const SP_TABLE_MIN = SP_COL_WIDTHS.reduce((a, b) => a + b, 0);


/* Active or In-Review — a Spotlight in the Home-Screen queue. */
function isLive(s: Spotlight): boolean {
  const ds = deriveStatus(s);
  return ds === "active" || ds === "pending";
}

/* Active rows numbered 1, 2, 3… in list order — the Order column. */
function activePositions(arr: Spotlight[]): Map<string, number> {
  const m = new Map<string, number>();
  let p = 0;
  arr.forEach((s) => {
    if (deriveStatus(s) === "active") m.set(s.id, ++p);
  });
  return m;
}

/* The position an In-Review Spotlight goes live at when approved: one past
   the Active rows ahead of it in the queue as shown. */
function approvePosition(arr: Spotlight[], item: Spotlight): number {
  const at = arr.findIndex((s) => s.id === item.id);
  return arr.slice(0, Math.max(0, at)).filter((s) => deriveStatus(s) === "active").length + 1;
}

/* The index just past the last Active / In-Review row — where a Spotlight
   joining the queue goes in, ahead of anything archived. */
function endOfLive(arr: Spotlight[]): number {
  return arr.reduce((acc, s, i) => {
    const ds = deriveStatus(s);
    return ds === "active" || ds === "pending" ? i + 1 : acc;
  }, 0);
}

export function SpotlightsPage({
  spotlights: committed,
  setSpotlights: setCommitted,
}: {
  /** The saved Spotlights, in queue order — App state, so approvals, edits
   *  and saved reorders outlast a visit to another page. */
  spotlights: Spotlight[];
  setSpotlights: React.Dispatch<React.SetStateAction<Spotlight[]>>;
}) {
  // `committed` is the saved order; `list` is the working copy shown in the
  // table. Drag-reordering only touches `list`, so the order diverges until the
  // user saves — Discard (or leaving the page) restores `committed`. Every other
  // action commits to both immediately via `applyBoth`.
  const [list, setList] = useState<Spotlight[]>(committed);
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
  /* Success toast (the shared CopiedToast chrome, as on Companies / Users) for
     a created, approved or rejected Spotlight. `at` keys it, so a second one
     restarts the toast instead of being swallowed by the first. */
  const [toast, setToast] = useState<{ label: string; at: number } | null>(null);
  const flash = (label: string) => setToast({ label, at: Date.now() });
  // Stable, so re-renders under the toast don't restart its timer.
  const clearToast = useCallback(() => setToast(null), []);
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

  const dirty = useMemo(
    () =>
      list.map((s) => s.id).join(",") !== committed.map((s) => s.id).join(","),
    [list, committed],
  );
  // An unsaved reorder asks before leaving the page. The page has no exit of
  // its own (the sidebar and browser Back go through App), so this only registers.
  useLeaveGuard(dirty);

  // Reordering by drag only makes sense against the full, unfiltered queue.
  const canReorder = !query.trim();

  // Only Active rows — the ones users actually see — get a position number.
  // In-Review rows sit in the queue (and can be dragged) but have no number
  // until approved; rejected and ended rows are out of the queue.
  const positions = useMemo(() => activePositions(list), [list]);

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

  function openCreate() {
    setEditing(null);
    setEnabling(false);
    setCreating(true);
  }

  /* Not while a confirm, the Preview viewer or a row menu is up: the hook
     itself stands down for any of those in the DOM, and these flags cover the
     frame before they render. */
  useCreateShortcut(openCreate, !creating && !confirming && !previewing && !menu);

  // Cancel — nothing is kept.
  function cancelCreate() {
    setCreating(false);
    setEditing(null);
    setEnabling(false);
  }

  /* The live queue (Active + In-Review, in order) the wizard's Queue Position
     step places into — less the Spotlight being edited, which the wizard slots
     back in itself. Taken from the SAVED order, not the working copy: an
     unsaved drag-reorder is only saved by the reorder footer, never by
     submitting the wizard. */
  const wizardQueue = useMemo(
    () => committed.filter((s) => isLive(s) && s.id !== editing?.id),
    [committed, editing],
  );
  /* Where that step starts the Spotlight: an edit at its current slot, a new
     or re-enabled one at the end of the queue. */
  const wizardStart = editing && !enabling
    ? Math.max(0, committed.filter(isLive).findIndex((s) => s.id === editing.id))
    : wizardQueue.length;

  /* Saving the wizard puts the Spotlight at `position` in the saved live
     queue. An unsaved drag-reorder stays exactly that: the same edit is
     applied to the working copy, so the reorder footer still offers to save
     or discard it. */
  function handleSubmit(draft: SpotlightDraft, position: number) {
    const place = (l: Spotlight[], item: Spotlight) => {
      const without = l.filter((s) => s.id !== item.id);
      const liveRows = without.filter(isLive);
      const at = position < liveRows.length ? without.indexOf(liveRows[position]) : endOfLive(without);
      const next = [...without];
      next.splice(at, 0, item);
      return next;
    };
    const commit = (item: Spotlight) => {
      setCommitted((l) => place(l, item));
      // No unsaved reorder: the working copy is the saved order. Otherwise
      // keep the working order and only slot the Spotlight into it.
      setList((l) => (dirty ? place(l, item) : place(committed, item)));
    };

    // Editing writes the draft back over the existing row: its id, submitter
    // and (unless re-enabled) status are unchanged; its slot is the step 2 pick.
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
        // The editor's image is the whole truth: replaced, kept or removed.
        imageHint: draft.imageHint,
        imageUrl: draft.imageUrl,
      });

      const target = committed.find((s) => s.id === editing.id);
      if (target) {
        /* Enabling puts an archived Spotlight — Ended or Rejected — back in
           the queue as Active, with its new end date and queue slot, and
           starts a new run (the 6-month cap counts from today). Everyone in
           the prototype can approve, so it needs no second sign-off. */
        const updated: Spotlight = enabling
          ? {
              ...rewrite(target),
              status: "approved",
              disabled: undefined,
              createdAt: spotlightToday(),
            }
          : rewrite(target);
        commit(updated);
        flash(enabling ? "Spotlight Enabled" : "Spotlight Updated");
      }

      setCreating(false);
      setEditing(null);
      setEnabling(false);
      return;
    }

    // One past the highest id on record, saved or not — never a repeat.
    const top = [...committed, ...list].reduce(
      (n, s) => Math.max(n, parseInt(s.id.replace(/\D/g, ""), 10) || 0),
      0,
    );
    const id = `SP-${String(top + 1).padStart(4, "0")}`;
    const today = spotlightToday();
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
      imageUrl: draft.imageUrl,
      submittedBy: "You",
      submittedAt: today,
      createdAt: today,
      status: "pending",
    };
    commit(newSpotlight);
    setCreating(false);
    setEditing(null);
    flash("Spotlight Created");
  }

  function remove(item: Spotlight) {
    applyBoth((l) => l.filter((s) => s.id !== item.id));
    flash("Spotlight Deleted");
  }

  /* Disable — the Spotlight comes off the Home Screen now. It is not a status
     of its own: the row stays approved, its end date is stamped with today and
     it is flagged disabled, so it reads as Ended and archives like any
     Spotlight that ran its course.
     It moves to the end of the list, the way Reject does, so the stored order
     matches where the row now shows. */
  function disable(item: Spotlight) {
    applyBoth((l) => [
      ...l.filter((s) => s.id !== item.id),
      { ...item, endDate: spotlightToday(), disabled: true },
    ]);
    flash("Spotlight Disabled");
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
    flash("Spotlight Rejected");
  }

/* Approving takes the row live where it already sits. There is no position
   step: the queue slot was chosen when the Spotlight was submitted, it is
   visible in the Order column, and it stays draggable afterwards — so asking
   again in a dialog only repeated a decision already made. */
  function approve(item: Spotlight) {
    applyBoth((l) =>
      l.map((s) => (s.id === item.id ? { ...s, status: "approved" } : s)),
    );
    flash("Spotlight Approved");
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
    flash("Spotlight Order Saved");
  }

  function discardOrder() {
    setList(committed);
    setDragIndex(null);
    setOverIndex(null);
  }

  /* Once the past group has finished opening, bring it into view if it ran
     past the bottom of the table — scrolling only as far as keeps the toggle
     row on screen. Waiting for the grow to finish means the scroll has room. */
  const archiveRowRef = useRef<HTMLTableRowElement>(null);
  const archivedRef = useRef<HTMLDivElement>(null);
  function onPastTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || e.propertyName !== "grid-template-rows") return;
    if (!showArchived) return;
    const past = archivedRef.current;
    const toggle = archiveRowRef.current;
    const scroller = past?.closest(".table-xscroll");
    if (!past || !toggle || !scroller) return;
    const box = scroller.getBoundingClientRect();
    const head = scroller.querySelector(".table-head")?.getBoundingClientRect().height ?? 0;
    const overflow = past.getBoundingClientRect().bottom - box.bottom;
    const room = toggle.getBoundingClientRect().top - (box.top + head);
    const by = Math.min(overflow, room);
    if (by > 0) scroller.scrollBy({ top: by, behavior: "smooth" });
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
          inQueue={isLive(s)}
          canReorder={canReorder}
          isDragging={dragIndex === idx}
          isOver={overIndex === idx && dragIndex !== idx}
          onOpenMenu={(rect) => setMenu({ item: s, rect })}
          menuOpen={menu?.item.id === s.id}
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
        queue={wizardQueue}
        startPosition={wizardStart}
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
                  {/* The 14px cut (742:1061), same as the Skills subtext. */}
                  <InfoIcon14 />
                </button>
                <SpotlightInfoTip />
              </div>
            </div>
            <div className="tasks-header-actions">
              <button
                className="new-task"
                onClick={openCreate}
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
                placeholder="Search Spotlights by Title, Description, or Creator..."
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
                  <th>Actions</th>
                  {/* The 3-dot menu's column — deliberately unlabelled. */}
                  <th />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll sp-scroll">
            <table className="sp-table table-body">
              <SpColGroup />
              <tbody>
                {renderRows(live)}

                {/* Past (ended / rejected) Spotlights live behind this row
                    at the foot of the table (564:2244). */}
                {archived.length > 0 && (
                  <tr className="sp-archive-row" ref={archiveRowRef}>
                    <td colSpan={SP_COL_WIDTHS.length}>
                      <button
                        className={`sp-archive-toggle${showArchived ? " is-open" : ""}`}
                        onClick={() => setShowArchived((v) => !v)}
                        aria-expanded={showArchived}
                        aria-controls="sp-past"
                      >
                        {showArchived ? "Hide" : "Show"} Past Spotlights
                        <ChevronDownSquareIcon />
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* The past rows are their own table (same <SpColGroup>, so the
                columns stay aligned) inside a 0fr → 1fr grid track: the group
                grows and fades in under the toggle instead of popping in, and
                collapses the same way. Kept mounted so it can animate out;
                `inert` keeps the hidden rows out of the tab order. */}
            {archived.length > 0 && (
              <div
                id="sp-past"
                ref={archivedRef}
                className={`sp-past${showArchived ? " is-open" : ""}`}
                onTransitionEnd={onPastTransitionEnd}
                {...(showArchived ? {} : { inert: "" })}
              >
                <div className="sp-past-inner">
                  <table className="sp-table table-body">
                    <SpColGroup />
                    <tbody>{renderRows(archived)}</tbody>
                  </table>
                </div>
              </div>
            )}
            </div>
            {filtered.length === 0 && <TableEmpty />}
          </div>

          {/* In flow at the bottom of the page column, not fixed to the viewport,
              so it stops at the left nav — the same way the Create Spotlight
              page's wizard footer does. Shown while the queue has an unsaved
              drag-reorder. */}
          {dirty ? (
            <footer className="sp-save-footer">
              <div className="sp-save-footer-text">Order Updated</div>
              <div className="sp-save-footer-actions">
                <button className="btn-save-draft" onClick={discardOrder}>
                  Discard
                </button>
                <button
                  className="btn-publish"
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
          position={confirming.kind === "approve" ? approvePosition(list, confirming.item) : null}
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

      {toast && (
        <CopiedToast key={toast.at} label={toast.label} onDone={clearToast} />
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
  /** Approve only: the Active position it goes live at. */
  position: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const name = item.headingEn;
  const copy: Record<ConfirmKind, { title: string; body: React.ReactNode; cta: string; danger?: boolean; sure?: React.ReactNode }> = {
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
      sure: <>“{name}” will be permanently deleted. This can't be undone.</>,
    },
  };
  const c = copy[kind];

  return (
    <PrmModal
      title={c.title}
      confirmLabel={c.cta}
      danger={c.danger}
      doubleConfirm={c.sure}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {/* Body copy is children, not `description` — the shell's own convention
          for a confirm (Figma 483:588). */}
      <p className="prm-content">{c.body}</p>
    </PrmModal>
  );
}

function SpotlightRow({
  spotlight,
  position,
  inQueue,
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
}: {
  spotlight: Spotlight;
  /** Active position — null for In-Review rows and rows out of the queue. */
  position: number | null;
  /** Active or In-Review: in the Home-Screen queue, so draggable. */
  inQueue: boolean;
  canReorder: boolean;
  isDragging: boolean;
  isOver: boolean;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
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
  // Only an In-Review row can still be decided — one past its end date has
  // Ended and lost Approve / Reject.
  const isPending = ds === "pending";
  // Out-of-queue rows can't be dragged, but still accept drops so queue rows
  // can be moved past them.
  const canDrag = canReorder && inQueue;

  return (
    <tr
      className={`sp-tr sp-tr--${s.status} ${isDragging ? "is-dragging" : ""} ${
        isOver ? "is-drop-target" : ""
      } ${menuOpen ? "menu-open" : ""}`}
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
        {inQueue && (
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
        <SpotlightThumb spotlight={s} />
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
      {/* Actions is only the Approve / Reject pair; the kebab is in its own
          unlabelled column after it (558:2046 shows them side by side). */}
      <td className="sp-td-actions">
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
      </td>
      <td className="sp-td-menu">
        <div className="sp-menu">
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
  // table's "Show Past Spotlights" row, and both offer Enable.
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
      className="u-menu"
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
              imageUrl={item.imageUrl}
            />
          </div>
        );
      }}
    </FullscreenViewer>
  );
}
