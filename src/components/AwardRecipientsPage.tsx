import { useEffect, useMemo, useState } from "react";
import { users as allUsers, type User } from "../data/users";
import { buildUserProfile } from "../data/userProfile";
import {
  certName,
  certForAward,
  appearanceSummary,
  fmtHolders,
  MERIT_HEX,
  type Award,
} from "../data/awards";
import { buildAwardRecipients, type AwardRecipient } from "../data/awardRecipients";
import { UsersFilters, type UserFilterState } from "./UsersFilters";
import { UsersSearch } from "./UsersSearch";
import { ChevronLeftIcon, SortIcon, AddIcon, ChevronRightIcon } from "./icons";

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

const EMPTY_FILTERS: UserFilterState = {
  types: [],
  subscriptions: [],
  companies: [],
  roles: [],
  goals: [],
  industries: [],
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
const DOWNLOAD_COL_WIDTH = 190;

function compareRows(a: Row, b: Row, key: SortKey): number {
  if (key === "name") return a.u.name.localeCompare(b.u.name);
  const col = COL_BY_KEY.get(key)!;
  return col.sortValue(a).localeCompare(col.sortValue(b));
}

/* ── Download helpers ── */
function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!),
  );
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function awardCardSvg(userName: string, award: Award, r: AwardRecipient): string {
  const tier = MERIT_HEX[award.meritTier];
  const name = certName(award);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
  <rect width="600" height="380" rx="20" fill="#161618"/>
  <rect x="8" y="8" width="584" height="364" rx="14" fill="none" stroke="${tier}" stroke-width="2"/>
  <text x="40" y="64" fill="${tier}" font-family="Arial" font-size="14" letter-spacing="3" font-weight="700">SKILLCAT AWARD · ${award.meritTier.toUpperCase()}</text>
  <text x="40" y="150" fill="#ffffff" font-family="Arial" font-size="30" font-weight="800">${escapeXml(name)}</text>
  <text x="40" y="195" fill="#9a9aa0" font-family="Arial" font-size="18">Awarded to</text>
  <text x="40" y="230" fill="#e7e7e8" font-family="Arial" font-size="26" font-weight="700">${escapeXml(userName)}</text>
  <text x="40" y="320" fill="#9a9aa0" font-family="Arial" font-size="14">Unique No. ${escapeXml(r.uniqueNumber)}</text>
  <text x="40" y="344" fill="#9a9aa0" font-family="Arial" font-size="14">Issued ${escapeXml(formatDate(r.issuedDate))}</text>
  <circle cx="520" cy="300" r="46" fill="none" stroke="${tier}" stroke-width="3"/>
  <text x="520" y="307" fill="${tier}" font-family="Arial" font-size="22" font-weight="800" text-anchor="middle">${award.meritTier[0]}</text>
</svg>`;
}

function awardCertSvg(userName: string, award: Award, r: AwardRecipient): string {
  const tier = MERIT_HEX[award.meritTier];
  const name = certName(award);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#0b0b0c"/>
  <rect x="24" y="24" width="752" height="552" fill="#141416" stroke="${tier}" stroke-width="3"/>
  <text x="400" y="120" fill="${tier}" font-family="Georgia" font-size="20" letter-spacing="4" font-weight="700" text-anchor="middle">CERTIFICATE OF COMPLETION</text>
  <text x="400" y="200" fill="#9a9aa0" font-family="Georgia" font-size="18" text-anchor="middle">This certifies that</text>
  <text x="400" y="260" fill="#ffffff" font-family="Georgia" font-size="40" font-weight="800" text-anchor="middle">${escapeXml(userName)}</text>
  <text x="400" y="320" fill="#9a9aa0" font-family="Georgia" font-size="18" text-anchor="middle">has successfully completed</text>
  <text x="400" y="372" fill="#e7e7e8" font-family="Georgia" font-size="28" font-weight="700" text-anchor="middle">${escapeXml(name)}</text>
  <text x="400" y="470" fill="${tier}" font-family="Georgia" font-size="16" text-anchor="middle">${award.meritTier} Merit</text>
  <text x="400" y="520" fill="#9a9aa0" font-family="Arial" font-size="14" text-anchor="middle">Unique No. ${escapeXml(r.uniqueNumber)} · Issued ${escapeXml(formatDate(r.issuedDate))}</text>
</svg>`;
}

function downloadAllCsv(award: Award, rows: Row[]) {
  const header = ["Name", "Email", "Unique Number", "Issued On", "Appearances"];
  const lines = rows.map((row) =>
    [row.u.name, row.u.email, row.r.uniqueNumber, formatDate(row.r.issuedDate), row.r.appearance]
      .map((v) => csvEscape(v))
      .join(","),
  );
  downloadFile(`${award.id}-recipients.csv`, [header.join(","), ...lines].join("\n"), "text/csv");
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
  const profiles = useMemo(
    () => new Map(allUsers.map((u) => [u.id, buildUserProfile(u).fields] as const)),
    [],
  );
  const recipients = useMemo(() => buildAwardRecipients(award), [award]);
  const hasCard = Boolean(award.cardTemplateId);
  const hasCert = Boolean(award.certificateTemplateId);

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

  const recipientUsers = useMemo(() => rows.map((row) => row.u), [rows]);

  const [committedQuery, setCommittedQuery] = useState("");
  const [filters, setFilters] = useState<UserFilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "issuedDate", dir: "desc" });
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [committedQuery, filters, sort]);

  const filtered = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    return rows.filter(({ u, r }) => {
      const f = profiles.get(u.id);
      if (filters.companies.length && !(u.companyName && filters.companies.includes(u.companyName))) return false;
      if (filters.types.length && !filters.types.includes(u.userType)) return false;
      if (filters.subscriptions.length && !filters.subscriptions.includes(u.subscriptionStatus)) return false;
      if (filters.roles.length && !filters.roles.includes(u.role)) return false;
      if (filters.goals.length && f && !filters.goals.includes(f.goal)) return false;
      if (filters.industries.length && f && !filters.industries.includes(f.industryPreference)) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        r.uniqueNumber.toLowerCase().includes(q)
      );
    });
  }, [rows, committedQuery, filters, profiles]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const tableMin = 240 + COLS.reduce((s, c) => s + c.width, 0) + DOWNLOAD_COL_WIDTH;

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
            <div className="tasks-header-actions">
              <button className="new-task" onClick={() => downloadAllCsv(award, sorted)}>
                <AddIcon />
                Download All
              </button>
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

              {/* Search — same styling as Tasks / Users pages */}
              <div className="toolbar">
                <UsersSearch
                  users={recipientUsers}
                  companies={filters.companies}
                  onCompaniesChange={(c) => setFilters((prev) => ({ ...prev, companies: c }))}
                  query={committedQuery}
                  onCommit={setCommittedQuery}
                />
              </div>

              {/* Filters — same styling as other admin pages */}
              <UsersFilters filters={filters} setFilters={setFilters} />

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
                      <th className="col-download no-sort">
                        <span className="th-content">Download</span>
                      </th>
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
                          <td className="col-download">
                            <div className="ar-dl-cell">
                              {hasCard && (
                                <button
                                  className="ar-dl-btn"
                                  onClick={() =>
                                    downloadFile(
                                      `${row.r.uniqueNumber}-card.svg`,
                                      awardCardSvg(row.u.name, award, row.r),
                                      "image/svg+xml",
                                    )
                                  }
                                >
                                  <DownloadIcon /> Card
                                </button>
                              )}
                              {hasCert && (
                                <button
                                  className="ar-dl-btn"
                                  onClick={() =>
                                    downloadFile(
                                      `${row.r.uniqueNumber}-certificate.svg`,
                                      awardCertSvg(row.u.name, award, row.r),
                                      "image/svg+xml",
                                    )
                                  }
                                >
                                  <DownloadIcon /> Certificate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paged.length === 0 && (
                        <tr>
                          <td colSpan={COLS.length + 2} className="u-empty">
                            {committedQuery.trim()
                              ? `No recipients match "${committedQuery.trim()}".`
                              : "No recipients match these filters."}
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
      <col style={{ width: DOWNLOAD_COL_WIDTH }} />
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

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
  </svg>
);
