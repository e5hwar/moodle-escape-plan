import { useEffect, useMemo, useState } from "react";
import { mergeUsers, userTypeOf, type MergeUser } from "../data/mergeAccounts";
import { PrmModal } from "./PrmModal";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  SortIcon,
} from "./icons";

/* Select Users — the Merge Accounts twin of SelectTasksModal (Figma 682:2321).
 * Clicking either account field on step 1 opens this table picker: search bar,
 * four filter pills, a table and pagination inside the shared PrmModal shell,
 * with Cancel / Continue in the modal's own footer.
 *
 * It picks BOTH accounts in one pass — the first tick is the account to keep,
 * the second the account to delete — which is why the cap is two and why the
 * subtitle points at the Swap roles control rather than asking for an order.
 *
 * Every visual part is borrowed, including the `.stm-*` geometry the Select
 * Tasks modal introduced; only the column widths here are new. Selection is
 * staged: the modal owns `picked` and only hands it back on Continue.
 */

const PAGE_SIZE = 50;

/** The most accounts a merge can involve. */
const MAX_PICKED = 2;

const USER_TYPES = ["B2C", "B2B"];
const SUBSCRIPTIONS = ["Starter", "Subscriber", "Scholarship", "Free Trial"];
const ROLES = ["Self-Learner", "Employee", "Manager", "Admin"];

type SortKey = "name" | "email" | "company" | "role" | "subscription";
type SortDir = "asc" | "desc";

function companyOf(u: MergeUser) {
  return u.company ?? "";
}

function compare(a: MergeUser, b: MergeUser, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name) || a.email.localeCompare(b.email);
    case "email":
      return a.email.localeCompare(b.email);
    case "company":
      return companyOf(a).localeCompare(companyOf(b));
    case "role":
      return a.role.localeCompare(b.role);
    case "subscription":
      return a.subscription.localeCompare(b.subscription);
  }
}

export function SelectUsersModal({
  value,
  onCancel,
  onConfirm,
}: {
  /** Account ids already on the fields, keep first — the modal opens pre-ticked
   *  and preserves that order. */
  value: string[];
  onCancel: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(value.slice(0, MAX_PICKED));
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const allCompanies = useMemo(
    () =>
      Array.from(
        new Set(mergeUsers.map((u) => u.company).filter((c): c is string => !!c)),
      ).sort(),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mergeUsers.filter((u) => {
      if (
        q &&
        !(
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
        )
      )
        return false;
      if (types.length && !types.includes(userTypeOf(u))) return false;
      if (subs.length && !subs.includes(u.subscription)) return false;
      if (companies.length && !(u.company && companies.includes(u.company))) return false;
      if (roles.length && !roles.includes(u.role)) return false;
      return true;
    });
  }, [query, types, subs, companies, roles]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const rows = sorted.slice(start, start + PAGE_SIZE);

  const full = picked.length >= MAX_PICKED;

  /** Order is meaning here: picked[0] is kept, picked[1] is deleted. Ticking a
   *  third account is refused rather than silently evicting one of the two. */
  function toggle(id: string) {
    setPicked((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= MAX_PICKED) return p;
      return [...p, id];
    });
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  /** Any filter change can shrink the list under the current page. */
  function resetPage<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  return (
    <PrmModal
      title="Select Users"
      description="You can select both users here. The one which is kept and removed can be swapped later."
      confirmLabel="Continue"
      confirmDisabled={picked.length === 0}
      pick
      onCancel={onCancel}
      onConfirm={() => onConfirm(picked)}
    >
      <div className="stm">
        <div className="stm-toolbar">
          <div className="search-wrap stm-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input stm-search-input"
              placeholder="Search Users"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="filters stm-filters">
            <Dropdown
              width={200}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="User Type"
                  value={summarize(types, USER_TYPES)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setTypes)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: USER_TYPES }]}
                  value={types}
                  onApply={(v) => {
                    resetPage(setTypes)(v);
                    close();
                  }}
                />
              )}
            </Dropdown>

            <Dropdown
              width={220}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Subscription"
                  value={summarize(subs, SUBSCRIPTIONS)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setSubs)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: SUBSCRIPTIONS }]}
                  value={subs}
                  onApply={(v) => {
                    resetPage(setSubs)(v);
                    close();
                  }}
                />
              )}
            </Dropdown>

            <Dropdown
              width={260}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Company"
                  value={summarize(companies, allCompanies)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setCompanies)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: allCompanies }]}
                  value={companies}
                  onApply={(v) => {
                    resetPage(setCompanies)(v);
                    close();
                  }}
                />
              )}
            </Dropdown>

            <Dropdown
              width={220}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Role"
                  value={summarize(roles, ROLES)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setRoles)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: ROLES }]}
                  value={roles}
                  onApply={(v) => {
                    resetPage(setRoles)(v);
                    close();
                  }}
                />
              )}
            </Dropdown>
          </div>
        </div>

        <div className="stm-table-wrap">
          {/* Column-width floor, per the shared table convention — below it the
              table scrolls sideways instead of crushing the cells. 44 check +
              180 name + 210 email + 170 company + 110 role + 120 plan. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": "834px" } as React.CSSProperties}
          >
            <table className="table table-head stm-table sum-table">
              <ColGroup />
              <thead>
                <tr>
                  {/* Spacer only — there is no select-all when the cap is two. */}
                  <th className="stm-col-check no-sort" />
                  <Th col="name" label="User Name" cls="sum-col-name" sort={sort} toggle={toggleSort} />
                  <Th col="email" label="Email" cls="sum-col-email" sort={sort} toggle={toggleSort} />
                  <Th col="company" label="Company" cls="sum-col-company" sort={sort} toggle={toggleSort} />
                  <Th col="role" label="Role" cls="sum-col-role" sort={sort} toggle={toggleSort} />
                  <Th col="subscription" label="Subscription" cls="sum-col-plan" sort={sort} toggle={toggleSort} />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table sum-table">
                <ColGroup />
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="stm-empty-row">
                      <td colSpan={6}>No accounts match your search and filters.</td>
                    </tr>
                  ) : (
                    rows.map((u) => {
                      const on = picked.includes(u.id);
                      const locked = full && !on;
                      return (
                        <tr
                          key={u.id}
                          className={`${on ? "selected" : ""}${locked ? " is-locked" : ""}`}
                          onClick={() => toggle(u.id)}
                        >
                          <td className="stm-col-check">
                            {/* A <button>, not a <span> — the shared table reset
                                strips chrome from span/div in data cells, which
                                would leave a bare tick with no box. */}
                            <button
                              className={`checkbox ${on ? "checked" : ""}`}
                              aria-label={on ? "Deselect" : "Select"}
                              aria-pressed={on}
                              disabled={locked}
                              tabIndex={-1}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(u.id);
                              }}
                            >
                              {on && <CheckIcon />}
                            </button>
                          </td>
                          {/* `col-name` carries the #FFFFFF emphasis and is one
                              of the classes the app-wide "mute every non-Name
                              cell" rule excludes — a local colour would lose to
                              it on specificity. */}
                          <td className="sum-col-name col-name">{u.name}</td>
                          <td className="sum-col-email">{u.email}</td>
                          <td className="sum-col-company">{u.company ?? "—"}</td>
                          <td className="sum-col-role">{u.role}</td>
                          <td className="sum-col-plan">{u.subscription}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pagination stm-pagination">
            <span className="sum-picked">
              {picked.length} of {MAX_PICKED} accounts selected
            </span>
            <span>
              Showing {sorted.length === 0 ? 0 : start + 1} -{" "}
              {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={visiblePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeftIcon />
              </button>
              <button
                className="page-btn"
                disabled={visiblePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PrmModal>
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: 44 }} />
      <col />
      <col style={{ width: 210 }} />
      <col style={{ width: 170 }} />
      <col style={{ width: 110 }} />
      <col style={{ width: 120 }} />
    </colgroup>
  );
}

function Th({
  col,
  label,
  cls,
  sort,
  toggle,
}: {
  col: SortKey;
  label: string;
  cls: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className={cls} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
