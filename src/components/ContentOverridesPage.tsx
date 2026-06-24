import { useState } from "react";
import { certifications } from "../data/certifications";
import { tasks as taskPool } from "../data/tasks";
import { Dropdown } from "./Dropdown";
import { SearchIcon, CheckIcon, CheckBoldIcon, ChevronDownIcon, SmallXIcon } from "./icons";

/**
 * Content Overrides — a users × tasks completion grid.
 *
 * Pick a certification, then click any cell to override a user's task status
 * (Not started / In progress / Complete) and optionally record a score.
 * Changes are staged then saved. Toggle "Scores & dates" to surface each
 * user's score and completion date inline.
 *
 * The certification list and task columns come from real app data; users and
 * seeded completion states are demo data so every grid renders populated.
 */

type CertTask = { name: string; type: string };
type Cert = { id: string; name: string; taskCount: number };

/* ───────────────── Seed data (deterministic, built once) ───────────────── */

const CERTS: Cert[] = certifications.map((c) => ({ id: c.id, name: c.name, taskCount: c.tasks }));

const POOL: CertTask[] = taskPool.map((t) => ({ name: t.name, type: t.type }));

// Each certification gets a deterministic, distinct window of real tasks,
// sized to its task count but kept readable (3–8 columns).
const TASKS: Record<string, CertTask[]> = {};
CERTS.forEach((c, idx) => {
  const count = Math.max(3, Math.min(8, c.taskCount));
  const list: CertTask[] = [];
  for (let i = 0; i < count; i++) list.push(POOL[(idx * 7 + i * 3) % POOL.length]);
  TASKS[c.id] = list;
});

const FN = ["Amelia", "Marcus", "Priya", "Diego", "Hana", "Oliver", "Sofia", "Liam", "Yuki", "Noor", "Ethan", "Grace", "Tomas", "Aisha", "Felix", "Lena", "Ravi", "Clara", "Mateo", "Ingrid", "Omar", "Selin", "Jonas", "Maya"];
const LN = ["Chen", "Webb", "Nair", "Santos", "Kim", "Brandt", "Rossi", "Walsh", "Tanaka", "Haddad", "Cole", "Park", "Novak", "Bello", "Mond", "Ortiz", "Iyer", "Voss", "Garcia", "Holm", "Aziz", "Demir", "Berg", "Singh"];
const DOMAINS = ["northwind.io", "acme.dev", "globex.co", "umbra.org"];

type GridUser = { name: string; email: string; certs: string[]; initials: string };

const USERS: GridUser[] = (() => {
  const out: GridUser[] = [];
  const N = 48;
  for (let i = 0; i < N; i++) {
    const fn = FN[i % FN.length];
    const ln = LN[(i * 5 + Math.floor(i / FN.length)) % LN.length];
    const name = `${fn} ${ln}`;
    const email = `${(fn + "." + ln).toLowerCase()}@${DOMAINS[i % DOMAINS.length]}`;
    const certs = CERTS.filter((_, ci) => (i + ci * 2) % 3 !== 0).map((c) => c.id);
    const enrolled = certs.length ? certs : [CERTS[0].id, CERTS[1].id];
    out.push({ name, email, certs: enrolled, initials: (fn[0] + ln[0]).toUpperCase() });
  }
  return out;
})();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

function cIdx(cid: string) {
  return CERTS.findIndex((c) => c.id === cid);
}

const SEED_COMMITTED: Record<string, number> = (() => {
  const committed: Record<string, number> = {};
  USERS.forEach((u, ui) => {
    u.certs.forEach((cid) => {
      const ci = cIdx(cid);
      TASKS[cid].forEach((_, ti) => {
        const r = (ui * 7 + ti * 13 + ci * 5) % 10;
        if (r < 3) committed[`${ui}|${cid}|${ti}`] = 2;
        else if (r < 5) committed[`${ui}|${cid}|${ti}`] = 1;
      });
    });
  });
  return committed;
})();

function mkKey(ui: number, cid: string, ti: number) {
  return `${ui}|${cid}|${ti}`;
}
function scoreFor(ui: number, cid: string, ti: number) {
  return ((ui * 13 + ti * 29 + cIdx(cid) * 7) % 36) + 64;
}
function dateFor(ui: number, cid: string, ti: number) {
  const ci = cIdx(cid);
  const m = MONTHS[(ui * 2 + ti + ci) % MONTHS.length];
  const d = ((ui * 3 + ti * 5) % 27) + 1;
  return `${m} ${d}`;
}
// Minutes a user has spent on a task (only meaningful once started).
function timeFor(ui: number, cid: string, ti: number) {
  return ((ui * 17 + ti * 23 + cIdx(cid) * 11) % 88) + 7;
}

const STATE_NAMES = ["Not started", "In progress", "Complete"];

/* ───────────────── Component ───────────────── */

type Props = {
  tristate?: boolean;
  showCounts?: boolean;
};

type Editing = { ui: number; ti: number; x: number; y: number };

export function ContentOverridesPage({ tristate = true, showCounts = true }: Props) {
  const [committed, setCommitted] = useState<Record<string, number>>(() => ({ ...SEED_COMMITTED }));
  const [committedScores, setCommittedScores] = useState<Record<string, number>>({});
  const [course, setCourseRaw] = useState("");
  const [search, setSearch] = useState("");
  const [staged, setStaged] = useState<Record<string, number>>({});
  const [stagedScores, setStagedScores] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [showDetail, setShowDetail] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  // Switching certification starts a fresh grid (drops in-flight staging/selection).
  function setCourse(id: string) {
    setCourseRaw(id);
    setStaged({});
    setStagedScores({});
    setSelected({});
    setEditing(null);
  }

  /* staging helpers */
  function stageOne(k: string, val: number) {
    setStaged((prev) => {
      const next = { ...prev };
      const cv = committed[k] || 0;
      if (val === cv) delete next[k];
      else next[k] = val;
      return next;
    });
  }
  function stageMany(cid: string, pairs: [number, number][], val: number) {
    setStaged((prev) => {
      const next = { ...prev };
      pairs.forEach(([ui, ti]) => {
        const k = mkKey(ui, cid, ti);
        const cv = committed[k] || 0;
        if (val === cv) delete next[k];
        else next[k] = val;
      });
      return next;
    });
  }
  function setStagedScore(k: string, val: number | null) {
    setStagedScores((prev) => {
      const next = { ...prev };
      const [u, c, t] = k.split("|");
      const auto = scoreFor(+u, c, +t);
      const base = committedScores[k] !== undefined ? committedScores[k] : auto;
      if (val === null || Number.isNaN(val)) delete next[k];
      else {
        const v = Math.max(0, Math.min(100, val));
        if (v === base) delete next[k];
        else next[k] = v;
      }
      return next;
    });
  }
  function save() {
    setCommitted((prev) => {
      const next = { ...prev };
      Object.keys(staged).forEach((k) => {
        const v = staged[k];
        if (v === 0) delete next[k];
        else next[k] = v;
      });
      return next;
    });
    setCommittedScores((prev) => {
      const next = { ...prev };
      Object.keys(stagedScores).forEach((k) => (next[k] = stagedScores[k]));
      return next;
    });
    setStaged({});
    setStagedScores({});
  }
  function discard() {
    setStaged({});
    setStagedScores({});
  }

  /* derived */
  const cid = course;
  const tasks = course ? TASKS[cid] : [];
  const sub = search.trim().toLowerCase();
  const cert = CERTS.find((c) => c.id === cid);

  const eff = (ui: number, ti: number) => {
    const k = mkKey(ui, cid, ti);
    return staged[k] !== undefined ? staged[k] : committed[k] || 0;
  };
  const effScore = (ui: number, ti: number) => {
    const k = mkKey(ui, cid, ti);
    const base = committedScores[k] !== undefined ? committedScores[k] : scoreFor(ui, cid, ti);
    return stagedScores[k] !== undefined ? stagedScores[k] : base;
  };

  const rows = course
    ? USERS.map((u, i) => ({ u, i })).filter(
        (x) => x.u.certs.includes(cid) && (x.u.email.includes(sub) || x.u.name.toLowerCase().includes(sub)),
      )
    : [];

  const selIds = rows.filter((x) => selected[x.i]).map((x) => x.i);
  const hasSel = selIds.length > 0;
  const allSel = rows.length > 0 && selIds.length === rows.length;

  function toggleSelectAll() {
    if (allSel) setSelected({});
    else {
      const ns: Record<number, boolean> = {};
      rows.forEach((x) => (ns[x.i] = true));
      setSelected(ns);
    }
  }
  function bulkSet(v: number) {
    const pairs: [number, number][] = [];
    selIds.forEach((ui) => tasks.forEach((_, ti) => pairs.push([ui, ti])));
    stageMany(cid, pairs, v);
  }

  // staged count
  const pkeys = new Set<string>();
  Object.keys(staged).forEach((k) => {
    if (staged[k] !== (committed[k] || 0)) pkeys.add(k);
  });
  Object.keys(stagedScores).forEach((k) => pkeys.add(k));
  const pending = pkeys.size;

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks sch-page co-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Content Overrides</h1>
              <div className="tasks-subtitle">
                {course ? (
                  <>
                    <span>
                      {rows.length} {rows.length === 1 ? "user" : "users"}
                    </span>
                    <span className="tasks-subtitle-dot" />
                    <span>
                      {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                    </span>
                    <span className="tasks-subtitle-dot" />
                    <span>Click a cell to override a status</span>
                  </>
                ) : (
                  <span>Pick a certification, then override any user's task completion</span>
                )}
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              {/* toolbar */}
              <div className="co-toolbar">
                <CertPicker value={course} onChange={setCourse} />
                {course && (
                  <>
                    <div className="search-wrap co-search">
                      <span className="search-icon">
                        <SearchIcon />
                      </span>
                      <input
                        className="search-input"
                        placeholder="Search users by name or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="toggle-row inline co-detail-toggle"
                      onClick={() => setShowDetail((v) => !v)}
                    >
                      <span className="toggle-inline-label">Scores &amp; dates</span>
                      <span className={`toggle ${showDetail ? "on" : ""}`}>
                        <span className="toggle-knob" />
                      </span>
                    </button>
                  </>
                )}
              </div>

              {!course ? (
                <div className="co-empty-state">
                  <div className="co-empty-glyph" aria-hidden="true">
                    <GridGlyph />
                  </div>
                  <div className="co-empty-title">Select a certification to load the grid</div>
                  <div className="co-empty-sub">
                    Rows are enrolled users · columns are the certification's tasks.
                  </div>
                </div>
              ) : (
                <>
                  {hasSel && (
                    <div className="co-bulk-bar">
                      <span className="co-bulk-count">{selIds.length} selected</span>
                      <button className="co-bulk-action co-bulk-action--done" onClick={() => bulkSet(2)}>
                        <CheckBoldIcon />
                        Complete all
                      </button>
                      {tristate && (
                        <button className="co-bulk-action co-bulk-action--progress" onClick={() => bulkSet(1)}>
                          In progress
                        </button>
                      )}
                      <button className="co-bulk-action" onClick={() => bulkSet(0)}>
                        Reset
                      </button>
                      <button className="co-bulk-clear" onClick={() => setSelected({})}>
                        Clear
                      </button>
                    </div>
                  )}

                  <div className="co-grid-wrap">
                    <div className="co-grid-scroll scry">
                      <table className="co-grid">
                        <thead>
                          <tr>
                            <th className="co-grid-corner">
                              <div className="co-user-head">
                                <span
                                  className={`row-checkbox ${allSel ? "checked" : ""}`}
                                  role="checkbox"
                                  aria-checked={allSel}
                                  aria-label="Select all users"
                                  onClick={toggleSelectAll}
                                >
                                  {allSel && <CheckIcon />}
                                </span>
                                <span>User</span>
                              </div>
                            </th>
                            {tasks.map((t, ti) => {
                              const doneCount = rows.reduce((n, x) => n + (eff(x.i, ti) === 2 ? 1 : 0), 0);
                              return (
                                <th key={ti} className="co-grid-colhead">
                                  <div className="co-col-name" title={t.name}>
                                    {t.name}
                                  </div>
                                  <div className="co-col-type">{t.type}</div>
                                  {showCounts && (
                                    <div className={`co-col-count ${doneCount > 0 ? "is-on" : ""}`}>
                                      {doneCount}/{rows.length}
                                    </div>
                                  )}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((x) => {
                            const ui = x.i;
                            const isSel = !!selected[ui];
                            const doneCount = tasks.reduce((n, _, ti) => n + (eff(ui, ti) === 2 ? 1 : 0), 0);
                            return (
                              <tr key={ui} className={isSel ? "is-selected" : ""}>
                                <td className="co-grid-rowhead">
                                  <div className="co-user">
                                    <span
                                      className={`row-checkbox ${isSel ? "checked" : ""}`}
                                      role="checkbox"
                                      aria-checked={isSel}
                                      aria-label={`Select ${x.u.email}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelected((st) => ({ ...st, [ui]: !st[ui] }));
                                      }}
                                    >
                                      {isSel && <CheckIcon />}
                                    </span>
                                    <span className="co-avatar">{x.u.initials}</span>
                                    <div className="co-user-meta">
                                      <div className="co-user-email">{x.u.email}</div>
                                      {showCounts && (
                                        <div className="co-user-count">
                                          {doneCount}/{tasks.length} complete
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {tasks.map((t, ti) => {
                                  const s = eff(ui, ti);
                                  const k = mkKey(ui, cid, ti);
                                  const dirty =
                                    (staged[k] !== undefined && staged[k] !== (committed[k] || 0)) ||
                                    stagedScores[k] !== undefined;
                                  const score = effScore(ui, ti);
                                  const mins = timeFor(ui, cid, ti);
                                  const stateClass = s === 2 ? "is-done" : s === 1 ? "is-progress" : "is-none";
                                  const titleExtra =
                                    s === 2
                                      ? ` · ${score}% · ${dateFor(ui, cid, ti)} · ${mins} min`
                                      : s === 1
                                      ? ` · ${score}% · ${mins} min`
                                      : "";
                                  return (
                                    <td key={ti} className="co-grid-cell">
                                      <div className="co-cell-wrap">
                                        <button
                                          className={`co-cell ${stateClass} ${dirty ? "is-dirty" : ""}`}
                                          title={`${t.name}: ${STATE_NAMES[s]}${titleExtra}`}
                                          onClick={(e) => {
                                            const r = e.currentTarget.getBoundingClientRect();
                                            const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
                                            const px = Math.max(8, Math.min(r.left, vw - 236));
                                            setEditing({ ui, ti, x: px, y: r.bottom + 6 });
                                          }}
                                        >
                                          {s === 2 ? <CheckBoldIcon /> : s === 1 ? <span className="co-cell-dash" /> : null}
                                        </button>
                                        {showDetail && (
                                          <div className="co-cell-detail">
                                            {s >= 1 ? (
                                              <>
                                                <span className={`co-cell-score ${stateClass}`}>{score}%</span>
                                                {s === 2 && (
                                                  <span className="co-cell-date">{dateFor(ui, cid, ti)}</span>
                                                )}
                                                <span className="co-cell-time">{mins} min</span>
                                              </>
                                            ) : (
                                              <span className="co-cell-empty">—</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {rows.length === 0 && (
                        <div className="co-grid-empty">
                          {sub
                            ? `No users match “${search.trim()}” in ${cert?.name ?? "this certification"}.`
                            : `No users are enrolled in ${cert?.name ?? "this certification"}.`}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="co-savebar">
                    <span className={`co-save-status ${pending > 0 ? "is-pending" : ""}`}>
                      {pending === 0 ? "No changes" : pending === 1 ? "1 staged change" : `${pending} staged changes`}
                    </span>
                    <div className="co-savebar-actions">
                      <button className="btn-save-draft" disabled={pending === 0} onClick={discard}>
                        Discard
                      </button>
                      <button className="cta-primary co-save-btn" disabled={pending === 0} onClick={save}>
                        Save changes
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && course && (
        <CellEditor
          editing={editing}
          cid={cid}
          committed={committed}
          committedScores={committedScores}
          staged={staged}
          stagedScores={stagedScores}
          tristate={tristate}
          stageOne={stageOne}
          setStagedScore={setStagedScore}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* ───────────────── Certification picker ───────────────── */

function CertPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const current = CERTS.find((c) => c.id === value);
  const ql = q.trim().toLowerCase();
  const filtered = CERTS.filter((c) => `${c.id} ${c.name}`.toLowerCase().includes(ql));

  return (
    <Dropdown
      width={380}
      trigger={({ open, toggle }) => (
        <button className={`co-cert-trigger ${open ? "open" : ""}`} onClick={toggle}>
          <span className="co-cert-label">Certification</span>
          <span className={current ? "co-cert-value" : "co-cert-placeholder"}>
            {current ? `${current.id} · ${current.name}` : "Select a certification…"}
          </span>
          <span className="co-cert-caret">
            <ChevronDownIcon />
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="dropdown-search">
            <span className="dropdown-search-icon">
              <SearchIcon />
            </span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search certifications…"
            />
          </div>
          <div className="dropdown-list">
            {filtered.map((c) => (
              <button
                key={c.id}
                className={`dropdown-item co-cert-item ${c.id === value ? "is-active" : ""}`}
                onClick={() => {
                  onChange(c.id);
                  setQ("");
                  close();
                }}
              >
                <span className="co-cert-item-id">{c.id}</span>
                <span className="co-cert-item-name">{c.name}</span>
                {c.id === value && (
                  <span className="co-cert-item-check">
                    <CheckIcon />
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && <div className="cols-empty">No certifications match “{q.trim()}”.</div>}
          </div>
        </>
      )}
    </Dropdown>
  );
}

/* ───────────────── Cell editor popover ───────────────── */

function CellEditor({
  editing,
  cid,
  committed,
  committedScores,
  staged,
  stagedScores,
  tristate,
  stageOne,
  setStagedScore,
  onClose,
}: {
  editing: Editing;
  cid: string;
  committed: Record<string, number>;
  committedScores: Record<string, number>;
  staged: Record<string, number>;
  stagedScores: Record<string, number>;
  tristate: boolean;
  stageOne: (k: string, val: number) => void;
  setStagedScore: (k: string, val: number | null) => void;
  onClose: () => void;
}) {
  const { ui, ti, x, y } = editing;
  const t = TASKS[cid][ti];
  if (!t) return null;

  const k = mkKey(ui, cid, ti);
  const curS = staged[k] !== undefined ? staged[k] : committed[k] || 0;
  const seq = tristate ? [0, 1, 2] : [0, 2];
  const baseScore = committedScores[k] !== undefined ? committedScores[k] : scoreFor(ui, cid, ti);
  const editScore = stagedScores[k] !== undefined ? stagedScores[k] : baseScore;
  const isComplete = curS === 2;

  return (
    <>
      <div className="co-pop-backdrop" onClick={onClose} />
      <div className="co-pop" style={{ left: x, top: y }}>
        <div className="co-pop-head">
          <div className="co-pop-title">{t.name}</div>
          <div className="co-pop-type">{t.type}</div>
        </div>
        <div className="co-pop-opts">
          {seq.map((sv) => {
            const active = curS === sv;
            const stateClass = sv === 2 ? "is-done" : sv === 1 ? "is-progress" : "is-none";
            return (
              <button
                key={sv}
                className={`co-pop-opt ${active ? "is-active" : ""}`}
                onClick={() => {
                  stageOne(k, sv);
                  if (sv !== 2) onClose();
                }}
              >
                <span className={`co-pop-dot ${stateClass}`} />
                <span className="co-pop-opt-label">{STATE_NAMES[sv]}</span>
                {active && (
                  <span className="co-pop-opt-check">
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {isComplete && (
          <div className="co-pop-score">
            <label className="co-pop-score-label">
              Score <span>(optional)</span>
            </label>
            <div className="co-pop-score-row">
              <input
                className="form-input small co-pop-score-input"
                type="number"
                min={0}
                max={100}
                placeholder="—"
                value={String(editScore)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") setStagedScore(k, null);
                  else setStagedScore(k, parseInt(val, 10));
                }}
              />
              <span className="co-pop-pct">%</span>
              <button className="co-pop-done" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
        <button className="co-pop-close" aria-label="Close" onClick={onClose}>
          <SmallXIcon />
        </button>
      </div>
    </>
  );
}

function GridGlyph() {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="38" height="38" rx="6" />
      <path d="M4 17h38M4 30h38M17 4v38" opacity="0.5" />
      <path d="M22 23.5l2.2 2.2 4.3-4.6" />
    </svg>
  );
}
