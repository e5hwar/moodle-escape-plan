import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  certifications as allCerts,
  NO_CAREER_STAGE,
  NO_TYPE,
  CERT_OPTIONAL_COLUMNS,
  CERT_FIXED_COLUMNS,
  topIndustry,
  type Certification,
} from "../data/certifications";
import { type Award } from "../data/awards";
import {
  CertFilters,
  type CertFilterState,
  type CertColumnState,
} from "./CertFilters";
import { EditColumnsButton } from "./Filters";
import { SortIcon, AddIcon, RowEditIcon, RowEyeIcon, RowEyeOffIcon, RowKebabIcon, RowDeleteIcon, MenuAllTasksIcon, MenuAwardIcon, MenuBackupIcon, MenuPaidIcon, MenuLinkIcon, MenuProgressIcon, MenuArchiveReplaceIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { pickTag, pickTags, matchesTagFilter, audienceOf, TRADE_TAGS, PARTNERSHIP_TAGS } from "../data/filters";
import { PrmModal } from "./PrmModal";
import { Drawer } from "./Drawer";
import { CertificationSummary } from "./NewCertificationWizard";
import { Dropdown } from "./Dropdown";
import { CertImportModal } from "./CertImportModal";
import { CertBulkUploadModal } from "./CertBulkUploadModal";
import type { CertImportReport } from "../data/certImport";
import { useCollapsingHeader } from "../hooks/useCollapsingHeader";
import { CertificationsSearch } from "./CertificationsSearch";

const PAGE_SIZE = 50;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* The Create Certification menu. Each row keeps the letter of its own
   distinctive word: S(cratch), B(ackup), C(SV). "C" doing double duty is safe
   — it only picks CSV Upload while the menu is already open, and opening it is
   all "C" does while it is closed. */
type UploadPath = "backup" | "csv";

const CREATE_OPTIONS: { key: "scratch" | UploadPath; label: string; shortcut: string }[] = [
  { key: "scratch", label: "From Scratch", shortcut: "S" },
  { key: "backup", label: "Upload Backup", shortcut: "B" },
  { key: "csv", label: "CSV Upload", shortcut: "C" },
];

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
  | "audience"
  | "visibility"
  | "dateCreated"
  | "dateModified";
type SortDir = "asc" | "desc";

const STAGE_RANK: Record<string, number> = {
  "Pre-Apprentice": 0,
  Apprentice: 1,
  Journeyman: 2,
  Master: 3,
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
    case "audience": return audienceOf(a.tags).localeCompare(audienceOf(b.tags));
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
  onImportCert,
  onEditCert,
  onOpenCompanyDashboard,
  onViewPayers,
  onViewAllTasks,
  onManageContentLinks,
  onManageProgress,
  onArchiveCert,
  onManageAward,
  awardForCert,
  onOpenIndustries,
  onOpenFeedback,
}: {
  onNewCert: () => void;
  /** A checked CSV Upload — the wizard opens with its structure built. */
  onImportCert: (report: CertImportReport) => void;
  onEditCert: (cert: Certification) => void;
  onOpenCompanyDashboard: (companyName: string) => void;
  onViewPayers: (cert: Certification) => void;
  onViewAllTasks: (cert: Certification) => void;
  onManageContentLinks: (cert: Certification) => void;
  onManageProgress: (cert: Certification) => void;
  onArchiveCert: (cert: Certification) => void;
  /** Opens this Certification's Award — adding one, or managing the one it
   *  already has. Awards have no page of their own any more. */
  onManageAward: (cert: Certification) => void;
  /** The Certification's Award, when it has one — it decides whether the row
   *  menu reads "Add Award" or "Manage Award". */
  awardForCert: (cert: Certification) => Award | undefined;
  onOpenIndustries?: () => void;
  onOpenFeedback?: () => void;
}) {
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  // The upload path picked from the Create menu, if any — each opens its own
  // modal, and confirming it continues into the wizard.
  const [importMode, setImportMode] = useState<UploadPath | null>(null);
  // Local working copy so visibility/archive/delete persist in-session.
  const [certList, setCertList] = useState<Certification[]>(allCerts);
  const [menu, setMenu] = useState<{ cert: Certification; rect: DOMRect } | null>(null);
  const [query, setQuery] = useState("");
  // Set when someone tries to edit a Certification owned by a company — company
  // certifications are managed from the B2B Dashboard, not here.
  const [blockedEdit, setBlockedEdit] = useState<Certification | null>(null);
  // The Certification awaiting the delete confirm, if any.
  const [deleting, setDeleting] = useState<Certification | null>(null);
  // The Certification awaiting a Hide confirmation — the Tasks page's Hide
  // modal (Figma 667:884). Unhiding is instant; only hiding routes through it.
  const [hideTarget, setHideTarget] = useState<Certification | null>(null);
  // The Certification whose row was clicked, shown in the side drawer. Held by
  // id and read back from the working copy, so it always shows the live record.
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const drawerCert = drawerId ? certList.find((c) => c.id === drawerId) : undefined;
  // Created by SkillCat is applied on launch.
  const [filters, setFilters] = useState<CertFilterState>({
    industries: [],
    careerStages: [],
    types: [],
    creators: ["SkillCat"],
    visibilities: [],
    tags: [],
  });
  /* Default columns: Name, Industry, Career Stage, Date Modified — everything
     else is opt-in from Edit Columns. */
  const [columns, setColumns] = useState<CertColumnState>({
    id: false,
    industry: true,
    careerStage: true,
    type: false,
    payment: false,
    tasks: false,
    ceus: false,
    createdBy: false,
    tradeTag: false,
    partnershipTag: false,
    audience: false,
    visibility: false,
    dateCreated: false,
    dateModified: true,
  });
  // Most recently edited Certification first.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "dateModified", dir: "desc" });
  const [page, setPage] = useState(1);

  // From Scratch goes straight to the wizard; the two upload paths stop at
  // their modal first.
  const startCreate = (key: "scratch" | UploadPath) => {
    if (key === "scratch") onNewCert();
    else setImportMode(key);
  };

  // Keyboard shortcuts, mirroring the Tasks page: "C" opens the Create menu;
  // once open, each method's letter starts it. Ignored while typing in a field,
  // with a modifier held, or while an upload modal or the drawer owns the
  // screen (the menu would open above the drawer's scrim).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (importMode || drawerId) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (!createMenuOpen) {
        if (key === "c") {
          e.preventDefault();
          setCreateMenuOpen(true);
        }
        return;
      }
      if (e.key === "Escape") {
        setCreateMenuOpen(false);
        return;
      }
      const option = CREATE_OPTIONS.find((o) => o.shortcut.toLowerCase() === key);
      if (option) {
        e.preventDefault();
        setCreateMenuOpen(false);
        startCreate(option.key);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createMenuOpen, importMode, drawerId, onNewCert]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
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
      if (filters.tags.length && !matchesTagFilter(c.tags, filters.tags)) return false;
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

  // The page's one scroller (Claude Design "Certifications Prototype"): the
  // landing header collapses over its first stretch of scroll, with the table
  // glued beneath it, and the rows scroll under the pinned header after that.
  const head = useCollapsingHeader();
  const { scrollToFirstRow } = head;

  // A new query, filter, sort or page starts the list at its first row. A
  // collapsed header stays collapsed; one still open is left as it is.
  useLayoutEffect(() => {
    scrollToFirstRow();
  }, [query, filters, sort, visiblePage, scrollToFirstRow]);

  // The landing's catalog summary: the whole catalog, not the filtered rows —
  // the pagination footer already counts those.
  const catalog = useMemo(
    () => ({
      certs: certList.length,
      industries: new Set(certList.map((c) => topIndustry(c.industry))).size,
    }),
    [certList],
  );

  // Natural table width so columns scroll horizontally instead of crushing.
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
    (columns.audience ? 150 : 0) +
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
    // Making a Certification visible again is instant — only hiding needs
    // confirming, as it does for a Task.
    if ((cert.visibility ?? "Visible") !== "Visible") {
      setVisibility(cert, "Visible");
      return;
    }
    setHideTarget(cert);
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
    setCertList((prev) => prev.filter((c) => c.id !== cert.id));
    setDeleting(null);
  }

  return (
    <div className="main">
      <div className="workspace">
        {/* Claude Design "Certifications Prototype" (Certifications only):
            the page is ONE scroller — the table's own `.table-xscroll`. It
            opens on the landing, where the large title, the catalog summary
            and the Large search bar sit straight on top of the real table.
            The first stretch of scroll collapses that header into the
            standard table header with the rows glued beneath it; after that
            the rows scroll under the pinned header. See useCollapsingHeader
            and the `.tasks.clh` rules in index.css. */}
        <div className="tasks clh">
          <div className="co-table-col">
            <div
              ref={head.scrollRef}
              className="table-xscroll clh-scroll"
              style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}
            >
              <div className="clh-canvas">
                <div ref={head.headerRef} className="clh-head">
                  <header className="tasks-header">
                    <h1 className="tasks-title">Certifications</h1>
                    {/* Figma 633:1865 — same move as the Tasks header: Industries and
                        Feedback left the sidebar's Content group and are now reached
                        from here, left of the Create Certification CTA. Awards was a
                        third button until Awards stopped being a page: an Award belongs
                        to one Certification, so it is reached from that row's menu. */}
                    <div className="tasks-header-actions">
                      <button className="cta-quiet" onClick={() => onOpenIndustries?.()}>
                        Industries
                      </button>
                      <button className="cta-quiet" onClick={() => onOpenFeedback?.()}>
                        Feedback
                      </button>
                      {/* The three creation methods used to be cards on a full-page
                          chooser between this button and the wizard. They are rows in
                          the CTA's menu now, on the Tasks page's Create Task shell
                          (Figma 724:1010): label + shortcut badge, no icons. */}
                      <Dropdown
                        align="right"
                        width="auto"
                        panelClass="ct-menu"
                        open={createMenuOpen}
                        onOpenChange={setCreateMenuOpen}
                        trigger={({ toggle }) => (
                          <button className="new-task" onClick={toggle}>
                            <AddIcon />
                            Create Certification
                            <span className="cta-kbd">C</span>
                          </button>
                        )}
                      >
                        {({ close }) => (
                          <>
                            {CREATE_OPTIONS.map(({ key, label, shortcut }) => (
                              <button
                                key={key}
                                className="ct-menu-item"
                                onClick={() => {
                                  startCreate(key);
                                  close();
                                }}
                              >
                                <span className="ct-menu-label">{label}</span>
                                <span className="ct-menu-kbd">{shortcut}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </Dropdown>
                    </div>
                    {/* The landing's catalog summary (the prototype's copy). It
                        folds away as the header collapses. */}
                    <div className="clh-sub">
                      <p className="tasks-subtitle">
                        {`${plural(catalog.certs, "certification", "certifications")} across ${plural(
                          catalog.industries,
                          "industry",
                          "industries",
                        )}. Search by name, code or industry.`}
                      </p>
                    </div>
                  </header>

                  <div className="toolbar">
                    <CertificationsSearch
                      certifications={certList}
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

                <table ref={head.theadRef} className="table table-head">
                  <CertColGroup columns={columns} />
                  <thead>
                    <tr>
                      <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                      {columns.id && <SortableHeader col="id" label="ID" className="col-id" sort={sort} toggle={toggleSort} />}
                      {columns.industry && <SortableHeader col="industry" label="Industry" className="col-used" sort={sort} toggle={toggleSort} />}
                      {columns.careerStage && <SortableHeader col="careerStage" label="Career Stage" className="col-type" sort={sort} toggle={toggleSort} />}
                      {columns.type && <SortableHeader col="type" label="Type" className="col-type" sort={sort} toggle={toggleSort} />}
                      {columns.payment && <SortableHeader col="payment" label="Payment" className="col-type" sort={sort} toggle={toggleSort} />}
                      {columns.tasks && <SortableHeader col="tasks" label="Tasks" className="col-type" sort={sort} toggle={toggleSort} />}
                      {columns.ceus && <SortableHeader col="ceus" label="CEUs" className="col-type" sort={sort} toggle={toggleSort} />}
                      {columns.createdBy && <SortableHeader col="createdBy" label="Created By" className="col-creator" sort={sort} toggle={toggleSort} sortable={false} />}
                      {columns.tradeTag && <SortableHeader col="tradeTag" label="Trade Tag" className="col-tags" sort={sort} toggle={toggleSort} sortable={false} />}
                      {columns.partnershipTag && <SortableHeader col="partnershipTag" label="Partnership Tag" className="col-tags" sort={sort} toggle={toggleSort} sortable={false} />}
                      {columns.audience && <SortableHeader col="audience" label="Audience" className="col-tags" sort={sort} toggle={toggleSort} sortable={false} />}
                      {columns.visibility && <SortableHeader col="visibility" label="Visibility" className="col-type" sort={sort} toggle={toggleSort} />}
                      {columns.dateCreated && <SortableHeader col="dateCreated" label="Date Created" className="col-date" sort={sort} toggle={toggleSort} />}
                      {columns.dateModified && <SortableHeader col="dateModified" label="Date Modified" className="col-date" sort={sort} toggle={toggleSort} />}
                      <th className="col-actions">
                        <EditColumnsButton
                          columns={columns}
                          setColumns={setColumns}
                          optional={CERT_OPTIONAL_COLUMNS}
                          fixed={CERT_FIXED_COLUMNS}
                        />
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
                          columns={columns}
                          onOpen={() => setDrawerId(cert.id)}
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

      {menu && (
        <CertActionsMenu
          cert={menu.cert}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEdit={() => editCert(menu.cert)}
          onToggleVisibility={() => toggleHidden(menu.cert)}
          onDelete={() => setDeleting(menu.cert)}
          onViewPayers={() => onViewPayers(menu.cert)}
          onViewAllTasks={() => onViewAllTasks(menu.cert)}
          hasAward={!!awardForCert(menu.cert)}
          onManageAward={() => onManageAward(menu.cert)}
          onBackup={() => backupCertification(menu.cert)}
          onManageContentLinks={() => onManageContentLinks(menu.cert)}
          onManageProgress={() => onManageProgress(menu.cert)}
          onArchive={() => onArchiveCert(menu.cert)}
        />
      )}

      {importMode === "backup" && (
        <CertImportModal
          onClose={() => setImportMode(null)}
          onConfirm={() => {
            setImportMode(null);
            onNewCert();
          }}
        />
      )}

      {/* CSV Upload runs the Question Bank's bulk-upload flow: every row is
          checked before anything imports, and a clean file opens the wizard
          with its Courses, Lessons, and Tasks already built. */}
      {importMode === "csv" && (
        <CertBulkUploadModal
          onClose={() => setImportMode(null)}
          onImport={(report) => {
            setImportMode(null);
            onImportCert(report);
          }}
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

      {deleting && (
        <PrmModal
          title="Delete Certification"
          confirmLabel="Delete Certification"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteCert(deleting)}
        >
          {/* Body copy is children, not `description` — the shell's own
              convention for a confirm (Figma 483:588). */}
          <p className="prm-text">
            “{deleting.name}” ({deleting.id}) is removed from the Certifications list along
            with its content links. This can't be undone.
          </p>
        </PrmModal>
      )}

      {hideTarget && (
        <HideCertModal
          cert={hideTarget}
          onCancel={() => setHideTarget(null)}
          onConfirm={() => {
            setVisibility(hideTarget, "Hidden");
            setHideTarget(null);
          }}
        />
      )}

      {drawerCert && <CertDrawer cert={drawerCert} onClose={() => setDrawerId(null)} />}
    </div>
  );
}

/** A Certification's side drawer (Figma 1316:1846): its name and description,
 *  then every field its wizard holds, one review card per step. */
function CertDrawer({ cert, onClose }: { cert: Certification; onClose: () => void }) {
  return (
    <Drawer title={cert.name} description={cert.description} onClose={onClose}>
      <CertificationSummary cert={cert} />
    </Drawer>
  );
}

/** Hide confirmation — the Tasks page's Hide modal (Figma 667:884 "General
 *  Modal") for a Certification. The heading names the Cert, the description
 *  states what hiding does, and the content slot names the Industry it is
 *  listed under — where the Task version lists its Certifications. */
function HideCertModal({
  cert,
  onCancel,
  onConfirm,
}: {
  cert: Certification;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <PrmModal
      title={`Hide “${cert.name}”`}
      description="Hiding the Certification temporarily removes it for all users."
      confirmLabel="Hide Certification"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {cert.industry && (
        <div className="prm-content">
          <p>
            This Certification is currently in the following Industry. Hiding it removes it
            temporarily from here.
          </p>
          <ul>
            <li>{cert.industry}</li>
          </ul>
        </div>
      )}
    </PrmModal>
  );
}

/** Renders a category's tags like the "Used in" column — first value plus a
 * "+N" overflow badge. Trade and Partnership categories allow more than one;
 * hovering the cell shows the full list via a native tooltip. */
function TagCell({ tags }: { tags: string[] }) {
  return (
    <td className="col-tags" data-tip={tags.length ? tags.join("\n") : undefined}>
      {tags.length === 0 ? (
        null
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
      <col style={{ width: 240 }} />
      {columns.id && <col style={{ width: 100 }} />}
      {columns.industry && <col style={{ width: 190 }} />}
      {columns.careerStage && <col style={{ width: 140 }} />}
      {columns.type && <col style={{ width: 130 }} />}
      {columns.payment && <col style={{ width: 150 }} />}
      {columns.tasks && <col style={{ width: 90 }} />}
      {columns.ceus && <col style={{ width: 90 }} />}
      {columns.createdBy && <col style={{ width: 180 }} />}
      {columns.tradeTag && <col style={{ width: 210 }} />}
      {columns.partnershipTag && <col style={{ width: 160 }} />}
      {columns.audience && <col style={{ width: 150 }} />}
      {columns.visibility && <col style={{ width: 120 }} />}
      {columns.dateCreated && <col style={{ width: 130 }} />}
      {columns.dateModified && <col style={{ width: 130 }} />}
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function CertRow({
  cert,
  columns,
  onOpen,
  onEdit,
  onToggleVisibility,
  onOpenMenu,
  menuOpen,
}: {
  cert: Certification;
  columns: CertColumnState;
  /** A click anywhere on the row outside its action buttons. */
  onOpen: () => void;
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
      className={`${cert.draft ? "draft" : ""} ${vis !== "Visible" ? "task-dim" : ""} ${menuOpen ? "menu-open" : ""}`}
      onClick={onOpen}
    >
      <td className="col-name" data-tip={cert.name}>
        <span className="tsk-name">{cert.name}</span>
        {/* Hidden (and Archived) read exactly as a hidden Task row does
            (1126:1686): grey pill beside a muted name, every other cell
            dimmed — see `.task-dim` in the CSS. */}
        {vis !== "Visible" && <span className="pr-name-flag pr-name-flag--grey">{vis}</span>}
      </td>
      {columns.id && <td className="col-id">{cert.id}</td>}
      {columns.industry && <td className="col-used" data-tip={cert.industry}>{cert.industry}</td>}
      {columns.careerStage && <td className="col-type">{cert.careerStage ?? ""}</td>}
      {columns.type && <td className="col-type">{cert.type ?? ""}</td>}
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
      {columns.audience && <td className="col-tags">{audienceOf(cert.tags)}</td>}
      {columns.visibility && <td className="col-type">{vis}</td>}
      {columns.dateCreated && <td className="col-date">{cert.dateCreated ?? ""}</td>}
      {columns.dateModified && <td className="col-date">{cert.dateModified ?? ""}</td>}
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
/* Figma 735:1454 "3-Dot Menu - Certifications" — the same head-less item list
   the Tasks and Users menus already use. Fixed-positioned so it escapes the
   table's scroll container. */

function CertActionsMenu({
  cert,
  rect,
  onClose,
  onEdit,
  onToggleVisibility,
  onDelete,
  onViewPayers,
  onViewAllTasks,
  hasAward,
  onManageAward,
  onBackup,
  onManageContentLinks,
  onManageProgress,
  onArchive,
}: {
  cert: Certification;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onViewPayers: () => void;
  onViewAllTasks: () => void;
  hasAward: boolean;
  onManageAward: () => void;
  onBackup: () => void;
  onManageContentLinks: () => void;
  onManageProgress: () => void;
  onArchive: () => void;
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

  const vis = cert.visibility ?? "Visible";
  const hidden = vis !== "Visible";
  const archived = vis === "Archived";

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
      {item(<RowEditIcon />, "Edit Certification", onEdit)}
      {/* An archived Cert is retired from the catalog for good, so there is no
          visibility left to toggle. */}
      {!archived &&
        item(
          hidden ? <RowEyeIcon /> : <RowEyeOffIcon />,
          hidden ? "Make Visible" : "Make Hidden",
          onToggleVisibility,
        )}
      {/* Only paid certifications have payers to view. */}
      {cert.payment && item(<MenuPaidIcon />, "View Who Paid", onViewPayers)}
      {item(<MenuLinkIcon />, "Manage Content Links", onManageContentLinks)}
      {item(<MenuProgressIcon />, "Manage User Progress", onManageProgress)}
      {/* Opens the Tasks page with this Certification already in the filter
          row — the Tasks a Cert is built from, without retyping the name. */}
      {item(<MenuAllTasksIcon />, "View All Tasks", onViewAllTasks)}
      {/* Figma 1226:1425 — "Add Award", between View All Tasks and Backup.
          A Certification can hold at most one Award, so the entry is the
          Award's whole life cycle: it reads "Manage Award" once there is one. */}
      {item(<MenuAwardIcon />, hasAward ? "Manage Award" : "Add Award", onManageAward)}
      {item(<MenuBackupIcon />, "Backup Certification", onBackup)}
      {/* Archiving used to be an edit-only step inside the Cert wizard; it's
          now this entry, opening its own full-page Archive & Replace view. An
          already-archived Cert can't be archived again. */}
      {!archived && item(<MenuArchiveReplaceIcon />, "Archive & Replace", onArchive)}
      {item(<RowDeleteIcon />, "Delete Certification", onDelete, true)}
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
    <PrmModal
      title="Can't edit this certification here"
      description={
        <>
          Certifications created by a company can only be edited from the B2B
          Dashboard. Login as <strong>{companyName}</strong> to make changes.
        </>
      }
      confirmLabel="Open Company Dashboard"
      onCancel={onClose}
      onConfirm={onOpenDashboard}
    >
      {null}
    </PrmModal>
  );
}
