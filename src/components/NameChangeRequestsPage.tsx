import { useEffect, useMemo, useState } from "react";
import {
  nameChangeRequests as seed,
  type NameChangeRequest,
} from "../data/nameChangeRequests";
import { ZoomableIdCard } from "./IdCard";
import { SearchIcon, SortIcon, CheckBoldIcon, SmallXIcon } from "./icons";

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

  const [viewId, setViewId] = useState<NameChangeRequest | null>(null);
  const [approving, setApproving] = useState<NameChangeRequest | null>(null);
  const [proofing, setProofing] = useState<NameChangeRequest | null>(null);
  const [rejecting, setRejecting] = useState<NameChangeRequest | null>(null);

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

  function resolve(id: string) {
    setList((prev) => prev.filter((r) => r.id !== id));
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
                <table className="table sch-table ncr-table">
                  <colgroup>
                    <col style={{ width: "auto" }} />
                    <col style={{ width: "auto" }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 320 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader col="currentName" label="Current Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="requestedName" label="Requested Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="submittedOn" label="Submitted On" sort={sort} toggle={toggleSort} />
                      <th>View ID</th>
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
                          <button className="ncr-view-id" onClick={() => setViewId(r)}>
                            <IdIcon />
                            View ID
                          </button>
                        </td>
                        <td>
                          <div className="ncr-actions">
                            <button className="ncr-btn ncr-btn--approve" onClick={() => setApproving(r)}>
                              Approve
                            </button>
                            <button className="ncr-btn ncr-btn--proof" onClick={() => setProofing(r)}>
                              Request Proof
                            </button>
                            <button className="ncr-btn ncr-btn--reject" onClick={() => setRejecting(r)}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={5} className="sch-empty">
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
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewId && <IdFullscreen request={viewId} onClose={() => setViewId(null)} />}

      {approving && (
        <ApproveModal
          request={approving}
          onClose={() => setApproving(null)}
          onConfirm={() => {
            resolve(approving.id);
            setApproving(null);
          }}
        />
      )}

      {proofing && (
        <RequestProofModal
          request={proofing}
          onClose={() => setProofing(null)}
          onConfirm={() => {
            resolve(proofing.id);
            setProofing(null);
          }}
        />
      )}

      {rejecting && (
        <RejectModal
          request={rejecting}
          onClose={() => setRejecting(null)}
          onConfirm={() => {
            resolve(rejecting.id);
            setRejecting(null);
          }}
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
}: {
  col: SortKey;
  label: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
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

/* ───────────────── View ID — fullscreen overlay ───────────────── */

function IdFullscreen({ request, onClose }: { request: NameChangeRequest; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ncr-fs-overlay" onClick={onClose}>
      <div className="ncr-fs-bar">
        <div className="ncr-fs-title">
          {request.idType} · {request.currentName}
        </div>
        <button className="ncr-fs-close" onClick={onClose} aria-label="Close">
          <SmallXIcon />
        </button>
      </div>
      <div className="ncr-fs-stage" onClick={(e) => e.stopPropagation()}>
        <ZoomableIdCard request={request} />
      </div>
      <div className="ncr-fs-hint">Press Esc or click outside to close</div>
    </div>
  );
}

/* ───────────────── Approve — split confirmation modal ───────────────── */

function ApproveModal({
  request,
  onClose,
  onConfirm,
}: {
  request: NameChangeRequest;
  onClose: () => void;
  onConfirm: (finalName: string) => void;
}) {
  const [requestedName, setRequestedName] = useState(request.requestedName);
  const valid = requestedName.trim().length > 1;

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal ncr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Approve Name Change</h3>
          <p className="cl-modal-sub">
            Verify the submitted ID, then confirm the name that will be saved to the user's account.
          </p>
        </div>

        <div className="ncr-modal-split">
          {/* Left — ID for reference (zoomable) */}
          <div className="ncr-id-pane">
            <div className="ncr-pane-label">Submitted ID</div>
            <ZoomableIdCard request={request} />
          </div>

          {/* Right — name fields */}
          <div className="ncr-form-pane">
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
          </div>
        </div>

        <div className="cl-modal-foot ncr-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-publish ncr-approve-btn"
            disabled={!valid}
            onClick={() => valid && onConfirm(requestedName.trim())}
          >
            <CheckBoldIcon />
            Approve &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Request Proof — compact modal ───────────────── */

function RequestProofModal({
  request,
  onClose,
  onConfirm,
}: {
  request: NameChangeRequest;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [message, setMessage] = useState(
    "We couldn't verify your request from the submitted ID. Please upload a clearer photo of a government-issued ID showing your name.",
  );
  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal ncr-small-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Request Additional Proof</h3>
          <p className="cl-modal-sub">
            Ask {request.currentName} for more documentation before deciding on this request.
          </p>
        </div>
        <div className="ncr-small-body">
          <label className="form-label">Message to user</label>
          <textarea
            className="rh-feedback"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="cl-modal-foot ncr-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-publish" onClick={onConfirm}>
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Reject — compact confirm modal ───────────────── */

function RejectModal({
  request,
  onClose,
  onConfirm,
}: {
  request: NameChangeRequest;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal ncr-small-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Reject Name Change</h3>
          <p className="cl-modal-sub">
            Reject the request to change “{request.currentName}” to “{request.requestedName}”.
          </p>
        </div>
        <div className="ncr-small-body">
          <label className="form-label">Reason (optional)</label>
          <textarea
            className="rh-feedback"
            rows={3}
            placeholder="Add an optional note explaining the rejection…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="cl-modal-foot ncr-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-publish ncr-reject-btn" onClick={onConfirm}>
            Reject Request
          </button>
        </div>
      </div>
    </div>
  );
}
