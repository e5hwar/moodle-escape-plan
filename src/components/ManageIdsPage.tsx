import { useEffect, useMemo, useState } from "react";
import {
  idDocOf,
  idRecords as seedRecords,
  matchesIdQuery,
  type IdRecord,
  type IdStatus,
} from "../data/manageIds";
import { ChevronRightIcon, SmallXIcon, SortIcon } from "./icons";
import { ManageIdsSearch, STATUS_LABEL } from "./ManageIdsSearch";
import { ZoomableIdCard, type IdCardData } from "./IdCard";
import { UserDetailsHover } from "./UserDetailsHover";

/** Profiles open in their own tab, matching the Users table's `?profile=` pattern. */
function openInNewTab(query: string) {
  window.open(`${window.location.origin}${window.location.pathname}?${query}`, "_blank", "noopener");
}

const PAGE_SIZE = 50;

type SortKey = "name" | "email" | "phone" | "status" | "uploadedAt";
type SortDir = "asc" | "desc";

/** uploadedAt is a display string like "Nov 5th, 2025, 2:30 PM" — strip the
 *  ordinal suffix so Date.parse can read it. */
function parseUploadedAt(s: string): number {
  return Date.parse(s.replace(/(\d+)(st|nd|rd|th)/, "$1")) || 0;
}

/** The seed data's display format — "Nov 5th, 2025, 2:30 PM". */
function nowStamp(): string {
  const d = new Date();
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
      ? "nd"
      : day % 10 === 3 && day !== 13
      ? "rd"
      : "th";
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${month} ${day}${suffix}, ${d.getFullYear()}, ${time}`;
}

const SORT_FIELD: Record<Exclude<SortKey, "uploadedAt">, (r: IdRecord) => string> = {
  name: (r) => r.name,
  email: (r) => r.email,
  phone: (r) => r.phone,
  status: (r) => STATUS_LABEL[r.status],
};

function compareRows(a: IdRecord, b: IdRecord, key: SortKey): number {
  if (key === "uploadedAt") return parseUploadedAt(a.uploadedAt) - parseUploadedAt(b.uploadedAt);
  const field = SORT_FIELD[key];
  const va = field(a).toLowerCase();
  const vb = field(b).toLowerCase();
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
}

/** Maps a record onto the shared ID card's shape. The card's header band shows
 *  the issuing region beside the document, so the "US " prefix is dropped —
 *  same adaptation the Proctoring console makes. */
function idCardOf(record: IdRecord): IdCardData {
  const doc = idDocOf(record);
  return {
    name: record.name,
    idType: record.idType.replace(/^US\s+/i, ""),
    idNumber: doc.idNumber,
    dob: doc.dob,
    expires: doc.expires,
    region: doc.region,
    photoSeed: doc.photoSeed,
  };
}

const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
  </svg>
);

export function ManageIdsPage({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<IdRecord[]>(seedRecords);
  const [query, setQuery] = useState("");
  // Both filters are applied from inside the search bar — this page has no pills.
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "uploadedAt",
    dir: "desc",
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter.length > 0 && !statusFilter.includes(STATUS_LABEL[r.status])) return false;
      if (q && !matchesIdQuery(r, q)) return false;
      return true;
    });
  }, [records, query, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, statusFilter, sort]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const active = activeId ? records.find((r) => r.id === activeId) ?? null : null;

  /* Replacing an ID keeps the popup open on the (new) document and moves the
     record to whichever status the reviewer picked. The upload stamp follows
     the new file, so the popup's subtitle isn't left describing the old one. */
  function applyReplace(id: string, status: IdStatus) {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status, uploadedAt: nowStamp() } : r)),
    );
  }

  /* Approving from the popup decides the ID that is already on file, so unlike
     a replace it leaves the upload stamp alone. */
  function setStatus(id: string, status: IdStatus) {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks pr-page">
          <header className="tasks-header">
            {/* Breadcrumb over the title — the same .rvc-crumbs chrome the
                Proctoring and Hands-On consoles use. This page is reached from
                Proctoring Review's "View All IDs", so the trail names both, and
                the Proctoring Review crumb is the way back out. */}
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Home</span>
                <ChevronRightIcon />
                <span className="rvc-crumb">Operations</span>
                <ChevronRightIcon />
                <button
                  className="rvc-crumb"
                  onClick={onBack}
                  title="Back to Proctoring & ID Review"
                >
                  Proctoring Review
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">View All IDs</span>
              </nav>
              <h1 className="tasks-title">Manage IDs</h1>
            </div>
          </header>

          {/* Same shell as the Proctoring queue (.tasks-row > .tasks-content):
              it pins the pagination footer to the bottom of the page. */}
          <div className="tasks-row">
            <div className="tasks-content">
              {/* Search — the Proctoring combobox with this page's one scope
                  (ID Status) applied from inside the bar. There is no filter-pill
                  row: the bar's chips are the applied-filter UI. */}
              <div className="toolbar">
                <ManageIdsSearch
                  records={records}
                  statuses={statusFilter}
                  onStatusesChange={setStatusFilter}
                  query={query}
                  onCommit={setQuery}
                />
              </div>

              {/* Table — the shared .table system the Proctoring queue uses. A
                  row click opens the ID popup; there are no action buttons. */}
              <div
                className="table-xscroll"
                style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}
              >
                <table className="table table-head">
                  <MidColGroup />
                  <thead>
                    <tr>
                      <SortableHeader col="name" label="User's Name" className="col-name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="email" label="Email" className="pr-col-email" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="phone" label="Phone" className="pr-col-phone" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="status" label="Status" className="col-status" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="uploadedAt" label="Uploaded On" className="pr-col-date" sort={sort} toggle={toggleSort} />
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className="table table-body">
                    <MidColGroup />
                    <tbody>
                      {paged.map((r) => (
                        <tr key={r.id} onClick={() => setActiveId(r.id)}>
                          <td className="col-name">{r.name}</td>
                          <td className="pr-col-email">{r.email}</td>
                          <td className="pr-col-phone">{r.phone}</td>
                          <td className="col-status">
                            <StatusPill status={r.status} />
                          </td>
                          <td className="pr-col-date">{r.uploadedAt}</td>
                        </tr>
                      ))}
                      {paged.length === 0 && (
                        <tr>
                          <td colSpan={5} className="u-empty">
                            {query.trim()
                              ? `No users match "${query.trim()}".`
                              : "No users match these filters."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pagination">
                <span>
                  Showing {sorted.length === 0 ? 0 : start + 1}–
                  {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
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

      {active && (
        <IdModal
          record={active}
          onClose={() => setActiveId(null)}
          onReplace={(status) => applyReplace(active.id, status)}
          onApprove={() => setStatus(active.id, "approved")}
        />
      )}
    </div>
  );
}

/* Column widths mirror the Proctoring queue's table: every column gets an
   explicit width except Email, which is left auto and soaks up the leftover
   space (.table is fixed-layout). */
/* Status is sized for the "Reupload Requested" pill (133px) plus its sort
   caret; Uploaded On matches the Proctoring table's Submitted On column, so
   neither truncates. Both include the cell's 2×20px padding. The document type
   is no longer a column — it only shows on the ID itself, in the popup. */
const COL_WIDTHS = { name: 190, phone: 170, status: 175, date: 265 };
const EMAIL_MIN = 250;
const TABLE_MIN =
  COL_WIDTHS.name + EMAIL_MIN + COL_WIDTHS.phone + COL_WIDTHS.status + COL_WIDTHS.date;

function MidColGroup() {
  return (
    <colgroup>
      <col style={{ width: COL_WIDTHS.name }} />
      <col />
      <col style={{ width: COL_WIDTHS.phone }} />
      <col style={{ width: COL_WIDTHS.status }} />
      <col style={{ width: COL_WIDTHS.date }} />
    </colgroup>
  );
}

/* Figma "Table Pills" (109:1237) — the shared pill set the other tables use.
   `.col-status` on the cell is what re-enables their chrome past the table's
   strip-all-pills rule. */
const STATUS_TONE: Record<IdStatus, string> = {
  approved: "green",
  "in-review": "yellow",
  "reupload-requested": "grey",
};

function StatusPill({ status }: { status: IdStatus }) {
  return (
    <span className={`co-status-pill co-status-pill--${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function SortableHeader({
  col,
  label,
  className,
  sort,
  toggle,
}: {
  col: SortKey;
  label: string;
  className: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
  const activeCol = sort.key === col;
  return (
    <th className={className} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={activeCol} dir={activeCol ? sort.dir : undefined} />
      </span>
    </th>
  );
}

/* ── ID popup ──────────────────────────────────────────────────────────────
   One modal with two modes: the uploaded document (the old "View ID"), and the
   replace flow that used to be a second modal opened from its own row button.
   Replace is reached from the footer here, so a reviewer who opened the row to
   look at the ID can act on it without going back to the table. */
function IdModal({
  record,
  onClose,
  onReplace,
  onApprove,
}: {
  record: IdRecord;
  onClose: () => void;
  onReplace: (status: IdStatus) => void;
  onApprove: () => void;
}) {
  /* The upload dialog stacks ON TOP of this one — the ID stays on screen behind
     it, its ✕ drops back to the ID, and either upload action decides the record
     and closes both. */
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  /* The card's full-view overlay owns Escape while it's open — without this the
     same keypress would also close the modal underneath. */
  const [idFullView, setIdFullView] = useState(false);

  function closeUpload() {
    setUploadOpen(false);
    setFileName(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (idFullView) return;
      if (e.key !== "Escape") return;
      if (uploadOpen) closeUpload();
      else onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, uploadOpen, idFullView]);

  /* An upload decides the ID outright, so it takes the whole stack down with it. */
  function decide(status: IdStatus) {
    onReplace(status);
    setFileName(null);
    setUploadOpen(false);
    onClose();
  }

  return (
    <>
      <div className="pm-overlay" onClick={onClose}>
        <div
          className="pm-modal mid-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${record.name}'s ID`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Figma 460:1792 (Approved), 460:2445 (Review Pending), 460:2546
              (Reupload Requested) — one layout for all three: the name over an
              "ID Status: …" line, the document, and a footer whose Approve
              button is the only per-state difference. The document type and
              upload stamp are gone; both read off the ID itself. */}
          <div className="mid-head">
            <div className="mid-head-left">
              <h2 className="tasks-title mid-title">
                {/* Same hover card as the Proctoring report (Figma 436:572):
                    peek at the candidate's details without leaving the ID. */}
                <UserDetailsHover
                  user={{
                    userId: record.id,
                    userName: record.name,
                    email: record.email,
                    phone: record.phone,
                  }}
                  onOpenProfile={(id) => openInNewTab(`profile=${id}`)}
                >
                  <button
                    className="rvc-headlink"
                    onClick={() => openInNewTab(`profile=${record.id}`)}
                    title="Open this candidate's profile in a new tab"
                  >
                    {record.name}
                  </button>
                </UserDetailsHover>
              </h2>
              <div className="mid-head-sub">ID Status: {STATUS_LABEL[record.status]}</div>
            </div>
            <button className="mid-close" aria-label="Close" onClick={onClose}>
              <SmallXIcon />
            </button>
          </div>

          {/* The design shows the document alone — no full-view/rotate row under
              it and no hover magnifier (the card still opens full view on
              click). */}
          <div className="mid-body">
            <ZoomableIdCard
              data={idCardOf(record)}
              onFullViewChange={setIdFullView}
              hideTools
              noMagnify
            />
            {/* Plain caption, not a control — the card itself is the target. */}
            <div className="mid-body-cap">Click for the Full-Screen View</div>
          </div>
          <div className="mid-foot">
            <button className="btn-save-draft" onClick={() => setUploadOpen(true)}>
              Replace ID
            </button>
            {/* Only an ID that still needs a decision offers Approve. */}
            {record.status !== "approved" && (
              <button className="btn-primary" onClick={onApprove}>
                Approve
              </button>
            )}
          </div>
        </div>
      </div>

      {uploadOpen && (
        /* Figma 467:673 / 467:950 — a narrower dialog (its document is 420px
           where the ID view's is 640), layered over the ID rather than
           replacing it. The drop zone fills the body until a file is chosen,
           then the document itself takes its place. */
        <div className="pm-overlay mid-upload-overlay" onClick={closeUpload}>
          <div
            className="pm-modal mid-modal mid-modal--upload"
            role="dialog"
            aria-modal="true"
            aria-label={`Upload a new ID for ${record.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mid-head">
              <div className="mid-head-left">
                <h2 className="tasks-title mid-title">Upload ID</h2>
              </div>
              <button className="mid-close" aria-label="Close" onClick={closeUpload}>
                <SmallXIcon />
              </button>
            </div>

            <div className="mid-body mid-body--upload">
              {fileName ? (
                /* Stand-in for the file just chosen: the prototype has no real
                   upload, so the record's own document stands in for it. */
                <ZoomableIdCard
                  data={idCardOf(record)}
                  onFullViewChange={setIdFullView}
                  hideTools
                  noMagnify
                />
              ) : (
                <label className="mid-drop">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/heic,image/heif,image/webp"
                    className="mid-drop-input"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  />
                  <span className="mid-drop-icon">
                    <UploadIcon />
                  </span>
                  <span className="mid-drop-title">Drag and drop, or click to upload</span>
                  <span className="mid-drop-hint">
                    Accepted File Types: PNG, JPG, HEIC, HEIF, WebP
                    <br />
                    Maximum File Size: 100MB
                  </span>
                </label>
              )}
            </div>
            <div className="mid-foot">
              <button
                className="btn-save-draft"
                disabled={!fileName}
                onClick={() => decide("in-review")}
              >
                Upload Without Approval
              </button>
              <button
                className="btn-primary"
                disabled={!fileName}
                onClick={() => decide("approved")}
              >
                Upload &amp; Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
