import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  certifications as allCerts,
  NO_CAREER_STAGE,
  NO_TYPE,
  type Certification,
} from "../data/certifications";
import {
  CertFilters,
  CertEditColumnsButton,
  type CertFilterState,
  type CertColumnState,
} from "./CertFilters";
import { SearchIcon, SortIcon, AddIcon, RowEditIcon, RowEyeIcon, RowEyeOffIcon, RowKebabIcon, RowDeleteIcon, MenuPlaceholderIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { pickTag, pickTags, TRADE_TAGS, PARTNERSHIP_TAGS, USER_TYPE_TAGS } from "../data/filters";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { CertPreviewPanel } from "./CertPreviewPanel";
import { useLandingMorph } from "../hooks/useLandingMorph";
import { LandingFilterRow, LandingOverlay, BackToSearch, topValues, type LandingCol, type LandingPill, type LandingRow } from "./LandingMorph";

/* Landing-morph columns — mirror the table's default visible columns (the
   Certifications table leads with ID before Name) so the p=1 hand-off to the
   real table lines up. */
const LM_LEAD_COLS: LandingCol[] = [{ key: "id", label: "ID", width: 100 }];
const LM_COLS: LandingCol[] = [
  { key: "industry", label: "Industry", width: 190, fixed: true },
  { key: "careerStage", label: "Career Stage", width: 140 },
  { key: "payment", label: "Payment", width: 150 },
  { key: "tasks", label: "Tasks", width: 90 },
  { key: "creator", label: "Created By", width: 180 },
];

const PAGE_SIZE = 50;

// Trigger a client-side file download (used for Certification backups).
function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function backupCertification(cert: Certification) {
  const payload = {
    format: "skillcat-certification-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    certification: cert,
  };
  const safeName = cert.name.replace(/[^\w.-]+/g, "_");
  downloadTextFile(`${cert.id}-${safeName}.cert.json`, JSON.stringify(payload, null, 2), "application/json");
}

type SortKey =
  | "id"
  | "name"
  | "industry"
  | "careerStage"
  | "type"
  | "payment"
  | "tasks"
  | "ceus"
  | "createdBy"
  | "tradeTag"
  | "partnershipTag"
  | "userTypeTag"
  | "visibility"
  | "dateCreated"
  | "dateModified";
type SortDir = "asc" | "desc";

const STAGE_RANK: Record<string, number> = {
  Apprentice: 0,
  Journeyman: 1,
  Master: 2,
};

function compare(a: Certification, b: Certification, key: SortKey): number {
  switch (key) {
    case "id": return a.id.localeCompare(b.id);
    case "name": return a.name.localeCompare(b.name);
    case "industry": return a.industry.localeCompare(b.industry);
    case "careerStage":
      return (
        (a.careerStage ? STAGE_RANK[a.careerStage] : 99) -
        (b.careerStage ? STAGE_RANK[b.careerStage] : 99)
      );
    case "type": return (a.type ?? "").localeCompare(b.type ?? "");
    // Free certs sort first, then paid (Consumable / Non-consumable) alphabetically.
    case "payment": return (a.payment ?? "").localeCompare(b.payment ?? "");
    case "ceus": return parseFloat(a.ceus) - parseFloat(b.ceus);
    case "tasks": return a.tasks - b.tasks;
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "tradeTag": return (pickTag(a.tags, TRADE_TAGS) ?? "").localeCompare(pickTag(b.tags, TRADE_TAGS) ?? "");
    case "partnershipTag": return (pickTag(a.tags, PARTNERSHIP_TAGS) ?? "").localeCompare(pickTag(b.tags, PARTNERSHIP_TAGS) ?? "");
    case "userTypeTag": return (pickTag(a.tags, USER_TYPE_TAGS) ?? "").localeCompare(pickTag(b.tags, USER_TYPE_TAGS) ?? "");
    case "visibility": return (a.visibility ?? "").localeCompare(b.visibility ?? "");
    case "dateCreated": return (Date.parse(a.dateCreated ?? "") || 0) - (Date.parse(b.dateCreated ?? "") || 0);
    case "dateModified": return (Date.parse(a.dateModified ?? "") || 0) - (Date.parse(b.dateModified ?? "") || 0);
  }
}

// A selected Industry option matches its own tag and everything beneath it:
// picking "HVAC" catches "HVAC", "HVAC › Residential", etc.; picking a sub
// path matches only that sub.
function matchesIndustry(cert: Certification, selected: string[]): boolean {
  return selected.some(
    (opt) => cert.industry === opt || cert.industry.startsWith(`${opt} ›`),
  );
}

export function CertificationsPage({
  onNewCert,
  onEditCert,
  onOpenCompanyDashboard,
  onViewPayers,
  onManageContentLinks,
  onOpenIndustries,
  onOpenAwards,
  onOpenFeedback,
}: {
  onNewCert: () => void;
  onEditCert: (cert: Certification) => void;
  onOpenCompanyDashboard: (companyName: string) => void;
  onViewPayers: (cert: Certification) => void;
  onManageContentLinks: (cert: Certification) => void;
  onOpenIndustries?: () => void;
  onOpenAwards?: () => void;
  onOpenFeedback?: () => void;
}) {
  useCreateShortcut(onNewCert);
  // Local working copy so visibility/archive/delete persist in-session.
  const [certList, setCertList] = useState<Certification[]>(allCerts);
  const [menu, setMenu] = useState<{ cert: Certification; rect: DOMRect } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Set when someone tries to edit a Certification owned by a company — company
  // certifications are managed from the B2B Dashboard, not here.
  const [blockedEdit, setBlockedEdit] = useState<Certification | null>(null);
  // Created by SkillCat is applied on launch.
  const [filters, setFilters] = useState<CertFilterState>({
    industries: [],
    careerStages: [],
    types: [],
    creators: ["SkillCat"],
    visibilities: [],
    ceu: "",
    keyword: "",
  });
  const [columns, setColumns] = useState<CertColumnState>({
    id: true,
    industry: true,
    careerStage: true,
    type: false,
    payment: true,
    tasks: true,
    ceus: false,
    createdBy: true,
    tradeTag: false,
    partnershipTag: false,
    userTypeTag: false,
    visibility: false,
    dateCreated: false,
    dateModified: false,
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "id", dir: "desc" });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ceuMin = filters.ceu.trim() ? parseFloat(filters.ceu) : null;
    const kw = filters.keyword.trim().toLowerCase();
    return certList.filter((c) => {
      if (q && !(
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
      )) return false;
      if (filters.industries.length && !matchesIndustry(c, filters.industries)) return false;
      if (filters.careerStages.length) {
        const match = c.careerStage
          ? filters.careerStages.includes(c.careerStage)
          : filters.careerStages.includes(NO_CAREER_STAGE);
        if (!match) return false;
      }
      if (filters.types.length) {
        const match = c.type
          ? filters.types.includes(c.type)
          : filters.types.includes(NO_TYPE);
        if (!match) return false;
      }
      if (filters.creators.length && !filters.creators.includes(c.createdBy)) return false;
      if (filters.visibilities.length && !filters.visibilities.includes(c.visibility ?? "Visible")) return false;
      if (ceuMin !== null && !Number.isNaN(ceuMin) && parseFloat(c.ceus) < ceuMin) return false;
      if (kw && !(c.keywords ?? []).some((k) => k.toLowerCase().includes(kw))) return false;
      return true;
    });
  }, [query, filters, certList]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, filters, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  // Landing morph — the page opens as the search-first landing and the wheel
  // (or any search / pill / row interaction) morphs it into the table view.
  const morph = useLandingMorph();

  const suggested = useMemo(() => {
    const pills: LandingPill[] = [];
    const add = (key: string, label: string, patch: (prev: CertFilterState) => CertFilterState) =>
      pills.push({
        key,
        label,
        onPick: () => {
          setFilters(patch(filters));
          morph.showTable();
        },
      });
    topValues(certList, (c) => c.industry, 2).forEach((ind) =>
      add(`ind-${ind}`, ind, (prev) => ({ ...prev, industries: Array.from(new Set([...prev.industries, ind])) })),
    );
    const stage = topValues(certList, (c) => c.careerStage)[0];
    if (stage) add("stage", stage, (prev) => ({ ...prev, careerStages: [stage] }));
    const type = topValues(certList, (c) => c.type)[0];
    if (type) add("type", type, (prev) => ({ ...prev, types: [type] }));
    return pills;
  }, [certList, filters, morph.showTable]);

  const landingRows: LandingRow[] = sorted.slice(0, 24).map((c) => ({
    key: c.id,
    name: c.name,
    dim: (c.visibility ?? "Visible") !== "Visible" || c.draft,
    cells: {
      id: c.id,
      industry: c.industry,
      careerStage: c.careerStage ?? "—",
      payment: c.payment ?? "Free",
      tasks: c.tasks,
      creator: c.createdBy,
    },
  }));

  const selected = selectedId ? certList.find((c) => c.id === selectedId) ?? null : null;

  // Natural table width so columns scroll horizontally instead of crushing —
  // including while the preview panel is open (all columns stay, table scrolls).
  const tableMin =
    240 /* name */ +
    40 /* actions */ +
    (columns.id ? 100 : 0) +
    (columns.industry ? 190 : 0) +
    (columns.careerStage ? 140 : 0) +
    (columns.type ? 130 : 0) +
    (columns.payment ? 150 : 0) +
    (columns.tasks ? 90 : 0) +
    (columns.ceus ? 90 : 0) +
    (columns.createdBy ? 180 : 0) +
    (columns.tradeTag ? 210 : 0) +
    (columns.partnershipTag ? 160 : 0) +
    (columns.userTypeTag ? 150 : 0) +
    (columns.visibility ? 120 : 0) +
    (columns.dateCreated ? 130 : 0) +
    (columns.dateModified ? 130 : 0);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function setVisibility(cert: Certification, visibility: Certification["visibility"]) {
    setCertList((prev) =>
      prev.map((c) => (c.id === cert.id ? { ...c, visibility } : c)),
    );
  }

  function toggleHidden(cert: Certification) {
    setVisibility(cert, (cert.visibility ?? "Visible") === "Visible" ? "Hidden" : "Visible");
  }

  function editCert(cert: Certification) {
    // Certifications created by a company are owned by that company's B2B account
    // and can only be edited from the B2B Dashboard. Everything else is SkillCat-owned.
    if (cert.createdBy !== "SkillCat") {
      setBlockedEdit(cert);
      return;
    }
    onEditCert(cert);
  }

  function deleteCert(cert: Certification) {
    const ok = window.confirm(`Delete “${cert.name}” (${cert.id})? This can’t be undone.`);
    if (!ok) return;
    setCertList((prev) => prev.filter((c) => c.id !== cert.id));
    if (selectedId === cert.id) setSelectedId(null);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks lm" ref={morph.rootRef}>
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Certifications</h1>
            </div>
            {/* Figma 633:1865 — same move as the Tasks header: Industries,
                Awards, and Feedback left the sidebar's Content group and are
                now reached from here, left of the Create Certification CTA. */}
            <div className="tasks-header-actions">
              <button className="cta-quiet" onClick={() => onOpenIndustries?.()}>
                Industries
              </button>
              <button className="cta-quiet" onClick={() => onOpenAwards?.()}>
                Awards
              </button>
              <button className="cta-quiet" onClick={() => onOpenFeedback?.()}>
                Feedback
              </button>
              <button className="new-task" onClick={onNewCert}>
                <AddIcon />
                Create Certification
                <span className="cta-kbd">C</span>
              </button>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <div className="search-wrap">
                  <span className="search-icon"><SearchIcon /></span>
                  <input
                    className="search-input"
                    placeholder="Search Certifications by name, ID, or industry…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") morph.showTable();
                    }}
                  />
                  <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
                </div>
              </div>

              <LandingFilterRow pills={suggested}>
                  <CertFilters filters={filters} setFilters={setFilters} />
                </LandingFilterRow>

              <div className="lm-stage">
              <LandingOverlay
                caption="Recently created"
                total={sorted.length}
                columns={LM_COLS}
                leadColumns={LM_LEAD_COLS}
                rows={landingRows}
                onShowAll={morph.showTable}
                onRowClick={(row) => {
                  setSelectedId(row.key);
                  morph.showTable();
                }}
              />
              <div className="lm-table">
              <div className="co-table-row">
                <div className="co-table-col">
                  <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
                    <table className="table table-head">
                      <CertColGroup columns={columns} />
                      <thead>
                        <tr>
                          {columns.id && <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />}
                          <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                          {columns.industry && <SortableHeader col="industry" label="Industry" className="col-used" sort={sort} toggle={toggleSort} />}
                          {columns.careerStage && <SortableHeader col="careerStage" label="Career Stage" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.type && <SortableHeader col="type" label="Type" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.payment && <SortableHeader col="payment" label="Payment" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.tasks && <SortableHeader col="tasks" label="Tasks" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.ceus && <SortableHeader col="ceus" label="CEUs" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.createdBy && <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} sortable={false} />}
                          {columns.tradeTag && <SortableHeader col="tradeTag" label="Trade Tag" className="col-tags" sort={sort} toggle={toggleSort} sortable={false} />}
                          {columns.partnershipTag && <SortableHeader col="partnershipTag" label="Partnership Tag" className="col-tags" sort={sort} toggle={toggleSort} sortable={false} />}
                          {columns.userTypeTag && <SortableHeader col="userTypeTag" label="User Type Tag" className="col-tags" sort={sort} toggle={toggleSort} sortable={false} />}
                          {columns.visibility && <SortableHeader col="visibility" label="Visibility" className="col-type" sort={sort} toggle={toggleSort} />}
                          {columns.dateCreated && <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />}
                          {columns.dateModified && <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />}
                          <th className="col-actions">
                            <CertEditColumnsButton columns={columns} setColumns={setColumns} />
                          </th>
                        </tr>
                      </thead>
                    </table>

                    <div className="tasks-scroll">
                      <table className="table table-body">
                        <CertColGroup columns={columns} />
                        <tbody>
                          {paged.map((cert) => (
                            <CertRow
                              key={cert.id}
                              cert={cert}
                              selected={cert.id === selectedId}
                              columns={columns}
                              onClick={() => setSelectedId(cert.id === selectedId ? null : cert.id)}
                              onEdit={() => editCert(cert)}
                              onToggleVisibility={() => toggleHidden(cert)}
                              onOpenMenu={(rect) => setMenu({ cert, rect })}
                              menuOpen={menu?.cert.id === cert.id}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pagination">
                    <BackToSearch onClick={morph.showLanding} />
                    <span>
                      Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                    </span>
                    <div className="pagination-controls">
                      <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeftIcon /></button>
                      <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRightIcon /></button>
                    </div>
                  </div>
                </div>

                {selected && (
                  <CertPreviewPanel cert={selected} onClose={() => setSelectedId(null)} />
                )}
              </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <CertActionsMenu
          cert={menu.cert}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEdit={() => editCert(menu.cert)}
          onDelete={() => deleteCert(menu.cert)}
          onViewPayers={() => onViewPayers(menu.cert)}
          onBackup={() => backupCertification(menu.cert)}
          onManageContentLinks={() => onManageContentLinks(menu.cert)}
        />
      )}

      {blockedEdit && (
        <CompanyEditBlockedModal
          companyName={blockedEdit.createdBy}
          onClose={() => setBlockedEdit(null)}
          onOpenDashboard={() => {
            onOpenCompanyDashboard(blockedEdit.createdBy);
            setBlockedEdit(null);
          }}
        />
      )}
    </div>
  );
}

/** Renders a category's tags like the "Used in" column — first value plus a
 * "+N" overflow badge. Trade and Partnership categories allow more than one;
 * hovering the cell shows the full list via a native tooltip. */
function TagCell({ tags }: { tags: string[] }) {
  return (
    <td className="col-tags" data-tip={tags.length ? tags.join("\n") : undefined}>
      {tags.length === 0 ? (
        "—"
      ) : (
        <>
          {tags[0]}
          {tags.length > 1 && <span className="used-extra">+{tags.length - 1}</span>}
        </>
      )}
    </td>
  );
}

function CertColGroup({ columns }: { columns: CertColumnState }) {
  return (
    <colgroup>
      {columns.id && <col style={{ width: 100 }} />}
      <col style={{ width: 240 }} />
      {columns.industry && <col style={{ width: 190 }} />}
      {columns.careerStage && <col style={{ width: 140 }} />}
      {columns.type && <col style={{ width: 130 }} />}
      {columns.payment && <col style={{ width: 150 }} />}
      {columns.tasks && <col style={{ width: 90 }} />}
      {columns.ceus && <col style={{ width: 90 }} />}
      {columns.createdBy && <col style={{ width: 180 }} />}
      {columns.tradeTag && <col style={{ width: 210 }} />}
      {columns.partnershipTag && <col style={{ width: 160 }} />}
      {columns.userTypeTag && <col style={{ width: 150 }} />}
      {columns.visibility && <col style={{ width: 120 }} />}
      {columns.dateCreated && <col style={{ width: 130 }} />}
      {columns.dateModified && <col style={{ width: 130 }} />}
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function CertRow({
  cert,
  selected,
  columns,
  onClick,
  onEdit,
  onToggleVisibility,
  onOpenMenu,
  menuOpen,
}: {
  cert: Certification;
  selected: boolean;
  columns: CertColumnState;
  onClick: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const vis = cert.visibility ?? "Visible";
  const hidden = vis === "Hidden";
  return (
    <tr
      className={`${selected ? "selected" : ""} ${cert.draft ? "draft" : ""} ${hidden ? "task-hidden" : ""} ${menuOpen ? "menu-open" : ""}`}
      onClick={onClick}
    >
      {columns.id && <td className="col-id">{cert.id}</td>}
      <td className="col-name" data-tip={cert.name}>
        {cert.name}
        {vis !== "Visible" && <span className="hidden-badge">{vis}</span>}
      </td>
      {columns.industry && <td className="col-used" data-tip={cert.industry}>{cert.industry}</td>}
      {columns.careerStage && <td className="col-type">{cert.careerStage ?? "—"}</td>}
      {columns.type && <td className="col-type">{cert.type ?? "—"}</td>}
      {columns.payment && (
        <td className="col-type">
          {cert.payment ? (
            <span className={`pay-badge pay-badge--${cert.payment === "Consumable" ? "consumable" : "nonconsumable"}`}>
              {cert.payment}
            </span>
          ) : (
            <span className="pay-badge pay-badge--free">Free</span>
          )}
        </td>
      )}
      {columns.tasks && <td className="col-type">{cert.tasks}</td>}
      {columns.ceus && <td className="col-type">{cert.ceus}</td>}
      {columns.createdBy && <td className="col-creator" data-tip={cert.createdBy}>{cert.createdBy}</td>}
      {columns.tradeTag && <TagCell tags={pickTags(cert.tags, TRADE_TAGS)} />}
      {columns.partnershipTag && <TagCell tags={pickTags(cert.tags, PARTNERSHIP_TAGS)} />}
      {columns.userTypeTag && <td className="col-tags">{pickTag(cert.tags, USER_TYPE_TAGS) ?? "—"}</td>}
      {columns.visibility && <td className="col-type">{vis}</td>}
      {columns.dateCreated && <td className="col-date">{cert.dateCreated ?? "—"}</td>}
      {columns.dateModified && <td className="col-date">{cert.dateModified ?? "—"}</td>}
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
            title="Edit certification"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <RowEditIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label={hidden ? "Make visible" : "Hide certification"}
            title={hidden ? "Make visible" : "Hide certification"}
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          >
            {hidden ? <RowEyeOffIcon /> : <RowEyeIcon />}
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

/* ─────────────── Three-dot row actions menu ─────────────── */
/* Fixed-positioned so it escapes the table's scroll container. */

function CertActionsMenu({
  cert,
  rect,
  onClose,
  onEdit,
  onDelete,
  onViewPayers,
  onBackup,
  onManageContentLinks,
}: {
  cert: Certification;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewPayers: () => void;
  onBackup: () => void;
  onManageContentLinks: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
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

  const item = (
    icon: JSX.Element,
    label: string,
    onPick: () => void,
    danger = false,
  ) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
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
        <div className="u-menu-head-name">{cert.name}</div>
        <div className="u-menu-head-id">{cert.id}{cert.type ? ` · ${cert.type}` : ""}</div>
      </div>
      {item(<RowEditIcon />, "Edit", onEdit)}
      {/* Only paid certifications have payers to view. */}
      {cert.payment && item(<MenuPlaceholderIcon />, "View who paid", onViewPayers)}
      {item(<MenuPlaceholderIcon />, "Manage Content Links", onManageContentLinks)}
      {item(<MenuPlaceholderIcon />, "Backup Certification", onBackup)}
      {item(<RowDeleteIcon />, "Delete", onDelete, true)}
    </div>
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

function CompanyEditBlockedModal({
  companyName,
  onClose,
  onOpenDashboard,
}: {
  companyName: string;
  onClose: () => void;
  onOpenDashboard: () => void;
}) {
  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Can't edit this certification here</h3>
          <p className="cl-modal-sub">
            Certifications created by a company can only be edited from the B2B
            Dashboard. Login as <strong>{companyName}</strong> to make changes.
          </p>
        </div>
        <div className="cl-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-publish" onClick={onOpenDashboard}>
            Open Company Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
