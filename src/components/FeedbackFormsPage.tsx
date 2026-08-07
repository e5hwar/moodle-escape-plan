import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  activeLinks,
  feedbackForms as seedForms,
  type FeedbackForm,
  type FormStatus,
} from "../data/feedbackForms";
import { SearchIcon, SortIcon, AddIcon, RowEditIcon, RowKebabIcon, MenuPlaceholderIcon } from "./icons";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { NewFeedbackFormModal } from "./NewFeedbackFormModal";

const PAGE_SIZE = 50;

type FilterKey = "all" | FormStatus;

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "All",
  active: "Active",
  draft: "Drafts",
  archived: "Archived",
};

const STATUS_LABEL: Record<FormStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
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

type SortKey =
  | "id"
  | "name"
  | "status"
  | "questions"
  | "triggers"
  | "responses"
  | "updated"
  | "createdBy";
type SortDir = "asc" | "desc";

function compare(a: FeedbackForm, b: FeedbackForm, key: SortKey): number {
  switch (key) {
    case "id": return a.id.localeCompare(b.id);
    case "name": return (a.name || "").localeCompare(b.name || "");
    case "status": return a.status.localeCompare(b.status);
    case "questions": return activeLinks(a).length - activeLinks(b).length;
    case "triggers": return a.triggers.length - b.triggers.length;
    case "responses": return a.responseCount - b.responseCount;
    case "updated": return (Date.parse(a.updatedAt) || 0) - (Date.parse(b.updatedAt) || 0);
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
  }
}

type Props = {
  forms: FeedbackForm[];
  onOpen: (id: string) => void;
  onViewResponses: (id: string) => void;
  onCreate: (form: FeedbackForm) => void;
};

export function FeedbackFormsPage({ forms, onOpen, onViewResponses, onCreate }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<{ form: FeedbackForm; rect: DOMRect } | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "id", dir: "desc" });
  const [page, setPage] = useState(1);
  useCreateShortcut(() => setCreating(true), !creating);

  const counts = useMemo(() => {
    const c = { all: forms.length, active: 0, draft: 0, archived: 0 };
    forms.forEach((f) => (c[f.status] += 1));
    return c;
  }, [forms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return forms.filter((f) => {
      if (filter !== "all" && f.status !== filter) return false;
      if (q && !(
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.createdBy.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [forms, query, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, filter, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  // Natural table width so columns scroll horizontally instead of crushing.
  const tableMin = 100 + 260 + 120 + 120 + 190 + 120 + 140 + 180 + 40;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function handleCreated(form: FeedbackForm) {
    onCreate(form);
    setCreating(false);
    onOpen(form.id);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks fb-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Feedback Forms</h1>
              <div className="tasks-subtitle">
                <span>{counts.active} active</span>
                <span className="tasks-subtitle-dot" />
                <span>{counts.draft} drafts</span>
                <span className="tasks-subtitle-dot" />
                <span>shown on Task and Certification completion</span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={() => setCreating(true)}>
                <AddIcon />
                Create Form
                <span className="cta-kbd">C</span>
              </button>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="sp-controls">
                <div className="search-wrap sp-search">
                  <span className="search-icon">
                    <SearchIcon />
                  </span>
                  <input
                    className="search-input"
                    placeholder="Search forms by name, ID, or creator…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span className="search-kbd">
                    <span className="kbd-cmd">⌘</span>
                    <span className="kbd-letter">K</span>
                  </span>
                </div>
                <div className="sp-tabs">
                  {(["all", "active", "draft", "archived"] as FilterKey[]).map((k) => (
                    <button
                      key={k}
                      className={`sp-tab ${filter === k ? "is-active" : ""}`}
                      onClick={() => setFilter(k)}
                    >
                      {FILTER_LABEL[k]}
                      {k !== "all" && <span className="sp-tab-count">{counts[k]}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="co-table-row">
                <div className="co-table-col">
                  <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
                    <table className="table table-head">
                      <FbColGroup />
                      <thead>
                        <tr>
                          <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />
                          <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                          <SortableHeader col="status" label="Status" className="col-type" sort={sort} toggle={toggleSort} />
                          <SortableHeader col="questions" label="Questions" className="col-type" sort={sort} toggle={toggleSort} />
                          <SortableHeader col="triggers" label="Triggers" className="col-used" sort={sort} toggle={toggleSort} sortable={false} />
                          <SortableHeader col="responses" label="Responses" className="col-type" sort={sort} toggle={toggleSort} />
                          <SortableHeader col="updated" label="Last Updated" className="col-date" sort={sort} toggle={toggleSort} />
                          <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} sortable={false} />
                          <th className="col-actions" />
                        </tr>
                      </thead>
                    </table>

                    <div className="tasks-scroll">
                      <table className="table table-body">
                        <FbColGroup />
                        <tbody>
                          {paged.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="u-empty">
                                No Feedback Forms match. Try a different filter or search term.
                              </td>
                            </tr>
                          ) : (
                            paged.map((f) => (
                              <FormRow
                                key={f.id}
                                form={f}
                                onClick={() => onOpen(f.id)}
                                onEdit={() => onOpen(f.id)}
                                onOpenMenu={(rect) => setMenu({ form: f, rect })}
                                menuOpen={menu?.form.id === f.id}
                              />
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pagination">
                    <span>
                      Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                    </span>
                    <div className="pagination-controls">
                      <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                      <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <FormActionsMenu
          form={menu.form}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEdit={() => onOpen(menu.form.id)}
          onViewResponses={() => onViewResponses(menu.form.id)}
        />
      )}

      {creating && (
        <NewFeedbackFormModal
          existingForms={forms.filter((f) => f.status !== "archived")}
          onClose={() => setCreating(false)}
          onCreate={handleCreated}
        />
      )}
    </div>
  );
}

function FbColGroup() {
  return (
    <colgroup>
      <col style={{ width: 100 }} />
      <col style={{ width: 260 }} />
      <col style={{ width: 120 }} />
      <col style={{ width: 120 }} />
      <col style={{ width: 190 }} />
      <col style={{ width: 120 }} />
      <col style={{ width: 140 }} />
      <col style={{ width: 180 }} />
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function FormRow({
  form,
  onClick,
  onEdit,
  onOpenMenu,
  menuOpen,
}: {
  form: FeedbackForm;
  onClick: () => void;
  onEdit: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const actives = activeLinks(form).length;
  const inactive = form.questions.length - actives;
  return (
    <tr className={menuOpen ? "menu-open" : ""} onClick={onClick}>
      <td className="col-id">{form.id}</td>
      <td className={`col-name ${form.name ? "" : "fb-faint"}`} data-tip={form.name || undefined}>
        {form.name || "Untitled form"}
      </td>
      <td className="col-type">
        <span className={`fb-status fb-status--${form.status}`}>{STATUS_LABEL[form.status]}</span>
      </td>
      <td className="col-type">
        {actives}
        {inactive > 0 && <span className="fb-faint"> · {inactive} inactive</span>}
      </td>
      <td className="col-used" data-tip={form.triggers.length ? form.triggers.map((t) => t.refName).join("\n") : undefined}>
        {form.triggers.length === 0 ? (
          <span className="fb-faint">—</span>
        ) : (
          <>
            {form.triggers[0].refName}
            {form.triggers.length > 1 && <span className="used-extra">+{form.triggers.length - 1}</span>}
          </>
        )}
      </td>
      <td className="col-type">{form.responseCount.toLocaleString()}</td>
      <td className="col-date">{formatDate(form.updatedAt)}</td>
      <td className="col-creator" data-tip={form.createdBy}>{form.createdBy}</td>
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
            aria-label="Edit"
            title="Edit form"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <RowEditIcon />
          </button>
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

function SortableHeader({
  col, label, className, sort, toggle, sortable = true,
}: {
  col: SortKey;
  label: string;
  className?: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
}) {
  if (!sortable) {
    return (
      <th className={`${className ?? ""} no-sort`.trim()}>
        <span className="th-content">{label}</span>
      </th>
    );
  }
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

/* ─────────────── Three-dot row actions menu ─────────────── */
/* Fixed-positioned so it escapes the table's scroll container. */

function FormActionsMenu({
  form,
  rect,
  onClose,
  onEdit,
  onViewResponses,
}: {
  form: FeedbackForm;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onViewResponses: () => void;
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
       so the open menu's right edge lines up with the bar's. Using `right`
       rather than (rect.right - measuredWidth) keeps that exact: the first-pass
       width measurement is unreliable, because the fallback `left` shrink-to-
       fits the menu against the viewport before it has been placed. */
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
      if (e.key === "Escape") onClose();
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

  const item = (icon: JSX.Element, label: string, onPick: () => void) => (
    <button
      className="u-menu-item"
      onClick={(e) => {
        e.stopPropagation();
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      {label}
    </button>
  );

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
      <div className="u-menu-head">
        <div className="u-menu-head-name">{form.name || "Untitled form"}</div>
        <div className="u-menu-head-id">{form.id} · {STATUS_LABEL[form.status]}</div>
      </div>
      {item(<RowEditIcon />, "Edit", onEdit)}
      {item(<MenuPlaceholderIcon />, "View Responses", onViewResponses)}
    </div>
  );
}

export { seedForms };
