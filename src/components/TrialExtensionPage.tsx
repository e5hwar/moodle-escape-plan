import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { userBank, type ScholarshipUser } from "../data/scholarships";
import { SearchIcon, SortIcon, EnterKeyIcon, AddIcon } from "./icons";

const PAGE_SIZE = 25;
const TODAY = new Date("2026-05-15");

type AccessStatus = "active" | "expired";
type SortKey = "user" | "status" | "expiresOn" | "grantedOn";
type SortDir = "asc" | "desc";

type AccessGrant = {
  id: string;
  user: ScholarshipUser;
  grantedOn: string;
  expiresOn: string;
  grantedBy: string;
  // Set when an admin uses "End Immediately" — forces the grant to expired
  // regardless of the expiry date.
  ended?: boolean;
};

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);

const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

const StopIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </svg>
);

const seedGrants: AccessGrant[] = [
  { id: "CA-1001", user: { id: "u-08", name: "Marcus Webb", email: "marcus.webb@gmail.com" }, grantedOn: "2026-04-01", expiresOn: "2026-06-30", grantedBy: "Priya S." },
  { id: "CA-1002", user: { id: "u-14", name: "Tanya Okafor", email: "tanya.ok@yahoo.com" }, grantedOn: "2026-03-15", expiresOn: "2026-05-01", grantedBy: "Deepak M." },
  { id: "CA-1003", user: { id: "u-22", name: "James Forrest", phone: "+1 (555) 204-8811" }, grantedOn: "2026-04-20", expiresOn: "2026-07-20", grantedBy: "You" },
  { id: "CA-1004", user: { id: "u-31", name: "Lin Nguyen", email: "lin.nguyen@techco.io" }, grantedOn: "2026-02-10", expiresOn: "2026-04-10", grantedBy: "Priya S." },
  { id: "CA-1005", user: { id: "u-45", name: "Destiny Alvarez", email: "destiny.a@outlook.com" }, grantedOn: "2026-05-01", expiresOn: "2026-08-01", grantedBy: "You" },
  { id: "CA-1006", user: { id: "u-53", name: "Ray Kowalski", email: "ray.k@skillsco.net" }, grantedOn: "2026-01-05", expiresOn: "2026-03-05", grantedBy: "Deepak M." },
  { id: "CA-1007", user: { id: "u-60", name: "Amara Diallo", email: "amara.diallo@corp.com" }, grantedOn: "2026-05-10", expiresOn: "2026-11-10", grantedBy: "You" },
];

function statusOf(g: AccessGrant): AccessStatus {
  if (g.ended) return "expired";
  return new Date(g.expiresOn).getTime() >= TODAY.getTime() ? "active" : "expired";
}

function daysFromToday(iso: string): number {
  return Math.round((new Date(iso).getTime() - TODAY.getTime()) / 86400000);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function compare(a: AccessGrant, b: AccessGrant, key: SortKey): number {
  switch (key) {
    case "user": return a.user.name.localeCompare(b.user.name);
    case "status": return statusOf(a).localeCompare(statusOf(b));
    case "expiresOn": return new Date(a.expiresOn).getTime() - new Date(b.expiresOn).getTime();
    case "grantedOn": return new Date(a.grantedOn).getTime() - new Date(b.grantedOn).getTime();
  }
}

export function TrialExtensionPage() {
  const [list, setList] = useState<AccessGrant[]>(seedGrants);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AccessStatus>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "grantedOn", dir: "desc" });
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AccessGrant | null>(null);
  const [menu, setMenu] = useState<{ grant: AccessGrant; rect: DOMRect } | null>(null);

  const counts = useMemo(() => {
    let active = 0, expired = 0;
    list.forEach((g) => (statusOf(g) === "active" ? active++ : expired++));
    return { active, expired };
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((g) => {
      if (statusFilter !== "all" && statusOf(g) !== statusFilter) return false;
      if (!q) return true;
      return (
        g.user.name.toLowerCase().includes(q) ||
        (g.user.email ?? "").toLowerCase().includes(q) ||
        (g.user.phone ?? "").toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q)
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
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function handleAdd(user: ScholarshipUser, expiresOn: string) {
    const id = `CA-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    setList((prev) => [{ id, user, grantedOn: "2026-05-15", expiresOn, grantedBy: "You" }, ...prev]);
    setAdding(false);
  }

  // End Immediately — force the grant to expired and stamp the expiry at the
  // current (app) date.
  function handleEnd(id: string) {
    const today = TODAY.toISOString().slice(0, 10);
    setList((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ended: true, expiresOn: today } : g)),
    );
  }

  function handleEditSave(id: string, expiresOn: string) {
    setList((prev) =>
      prev.map((g) =>
        g.id === id
          ? { ...g, expiresOn, ended: new Date(expiresOn).getTime() < TODAY.getTime() }
          : g,
      ),
    );
    setEditing(null);
  }

  const activeUserIds = useMemo(() => {
    const set = new Set<string>();
    list.forEach((g) => { if (statusOf(g) === "active") set.add(g.user.id); });
    return set;
  }, [list]);

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks sch-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Complimentary Access</h1>
              <div className="tasks-subtitle">
                <span>{counts.active} active</span>
                <span className="tasks-subtitle-dot" />
                <span>{counts.expired} expired</span>
                <span className="tasks-subtitle-dot" />
                <span>Grants full Pro access to a user for a set period at no charge</span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={() => setAdding(true)}>
                <AddIcon />
                Grant Access
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
                  placeholder="Search by name, email, or phone…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
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
                      <SortableHeader col="user" label="User" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="status" label="Status" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="expiresOn" label="Expires On" sort={sort} toggle={toggleSort} />
                      <SortableHeader col="grantedOn" label="Granted On" sort={sort} toggle={toggleSort} />
                      <th className="col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((g) => (
                      <AccessGrantRow
                        key={g.id}
                        grant={g}
                        onEdit={() => setEditing(g)}
                        onOpenMenu={(rect) => setMenu({ grant: g, rect })}
                      />
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={5} className="sch-empty">
                          {query.trim()
                            ? `No grants match "${query.trim()}".`
                            : statusFilter === "expired"
                            ? "No expired grants."
                            : statusFilter === "active"
                            ? "No active grants."
                            : "No grants yet. Click \"Grant Access\" to add one."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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

      {adding && (
        <GrantAccessModal
          excludeUserIds={activeUserIds}
          onClose={() => setAdding(false)}
          onAdd={handleAdd}
        />
      )}

      {editing && (
        <GrantAccessModal
          editGrant={editing}
          excludeUserIds={activeUserIds}
          onClose={() => setEditing(null)}
          onSave={handleEditSave}
        />
      )}

      {menu && (
        <GrantActionsMenu
          grant={menu.grant}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEdit={() => setEditing(menu.grant)}
          onEnd={() => handleEnd(menu.grant.id)}
        />
      )}
    </div>
  );
}

function SortableHeader({ col, label, sort, toggle, sortable = true }: { col: SortKey; label: string; sort: { key: SortKey; dir: SortDir }; toggle: (k: SortKey) => void; sortable?: boolean }) {
  if (!sortable) {
    return (
      <th className="no-sort">
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

function StatusPill({ status }: { status: AccessStatus }) {
  return (
    <span className={`sch-status sch-status--${status}`}>
      <span className="sch-status-dot" />
      {status === "active" ? "Active" : "Expired"}
    </span>
  );
}

function AccessGrantRow({
  grant,
  onEdit,
  onOpenMenu,
}: {
  grant: AccessGrant;
  onEdit: () => void;
  onOpenMenu: (rect: DOMRect) => void;
}) {
  const status = statusOf(grant);
  const days = daysFromToday(grant.expiresOn);
  const expiringSoon = status === "active" && days >= 0 && days <= 14;

  return (
    <tr>
      <td><UserCell user={grant.user} /></td>
      <td><StatusPill status={status} /></td>
      <td>
        <div className="sch-date">
          {formatDate(grant.expiresOn)}
          {expiringSoon && <span className="sch-date-sub sch-date-sub--warning">{days === 0 ? "expires today" : `${days}d left`}</span>}
          {status === "expired" && (
            <span className="sch-date-sub sch-date-sub--muted">
              {grant.ended ? "ended early" : `expired ${Math.abs(days)}d ago`}
            </span>
          )}
        </div>
      </td>
      <td>
        <div className="sch-date">
          {formatDate(grant.grantedOn)}
          <span className="sch-date-sub sch-date-sub--muted">by {grant.grantedBy}</span>
        </div>
      </td>
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
            title="Edit access"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <PencilIcon />
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

/* ─────────────── Row actions menu (fixed-positioned) ─────────────── */

function GrantActionsMenu({
  grant,
  rect,
  onClose,
  onEdit,
  onEnd,
}: {
  grant: AccessGrant;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onEnd: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const active = statusOf(grant) === "active";

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
        left: pos ? pos.left : rect.right - 210,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{grant.user.name}</div>
        <div className="u-menu-head-id">{grant.id}</div>
      </div>
      <div className="u-menu-divider" />
      {item(<PencilIcon />, "Edit", onEdit)}
      {active && (
        <>
          <div className="u-menu-divider" />
          {item(<StopIcon />, "End Immediately", onEnd, true)}
        </>
      )}
    </div>
  );
}

function GrantAccessModal({
  excludeUserIds,
  editGrant,
  onClose,
  onAdd,
  onSave,
}: {
  excludeUserIds: Set<string>;
  editGrant?: AccessGrant;
  onClose: () => void;
  onAdd?: (user: ScholarshipUser, expiresOn: string) => void;
  onSave?: (id: string, expiresOn: string) => void;
}) {
  const isEdit = !!editGrant;
  const [userQuery, setUserQuery] = useState("");
  const [selected, setSelected] = useState<ScholarshipUser | null>(editGrant?.user ?? null);
  const [expiresOn, setExpiresOn] = useState(editGrant?.expiresOn ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isEdit) return; // keep the grant's current expiry when editing
    const d = new Date(TODAY);
    d.setMonth(d.getMonth() + 1);
    setExpiresOn(d.toISOString().slice(0, 10));
  }, []);

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

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal sch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">{isEdit ? "Edit Complimentary Access" : "Grant Complimentary Access"}</h3>
          <p className="cl-modal-sub">
            {isEdit
              ? "Update the expiry date for this grant. Setting a future date re-activates expired access."
              : "Select a user and set an expiry date. The user gets full Pro access until that date at no charge."}
          </p>
          <div className="required-fields-note">* Required Fields</div>
        </div>

        <div className="sch-modal-body">
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">User <span className="req">*</span></label>
            {selected ? (
              <div className="sch-selected-user">
                <UserCell user={selected} />
                {!isEdit && (
                  <button className="sch-selected-clear" aria-label="Change user" onClick={() => { setSelected(null); setPickerOpen(true); }}>Change</button>
                )}
              </div>
            ) : (
              <div className="sch-user-picker" ref={wrapRef}>
                <div className="search-wrap" style={{ marginBottom: 0 }}>
                  <span className="search-icon"><SearchIcon /></span>
                  <input
                    autoFocus
                    className="search-input"
                    placeholder="Search by name, email, or phone…"
                    value={userQuery}
                    onChange={(e) => { setUserQuery(e.target.value); setPickerOpen(true); }}
                    onFocus={() => setPickerOpen(true)}
                  />
                </div>
                {pickerOpen && (
                  <div className="sch-user-dropdown">
                    {results.length === 0 ? (
                      <div className="sch-user-empty">
                        {userQuery.trim() ? `No users match "${userQuery.trim()}".` : "No more eligible users."}
                      </div>
                    ) : (
                      results.map((u) => (
                        <button key={u.id} className="sch-user-option" onMouseDown={(e) => { e.preventDefault(); setSelected(u); setPickerOpen(false); setUserQuery(""); }}>
                          <UserCell user={u} />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {!isEdit && <p className="form-help">Users with active complimentary access are hidden from this list.</p>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Expires on <span className="req">*</span></label>
            <input className="form-input sch-date-input" type="date" min={todayStr} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            <div className="sch-quick-row">
              <span className="sch-quick-label">Quick set:</span>
              {[{ label: "2 weeks", days: 14 }, { label: "1 month", months: 1 }, { label: "3 months", months: 3 }].map((opt) => (
                <button key={opt.label} className="sch-quick-btn" onClick={() => {
                  const d = new Date(TODAY);
                  if ("days" in opt) d.setDate(d.getDate() + opt.days!);
                  else d.setMonth(d.getMonth() + opt.months!);
                  setExpiresOn(d.toISOString().slice(0, 10));
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="form-help">Access is automatically revoked after this date.</p>
          </div>
        </div>

        <div className="cl-modal-foot sch-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>Cancel</button>
          <button
            className="btn-publish sch-submit"
            disabled={!valid}
            onClick={() => {
              if (!valid || !selected) return;
              if (isEdit && editGrant) onSave?.(editGrant.id, expiresOn);
              else onAdd?.(selected, expiresOn);
            }}
          >
            {isEdit ? "Save changes" : "Grant Access"}
          </button>
        </div>
      </div>
    </div>
  );
}
