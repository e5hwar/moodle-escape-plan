import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  offerCodes as seedCodes,
  REGION_BANK,
  ALL_PLATFORMS,
  PLATFORM_LABEL,
  type OfferCode,
  type BillingPlan,
} from "../data/offerCodes";
import {
  KeyCommandIcon,
  SearchIcon,
  SortIcon,
  AddIcon,
  CalendarIcon,
  CopyIcon,
  RowDeleteIcon,
  RowKebabIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "./icons";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { PrmModal } from "./PrmModal";
import { MultiSelect } from "./NewCompanyWizard";
import { DateField } from "./DateField";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

const PAGE_SIZE = 25;
const TODAY = new Date("2026-06-18");
const TODAY_ISO = TODAY.toISOString().slice(0, 10);

const PLAN_LABEL: Record<BillingPlan, string> = {
  monthly: "Monthly",
  annual: "Annual",
};
const PLAN_OPTIONS = ["Monthly", "Annual"];

type OfferStatus = "active" | "expired";

type SortKey = "code" | "plan" | "expiresOn" | "createdBy" | "status";
type SortDir = "asc" | "desc";

function statusOf(c: OfferCode): OfferStatus {
  return new Date(c.expiresOn).getTime() >= TODAY.getTime() ? "active" : "expired";
}

function regionsLabel(regions: string[]): string {
  if (regions.length === 0) return "All regions";
  if (regions.length <= 2) return regions.join(", ");
  return `${regions.slice(0, 2).join(", ")} +${regions.length - 2}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** TODAY + n months, as "YYYY-MM-DD". */
function monthsOut(n: number): string {
  const d = new Date(TODAY);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function compare(a: OfferCode, b: OfferCode, key: SortKey): number {
  switch (key) {
    case "code":
      return a.code.localeCompare(b.code);
    case "plan":
      return PLAN_LABEL[a.plan].localeCompare(PLAN_LABEL[b.plan]);
    case "expiresOn":
      return new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime();
    case "createdBy":
      return a.createdBy.localeCompare(b.createdBy);
    case "status":
      return statusOf(a).localeCompare(statusOf(b));
  }
}

export function OfferCodesPage({ onBack }: { onBack?: () => void }) {
  const [list, setList] = useState<OfferCode[]>(seedCodes);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OfferStatus>("all");
  const [planFilter, setPlanFilter] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "expiresOn",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<{ code: OfferCode; rect: DOMRect } | null>(null);
  useCreateShortcut(() => setCreating(true), !creating);

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
      if (planFilter.length && !planFilter.includes(PLAN_LABEL[c.plan])) return false;
      // An all-regions code (empty array) matches every region filter.
      if (
        regionFilter.length &&
        c.regions.length > 0 &&
        !c.regions.some((r) => regionFilter.includes(r))
      )
        return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.regions.some((r) => r.toLowerCase().includes(q)) ||
        c.plan.toLowerCase().includes(q)
      );
    });
  }, [list, query, statusFilter, planFilter, regionFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, statusFilter, planFilter, regionFilter, sort]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const hasFilters = planFilter.length + regionFilter.length > 0;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function handleCreate(input: {
    code: string;
    plan: BillingPlan;
    regions: string[];
    expiresOn: string;
  }) {
    const id = `OC-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const newCode: OfferCode = {
      id,
      code: input.code,
      plan: input.plan,
      regions: input.regions,
      platforms: ALL_PLATFORMS,
      createdOn: TODAY_ISO,
      expiresOn: input.expiresOn,
      createdBy: "You",
    };
    setList((prev) => [newCode, ...prev]);
    setCreating(false);
  }

  function handleDelete(id: string) {
    setList((prev) => prev.filter((c) => c.id !== id));
  }

  function handleExtend(id: string) {
    setList((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        // Extend 6 months from the later of today or the current expiry.
        const base = new Date(
          Math.max(new Date(c.expiresOn).getTime(), TODAY.getTime()),
        );
        base.setMonth(base.getMonth() + 6);
        return { ...c, expiresOn: base.toISOString().slice(0, 10) };
      }),
    );
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
            {/* This page is reached from Manage Users' header button (it no
                longer has its own sidebar entry), so the crumb is the way back. */}
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Users</span>
                <ChevronRightIcon />
                <button className="rvc-crumb" onClick={onBack} title="Back to Manage Users">
                  Manage Users
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Offer Codes</span>
              </nav>
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
                <span className="cta-kbd">C</span>
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
                  <span className="kbd-cmd"><KeyCommandIcon /></span>
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

                {/* The shared filter pills (Filters.tsx) — same menu chrome as
                    Tasks / Certifications / Companies. */}
                <Dropdown
                  width={220}
                  trigger={({ open, toggle }) => (
                    <PillTrigger
                      label="Plan"
                      value={summarize(planFilter, PLAN_OPTIONS)}
                      open={open}
                      toggle={toggle}
                      onClear={() => setPlanFilter([])}
                    />
                  )}
                >
                  {({ close }) => (
                    <SectionedMultiSelect
                      sections={[{ items: PLAN_OPTIONS }]}
                      value={planFilter}
                      onApply={(v) => {
                        setPlanFilter(v);
                        close();
                      }}
                    />
                  )}
                </Dropdown>

                <Dropdown
                  width={300}
                  trigger={({ open, toggle }) => (
                    <PillTrigger
                      label="Countries/Regions"
                      value={summarize(regionFilter, REGION_BANK)}
                      open={open}
                      toggle={toggle}
                      onClear={() => setRegionFilter([])}
                    />
                  )}
                >
                  {({ close }) => (
                    <SectionedMultiSelect
                      sections={[{ items: REGION_BANK }]}
                      value={regionFilter}
                      onApply={(v) => {
                        setRegionFilter(v);
                        close();
                      }}
                      searchable
                      searchPlaceholder="Search countries/regions…"
                    />
                  )}
                </Dropdown>

                {hasFilters && (
                  <button
                    className="filter-clear-link"
                    onClick={() => {
                      setPlanFilter([]);
                      setRegionFilter([]);
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="tasks-scroll">
                <table className="table sch-table" style={{ width: 1190 }}>
                  <colgroup>
                    <col style={{ width: 200 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 240 }} />
                    <col style={{ width: 190 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 40 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader col="code" label="Offer Code" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="plan" label="Plan" sort={sort} toggle={toggleSort} />
                      <SortableHeader
                        label="Countries/Regions"
                        sort={sort}
                        toggle={toggleSort}
                        sortable={false}
                      />
                      <SortableHeader
                        label="Storefronts"
                        sort={sort}
                        toggle={toggleSort}
                        sortable={false}
                      />
                      <SortableHeader col="expiresOn" label="Expires On" sort={sort} toggle={toggleSort} />
                      <SortableHeader
                        col="createdBy"
                        label="Created By"
                        className="col-creator"
                        sort={sort}
                        toggle={toggleSort}
                      />
                      <SortableHeader
                        col="status"
                        label="Status"
                        className="col-status"
                        sort={sort}
                        toggle={toggleSort}
                      />
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => (
                      <OfferCodeRow
                        key={c.id}
                        code={c}
                        menuOpen={menu?.code.id === c.id}
                        onOpenMenu={(rect) => setMenu({ code: c, rect })}
                        onDelete={() => handleDelete(c.id)}
                      />
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={8} className="sch-empty">
                          {query.trim()
                            ? `No offer codes match "${query.trim()}".`
                            : hasFilters
                            ? "No offer codes match these filters."
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
                  Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="pagination-controls">
                  <button
                    className="page-btn"
                    disabled={visiblePage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  ><ChevronLeftIcon /></button>
                  <button
                    className="page-btn"
                    disabled={visiblePage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  ><ChevronRightIcon /></button>
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

      {menu && (
        <OfferCodeActionsMenu
          code={menu.code}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onExtend={() => handleExtend(menu.code.id)}
          onDelete={() => handleDelete(menu.code.id)}
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
  /** Omitted on a display-only column (`sortable={false}`). */
  col?: SortKey;
  label: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
  className?: string;
}) {
  if (!sortable || !col) {
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

/** The shared status pill (Figma 109:1237) — the same one the Companies table
 *  re-enables for `td.col-status`, so both pages read identically. */
function StatusPill({ status }: { status: OfferStatus }) {
  return (
    <span className={`co-status-pill co-status-pill--${status === "active" ? "green" : "grey"}`}>
      {status === "active" ? "Active" : "Expired"}
    </span>
  );
}

function OfferCodeRow({
  code,
  menuOpen,
  onOpenMenu,
  onDelete,
}: {
  code: OfferCode;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
  onOpenMenu: (rect: DOMRect) => void;
  onDelete: () => void;
}) {
  const status = statusOf(code);
  return (
    <tr className={menuOpen ? "menu-open" : ""}>
      <td className="col-name">{code.code}</td>
      <td className="col-type">{PLAN_LABEL[code.plan]}</td>
      <td>{regionsLabel(code.regions)}</td>
      <td>{code.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}</td>
      <td className="col-date">{formatDate(code.expiresOn)}</td>
      <td className="col-creator">{code.createdBy}</td>
      <td className="col-status">
        <StatusPill status={status} />
      </td>
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(e.currentTarget.getBoundingClientRect());
          }}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button
            className="row-action-btn"
            aria-label="Copy code"
            title="Copy code"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard?.writeText(code.code);
            }}
          >
            <CopyIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="Delete"
            title="Delete offer code"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <RowDeleteIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMenu(e.currentTarget.getBoundingClientRect());
            }}
          >
            <RowKebabIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ───────────────── Row actions menu (fixed-positioned) ───────────────── */

function OfferCodeActionsMenu({
  code,
  rect,
  onClose,
  onExtend,
  onDelete,
}: {
  code: OfferCode;
  rect: DOMRect;
  onClose: () => void;
  onExtend: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const status = statusOf(code);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    /* Right-anchored to the trigger — the kebab is the action bar's last cell,
       so the open menu's right edge lines up with the bar's. */
    setPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item = (icon: JSX.Element, label: string, onPick: () => void, danger = false) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
      onClick={(e) => { e.stopPropagation(); onPick(); onClose(); }}
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
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{code.code}</div>
        <div className="u-menu-head-id">
          {code.id} · {status === "active" ? "Active" : "Expired"}
        </div>
      </div>
      {item(<CopyIcon />, "Copy Code", () => {
        navigator.clipboard?.writeText(code.code);
      })}
      {item(<CalendarIcon />, "Extend 6 Months", onExtend)}
      {item(<RowDeleteIcon />, "Delete Offer Code", onDelete, true)}
    </div>
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
  onCreate: (input: {
    code: string;
    plan: BillingPlan;
    regions: string[];
    expiresOn: string;
  }) => void;
}) {
  const [plan, setPlan] = useState<BillingPlan | null>(null);
  const [code, setCode] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [expiresOn, setExpiresOn] = useState(() => monthsOut(6));

  const duplicate = code.length > 0 && existingCodes.has(code);
  const codeValid = code.length >= 3 && !duplicate;
  const valid = plan !== null && codeValid && !!expiresOn;

  function submit() {
    if (!valid || plan === null) return;
    onCreate({ code, plan, regions, expiresOn });
  }

  return (
    <PrmModal
      title="Create Offer Code"
      description="Set up a subscription offer code. It will be created on Apple, Google, and Stripe."
      confirmLabel="Create Offer Code"
      confirmDisabled={!valid}
      onCancel={onClose}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            Subscription Plan<span className="prm-req">*</span>
          </span>
          {/* Neutral active state, like the New Company wizard's Billing Cycle —
              the `accent` variant is for values that read as a brand "on". */}
          <div className="seg-control">
            {(["monthly", "annual"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`seg-btn ${plan === p ? "active" : ""}`}
                onClick={() => setPlan(p)}
              >
                {PLAN_LABEL[p]}
              </button>
            ))}
          </div>
          <p className="form-help">
            {plan === "annual"
              ? "Discounts the yearly plan, billed once a year."
              : plan === "monthly"
              ? "Discounts the monthly plan, billed every month."
              : "Which subscription the code discounts at checkout."}
          </p>
        </div>

        <div className="prm-field">
          <span className="prm-label">
            Offer Code<span className="prm-req">*</span>
          </span>
          <input
            autoFocus
            className="form-input"
            placeholder="SUMMERPRO25"
            value={code}
            maxLength={24}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          {duplicate ? (
            <p className="form-help oc-error">
              That code already exists. Choose a different one.
            </p>
          ) : (
            <p className="form-help">
              Letters and numbers, automatically uppercased. Used by customers at checkout on
              all platforms.
            </p>
          )}
        </div>

        <div className="prm-field">
          <span className="prm-label">Countries/Regions</span>
          <MultiSelect
            options={REGION_BANK}
            value={regions}
            onChange={setRegions}
            placeholder="Select Countries/Regions"
            searchPlaceholder="Search Countries/Regions…"
            popupMenu
          />
          <p className="form-help">
            {regions.length === 0
              ? "Leave empty to make the code available in all regions."
              : `${regions.length} ${regions.length === 1 ? "region" : "regions"} selected.`}
          </p>
        </div>

        <div className="prm-field">
          <span className="prm-label">
            Expires On<span className="prm-req">*</span>
          </span>
          <DateField
            value={expiresOn}
            onChange={setExpiresOn}
            min={TODAY_ISO}
            placeholder="Select an expiry date"
            shortcuts={[
              { label: "3 months", value: monthsOut(3) },
              { label: "6 months", value: monthsOut(6) },
              { label: "1 year", value: monthsOut(12) },
            ]}
          />
          <p className="form-help">
            The code stops working on all three storefronts after this date.
          </p>
        </div>
      </div>
    </PrmModal>
  );
}
