import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { templateUsageCount, type Award, type AwardDesignTemplate } from "../data/awards";
import { PrmModal } from "./PrmModal";
import { RowChevronIcon, SearchIcon, SortIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { SearchTrailing } from "./SearchPanelParts";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";

/* Add / Manage Award's Card Design and Certificate Design pickers. The shared
   table picker (Figma 682:2321, `.stm-*`) at that node's own 1050px width
   rather than full-screen, run the way Find a Deep Link runs it: one choice,
   so no checkbox column and no footer. Each row ends in the resting chevron
   that becomes a labelled "Select Template" bar on hover; clicking it — or
   anywhere on the row — picks the template and closes.

   Columns: Preview · Name · Used By · Date Modified, on the Spotlights
   table's tall rows — a template is artwork, so the row leads with a picture
   of it. The current pick wears the picker's selected wash. "No Card" / "No
   Certificate" leads the list while it is unsearched, because no appearance
   is a real answer for one of the two. */

const PAGE_SIZE = 50;

/* Spotlight-style rows (the Spotlights table, 558:2046): a 144×76 artwork
   tile in a 168px Preview column, then Name · Used By · Date Modified at the
   Award Templates table's widths. */
const THUMB_W = 144 + 24;
const DATA_COLS = [240, 130, 130];
const CHEVRON_W = 56;
const TABLE_MIN = THUMB_W + DATA_COLS.reduce((n, w) => n + w, 0) + CHEVRON_W;

type SortKey = "name" | "usage" | "dateModified";
type SortDir = "asc" | "desc";

export function TemplatePickerModal({
  title,
  description,
  emptyLabel,
  templates,
  awards,
  selectedId,
  onCancel,
  onPick,
}: {
  title: string;
  description: string;
  /** The "no template" row, e.g. "No Card". */
  emptyLabel: string;
  templates: AwardDesignTemplate[];
  /** For the Used By column. */
  awards: Award[];
  selectedId?: string;
  onCancel: () => void;
  /** The picked template's id, or undefined for the "no template" row. */
  onPick: (id: string | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    setPage(1);
  }, [query, sort]);

  const usage = (t: AwardDesignTemplate) => templateUsageCount(t.id, awards);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = templates.filter(
      (t) => !q || t.name.toLowerCase().includes(q),
    );
    out.sort((a, b) => {
      switch (sort.key) {
        case "usage": return usage(a) - usage(b);
        case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
        default: return a[sort.key].localeCompare(b[sort.key]);
      }
    });
    return sort.dir === "desc" ? out.reverse() : out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, awards, query, sort]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);
  const showNone = !query.trim() && visiblePage === 1;

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const colGroup = <TableCols data={[THUMB_W, ...DATA_COLS]} trail={[CHEVRON_W]} />;

  const rowEnd = (label: string, pick: () => void) => (
    <td className="col-actions">
      <button
        className="row-action-btn lone-dots row-chevron"
        aria-label={`Select ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          pick();
        }}
      >
        <RowChevronIcon />
      </button>
      <div className="row-action-bar">
        <button
          className="row-action-btn row-action-btn--label"
          onClick={(e) => {
            e.stopPropagation();
            pick();
          }}
        >
          Select Template
          <RowChevronIcon />
        </button>
      </div>
    </td>
  );

  return (
    <PrmModal
      title={title}
      description={description}
      hideFooter
      className="dlm tpm"
      onCancel={onCancel}
    >
      <div className="stm">
        <div className="stm-toolbar">
          <div className="search-wrap stm-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input"
              placeholder="Search Design Templates..."
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <SearchTrailing active={!!query} onClear={() => setQuery("")} />
          </div>
        </div>

        <div className="stm-table-wrap">
          <div className="table-xscroll" style={{ "--table-min": `${TABLE_MIN}px` } as CSSProperties}>
            <table className="table table-head stm-table stm-table--preview">
              {colGroup}
              <thead>
                <tr>
                  <th className="tpm-col-thumb no-sort">Preview</th>
                  <Th label="Name" k="name" sort={sort} onClick={toggleSort} />
                  <Th label="Used By" k="usage" sort={sort} onClick={toggleSort} />
                  <Th label="Date Modified" k="dateModified" sort={sort} onClick={toggleSort} />
                  <th className="col-actions no-sort" />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table stm-table--preview">
                {colGroup}
                <tbody>
                  {showNone && (
                    <tr className={selectedId ? "" : "selected"} onClick={() => onPick(undefined)}>
                      <td className="tpm-col-thumb">
                        <span className="tpm-thumb tpm-thumb--none" />
                      </td>
                      <td className="stm-col-name col-name">{emptyLabel}</td>
                      <td>—</td>
                      <td>—</td>
                      {rowEnd(emptyLabel, () => onPick(undefined))}
                    </tr>
                  )}
                  {paged.map((t) => {
                    const n = usage(t);
                    return (
                      <tr key={t.id} className={t.id === selectedId ? "selected" : ""} onClick={() => onPick(t.id)}>
                        <td className="tpm-col-thumb">
                          {/* A placeholder, not the artwork (user, 2026-10-07). */}
                          <span className="art-ph tpm-thumb">Template Image</span>
                        </td>
                        <td className="stm-col-name col-name">{t.name}</td>
                        <td>{n === 0 ? "Unused" : `${n} Award${n === 1 ? "" : "s"}`}</td>
                        <td>{t.dateModified}</td>
                        {rowEnd(t.name, () => onPick(t.id))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {paged.length === 0 && !showNone && <TableEmpty />}
          </div>

          <div className="pagination stm-pagination">
            <span>
              Showing {total === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, total)} of {total}
            </span>
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={visiblePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <PagePrevIcon />
              </button>
              <button
                className="page-btn"
                disabled={visiblePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <PageNextIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PrmModal>
  );
}

function Th({
  label,
  k,
  sort,
  onClick,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onClick: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th onClick={() => onClick(k)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
