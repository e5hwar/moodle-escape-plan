import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  versionHistory,
  type Question,
  type QuestionVersion,
} from "../data/questionBank";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuPreviewIcon,
  RowKebabIcon,
  SortIcon,
} from "./icons";

/* ─────────────────────────────────────────────────────────────────────────────
   Version History — a full page, opened from the Question Bank row menu.

   Built on the same shell as the two pages it was asked to read like: a Quiz
   Task's "View All Attempts" (AttemptsPage) and "Who Paid"
   (QuizPurchasersPage) — breadcrumb page head, the shared sticky-head `.table`,
   the row-hover kebab, and the pagination footer.

   What it deliberately does NOT borrow from them is the search box and the
   filter-pill row: those pages list thousands of rows, a question's history is
   two to five, and a "Clear Filters" link over four rows would be theatre.

   The page is a record, so its only action is View — it opens the question
   editor loaded with that version, locked unless the version is the current
   one.
   ───────────────────────────────────────────────────────────────────────────*/

const PAGE_SIZE = 50;

/* How much of the question the page subtext carries before it trails off. */
const SUBTEXT_CHARS = 200;

type ColumnKey = "text" | "stamp" | "quizAttempts" | "formResponses";
type SortKey = "version" | ColumnKey;
type SortDir = "asc" | "desc";

type ColMeta = {
  key: ColumnKey;
  label: string;
  className: string;
  width: number;
  /** Tooltip on the cell — the full stem, which the column truncates. */
  tip?: (v: QuestionVersion) => string | undefined;
  render: (v: QuestionVersion) => React.ReactNode;
  sortValue: (v: QuestionVersion) => string | number;
};

/* Plain-text columns, per the table convention. Widths fit the HEADER label,
   not just the data: header type is 16px SemiBold and never wraps, so a column
   narrower than its own label spills over the next one. */
const COLS: ColMeta[] = [
  {
    key: "text", label: "Question", className: "qvh-col-question", width: 460,
    tip: (v) => v.text,
    render: (v) => v.text,
    sortValue: (v) => v.text.toLowerCase(),
  },
  {
    key: "stamp", label: "Edited On", className: "qvh-col-date", width: 210,
    render: (v) => v.stamp,
    // The row order is already the version order; sorting by date follows it.
    sortValue: (v) => v.version,
  },
  {
    key: "quizAttempts", label: "Quiz Attempts", className: "qvh-col-num", width: 160,
    render: (v) => v.quizAttempts.toLocaleString(),
    sortValue: (v) => v.quizAttempts,
  },
  {
    key: "formResponses", label: "Form Responses", className: "qvh-col-num", width: 175,
    render: (v) => v.formResponses.toLocaleString(),
    sortValue: (v) => v.formResponses,
  },
];

const COL_BY_KEY = new Map(COLS.map((c) => [c.key, c]));

// Version + the four columns + the actions cell.
const TABLE_MIN = 120 + COLS.reduce((s, c) => s + c.width, 0) + 40;

function compareRows(a: QuestionVersion, b: QuestionVersion, key: SortKey): number {
  if (key === "version") return a.version - b.version;
  const col = COL_BY_KEY.get(key)!;
  const va = col.sortValue(a);
  const vb = col.sortValue(b);
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  return String(va).localeCompare(String(vb));
}

/** The question, cut to the subtext's budget on a word boundary. */
function trimToSubtext(text: string): string {
  if (text.length <= SUBTEXT_CHARS) return text;
  const cut = text.slice(0, SUBTEXT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > SUBTEXT_CHARS - 30 ? cut.slice(0, lastSpace) : cut;
  return `${kept.replace(/[\s,;:.-]+$/, "")}...`;
}

export function QuestionVersionsPage({
  question,
  onBack,
  onView,
}: {
  question: Question;
  /** Back to the Question Bank list — the breadcrumb and Escape. */
  onBack: () => void;
  /** Opens the question editor on that version — locked unless it's current. */
  onView: (version: number) => void;
}) {
  const versions = useMemo(() => versionHistory(question), [question]);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "version", dir: "desc" });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ version: number; rect: DOMRect } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // The open row menu owns Escape while it is up.
      if (e.key === "Escape" && !menu) onBack();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack, menu]);

  const sorted = useMemo(() => {
    const arr = [...versions].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [versions, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          {/* Reached from the Question Bank row menu, so that crumb is the way
              back — the same page head Quiz Attempts and Who Paid wear. The
              subtext names the question this history belongs to. */}
          <header className="tasks-header">
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <button className="rvc-crumb" onClick={onBack} title="Back to the Question Bank">
                  Question Bank
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Version History</span>
              </nav>
              <h1 className="tasks-title">Version History</h1>
              {/* The full stem is on the hover tip, so the 200-character cut
                  never hides anything. */}
              <div className="tasks-subtitle" data-tip={question.text}>
                <span>{question.id}</span>
                <span className="tasks-subtitle-dot" />
                <span className="qvh-sub-text">{trimToSubtext(question.text)}</span>
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              {/* Same split head/body table as Quiz Attempts and Who Paid: one
                  scroll container, a sticky header table, and the row-end
                  kebab. */}
              <div className="table-xscroll" style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}>
                <table className="table table-head">
                  <ColGroup />
                  <thead>
                    <tr>
                      <SortableHeader col="version" label="Version" className="col-name" sort={sort} toggle={toggleSort} />
                      {COLS.map((c) => (
                        <SortableHeader key={c.key} col={c.key} label={c.label} className={c.className} sort={sort} toggle={toggleSort} />
                      ))}
                      <th className="col-actions" />
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className="table table-body">
                    <ColGroup />
                    <tbody>
                      {paged.map((v) => (
                        <VersionRow
                          key={v.version}
                          v={v}
                          onView={() => onView(v.version)}
                          onOpenMenu={(rect) => setMenu({ version: v.version, rect })}
                          menuOpen={menu?.version === v.version}
                        />
                      ))}
                      {paged.length === 0 && (
                        <tr>
                          <td colSpan={COLS.length + 2} className="u-empty">
                            No versions yet — this question hasn't been saved.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pagination">
                <span>
                  Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeftIcon /></button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRightIcon /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <VersionActionsMenu
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onView={() => onView(menu.version)}
        />
      )}
    </div>
  );
}

function VersionRow({
  v,
  onView,
  onOpenMenu,
  menuOpen,
}: {
  v: QuestionVersion;
  onView: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  return (
    /* The row itself opens the version, the way an attempt row opens its
       attempt — the kebab is the same action, spelled out. */
    <tr className={menuOpen ? "menu-open" : ""} onClick={onView}>
      <td className="col-name qvh-col-version">v{v.version}</td>
      {COLS.map((c) => (
        <td key={c.key} className={c.className} data-tip={c.tip?.(v)}>
          {c.render(v)}
        </td>
      ))}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
          >
            <RowKebabIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────── Three-dot row actions menu ─────────────── */
/* Fixed-positioned so it escapes the table's scroll container. One row: the
   page is a record, and View is the only thing you can do to a record. */

function VersionActionsMenu({
  rect,
  onClose,
  onView,
}: {
  rect: DOMRect;
  onClose: () => void;
  onView: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    /* Right-anchored to the trigger — the kebab is the action bar's last cell,
       so the open menu's right edge lines up with the bar's. */
    setPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() {
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="u-menu-item"
        onClick={(e) => {
          e.stopPropagation();
          onView();
          onClose();
        }}
      >
        <span className="u-menu-item-icon"><MenuPreviewIcon /></span>
        <span className="u-menu-item-text">
          <span>View</span>
        </span>
      </button>
    </div>
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: 120 }} />
      {COLS.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function SortableHeader({
  col,
  label,
  className,
  sort,
  toggle,
}: {
  col: SortKey;
  label: string;
  className?: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className={className} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
