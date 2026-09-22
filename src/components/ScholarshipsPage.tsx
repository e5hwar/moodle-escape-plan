import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  scholarships as seedScholarships,
  userBank,
  type Scholarship,
  type ScholarshipUser,
} from "../data/scholarships";
import {
  SearchIcon,
  SortIcon,
  AddIcon,
  InfoIcon14,
  RowEditIcon,
  RowDeleteIcon,
  RowKebabIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "./icons";
import { SearchTrailing } from "./SearchPanelParts";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { FILTER_TIPS } from "../data/filterTips";
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

/** The Status pill's options — the label each row's status reads as. */
const STATUS_OPTIONS = ["Active", "Expired"];

/* Every column carries a width, so a wide viewport hands the slack to all of
   them in proportion instead of leaving a gap on the right — the same
   fixed-layout arithmetic every other list table runs on. Their sum is the
   table's floor: below it the page scrolls horizontally. */
const COL_WIDTHS = {
  name: 200,
  email: 240,
  phone: 170,
  status: 170,
  date: 140,
  assignedBy: 160,
};
/** The kebab column, the same 40px reserve every other table uses. */
const ACTIONS_WIDTH = 40;
const TABLE_MIN =
  COL_WIDTHS.name +
  COL_WIDTHS.email +
  COL_WIDTHS.phone +
  COL_WIDTHS.status +
  COL_WIDTHS.date * 2 +
  COL_WIDTHS.assignedBy +
  ACTIONS_WIDTH;

/** What the ⓘ beside the page subtext says — the detail the one-liner leaves out. */
const SCHOLARSHIP_TIP =
  "A scholarship gives one user free Pro access — every course, quiz and certification — from the day it is assigned until it expires. Access ends automatically on the expiry date, and the awards they have already earned are kept. Revoking one ends it immediately.";

type SortKey = "user" | "status" | "expiresOn" | "assignedOn" | "assignedBy";
type SortDir = "asc" | "desc";

/* A scholarship still running today counts as active — "Expires Today" is a
   real state the pill draws. Revoking is the exception: it ends access now, so
   `revokedOn` reads expired on the same day `expiresOn` does. */
function statusOf(s: Scholarship): ScholarshipStatus {
  if (s.revokedOn) return "expired";
  return new Date(s.expiresOn).getTime() >= TODAY.getTime() ? "active" : "expired";
}

/** The Status column's (and filter's) label for a row. */
function statusLabel(s: Scholarship): string {
  return statusOf(s) === "active" ? "Active" : "Expired";
}

function daysFromToday(iso: string): number {
  return Math.round(
    (new Date(iso).getTime() - TODAY.getTime()) / 86400000,
  );
}

/* Empty cells read as an em dash, the app's standing empty-cell convention —
   not every recipient has both an email and a phone on file. CopyCells treats
   "—" as no value, so a dashed cell stays inert instead of copying a dash. */
function orDash(value: string | undefined): string {
  return value ? value : "—";
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
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assignerFilter, setAssignerFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "assignedOn",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Scholarship | null>(null);
  const [menu, setMenu] = useState<{ scholarship: Scholarship; rect: DOMRect } | null>(null);
  useCreateShortcut(() => setAdding(true), !adding);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      if (statusFilter.length && !statusFilter.includes(statusLabel(s))) return false;
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

  const hasFilters = statusFilter.length > 0 || assignerFilter.length > 0;

  function clearFilters() {
    setStatusFilter([]);
    setAssignerFilter([]);
  }

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

  /* Revoking does NOT delete the row — the scholarship is part of the user's
     history. It expires as of today, so it reads Expired and stops counting
     against the create picker's "already has an active one" exclusion. */
  function handleRevoke(id: string) {
    setList((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, expiresOn: TODAY_ISO, revokedOn: TODAY_ISO } : s,
      ),
    );
  }

  /** Edit is the expiry date — the recipient is what a scholarship IS, so
      changing that would be a different scholarship (revoke and create one). */
  function handleEdit(id: string, expiresOn: string) {
    setList((prev) => prev.map((s) => (s.id === id ? { ...s, expiresOn } : s)));
    setEditing(null);
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
              {/* Subtext + the shared tooltip glyph — the one-liner says what a
                  scholarship is, the ⓘ carries how it starts, ends and is revoked. */}
              <div className="tasks-subtitle">
                <span>
                  Scholarships unlock all SkillCat Pro content for the recipient until they expire
                </span>
                <span
                  className="form-help-info tasks-subtitle-info"
                  tabIndex={0}
                  role="note"
                  aria-label={SCHOLARSHIP_TIP}
                  data-tip={SCHOLARSHIP_TIP}
                >
                  <InfoIcon14 />
                </span>
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
                  placeholder="Search Users by Name, Email, or Phone..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <SearchTrailing active={!!query} onClear={() => setQuery("")} />
              </div>

              <div className="filters">
                {/* The shared filter pills (Filters.tsx) — same menu chrome as
                    Tasks / Certifications / Companies / Offer Codes. */}
                <Dropdown
                  width={220}
                  trigger={({ open, toggle }) => (
                    <PillTrigger
                      label="Status"
                      tip={FILTER_TIPS.scholarships.status}
                      value={summarize(statusFilter, STATUS_OPTIONS)}
                      open={open}
                      toggle={toggle}
                      onClear={() => setStatusFilter([])}
                    />
                  )}
                >
                  {({ close }) => (
                    <SectionedMultiSelect
                      sections={[{ items: STATUS_OPTIONS }]}
                      value={statusFilter}
                      onApply={(v) => {
                        setStatusFilter(v);
                        close();
                      }}
                    />
                  )}
                </Dropdown>

                <Dropdown
                  width={260}
                  trigger={({ open, toggle }) => (
                    <PillTrigger
                      label="Assigned By"
                      tip={FILTER_TIPS.scholarships.assignedBy}
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
                      searchPlaceholder="Search Assigners..."
                    />
                  )}
                </Dropdown>

                {hasFilters && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>

              {/* The table fills the row and only scrolls sideways below the
                  sum of its column widths — the shared `--table-min` machinery,
                  so no slack is left on the right. */}
              <div
                className="table-xscroll"
                style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}
              >
              <div className="tasks-scroll">
                <table className="table sch-table">
                  <colgroup>
                    <col style={{ width: COL_WIDTHS.name }} />
                    <col style={{ width: COL_WIDTHS.email }} />
                    <col style={{ width: COL_WIDTHS.phone }} />
                    <col style={{ width: COL_WIDTHS.status }} />
                    <col style={{ width: COL_WIDTHS.date }} />
                    <col style={{ width: COL_WIDTHS.date }} />
                    <col style={{ width: COL_WIDTHS.assignedBy }} />
                    <col style={{ width: ACTIONS_WIDTH }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader col="user" label="Name" sort={sort} toggle={toggleSort} />
                      <SortableHeader
                        label="Email"
                        className="col-u-email"
                        sort={sort}
                        toggle={toggleSort}
                        sortable={false}
                      />
                      <SortableHeader
                        label="Phone"
                        className="col-u-phone"
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
                        onOpenMenu={(rect) => setMenu({ scholarship: s, rect })}
                        menuOpen={menu?.scholarship.id === s.id}
                      />
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={8} className="sch-empty">
                          {query.trim()
                            ? `No scholarships match "${query.trim()}".`
                            : hasFilters
                            ? "No scholarships match these filters."
                            : 'No scholarships yet. Click "Create Scholarship" to assign one.'}
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
        <ScholarshipModal
          excludeUserIds={activeUserIds}
          onClose={() => setAdding(false)}
          onSubmit={handleAdd}
        />
      )}

      {editing && (
        <ScholarshipModal
          scholarship={editing}
          excludeUserIds={activeUserIds}
          onClose={() => setEditing(null)}
          onSubmit={(_user, expiresOn) => handleEdit(editing.id, expiresOn)}
        />
      )}

      {menu && (
        <ScholarshipActionsMenu
          scholarship={menu.scholarship}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEdit={() => setEditing(menu.scholarship)}
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
    return (
      <span
        className="co-status-pill co-status-pill--grey"
        data-tip={
          scholarship.revokedOn
            ? `Revoked on ${formatDate(scholarship.revokedOn)}`
            : undefined
        }
      >
        Expired
      </span>
    );
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
  onOpenMenu,
  menuOpen,
}: {
  scholarship: Scholarship;
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
      {/* Click-to-copy opt-in (CopyCells.tsx), as on Who Paid, Quiz Attempts
          and Exam Reviews — the values admins paste elsewhere. */}
      <td className="col-u-email" data-copyable>{orDash(user.email)}</td>
      <td className="col-u-phone" data-copyable>{orDash(user.phone)}</td>
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
  onEdit,
  onRevoke,
}: {
  scholarship: Scholarship;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onRevoke: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const canRevoke = statusOf(scholarship) === "active";

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
      className="u-menu sch-row-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {item(<RowEditIcon />, "Edit", onEdit)}
      {/* Nothing left to revoke once it has expired — the row stays, disabled
          with its reason, the way a blocked Delete does everywhere else. */}
      <button
        className="u-menu-item u-menu-item--danger"
        disabled={!canRevoke}
        onClick={(e) => {
          e.stopPropagation();
          if (!canRevoke) return;
          onRevoke();
          onClose();
        }}
      >
        <span className="u-menu-item-icon"><RowDeleteIcon /></span>
        <span className="u-menu-item-text">
          <span>Revoke</span>
          {!canRevoke && (
            <span className="u-menu-item-sub">
              This scholarship has already expired
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

/* ───────────────── Create / Edit Scholarship modal ───────────────── */

/* One modal for both. Editing only ever means the expiry date — the recipient
   is what a scholarship IS, so the User field is locked to them rather than
   offered as a swap; moving one to someone else is a revoke plus a create. */
function ScholarshipModal({
  scholarship,
  excludeUserIds,
  onClose,
  onSubmit,
}: {
  /** Set when editing an existing scholarship; omitted when creating one. */
  scholarship?: Scholarship;
  excludeUserIds: Set<string>;
  onClose: () => void;
  onSubmit: (user: ScholarshipUser, expiresOn: string) => void;
}) {
  const editing = !!scholarship;
  const [selectedName, setSelectedName] = useState(scholarship?.user.name ?? "");
  const [expiresOn, setExpiresOn] = useState(
    () => scholarship?.expiresOn ?? monthsOut(6),
  );

  // SelectField works in display strings, so names are the option labels and
  // this maps the choice back to the record. Names in the bank are unique.
  const candidates = useMemo(
    () =>
      scholarship
        ? [scholarship.user]
        : userBank.filter((u) => !excludeUserIds.has(u.id)),
    [scholarship, excludeUserIds],
  );
  const candidateNames = useMemo(() => candidates.map((u) => u.name), [candidates]);
  const selected = candidates.find((u) => u.name === selectedName) ?? null;

  /* A future date either way: an expired scholarship is edited to bring it
     back, so "unchanged" leaves the CTA disabled rather than saving a no-op. */
  const dateIsFuture = !!expiresOn && new Date(expiresOn) > TODAY;
  const valid =
    !!selected && dateIsFuture && (!editing || expiresOn !== scholarship.expiresOn);

  function submit() {
    if (!valid || !selected) return;
    onSubmit(selected, expiresOn);
  }

  return (
    <PrmModal
      title={editing ? "Edit Scholarship" : "Create Scholarship"}
      description={
        editing
          ? "Change when this scholarship expires. The recipient keeps full Pro access until then."
          : "Select a user and choose how long their scholarship lasts. They get full Pro access until it expires."
      }
      confirmLabel={editing ? "Save Changes" : "Create Scholarship"}
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
            disabled={editing}
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
            {editing
              ? "A scholarship can't move to another user — revoke this one and create a new one."
              : "Users with an active scholarship are hidden from this list."}
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
