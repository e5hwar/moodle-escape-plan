import { useEffect, useMemo, useState } from "react";
import {
  nodes as allNodes,
  links as seedLinks,
  type ContentNode,
  type Link,
  type LinkKind,
} from "../data/contentLinks";
import { SectionHeading } from "./SectionHeading";
import { PrmModal } from "./PrmModal";
import {
  KeyCommandIcon,
  AddIcon,
  ChevronRightIcon,
  SearchIcon,
  SmallXIcon,
} from "./icons";

/* Content Links — rebuilt 2026-08-26 on the shared design-system components:
 * the `.tasks` list-page shell with the `.rvc-crumbs` header, the shared
 * `.search-wrap` bar with a `.dropdown` results panel, SectionHeading column
 * headings with `.cta-quiet` actions, the PrmModal add-link picker, and the
 * Spotlights `.sp-save-footer` for the dirty-state Save/Discard bar. */

type Focus = string | null;

const KIND_PLURAL: Record<LinkKind, string> = {
  prerequisite: "Prerequisites",
  recommended: "Recommended Next",
  related: "Related",
};

const KIND_ADD_TITLE: Record<LinkKind, string> = {
  prerequisite: "Add Prerequisite",
  recommended: "Add Recommended Next",
  related: "Add Related Content",
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
  initialFocus,
  onBack,
  backLabel,
}: {
  initialFocus?: ContentNode;
  onBack?: () => void;
  backLabel?: string;
} = {}) {
  const [focusId, setFocusId] = useState<Focus>(initialFocus?.id ?? null);
  const [links, setLinks] = useState<Link[]>(seedLinks);
  // Last-saved snapshot; the Save / Discard footer diffs the working set against it.
  const [baseline, setBaseline] = useState<Link[]>(seedLinks);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Add-link picker state — { kind: which list we're adding to }
  const [picker, setPicker] = useState<{ kind: LinkKind } | null>(null);

  // Resolve the focused node. A certification opened from the 3-dot menu may not
  // exist in the mock content graph — fall back to the injected initialFocus so
  // the page always shows that certification's (possibly empty) link columns
  // instead of dropping back to the search/empty state.
  const focused = focusId
    ? nodeById(focusId) ??
      (initialFocus && initialFocus.id === focusId ? initialFocus : null)
    : null;

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
    const newEdge: Link =
      kind === "prerequisite"
        ? { from: otherId, to: focusId, kind, strength: 50 }
        : { from: focusId, to: otherId, kind, strength: 50 };
    setLinks((prev) => [...prev, newEdge]);
    setPicker(null);
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
        <div className="tasks lc-page">
          <header className="tasks-header">
            {/* Reached from a Certification's 3-dot menu — the crumb is the way back. */}
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Content</span>
                <ChevronRightIcon />
                {onBack ? (
                  <button
                    className="rvc-crumb"
                    onClick={onBack}
                    title={`Back to ${backLabel ?? "Certifications"}`}
                  >
                    {backLabel ?? "Certifications"}
                  </button>
                ) : (
                  <span className="rvc-crumb">Certifications</span>
                )}
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Content Links</span>
              </nav>
              <h1 className="tasks-title">Content Links</h1>
              <div className="tasks-subtitle">
                {focused
                  ? `${focused.industry ?? "—"} · Advisory only — links never block access`
                  : "Search for content to view and edit its links"}
              </div>
            </div>
          </header>

          <div className="toolbar">
            <SearchField
              value={focused ? focused.name : query}
              placeholder="Search all Certifications…"
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
          </div>

          <div className="lc-scroll">
            {focused && groups ? (
              <>
                <div className="lc-grid">
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
          </div>

          {/* Same in-flow save footer as the Spotlights reorder bar — spans the
              content column only, stops at the left nav. */}
          {focused && dirty && (
            <footer className="sp-save-footer">
              <div className="sp-save-footer-text">Unsaved Changes</div>
              <div className="sp-save-footer-actions">
                <button className="btn-save-draft" onClick={cancelChanges}>
                  Discard
                </button>
                <button className="btn-publish" onClick={saveChanges}>
                  Save Changes
                </button>
              </div>
            </footer>
          )}
        </div>
      </div>

      {picker && focusId && (
        <PickerModal
          kind={picker.kind}
          exclude={alreadyLinkedIds(picker.kind)}
          onAdd={(id) => addLink(picker.kind, id)}
          onClose={() => setPicker(null)}
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
  isFocusedNode: boolean;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClear: () => void;
  open: boolean;
  query: string;
  onPick: (id: string) => void;
}) {
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? allNodes.filter(
          (n) =>
            n.name.toLowerCase().includes(q) ||
            (n.industry ?? "").toLowerCase().includes(q)
        )
      : allNodes;
    return list.slice(0, 8);
  }, [query]);

  return (
    <div className="lc-search">
      <div className="search-wrap">
        <span className="search-icon">
          <SearchIcon />
        </span>
        <input
          className="search-input"
          placeholder={placeholder}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
        />
        {isFocusedNode ? (
          /* Applied state — the ✕ replaces the ⌘K badge (Figma 399:216). */
          <button
            className="usearch-clear lc-search-clear"
            aria-label="Clear focus"
            onClick={onClear}
            onMouseDown={(e) => e.preventDefault()}
          >
            <SmallXIcon />
          </button>
        ) : (
          <span className="search-kbd">
            <span className="kbd-cmd"><KeyCommandIcon /></span>
            <span className="kbd-letter">K</span>
          </span>
        )}
      </div>
      {open && (
        <div
          className="dropdown ms-menu lc-search-menu"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="dropdown-list">
            {results.length === 0 ? (
              <div className="lc-search-empty">No matches for "{query}"</div>
            ) : (
              <>
                <div className="dropdown-section-label">
                  {query.trim() ? "Results" : "All content"}
                </div>
                {results.map((n) => (
                  <button
                    key={n.id}
                    className="dropdown-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPick(n.id);
                    }}
                  >
                    <span className="lc-item-name">{n.name}</span>
                    <span className="dropdown-item-detail">
                      {n.kind} · {n.level} · {n.tasksCount} Tasks
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Empty state -------------------------------- */

function EmptyState({ onPick }: { onPick: (id: string) => void }) {
  const suggestions = allNodes.slice(0, 4);
  return (
    <div className="lc-empty">
      <div aria-hidden>
        <EmptyGraph />
      </div>
      <h2 className="lc-empty-title">Search for content to view its links</h2>
      <p className="lc-empty-sub">
        Pick a course, certification, or task above. The page will show
        prerequisites, recommended next steps, and related content.
      </p>
      <div className="lc-empty-suggest">
        <span className="form-help">Try:</span>
        {suggestions.map((n) => (
          <button key={n.id} className="cta-quiet" onClick={() => onPick(n.id)}>
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
    <section className="lc-col">
      <SectionHeading
        label={`${KIND_PLURAL[kind]} · ${items.length}`}
        trailing={
          <button className="cta-quiet lc-add" onClick={onAdd}>
            <AddIcon />
            Add
          </button>
        }
      />
      <p className="form-help">{KIND_HELPER[kind]}</p>
      <div className="lc-cards">
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
          <div className="lc-col-empty">Nothing linked yet.</div>
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
    <div className="lc-card">
      <button className="lc-card-main" onClick={onPick} title="Focus on this node">
        <span className="lc-card-name">
          {node.name}
          {related && (
            <span className="lc-card-swap" title="Two-way link"> ⇄</span>
          )}
        </span>
        <span className="lc-card-meta">{node.industry ?? "—"}</span>
      </button>
      <input
        className="lc-strength"
        type="number"
        min={0}
        max={100}
        value={strength}
        onChange={(e) => {
          const next = Math.max(0, Math.min(100, Number(e.target.value || 0)));
          onStrength(next);
        }}
        aria-label="Strength"
        title="Strength (0–100)"
      />
      <button className="lc-card-remove" title="Remove Link" onClick={onRemove}>
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
    <div className="lc-refby">
      <SectionHeading
        label={`Referenced By · ${items.length}`}
        trailing={
          <span className="form-help lc-refby-note">
            Read-only — edit from the other Certification's page
          </span>
        }
      />
      <div className="lc-refby-row">
        {shown.map((r, i) => (
          <button
            key={`${r.id}-${i}`}
            className="cta-quiet"
            onClick={() => onPickNode(r.id)}
            title="Focus on this certification"
          >
            {r.name}
            <span className="lc-ref-tag">{r.tag}</span>
          </button>
        ))}
        {extra > 0 && <span className="lc-ref-more">+ {extra} more</span>}
      </div>
    </div>
  );
}

/* ---------------------------------- Picker ---------------------------------- */

function PickerModal({
  kind,
  exclude,
  onAdd,
  onClose,
}: {
  kind: LinkKind;
  exclude: Set<string>;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  // Staged single-select — the pick only lands on the column via "Add Link",
  // the same commit-on-Continue convention as the Select Tasks modal.
  const [picked, setPicked] = useState<string | null>(null);

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allNodes
      .filter((n) => !exclude.has(n.id))
      .filter((n) =>
        q
          ? n.name.toLowerCase().includes(q) ||
            (n.industry ?? "").toLowerCase().includes(q)
          : true
      )
      .slice(0, 12);
  }, [query, exclude]);

  return (
    <PrmModal
      title={KIND_ADD_TITLE[kind]}
      description="Pick a course, certification, or task to link. Links are advisory only — they never block access."
      confirmLabel="Add Link"
      confirmDisabled={!picked}
      wide
      onCancel={onClose}
      onConfirm={() => picked && onAdd(picked)}
    >
      <div className="lc-pick">
        <div className="search-wrap stm-search">
          <span className="search-icon">
            <SearchIcon />
          </span>
          <input
            autoFocus
            className="search-input stm-search-input"
            placeholder="Search Content"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
            }}
          />
        </div>
        <div className="lc-pick-list">
          {results.length === 0 ? (
            <div className="lc-pick-empty">No matches.</div>
          ) : (
            results.map((n) => (
              <button
                key={n.id}
                className={`dropdown-item${picked === n.id ? " is-current" : ""}`}
                onClick={() => setPicked(n.id)}
              >
                <span className="lc-item-name">{n.name}</span>
                <span className="dropdown-item-detail">
                  {n.kind} · {n.level} · {n.tasksCount} Tasks
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </PrmModal>
  );
}
