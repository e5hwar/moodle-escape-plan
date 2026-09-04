import { useEffect, useMemo, useState } from "react";
import type { User } from "../data/users";
import { PrmModal } from "./PrmModal";
import { Dropdown } from "./Dropdown";
import { Stepper } from "./Stepper";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { EntitySearch, type SearchScope } from "./UsersSearch";
import {
  CheckIcon,
  DropdownCaretIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SmallXIcon,
  SortIcon,
} from "./icons";

/* Grant Free Attempts — the Who Paid page's comp flow.
 *
 * The page's button opens the PICKER first — picking who to comp is the first
 * thing the admin does — and Continue lands on the FORM (a plain PrmModal laid
 * out like Create Scholarship: a `.prm-stack` of label / control / subtext
 * rows). The form's first field is the shared dropdown field holding those
 * users as tags; clicking it opens the picker again, pre-ticked, exactly as
 * the Skill wizard's "Awarding Tasks" field re-opens Select Tasks.
 *
 * Cancel on the picker means two different things by design: on the FIRST pass
 * nothing has been set up yet, so it closes the whole flow; once the form has
 * been reached it just goes back to it, selection untouched.
 *
 * The picker itself is the shared table picker (Figma 682:2321, the `.stm-*`
 * chrome Select Tasks / Select Users / Select Questions all run on): search,
 * filter pills, table, pagination inside PrmModal's `pick` shell. It is
 * uncapped — one grant can comp any number of users — so it carries a
 * select-all in the header and counts what's ticked in the pagination row.
 *
 * Its search bar is the page-level one, not a plain input: the same
 * `EntitySearch` combobox the Users page uses, ⌘K badge, `Company:` suggested
 * filter and commit-on-Enter included. That is why the picker filters on a
 * COMMITTED query and why Escape inside the bar reverts the bar rather than
 * closing the modal (App.tsx scopes ⌘K to the topmost open modal for the same
 * reason).
 *
 * Selection is staged the way the other pickers stage theirs — the picker owns
 * its own `picked` and only hands it back on Continue; the form owns the users
 * from then on, and nothing reaches the page until Grant Attempts. */

const PAGE_SIZE = 50;

/** The most free attempts one grant can hand a single user. */
const MAX_GRANT = 10;

/** Named tags the Users field shows before it collapses the rest into "+N".
 *  Two, not the Skill wizard's three: the field is 470px inside the modal and
 *  a third name pushed the "+N" past the caret, where the field clips it. */
const TAG_LIMIT = 2;

const USER_TYPES = ["B2C", "B2B"];
const SUBSCRIPTIONS = ["Starter", "Subscriber", "Scholarship", "Free Trial"];
const ROLES = ["Self-Learner", "Employee", "Manager", "Admin"];

type SortKey =
  | "name"
  | "email"
  | "company"
  | "role"
  | "subscription"
  | "attempts";
type SortDir = "asc" | "desc";

function companyOf(u: User) {
  return u.userType === "B2B" && u.companyName ? u.companyName : "";
}

export function GrantAttemptsModal({
  quizName,
  candidates,
  attemptsOf,
  onGrant,
  onClose,
}: {
  /** The Quiz being comped — every grant lands on this one Quiz. */
  quizName: string;
  candidates: User[];
  /** Attempts the user already has on this Quiz, paid or comped. */
  attemptsOf: (userId: string) => number;
  onGrant: (users: User[], count: number) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  // The flow opens ON the picker; the form appears behind it after Continue.
  const [picking, setPicking] = useState(true);
  const [reachedForm, setReachedForm] = useState(false);
  const [count, setCount] = useState("1");

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  // While the picker is up it owns the key — this is the modal underneath.
  useEffect(() => {
    if (picking) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, picking]);

  const chosen = useMemo(() => {
    const byId = new Map(candidates.map((u) => [u.id, u] as const));
    return picked.map((id) => byId.get(id)).filter((u): u is User => !!u);
  }, [candidates, picked]);

  const n = parseInt(count, 10);
  const clamped = Number.isFinite(n) ? Math.min(MAX_GRANT, Math.max(1, n)) : 0;
  const valid = chosen.length > 0 && clamped > 0;

  return (
    <>
      {reachedForm && (
      <PrmModal
        title="Grant Free Attempts"
        description={`Comp attempts on “${quizName}”. The users you pick get them at no charge, logged as an admin grant.`}
        confirmLabel="Grant Attempts"
        confirmDisabled={!valid}
        onCancel={onClose}
        onConfirm={() => valid && onGrant(chosen, clamped)}
      >
        <div className="prm-stack">
          <div className="prm-field">
            <span className="prm-label">
              Users<span className="prm-req">*</span>
            </span>
            {/* The shared dropdown field. It never opens a menu — the empty
                space (and the caret) opens the picker, the same contract the
                Skill wizard's Awarding Tasks field has with Select Tasks. */}
            <div className="multiselect">
              <div className="multiselect-field" onClick={() => setPicking(true)}>
                {chosen.length === 0 ? (
                  <span className="multiselect-placeholder">Select Users</span>
                ) : (
                  <div className="multiselect-tags">
                    {chosen.slice(0, TAG_LIMIT).map((u) => (
                      <span key={u.id} className="multiselect-tag">
                        {u.name}
                        <button
                          className="multiselect-tag-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPicked((p) => p.filter((x) => x !== u.id));
                          }}
                          aria-label={`Remove ${u.name}`}
                        >
                          <SmallXIcon />
                        </button>
                      </span>
                    ))}
                    {chosen.length > TAG_LIMIT && (
                      <span className="multiselect-tag multiselect-tag-more">
                        +{chosen.length - TAG_LIMIT}
                      </span>
                    )}
                  </div>
                )}
                <span className="field-chevron">
                  <DropdownCaretIcon />
                </span>
              </div>
            </div>
            <p className="form-help">
              {chosen.length === 0
                ? "Pick one or more users to comp."
                : `${chosen.length} ${chosen.length === 1 ? "user" : "users"} selected.`}{" "}
              Every one of them receives the same grant.
            </p>
          </div>

          <div className="prm-field">
            <span className="prm-label">
              Free Attempts per User<span className="prm-req">*</span>
            </span>
            <Stepper
              value={count}
              onChange={setCount}
              min={1}
              max={MAX_GRANT}
              ariaLabel="Free attempts per user"
            />
            <p className="form-help">
              Up to {MAX_GRANT} per grant. Each attempt is added on top of the
              ones the user already has and starts in <em>Not Started</em>.
            </p>
          </div>
        </div>
      </PrmModal>
      )}

      {picking && (
        <SelectGrantUsersModal
          quizName={quizName}
          candidates={candidates}
          attemptsOf={attemptsOf}
          value={picked}
          onCancel={() => (reachedForm ? setPicking(false) : onClose())}
          onConfirm={(ids) => {
            setPicked(ids);
            setReachedForm(true);
            setPicking(false);
          }}
        />
      )}
    </>
  );
}

/* ─────────── The picker (Figma 682:2321, `.stm-*` chrome) ─────────── */

function SelectGrantUsersModal({
  quizName,
  candidates,
  attemptsOf,
  value,
  onCancel,
  onConfirm,
}: {
  quizName: string;
  candidates: User[];
  attemptsOf: (userId: string) => number;
  /** Users already on the field — the picker opens pre-ticked. */
  value: string[];
  onCancel: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [committedQuery, setCommittedQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(value);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });

  // Escape closes the picker, except inside the search bar, where it is the
  // bar's own "abandon this edit" and must not take the modal with it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if ((e.target as Element | null)?.closest?.(".usearch")) return;
      onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  /* Company names + how many candidates each has — the pill's options and the
     search bar's `Company:` scope share both. */
  const companyOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of candidates) {
      const c = companyOf(u);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return { names: [...counts.keys()].sort(), counts };
  }, [candidates]);
  const allCompanies = companyOptions.names;

  /* One scope, exactly as on the Users page: picking a company in the bar is a
     pending draft until Enter, which moves it into the Company pill below. */
  const scopes: SearchScope[] = [
    {
      token: "Company",
      options: companyOptions.names,
      applied: companies,
      onAppliedChange: (v) => {
        setCompanies(v);
        setPage(1);
      },
      optionsLabel: "Companies",
      example: "Company: Acme Inc.",
      hint: "Filter by Company",
      describe: (name) => `${companyOptions.counts.get(name)} users`,
    },
  ];

  const filtered = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    return candidates.filter((u) => {
      if (
        q &&
        !(
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
        )
      )
        return false;
      if (types.length && !types.includes(u.userType)) return false;
      if (subs.length && !subs.includes(u.subscriptionStatus)) return false;
      if (roles.length && !roles.includes(u.role)) return false;
      if (companies.length && !companies.includes(companyOf(u))) return false;
      return true;
    });
  }, [candidates, committedQuery, types, subs, roles, companies]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name);
        case "email":
          return a.email.localeCompare(b.email);
        case "company":
          return companyOf(a).localeCompare(companyOf(b));
        case "role":
          return a.role.localeCompare(b.role);
        case "subscription":
          return a.subscriptionStatus.localeCompare(b.subscriptionStatus);
        case "attempts":
          return attemptsOf(a.id) - attemptsOf(b.id);
      }
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort, attemptsOf]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const rows = sorted.slice(start, start + PAGE_SIZE);

  /* Select-all covers everything the search and filters currently match, not
     just the visible page — filtering down to a company and ticking the header
     is the fast path this modal exists for. */
  const pickedSet = new Set(picked);
  const matchCount = sorted.filter((u) => pickedSet.has(u.id)).length;
  const allOn = sorted.length > 0 && matchCount === sorted.length;
  const someOn = matchCount > 0 && !allOn;

  function toggleAll() {
    const ids = new Set(sorted.map((u) => u.id));
    setPicked((p) =>
      allOn
        ? p.filter((id) => !ids.has(id))
        : [...p, ...sorted.filter((u) => !p.includes(u.id)).map((u) => u.id)],
    );
  }

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
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
      description={`Choose who to comp on “${quizName}”. You can grant to as many users as you like in one go.`}
      confirmLabel="Continue"
      confirmDisabled={picked.length === 0}
      pick
      onCancel={onCancel}
      onConfirm={() => onConfirm(picked)}
    >
      <div className="stm">
        <div className="stm-toolbar">
          <EntitySearch
            scopes={scopes}
            placeholder="Search Users by Name, Email, or Phone…"
            query={committedQuery}
            onCommit={(q) => {
              setCommittedQuery(q);
              setPage(1);
            }}
          />

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
          </div>
        </div>

        <div className="stm-table-wrap">
          {/* Seven columns don't fit the 836px card, and that is fine: the
              shared `.table-xscroll` scrolls sideways rather than crushing the
              cells. 44 check + 180 name + 200 email + 160 company + 110 role +
              130 plan + 110 attempts. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": "934px" } as React.CSSProperties}
          >
            <table className="table table-head stm-table gam-table">
              <ColGroup />
              <thead>
                <tr>
                  <th className="stm-col-check no-sort">
                    {/* Unlike the capped pickers this one HAS a select-all —
                        it covers every row the filters currently match. */}
                    <button
                      className={`checkbox ${allOn ? "checked" : someOn ? "partial" : ""}`}
                      aria-label={allOn ? "Deselect all" : "Select all"}
                      aria-pressed={allOn}
                      disabled={sorted.length === 0}
                      onClick={toggleAll}
                    >
                      {allOn ? <CheckIcon /> : someOn ? <span className="checkbox-dash" /> : null}
                    </button>
                  </th>
                  <Th col="name" label="User Name" cls="gam-col-name" sort={sort} toggle={toggleSort} />
                  <Th col="email" label="Email" cls="gam-col-email" sort={sort} toggle={toggleSort} />
                  <Th col="company" label="Company" cls="gam-col-company" sort={sort} toggle={toggleSort} />
                  <Th col="role" label="Role" cls="gam-col-role" sort={sort} toggle={toggleSort} />
                  <Th col="subscription" label="Subscription" cls="gam-col-plan" sort={sort} toggle={toggleSort} />
                  <Th col="attempts" label="Attempts" cls="gam-col-attempts" sort={sort} toggle={toggleSort} />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table gam-table">
                <ColGroup />
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="stm-empty-row">
                      <td colSpan={7}>No users match your search and filters.</td>
                    </tr>
                  ) : (
                    rows.map((u) => {
                      const on = pickedSet.has(u.id);
                      return (
                        <tr
                          key={u.id}
                          className={on ? "selected" : ""}
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
                          <td className="gam-col-name col-name">{u.name}</td>
                          <td className="gam-col-email">{u.email}</td>
                          <td className="gam-col-company">{companyOf(u) || ""}</td>
                          <td className="gam-col-role">{u.role}</td>
                          <td className="gam-col-plan">{u.subscriptionStatus}</td>
                          <td className="gam-col-attempts">{attemptsOf(u.id)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pagination stm-pagination">
            <span className="gam-picked">
              {picked.length} {picked.length === 1 ? "user" : "users"} selected
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
      <col style={{ width: 200 }} />
      <col style={{ width: 160 }} />
      <col style={{ width: 110 }} />
      <col style={{ width: 130 }} />
      <col style={{ width: 110 }} />
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
