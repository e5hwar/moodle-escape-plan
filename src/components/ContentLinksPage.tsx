import { useEffect, useMemo, useState } from "react";
import {
  nodes as allNodes,
  links as seedLinks,
  type ContentNode,
  type Link,
  type LinkKind,
} from "../data/contentLinks";
import { SectionHeading } from "./SectionHeading";
import { SelectCertificationsModal } from "./SelectCertificationsModal";
import { SearchHints } from "./SearchPanelParts";
import {
  KeyCommandIcon,
  ChevronRightIcon,
  InfoIcon,
  InfoTipIcon,
  PlusThinIcon,
  SearchIcon,
  SearchClearIcon,
  SmallXIcon,
} from "./icons";

/* Content Links — rebuilt 2026-08-26 on the shared design-system components:
 * the `.tasks` list-page shell with the `.rvc-crumbs` header, the
 * Certifications page's `.search-wrap` bar (with a `.dropdown` results panel),
 * the PrmModal add-link picker, and the Spotlights `.sp-save-footer` for the
 * dirty-state Save/Discard bar.
 *
 * 2026-08-30 — the three link lists were re-synced to Figma 802:2260: each
 * column is a titled panel (title + count + a 24px plus) holding a
 * CERTIFICATION / LINK STRENGTH table, in place of the old SectionHeading +
 * loose-card column.
 *
 * 2026-08-30 — the search bar moved onto the shared `.usearch` combobox shell
 * (the Tasks / Certifications bar) with keyboard navigation. It stays a PICKER:
 * the panel lists content to focus, not filter scopes to apply. */

type Focus = string | null;

const KIND_PLURAL: Record<LinkKind, string> = {
  prerequisite: "Prerequisites",
  recommended: "Recommended Next",
  related: "Related",
};

const KIND_ADD_TITLE: Record<LinkKind, string> = {
  prerequisite: "Add Prerequisites",
  recommended: "Add Recommended Next",
  related: "Add Related Certifications",
};

/* The picker's subtitle — the one-line version of what this section means. */
const KIND_ADD_DESC: Record<LinkKind, string> = {
  prerequisite:
    "Certifications the user should study before starting this one. Ones already linked here are ticked",
  recommended:
    "Where the user should go next for more depth on this topic. Ones already linked here are ticked",
  related:
    "Adjacent Certifications at the same level, for exploring sideways. Ones already linked here are ticked",
};

/* What the three link kinds mean — too long for the subtext line, so it hangs
 * off the page-subtext info glyph (Figma 742:1061). */
const LINK_KINDS_TIP =
  "Prerequisites - Content the user should study before starting this Certification. Without it, they may struggle to follow the concepts here.\n\n" +
  "Recommended Next - Where the user should go to learn more about this topic after finishing. Use this for depth: the next level up on the same subject.\n\n" +
  "Related - Adjacent topics at the same level, for users who want to explore sideways rather than go deeper.";

// Tooltip on every section's LINK STRENGTH column header.
const LINK_STRENGTH_TIP =
  "A value between 0 and 100 that controls the order links appear in. Higher Link Strength shows first. " +
  "Only compared against other links of the same type on this Certification - a Prerequisite at 90 and a Related at 80 don't compete with each other.";

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

  function addLinks(kind: LinkKind, otherIds: string[]) {
    if (!focusId || otherIds.length === 0) return;
    const id = focusId;
    const added: Link[] = otherIds.map((otherId) =>
      kind === "prerequisite"
        ? { from: otherId, to: id, kind, strength: 50 }
        : { from: id, to: otherId, kind, strength: 50 },
    );
    setLinks((prev) => [...prev, ...added]);
    setPicker(null);
  }

  // Nodes already linked from this focus in the given kind. The picker shows
  // them ticked and locked rather than hiding them.
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
              {/* Subtext + tooltip glyph (Figma 742:1061) — the glyph carries
                  what each of the three sections means. */}
              <div className="tasks-subtitle">
                Suggest what a user should study before, after, or alongside
                this Certification.
                <span
                  className="form-help-info tasks-subtitle-info"
                  tabIndex={0}
                  role="note"
                  aria-label={LINK_KINDS_TIP}
                  data-tip={LINK_KINDS_TIP}
                >
                  <InfoTipIcon />
                </span>
              </div>
            </div>
          </header>

          <div className="toolbar">
            <SearchField
              value={focused ? focused.name : query}
              placeholder="Search Certifications…"
              onChange={(v) => {
                setQuery(v);
                setFocusId(null);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
              onClose={() => setSearchOpen(false)}
              open={searchOpen && !focused}
              query={query}
              onPick={pickFocus}
            />
          </div>

          <div className="lc-scroll">
            {focused && groups ? (
              <>
                <div className="lc-grid">
                  <LinkSection
                    kind="prerequisite"
                    items={groups.prereqs}
                    onRemove={removeEdge}
                    onStrength={updateStrength}
                    onAdd={() => setPicker({ kind: "prerequisite" })}
                    onPickNode={pickFocus}
                  />
                  <LinkSection
                    kind="recommended"
                    items={groups.recommended}
                    onRemove={removeEdge}
                    onStrength={updateStrength}
                    onAdd={() => setPicker({ kind: "recommended" })}
                    onPickNode={pickFocus}
                  />
                  <LinkSection
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
        <SelectCertificationsModal
          title={KIND_ADD_TITLE[picker.kind]}
          description={KIND_ADD_DESC[picker.kind]}
          locked={alreadyLinkedIds(picker.kind)}
          onCancel={() => setPicker(null)}
          onConfirm={(ids) => addLinks(picker.kind, ids)}
        />
      )}
    </div>
  );
}

/* ----------------------------------- Search ----------------------------------- */

/** The page's content picker. Same shell as the Tasks / Certifications bar
 *  (`.usearch` combobox + `.usearch-panel`, Figma 772:1109) — but this bar
 *  SELECTS a certification rather than filtering a table, so the panel rows are
 *  content, not filter scopes, and Enter picks the highlighted row. */
function SearchField({
  value,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  open,
  query,
  onPick,
  onClose,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  open: boolean;
  query: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(-1);

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

  // A fresh result set invalidates the highlight.
  useEffect(() => setActive(-1), [query]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onFocus();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[active >= 0 ? active : 0];
      if (pick) onPick(pick.id);
    } else if (e.key === "Escape") {
      setActive(-1);
      onClose();
    }
  }

  return (
    <div className="usearch lc-search">
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <input
          className="usearch-input"
          placeholder={placeholder}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {/* Figma 399:216 "Search Bar - Applied": once there is something to
            clear, the ⌘K badge gives way to a ✕. */}
        {value ? (
          <button
            type="button"
            className="usearch-clear"
            aria-label="Clear search"
            title="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange("")}
          >
            <SearchClearIcon />
          </button>
        ) : (
          <span className="usearch-kbd">
            <span className="kbd-cmd"><KeyCommandIcon /></span>
            <span className="kbd-letter">K</span>
          </span>
        )}
      </div>

      {open && (
        <div className="usearch-panel" onMouseDown={(e) => e.preventDefault()}>
          <div className="usearch-head">
            {query.trim() ? "Results" : "All content"}
          </div>
          {results.length === 0 ? (
            <div className="usearch-empty">No matches for “{query.trim()}”.</div>
          ) : (
            results.map((n, i) => (
              <button
                key={n.id}
                className={`usearch-row ${active === i ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(n.id);
                }}
              >
                <span className="usearch-row-ex">{n.name}</span>
                <span className="usearch-row-desc">
                  {n.kind} · {n.level} · {n.tasksCount} Tasks
                </span>
              </button>
            ))
          )}
          <SearchHints />
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

function LinkSection({
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
    <section className="lc-sec">
      {/* Figma 802:2255 — 20px SemiBold title with a 24px plus on the far edge. */}
      <div className="lc-sec-head">
        <h2 className="lc-sec-title">
          {KIND_PLURAL[kind]} · {items.length}
        </h2>
        <button
          className="lc-sec-add"
          onClick={onAdd}
          title={KIND_ADD_TITLE[kind]}
          aria-label={KIND_ADD_TITLE[kind]}
        >
          <PlusThinIcon />
        </button>
      </div>

      {/* Figma 801:2099 — the DS wash panel: header row + one row per link. */}
      <div className="lc-panel">
        <div className="lc-row lc-row-head">
          <div className="lc-hcell">CERTIFICATION</div>
          <div className="lc-hcell lc-hcell-str">
            LINK STRENGTH
            <span className="lc-info" data-tip={LINK_STRENGTH_TIP} role="note">
              <InfoIcon />
            </span>
          </div>
        </div>
        {items.map(({ other, strength, edge }) => {
          const n = nodeById(other);
          if (!n) return null;
          return (
            <LinkRow
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
          <div className="lc-panel-empty">Nothing linked yet.</div>
        )}
      </div>
    </section>
  );
}

function LinkRow({
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
    <div className="lc-row">
      {/* The name ellipsises in a narrow column, so the tooltip carries it. */}
      <button className="lc-row-main" onClick={onPick} title={node.name}>
        <span className="lc-row-name">
          {node.name}
          {related && <span className="lc-row-swap" title="Two-way link"> ⇄</span>}
        </span>
        <span className="lc-row-meta">
          {node.industry ?? "—"} · {node.tasksCount} Tasks
        </span>
      </button>
      <div className="lc-row-imp">
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
          aria-label="Link Strength"
        />
        <button className="lc-row-remove" title="Remove Link" onClick={onRemove}>
          <SmallXIcon />
        </button>
      </div>
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
