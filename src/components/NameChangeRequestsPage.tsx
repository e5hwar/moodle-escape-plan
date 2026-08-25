import { useEffect, useMemo, useState } from "react";
import {
  nameChangeRequests as seed,
  type NameChangeRequest,
} from "../data/nameChangeRequests";
import { users } from "../data/users";
import { ZoomableIdCard, idCardFromRequest } from "./IdCard";
import { SearchIcon, SortIcon, CheckBoldIcon, RowArrowIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const PAGE_SIZE = 25;

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
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedOn", dir: "desc" });
  const [page, setPage] = useState(1);

  const [reviewing, setReviewing] = useState<NameChangeRequest | null>(null);

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
            {/* This page is reached from the Proctoring Review header's Name
                Changes button (it no longer has its own sidebar entry), so the
                crumb is the way back. */}
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Operations</span>
                <ChevronRightIcon />
                <button className="rvc-crumb" onClick={onBack} title="Back to Exam Reviews">
                  Exam Reviews
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
                  placeholder="Search by name, email, or phone…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="search-kbd">
                  <span className="kbd-cmd">⌘</span>
                  <span className="kbd-letter">K</span>
                </span>
              </div>

              <div className="tasks-scroll">
                <table className="table sch-table ncr-table">
                  <colgroup>
                    <col style={{ width: 240 }} />
                    <col style={{ width: 240 }} />
                    {/* Email is the flexible column — it absorbs the leftover width
                        so the names stay narrow and addresses stop truncating. */}
                    <col />
                    <col style={{ width: 165 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 72 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader col="currentName" label="Current Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="requestedName" label="Requested Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="email" label="Email" sort={sort} toggle={toggleSort} sortable={false} />
                      <SortableHeader col="phone" label="Phone" sort={sort} toggle={toggleSort} sortable={false} />
                      <SortableHeader col="submittedOn" label="Submitted On" sort={sort} toggle={toggleSort} />
                      <th className="ncr-col-open no-sort" aria-label="Review" />
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
                        <td className="col-u-email">{c?.email ?? "—"}</td>
                        <td className="col-u-phone">{c?.phone ?? "—"}</td>
                        <td>{formatDate(r.submittedOn)}</td>
                        <td className="ncr-col-open">
                          <button
                            className="row-arrow"
                            aria-label={`Review name change for ${r.currentName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewing(r);
                            }}
                          >
                            <RowArrowIcon />
                          </button>
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

type ReviewMode = "main" | "proof" | "reject";

function ReviewModal({
  request,
  onClose,
  onResolved,
}: {
  request: NameChangeRequest;
  onClose: () => void;
  onResolved: (id: string) => void;
}) {
  const [mode, setMode] = useState<ReviewMode>("main");
  const [requestedName, setRequestedName] = useState(request.requestedName);
  const [proofMessage, setProofMessage] = useState(
    "We couldn't verify your request from the submitted ID. Please upload a clearer photo of a government-issued ID showing your name.",
  );
  const [reason, setReason] = useState("");
  const valid = requestedName.trim().length > 1;

  // Reset per-request state when the review target changes (e.g. after cycling to the next one).
  useEffect(() => {
    setMode("main");
    setRequestedName(request.requestedName);
    setProofMessage(
      "We couldn't verify your request from the submitted ID. Please upload a clearer photo of a government-issued ID showing your name.",
    );
    setReason("");
  }, [request.id, request.requestedName]);

  // The main step needs no subtext — the ID and the two name fields say it. The
  // follow-up steps keep theirs, since they name the person being actioned.
  const titles: Record<ReviewMode, { title: string; sub?: string }> = {
    main: {
      title: "Review Name Change",
    },
    proof: {
      title: "Request Additional Proof",
      sub: `Ask ${request.currentName} for more documentation before deciding on this request.`,
    },
    reject: {
      title: "Reject Name Change",
      sub: `Reject the request to change "${request.currentName}" to "${request.requestedName}".`,
    },
  };

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal ncr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">{titles[mode].title}</h3>
          {titles[mode].sub && <p className="cl-modal-sub">{titles[mode].sub}</p>}
        </div>

        <div className="ncr-modal-split">
          {/* Left — ID for reference (hover to magnify, click for full view) */}
          <div className="ncr-id-pane">
            <ZoomableIdCard data={idCardFromRequest(request)} />
          </div>

          {/* Right — mode-specific content */}
          <div className="ncr-form-pane">
            {mode === "main" && (
              <>
                <div className="form-group" style={{ marginBottom: 22, maxWidth: "none" }}>
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
              </>
            )}

            {mode === "proof" && (
              <div className="form-group" style={{ marginBottom: 0, maxWidth: "none" }}>
                <label className="form-label">Message to user</label>
                <textarea
                  autoFocus
                  className="rh-feedback"
                  rows={6}
                  value={proofMessage}
                  onChange={(e) => setProofMessage(e.target.value)}
                />
              </div>
            )}

            {mode === "reject" && (
              <div className="form-group" style={{ marginBottom: 0, maxWidth: "none" }}>
                <label className="form-label">Reason (optional)</label>
                <textarea
                  autoFocus
                  className="rh-feedback"
                  rows={6}
                  placeholder="Add an optional note explaining the rejection…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="cl-modal-foot ncr-modal-foot">
          {mode === "main" ? (
            <>
              <div className="ncr-modal-foot-left">
                <button className="btn-save-draft" onClick={onClose}>
                  Cancel
                </button>
              </div>
              {/* Right-to-left: Approve, Reject, Request ID Proof. */}
              <div className="ncr-modal-foot-right">
                <button className="ncr-btn ncr-btn--proof" onClick={() => setMode("proof")}>
                  Request ID Proof
                </button>
                <button className="ncr-btn ncr-btn--reject" onClick={() => setMode("reject")}>
                  Reject
                </button>
                <button
                  className="btn-publish ncr-approve-btn"
                  disabled={!valid}
                  onClick={() => valid && onResolved(request.id)}
                >
                  <CheckBoldIcon />
                  Approve &amp; Save
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="ncr-modal-foot-left">
                <button className="btn-save-draft" onClick={() => setMode("main")}>
                  Back
                </button>
              </div>
              <div className="ncr-modal-foot-right">
                <button
                  className={mode === "reject" ? "btn-publish ncr-reject-btn" : "btn-publish"}
                  onClick={() => onResolved(request.id)}
                >
                  {mode === "reject" ? "Reject Request" : "Send Request"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
