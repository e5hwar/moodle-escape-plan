import { useEffect, useMemo, useState } from "react";
import { CAREER_STAGES, certifications, type Certification } from "../data/certifications";
import { CERT_DEEP_LINK_BASE, SYSTEM_DEEP_LINKS, slugify } from "../data/deepLinks";
import { PrmModal } from "./PrmModal";
import { CertFilters, certMatches, type CertFilterState } from "./CertFilters";
import { CertificationsSearch } from "./CertificationsSearch";
import { RowChevronIcon, SearchIcon, SortIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { SearchTrailing } from "./SearchPanelParts";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";

/* "Need help finding a Deep Link?" — Create Spotlight's reference for the
   Button Destination field. The shared PrmModal shell (no footer) with the
   app's tab row over the shared table picker (`.stm-*`): Certifications first
   and open, then System. The Certifications tab carries the Certifications
   page's own search bar and filter row, filtered by the same `certMatches`.

   Picking is the Hands-On / Exam Reviews row-end affordance: a resting chevron
   that becomes a labelled "Select Deep Link" bar on hover. Clicking it — or
   anywhere on the row — drops the link into the field and closes. */

const PAGE_SIZE = 50;

/* Name · Industries · Career Stage (Certifications tab only — the
   Certifications page's 140px column) · Deep Link. */
const DATA_COLS: Record<"cert" | "system", number[]> = {
  cert: [340, 264, 140, 410],
  system: [340, 264, 410],
};
const CHEVRON_W = 56;
const tableMin = (cols: number[]) => cols.reduce((n, w) => n + w, 0) + CHEVRON_W;

type Tab = "cert" | "system";
type SortDir = "asc" | "desc";

type Row = { id: string; name: string; link: string; extra: string; stage?: string };

const certRow = (c: Certification): Row => ({
  id: c.id,
  name: c.name,
  link: `${CERT_DEEP_LINK_BASE}${slugify(c.name)}`,
  extra: c.industry,
  stage: c.careerStage ?? "",
});

/* Career Stage sorts by seniority (as on the Certifications page), unset last. */
const stageRank = (r: Row) => (r.stage ? CAREER_STAGES.indexOf(r.stage as (typeof CAREER_STAGES)[number]) : 99);

type SortKey = "name" | "extra" | "stage";

const SYSTEM_ROWS: Row[] = SYSTEM_DEEP_LINKS.map((l) => ({
  id: l.id,
  name: l.label,
  link: l.url,
  extra: l.requiresLogin ? "Yes" : "No",
}));

const TABS: { key: Tab; label: string }[] = [
  { key: "cert", label: "Certifications" },
  { key: "system", label: "System" },
];

const COLUMNS: Record<Tab, { name: string; extra: string }> = {
  cert: { name: "Certification", extra: "Industries" },
  system: { name: "Destination", extra: "Login Required?" },
};

/* The Certifications page opens on Created By: SkillCat; so does this. */
const DEFAULT_CERT_FILTERS: CertFilterState = {
  industries: [],
  careerStages: [],
  types: [],
  creators: ["SkillCat"],
  visibilities: [],
  tags: [],
  setup: [],
};

export function DeepLinkModal({
  onCancel,
  onPick,
}: {
  onCancel: () => void;
  /** The picked link, with its scheme, ready to use as the button's URL. */
  onPick: (url: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("cert");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CertFilterState>(DEFAULT_CERT_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      /* An open search-suggestion panel takes the first Escape (the page
         search closes it itself); only the next one closes the modal. */
      if (document.querySelector(".usearch-panel")) return;
      onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Any change to what is listed starts it at the first page.
  useEffect(() => {
    setPage(1);
  }, [tab, query, filters, sort]);

  const rows = useMemo(() => {
    let out: Row[];
    if (tab === "cert") {
      out = certifications.filter((c) => certMatches(c, query, filters)).map(certRow);
    } else {
      const q = query.trim().toLowerCase();
      out = SYSTEM_ROWS.filter(
        (r) => !q || r.name.toLowerCase().includes(q) || r.link.toLowerCase().includes(q),
      );
    }
    const key = sort.key;
    out.sort((a, b) =>
      key === "stage" ? stageRank(a) - stageRank(b) || a.name.localeCompare(b.name) : a[key].localeCompare(b[key]),
    );
    return sort.dir === "desc" ? out.reverse() : out;
  }, [tab, query, filters, sort]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);
  const cols = COLUMNS[tab];

  /** Switching tab starts that tab's list clean. */
  function switchTab(next: Tab) {
    setTab(next);
    setQuery("");
    setSort({ key: "name", dir: "asc" });
  }

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const pick = (r: Row) => onPick(`https://${r.link}`);

  /* The shared width rule (`TableCols`): content-sized base widths — the
     Certifications picker's 340px name, a nested Industry ("Plumbing ›
     Service & Repair", ~240px), Career Stage at the Certifications page's
     140 and a Certification link (~381px), plus cell padding — summed into
     the floor; wider, the slack spreads across the data columns in
     proportion. The chevron column is a fixed gutter; the "Select
     Deep Link" bar overlays the row end on hover, as on the review pages. */
  const isCert = tab === "cert";
  const colGroup = <TableCols data={DATA_COLS[tab]} trail={[CHEVRON_W]} />;

  return (
    <PrmModal
      title="Find a Deep Link"
      description="Pick where the Spotlight's button takes the user in the app."
      pickFull
      hideFooter
      className="srq dlm"
      onCancel={onCancel}
    >
      <div className="stm">
        <div className="tabbar srq-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? "is-active" : ""}`}
              onClick={() => switchTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "cert" ? (
          <div className="dlm-controls">
            <div className="toolbar">
              <CertificationsSearch
                certifications={certifications}
                industries={filters.industries}
                onIndustriesChange={(v) => setFilters((prev) => ({ ...prev, industries: v }))}
                careerStages={filters.careerStages}
                onCareerStagesChange={(v) => setFilters((prev) => ({ ...prev, careerStages: v }))}
                types={filters.types}
                onTypesChange={(v) => setFilters((prev) => ({ ...prev, types: v }))}
                query={query}
                onCommit={setQuery}
              />
            </div>
            <CertFilters filters={filters} setFilters={setFilters} />
          </div>
        ) : (
          <div className="stm-toolbar">
            <div className="search-wrap stm-search">
              <span className="search-icon">
                <SearchIcon />
              </span>
              <input
                className="search-input"
                placeholder="Search System Deep Links..."
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <SearchTrailing active={!!query} onClear={() => setQuery("")} />
            </div>
          </div>
        )}

        <div className="stm-table-wrap">
          <div className="table-xscroll" style={{ "--table-min": `${tableMin(DATA_COLS[tab])}px` } as React.CSSProperties}>
            <table className="table table-head stm-table stm-table--preview">
              {colGroup}
              <thead>
                <tr>
                  <Th label={cols.name} active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")} />
                  <Th label={cols.extra} active={sort.key === "extra"} dir={sort.dir} onClick={() => toggleSort("extra")} />
                  {isCert && (
                    <Th label="Career Stage" active={sort.key === "stage"} dir={sort.dir} onClick={() => toggleSort("stage")} />
                  )}
                  <th className="no-sort">Deep Link</th>
                  <th className="col-actions no-sort" />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table stm-table--preview">
                {colGroup}
                <tbody>
                  {paged.map((r) => (
                    <tr key={r.id} onClick={() => pick(r)}>
                      <td className="stm-col-name col-name">{orDash(r.name)}</td>
                      <td>{orDash(r.extra)}</td>
                      {isCert && <td>{orDash(r.stage)}</td>}
                      <td className="dlm-col-link">{orDash(r.link)}</td>
                      {/* Resting chevron, and the labelled bar that replaces
                          it on hover (Hands-On's "Review Task ›"). */}
                      <td className="col-actions">
                        <button
                          className="row-action-btn lone-dots row-chevron"
                          aria-label={`Select ${r.name}'s deep link`}
                          onClick={(e) => {
                            e.stopPropagation();
                            pick(r);
                          }}
                        >
                          <RowChevronIcon />
                        </button>
                        <div className="row-action-bar">
                          <button
                            className="row-action-btn row-action-btn--label"
                            onClick={(e) => {
                              e.stopPropagation();
                              pick(r);
                            }}
                          >
                            Select Deep Link
                            <RowChevronIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paged.length === 0 && <TableEmpty />}
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

/** An empty cell reads "—", the app's table convention. */
const orDash = (v?: string) => (v ? v : "—");

function Th({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <th onClick={onClick}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? dir : undefined} />
      </span>
    </th>
  );
}
