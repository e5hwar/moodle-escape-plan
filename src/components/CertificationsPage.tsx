import { useEffect, useMemo, useState } from "react";
import { certifications as allCerts, type Certification } from "../data/certifications";
import { CheckIcon, SearchIcon, SortIcon, EnterKeyIcon } from "./icons";

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
const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

function SubtleCheckbox({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: (e: React.MouseEvent) => void;
  label?: string;
}) {
  return (
    <span
      className={`row-checkbox ${checked ? "checked" : ""}`}
      onClick={onClick}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
    >
      {checked && <CheckIcon />}
    </span>
  );
}

const Caret = () => <span className="caret">▾</span>;

type SortKey = "id" | "name" | "industry" | "ceus" | "tasks" | "createdBy" | "dateCreated" | "dateModified";
type SortDir = "asc" | "desc";

function compare(a: Certification, b: Certification, key: SortKey): number {
  switch (key) {
    case "id": return a.id.localeCompare(b.id);
    case "name": return a.name.localeCompare(b.name);
    case "industry": return a.industry.localeCompare(b.industry);
    case "ceus": return parseFloat(a.ceus) - parseFloat(b.ceus);
    case "tasks": return a.tasks - b.tasks;
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "dateCreated": return (Date.parse(a.dateCreated ?? "") || 0) - (Date.parse(b.dateCreated ?? "") || 0);
    case "dateModified": return (Date.parse(a.dateModified ?? "") || 0) - (Date.parse(b.dateModified ?? "") || 0);
  }
}

export function CertificationsPage({ onNewCert }: { onNewCert: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "id", dir: "desc" });
  const [page, setPage] = useState(1);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCerts.filter((c) => {
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const allOnPageChecked = paged.length > 0 && paged.every((t) => checkedIds.has(t.id));

  function toggleAllOnPage() {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageChecked) paged.forEach((t) => next.delete(t.id));
      else paged.forEach((t) => next.add(t.id));
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Certifications</h1>
              <div className="tasks-subtitle">{allCerts.length} Certifications · all industries</div>
            </div>
            <div className="tasks-header-actions">
              <button className="resources-btn">
                Resources <Caret />
              </button>
              <button className="new-task" onClick={onNewCert}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create Certification
                <span className="cta-kbd"><EnterKeyIcon /></span>
              </button>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
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

              <div className="filters">
                <button className="filter-pill-dashed">+ Industry</button>
                <button className="filter-pill-dashed">+ Career Stage</button>
                <button className="filter-pill-dashed">+ Visibility</button>
                <button className="filter-pill-dashed">+ Created By</button>
              </div>

              <div className="tasks-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th
                        className="col-checkbox"
                        onClick={(e) => { e.stopPropagation(); toggleAllOnPage(); }}
                      >
                        <SubtleCheckbox
                          checked={allOnPageChecked}
                          onClick={(e) => { e.stopPropagation(); toggleAllOnPage(); }}
                          label="Select all on page"
                        />
                      </th>
                      <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="industry" label="Industry" className="col-used" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="tasks" label="Tasks" className="col-type" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="ceus" label="CEUs" className="col-type" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} />
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((cert) => (
                      <tr
                        key={cert.id}
                        className={`${cert.id === selectedId ? "selected" : ""} ${cert.draft ? "draft" : ""}`}
                        onClick={() => setSelectedId(cert.id)}
                      >
                        <td
                          className="col-checkbox"
                          onClick={(e) => { e.stopPropagation(); toggleChecked(cert.id); }}
                        >
                          <SubtleCheckbox
                            checked={checkedIds.has(cert.id)}
                            onClick={(e) => { e.stopPropagation(); toggleChecked(cert.id); }}
                            label={`Select ${cert.id}`}
                          />
                        </td>
                        <td className="col-id">{cert.id}</td>
                        <td className="col-name">{cert.name}</td>
                        <td className="col-used">{cert.industry}</td>
                        <td className="col-type">{cert.tasks}</td>
                        <td className="col-type">{cert.ceus}</td>
                        <td className="col-creator">{cert.createdBy}</td>
                        <td className="col-actions">
                          <div className="row-action-bar">
                            <button className="row-action-btn" aria-label="Edit" onClick={(e) => e.stopPropagation()}><PencilIcon /></button>
                            <button className="row-action-btn" aria-label="Toggle visibility" onClick={(e) => e.stopPropagation()}><EyeIcon /></button>
                            <button className="row-action-btn" aria-label="More" onClick={(e) => e.stopPropagation()}><MoreIcon /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
    </div>
  );
}

function SortableHeader({
  col, label, className, sort, toggle,
}: {
  col: SortKey;
  label: string;
  className?: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
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
