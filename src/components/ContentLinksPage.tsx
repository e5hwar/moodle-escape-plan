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

const KIND_TAG: Record<LinkKind, string> = {
  prerequisite: "PRE-REQUISITE",
  recommended: "REC NEXT",
  related: "RELATED",
};

const COLOR: Record<LinkKind, string> = {
  prerequisite: "#e97237", // accent orange
  recommended: "#4ea1ff", // blue
  related: "#5fd0a3", // green/teal
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

export function ContentLinksPage() {
  const [focusId, setFocusId] = useState<Focus>(null);
  const [links, setLinks] = useState<Link[]>(seedLinks);
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

  const totalLinkCount = groups
    ? groups.prereqs.length + groups.recommended.length + groups.related.length
    : 0;

  function pickFocus(id: string) {
    setFocusId(id);
    setQuery("");
    setSearchOpen(false);
  }

  function clearFocus() {
    setFocusId(null);
    setQuery("");
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
        <div className="tasks cl-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Content Links</h1>
              <div className="tasks-subtitle">
                {focused ? (
                  <>
                    Showing direct links from <strong style={{ color: "var(--text)", fontWeight: 600 }}>{focused.name}</strong>
                    <span className="tasks-subtitle-dot" />
                    {totalLinkCount} {totalLinkCount === 1 ? "link" : "links"}
                    <span className="tasks-subtitle-dot" />
                    click any node in the graph to focus on it
                  </>
                ) : (
                  <>Connect courses, certifications, and tasks with prerequisites, recommended next steps, and related content.</>
                )}
              </div>
            </div>
            {focused && (
              <button className="resources-btn" onClick={clearFocus}>
                Clear focus
              </button>
            )}
          </header>

          {/* Search bar — always rendered, dropdown reveals on focus */}
          <SearchField
            value={focused ? focused.name : query}
            placeholder="Find a course, certification, or task to view its links…"
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

          {focused && groups ? (
            <div className="cl-body">
              <GraphCard
                focus={focused}
                prereqs={groups.prereqs}
                recommended={groups.recommended}
                related={groups.related}
                onPickNode={pickFocus}
              />
              <DetailPanel
                focus={focused}
                prereqs={groups.prereqs}
                recommended={groups.recommended}
                related={groups.related}
                onRemove={removeEdge}
                onStrength={updateStrength}
                onAdd={(kind) => setPicker({ kind })}
                onPickNode={pickFocus}
              />
            </div>
          ) : (
            <EmptyState onPick={pickFocus} />
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

/* ----------------------------------- Graph ------------------------------------ */

type GroupItem = { other: string; strength: number; edge: Link };

const NODE_W = 200;
const NODE_H = 36;
const GRAPH_H_BASE = 480;

function GraphCard({
  focus,
  prereqs,
  recommended,
  related,
  onPickNode,
}: {
  focus: ContentNode;
  prereqs: GroupItem[];
  recommended: GroupItem[];
  related: GroupItem[];
  onPickNode: (id: string) => void;
}) {
  // Compute layout dynamically: 3 columns. Left column = prereqs. Center = focus.
  // Right column is split into a top stack (recommended) and bottom stack (related).
  const leftCount = prereqs.length;
  const rightTopCount = recommended.length;
  const rightBottomCount = related.length;
  const maxRows = Math.max(leftCount, rightTopCount + rightBottomCount, 1);

  const rowH = NODE_H + 28;
  const innerH = Math.max(GRAPH_H_BASE, rowH * maxRows + 100);
  const W = 880;

  const leftX = 24;
  const rightX = W - NODE_W - 24;
  const centerX = (W - NODE_W) / 2;
  const centerY = innerH / 2 - NODE_H / 2;

  // y positions for left
  const leftStartY = innerH / 2 - ((leftCount - 1) * rowH) / 2 - NODE_H / 2;
  const leftYs = prereqs.map((_, i) => leftStartY + i * rowH);

  // y positions for right top (recommended) above center
  // We give each side its own slot block
  const rightTopBlockH = rightTopCount * rowH;
  const rightBottomBlockH = rightBottomCount * rowH;
  const gapMid = 40;
  const rightStackH = rightTopBlockH + gapMid + rightBottomBlockH;
  const rightStartY = innerH / 2 - rightStackH / 2;
  const recYs = recommended.map((_, i) => rightStartY + i * rowH);
  const relYs = related.map(
    (_, i) => rightStartY + rightTopBlockH + gapMid + i * rowH
  );

  type PlacedNode = {
    id: string;
    name: string;
    x: number;
    y: number;
    kind: LinkKind | "focus";
    strength?: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  };

  const placed: PlacedNode[] = [];

  for (let i = 0; i < prereqs.length; i++) {
    const n = nodeById(prereqs[i].other);
    if (!n) continue;
    const y = leftYs[i];
    placed.push({
      id: n.id,
      name: n.name,
      x: leftX,
      y,
      kind: "prerequisite",
      strength: prereqs[i].strength,
      fromX: leftX + NODE_W,
      fromY: y + NODE_H / 2,
      toX: centerX,
      toY: centerY + NODE_H / 2,
    });
  }
  for (let i = 0; i < recommended.length; i++) {
    const n = nodeById(recommended[i].other);
    if (!n) continue;
    const y = recYs[i];
    placed.push({
      id: n.id,
      name: n.name,
      x: rightX,
      y,
      kind: "recommended",
      strength: recommended[i].strength,
      fromX: centerX + NODE_W,
      fromY: centerY + NODE_H / 2,
      toX: rightX,
      toY: y + NODE_H / 2,
    });
  }
  for (let i = 0; i < related.length; i++) {
    const n = nodeById(related[i].other);
    if (!n) continue;
    const y = relYs[i];
    placed.push({
      id: n.id,
      name: n.name,
      x: rightX,
      y,
      kind: "related",
      strength: related[i].strength,
      fromX: centerX + NODE_W,
      fromY: centerY + NODE_H / 2,
      toX: rightX,
      toY: y + NODE_H / 2,
    });
  }

  return (
    <div className="cl-graph-card">
      <div className="cl-graph-scroll">
        <div className="cl-graph" style={{ width: W, height: innerH }}>
          {/* Header labels above each column */}
          {prereqs.length > 0 && (
            <div className="cl-col-label cl-col-label--prereq" style={{ left: leftX, top: 10, width: NODE_W }}>
              Prerequisites
            </div>
          )}
          {recommended.length > 0 && (
            <div className="cl-col-label cl-col-label--rec" style={{ left: rightX, top: 10, width: NODE_W }}>
              Recommended Next
            </div>
          )}
          {related.length > 0 && (
            <div
              className="cl-col-label cl-col-label--rel"
              style={{
                left: rightX,
                top: rightStartY + rightTopBlockH + (gapMid - 22) / 2,
                width: NODE_W,
              }}
            >
              Related
            </div>
          )}

          {/* SVG edges */}
          <svg
            className="cl-edges"
            width={W}
            height={innerH}
            viewBox={`0 0 ${W} ${innerH}`}
            preserveAspectRatio="none"
          >
            <defs>
              <marker
                id="arrow-prereq"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill={COLOR.prerequisite} />
              </marker>
              <marker
                id="arrow-rec"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill={COLOR.recommended} />
              </marker>
            </defs>
            {placed.map((p) => {
              if (p.kind === "prerequisite") {
                return (
                  <Edge
                    key={`e-${p.id}-pre`}
                    x1={p.fromX}
                    y1={p.fromY}
                    x2={p.toX}
                    y2={p.toY}
                    color={COLOR.prerequisite}
                    strokeWidth={1.6}
                    strength={p.strength!}
                    label={KIND_TAG.prerequisite}
                    marker="url(#arrow-prereq)"
                  />
                );
              }
              if (p.kind === "recommended") {
                return (
                  <Edge
                    key={`e-${p.id}-rec`}
                    x1={p.fromX}
                    y1={p.fromY}
                    x2={p.toX}
                    y2={p.toY}
                    color={COLOR.recommended}
                    strokeWidth={1.6}
                    dash="5 4"
                    strength={p.strength!}
                    label={KIND_TAG.recommended}
                    marker="url(#arrow-rec)"
                  />
                );
              }
              // related — bidirectional, no arrowhead, dotted
              return (
                <Edge
                  key={`e-${p.id}-rel`}
                  x1={p.fromX}
                  y1={p.fromY}
                  x2={p.toX}
                  y2={p.toY}
                  color={COLOR.related}
                  strokeWidth={1.6}
                  dash="1.5 4"
                  strength={p.strength!}
                  label={KIND_TAG.related}
                />
              );
            })}
          </svg>

          {/* Nodes (positioned over the svg) */}
          {placed.map((p) => (
            <button
              key={`n-${p.id}-${p.kind}`}
              className={`cl-node cl-node--${p.kind}`}
              style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
              onClick={() => onPickNode(p.id)}
              title="Focus on this node"
            >
              <span className="cl-node-name">{nodeById(p.id)?.name}</span>
            </button>
          ))}

          {/* Center focus node */}
          <div
            className="cl-node cl-node--focus"
            style={{ left: centerX, top: centerY, width: NODE_W, height: NODE_H }}
          >
            <span className="cl-node-name">{focus.name}</span>
          </div>
        </div>
      </div>

      <div className="cl-legend">
        <span className="cl-legend-item">
          <span className="cl-legend-line cl-legend-line--prereq" />
          <span className="cl-legend-text">→ Prerequisite</span>
        </span>
        <span className="cl-legend-item">
          <span className="cl-legend-line cl-legend-line--rec" />
          <span className="cl-legend-text">⇢ Recommended Next</span>
        </span>
        <span className="cl-legend-item">
          <span className="cl-legend-line cl-legend-line--rel" />
          <span className="cl-legend-text">↔ Related (bidirectional)</span>
        </span>
        <span className="cl-legend-hint">Strength shown as suffix on each label</span>
      </div>
    </div>
  );
}

function Edge({
  x1,
  y1,
  x2,
  y2,
  color,
  strokeWidth,
  dash,
  strength,
  label,
  marker,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
  dash?: string;
  strength: number;
  label: string;
  marker?: string;
}) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        markerEnd={marker}
      />
      <text
        x={midX}
        y={midY - 6}
        fill={color}
        textAnchor="middle"
        fontFamily="Fira Sans, sans-serif"
        fontSize="9"
        fontWeight={700}
        letterSpacing="0.06em"
      >
        {label} · {strength}
      </text>
    </g>
  );
}

/* -------------------------------- Detail panel -------------------------------- */

function DetailPanel({
  focus,
  prereqs,
  recommended,
  related,
  onRemove,
  onStrength,
  onAdd,
  onPickNode,
}: {
  focus: ContentNode;
  prereqs: GroupItem[];
  recommended: GroupItem[];
  related: GroupItem[];
  onRemove: (edge: Link) => void;
  onStrength: (edge: Link, strength: number) => void;
  onAdd: (kind: LinkKind) => void;
  onPickNode: (id: string) => void;
}) {
  return (
    <aside className="cl-panel">
      <div className="cl-panel-eyebrow">UPDATE CONTENT LINKS</div>
      <h2 className="cl-panel-title">{focus.name}</h2>
      <div className="cl-panel-sub">
        {focus.kind} · {focus.level} · {focus.tasksCount} tasks
        {typeof focus.enrolled === "number" ? ` · ${focus.enrolled.toLocaleString()} enrolled` : ""}
      </div>

      <PanelSection
        kind="prerequisite"
        items={prereqs}
        onRemove={onRemove}
        onStrength={onStrength}
        onAdd={() => onAdd("prerequisite")}
        onPickNode={onPickNode}
      />
      <PanelSection
        kind="recommended"
        items={recommended}
        onRemove={onRemove}
        onStrength={onStrength}
        onAdd={() => onAdd("recommended")}
        onPickNode={onPickNode}
      />
      <PanelSection
        kind="related"
        items={related}
        onRemove={onRemove}
        onStrength={onStrength}
        onAdd={() => onAdd("related")}
        onPickNode={onPickNode}
      />
    </aside>
  );
}

function PanelSection({
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
    <section className="cl-section">
      <div className="cl-section-head">
        <span className={`cl-section-bar cl-section-bar--${kind}`} />
        <span className="cl-section-title">{KIND_PLURAL[kind]}</span>
        <span className="cl-section-count">({items.length})</span>
      </div>
      <div className="cl-link-list">
        {items.map(({ other, strength, edge }) => {
          const n = nodeById(other);
          if (!n) return null;
          return (
            <div key={`${edge.from}-${edge.to}-${edge.kind}`} className="cl-link-row">
              <button className="cl-link-main" onClick={() => onPickNode(other)} title="Focus on this node">
                <div className="cl-link-name">{n.name}</div>
                <div className="cl-link-meta">
                  {n.level} · {n.tasksCount} tasks
                </div>
              </button>
              <input
                className="cl-link-strength"
                type="number"
                min={0}
                max={100}
                value={strength}
                onChange={(e) => {
                  const next = Math.max(0, Math.min(100, Number(e.target.value || 0)));
                  onStrength(edge, next);
                }}
                aria-label="Strength"
              />
              <button
                className="cl-link-remove"
                aria-label="Remove link"
                onClick={() => onRemove(edge)}
              >
                <SmallXIcon />
              </button>
            </div>
          );
        })}
        <button className="cl-link-add" onClick={onAdd}>
          + Add {kind === "prerequisite" ? "Prerequisite" : kind === "recommended" ? "Recommended Next" : "Related"}
        </button>
      </div>
    </section>
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
