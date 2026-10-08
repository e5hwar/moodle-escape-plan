import { useEffect, useMemo, useState } from "react";
import {
  SEEDED_ID_USERS,
  approveIdRecord,
  idRecordForUser,
  matchesIdQuery,
  replaceIdRecord,
  useIdDecisions,
  type IdRecord,
  type IdStatus,
} from "../data/manageIds";
import { useUsers } from "../data/users";
import { SortIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { ManageIdsSearch, STATUS_LABEL } from "./ManageIdsSearch";
import { IdModal } from "./IdModal";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";

const PAGE_SIZE = 50;

type SortKey = "name" | "email" | "phone" | "status" | "uploadedAt";
type SortDir = "asc" | "desc";

/** uploadedAt is a display string like "Nov 5th, 2025, 2:30 PM" — strip the
 *  ordinal suffix so Date.parse can read it. */
function parseUploadedAt(s: string): number {
  return Date.parse(s.replace(/(\d+)(st|nd|rd|th)/, "$1")) || 0;
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

export function ManageIdsPage({ onBack }: { onBack: () => void }) {
  /* The review queue's documents, with each person read off the live roster
     and every decision from the shared ID store (manageIds.ts). */
  const roster = useUsers();
  const decisions = useIdDecisions();
  const records = useMemo<IdRecord[]>(
    () =>
      SEEDED_ID_USERS.flatMap((id) => {
        const u = roster.find((x) => x.id === id);
        return u ? [idRecordForUser(u, decisions)] : [];
      }),
    [roster, decisions],
  );
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

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks pr-page">
          {/* Breadcrumb strip above the header — the same .rvc-crumbs chrome the
              Proctoring and Hands-On consoles use. This page is reached from
              Exam Reviews' "View All IDs", so the trail names both, and
              the Exam Reviews crumb is the way back out. */}
          <nav className="rvc-crumbs" aria-label="Breadcrumb">
            <button
              className="rvc-crumb"
              onClick={onBack}
              title="Back to Exam Reviews"
            >
              Exam Reviews
            </button>
          </nav>
          <header className="tasks-header">
            <div className="rvc-pagehead">
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

      {active && (
        <IdModal
          record={active}
          onClose={() => setActiveId(null)}
          onReplace={(status) => replaceIdRecord(active, status)}
          onApprove={() => approveIdRecord(active)}
        />
      )}
    </div>
  );
}

/* Column widths mirror the Proctoring queue's table: content-sized base
   widths, slack shared in proportion (see MidColGroup). */
/* Status is sized for the "Reupload Requested" pill (133px) plus its sort
   caret; Uploaded On matches the Proctoring table's Submitted On column, so
   neither truncates. Both include the cell's 2×20px padding. The document type
   is no longer a column — it only shows on the ID itself, in the popup. */
const COL_WIDTHS = { name: 190, phone: 170, status: 175, date: 265 };
const EMAIL_MIN = 250;
const TABLE_MIN =
  COL_WIDTHS.name + EMAIL_MIN + COL_WIDTHS.phone + COL_WIDTHS.status + COL_WIDTHS.date;

/* The shared width rule (`TableCols`): every column keeps its base width and
   shares the slack in proportion — no column soaks it all up. */
function MidColGroup() {
  return (
    <TableCols
      data={[COL_WIDTHS.name, EMAIL_MIN, COL_WIDTHS.phone, COL_WIDTHS.status, COL_WIDTHS.date]}
    />
  );
}

/* Figma "Table Pills" (109:1237) — the shared pill set the other tables use.
   `.col-status` on the cell is what re-enables their chrome past the table's
   strip-all-pills rule. */
const STATUS_TONE: Record<IdStatus, string> = {
  approved: "green",
  "in-review": "yellow",
  "reupload-requested": "grey",
  "not-started": "grey",
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
