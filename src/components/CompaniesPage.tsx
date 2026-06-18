import { useEffect, useMemo, useState } from "react";
import {
  companies as seedCompanies,
  TIERS,
  type Company,
  type Tier,
} from "../data/companies";
import { SearchIcon, SortIcon, AddIcon, EnterKeyIcon } from "./icons";

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

type SortKey = "name" | "email" | "tier" | "seats" | "industry" | "partnership";
type SortDir = "asc" | "desc";

const TIER_ORDER: Record<Tier, number> = {
  "Free Trial": 0,
  Essentials: 1,
  Growth: 2,
  Pro: 3,
  "Complimentary Access": 4,
};

function compare(a: Company, b: Company, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "email":
      return a.email.localeCompare(b.email);
    case "tier":
      return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    case "seats":
      return a.seats - b.seats;
    case "industry":
      return a.industry.localeCompare(b.industry);
    case "partnership":
      return a.partnership.localeCompare(b.partnership);
  }
}

export function CompaniesPage({ initialQuery = "" }: { initialQuery?: string }) {
  const [list, setList] = useState<Company[]>(seedCompanies);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.partnership.toLowerCase().includes(q) ||
        c.tier.toLowerCase().includes(q),
    );
  }, [list, query]);

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

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function handleAdd(company: Omit<Company, "id">) {
    const id = `CO-${String(list.length + 1).padStart(3, "0")}`;
    setList((prev) => [{ id, ...company }, ...prev]);
    setAdding(false);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Manage Companies</h1>
              <div className="tasks-subtitle">{list.length} Companies · all tiers</div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={() => setAdding(true)}>
                <AddIcon />
                Add Company
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
                  placeholder="Search Companies by name, email, industry, or tier…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
              </div>

              <div className="filters">
                <button className="filter-pill-dashed">+ Tier</button>
                <button className="filter-pill-dashed">+ Industry</button>
                <button className="filter-pill-dashed">+ Partnership</button>
              </div>

              <table className="table table-head">
                <ColGroup />
                <thead>
                  <tr>
                    <SortableHeader col="name" label="Company" className="col-name" sort={sort} toggle={toggleSort} />
                    <SortableHeader col="email" label="Email" className="col-email" sort={sort} toggle={toggleSort} />
                    <SortableHeader col="tier" label="Tier" className="col-tier" sort={sort} toggle={toggleSort} />
                    <SortableHeader col="seats" label="Seats" className="col-seats" sort={sort} toggle={toggleSort} />
                    <SortableHeader col="industry" label="Industry" className="col-industry" sort={sort} toggle={toggleSort} />
                    <SortableHeader col="partnership" label="Partnership" className="col-partnership" sort={sort} toggle={toggleSort} />
                    <th className="col-actions" />
                  </tr>
                </thead>
              </table>

              <div className="tasks-scroll">
                <table className="table table-body">
                  <ColGroup />
                  <tbody>
                    {paged.map((c) => (
                      <CompanyRow
                        key={c.id}
                        company={c}
                        selected={c.id === selectedId}
                        onClick={() => setSelectedId(c.id)}
                      />
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

      {adding && (
        <AddCompanyModal onClose={() => setAdding(false)} onAdd={handleAdd} />
      )}
    </div>
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col />
      <col style={{ width: 185 }} />
      <col style={{ width: 210 }} />
      <col style={{ width: 70 }} />
      <col style={{ width: 165 }} />
      <col style={{ width: 170 }} />
      <col style={{ width: 48 }} />
    </colgroup>
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

function TierPill({ tier }: { tier: Tier }) {
  const slug = tier.toLowerCase().replace(/\s+/g, "-");
  return <span className={`co-tier co-tier--${slug}`}>{tier}</span>;
}

function CompanyRow({
  company,
  selected,
  onClick,
}: {
  company: Company;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <tr className={selected ? "selected" : ""} onClick={onClick}>
      <td className="col-name">{company.name}</td>
      <td className="col-email">{company.email}</td>
      <td className="col-tier"><TierPill tier={company.tier} /></td>
      <td className="col-seats">{company.seats.toLocaleString()}</td>
      <td className="col-industry">{company.industry || "—"}</td>
      <td className="col-partnership">{company.partnership || "—"}</td>
      <td className="col-actions">
        <button className="row-action-btn lone-dots" aria-label="More" onClick={(e) => e.stopPropagation()}>
          <MoreIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Edit" onClick={(e) => e.stopPropagation()}>
            <PencilIcon />
          </button>
          <button className="row-action-btn" aria-label="Toggle visibility" onClick={(e) => e.stopPropagation()}>
            <EyeIcon />
          </button>
          <button className="row-action-btn" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <MoreIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────── Add Company modal ─────────────── */

const EMPTY_FORM = {
  name: "",
  email: "",
  tier: "Free Trial" as Tier,
  seats: "",
  industry: "",
  partnership: "",
};

function AddCompanyModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (company: Omit<Company, "id">) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  const valid = form.name.trim() && form.email.trim();

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function submit() {
    if (!valid) return;
    onAdd({
      name: form.name.trim(),
      email: form.email.trim(),
      tier: form.tier,
      seats: form.seats ? parseInt(form.seats, 10) : 0,
      industry: form.industry.trim(),
      partnership: form.partnership.trim(),
    });
  }

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div
        className="cl-modal co-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Add Company</h3>
          <p className="cl-modal-sub">
            Register a new company on the platform.
          </p>
        </div>

        <div className="co-modal-body">
          <div className="form-group">
            <label className="form-label">
              Company Name <span className="req">*</span>
            </label>
            <input
              autoFocus
              className="form-input"
              placeholder="e.g. Apex HVAC Solutions"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Email <span className="req">*</span>
            </label>
            <input
              className="form-input"
              type="email"
              placeholder="admin@company.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div className="co-modal-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Tier</label>
              <select
                className="form-input co-select"
                value={form.tier}
                onChange={(e) => set("tier", e.target.value)}
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: "0 0 100px" }}>
              <label className="form-label">Seats</label>
              <input
                className="form-input"
                type="number"
                min={0}
                placeholder="0"
                value={form.seats}
                onChange={(e) => set("seats", e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Industry</label>
            <input
              className="form-input"
              placeholder="e.g. HVAC, Electrical, Plumbing"
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Partnership</label>
            <input
              className="form-input"
              placeholder="e.g. Preferred Partner, Elite Partner"
              value={form.partnership}
              onChange={(e) => set("partnership", e.target.value)}
            />
          </div>
        </div>

        <div className="cl-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-publish"
            disabled={!valid}
            onClick={submit}
          >
            Add Company
          </button>
        </div>
      </div>
    </div>
  );
}
