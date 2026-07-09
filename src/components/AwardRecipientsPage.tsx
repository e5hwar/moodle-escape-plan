import { useEffect, useMemo, useState } from "react";
import { users as allUsers, type User } from "../data/users";
import {
  certName,
  certForAward,
  appearanceSummary,
  fmtHolders,
  MERIT_HEX,
  type Award,
} from "../data/awards";
import { buildAwardRecipients, type AwardRecipient } from "../data/awardRecipients";
import { ChevronLeftIcon, SearchIcon, SortIcon } from "./icons";

const PAGE_SIZE = 50;

type SortKey = "name" | "email" | "uniqueNumber" | "issuedDate";
type SortDir = "asc" | "desc";

type Row = { u: User; r: AwardRecipient };

type ColMeta = {
  key: Exclude<SortKey, "name">;
  label: string;
  className: string;
  width: number;
  render: (row: Row) => React.ReactNode;
  sortValue: (row: Row) => string;
  sortable: boolean;
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const COLS: ColMeta[] = [
  {
    key: "email",
    label: "Email",
    className: "col-u-email",
    width: 220,
    render: ({ u }) => u.email,
    sortValue: ({ u }) => u.email.toLowerCase(),
    sortable: false,
  },
  {
    key: "uniqueNumber",
    label: "Unique Number",
    className: "col-id",
    width: 160,
    render: ({ r }) => <span className="ar-mono">{r.uniqueNumber}</span>,
    sortValue: ({ r }) => r.uniqueNumber,
    sortable: true,
  },
  {
    key: "issuedDate",
    label: "Issued On",
    className: "col-date",
    width: 150,
    render: ({ r }) => formatDate(r.issuedDate),
    sortValue: ({ r }) => r.issuedDate,
    sortable: true,
  },
];

const COL_BY_KEY = new Map(COLS.map((c) => [c.key, c]));

function compareRows(a: Row, b: Row, key: SortKey): number {
  if (key === "name") return a.u.name.localeCompare(b.u.name);
  const col = COL_BY_KEY.get(key)!;
  return col.sortValue(a).localeCompare(col.sortValue(b));
}

export function AwardRecipientsPage({
  award,
  onBack,
}: {
  award: Award;
  onBack: () => void;
}) {
  const cert = certForAward(award);
  const userById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), []);
  const recipients = useMemo(() => buildAwardRecipients(award), [award]);

  const rows = useMemo<Row[]>(
    () =>
      recipients
        .map((r) => {
          const u = userById.get(r.userId);
          return u ? { u, r } : null;
        })
        .filter((row): row is Row => row !== null),
    [recipients, userById],
  );

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "issuedDate", dir: "desc" });
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [query, sort]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      ({ u, r }) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        r.uniqueNumber.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const tableMin = 240 + COLS.reduce((s, c) => s + c.width, 0);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const details: { label: string; value: React.ReactNode }[] = [
    { label: "Award ID", value: award.id },
    {
      label: "Merit Tier",
      value: (
        <span className="aw-tier-pill" style={{ "--tier": MERIT_HEX[award.meritTier] } as React.CSSProperties}>
          <span className="aw-tier-pill-dot" />
          {award.meritTier}
        </span>
      ),
    },
    { label: "Appearances", value: appearanceSummary(award) },
    {
      label: "Status",
      value: <span className={`sk-status sk-status--${award.status.toLowerCase()}`}>{award.status}</span>,
    },
    { label: "Total Issued", value: fmtHolders(award.holders) },
    { label: "Created By", value: award.createdBy },
    { label: "Date Created", value: award.dateCreated },
  ];

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <button className="attempts-back" onClick={onBack}>
                <ChevronLeftIcon />
                Awards
              </button>
              <h1 className="tasks-title">Award Recipients</h1>
              <div className="tasks-subtitle">
                <span>{certName(award)}</span>
                {cert && (
                  <>
                    <span className="tasks-subtitle-dot" />
                    <span>{cert.industry}</span>
                  </>
                )}
                <span className="tasks-subtitle-dot" />
                <span>{fmtHolders(award.holders)} issued</span>
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              {/* ─── Award details ─── */}
              <div className="ar-details">
                {details.map((d) => (
                  <div className="ar-detail" key={d.label}>
                    <div className="ar-detail-label">{d.label}</div>
                    <div className="ar-detail-value">{d.value}</div>
                  </div>
                ))}
              </div>

              <div className="toolbar">
                <div className="search-wrap">
                  <span className="search-icon"><SearchIcon /></span>
                  <input
                    className="search-input"
                    placeholder="Search recipients by name, email, or unique number…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
                </div>
              </div>

              <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
                <table className="table table-head">
                  <ColGroup />
                  <thead>
                    <tr>
                      <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                      {COLS.map((c) => (
                        <SortableHeader
                          key={c.key}
                          col={c.key}
                          label={c.label}
                          className={c.className}
                          sort={sort}
                          toggle={toggleSort}
                          sortable={c.sortable}
                        />
                      ))}
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className="table table-body">
                    <ColGroup />
                    <tbody>
                      {paged.map((row) => (
                        <tr key={row.u.id}>
                          <td className="col-name">{row.u.name}</td>
                          {COLS.map((c) => (
                            <td key={c.key} className={c.className}>
                              {c.render(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {paged.length === 0 && (
                        <tr>
                          <td colSpan={COLS.length + 1} className="u-empty">
                            {query.trim()
                              ? `No recipients match "${query.trim()}".`
                              : "No recipients for this Award yet."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
    </div>
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: 240 }} />
      {COLS.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
    </colgroup>
  );
}

function SortableHeader({
  col, label, className, sort, toggle, sortable = true,
}: {
  col: SortKey;
  label: string;
  className?: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
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
    <th className={className} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
