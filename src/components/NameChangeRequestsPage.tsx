import { useEffect, useMemo, useState } from "react";
import {
  nameChangeRequests as seed,
  type NameChangeRequest,
} from "../data/nameChangeRequests";
import { users } from "../data/users";
import { ZoomableIdCard, idCardFromRequest } from "./IdCard";
import { PrmModal } from "./PrmModal";
import { SearchIcon, SortIcon, RowChevronIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { SearchTrailing } from "./SearchPanelParts";

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

/** Contact details live on the user record — requests carry only the userId. */
type Contact = { email: string; phone: string };

const CONTACTS = new Map<string, Contact>(
  users.map((u) => [u.id, { email: u.email, phone: u.phone }]),
);

function contactOf(r: NameChangeRequest): Contact | undefined {
  return CONTACTS.get(r.userId);
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function compare(a: NameChangeRequest, b: NameChangeRequest, key: SortKey): number {
  switch (key) {
    case "currentName":
      return a.currentName.localeCompare(b.currentName);
    case "requestedName":
      return a.requestedName.localeCompare(b.requestedName);
    case "email":
      return (contactOf(a)?.email ?? "").localeCompare(contactOf(b)?.email ?? "");
    case "phone":
      return (contactOf(a)?.phone ?? "").localeCompare(contactOf(b)?.phone ?? "");
    case "submittedOn":
      return new Date(a.submittedOn).getTime() - new Date(b.submittedOn).getTime();
  }
}

export function NameChangeRequestsPage({ onBack }: { onBack?: () => void }) {
  const [list, setList] = useState<NameChangeRequest[]>(seed);
  const [query, setQuery] = useState("");
  /* Oldest first: the queue is worked in the order it was submitted, so the
     longest-waiting request is the one on top (and the one that opens). */
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedOn", dir: "asc" });
  const [page, setPage] = useState(1);

  /* The page is reached by clicking the pending-count banner / header note, so
     the reader has already said "review these" — the first request in the
     default order (newest first) opens straight away, saving the extra click. */
  const [reviewing, setReviewing] = useState<NameChangeRequest | null>(
    () => [...seed].sort((a, b) => compare(a, b, "submittedOn"))[0] ?? null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const c = contactOf(r);
      return (
        r.currentName.toLowerCase().includes(q) ||
        r.requestedName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (c?.email.toLowerCase().includes(q) ?? false) ||
        (c?.phone.toLowerCase().includes(q) ?? false)
      );
    });
  }, [list, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, sort]);
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
    const next = sorted[sorted.findIndex((r) => r.id === id) + 1];
    setReviewing(next ?? null);
  }

  /** Removes the resolved request and immediately advances review to the next one in view order. */
  function advanceReview(id: string) {
    const currentIndex = sorted.findIndex((r) => r.id === id);
    const remaining = sorted.filter((r) => r.id !== id);
    setList((prev) => prev.filter((r) => r.id !== id));
    setReviewing(remaining[currentIndex] ?? remaining[0] ?? null);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks sch-page">
          <header className="tasks-header">
            {/* This page is reached from the Manage Users header's Name Changes
                button (it has no sidebar entry of its own), so the crumb is the
                way back. */}
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Operations</span>
                <ChevronRightIcon />
                <button className="rvc-crumb" onClick={onBack} title="Back to Manage Users">
                  Manage Users
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Name Changes</span>
              </nav>
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

              <div
                className="table-xscroll"
                style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}
              >
              <div className="tasks-scroll">
                <table className="table sch-table sch-table--tight ncr-table">
                  <colgroup>
                    <col style={{ width: COL_WIDTHS.name }} />
                    <col style={{ width: COL_WIDTHS.name }} />
                    <col style={{ width: COL_WIDTHS.email }} />
                    <col style={{ width: COL_WIDTHS.phone }} />
                    <col style={{ width: COL_WIDTHS.date }} />
                    <col style={{ width: ACTIONS_WIDTH }} />
                  </colgroup>
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
                    {paged.map((r) => {
                      const c = contactOf(r);
                      return (
                      <tr key={r.id} onClick={() => setReviewing(r)}>
                        <td className="col-name" data-tip={r.currentName}>
                          {r.currentName}
                        </td>
                        <td className="col-name" data-tip={r.requestedName}>
                          {r.requestedName}
                        </td>
                        <td className="col-u-email">{c?.email ?? ""}</td>
                        <td className="col-u-phone">{c?.phone ?? ""}</td>
                        <td>{formatDate(r.submittedOn)}</td>
                        {/* Same row-end affordance as the Hands-On and Pending
                            ID Re-Upload tables: a resting chevron that hides on
                            row hover, replaced in place by the labelled bar. */}
                        <td className="col-actions">
                          <button
                            className="row-action-btn lone-dots row-chevron"
                            aria-label={`View name change request from ${r.currentName}`}
                            onClick={(e) => { e.stopPropagation(); setReviewing(r); }}
                          >
                            <RowChevronIcon />
                          </button>
                          <div className="row-action-bar">
                            <button
                              className="row-action-btn row-action-btn--label"
                              onClick={(e) => { e.stopPropagation(); setReviewing(r); }}
                            >
                              View Request
                              <RowChevronIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={6} className="sch-empty">
                          {query.trim()
                            ? `No requests match "${query.trim()}".`
                            : "No pending name change requests."}
                        </td>
                      </tr>
                    )}
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
        </div>
      </div>

      {reviewing && (
        <ReviewModal
          request={reviewing}
          onClose={() => setReviewing(null)}
          onSkip={(id) => skipReview(id)}
          onResolved={(id) => advanceReview(id)}
        />
      )}
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
function ReviewModal({
  request,
  onClose,
  onSkip,
  onResolved,
}: {
  request: NameChangeRequest;
  onClose: () => void;
  onSkip: (id: string) => void;
  onResolved: (id: string) => void;
}) {
  const [mode, setMode] = useState<ReviewMode>("main");
  const [requestedName, setRequestedName] = useState(request.requestedName);
  const valid = requestedName.trim().length > 1;

  // Reset per-request state when the review target changes (e.g. after cycling to the next one).
  useEffect(() => {
    setMode("main");
    setRequestedName(request.requestedName);
  }, [request.id, request.requestedName]);

  /* The footer's keycaps (Figma 445:878) are real: I / R / A drive the three
     decisions while the main step is up and focus isn't in a field. */
  useEffect(() => {
    if (mode !== "main") return;
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
  }, [mode, valid]);

  /* Each decision lands on a plain confirm stacked OVER the review — no reason
     to type, just the sentence and the button, with the ID still behind it.
     Back (and the close glyph) returns to the review; confirming resolves. */
  const confirm =
    mode === "main"
      ? null
      : {
          approve: {
            title: "Approve Name Change",
            description: `"${request.currentName}" will be changed to "${requestedName.trim()}" on their account.`,
            cta: "Approve & Save",
          },
          proof: {
            title: "Request Additional Proof",
            description: `${request.currentName} will be asked for more documentation, and the request stays pending until they send it.`,
            cta: "Send Request",
          },
          reject: {
            title: "Reject Name Change",
            description: `The request to change "${request.currentName}" to "${request.requestedName}" will be rejected, and they'll keep their current name.`,
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
            <ZoomableIdCard data={idCardFromRequest(request)} hideTools caption />
          </div>

          <div className="ncr-fields">
            <div className="form-group" style={{ marginBottom: 0, maxWidth: "none" }}>
              <label className="form-label">Current name</label>
              <input className="form-input ncr-readonly" value={request.currentName} readOnly tabIndex={-1} />
              <p className="form-help">The name currently on the account. This can't be edited.</p>
            </div>

            <div className="form-group" style={{ marginBottom: 0, maxWidth: "none" }}>
              <label className="form-label">
                Requested name <span className="req">*</span>
              </label>
              <input
                autoFocus
                className="form-input"
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
          description={confirm.description}
          cancelLabel="Back"
          onCancel={() => setMode("main")}
          confirmLabel={confirm.cta}
          danger={mode === "reject"}
          go={mode === "approve"}
          onConfirm={() => onResolved(request.id)}
        />
      )}
    </>
  );

}
