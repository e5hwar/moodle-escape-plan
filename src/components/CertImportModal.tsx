import { useRef, useState } from "react";
import { UploadTrayIcon } from "./icons";
import { PrmModal } from "./PrmModal";
import type { Certification } from "../data/certifications";

/** Read a backup written by the row menu's "Backup Certification" — the
 *  record it carries, or an error the drop zone can show. */
async function readBackup(file: File): Promise<Certification | string> {
  try {
    const parsed = JSON.parse(await file.text());
    const cert = parsed?.certification;
    if (parsed?.format !== "skillcat-certification-backup" || !cert?.name) {
      return "This file isn't a Certification backup. Export one from a row's ⋯ menu.";
    }
    return cert as Certification;
  } catch {
    return "This file couldn't be read. Upload the .cert.json file the backup downloaded.";
  }
}

/* ── Create Certification › Upload Backup ──
   Used to be a panel on a full-page method chooser that sat between the
   Create CTA and the wizard. The chooser is gone — the methods are rows in the
   CTA's menu now — so the backup path opens here instead, on the shared
   PrmModal shell with the app's standard `.drop-big` zone. Confirming
   continues into the wizard, exactly as the page did. (CSV Upload left this
   modal for the Question Bank's checked bulk-upload flow: CertBulkUploadModal.) */

export function CertImportModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  /** Confirmed — the flow continues into the Certification wizard, filled
   *  from the backup's record. */
  onConfirm: (cert: Certification) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  // The parsed backup, or why the picked file isn't one.
  const [restored, setRestored] = useState<Certification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = (f: File | undefined) => {
    setFileName(f?.name ?? null);
    setRestored(null);
    setError(null);
    if (!f) return;
    void readBackup(f).then((r) => {
      if (typeof r === "string") setError(r);
      else setRestored(r);
    });
  };
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pickFile = () => fileRef.current?.click();

  return (
    <PrmModal
      title="Upload Backup"
      description="Restore from a Certification backup file exported from the ⋯ menu."
      confirmLabel="Restore & Continue"
      confirmDisabled={!restored}
      onCancel={onClose}
      onConfirm={() => restored && onConfirm(restored)}
    >
      <div
        className={`drop-big ${dragging ? "is-active" : ""}`}
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
          const f = e.dataTransfer.files?.[0];
          if (f) pick(f);
        }}
      >
        <span className="drop-big-icon"><UploadTrayIcon /></span>
        <div className="drop-big-title">{fileName ?? "Drag and drop, or click to upload"}</div>
        <div className="drop-big-hint">
          {error
            ? error
            : fileName
            ? "Click to choose a different file."
            : "Accepts a .json or .cert backup · Courses, Lessons, and Tasks are restored as exported"}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.cert,.zip"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          // Let the same file be picked again after a fix.
          e.target.value = "";
        }}
      />
    </PrmModal>
  );
}
