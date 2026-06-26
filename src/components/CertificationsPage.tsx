import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  certifications as allCerts,
  NO_CAREER_STAGE,
  NO_TYPE,
  type Certification,
} from "../data/certifications";
import {
  CertFilters,
  CertEditColumnsButton,
  type CertFilterState,
  type CertColumnState,
} from "./CertFilters";
import { SearchIcon, SortIcon, EnterKeyIcon, AddIcon } from "./icons";

const PAGE_SIZE = 50;

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.16 2.92M6.6 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a9.3 9.3 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a2.6 2.6 0 0 0 3.7 3.7" />
    <path d="M2 2l20 20" />
  </svg>
);
const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);
const ArchiveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M9 12h6" />
  </svg>
);
const UnarchiveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M12 18v-6M9.5 14.5 12 12l2.5 2.5" />
  </svg>
);
const PayersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
  </svg>
);
const BackupIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

// Trigger a client-side file download (used for Certification backups).
function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function backupCertification(cert: Certification) {
  const payload = {
    format: "skillcat-certification-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    certification: cert,
  };
  const safeName = cert.name.replace(/[^\w.-]+/g, "_");
  downloadTextFile(`${cert.id}-${safeName}.cert.json`, JSON.stringify(payload, null, 2), "application/json");
}

type SortKey =
  | "id"
  | "name"
  | "industry"
  | "careerStage"
  | "type"
  | "payment"
  | "tasks"
  | "ceus"
  | "createdBy"
  | "visibility"
  | "dateCreated"
  | "dateModified";
type SortDir = "asc" | "desc";

const STAGE_RANK: Record<string, number> = {
  Apprentice: 0,
  Journeyman: 1,
  Master: 2,
};

function compare(a: Certification, b: Certification, key: SortKey): number {
  switch (key) {
    case "id": return a.id.localeCompare(b.id);
    case "name": return a.name.localeCompare(b.name);
    case "industry": return a.industry.localeCompare(b.industry);
    case "careerStage":
      return (
        (a.careerStage ? STAGE_RANK[a.careerStage] : 99) -
        (b.careerStage ? STAGE_RANK[b.careerStage] : 99)
      );
    case "type": return (a.type ?? "").localeCompare(b.type ?? "");
    // Free certs sort first, then paid (Consumable / Non-consumable) alphabetically.
    case "payment": return (a.payment ?? "").localeCompare(b.payment ?? "");
    case "ceus": return parseFloat(a.ceus) - parseFloat(b.ceus);
    case "tasks": return a.tasks - b.tasks;
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "visibility": return (a.visibility ?? "").localeCompare(b.visibility ?? "");
    case "dateCreated": return (Date.parse(a.dateCreated ?? "") || 0) - (Date.parse(b.dateCreated ?? "") || 0);
    case "dateModified": return (Date.parse(a.dateModified ?? "") || 0) - (Date.parse(b.dateModified ?? "") || 0);
  }
}

// A selected Industry option matches its own tag and everything beneath it:
// picking "HVAC" catches "HVAC", "HVAC › Residential", etc.; picking a sub
// path matches only that sub.
function matchesIndustry(cert: Certification, selected: string[]): boolean {
  return selected.some(
    (opt) => cert.industry === opt || cert.industry.startsWith(`${opt} ›`),
  );
}

export function CertificationsPage({
  onNewCert,
  onEditCert,
  onViewPayers,
}: {
  onNewCert: () => void;
  onEditCert: (cert: Certification) => void;
  onViewPayers: (cert: Certification) => void;
}) {
  // Local working copy so visibility/archive/delete persist in-session.
  const [certList, setCertList] = useState<Certification[]>(allCerts);
  const [menu, setMenu] = useState<{ cert: Certification; rect: DOMRect } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Created by SkillCat is applied on launch.
  const [filters, setFilters] = useState<CertFilterState>({
    industries: [],
    careerStages: [],
    types: [],
    creators: ["SkillCat"],
    visibilities: [],
    ceu: "",
    keyword: "",
  });
  const [columns, setColumns] = useState<CertColumnState>({
    id: true,
    industry: true,
    careerStage: true,
    type: false,
    payment: true,
    tasks: true,
    ceus: false,
    createdBy: true,
    visibility: false,
    dateCreated: false,
    dateModified: false,
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "id", dir: "desc" });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ceuMin = filters.ceu.trim() ? parseFloat(filters.ceu) : null;
    const kw = filters.keyword.trim().toLowerCase();
    return certList.filter((c) => {
      if (q && !(
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
      )) return false;
      if (filters.industries.length && !matchesIndustry(c, filters.industries)) return false;
      if (filters.careerStages.length) {
        const match = c.careerStage
          ? filters.careerStages.includes(c.careerStage)
          : filters.careerStages.includes(NO_CAREER_STAGE);
        if (!match) return false;
      }
      if (filters.types.length) {
        const match = c.type
          ? filters.types.includes(c.type)
          : filters.types.includes(NO_TYPE);
        if (!match) return false;
      }
      if (filters.creators.length && !filters.creators.includes(c.createdBy)) return false;
      if (filters.visibilities.length && !filters.visibilities.includes(c.visibility ?? "Visible")) return false;
      if (ceuMin !== null && !Number.isNaN(ceuMin) && parseFloat(c.ceus) < ceuMin) return false;
      if (kw && !(c.keywords ?? []).some((k) => k.toLowerCase().includes(kw))) return false;
      return true;
    });
  }, [query, filters, certList]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, filters, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  // Natural table width so columns scroll horizontally instead of crushing.
  const tableMin =
    240 /* name */ +
    48 /* actions */ +
    (columns.id ? 100 : 0) +
    (columns.industry ? 190 : 0) +
    (columns.careerStage ? 140 : 0) +
    (columns.type ? 130 : 0) +
    (columns.payment ? 150 : 0) +
    (columns.tasks ? 90 : 0) +
    (columns.ceus ? 90 : 0) +
    (columns.createdBy ? 180 : 0) +
    (columns.visibility ? 120 : 0) +
    (columns.dateCreated ? 130 : 0) +
    (columns.dateModified ? 130 : 0);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function setVisibility(cert: Certification, visibility: Certification["visibility"]) {
    setCertList((prev) =>
      prev.map((c) => (c.id === cert.id ? { ...c, visibility } : c)),
    );
  }

  function toggleHidden(cert: Certification) {
    setVisibility(cert, (cert.visibility ?? "Visible") === "Visible" ? "Hidden" : "Visible");
  }

  function deleteCert(cert: Certification) {
    const ok = window.confirm(`Delete “${cert.name}” (${cert.id})? This can’t be undone.`);
    if (!ok) return;
    setCertList((prev) => prev.filter((c) => c.id !== cert.id));
    if (selectedId === cert.id) setSelectedId(null);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Certifications</h1>
              <div className="tasks-subtitle">{certList.length} Certifications · all industries</div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={onNewCert}>
                <AddIcon />
                Create Certification
                <span className="cta-kbd"><EnterKeyIcon /></span>
              </button>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <div className="search-wrap">
                  <span className="search-icon"><SearchIcon /></span>
                  <input
                    className="search-input"
                    placeholder="Search Certifications by name, ID, or industry…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
                </div>
              </div>

              <CertFilters filters={filters} setFilters={setFilters} />

              <div className="co-table-row">
                <div className="co-table-col">
                  <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
                    <table className="table table-head">
                      <CertColGroup columns={columns} />
                      <thead>
                        <tr>
                          {columns.id && <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />}
                          <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                          {columns.industry && <SortableHeader col="industry" label="Industry" className="col-used" sort={sort} toggle={toggleSort} />}
                          {columns.careerStage && <SortableHeader col="careerStage" label="Career Stage" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.type && <SortableHeader col="type" label="Type" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.payment && <SortableHeader col="payment" label="Payment" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.tasks && <SortableHeader col="tasks" label="Tasks" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.ceus && <SortableHeader col="ceus" label="CEUs" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.createdBy && <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} sortable={false} />}
                          {columns.visibility && <SortableHeader col="visibility" label="Visibility" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.dateCreated && <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />}
                          {columns.dateModified && <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />}
                          <th className="col-actions">
                            <CertEditColumnsButton columns={columns} setColumns={setColumns} />
                          </th>
                        </tr>
                      </thead>
                    </table>

                    <div className="tasks-scroll">
                      <table className="table table-body">
                        <CertColGroup columns={columns} />
                        <tbody>
                          {paged.map((cert) => (
                            <CertRow
                              key={cert.id}
                              cert={cert}
                              selected={cert.id === selectedId}
                              columns={columns}
                              onClick={() => setSelectedId(cert.id === selectedId ? null : cert.id)}
                              onEdit={() => onEditCert(cert)}
                              onToggleVisibility={() => toggleHidden(cert)}
                              onOpenMenu={(rect) => setMenu({ cert, rect })}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
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
        </div>
      </div>

      {menu && (
        <CertActionsMenu
          cert={menu.cert}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onArchive={() =>
            setVisibility(
              menu.cert,
              (menu.cert.visibility ?? "Visible") === "Archived" ? "Visible" : "Archived",
            )
          }
          onEdit={() => onEditCert(menu.cert)}
          onDelete={() => deleteCert(menu.cert)}
          onViewPayers={() => onViewPayers(menu.cert)}
          onBackup={() => backupCertification(menu.cert)}
        />
      )}
    </div>
  );
}

function CertColGroup({ columns }: { columns: CertColumnState }) {
  return (
    <colgroup>
      {columns.id && <col style={{ width: 100 }} />}
      <col />
      {columns.industry && <col style={{ width: 190 }} />}
      {columns.careerStage && <col style={{ width: 140 }} />}
      {columns.type && <col style={{ width: 130 }} />}
      {columns.payment && <col style={{ width: 150 }} />}
      {columns.tasks && <col style={{ width: 90 }} />}
      {columns.ceus && <col style={{ width: 90 }} />}
      {columns.createdBy && <col style={{ width: 180 }} />}
      {columns.visibility && <col style={{ width: 120 }} />}
      {columns.dateCreated && <col style={{ width: 130 }} />}
      {columns.dateModified && <col style={{ width: 130 }} />}
      <col style={{ width: 48 }} />
    </colgroup>
  );
}

function CertRow({
  cert,
  selected,
  columns,
  onClick,
  onEdit,
  onToggleVisibility,
  onOpenMenu,
}: {
  cert: Certification;
  selected: boolean;
  columns: CertColumnState;
  onClick: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onOpenMenu: (rect: DOMRect) => void;
}) {
  const vis = cert.visibility ?? "Visible";
  const hidden = vis === "Hidden";
  return (
    <tr
      className={`${selected ? "selected" : ""} ${cert.draft ? "draft" : ""} ${hidden ? "task-hidden" : ""}`}
      onClick={onClick}
    >
      {columns.id && <td className="col-id">{cert.id}</td>}
      <td className="col-name">
        {cert.name}
        {vis !== "Visible" && <span className="hidden-badge">{vis}</span>}
      </td>
      {columns.industry && <td className="col-used">{cert.industry}</td>}
      {columns.careerStage && <td className="col-type">{cert.careerStage ?? "—"}</td>}
      {columns.type && <td className="col-type">{cert.type ?? "—"}</td>}
      {columns.payment && (
        <td className="col-type">
          {cert.payment ? (
            <span className={`pay-badge pay-badge--${cert.payment === "Consumable" ? "consumable" : "nonconsumable"}`}>
              {cert.payment}
            </span>
          ) : (
            <span className="pay-badge pay-badge--free">Free</span>
          )}
        </td>
      )}
      {columns.tasks && <td className="col-type">{cert.tasks}</td>}
      {columns.ceus && <td className="col-type">{cert.ceus}</td>}
      {columns.createdBy && <td className="col-creator">{cert.createdBy}</td>}
      {columns.visibility && <td className="col-type">{vis}</td>}
      {columns.dateCreated && <td className="col-date">{cert.dateCreated ?? "—"}</td>}
      {columns.dateModified && <td className="col-date">{cert.dateModified ?? "—"}</td>}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        >
          <MoreIcon />
        </button>
        <div className="row-action-bar">
          <button
            className="row-action-btn"
            aria-label="Edit"
            title="Edit certification"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <PencilIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label={hidden ? "Make visible" : "Hide certification"}
            title={hidden ? "Make visible" : "Hide certification"}
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          >
            {hidden ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
          >
            <MoreIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────── Three-dot row actions menu ─────────────── */
/* Fixed-positioned so it escapes the table's scroll container. */

function CertActionsMenu({
  cert,
  rect,
  onClose,
  onArchive,
  onEdit,
  onDelete,
  onViewPayers,
  onBackup,
}: {
  cert: Certification;
  rect: DOMRect;
  onClose: () => void;
  onArchive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewPayers: () => void;
  onBackup: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    let left = rect.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    setPos({ top, left });
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

  const archived = (cert.visibility ?? "Visible") === "Archived";

  const item = (
    icon: JSX.Element,
    label: string,
    onPick: () => void,
    danger = false,
  ) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      {label}
    </button>
  );

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        left: pos ? pos.left : rect.right - 210,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{cert.name}</div>
        <div className="u-menu-head-id">{cert.id}{cert.type ? ` · ${cert.type}` : ""}</div>
      </div>
      <div className="u-menu-divider" />
      {archived
        ? item(<UnarchiveIcon />, "Unarchive Certification", onArchive)
        : item(<ArchiveIcon />, "Archive Certification", onArchive)}
      {item(<PencilIcon />, "Edit", onEdit)}
      {/* Only paid certifications have payers to view. */}
      {cert.payment && item(<PayersIcon />, "View who paid", onViewPayers)}
      {item(<BackupIcon />, "Backup Certification", onBackup)}
      <div className="u-menu-divider" />
      {item(<TrashIcon />, "Delete", onDelete, true)}
    </div>
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
