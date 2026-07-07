import { useMemo, useRef, useState } from "react";
import {
  nodes as allNodes,
  links as seedLinks,
  type ContentNode,
  type Link,
  type LinkKind,
} from "../data/contentLinks";
import { SearchIcon, SmallXIcon, ChevronLeftIcon } from "./icons";

type Focus = string | null;

const KIND_PLURAL: Record<LinkKind, string> = {
  prerequisite: "Prerequisites",
  recommended: "Recommended Next",
  related: "Related",
};

// One-line guidance shown under each column heading.
const KIND_HELPER: Record<LinkKind, string> = {
  prerequisite: "Advised before starting.",
  recommended: "Vertical progression.",
  related: "Two-way — reverse link automatic.",
};

function nodeById(id: string): ContentNode | undefined {
  return allNodes.find((n) => n.id === id);
}

/**
 * For focus F, compute three lists.
 *  - prerequisites: edges where to=F and kind=prerequisite (source is the prereq)
 *  - recommended:   edges where from=F and kind=recommended (target is the next)
 *  - related:       edges where (from=F or to=F) and kind=related
 */
function partition(focusId: string, links: Link[]) {
  const prereqs: { other: string; strength: number; edge: Link }[] = [];
  const recommended: { other: string; strength: number; edge: Link }[] = [];
  const related: { other: string; strength: number; edge: Link }[] = [];

  for (const e of links) {
    if (e.kind === "prerequisite" && e.to === focusId) {
      prereqs.push({ other: e.from, strength: e.strength, edge: e });
    } else if (e.kind === "recommended" && e.from === focusId) {
      recommended.push({ other: e.to, strength: e.strength, edge: e });
    } else if (e.kind === "related" && (e.from === focusId || e.to === focusId)) {
      const other = e.from === focusId ? e.to : e.from;
      related.push({ other, strength: e.strength, edge: e });
    }
  }
  prereqs.sort((a, b) => b.strength - a.strength);
  recommended.sort((a, b) => b.strength - a.strength);
  related.sort((a, b) => b.strength - a.strength);
  return { prereqs, recommended, related };
}

export function ContentLinksPage({
  initialFocusId,
  onBack,
  backLabel,
}: {
  initialFocusId?: string;
  onBack?: () => void;
  backLabel?: string;
} = {}) {
  const [focusId, setFocusId] = useState<Focus>(initialFocusId ?? null);
  const [links, setLinks] = useState<Link[]>(seedLinks);
  // Last-saved snapshot; the Save / Cancel bar diffs the working set against it.
  const [baseline, setBaseline] = useState<Link[]>(seedLinks);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Add-link picker state — { kind: which list we're adding to }
  const [picker, setPicker] = useState<{ kind: LinkKind } | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const focused = focusId ? nodeById(focusId) : null;

  const groups = useMemo(
    () => (focusId ? partition(focusId, links) : null),
    [focusId, links]
  );

  // "Referenced by" = relationships authored on *other* certifications that point
  // at this one. They're read-only here (edit them from the other cert's page):
  //  - this cert is a prerequisite of another  → tagged PREREQ
  //  - another cert recommends this one as next → tagged REC NEXT
  const referencedBy = useMemo(() => {
    if (!focusId) return [] as { id: string; name: string; tag: string }[];
    const out: { id: string; name: string; tag: string }[] = [];
    for (const e of links) {
      if (e.kind === "prerequisite" && e.from === focusId) {
        const n = nodeById(e.to);
        if (n) out.push({ id: n.id, name: n.name, tag: "PREREQ" });
      } else if (e.kind === "recommended" && e.to === focusId) {
        const n = nodeById(e.from);
        if (n) out.push({ id: n.id, name: n.name, tag: "REC NEXT" });
      }
    }
    return out;
  }, [focusId, links]);

  // Reference identity: any add / remove / strength edit produces a new array.
  const dirty = links !== baseline;

  function pickFocus(id: string) {
    setFocusId(id);
    setQuery("");
    setSearchOpen(false);
  }

  function clearFocus() {
    setFocusId(null);
    setQuery("");
  }

  function saveChanges() {
    setBaseline(links);
  }

  function cancelChanges() {
    setLinks(baseline);
  }

  function removeEdge(edge: Link) {
    setLinks((prev) => prev.filter((e) => e !== edge));
  }

  function updateStrength(edge: Link, strength: number) {
    setLinks((prev) =>
      prev.map((e) => (e === edge ? { ...e, strength } : e))
    );
  }

  function addLink(kind: LinkKind, otherId: string) {
    if (!focusId) return;
    let newEdge: Link;
    if (kind === "prerequisite") {
      newEdge = { from: otherId, to: focusId, kind, strength: 50 };
    } else if (kind === "recommended") {
      newEdge = { from: focusId, to: otherId, kind, strength: 50 };
    } else {
      newEdge = { from: focusId, to: otherId, kind, strength: 50 };
    }
    setLinks((prev) => [...prev, newEdge]);
    setPicker(null);
    setPickerQuery("");
  }

  // Nodes already linked from this focus in the given kind (so we can hide them in picker)
  function alreadyLinkedIds(kind: LinkKind): Set<string> {
    if (!groups) return new Set();
    const list =
      kind === "prerequisite"
        ? groups.prereqs
        : kind === "recommended"
        ? groups.recommended
        : groups.related;
    const s = new Set(list.map((x) => x.other));
    if (focusId) s.add(focusId);
    return s;
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks cl-page cl2-page">
          <header className="cl2-head">
            {onBack && (
              <button className="attempts-back" onClick={onBack}>
                <ChevronLeftIcon />
                {backLabel ?? "All certifications"}
              </button>
            )}
            <div className="cl2-eyebrow">CONTENT LINKS</div>

            {/* Existing shared search bar — shows the focused certification and
                lets you switch to another one. */}
            <SearchField
              value={focused ? focused.name : query}
              placeholder="Search all Certifications…"
              disabled={false}
              isFocusedNode={!!focused}
              onChange={(v) => {
                setQuery(v);
                setFocusId(null);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
              onClear={clearFocus}
              open={searchOpen && !focused}
              query={query}
              onPick={pickFocus}
            />

            {focused && (
              <div className="cl2-focus-sub">
                {focused.industry} <span className="cl2-focus-dot" /> Advisory
                only — links never block access.
              </div>
            )}
          </header>

          {focused && groups ? (
            <>
              <div className="cl2-grid">
                <LinkColumn
                  kind="prerequisite"
                  items={groups.prereqs}
                  onRemove={removeEdge}
                  onStrength={updateStrength}
                  onAdd={() => setPicker({ kind: "prerequisite" })}
                  onPickNode={pickFocus}
                />
                <LinkColumn
                  kind="recommended"
                  items={groups.recommended}
                  onRemove={removeEdge}
                  onStrength={updateStrength}
                  onAdd={() => setPicker({ kind: "recommended" })}
                  onPickNode={pickFocus}
                />
                <LinkColumn
                  kind="related"
                  items={groups.related}
                  onRemove={removeEdge}
                  onStrength={updateStrength}
                  onAdd={() => setPicker({ kind: "related" })}
                  onPickNode={pickFocus}
                />
              </div>

              <ReferencedBy items={referencedBy} onPickNode={pickFocus} />
            </>
          ) : (
            <EmptyState onPick={pickFocus} />
          )}

          {focused && dirty && (
            <div className="cl2-savebar">
              <span className="cl2-savebar-dot" />
              <span className="cl2-savebar-text">Unsaved changes</span>
              <div className="cl2-savebar-spacer" />
              <button className="cl2-cancel" onClick={cancelChanges}>
                Cancel
              </button>
              <button className="cl2-save" onClick={saveChanges}>
                Save changes
              </button>
            </div>
          )}
        </div>
      </div>

      {picker && focusId && (
        <PickerModal
          kind={picker.kind}
          query={pickerQuery}
          setQuery={setPickerQuery}
          exclude={alreadyLinkedIds(picker.kind)}
          onPick={(id) => addLink(picker.kind, id)}
          onClose={() => {
            setPicker(null);
            setPickerQuery("");
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------------- Search ----------------------------------- */

function SearchField({
  value,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  onClear,
  open,
  query,
  onPick,
  isFocusedNode,
}: {
  value: string;
  placeholder: string;
  disabled: boolean;
  isFocusedNode: boolean;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClear: () => void;
  open: boolean;
  query: string;
  onPick: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? allNodes.filter((n) => n.name.toLowerCase().includes(q) || (n.industry ?? "").toLowerCase().includes(q))
      : allNodes;
    return list.slice(0, 8);
  }, [query]);

  return (
    <div className="cl-search-wrap" style={{ position: "relative" }}>
      <div className="search-wrap" style={{ marginBottom: 18 }}>
        <span className="search-icon">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="search-input"
          placeholder={placeholder}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
        />
        {isFocusedNode ? (
          <button
            className="cl-search-clear"
            aria-label="Clear focus"
            onClick={onClear}
            onMouseDown={(e) => e.preventDefault()}
          >
            <SmallXIcon />
          </button>
        ) : (
          <span className="search-kbd">
            <span className="kbd-cmd">⌘</span>
            <span className="kbd-letter">K</span>
          </span>
        )}
      </div>
      {open && (
        <div className="cl-search-dropdown" onMouseDown={(e) => e.preventDefault()}>
          {results.length === 0 ? (
            <div className="cl-search-empty">No matches for "{query}"</div>
          ) : (
            <>
              <div className="cl-search-section-label">
                {query.trim() ? "Results" : "All content"}
              </div>
              <div className="cl-search-list">
                {results.map((n) => (
                  <button
                    key={n.id}
                    className="cl-search-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPick(n.id);
                    }}
                  >
                    <span className={`cl-node-badge cl-node-badge--${n.kind.toLowerCase()}`}>
                      {n.kind[0]}
                    </span>
                    <span className="cl-search-item-text">
                      <span className="cl-search-item-name">{n.name}</span>
                      <span className="cl-search-item-meta">
                        {n.kind} · {n.level} · {n.tasksCount} tasks
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Empty state -------------------------------- */

function EmptyState({ onPick }: { onPick: (id: string) => void }) {
  const suggestions = allNodes.slice(0, 4);
  return (
    <div className="cl-empty">
      <div className="cl-empty-illustration" aria-hidden>
        <EmptyGraph />
      </div>
      <h2 className="cl-empty-title">Search for content to view its links</h2>
      <p className="cl-empty-sub">
        Pick a course, certification, or task above. The graph will show prerequisites, recommended next steps, and related content.
      </p>
      <div className="cl-empty-suggest">
        <span className="cl-empty-suggest-label">Try:</span>
        {suggestions.map((n) => (
          <button
            key={n.id}
            className="cl-empty-chip"
            onClick={() => onPick(n.id)}
          >
            {n.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyGraph() {
  return (
    <svg width="320" height="200" viewBox="0 0 320 200" fill="none">
      <g opacity="0.45">
        {/* center node */}
        <rect x="120" y="80" width="80" height="36" rx="8" stroke="var(--border-strong)" strokeDasharray="3 3" fill="transparent" />
        {/* satellites */}
        <rect x="18" y="40" width="68" height="28" rx="6" stroke="var(--border)" fill="transparent" />
        <rect x="18" y="130" width="68" height="28" rx="6" stroke="var(--border)" fill="transparent" />
        <rect x="234" y="40" width="68" height="28" rx="6" stroke="var(--border)" fill="transparent" />
        <rect x="234" y="130" width="68" height="28" rx="6" stroke="var(--border)" fill="transparent" />
        {/* connectors */}
        <path d="M86 54 L120 90" stroke="var(--border-strong)" />
        <path d="M86 144 L120 108" stroke="var(--border-strong)" />
        <path d="M200 90 L234 54" stroke="var(--border-strong)" strokeDasharray="4 4" />
        <path d="M200 108 L234 144" stroke="var(--border-strong)" strokeDasharray="1 4" />
      </g>
    </svg>
  );
}

/* ----------------------------------- Columns ---------------------------------- */

type GroupItem = { other: string; strength: number; edge: Link };

const PlusIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

function LinkColumn({
  kind,
  items,
  onRemove,
  onStrength,
  onAdd,
  onPickNode,
}: {
  kind: LinkKind;
  items: GroupItem[];
  onRemove: (edge: Link) => void;
  onStrength: (edge: Link, strength: number) => void;
  onAdd: () => void;
  onPickNode: (id: string) => void;
}) {
  return (
    <section className="cl2-col">
      <div className="cl2-col-head">
        <span className="cl2-col-title">
          {KIND_PLURAL[kind]}
          <span className="cl2-col-count"> · {items.length}</span>
        </span>
        <button className="cl2-add" onClick={onAdd}>
          <PlusIcon />
          Add
        </button>
      </div>
      <div className="cl2-col-helper">{KIND_HELPER[kind]}</div>
      <div className="cl2-cards">
        {items.map(({ other, strength, edge }) => {
          const n = nodeById(other);
          if (!n) return null;
          return (
            <LinkCard
              key={`${edge.from}-${edge.to}-${edge.kind}`}
              node={n}
              strength={strength}
              related={kind === "related"}
              onStrength={(v) => onStrength(edge, v)}
              onRemove={() => onRemove(edge)}
              onPick={() => onPickNode(other)}
            />
          );
        })}
        {items.length === 0 && (
          <div className="cl2-col-empty">Nothing linked yet.</div>
        )}
      </div>
    </section>
  );
}

function LinkCard({
  node,
  strength,
  related,
  onStrength,
  onRemove,
  onPick,
}: {
  node: ContentNode;
  strength: number;
  related: boolean;
  onStrength: (strength: number) => void;
  onRemove: () => void;
  onPick: () => void;
}) {
  return (
    <div className="cl2-card">
      <button className="cl2-card-main" onClick={onPick} title="Focus on this node">
        <span className="cl2-card-name">
          {node.name}
          {related && <span className="cl2-card-swap"> ⇄</span>}
        </span>
        <span className="cl2-card-meta">{node.industry ?? "—"}</span>
      </button>
      <input
        className="cl2-card-strength"
        type="number"
        min={0}
        max={100}
        value={strength}
        onChange={(e) => {
          const next = Math.max(0, Math.min(100, Number(e.target.value || 0)));
          onStrength(next);
        }}
        aria-label="Strength"
      />
      <button className="cl2-card-remove" aria-label="Remove link" onClick={onRemove}>
        <SmallXIcon />
      </button>
    </div>
  );
}

/* -------------------------------- Referenced by ------------------------------- */

function ReferencedBy({
  items,
  onPickNode,
}: {
  items: { id: string; name: string; tag: string }[];
  onPickNode: (id: string) => void;
}) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 6);
  const extra = items.length - shown.length;
  return (
    <div className="cl2-refby">
      <span className="cl2-refby-title">Referenced by · {items.length}</span>
      <span className="cl2-refby-note">read-only</span>
      {shown.map((r, i) => (
        <button
          key={`${r.id}-${i}`}
          className="cl2-refby-chip"
          onClick={() => onPickNode(r.id)}
          title="Focus on this certification"
        >
          <span className="cl2-refby-chip-name">{r.name}</span>
          <span className="cl2-refby-chip-tag">{r.tag}</span>
        </button>
      ))}
      {extra > 0 && <span className="cl2-refby-more">+ {extra} more</span>}
    </div>
  );
}

/* ---------------------------------- Picker ---------------------------------- */

function PickerModal({
  kind,
  query,
  setQuery,
  exclude,
  onPick,
  onClose,
}: {
  kind: LinkKind;
  query: string;
  setQuery: (q: string) => void;
  exclude: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allNodes
      .filter((n) => !exclude.has(n.id))
      .filter((n) => (q ? n.name.toLowerCase().includes(q) || (n.industry ?? "").toLowerCase().includes(q) : true))
      .slice(0, 12);
  }, [query, exclude]);

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <div className="cl-modal-eyebrow">
            <ChevronLeftIcon />
            <button className="cl-modal-back" onClick={onClose}>Back</button>
          </div>
          <h3 className="cl-modal-title">Add {KIND_PLURAL[kind]}</h3>
          <p className="cl-modal-sub">Pick a course, certification, or task to link.</p>
        </div>
        <div className="cl-modal-search">
          <span className="search-icon"><SearchIcon /></span>
          <input
            autoFocus
            className="cl-modal-input"
            placeholder="Search content…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="cl-modal-list">
          {results.length === 0 ? (
            <div className="cl-modal-empty">No matches.</div>
          ) : (
            results.map((n) => (
              <button key={n.id} className="cl-modal-item" onClick={() => onPick(n.id)}>
                <span className={`cl-node-badge cl-node-badge--${n.kind.toLowerCase()}`}>
                  {n.kind[0]}
                </span>
                <span className="cl-modal-item-text">
                  <span className="cl-modal-item-name">{n.name}</span>
                  <span className="cl-modal-item-meta">
                    {n.kind} · {n.level} · {n.tasksCount} tasks
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="cl-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
