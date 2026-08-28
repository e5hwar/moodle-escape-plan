import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  scholarships as seedScholarships,
  userBank,
  type Scholarship,
  type ScholarshipUser,
} from "../data/scholarships";
import {
  KeyCommandIcon,
  SearchIcon,
  SortIcon,
  AddIcon,
  CalendarIcon,
  MenuMailIcon,
  RowDeleteIcon,
  RowKebabIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "./icons";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { PrmModal } from "./PrmModal";
import { SelectField } from "./SelectField";
import { DateField } from "./DateField";
import { UserDetailsHover } from "./UserDetailsHover";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

const PAGE_SIZE = 25;
const TODAY = new Date("2026-05-15");
const TODAY_ISO = TODAY.toISOString().slice(0, 10);
/** Inside this many days an active scholarship reads as "expiring soon". */
const EXPIRING_SOON_DAYS = 14;

type ScholarshipStatus = "active" | "expired";

type SortKey = "user" | "status" | "expiresOn" | "assignedOn" | "assignedBy";
type SortDir = "asc" | "desc";

function statusOf(s: Scholarship): ScholarshipStatus {
  return new Date(s.expiresOn).getTime() >= TODAY.getTime() ? "active" : "expired";
}

function daysFromToday(iso: string): number {
  return Math.round(
    (new Date(iso).getTime() - TODAY.getTime()) / 86400000,
  );
}

function contactOf(user: ScholarshipUser): string {
  return user.email ?? user.phone ?? "—";
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

/** Everyone who has handed out a scholarship — the Assigned By filter's options. */
const ASSIGNERS = [...new Set(seedScholarships.map((s) => s.assignedBy))].sort();

function compare(a: Scholarship, b: Scholarship, key: SortKey): number {
  switch (key) {
    case "user":
      return a.user.name.localeCompare(b.user.name);
    case "status":
      return statusOf(a).localeCompare(statusOf(b));
    case "expiresOn":
      return new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime();
    case "assignedOn":
      return new Date(a.assignedOn).getTime() - new Date(b.assignedOn).getTime();
    case "assignedBy":
      return a.assignedBy.localeCompare(b.assignedBy);
  }
}

export function ScholarshipsPage({ onBack }: { onBack?: () => void }) {
  const [list, setList] = useState<Scholarship[]>(seedScholarships);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ScholarshipStatus>("all");
  const [assignerFilter, setAssignerFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "assignedOn",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<{ scholarship: Scholarship; rect: DOMRect } | null>(null);
  useCreateShortcut(() => setAdding(true), !adding);

  const counts = useMemo(() => {
    let active = 0;
    let expired = 0;
    list.forEach((s) => (statusOf(s) === "active" ? active++ : expired++));
    return { active, expired };
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      if (statusFilter !== "all" && statusOf(s) !== statusFilter) return false;
      if (assignerFilter.length && !assignerFilter.includes(s.assignedBy)) return false;
      if (!q) return true;
      return (
        s.user.name.toLowerCase().includes(q) ||
        (s.user.email ?? "").toLowerCase().includes(q) ||
        (s.user.phone ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [list, query, statusFilter, assignerFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query, statusFilter, assignerFilter, sort]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const hasFilters = assignerFilter.length > 0;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function handleAdd(user: ScholarshipUser, expiresOn: string) {
    const id = `SC-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const newScholarship: Scholarship = {
      id,
      user,
      assignedOn: TODAY_ISO,
      expiresOn,
      assignedBy: "You",
    };
    setList((prev) => [newScholarship, ...prev]);
    setAdding(false);
  }

  function handleRevoke(id: string) {
    setList((prev) => prev.filter((s) => s.id !== id));
  }

  function handleExtend(id: string) {
    setList((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        // Extend 6 months from the later of today or the current expiry.
        const base = new Date(
          Math.max(new Date(s.expiresOn).getTime(), TODAY.getTime()),
        );
        base.setMonth(base.getMonth() + 6);
        return { ...s, expiresOn: base.toISOString().slice(0, 10) };
      }),
    );
  }

  // Users already with an *active* scholarship — excluded from the picker.
  const activeUserIds = useMemo(() => {
    const set = new Set<string>();
    list.forEach((s) => {
      if (statusOf(s) === "active") set.add(s.user.id);
    });
    return set;
  }, [list]);

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
                <span className="rvc-crumb rvc-crumb--current">Scholarships</span>
              </nav>
              <h1 className="tasks-title">Scholarship</h1>
              <div className="tasks-subtitle">
                <span>{counts.active} active</span>
                <span className="tasks-subtitle-dot" />
                <span>{counts.expired} expired</span>
                <span className="tasks-subtitle-dot" />
                <span>Scholarships unlock all SkillCat Pro content for the recipient until they expire</span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={() => setAdding(true)}>
                <AddIcon />
                Create Scholarship
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
                  placeholder="Search Scholarships by name, email, or phone…"
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

                {/* The shared filter pill (Filters.tsx) — same menu chrome as
                    Tasks / Certifications / Offer Codes. */}
                <Dropdown
                  width={260}
                  trigger={({ open, toggle }) => (
                    <PillTrigger
                      label="Assigned By"
                      value={summarize(assignerFilter, ASSIGNERS)}
                      open={open}
                      toggle={toggle}
                      onClear={() => setAssignerFilter([])}
                    />
                  )}
                >
                  {({ close }) => (
                    <SectionedMultiSelect
                      sections={[{ items: ASSIGNERS }]}
                      value={assignerFilter}
                      onApply={(v) => {
                        setAssignerFilter(v);
                        close();
                      }}
                      searchable
                      searchPlaceholder="Search assigners…"
                    />
                  )}
                </Dropdown>

                {hasFilters && (
                  <button
                    className="filter-clear-link"
                    onClick={() => setAssignerFilter([])}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="tasks-scroll">
                <table className="table sch-table" style={{ width: 1070 }}>
                  <colgroup>
                    <col style={{ width: 200 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 170 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 40 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader col="user" label="User" sort={sort} toggle={toggleSort} />
                      <SortableHeader
                        label="Contact"
                        sort={sort}
                        toggle={toggleSort}
                        sortable={false}
                      />
                      <SortableHeader
                        col="status"
                        label="Status"
                        className="col-status"
                        sort={sort}
                        toggle={toggleSort}
                      />
                      <SortableHeader col="expiresOn" label="Expires On" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="assignedOn" label="Assigned On" sort={sort} toggle={toggleSort} />
                      <SortableHeader
                        col="assignedBy"
                        label="Assigned By"
                        className="col-creator"
                        sort={sort}
                        toggle={toggleSort}
                      />
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((s) => (
                      <ScholarshipRow
                        key={s.id}
                        scholarship={s}
                        onRevoke={() => handleRevoke(s.id)}
                        onOpenMenu={(rect) => setMenu({ scholarship: s, rect })}
                        menuOpen={menu?.scholarship.id === s.id}
                      />
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={7} className="sch-empty">
                          {query.trim()
                            ? `No scholarships match "${query.trim()}".`
                            : hasFilters
                            ? "No scholarships match these filters."
                            : statusFilter === "expired"
                            ? "No expired scholarships."
                            : statusFilter === "active"
                            ? "No active scholarships."
                            : 'No scholarships yet. Click "Create Scholarship" to assign one.'}
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

      {adding && (
        <AddScholarshipModal
          excludeUserIds={activeUserIds}
          onClose={() => setAdding(false)}
          onAdd={handleAdd}
        />
      )}

      {menu && (
        <ScholarshipActionsMenu
          scholarship={menu.scholarship}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onExtend={() => handleExtend(menu.scholarship.id)}
          onRevoke={() => handleRevoke(menu.scholarship.id)}
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

/** The shared status pill (Figma 109:1237) — the same one Companies and Offer
 *  Codes use. An active scholarship inside the warning window borrows the
 *  yellow "ends soon" tone and says when, the way Companies' trial pill does. */
function StatusPill({ scholarship }: { scholarship: Scholarship }) {
  const status = statusOf(scholarship);
  const days = daysFromToday(scholarship.expiresOn);

  if (status === "expired") {
    return <span className="co-status-pill co-status-pill--grey">Expired</span>;
  }
  if (days <= EXPIRING_SOON_DAYS) {
    return (
      <span className="co-status-pill co-status-pill--yellow">
        {days === 0 ? "Expires Today" : `Expires in ${days} Days`}
      </span>
    );
  }
  return <span className="co-status-pill co-status-pill--green">Active</span>;
}

function ScholarshipRow({
  scholarship,
  onRevoke,
  onOpenMenu,
  menuOpen,
}: {
  scholarship: Scholarship;
  onRevoke: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const { user } = scholarship;

  return (
    <tr className={menuOpen ? "menu-open" : ""}>
      <td className="col-name">
        {/* The shared hover card (Figma 436:572), as on Proctoring and
            Companies. No userId — these recipients have no Manage Users
            record — so the card shows no open-profile button. */}
        <UserDetailsHover
          user={{ userName: user.name, email: user.email ?? "", phone: user.phone ?? "" }}
        >
          {user.name}
        </UserDetailsHover>
      </td>
      <td>{contactOf(user)}</td>
      <td className="col-status">
        <StatusPill scholarship={scholarship} />
      </td>
      <td className="col-date">{formatDate(scholarship.expiresOn)}</td>
      <td className="col-date">{formatDate(scholarship.assignedOn)}</td>
      <td className="col-creator">{scholarship.assignedBy}</td>
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
            aria-label="Revoke"
            title="Revoke scholarship"
            onClick={(e) => {
              e.stopPropagation();
              onRevoke();
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

function ScholarshipActionsMenu({
  scholarship,
  rect,
  onClose,
  onExtend,
  onRevoke,
}: {
  scholarship: Scholarship;
  rect: DOMRect;
  onClose: () => void;
  onExtend: () => void;
  onRevoke: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const status = statusOf(scholarship);
  const email = scholarship.user.email;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    /* Right-anchored to the trigger — the kebab is the action bar's last cell,
       so the open menu's right edge lines up with the bar's. Using `right`
       rather than (rect.right - measuredWidth) keeps that exact: the first-pass
       width measurement is unreliable, because the fallback `left` shrink-to-
       fits the menu against the viewport before it has been placed. */
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
        <div className="u-menu-head-name">{scholarship.user.name}</div>
        <div className="u-menu-head-id">
          {scholarship.id} · {status === "active" ? "Active" : "Expired"}
        </div>
      </div>
      {item(<CalendarIcon />, "Extend 6 Months", onExtend)}
      {email &&
        item(<MenuMailIcon />, "Copy User Email", () => {
          navigator.clipboard?.writeText(email);
        })}
      {item(<RowDeleteIcon />, "Revoke Scholarship", onRevoke, true)}
    </div>
  );
}

/* ───────────────── Create Scholarship modal ───────────────── */

function AddScholarshipModal({
  excludeUserIds,
  onClose,
  onAdd,
}: {
  excludeUserIds: Set<string>;
  onClose: () => void;
  onAdd: (user: ScholarshipUser, expiresOn: string) => void;
}) {
  const [selectedName, setSelectedName] = useState("");
  const [expiresOn, setExpiresOn] = useState(() => monthsOut(6));

  // SelectField works in display strings, so names are the option labels and
  // this maps the choice back to the record. Names in the bank are unique.
  const candidates = useMemo(
    () => userBank.filter((u) => !excludeUserIds.has(u.id)),
    [excludeUserIds],
  );
  const candidateNames = useMemo(() => candidates.map((u) => u.name), [candidates]);
  const selected = candidates.find((u) => u.name === selectedName) ?? null;

  const valid = !!selected && !!expiresOn && new Date(expiresOn) > TODAY;

  function submit() {
    if (!valid || !selected) return;
    onAdd(selected, expiresOn);
  }

  return (
    <PrmModal
      title="Create Scholarship"
      description="Select a user and choose how long their scholarship lasts. They get full Pro access until it expires."
      confirmLabel="Create Scholarship"
      confirmDisabled={!valid}
      onCancel={onClose}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            User<span className="prm-req">*</span>
          </span>
          <SelectField
            value={selectedName}
            options={candidateNames}
            onChange={setSelectedName}
            placeholder="Choose a user…"
            searchPlaceholder="Search Users..."
            popupMenu
            optionDetail={(name) =>
              candidates.find((u) => u.name === name)?.email ??
              candidates.find((u) => u.name === name)?.phone ??
              null
            }
          />
          <p className="form-help">
            Users with an active scholarship are hidden from this list.
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
            The scholarship is automatically revoked after this date. The user keeps any awards
            they've already earned.
          </p>
        </div>
      </div>
    </PrmModal>
  );
}
