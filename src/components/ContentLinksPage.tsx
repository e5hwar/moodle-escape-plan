import { useEffect, useMemo, useRef, useState } from "react";
import {
  nodes as allNodes,
  links as seedLinks,
  type ContentNode,
  type Link,
  type LinkKind,
} from "../data/contentLinks";
import { certifications, formatTimeToComplete } from "../data/certifications";
import { SelectRequirementModal } from "./SelectRequirementModal";
import { SearchHints, stepActive, ResultsHead, HighlightMatch, SearchNoResults } from "./SearchPanelParts";
import { SkeletonOverlay } from "./SkeletonOverlay";
import { draftKey, useLeaveGuard } from "./LeaveGuard";
import { useToast } from "./useToast";
import {
  KeyCommandIcon,
  InfoIcon,
  RowCloseIcon,
  SearchIcon,
  SearchClearIcon,
  TreeAddIcon,
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
 * 2026-10-01 — 802:2260 re-cut: a 16px title with no count or plus, the add
 * affordance is the panel's last row (the shared `.qz-addrow`), the row meta
 * gains the Time to Complete, and a `.form-help` line under each panel says
 * what the section means (it replaces the page-subtext ⓘ that carried it).
 *
 * 2026-10-01 — Referenced By left the scroll for a pinned footer (Figma
 * 1417:1373): one sentence naming who recommends this Certification and who
 * lists it as a prerequisite, the names linking to their own Content Links.
 *
 * 2026-08-30 — the search bar moved onto the shared `.usearch` combobox shell
 * (the Tasks / Certifications bar) with keyboard navigation. It stays a PICKER:
 * the panel lists content to focus, not filter scopes to apply. */

type Focus = string | null;

// What one link of each kind is called — the picker's locked-row tip.
const KIND_LABEL: Record<LinkKind, string> = {
  prerequisite: "Pre-Requisite",
  recommended: "Recommended Next",
  related: "Related Certification",
};

const KIND_PLURAL: Record<LinkKind, string> = {
  prerequisite: "Pre-Requisites",
  recommended: "Recommended Next",
  related: "Related",
};

// The panel's last row (Figma 1416:1365) — one link at a time reads singular.
const KIND_ADD_ROW: Record<LinkKind, string> = {
  prerequisite: "Add Pre-Requisite",
  recommended: "Add Recommended Next",
  related: "Add Related Certification",
};

// Nothing linked yet — the card-table empty row (Figma 1570:3518, list item
// 39), worded like Product Config's "No Force Updates Configured Yet".
const KIND_EMPTY: Record<LinkKind, string> = {
  prerequisite: "No Pre-Requisites Added Yet",
  recommended: "No Recommended Next Added Yet",
  related: "No Related Certifications Added Yet",
};

// The picker adds several at once, so its title is plural.
const KIND_ADD_TITLE: Record<LinkKind, string> = {
  prerequisite: "Add Pre-Requisites",
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

/* What each section means — the subtext under its panel (Figma 1416:1360).
 * Moved verbatim from the page-subtext ⓘ, which is gone. */
const KIND_HELP: Record<LinkKind, string> = {
  prerequisite:
    "Content the user should study before starting this Certification. Without it, they may struggle to follow the concepts here.",
  recommended:
    "Where the user should go to learn more about this topic after finishing. Use this for depth: the next level up on the same subject.",
  related:
    "Adjacent topics at the same level, for users who want to explore sideways rather than go deeper.",
};

// Tooltip on every section's LINK STRENGTH column header.
const LINK_STRENGTH_TIP =
  "A value between 0 and 100 that controls the order links appear in. Higher Link Strength shows first. " +
  "Only compared against other links of the same type on this Certification - a Pre-Requisite at 90 and a Related at 80 don't compete with each other.";

/* Row meta (Figma 801:2111, "HVAC · 10-12 Hours") ends on the Time to
 * Complete. Content nodes don't carry one, so it comes from the catalog
 * Certification of the same name — node names match certifications.ts. */
const TIME_BY_NAME = new Map(
  certifications.map((c) => [c.name, formatTimeToComplete(c.timeToComplete)])
);

/* The picker lists catalog Certifications, but a link needs a graph node:
 * these map the two by name (node names match certifications.ts). */
const NODE_ID_BY_NAME = new Map(
  allNodes.filter((n) => n.kind === "Certification").map((n) => [n.name, n.id]),
);
const LINKABLE_CERTS = certifications.filter((c) => NODE_ID_BY_NAME.has(c.name));

function rowMeta(n: ContentNode): string {
  return [n.industry, TIME_BY_NAME.get(n.name)].filter(Boolean).join(" · ") || "—";
}

function nodeById(id: string): ContentNode | undefined {
  return allNodes.find((n) => n.id === id);
}

function edgeKey(e: Link): string {
  return `${e.from}-${e.to}-${e.kind}`;
}

/**
 * For focus F, compute three lists.
 *  - prerequisites: edges where to=F and kind=prerequisite (source is the prereq)
 *  - recommended:   edges where from=F and kind=recommended (target is the next)
 *  - related:       edges where (from=F or to=F) and kind=related
 *
 * Each list is ordered by the SAVED strength, not the one being edited, so a
 * row never jumps while its number is typed — the lists re-sort on Save. A
 * link added since the last save has no saved strength and sits at the bottom,
 * in the order it was added.
 */
function partition(
  focusId: string,
  links: Link[],
  savedStrength: Map<string, number>,
) {
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
  // Strengths are 0–100, so -1 ranks unsaved links last; the sort is stable.
  const rank = (x: { edge: Link }) => savedStrength.get(edgeKey(x.edge)) ?? -1;
  const bySaved = (a: { edge: Link }, b: { edge: Link }) => rank(b) - rank(a);
  prereqs.sort(bySaved);
  recommended.sort(bySaved);
  related.sort(bySaved);
  return { prereqs, recommended, related };
}

export function ContentLinksPage({
  initialFocus,
  onBack,
  backLabel,
  links: savedLinks = seedLinks,
  onSaveLinks,
}: {
  initialFocus?: ContentNode;
  onBack?: () => void;
  backLabel?: string;
  /** The graph as last saved. App.tsx holds it, so a Certification's Setup
   *  card can tell whether it has Content Links yet; without it the page
   *  works on the seed alone. */
  links?: Link[];
  /** Save Changes hands the new graph back up. */
  onSaveLinks?: (links: Link[]) => void;
} = {}) {
  const [focusId, setFocusId] = useState<Focus>(initialFocus?.id ?? null);
  const [links, setLinks] = useState<Link[]>(savedLinks);
  // Last-saved snapshot; the Save / Discard footer diffs the working set against it.
  const [baseline, setBaseline] = useState<Link[]>(savedLinks);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

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

  const savedStrength = useMemo(
    () => new Map(baseline.map((e) => [edgeKey(e), e.strength])),
    [baseline]
  );

  const groups = useMemo(
    () => (focusId ? partition(focusId, links, savedStrength) : null),
    [focusId, links, savedStrength]
  );

  // "Referenced by" = relationships authored on *other* certifications that point
  // at this one. They're read-only here (edit them from the other cert's page):
  //  - this cert is a prerequisite of another
  //  - another cert recommends this one as next
  const referencedBy = useMemo(() => {
    const out: RefItem[] = [];
    if (!focusId) return out;
    for (const e of links) {
      if (e.kind === "prerequisite" && e.from === focusId) {
        const n = nodeById(e.to);
        if (n) out.push({ id: n.id, name: n.name, kind: "prerequisite" });
      } else if (e.kind === "recommended" && e.to === focusId) {
        const n = nodeById(e.from);
        if (n) out.push({ id: n.id, name: n.name, kind: "recommended" });
      }
    }
    return out;
  }, [focusId, links]);

  // Reference identity: any add / remove / strength edit produces a new array.
  const dirty = links !== baseline;
  // Leaving asks only when the graph really differs — a link added and
  // removed again, or a strength put back, is nothing to lose.
  const changed = useMemo(
    () => dirty && draftKey(links) !== draftKey(baseline),
    [dirty, links, baseline],
  );
  // Staged edits ask before the crumb throws them away. Switching the focused
  // Certification doesn't: `links` is the whole graph, so edits survive it.
  const guard = useLeaveGuard(changed);
  const [toast, toastNode] = useToast();

  function pickFocus(id: string) {
    setFocusId(id);
    setQuery("");
    setSearchOpen(false);
  }

  function saveChanges() {
    setBaseline(links);
    onSaveLinks?.(links);
    toast("Content Links Saved");
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
      {toastNode}
      <div className="workspace">
        <div className="tasks lc-page">
          {/* Reached from a Certification's 3-dot menu — the crumb is the way back. */}
          {onBack && (
            <nav className="rvc-crumbs" aria-label="Breadcrumb">
              <button
                className="rvc-crumb"
                onClick={() => guard(onBack)}
                title={`Back to ${backLabel ?? "Certifications"}`}
              >
                {backLabel ?? "Certifications"}
              </button>
            </nav>
          )}
          <header className="tasks-header">
            <div className="rvc-pagehead">
              {/* The focused Certification is named in the search bar, not here. */}
              <h1 className="tasks-title">Content Links</h1>
              {/* What each section means lives under its own panel now. */}
              <div className="tasks-subtitle">
                Suggest what a user should study before, after, or alongside
                this Certification.
              </div>
            </div>
          </header>

          <div className="toolbar">
            <SearchField
              value={focused ? focused.name : query}
              placeholder="Search Certifications..."
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
              inputRef={searchInput}
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
              </>
            ) : (
              <EmptyState
                dull={searchOpen}
                onSearch={() => searchInput.current?.focus()}
              />
            )}
          </div>

          {/* Pinned under the scroll like a table's pagination row — the
              panels scroll up to its rule. */}
          {focused && referencedBy.length > 0 && (
            <ReferencedByFooter items={referencedBy} onPickNode={pickFocus} />
          )}

          {/* Same in-flow save footer as the Spotlights reorder bar — spans the
              content column only, stops at the left nav. Shown only while
              the graph really differs from the saved one — an edit undone
              leaves nothing to save, so the bar goes away again. */}
          {focused && changed && (
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

      {/* The shared Certification picker (the Select Requirement modal,
          Certifications only) — the Certifications table's columns, pills and
          search. Links are stored by graph node, and nodes are named after
          catalog Certifications, so the picker lists the catalog rows the
          graph can link and the names are mapped back to node ids on confirm. */}
      {picker && focusId && (
        <SelectRequirementModal
          only="cert"
          title={KIND_ADD_TITLE[picker.kind]}
          description={KIND_ADD_DESC[picker.kind]}
          confirmNoun="Link"
          certPool={LINKABLE_CERTS}
          existingNames={Array.from(alreadyLinkedIds(picker.kind))
            .map((id) => nodeById(id)?.name)
            .filter((n): n is string => !!n)}
          lockedFlag={(name) => (name === nodeById(focusId)?.name ? "This Certification" : "Already linked")}
          lockedTip={(name) =>
            name === nodeById(focusId)?.name
              ? "A Certification can't link to itself"
              : `Already a ${KIND_LABEL[picker.kind]} of this Certification`
          }
          onCancel={() => setPicker(null)}
          onConfirm={(picks) =>
            addLinks(
              picker.kind,
              picks
                .map((p) => (p.kind === "cert" ? NODE_ID_BY_NAME.get(p.cert.name) : undefined))
                .filter((id): id is string => !!id),
            )
          }
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
  inputRef,
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
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);

  // A press anywhere outside the bar and its panel closes the panel — blur
  // alone misses it when focus never leaves the input (or never arrived).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (root.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

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
      setActive((i) => stepActive(i, results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => stepActive(i, results.length, -1));
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
    <div className="usearch lc-search" ref={root}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
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
          <ResultsHead query={query} label="All content" />
          {results.length === 0 ? (
            <SearchNoResults />
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
                <span className="usearch-row-name"><HighlightMatch text={n.name} query={query} /></span>
                <span className="usearch-row-desc">
                  {n.kind} · {n.level}
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

/** Same shape as Manage Completions' empty state (`.mc-empty`): the three link
 *  panels the page is about to load drawn as a ghost backdrop, with the
 *  question centred over it and a CTA that opens the search (⌘K does too). */
function EmptyState({ dull, onSearch }: { dull: boolean; onSearch: () => void }) {
  return (
    <div className="mc-empty lc-empty">
      <LinksGhost />
      <SkeletonOverlay
        title="Select a Certification"
        sub="Its prerequisites, recommended next steps, and related Certifications load here — with the strength of every link."
        cta="Search Certifications"
        onCta={onSearch}
        dull={dull}
      />
    </div>
  );
}

const GHOST_LINK_ROWS = [0, 1, 2, 3];

/** The three `.lc-sec` panels with every value replaced by a bar. */
function LinksGhost() {
  return (
    <div className="mc-ghost lc-ghost" aria-hidden="true">
      <div className="lc-grid">
        {[0, 1, 2].map((c) => (
          <section className="lc-sec" key={c}>
            <span className="mc-ghost-bar lc-ghost-title" />
            <div className="lc-panel">
              <div className="lc-row lc-row-head">
                <span className="mc-ghost-bar lc-ghost-th" />
                <span className="mc-ghost-bar lc-ghost-th lc-ghost-th-str" />
              </div>
              {GHOST_LINK_ROWS.map((r) => (
                <div className="lc-row lc-ghost-row" key={r}>
                  <span className="lc-ghost-lines">
                    <span className="mc-ghost-bar lc-ghost-name" />
                    <span className="mc-ghost-bar lc-ghost-meta" />
                  </span>
                  <span className="lc-ghost-box" />
                </div>
              ))}
              <div className="lc-row lc-ghost-add">
                <span className="mc-ghost-bar lc-ghost-add-bar" />
              </div>
            </div>
            <span className="mc-ghost-bar lc-ghost-help" />
          </section>
        ))}
      </div>
    </div>
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
      {/* Figma 1416:1370 — 16px SemiBold, no count. */}
      <h2 className="lc-sec-title">{KIND_PLURAL[kind]}</h2>

      {/* Figma 801:2099 — the DS wash panel: header row, one row per link, then
          the Add row. With nothing linked it is the card-table empty state
          (1570:3518): the header, one #404040 line, then the Add row. */}
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
        {items.length === 0 && <div className="qz-empty">{KIND_EMPTY[kind]}</div>}
        {items.map(({ other, strength, edge }) => {
          const n = nodeById(other);
          if (!n) return null;
          return (
            <LinkRow
              key={edgeKey(edge)}
              node={n}
              strength={strength}
              onStrength={(v) => onStrength(edge, v)}
              onRemove={() => onRemove(edge)}
              onPick={() => onPickNode(other)}
            />
          );
        })}
        {/* Figma 1416:1362 — the Quiz Questions card's Add row (`.qz-addrow`),
            the panel's last row so it drops the hairline. */}
        <div className="qz-addrow qz-addrow--last">
          <button className="qz-addrow-btn" onClick={onAdd}>
            <TreeAddIcon />
            {KIND_ADD_ROW[kind]}
          </button>
        </div>
      </div>

      <p className="form-help">{KIND_HELP[kind]}</p>
    </section>
  );
}

function LinkRow({
  node,
  strength,
  onStrength,
  onRemove,
  onPick,
}: {
  node: ContentNode;
  strength: number;
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
        </span>
        <span className="lc-row-meta">{rowMeta(node)}</span>
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
          <RowCloseIcon />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- Referenced by ------------------------------- */

type RefItem = { id: string; name: string; kind: "prerequisite" | "recommended" };

/** Figma 1417:1373 — "Referenced by 4 · A, B and C recommend this
 *  Certification to users following their completion. D lists this as a
 *  prerequisite." Each name opens that Certification's own Content Links. */
function ReferencedByFooter({
  items,
  onPickNode,
}: {
  items: RefItem[];
  onPickNode: (id: string) => void;
}) {
  const recommenders = items.filter((r) => r.kind === "recommended");
  const prereqOf = items.filter((r) => r.kind === "prerequisite");
  // A Certification on both sides is still one referrer.
  const count = new Set(items.map((r) => r.id)).size;

  function names(list: RefItem[]) {
    return list.map((r, i) => (
      <span key={`${r.id}-${i}`}>
        {i > 0 && (i === list.length - 1 ? " and " : ", ")}
        <button className="lc-foot-link" onClick={() => onPickNode(r.id)}>
          {r.name}
        </button>
      </span>
    ));
  }

  return (
    <footer className="lc-foot">
      <p className="lc-foot-text">
        <span className="lc-foot-count">Referenced by {count}</span>
        {" · "}
        {recommenders.length > 0 && (
          <>
            {names(recommenders)}
            {recommenders.length === 1 ? " recommends" : " recommend"} this
            Certification to users following their completion.
          </>
        )}
        {recommenders.length > 0 && prereqOf.length > 0 && " "}
        {prereqOf.length > 0 && (
          <>
            {names(prereqOf)}
            {prereqOf.length === 1 ? " lists" : " list"} this as a prerequisite.
          </>
        )}
      </p>
    </footer>
  );
}
