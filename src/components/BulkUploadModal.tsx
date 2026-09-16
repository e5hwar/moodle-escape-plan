import { useEffect, useRef, useState } from "react";
import { CheckBoldIcon, DownloadIcon, UploadTrayIcon } from "./icons";
import { PrmModal } from "./PrmModal";
import {
  analyzeImport,
  categoryLine,
  typeBreakdown,
  BULK_TEMPLATE,
  type ImportReport,
} from "../data/questionImport";
import type { Category } from "../data/questionBank";

/* ── Question Bank bulk upload ──
   Three screens on the shared PrmModal shell, in the order the file walks them:

   1. Pick     (Figma 1116:1321) — the drop zone + the template download. No
      footer: the node draws none, because there is nothing to confirm yet.
   2. Errors   (Figma 1196:1806) — one row per failing row, each naming the
      column to fix. Nothing imports until every row passes, so the CTA is
      "Re-Upload", not "Import anyway".
   3. Success  (Figma 1195:1690) — what the file adds, then "Import N Questions".

   A file that fails to parse at all (wrong header, empty) lands on the Errors
   screen with the reason in place of the table. */

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Error rows past this are left to the spreadsheet — the note says so. */
const MAX_ERROR_ROWS = 50;

function downloadTemplate() {
  const blob = new Blob([BULK_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "question-bank-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BulkUploadModal({
  categories,
  initialFile,
  onClose,
  onImport,
}: {
  categories: Category[];
  /** A file dropped on the page opens the modal already carrying it. */
  initialFile?: File | null;
  onClose: () => void;
  /** Confirmed — the page appends the questions and creates the categories. */
  onImport: (report: ImportReport) => void;
}) {
  const [report, setReport] = useState<ImportReport | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function read(file: File | null | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setReport({
        fileName: file.name,
        total: 0,
        rows: [],
        issues: [],
        counts: { mcq: 0, tf: 0, match: 0 },
        newCategories: [],
        newSubcategories: [],
        missingSpanish: 0,
        fatal: "Bulk upload takes a .csv file. Export your spreadsheet as CSV and try again.",
      });
      return;
    }
    setReport(analyzeImport(file.name, await file.text(), categories));
  }

  // A file dropped on the page arrives with the modal, already checked.
  useEffect(() => {
    if (initialFile) void read(initialFile);
    // Only on mount — re-reading on every render would re-check the same file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        title="Bulk Upload Questions"
        description="Add Questions along with the Categories/Sub-Categories they belong to"
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
            One row per question · True/False, MCQs, and Match the Following · Every
            row is checked before importing
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
        {!report.fatal && (
          <div className="qbu-err">
            <div className="qbu-err-row qbu-err-head">
              <span className="qbu-err-c-row">Row</span>
              <span className="qbu-err-c-cat">Category</span>
              <span className="qbu-err-c-sub">Sub-Category</span>
              <span className="qbu-err-c-q">Question (EN)</span>
              <span className="qbu-err-c-type">Question Type</span>
              <span className="qbu-err-c-issue">Issue</span>
            </div>
            <div className="qbu-err-body">
              {issues.map((issue) => (
                <div className="qbu-err-row" key={issue.row}>
                  <span className="qbu-err-c-row">{issue.row}</span>
                  <span className="qbu-err-c-cat">{issue.category}</span>
                  <span className="qbu-err-c-sub">{issue.sub}</span>
                  <span className="qbu-err-c-q qbu-err-q">{issue.text}</span>
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
  const newPaths = [...report.newCategories, ...report.newSubcategories];
  return (
    <PrmModal
      className="qbu qbu--ready"
      title={`Add ${n} ${n === 1 ? "Question" : "Questions"}`}
      description="Here's what this file adds to the bank. Categories and sub-categories that don't exist yet are created on import."
      confirmLabel={`Import ${n} ${n === 1 ? "Question" : "Questions"}`}
      onCancel={onClose}
      onConfirm={() => onImport(report)}
    >
      <div className="note-card note-card--ok">
        <span className="note-card-icon"><CheckBoldIcon /></span>
        <div className="note-card-text">
          <p className="note-card-title">All {plural(n, "Row")} Passed</p>
          <p className="note-card-body">
            Nothing has been imported yet. Review what will be added, then import.
          </p>
        </div>
      </div>

      <div className="qbu-sum">
        <div className="qbu-sum-row">
          <span className="qbu-sum-label">Questions</span>
          <span className="qbu-sum-val">
            <span className="qbu-sum-lead">{n} ·</span>
            <span className="qbu-sum-note"> {typeBreakdown(report.counts)}</span>
          </span>
        </div>
        <div className="qbu-sum-row">
          <span className="qbu-sum-label">Categories</span>
          <span className="qbu-sum-val qbu-sum-val--stack">
            <span className="qbu-sum-lead">{categoryLine(report)}</span>
            {newPaths.length > 0 && (
              <span className="qbu-sum-note">{newPaths.join(" · ")}</span>
            )}
          </span>
        </div>
        <div className="qbu-sum-row">
          <span className="qbu-sum-label">Translations</span>
          <span className="qbu-sum-val">
            {report.missingSpanish > 0 ? (
              <span className="qbu-sum-warn">
                {plural(report.missingSpanish, "question")}{" "}
                {report.missingSpanish === 1 ? "has" : "have"} no Spanish text. They
                import as English-only
              </span>
            ) : (
              <span className="qbu-sum-lead">Every question carries its Spanish text</span>
            )}
          </span>
        </div>
      </div>
    </PrmModal>
  );
}
