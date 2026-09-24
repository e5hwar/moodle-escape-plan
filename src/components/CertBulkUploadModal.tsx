import { useEffect, useRef, useState } from "react";
import { CheckBoldIcon, DownloadIcon, UploadTrayIcon } from "./icons";
import { PrmModal } from "./PrmModal";
import {
  analyzeCertImport,
  libraryLine,
  missingSpanish,
  structureLine,
  taskTypeBreakdown,
  CERT_TEMPLATE,
  type CertImportReport,
} from "../data/certImport";

/* ── Create Certification › CSV Upload ──
   The Question Bank's bulk upload (BulkUploadModal) for a Certification's
   structure — the same three screens on the same `.qbu` shells, in the order
   the file walks them:

   1. Pick     — the drop zone + the template download, no footer: there is
      nothing to confirm until a file has been read.
   2. Errors   — one row per failing row, each naming the column to fix.
      Nothing imports until every row passes, so the CTA is "Re-Upload".
   3. Success  — what the file builds, then "Import & Continue" into the
      Certification wizard with the Courses, Lessons, and Tasks already in.

   A file that fails to parse at all (wrong header, empty) lands on the Errors
   screen with the reason in place of the table. */

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Error rows past this are left to the spreadsheet — the note says so. */
const MAX_ERROR_ROWS = 50;

function downloadTemplate() {
  const blob = new Blob([CERT_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "certification-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CertBulkUploadModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  /** Confirmed — the wizard opens with the file's structure already built. */
  onImport: (report: CertImportReport) => void;
}) {
  const [report, setReport] = useState<CertImportReport | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function read(file: File | null | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setReport({
        fileName: file.name,
        total: 0,
        rows: [],
        courses: [],
        issues: [],
        fatal: "CSV Upload takes a .csv file. Export your spreadsheet as CSV and try again.",
      });
      return;
    }
    setReport(analyzeCertImport(file.name, await file.text()));
  }

  const pickFile = () => fileRef.current?.click();

  const input = (
    <input
      ref={fileRef}
      type="file"
      accept=".csv"
      hidden
      onChange={(e) => {
        void read(e.target.files?.[0]);
        // Let the same file be picked again after a fix.
        e.target.value = "";
      }}
    />
  );

  /* ── 1. Pick ── */
  if (!report) {
    return (
      <PrmModal
        className="qbu qbu--pick"
        title="CSV Upload"
        description="Bulk-create Courses, Lessons, and Tasks from a CSV file."
        hideFooter
        onCancel={onClose}
      >
        <div
          className={`drop-big drop-big--xl ${dragging ? "is-active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={pickFile}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pickFile();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void read(e.dataTransfer.files?.[0]);
          }}
        >
          <span className="drop-big-icon"><UploadTrayIcon /></span>
          <div className="drop-big-title">Drag and drop, or click to upload</div>
          <div className="drop-big-hint">
            One row per Task · Blank Lesson columns put a Task directly under its Course ·
            Every row is checked before importing
          </div>
          {/* The template is its own action inside the zone — clicking it must
              not also open the file picker. */}
          <button
            className="qbu-template"
            onClick={(e) => {
              e.stopPropagation();
              downloadTemplate();
            }}
          >
            <DownloadIcon />
            Download Template
          </button>
        </div>
        {input}
      </PrmModal>
    );
  }

  /* ── 2. Errors ── */
  if (report.fatal || report.issues.length > 0) {
    const issues = report.issues.slice(0, MAX_ERROR_ROWS);
    const hidden = report.issues.length - issues.length;
    return (
      <PrmModal
        /* The 1181px shell is the error TABLE's — a file that couldn't be read
           at all is one sentence, so it keeps the confirm width. */
        className={`qbu${report.fatal ? "" : " qbu--errors"}`}
        title={
          report.fatal
            ? "Can't Read This File"
            : `${report.issues.length} ${report.issues.length === 1 ? "Error" : "Errors"} to Fix`
        }
        description={
          report.fatal ??
          "Each issue names the column to correct. Fix them in your spreadsheet and drop the CSV again. Nothing is imported until every row passes."
        }
        confirmLabel="Re-Upload"
        onCancel={onClose}
        onConfirm={pickFile}
      >
        {/* Same six-column grid as the Question Bank's: Course and Lesson take
            its Category / Sub-Category slots, the Task its Question's. */}
        {!report.fatal && (
          <div className="qbu-err">
            <div className="qbu-err-row qbu-err-head">
              <span className="qbu-err-c-row">Row</span>
              <span className="qbu-err-c-cat">Course</span>
              <span className="qbu-err-c-sub">Lesson</span>
              <span className="qbu-err-c-q">Task Name</span>
              <span className="qbu-err-c-type">Task Type</span>
              <span className="qbu-err-c-issue">Issue</span>
            </div>
            <div className="qbu-err-body">
              {issues.map((issue) => (
                <div className="qbu-err-row" key={issue.row}>
                  <span className="qbu-err-c-row">{issue.row}</span>
                  <span className="qbu-err-c-cat">{issue.course}</span>
                  <span className="qbu-err-c-sub">{issue.lesson}</span>
                  <span className="qbu-err-c-q qbu-err-q">{issue.task}</span>
                  <span className="qbu-err-c-type">{issue.type}</span>
                  <span className="qbu-err-c-issue">
                    <span className="qbu-err-col">{issue.column}</span>
                    {issue.detail && <span className="qbu-err-detail"> · {issue.detail}</span>}
                  </span>
                </div>
              ))}
            </div>
            <div className="qbu-err-foot">
              {hidden > 0
                ? `Showing the first ${issues.length} of ${report.issues.length} rows with errors · ${plural(report.rows.length, "row")} pass`
                : `Showing the ${plural(report.issues.length, "row")} with errors · ${plural(report.rows.length, "row")} pass`}
            </div>
          </div>
        )}
        {input}
      </PrmModal>
    );
  }

  /* ── 3. Success ── */
  const n = report.rows.length;
  const created = report.rows.filter((r) => !r.libraryTask);
  const noSpanish = missingSpanish(report.courses);
  const noSpanishParts = [
    noSpanish.courses ? plural(noSpanish.courses, "Course") : "",
    noSpanish.lessons ? plural(noSpanish.lessons, "Lesson") : "",
  ].filter(Boolean);
  const noSpanishCount = noSpanish.courses + noSpanish.lessons;
  const hasLessons = report.courses.some((c) => c.children.some((ch) => ch.kind === "lesson"));
  return (
    <PrmModal
      className="qbu qbu--ready"
      title={`Add ${n} ${n === 1 ? "Task" : "Tasks"}`}
      description="Here's the structure this file builds. Tasks already in the library are reused, not copied — the rest are created as new Tasks."
      confirmLabel="Import & Continue"
      onCancel={onClose}
      onConfirm={() => onImport(report)}
    >
      <div className="note-card note-card--ok">
        <span className="note-card-icon"><CheckBoldIcon /></span>
        <div className="note-card-text">
          <p className="note-card-title">All {plural(n, "Row")} Passed</p>
          <p className="note-card-body">
            Nothing has been imported yet. Review what will be added, then continue into
            the Certification wizard.
          </p>
        </div>
      </div>

      <div className="qbu-sum">
        <div className="qbu-sum-row">
          <span className="qbu-sum-label">Tasks</span>
          <span className="qbu-sum-val">
            <span className="qbu-sum-lead">{n} ·</span>
            <span className="qbu-sum-note"> {taskTypeBreakdown(report.rows)}</span>
          </span>
        </div>
        <div className="qbu-sum-row">
          <span className="qbu-sum-label">Structure</span>
          <span className="qbu-sum-val qbu-sum-val--stack">
            <span className="qbu-sum-lead">{structureLine(report.courses)}</span>
            <span className="qbu-sum-note">
              {report.courses.map((c) => c.nameEn).join(" · ")}
            </span>
          </span>
        </div>
        <div className="qbu-sum-row">
          <span className="qbu-sum-label">Task Library</span>
          <span className="qbu-sum-val qbu-sum-val--stack">
            <span className="qbu-sum-lead">{libraryLine(report.rows)}</span>
            {/* Named only when some rows DID match the library — a misspelt
                name shows up here as new instead of silently duplicating. */}
            {created.length > 0 && created.length < n && (
              <span className="qbu-sum-note">New: {created.map((r) => r.name).join(" · ")}</span>
            )}
          </span>
        </div>
        <div className="qbu-sum-row">
          <span className="qbu-sum-label">Translations</span>
          <span className="qbu-sum-val">
            {noSpanishCount > 0 ? (
              <span className="qbu-sum-warn">
                {noSpanishParts.join(" and ")} {noSpanishCount === 1 ? "has" : "have"} no Spanish
                name. {noSpanishCount === 1 ? "It imports" : "They import"} as English-only
              </span>
            ) : (
              <span className="qbu-sum-lead">
                Every Course{hasLessons ? " and Lesson" : ""} carries its Spanish name
              </span>
            )}
          </span>
        </div>
      </div>
    </PrmModal>
  );
}
