import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  scholarships as seedScholarships,
  userBank,
  type Scholarship,
  type ScholarshipUser,
} from "../data/scholarships";
import { SearchIcon, SortIcon, AddIcon, RowDeleteIcon, RowKebabIcon, MenuPlaceholderIcon } from "./icons";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

const PAGE_SIZE = 25;
const TODAY = new Date("2026-05-15");

type ScholarshipStatus = "active" | "expired";

type SortKey = "user" | "status" | "expiresOn" | "assignedOn";
type SortDir = "asc" | "desc";

function statusOf(s: Scholarship): ScholarshipStatus {
  return new Date(s.expiresOn).getTime() >= TODAY.getTime() ? "active" : "expired";
}

function daysFromToday(iso: string): number {
  return Math.round(
    (new Date(iso).getTime() - TODAY.getTime()) / 86400000,
  );
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
  }
}

export function ScholarshipsPage() {
  const [list, setList] = useState<Scholarship[]>(seedScholarships);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ScholarshipStatus>("all");
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
      if (!q) return true;
      return (
        s.user.name.toLowerCase().includes(q) ||
        (s.user.email ?? "").toLowerCase().includes(q) ||
        (s.user.phone ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
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

  function handleAdd(user: ScholarshipUser, expiresOn: string) {
    const id = `SC-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const newScholarship: Scholarship = {
      id,
      user,
      assignedOn: "2026-05-15",
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
            <div>
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
                <table className="table sch-table" style={{ width: 820 }}>
                  <colgroup>
                    <col style={{ width: 280 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 40 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader
                        col="user"
                        label="User"
                        sort={sort}
                        toggle={toggleSort}
                      />
                      <SortableHeader
                        col="status"
                        label="Status"
                        sort={sort}
                        toggle={toggleSort}
                      />
                      <SortableHeader
                        col="expiresOn"
                        label="Expires On"
                        sort={sort}
                        toggle={toggleSort}
                      />
                      <SortableHeader
                        col="assignedOn"
                        label="Assigned On"
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
                        selected={menu?.scholarship.id === s.id}
                        onRevoke={() => handleRevoke(s.id)}
                        onOpenMenu={(rect) => setMenu({ scholarship: s, rect })}
                        menuOpen={menu?.scholarship.id === s.id}
                      />
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={5} className="sch-empty">
                          {query.trim()
                            ? `No scholarships match "${query.trim()}".`
                            : statusFilter === "expired"
                            ? "No expired scholarships."
                            : statusFilter === "active"
                            ? "No active scholarships."
                            : "No scholarships yet. Click \"Add Scholarship\" to assign one."}
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

function UserCell({ user }: { user: ScholarshipUser }) {
  const contact = user.email ?? user.phone ?? "";
  return (
    <div className="user-cell">
      <div className="user-cell-text">
        <div className="user-cell-name">{user.name}</div>
        <div className="user-cell-contact">{contact || "—"}</div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ScholarshipStatus }) {
  return (
    <span className={`sch-status sch-status--${status}`}>
      <span className="sch-status-dot" />
      {status === "active" ? "Active" : "Expired"}
    </span>
  );
}

function ScholarshipRow({
  scholarship,
  selected,
  onRevoke,
  onOpenMenu,
  menuOpen,
}: {
  scholarship: Scholarship;
  selected: boolean;
  onRevoke: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const status = statusOf(scholarship);
  const days = daysFromToday(scholarship.expiresOn);
  const expiringSoon = status === "active" && days >= 0 && days <= 14;

  return (
    <tr className={`${selected ? "selected" : ""} ${menuOpen ? "menu-open" : ""}`}>
      <td>
        <UserCell user={scholarship.user} />
      </td>
      <td>
        <StatusPill status={status} />
      </td>
      <td>
        <div className="sch-date">
          {formatDate(scholarship.expiresOn)}
          {expiringSoon && (
            <span className="sch-date-sub sch-date-sub--warning">
              {days === 0 ? "expires today" : `${days}d left`}
            </span>
          )}
          {status === "expired" && (
            <span className="sch-date-sub sch-date-sub--muted">
              expired {Math.abs(days)}d ago
            </span>
          )}
        </div>
      </td>
      <td>
        <div className="sch-date">
          {formatDate(scholarship.assignedOn)}
          <span className="sch-date-sub sch-date-sub--muted">
            by {scholarship.assignedBy}
          </span>
        </div>
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
      {item(<MenuPlaceholderIcon />, "Extend 6 months", onExtend)}
      {email &&
        item(<MenuPlaceholderIcon />, "Copy user email", () => {
          navigator.clipboard?.writeText(email);
        })}
      {item(<MenuPlaceholderIcon />, "Revoke scholarship", onRevoke, true)}
    </div>
  );
}

/* ───────────────── Add Scholarship modal ───────────────── */

function AddScholarshipModal({
  excludeUserIds,
  onClose,
  onAdd,
}: {
  excludeUserIds: Set<string>;
  onClose: () => void;
  onAdd: (user: ScholarshipUser, expiresOn: string) => void;
}) {
  const [userQuery, setUserQuery] = useState("");
  const [selected, setSelected] = useState<ScholarshipUser | null>(null);
  const [expiresOn, setExpiresOn] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Default expiry: today + 6 months
  useEffect(() => {
    const d = new Date(TODAY);
    d.setMonth(d.getMonth() + 6);
    setExpiresOn(d.toISOString().slice(0, 10));
  }, []);

  // Close picker on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const results = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return userBank
      .filter((u) => !excludeUserIds.has(u.id))
      .filter((u) =>
        q
          ? u.name.toLowerCase().includes(q) ||
            (u.email ?? "").toLowerCase().includes(q) ||
            (u.phone ?? "").toLowerCase().includes(q)
          : true,
      )
      .slice(0, 10);
  }, [userQuery, excludeUserIds]);

  const todayStr = TODAY.toISOString().slice(0, 10);
  const valid = selected && expiresOn && new Date(expiresOn) > TODAY;

  function submit() {
    if (!valid || !selected) return;
    onAdd(selected, expiresOn);
  }

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div
        className="cl-modal sch-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Add Scholarship</h3>
          <p className="cl-modal-sub">
            Select a user and choose how long their scholarship lasts. The user
            gets full Pro access until the expiry date.
          </p>
        </div>

        <div className="sch-modal-body">
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">
              User <span className="req">*</span>
            </label>

            {selected ? (
              <div className="sch-selected-user">
                <UserCell user={selected} />
                <button
                  className="sch-selected-clear"
                  aria-label="Change user"
                  onClick={() => {
                    setSelected(null);
                    setPickerOpen(true);
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="sch-user-picker" ref={wrapRef}>
                <div className="search-wrap" style={{ marginBottom: 0 }}>
                  <span className="search-icon">
                    <SearchIcon />
                  </span>
                  <input
                    autoFocus
                    className="search-input"
                    placeholder="Search by name, email, or phone…"
                    value={userQuery}
                    onChange={(e) => {
                      setUserQuery(e.target.value);
                      setPickerOpen(true);
                    }}
                    onFocus={() => setPickerOpen(true)}
                  />
                </div>
                {pickerOpen && (
                  <div className="sch-user-dropdown">
                    {results.length === 0 ? (
                      <div className="sch-user-empty">
                        {userQuery.trim()
                          ? `No users match "${userQuery.trim()}".`
                          : "No more eligible users."}
                      </div>
                    ) : (
                      results.map((u) => (
                        <button
                          key={u.id}
                          className="sch-user-option"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelected(u);
                            setPickerOpen(false);
                            setUserQuery("");
                          }}
                        >
                          <UserCell user={u} />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="form-help">
              Users with an active scholarship are hidden from this list.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Expires on <span className="req">*</span>
            </label>
            <input
              className="form-input sch-date-input"
              type="date"
              min={todayStr}
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
            />
            <div className="sch-quick-row">
              <span className="sch-quick-label">Quick set:</span>
              {[
                { label: "3 months", months: 3 },
                { label: "6 months", months: 6 },
                { label: "1 year", months: 12 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  className="sch-quick-btn"
                  onClick={() => {
                    const d = new Date(TODAY);
                    d.setMonth(d.getMonth() + opt.months);
                    setExpiresOn(d.toISOString().slice(0, 10));
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="form-help">
              Scholarship is automatically revoked after this date. The user
              keeps any awards they've already earned.
            </p>
          </div>
        </div>

        <div className="cl-modal-foot sch-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-publish sch-submit"
            disabled={!valid}
            onClick={submit}
          >
            Add Scholarship
          </button>
        </div>
      </div>
    </div>
  );
}
