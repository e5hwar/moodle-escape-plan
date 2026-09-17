import { useRef, useState } from "react";
import { DownloadIcon, UploadTrayIcon } from "./icons";
import { PrmModal } from "./PrmModal";

/* ── Create Certification, the two upload paths ──
   Both used to be panels on a full-page method chooser that sat between the
   Create CTA and the wizard. The chooser is gone — the methods are rows in the
   CTA's menu now — so each upload path opens here instead, on the shared
   PrmModal shell with the app's standard `.drop-big` zone. Confirming either
   one continues into the wizard, exactly as the page did. */

export type CertImportMode = "backup" | "csv";

// Reference template offered on the CSV Upload path (mirrors the Question Bank
// bulk-upload template). One row per Task; blank Lesson columns put a Task
// directly under its Course.
const CSV_TEMPLATE = `Course (EN),Course (ES),Course Description (EN),Lesson (EN),Lesson (ES),Task Name (EN),Task Name (ES),Task Type,Duration (min)
Refrigerant Basics,Fundamentos de Refrigerantes,Core refrigerant handling,Core Concepts,Conceptos Básicos,Pressure-Temperature Chart,Tabla Presión-Temperatura,xAPI,10
Refrigerant Basics,Fundamentos de Refrigerantes,Core refrigerant handling,Core Concepts,Conceptos Básicos,Section 1 Quiz,Examen Sección 1,Quiz,15
Refrigerant Basics,Fundamentos de Refrigerantes,Core refrigerant handling,,,Final Exam,Examen Final,Quiz,30
`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "certification-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const COPY: Record<
  CertImportMode,
  { title: string; description: string; accept: string; hint: string; confirmLabel: string }
> = {
  backup: {
    title: "Upload Backup",
    description: "Restore from a Certification backup file exported from the ⋯ menu.",
    accept: ".json,.cert,.zip",
    hint: "Accepts a .json or .cert backup · Courses, Lessons, and Tasks are restored as exported",
    confirmLabel: "Restore & Continue",
  },
  csv: {
    title: "CSV Upload",
    description: "Bulk-create Courses, Lessons, and Tasks from a CSV file.",
    accept: ".csv",
    hint: "One row per Task · Blank Lesson columns put a Task directly under its Course",
    confirmLabel: "Import & Continue",
  },
};

export function CertImportModal({
  mode,
  onClose,
  onConfirm,
}: {
  mode: CertImportMode;
  onClose: () => void;
  /** Confirmed — the flow continues into the Certification wizard. */
  onConfirm: () => void;
}) {
  const copy = COPY[mode];
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pickFile = () => fileRef.current?.click();

  return (
    <PrmModal
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
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
          {fileName ? "Click to choose a different file." : copy.hint}
        </div>
        {/* CSV only — the template is its own action inside the zone, so its
            click must not also open the file picker. */}
        {mode === "csv" && (
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
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={copy.accept}
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
