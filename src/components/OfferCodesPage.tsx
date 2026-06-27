import { useEffect, useMemo, useState } from "react";
import {
  offerCodes as seedCodes,
  REGION_BANK,
  ALL_PLATFORMS,
  PLATFORM_LABEL,
  type OfferCode,
  type BillingPlan,
  type Platform,
} from "../data/offerCodes";
import { SearchIcon, SortIcon, SmallXIcon, EnterKeyIcon, AddIcon, CheckIcon } from "./icons";

const PAGE_SIZE = 25;
const TODAY = new Date("2026-06-18");

type OfferStatus = "active" | "expired";

type SortKey = "code" | "regions" | "status";
type SortDir = "asc" | "desc";

function statusOf(c: OfferCode): OfferStatus {
  return new Date(c.expiresOn).getTime() >= TODAY.getTime() ? "active" : "expired";
}

function regionsLabel(regions: string[]): string {
  if (regions.length === 0) return "All regions";
  if (regions.length <= 2) return regions.join(", ");
  return `${regions.slice(0, 2).join(", ")} +${regions.length - 2}`;
}

function compare(a: OfferCode, b: OfferCode, key: SortKey): number {
  switch (key) {
    case "code":
      return a.code.localeCompare(b.code);
    case "regions": {
      const al = a.regions.length === 0 ? Infinity : a.regions.length;
      const bl = b.regions.length === 0 ? Infinity : b.regions.length;
      return al - bl;
    }
    case "status":
      return statusOf(a).localeCompare(statusOf(b));
  }
}

export function OfferCodesPage() {
  const [list, setList] = useState<OfferCode[]>(seedCodes);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OfferStatus>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "code",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    let active = 0;
    let expired = 0;
    list.forEach((c) => (statusOf(c) === "active" ? active++ : expired++));
    return { active, expired };
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (statusFilter !== "all" && statusOf(c) !== statusFilter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.regions.some((r) => r.toLowerCase().includes(q)) ||
        c.plan.toLowerCase().includes(q)
      );
    });
  }, [list, query, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, statusFilter, sort]);
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

  function handleCreate(input: { code: string; plan: BillingPlan; regions: string[] }) {
    const id = `OC-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const expires = new Date(TODAY);
    expires.setMonth(expires.getMonth() + 6);
    const newCode: OfferCode = {
      id,
      code: input.code,
      plan: input.plan,
      regions: input.regions,
      platforms: ALL_PLATFORMS,
      createdOn: TODAY.toISOString().slice(0, 10),
      expiresOn: expires.toISOString().slice(0, 10),
      createdBy: "You",
    };
    setList((prev) => [newCode, ...prev]);
    setCreating(false);
  }

  function handleDelete(id: string) {
    setList((prev) => prev.filter((c) => c.id !== id));
  }

  const existingCodes = useMemo(
    () => new Set(list.map((c) => c.code.toUpperCase())),
    [list],
  );

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks sch-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Offer Codes</h1>
              <div className="tasks-subtitle">
                <span>{counts.active} active</span>
                <span className="tasks-subtitle-dot" />
                <span>{counts.expired} expired</span>
                <span className="tasks-subtitle-dot" />
                <span>
                  Offer codes unlock discounted subscriptions and are created on Apple, Google,
                  and Stripe
                </span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={() => setCreating(true)}>
                <AddIcon />
                Create Offer Code
                <span className="cta-kbd">
                  <EnterKeyIcon />
                </span>
              </button>
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
                  placeholder="Search Offer Codes by code, plan, or region…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="search-kbd">
                  <span className="kbd-cmd">⌘</span>
                  <span className="kbd-letter">K</span>
                </span>
              </div>

              <div className="filters">
                <div className="sch-status-tabs">
                  {(["all", "active", "expired"] as const).map((k) => (
                    <button
                      key={k}
                      className={`sch-tab ${statusFilter === k ? "is-active" : ""}`}
                      onClick={() => setStatusFilter(k)}
                    >
                      {k === "all" ? "All" : k === "active" ? "Active" : "Expired"}
                      {k !== "all" && (
                        <span className="sch-tab-count">
                          {k === "active" ? counts.active : counts.expired}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tasks-scroll">
                <table className="table sch-table" style={{ width: 768 }}>
                  <colgroup>
                    <col style={{ width: 280 }} />
                    <col style={{ width: 280 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 48 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader col="code" label="Offer Code" sort={sort} toggle={toggleSort} />
                      <SortableHeader
                        col="regions"
                        label="Countries/Regions"
                        sort={sort}
                        toggle={toggleSort}
                        sortable={false}
                      />
                      <SortableHeader col="status" label="Status" sort={sort} toggle={toggleSort} />
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => (
                      <OfferCodeRow
                        key={c.id}
                        code={c}
                        onDelete={() => handleDelete(c.id)}
                      />
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={4} className="sch-empty">
                          {query.trim()
                            ? `No offer codes match "${query.trim()}".`
                            : statusFilter === "expired"
                            ? "No expired offer codes."
                            : statusFilter === "active"
                            ? "No active offer codes."
                            : 'No offer codes yet. Click "Create Offer Code" to add one.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>
                  Showing {sorted.length === 0 ? 0 : start + 1}–
                  {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="pagination-controls">
                  <button
                    className="page-btn"
                    disabled={visiblePage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>
                  <button
                    className="page-btn"
                    disabled={visiblePage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {creating && (
        <CreateOfferCodeModal
          existingCodes={existingCodes}
          onClose={() => setCreating(false)}
          onCreate={handleCreate}
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

function PlatformBadges({ platforms }: { platforms: Platform[] }) {
  return (
    <span className="oc-platforms">
      {platforms.map((p) => (
        <span key={p} className={`oc-platform oc-platform--${p}`} title={`Created on ${PLATFORM_LABEL[p]}`}>
          {PLATFORM_LABEL[p]}
        </span>
      ))}
    </span>
  );
}

function StatusPill({ status }: { status: OfferStatus }) {
  return (
    <span className={`sch-status sch-status--${status}`}>
      <span className="sch-status-dot" />
      {status === "active" ? "Active" : "Expired"}
    </span>
  );
}

function OfferCodeRow({
  code,
  onDelete,
}: {
  code: OfferCode;
  onDelete: () => void;
}) {
  const status = statusOf(code);
  return (
    <tr>
      <td>
        <div className="oc-code-cell">
          <div className="oc-code-line">
            <span className="oc-code">{code.code}</span>
            <span className={`oc-plan oc-plan--${code.plan}`}>
              {code.plan === "monthly" ? "Monthly" : "Annual"}
            </span>
          </div>
          <PlatformBadges platforms={code.platforms} />
        </div>
      </td>
      <td>
        <span className={code.regions.length === 0 ? "oc-regions oc-regions--all" : "oc-regions"}>
          {regionsLabel(code.regions)}
        </span>
      </td>
      <td>
        <StatusPill status={status} />
      </td>
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="Delete"
          title="Delete offer code"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <SmallXIcon />
        </button>
      </td>
    </tr>
  );
}

/* ───────────────── Create Offer Code modal ───────────────── */

function CreateOfferCodeModal({
  existingCodes,
  onClose,
  onCreate,
}: {
  existingCodes: Set<string>;
  onClose: () => void;
  onCreate: (input: { code: string; plan: BillingPlan; regions: string[] }) => void;
}) {
  const [plan, setPlan] = useState<BillingPlan | null>(null);
  const [code, setCode] = useState("");
  const [regions, setRegions] = useState<string[]>([]);

  const duplicate = code.length > 0 && existingCodes.has(code);
  const codeValid = code.length >= 3 && !duplicate;
  const valid = plan !== null && codeValid;

  function toggleRegion(region: string) {
    setRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  }

  function submit() {
    if (!valid || plan === null) return;
    onCreate({ code, plan, regions });
  }

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal sch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Create Offer Code</h3>
          <p className="cl-modal-sub">
            Set up a subscription offer code. It will be created on Apple, Google, and Stripe.
          </p>
          <div className="required-fields-note">* Required Fields</div>
        </div>

        <div className="sch-modal-body">
          {/* Billing plan */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">
              Subscription plan <span className="req">*</span>
            </label>
            <div className="oc-plan-toggle">
              {(["monthly", "annual"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`oc-plan-option ${plan === p ? "is-active" : ""}`}
                  onClick={() => setPlan(p)}
                >
                  <span className="oc-plan-option-title">
                    {p === "monthly" ? "Monthly" : "Annual"}
                  </span>
                  <span className="oc-plan-option-sub">
                    {p === "monthly" ? "Billed every month" : "Billed once a year"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Code */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">
              Offer code <span className="req">*</span>
            </label>
            <input
              autoFocus
              className="form-input oc-code-input"
              placeholder="E.G. SUMMERPRO25"
              value={code}
              maxLength={24}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            {duplicate ? (
              <p className="form-help oc-error">That code already exists. Choose a different one.</p>
            ) : (
              <p className="form-help">
                Letters and numbers, automatically uppercased. Used by customers at checkout on all
                platforms.
              </p>
            )}
          </div>

          {/* Regions */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Countries/Regions</label>
            <div className="oc-region-grid">
              {REGION_BANK.map((r) => {
                const on = regions.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    className={`oc-region-chip ${on ? "is-active" : ""}`}
                    onClick={() => toggleRegion(r)}
                  >
                    {on && (
                      <span className="oc-region-check">
                        <CheckIcon />
                      </span>
                    )}
                    {r}
                  </button>
                );
              })}
            </div>
            <p className="form-help">
              {regions.length === 0
                ? "No regions selected — the code will be available in all regions."
                : `${regions.length} ${regions.length === 1 ? "region" : "regions"} selected.`}
            </p>
          </div>

          {/* Platform sync notice */}
          <div className="oc-platform-notice">
            <span className="oc-platform-notice-label">Created on</span>
            <div className="oc-platform-notice-badges">
              {ALL_PLATFORMS.map((p) => (
                <span key={p} className="oc-platform-notice-badge">
                  <span className="oc-platform-notice-check">
                    <CheckIcon />
                  </span>
                  {PLATFORM_LABEL[p]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="cl-modal-foot sch-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-publish sch-submit" disabled={!valid} onClick={submit}>
            Create Offer Code
          </button>
        </div>
      </div>
    </div>
  );
}
