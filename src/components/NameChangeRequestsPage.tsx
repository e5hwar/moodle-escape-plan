import { useEffect, useMemo, useState } from "react";
import {
  nameChangeRequests as seed,
  type NameChangeRequest,
} from "../data/nameChangeRequests";
import { ZoomableIdCard } from "./IdCard";
import { SearchIcon, SortIcon, CheckBoldIcon } from "./icons";

const PAGE_SIZE = 25;

type SortKey = "currentName" | "requestedName" | "submittedOn";
type SortDir = "asc" | "desc";

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
    case "submittedOn":
      return new Date(a.submittedOn).getTime() - new Date(b.submittedOn).getTime();
  }
}

const IdIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M13 9h5M13 13h5M5.5 15.5a3 3 0 016 0" />
  </svg>
);

export function NameChangeRequestsPage() {
  const [list, setList] = useState<NameChangeRequest[]>(seed);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedOn", dir: "desc" });
  const [page, setPage] = useState(1);

  const [reviewing, setReviewing] = useState<NameChangeRequest | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.currentName.toLowerCase().includes(q) ||
        r.requestedName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
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
            <div>
              <h1 className="tasks-title">Name Change Requests</h1>
              <div className="tasks-subtitle">
                <span>{list.length} pending</span>
                <span className="tasks-subtitle-dot" />
                <span>Review the submitted ID before approving a legal name change</span>
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
                  placeholder="Search by current or requested name…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="search-kbd">
                  <span className="kbd-cmd">⌘</span>
                  <span className="kbd-letter">K</span>
                </span>
              </div>

              <div className="tasks-scroll">
                <table className="table sch-table ncr-table" style={{ width: 1020 }}>
                  <colgroup>
                    <col style={{ width: 260 }} />
                    <col style={{ width: 260 }} />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 320 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader col="currentName" label="Current Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="requestedName" label="Requested Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="submittedOn" label="Submitted On" sort={sort} toggle={toggleSort} />
                      <th className="ncr-actions-head">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r) => (
                      <tr key={r.id}>
                        <td className="ncr-current">{r.currentName}</td>
                        <td className="ncr-requested">{r.requestedName}</td>
                        <td>{formatDate(r.submittedOn)}</td>
                        <td>
                          <div className="ncr-actions">
                            <button className="ncr-btn ncr-btn--review" onClick={() => setReviewing(r)}>
                              <IdIcon />
                              Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={4} className="sch-empty">
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
                  Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
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

  const titles: Record<ReviewMode, { title: string; sub: string }> = {
    main: {
      title: "Review Name Change",
      sub: "Verify the submitted ID, then approve, request more proof, or reject this request.",
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
          <p className="cl-modal-sub">{titles[mode].sub}</p>
        </div>

        <div className="ncr-modal-split">
          {/* Left — ID for reference (zoomable) */}
          <div className="ncr-id-pane">
            <div className="ncr-pane-label">Submitted ID</div>
            <ZoomableIdCard request={request} />
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
              <button className="btn-save-draft" onClick={onClose}>
                Cancel
              </button>
              <button className="ncr-btn ncr-btn--reject" onClick={() => setMode("reject")}>
                Reject
              </button>
              <button className="ncr-btn ncr-btn--proof" onClick={() => setMode("proof")}>
                Request Proof
              </button>
              <button
                className="btn-publish ncr-approve-btn"
                disabled={!valid}
                onClick={() => valid && onResolved(request.id)}
              >
                <CheckBoldIcon />
                Approve &amp; Save
              </button>
            </>
          ) : (
            <>
              <button className="btn-save-draft" onClick={() => setMode("main")}>
                Back
              </button>
              <button
                className={mode === "reject" ? "btn-publish ncr-reject-btn" : "btn-publish"}
                onClick={() => onResolved(request.id)}
              >
                {mode === "reject" ? "Reject Request" : "Send Request"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
