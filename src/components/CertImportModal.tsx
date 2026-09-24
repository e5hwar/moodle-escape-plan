import { useRef, useState } from "react";
import { UploadTrayIcon } from "./icons";
import { PrmModal } from "./PrmModal";

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
  /** Confirmed — the flow continues into the Certification wizard. */
  onConfirm: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pickFile = () => fileRef.current?.click();

  return (
    <PrmModal
      title="Upload Backup"
      description="Restore from a Certification backup file exported from the ⋯ menu."
      confirmLabel="Restore & Continue"
      confirmDisabled={!fileName}
      onCancel={onClose}
      onConfirm={onConfirm}
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
          if (f) setFileName(f.name);
        }}
      >
        <span className="drop-big-icon"><UploadTrayIcon /></span>
        <div className="drop-big-title">{fileName ?? "Drag and drop, or click to upload"}</div>
        <div className="drop-big-hint">
          {fileName
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
          setFileName(e.target.files?.[0]?.name ?? null);
          // Let the same file be picked again after a fix.
          e.target.value = "";
        }}
      />
    </PrmModal>
  );
}
