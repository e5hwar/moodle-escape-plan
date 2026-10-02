import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CopiedToast } from "./CopiedToast";
import { ModalCloseIcon } from "./PrmModal";
import { RowEditIcon, RowKebabIcon } from "./icons";

/** How long the panel takes to leave — must match `.pp-overlay--closing`. */
const CLOSE_MS = 160;

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export type PreviewDevice = "phone" | "web";

/** One figure in the stat strip — drawn as a Review Runs card (1393:1794):
 *  the count in its own cell, the title and a grey sub-line beside it. */
export type PreviewStat = { count: string; title: string; sub?: string };

/** A quiet head action (`.cta-quiet`). `copy` puts that text on the clipboard
 *  and confirms with the shared toast instead of running `onClick`. */
export type PreviewAction = { label: string; icon: ReactNode; onClick?: () => void; copy?: string };

export type PreviewTab = { key: string; label: string; content: ReactNode };

/** The row preview panel ("Preview Panel 3a"), built from the design system:
 *  a full-height panel on the app's panel surface over the modals' scrim. The
 *  left column is the record — the dialog head (`.prm-*`, optional avatar),
 *  a meta strip of plain values and status pills, the action row (Primary CTA
 *  Edit, `.cta-quiet` actions, the quiet kebab), the stat strip, the shared
 *  `.tabbar`, then a scrolling body of review cards. Learner-facing records
 *  (Certifications, Tasks) add a preview column with a Phone / Web
 *  `.seg-control`; the panel widens for Web.
 *
 *  `role="dialog"` sits on the panel, not the fixed overlay: App.tsx finds the
 *  open modal for ⌘K by `offsetParent`, which is null on a fixed element. */
export function PreviewPanel({
  title,
  description,
  avatar,
  meta = [],
  onEdit,
  actions = [],
  onMore,
  stats,
  tabs,
  preview,
  onClose,
}: {
  title: string;
  description?: ReactNode;
  /** Leads the title — a person's `.mc-avatar`. */
  avatar?: ReactNode;
  /** The strip under the head — joined with dots. Falsy entries are dropped. */
  meta?: ReactNode[];
  onEdit?: () => void;
  actions?: PreviewAction[];
  /** The kebab: hands back its rect so the page can open its own row menu. */
  onMore?: (rect: DOMRect) => void;
  stats?: PreviewStat[];
  tabs: PreviewTab[];
  /** Renders the record as a learner sees it. Present → the preview column. */
  preview?: (device: PreviewDevice) => ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const [tab, setTab] = useState(tabs[0]?.key);
  const [device, setDevice] = useState<PreviewDevice>("phone");
  const [copiedAt, setCopiedAt] = useState(0);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => prev?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape closes an open row menu first, not the panel under it.
      if (document.querySelector(".u-menu")) return;
      requestClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  const shown = tabs.find((t) => t.key === tab) ?? tabs[0];
  const metaItems = meta.filter(Boolean);

  const closeButton = (
    <button className="prm-close" onClick={requestClose} aria-label="Close">
      <ModalCloseIcon />
    </button>
  );

  return (
    <div
      className={`pp-overlay${closing ? " pp-overlay--closing" : ""}`}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        className={`pp${preview ? ` pp--preview pp--${device}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pp-main">
          <div className="pp-head">
            <div className="prm-headgroup">
              <div className="prm-head">
                <div className="pp-ident">
                  {avatar}
                  <h2 className="prm-title">{title}</h2>
                </div>
                {!preview && closeButton}
              </div>
              {description && <p className="prm-text">{description}</p>}
            </div>

            {metaItems.length > 0 && (
              <div className="pp-meta">
                {metaItems.map((m, i) => (
                  <span key={i} className="pp-meta-item">
                    {i > 0 && <span className="pp-meta-sep">·</span>}
                    {m}
                  </span>
                ))}
              </div>
            )}

            {(onEdit || actions.length > 0 || onMore) && (
              <div className="pp-actions">
                {onEdit && (
                  <button className="cta-primary" onClick={onEdit}>
                    <RowEditIcon />
                    Edit
                  </button>
                )}
                {actions.map((a) => (
                  <button
                    key={a.label}
                    className="cta-quiet"
                    onClick={() => {
                      if (a.copy !== undefined) {
                        navigator.clipboard?.writeText(a.copy).catch(() => {});
                        setCopiedAt(Date.now());
                      } else a.onClick?.();
                    }}
                  >
                    {a.icon}
                    {a.label}
                  </button>
                ))}
                {onMore && (
                  <button
                    className="cta-quiet cta-quiet--icon pp-more"
                    aria-label="More actions"
                    data-tip="More actions"
                    onClick={(e) => onMore(e.currentTarget.getBoundingClientRect())}
                  >
                    <RowKebabIcon />
                  </button>
                )}
              </div>
            )}

            {stats && stats.length > 0 && (
              <div className="pp-stats">
                {stats.map((s) => (
                  <div key={s.title} className="rr-card pp-stat">
                    <span className="rr-count">{s.count}</span>
                    <span className="rr-text">
                      <span className="rr-title">{s.title}</span>
                      {s.sub && <span className="rr-sub">{s.sub}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tabs.length > 1 && (
              <div className="tabbar pp-tabs" role="tablist" aria-label={title}>
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={t.key === shown?.key}
                    className={`tab${t.key === shown?.key ? " is-active" : ""}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pp-body" key={shown?.key}>
            {shown?.content}
          </div>
        </div>

        {preview && (
          <div className="pp-side">
            <div className="pp-side-head">
              <div className="seg-control" role="group" aria-label="Preview device">
                {(["phone", "web"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`seg-btn${device === d ? " active" : ""}`}
                    aria-pressed={device === d}
                    onClick={() => setDevice(d)}
                  >
                    {d === "phone" ? "Phone" : "Web"}
                  </button>
                ))}
              </div>
              {closeButton}
            </div>
            <div className="pp-stage">{preview(device)}</div>
          </div>
        )}
        {copiedAt > 0 && (
          <CopiedToast key={copiedAt} label="Link Copied" onDone={() => setCopiedAt(0)} />
        )}
      </div>
    </div>
  );
}

/* ─────────────── The learner-side preview ─────────────── */

export type PreviewItemKind = "xapi" | "quiz" | "hands-on" | "file";

const KIND_ICON: Record<PreviewItemKind, string> = {
  xapi: "M7 5v14l11-7z",
  quiz: "M4 5h16v14H4zM9 12l2 2 4-4",
  "hands-on": "M3 8h4l2-3h6l2 3h4v11H3zM12 10.5a3 3 0 1 0 0 6 3 3 0 1 0 0-6z",
  file: "M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1",
};

function KindIcon({ kind }: { kind: PreviewItemKind }) {
  return (
    <svg className="pps-kind" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={KIND_ICON[kind]} />
    </svg>
  );
}

export type PreviewScreenModel = {
  eyebrow?: string;
  title: string;
  meta?: string;
  description?: string;
  cta: string;
  listTitle?: string;
  items?: { key: string; name: string; meta?: string; kind?: PreviewItemKind; locked?: boolean }[];
  /** Shown in the web frame's address bar. */
  url?: string;
};

/** The record drawn as the learner app shows it — a phone screen or a browser
 *  window. A stand-in built from the record itself, not a capture of the app. */
export function PreviewScreen({
  device,
  model,
  lock,
}: {
  device: PreviewDevice;
  model: PreviewScreenModel;
  /** The subscription mark a locked item carries. */
  lock?: ReactNode;
}) {
  const cover = (
    <div className="pps-cover">
      {model.eyebrow && <span className="pps-cover-eyebrow">{model.eyebrow}</span>}
    </div>
  );
  const intro = (
    <div className="pps-intro">
      <div className="pps-title">{model.title}</div>
      {model.meta && <div className="pps-meta">{model.meta}</div>}
      {model.description && <p className="pps-desc">{model.description}</p>}
      <div className="cta-primary pps-cta">{model.cta}</div>
    </div>
  );
  const list = model.items && model.items.length > 0 && (
    <div className="pps-list">
      {model.listTitle && <div className="pps-list-title">{model.listTitle}</div>}
      {model.items.map((it) => (
        <div key={it.key} className="pps-item">
          {it.kind && <KindIcon kind={it.kind} />}
          <span className="pps-item-text">
            <span className="pps-item-name">{it.name}</span>
            {it.meta && <span className="pps-item-meta">{it.meta}</span>}
          </span>
          {it.locked && lock}
        </div>
      ))}
    </div>
  );

  if (device === "phone") {
    return (
      <div className="pps-phone" aria-label="Phone preview">
        <div className="pps-screen">
          <div className="pps-status">
            <span>9:41</span>
            <span className="pps-notch" />
          </div>
          <div className="pps-scroll">
            {cover}
            {intro}
            {list}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="pps-web" aria-label="Web preview">
      <div className="pps-bar">
        <span className="pps-lights">
          <i />
          <i />
          <i />
        </span>
        {model.url && <span className="pps-url">{model.url}</span>}
      </div>
      <div className="pps-page">
        <div className="pps-page-main">
          {cover}
          {intro}
        </div>
        {list}
      </div>
    </div>
  );
}

/* ─────────────── Seeded numbers ─────────────── */

/** A stable pseudo-random integer in [min, max] for a record — the seed has no
 *  analytics, so the stat strip draws deterministic figures from the id. */
export function seededInt(id: string, salt: string, min: number, max: number): number {
  let h = 0x811c9dc5;
  for (const ch of `${salt}:${id}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return min + ((h >>> 0) % (max - min + 1));
}

export const formatCount = (n: number) => n.toLocaleString("en-US");

/** "3 days ago" / "5 months ago" for a parseable date, relative to now. */
export function timeAgo(date: string | undefined): string | undefined {
  const t = date ? Date.parse(date) : NaN;
  if (Number.isNaN(t)) return undefined;
  const days = Math.max(0, Math.round((Date.now() - t) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
