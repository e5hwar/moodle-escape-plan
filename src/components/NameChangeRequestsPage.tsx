import { useEffect, useMemo, useState } from "react";
import { LockedField } from "./CriteriaLock";
import {
  isOpen,
  setNameChangeStatus,
  useNameChangeRequests,
  type NameChangeRequest,
} from "../data/nameChangeRequests";
import { matchesUserQuery, renameUser, useUsers, type User } from "../data/users";
import { hasIdDocument, idRecordForUser, idTimelineOf, useIdDecisions } from "../data/manageIds";
import { ZoomableIdCard } from "./IdCard";
import { idCardOf } from "./IdModal";
import { STATUS_LABEL as ID_STATUS_LABEL } from "./ManageIdsSearch";
import { IdDetailsHover } from "./UserDetailsHover";
import { NoteCard } from "./NoteCard";
import { leave, useTouchedKeys } from "./fieldFlags";
import { PrmModal } from "./PrmModal";
import { LimitError } from "./CharCount";
import { LimitedInput } from "./LimitedInput";
import { NAME_MAX, isOver } from "../data/fieldLimits";
import { SearchIcon, SortIcon, RowChevronIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { SearchTrailing } from "./SearchPanelParts";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { FILTER_TIPS } from "../data/filterTips";
import { TableCols } from "./TableCols";
import { useToast } from "./useToast";
import { TableEmpty } from "./TableEmpty";

const PAGE_SIZE = 25;

/* Every column carries a width, so a wide viewport hands the slack to all of
   them in proportion instead of dumping it on Email — the same fixed-layout
   arithmetic the other list tables run on. Their sum is the table's floor:
   below it the page scrolls horizontally rather than crushing the addresses. */
const COL_WIDTHS = { name: 220, email: 280, phone: 160, date: 150 };
/** The row-end chevron column, the same 40px reserve every other table uses. */
const ACTIONS_WIDTH = 40;
const TABLE_MIN =
  COL_WIDTHS.name * 2 +
  COL_WIDTHS.email +
  COL_WIDTHS.phone +
  COL_WIDTHS.date +
  ACTIONS_WIDTH;

type SortKey = "currentName" | "requestedName" | "email" | "phone" | "submittedOn";
type SortDir = "asc" | "desc";

/** The Status filter's options — the two states an open request can be in. */
const STATUS_OPTIONS = ["Pending Review", "Awaiting ID Proof"];
const statusLabel = (r: NameChangeRequest) => (r.status === "awaiting-proof" ? "Awaiting ID Proof" : "Pending Review");

/** The admin every decision is recorded against (the request's history). */
const REVIEWER = "You";

/** A request with its user — name, email and phone read off the live roster,
 *  never copied onto the request. */
type Row = { r: NameChangeRequest; u: User | undefined };
const nameOf = (row: Row) => row.u?.name ?? "";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function compare(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case "currentName":
      return nameOf(a).localeCompare(nameOf(b));
    case "requestedName":
      return a.r.requestedName.localeCompare(b.r.requestedName);
    case "email":
      return (a.u?.email ?? "").localeCompare(b.u?.email ?? "");
    case "phone":
      return (a.u?.phone ?? "").localeCompare(b.u?.phone ?? "");
    case "submittedOn":
      return new Date(a.r.submittedOn).getTime() - new Date(b.r.submittedOn).getTime();
  }
}

export function NameChangeRequestsPage({ onBack }: { onBack?: () => void }) {
  /* The queue is the open requests of the shared store (nameChangeRequests.ts):
     a decided one leaves it for good, here and in the Users banner and badge. */
  const all = useNameChangeRequests();
  const roster = useUsers();
  const list = useMemo<Row[]>(
    () => all.filter(isOpen).map((r) => ({ r, u: roster.find((u) => u.id === r.userId) })),
    [all, roster],
  );
  const [query, setQuery] = useState("");
  /* Opens on the requests waiting on a reviewer — the queue's work. Clearing
     the pill shows the ones waiting on the user's ID proof too. */
  const [statusFilter, setStatusFilter] = useState<string[]>(["Pending Review"]);
  /* Oldest first: the queue is worked in the order it was submitted, so the
     longest-waiting request is the one on top (and the one that opens). */
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedOn", dir: "asc" });
  const [page, setPage] = useState(1);

  /* The page is reached by clicking the pending-count banner / header note, so
     the reader has already said "review these" — the oldest request waiting on
     a reviewer opens straight away, saving the extra click. */
  const [reviewingId, setReviewingId] = useState<string | null>(
    () =>
      [...list]
        .filter((x) => x.r.status === "pending")
        .sort((a, b) => compare(a, b, "submittedOn"))[0]?.r.id ?? null,
  );
  const reviewing = list.find((x) => x.r.id === reviewingId) ?? null;
  const setReviewing = (row: Row | null) => setReviewingId(row?.r.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (x) =>
        (statusFilter.length === 0 || statusFilter.includes(statusLabel(x.r))) &&
        (!q ||
          matchesUserQuery(q, { name: nameOf(x), email: x.u?.email, phone: x.u?.phone }) ||
          x.r.requestedName.toLowerCase().includes(q) ||
          x.r.id.toLowerCase().includes(q)),
    );
  }, [list, query, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, statusFilter, sort]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  /** Leaves the request pending and moves to the next one in view order — the
      footer's "Skip". Closes when it was the last. */
  function skipReview(id: string) {
    const next = sorted[sorted.findIndex((x) => x.r.id === id) + 1];
    setReviewing(next ?? null);
  }

  /** The request just decided leaves the queue; review moves on to the next
      one in view order. */
  function advanceReview(id: string) {
    const currentIndex = sorted.findIndex((x) => x.r.id === id);
    const remaining = sorted.filter((x) => x.r.id !== id);
    setReviewing(remaining[currentIndex] ?? remaining[0] ?? null);
  }

  const [toast, toastNode] = useToast();

  /** One confirmed decision from the review, written to the shared store with
      its history. Approve also renames the user on the roster (with the
      reviewer's correction, if any) — every page that names them follows.
      Request ID Proof keeps the request open, awaiting the user's proof, and
      moves on like Skip. */
  function resolveReview(row: Row, decision: ReviewDecision, name: string) {
    const { r } = row;
    if (decision === "proof") {
      setNameChangeStatus(r.id, "awaiting-proof", REVIEWER);
      skipReview(r.id);
      toast("ID Proof Requested");
      return;
    }
    if (decision === "approve") {
      const approved = name.trim();
      setNameChangeStatus(r.id, "approved", REVIEWER, { from: nameOf(row), to: approved });
      renameUser(r.userId, approved);
    } else {
      setNameChangeStatus(r.id, "rejected", REVIEWER);
    }
    advanceReview(r.id);
    toast(decision === "approve" ? "Name Change Approved" : "Name Change Rejected");
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks sch-page">
          {/* This page is reached from the Manage Users header's Name Changes
              button (it has no sidebar entry of its own), so the crumb is the
              way back. */}
          <nav className="rvc-crumbs" aria-label="Breadcrumb">
            <button className="rvc-crumb" onClick={onBack} title="Back to Users">
              Users
            </button>
          </nav>
          <header className="tasks-header">
            <div className="rvc-pagehead">
              <h1 className="tasks-title">Name Change Requests</h1>
              <div className="tasks-subtitle">
                <span>
                  Requested submitted by users whose IDs have been reviewed previously and cannot
                  change their name on their own. Option available on Profile Page.
                </span>
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="search-wrap">
                <span className="search-icon">
                  <SearchIcon />
                </span>
                <input
                  className="search-input"
                  placeholder="Search by Name, Email, or Phone..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <SearchTrailing active={!!query} onClear={() => setQuery("")} />
              </div>

              {/* The shared filter pill — an open request is either waiting on a
                  reviewer or on the user's ID proof. */}
              <div className="filters">
                <Dropdown
                  width={220}
                  trigger={({ open, toggle }) => (
                    <PillTrigger
                      label="Status"
                      tip={FILTER_TIPS.nameChanges.status}
                      value={summarize(statusFilter, STATUS_OPTIONS)}
                      open={open}
                      toggle={toggle}
                      onClear={() => setStatusFilter([])}
                    />
                  )}
                >
                  {({ close }) => (
                    <SectionedMultiSelect
                      sections={[{ items: STATUS_OPTIONS }]}
                      value={statusFilter}
                      onApply={(v) => {
                        setStatusFilter(v);
                        close();
                      }}
                    />
                  )}
                </Dropdown>
              </div>

              <div
                className="table-xscroll"
                style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}
              >
              <div className="tasks-scroll">
                <table className="table sch-table ncr-table">
                  <TableCols
                    data={[COL_WIDTHS.name, COL_WIDTHS.name, COL_WIDTHS.email, COL_WIDTHS.phone, COL_WIDTHS.date]}
                    trail={[ACTIONS_WIDTH]}
                  />
                  <thead>
                    <tr>
                      <SortableHeader col="currentName" label="Current Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="requestedName" label="Requested Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="email" label="Email" sort={sort} toggle={toggleSort} sortable={false} />
                      <SortableHeader col="phone" label="Phone" sort={sort} toggle={toggleSort} sortable={false} />
                      <SortableHeader col="submittedOn" label="Submitted On" sort={sort} toggle={toggleSort} />
                      <th className="col-actions no-sort" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((row) => {
                      const { r, u } = row;
                      return (
                      <tr key={r.id} onClick={() => setReviewing(row)}>
                        <td className="col-name" data-tip={nameOf(row)}>
                          {nameOf(row)}
                        </td>
                        <td
                          className={`col-name${r.status === "awaiting-proof" ? " has-flag" : ""}`}
                          data-tip={r.requestedName}
                        >
                          <span className="tsk-name">{r.requestedName}</span>
                          {/* Waiting on the user, not a reviewer — until they
                              upload a new ID, which sends it back to pending. */}
                          {r.status === "awaiting-proof" && (
                            <span className="pr-name-flag pr-name-flag--grey">Awaiting ID Proof</span>
                          )}
                        </td>
                        <td className="col-u-email">{u?.email ?? ""}</td>
                        <td className="col-u-phone">{u?.phone ?? ""}</td>
                        <td>{formatDate(r.submittedOn)}</td>
                        {/* Same row-end affordance as the Hands-On and Pending
                            ID Re-Upload tables: a resting chevron that hides on
                            row hover, replaced in place by the labelled bar. */}
                        <td className="col-actions">
                          <button
                            className="row-action-btn lone-dots row-chevron"
                            aria-label={`View name change request from ${nameOf(row)}`}
                            onClick={(e) => { e.stopPropagation(); setReviewing(row); }}
                          >
                            <RowChevronIcon />
                          </button>
                          <div className="row-action-bar">
                            <button
                              className="row-action-btn row-action-btn--label"
                              onClick={(e) => { e.stopPropagation(); setReviewing(row); }}
                            >
                              View Request
                              <RowChevronIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
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
        </div>
      </div>

      {reviewing && (
        <ReviewModal
          row={reviewing}
          onClose={() => setReviewing(null)}
          onSkip={(id) => skipReview(id)}
          onResolved={(decision, name) => resolveReview(reviewing, decision, name)}
        />
      )}
      {toastNode}
    </div>
  );
}

function SortableHeader({
  col,
  label,
  sort,
  toggle,
  sortable = true,
  className,
}: {
  col: SortKey;
  label: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
  className?: string;
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
    <th onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}

/* ───────────────── Review — single popup housing all actions ───────────────── */

type ReviewMode = "main" | "approve" | "proof" | "reject";
type ReviewDecision = Exclude<ReviewMode, "main">;
function ReviewModal({
  row,
  onClose,
  onSkip,
  onResolved,
}: {
  row: Row;
  onClose: () => void;
  onSkip: (id: string) => void;
  /** The confirmed decision, with the Requested Name as edited in the review. */
  onResolved: (decision: ReviewDecision, requestedName: string) => void;
}) {
  const request = row.r;
  const currentName = nameOf(row);
  /* The ID it is checked against is the one on file for this user — the
     banner on Users says as much — not a document of the request's own. */
  const decisions = useIdDecisions();
  const idRecord = row.u ? idRecordForUser(row.u, decisions) : null;
  /* The full-screen viewer owns the keyboard while it is up: there R rotates,
     and I / R / A must not decide the request underneath. */
  const [idFullView, setIdFullView] = useState(false);
  const [mode, setMode] = useState<ReviewMode>("main");
  const [requestedName, setRequestedName] = useState(request.requestedName);
  const valid = requestedName.trim().length > 1 && !isOver(NAME_MAX, requestedName);
  // Says so once the field has been clicked into and out of empty (fieldFlags.tsx).
  const { touched, touch, reset: resetTouched } = useTouchedKeys();
  const nameMissing = requestedName.trim().length === 0 && touched.has("name");

  // Reset per-request state when the review target changes (e.g. after cycling to the next one).
  useEffect(() => {
    setMode("main");
    resetTouched();
    setRequestedName(request.requestedName);
  }, [request.id, request.requestedName]);

  /* The footer's keycaps (Figma 445:878) are real: I / R / A drive the three
     decisions while the main step is up and focus isn't in a field. */
  useEffect(() => {
    if (mode !== "main" || idFullView) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === "i") setMode("proof");
      else if (k === "r") setMode("reject");
      else if (k === "a" && valid) setMode("approve");
      else return;
      e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, valid, idFullView]);

  /* Each decision lands on a plain confirm stacked OVER the review — no reason
     to type, just the sentence and the button, with the ID still behind it.
     Back (and the close glyph) returns to the review; confirming resolves. */
  const confirm =
    mode === "main"
      ? null
      : {
          approve: {
            title: "Approve Name Change",
            description: `"${currentName}" will be changed to "${requestedName.trim()}" on their account.`,
            cta: "Approve & Save",
          },
          proof: {
            title: "Request Additional Proof",
            description: `${currentName} will be asked to upload their ID again. The request is marked Awaiting ID Proof until they do, then returns to review.`,
            cta: "Send Request",
          },
          reject: {
            title: "Reject Name Change",
            description: `The request to change "${currentName}" to "${request.requestedName}" will be rejected, and they'll keep their current name.`,
            cta: "Reject Request",
          },
        }[mode];

  // The review step needs no description — the ID and the two name fields say it.
  return (
    <>
      <PrmModal
        wide
        className="ncr-modal"
        title="Review Name Change"
        /* Whether the ID being compared against has itself been approved —
           hover for when it was uploaded and decided (Figma 679:2039). */
        description={
          idRecord ? (
            <>
              ID Status:{" "}
              <IdDetailsHover timeline={idTimelineOf(idRecord)}>
                <span className="mid-head-status">{ID_STATUS_LABEL[idRecord.status]}</span>
              </IdDetailsHover>
            </>
          ) : undefined
        }
        cancelLabel="Skip"
        onCancelButton={() => onSkip(request.id)}
        onCancel={onClose}
        confirmLabel={
          <>
            Approve &amp; Save
            <span className="cta-kbd">A</span>
          </>
        }
        confirmDisabled={!valid}
        go
        onConfirm={() => valid && setMode("approve")}
        footerExtra={
          <>
            <button className="prm-quiet" onClick={() => setMode("proof")}>
              Request ID Proof
              <span className="cta-kbd">I</span>
            </button>
            <button className="prm-cta prm-cta--danger" onClick={() => setMode("reject")}>
              Reject
              <span className="cta-kbd">R</span>
            </button>
          </>
        }
      >
        <div className="ncr-split">
          {/* Left — the document alone (Figma 460:2445, the same treatment as
              the Manage IDs popup): no tools row, just the card and its
              caption. Hovering still magnifies into the panel beside it, and
              clicking opens the shared full-screen viewer, where Rotate lives. */}
          <div className="ncr-id-pane">
            {idRecord && hasIdDocument(idRecord) ? (
              <ZoomableIdCard
                data={idCardOf(idRecord)}
                onFullViewChange={setIdFullView}
                hideTools
                caption
              />
            ) : (
              <NoteCard title="No ID on file" body="There is no reviewed document to compare this request against." />
            )}
          </div>

          <div className="ncr-fields">
            <div className="form-group" style={{ marginBottom: 0, maxWidth: "none" }}>
              <label className="form-label">Current Name</label>
              {/* The shared Locked Field (Figma 1360:1883): the banner says
                  why, the control under it is disabled. */}
              <LockedField locked sub="The name currently on the account. This can't be edited.">
                <input className="form-input" value={currentName} readOnly aria-label="Current Name" />
              </LockedField>
            </div>

            <div className="form-group" onBlur={leave(() => touch("name"))} style={{ marginBottom: 0, maxWidth: "none" }}>
              <label className="form-label">
                Requested Name<span className="req">*</span>
                {nameMissing && <span className="form-label-error">Requested Name cannot be left empty</span>}
                <LimitError max={NAME_MAX} values={[requestedName]} />
              </label>
              <LimitedInput
                max={NAME_MAX}
                autoFocus
                className={`form-input${nameMissing ? " has-error" : ""}`}
                aria-invalid={nameMissing || undefined}
                value={requestedName}
                onChange={(e) => setRequestedName(e.target.value)}
              />
              <p className="form-help">Edit if the ID spelling differs from the request before approving.</p>
            </div>
          </div>
        </div>
      </PrmModal>

      {confirm && (
        <PrmModal
          title={confirm.title}
          cancelLabel="Back"
          onCancel={() => setMode("main")}
          confirmLabel={confirm.cta}
          danger={mode === "reject"}
          onConfirm={() => mode !== "main" && onResolved(mode, requestedName)}
        >
          {/* Pop-up content (Figma 667:884), not a grey subtitle under the title. */}
          <p className="prm-content">{confirm.description}</p>
        </PrmModal>
      )}
    </>
  );

}
