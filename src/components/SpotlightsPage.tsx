import { useMemo, useState } from "react";
import {
  spotlights as seedSpotlights,
  type Spotlight,
  type SpotlightStatus,
} from "../data/spotlights";
import { CreateSpotlightPanel } from "./CreateSpotlightPanel";
import { SearchIcon, EnterKeyIcon, DragHandleIcon, SmallXIcon } from "./icons";

type FilterKey = "all" | "approved" | "pending" | "rejected";

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "All",
  approved: "Active",
  pending: "Pending",
  rejected: "Rejected",
};

const STATUS_LABEL: Record<SpotlightStatus, string> = {
  approved: "Active",
  pending: "Pending Approval",
  rejected: "Rejected",
  deactivated: "Deactivated",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const today = new Date("2026-05-15");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function SpotlightsPage() {
  const [list, setList] = useState<Spotlight[]>(seedSpotlights);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [creating, setCreating] = useState(false);
  // index in `list` where the placeholder sits while the create panel is open
  const [placeholderIndex, setPlaceholderIndex] = useState<number>(0);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const counts = useMemo(() => {
    const c = { approved: 0, pending: 0, rejected: 0, deactivated: 0 };
    list.forEach((s) => (c[s.status] += 1));
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (q && !(
        s.headingEn.toLowerCase().includes(q) ||
        (s.descriptionEn ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.submittedBy.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [list, query, filter]);

  function openCreate() {
    setCreating(true);
    setPlaceholderIndex(list.length); // default to bottom of full list
    setFilter("all");
    setQuery("");
  }

  function closeCreate() {
    setCreating(false);
    setDragOverIndex(null);
    setIsDragging(false);
  }

  function handleSubmit(draft: {
    headingEn: string;
    headingEs: string;
    descriptionEn: string;
    descriptionEs: string;
    ctaTextEn: string;
    ctaTextEs: string;
    ctaUrl: string;
    endDate: string;
    imageHint?: string;
  }) {
    const id = `SP-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const newSpotlight: Spotlight = {
      id,
      headingEn: draft.headingEn || "Untitled Spotlight",
      headingEs: draft.headingEs || undefined,
      descriptionEn: draft.descriptionEn || undefined,
      descriptionEs: draft.descriptionEs || undefined,
      ctaTextEn: draft.ctaTextEn || undefined,
      ctaTextEs: draft.ctaTextEs || undefined,
      ctaUrl: draft.ctaUrl || undefined,
      endDate: draft.endDate,
      imageHint: draft.imageHint,
      submittedBy: "You",
      submittedAt: "2026-05-15",
      status: "pending",
    };
    const next = [...list];
    next.splice(placeholderIndex, 0, newSpotlight);
    setList(next);
    closeCreate();
  }

  // Build the rendered queue: when creating, insert a placeholder at placeholderIndex.
  type Row =
    | { kind: "spotlight"; item: Spotlight; queueIndex: number }
    | { kind: "placeholder"; queueIndex: number };

  const rows: Row[] = useMemo(() => {
    if (!creating) {
      return filtered.map((item) => ({
        kind: "spotlight" as const,
        item,
        queueIndex: list.indexOf(item),
      }));
    }
    // When creating, show the entire list (ignoring filters/search for clarity)
    const result: Row[] = [];
    for (let i = 0; i <= list.length; i++) {
      if (i === placeholderIndex) {
        result.push({ kind: "placeholder", queueIndex: i });
      }
      if (i < list.length) {
        result.push({ kind: "spotlight", item: list[i], queueIndex: i });
      }
    }
    return result;
  }, [creating, list, filtered, placeholderIndex]);

  function onPlaceholderDragStart(e: React.DragEvent) {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "placeholder");
  }

  function onPlaceholderDragEnd() {
    setIsDragging(false);
    setDragOverIndex(null);
  }

  function onRowDragOver(e: React.DragEvent, beforeIndex: number) {
    if (!isDragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(beforeIndex);
  }

  function onRowDrop(e: React.DragEvent, beforeIndex: number) {
    e.preventDefault();
    setPlaceholderIndex(beforeIndex);
    setDragOverIndex(null);
    setIsDragging(false);
  }

  return (
    <div className={`main ${creating ? "sp-creating" : ""}`}>
      <div className="workspace">
        <div className="tasks sp-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Spotlight</h1>
              <div className="tasks-subtitle">
                <span>{counts.approved} active</span>
                <span className="tasks-subtitle-dot" />
                <span>{counts.pending} pending approval</span>
                <span className="tasks-subtitle-dot" />
                <span>shown on the app Home Screen in queue order</span>
              </div>
            </div>
          </header>

          {creating && (
            <div className="sp-position-banner">
              <span className="sp-position-banner-dot" />
              <div className="sp-position-banner-text">
                <strong>Set queue position.</strong> Drag your new Spotlight (the
                dashed card) up or down to place it where you want it shown.
                Approvers can adjust this before approving.
              </div>
            </div>
          )}

          <div className="sp-controls">
            <div className="search-wrap sp-search">
              <span className="search-icon">
                <SearchIcon />
              </span>
              <input
                className="search-input"
                placeholder="Search Spotlights by heading, ID, or submitter…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={creating}
              />
              <span className="search-kbd">
                <span className="kbd-cmd">⌘</span>
                <span className="kbd-letter">K</span>
              </span>
            </div>
            <div className="sp-tabs">
              {(["all", "approved", "pending", "rejected"] as FilterKey[]).map(
                (k) => (
                  <button
                    key={k}
                    className={`sp-tab ${filter === k ? "is-active" : ""}`}
                    onClick={() => setFilter(k)}
                    disabled={creating}
                  >
                    {FILTER_LABEL[k]}
                    {k !== "all" && (
                      <span className="sp-tab-count">
                        {k === "approved"
                          ? counts.approved
                          : k === "pending"
                          ? counts.pending
                          : counts.rejected}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="tasks-scroll sp-scroll">
            <div className="sp-list">
              {rows.length === 0 && !creating ? (
                <div className="sp-empty">
                  No Spotlights match. Try a different filter or search term.
                </div>
              ) : (
                rows.map((r, idx) => (
                  <SpotlightRow
                    key={r.kind === "placeholder" ? "ph" : r.item.id}
                    row={r}
                    displayIndex={idx + 1}
                    showDropAbove={
                      creating && dragOverIndex === r.queueIndex && isDragging
                    }
                    creating={creating}
                    onDragOver={(e) => onRowDragOver(e, r.queueIndex)}
                    onDrop={(e) => onRowDrop(e, r.queueIndex)}
                    onPlaceholderDragStart={onPlaceholderDragStart}
                    onPlaceholderDragEnd={onPlaceholderDragEnd}
                    onMoveUp={() =>
                      r.kind === "placeholder" &&
                      setPlaceholderIndex(Math.max(0, placeholderIndex - 1))
                    }
                    onMoveDown={() =>
                      r.kind === "placeholder" &&
                      setPlaceholderIndex(
                        Math.min(list.length, placeholderIndex + 1),
                      )
                    }
                  />
                ))
              )}
              {/* end-of-list drop zone when creating */}
              {creating && (
                <div
                  className={`sp-drop-end ${
                    dragOverIndex === list.length && isDragging
                      ? "is-active"
                      : ""
                  }`}
                  onDragOver={(e) => onRowDragOver(e, list.length)}
                  onDrop={(e) => onRowDrop(e, list.length)}
                >
                  {dragOverIndex === list.length && isDragging
                    ? "Drop to place at the bottom"
                    : ""}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="footer">
        {creating ? (
          <button className="btn-save-draft" onClick={closeCreate}>
            Cancel
          </button>
        ) : (
          <button className="new-task" onClick={openCreate}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Spotlight
            <span className="cta-kbd">
              <EnterKeyIcon />
            </span>
          </button>
        )}
      </footer>

      {creating && (
        <CreateSpotlightPanel
          onClose={closeCreate}
          onSubmit={handleSubmit}
          placeholderPosition={placeholderIndex + 1}
          totalAfter={list.length + 1}
        />
      )}
    </div>
  );
}

function SpotlightRow({
  row,
  displayIndex,
  showDropAbove,
  creating,
  onDragOver,
  onDrop,
  onPlaceholderDragStart,
  onPlaceholderDragEnd,
  onMoveUp,
  onMoveDown,
}: {
  row:
    | { kind: "spotlight"; item: Spotlight; queueIndex: number }
    | { kind: "placeholder"; queueIndex: number };
  displayIndex: number;
  showDropAbove: boolean;
  creating: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onPlaceholderDragStart: (e: React.DragEvent) => void;
  onPlaceholderDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  if (row.kind === "placeholder") {
    return (
      <div
        className="sp-row sp-row--placeholder"
        draggable
        onDragStart={onPlaceholderDragStart}
        onDragEnd={onPlaceholderDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {showDropAbove && <div className="sp-drop-marker" />}
        <span className="sp-row-grab">
          <DragHandleIcon />
        </span>
        <span className="sp-row-pos">{displayIndex}</span>
        <div className="sp-row-preview sp-row-preview--placeholder">
          <span className="sp-preview-fallback">SP</span>
        </div>
        <div className="sp-row-body">
          <div className="sp-row-titles">
            <span className="sp-row-tag sp-row-tag--new">YOUR NEW SPOTLIGHT</span>
            <span className="sp-row-name sp-row-name--muted">
              Fill in the details on the right — drag this card to reposition.
            </span>
          </div>
        </div>
        <div className="sp-row-actions">
          <button
            className="sp-reorder-btn"
            onClick={onMoveUp}
            aria-label="Move up"
            title="Move up"
          >
            ▲
          </button>
          <button
            className="sp-reorder-btn"
            onClick={onMoveDown}
            aria-label="Move down"
            title="Move down"
          >
            ▼
          </button>
        </div>
      </div>
    );
  }

  const s = row.item;
  const days = daysUntil(s.endDate);
  const isExpiring = days >= 0 && days <= 7;
  const isExpired = days < 0;

  return (
    <div
      className={`sp-row sp-row--${s.status}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {showDropAbove && <div className="sp-drop-marker" />}
      <span className={`sp-row-grab ${creating ? "is-dim" : ""}`}>
        <DragHandleIcon />
      </span>
      <span className="sp-row-pos">{displayIndex}</span>
      <SpotlightPreview spotlight={s} />
      <div className="sp-row-body">
        <div className="sp-row-titles">
          <div className="sp-row-meta-line">
            <span className={`sp-status sp-status--${s.status}`}>
              {STATUS_LABEL[s.status]}
            </span>
            <span className="sp-row-id">{s.id}</span>
          </div>
          <div className="sp-row-name">{s.headingEn}</div>
          {s.descriptionEn && (
            <div className="sp-row-desc">{s.descriptionEn}</div>
          )}
        </div>
        <div className="sp-row-meta">
          <span className="sp-meta-item">
            By <strong>{s.submittedBy}</strong>
          </span>
          <span className="sp-row-meta-dot" />
          <span className={`sp-meta-item ${isExpiring ? "is-warning" : ""} ${isExpired ? "is-expired" : ""}`}>
            Ends {formatDate(s.endDate)}
            {!isExpired && days <= 14 && days >= 0 ? (
              <span className="sp-meta-sub"> · {days === 0 ? "today" : `${days}d left`}</span>
            ) : null}
            {isExpired ? <span className="sp-meta-sub"> · expired</span> : null}
          </span>
          {s.ctaTextEn && (
            <>
              <span className="sp-row-meta-dot" />
              <span className="sp-meta-item">CTA: "{s.ctaTextEn}"</span>
            </>
          )}
        </div>
      </div>
      <div className="sp-row-actions">
        {s.status === "pending" ? (
          <>
            <button className="sp-mini-btn sp-mini-btn--approve">Approve</button>
            <button className="sp-mini-btn">Reject</button>
          </>
        ) : (
          <button className="sp-mini-btn" aria-label="More">
            <SmallXIcon />
            <span style={{ marginLeft: 6 }}>Deactivate</span>
          </button>
        )}
      </div>
    </div>
  );
}

function SpotlightPreview({ spotlight }: { spotlight: Spotlight }) {
  // Compact card mirroring the app's mobile Spotlight UI.
  return (
    <div className="sp-row-preview">
      <div className="sp-preview-img" aria-hidden>
        {spotlight.imageHint ? (
          <span className="sp-preview-img-tag">IMG</span>
        ) : (
          <span className="sp-preview-fallback-mini">SP</span>
        )}
      </div>
      <div className="sp-preview-inner">
        <div className="sp-preview-heading">{spotlight.headingEn}</div>
        {spotlight.ctaTextEn && (
          <div className="sp-preview-cta">{spotlight.ctaTextEn}</div>
        )}
      </div>
    </div>
  );
}
