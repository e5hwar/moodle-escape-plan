import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "../data/users";
import { SearchIcon, SearchClearIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

const MAX_RESULTS = 6;
const COMPANY_PREFIX = "COMPANY:";

function initialsOf(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

type Opt =
  | { kind: "company-filter" }
  | { kind: "user"; user: User }
  | { kind: "company"; name: string };

export function UsersSearch({
  users,
  companies: applied,
  onCompaniesChange,
  query,
  onCommit,
  onOpenProfile,
}: {
  users: User[];
  /** Company filter currently applied to the table (shared with the Filters row). */
  companies: string[];
  onCompaniesChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
  onOpenProfile: (u: User) => void;
}) {
  const [text, setText] = useState(query);
  // The search bar builds a *pending* search; nothing hits the table until Enter.
  // `draft` holds only companies picked in THIS search session (not yet applied).
  // On Enter they move into the applied filter (the Filters row pill) and clear here.
  const [draft, setDraft] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the bar showing the applied query when it changes from outside
  // (Clear Filters, a preset, the ✕ on another control).
  useEffect(() => setText(query), [query]);

  const allCompanies = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach((u) => {
      if (u.companyName) counts.set(u.companyName, (counts.get(u.companyName) ?? 0) + 1);
    });
    return { names: [...counts.keys()].sort(), counts };
  }, [users]);

  const scoped = draft.length > 0;
  const scopeLabel = draft.length === 1 ? draft[0] : `${draft.length} companies`;

  // "COMPANY:" prefix puts us in company-selection mode (case-insensitive).
  const companyMatch = text.match(/^\s*company:\s*(.*)$/i);
  const inCompanyMode = companyMatch != null;
  const companyQuery = companyMatch ? companyMatch[1] : "";
  const userQuery = inCompanyMode ? "" : text;

  const userResults = useMemo(() => {
    const base = scoped ? users.filter((u) => u.companyName && draft.includes(u.companyName)) : users;
    const q = userQuery.trim().toLowerCase();
    const matched = q
      ? base.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.phone.toLowerCase().includes(q),
        )
      : base;
    return matched.slice(0, MAX_RESULTS);
  }, [users, scoped, draft, userQuery]);

  const companyResults = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return allCompanies.names
      .filter((c) => !draft.includes(c) && !applied.includes(c) && c.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [allCompanies, companyQuery, draft, applied]);

  const showDefaultUsers = !inCompanyMode && (scoped || userQuery.trim().length > 0);

  const optionCount = inCompanyMode
    ? companyResults.length
    : 1 + (showDefaultUsers ? userResults.length : 0);

  function optionAt(i: number): Opt | null {
    if (inCompanyMode) return companyResults[i] ? { kind: "company", name: companyResults[i] } : null;
    if (i === 0) return { kind: "company-filter" };
    return userResults[i - 1] ? { kind: "user", user: userResults[i - 1] } : null;
  }

  useEffect(() => setActive(-1), [text, draft.length]);

  /* Abandon an uncommitted edit. The table only ever filters on the APPLIED
     query, so a bar left showing half-typed text would be lying about what the
     results are for — clicking away or pressing Escape puts the applied query
     (and no pending scope) back. */
  function revert() {
    setText(query);
    setDraft([]);
    setActive(-1);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) revert();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // `query`/drafts are deps so the handler always reverts to current state.
  }, [open, query, draft]);

  // Clear the applied search outright — no Enter needed.
  function clearSearch() {
    setText("");
    setDraft([]);
    setActive(-1);
    setOpen(false);
    onCommit("");
  }

  // Add a company to the pending scope (does NOT touch the table yet).
  function addCompany(name: string) {
    if (!draft.includes(name)) setDraft([...draft, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function activate(opt: Opt) {
    if (opt.kind === "company-filter") {
      setText(COMPANY_PREFIX);
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "company") {
      addCompany(opt.name);
    } else {
      onOpenProfile(opt.user);
      setOpen(false);
    }
  }

  // Enter — run the pending search against the table. Pending companies move into
  // the applied filter (the Filters row pill) and clear from the search bar.
  function commit() {
    onCompaniesChange(Array.from(new Set([...applied, ...draft])));
    onCommit(userQuery);
    setDraft([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(optionCount - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) {
        const opt = optionAt(active);
        if (opt) return activate(opt);
      }
      if (inCompanyMode) {
        if (companyResults[0]) return addCompany(companyResults[0]);
        return;
      }
      commit();
    } else if (e.key === "Escape") {
      revert();
    } else if (e.key === "Backspace" && text === "" && scoped) {
      setDraft(draft.slice(0, -1));
    }
  }

  const placeholder = scoped
    ? `Search within ${scopeLabel}…`
    : "Search users by name, email, or phone…";

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        {scoped && (
          <span className="usearch-scope">
            <span className="usearch-scope-label">Company:</span>
            <span className="usearch-scope-name">{scopeLabel}</span>
          </span>
        )}
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {/* Figma 399:216 "Search Bar - Applied": once there is something to
            clear, the ⌘K badge gives way to a ✕ that clears on click. */}
        {text || scoped || query ? (
          <button
            type="button"
            className="usearch-clear"
            aria-label="Clear search"
            title="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearSearch}
          >
            <SearchClearIcon />
          </button>
        ) : (
          <span className="usearch-kbd">
            <span className="kbd-cmd">⌘</span>
            <span className="kbd-letter">K</span>
          </span>
        )}
      </div>

      {open && (
        <div className="usearch-panel">
          {!inCompanyMode && (
            <>
              <div className="usearch-head">Suggested filters</div>
              <OptionRow active={active === 0} onHover={() => setActive(0)} onClick={() => activate({ kind: "company-filter" })}>
                <span className="usearch-chip">Company:</span>
                <span className="usearch-row-ex">Company: Acme Inc.</span>
                <span className="usearch-row-desc">Filter users by company</span>
              </OptionRow>

              {showDefaultUsers && (
                <div className="usearch-head">{scoped ? `Users in ${scopeLabel}` : "Users"}</div>
              )}
              {showDefaultUsers && userResults.length === 0 && (
                <div className="usearch-empty">
                  No matching users{scoped ? ` in ${scopeLabel}` : ""}
                  {userQuery.trim() ? ` for “${userQuery.trim()}”` : ""}.
                </div>
              )}
              {showDefaultUsers &&
                userResults.map((u, i) => (
                  <UserOption
                    key={u.id}
                    user={u}
                    active={active === i + 1}
                    onHover={() => setActive(i + 1)}
                    onClick={() => activate({ kind: "user", user: u })}
                  />
                ))}
            </>
          )}

          {inCompanyMode && (
            <>
              <div className="usearch-head">Companies</div>
              {companyResults.length === 0 ? (
                <div className="usearch-empty">
                  {companyQuery.trim() ? `No companies match “${companyQuery.trim()}”.` : "Start typing a company name…"}
                </div>
              ) : (
                companyResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "company", name })}>
                    <span className="usearch-chip">Company:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{allCompanies.counts.get(name)} users</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {userQuery.trim() ? (
            <SearchForRow query={userQuery.trim()} scope="Users" onClick={commit} />
          ) : (
            <SearchHints />
          )}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  active,
  onHover,
  onClick,
  children,
}: {
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`usearch-row ${active ? "active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function UserOption({
  user,
  active,
  onHover,
  onClick,
}: {
  user: User;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <button
      className={`usearch-row usearch-user ${active ? "active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <span className="usearch-avatar">{initialsOf(user.name)}</span>
      <span className="usearch-user-text">
        <span className="usearch-user-name">{user.name}</span>
        <span className="usearch-user-sub">
          {user.email} · {user.phone}
        </span>
      </span>
      <span className="usearch-row-desc">
        {user.userType === "B2B" && user.companyName ? user.companyName : "B2C"}
      </span>
    </button>
  );
}
