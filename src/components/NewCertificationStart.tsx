import { useRef, useState, type ReactNode } from "react";
import { UploadIcon, DocumentIcon } from "./icons";

type Method = "scratch" | "backup" | "csv";

// Reference template offered on the CSV Upload path (mirrors the Question Bank
// bulk-upload template). One row per Task; blank Lesson columns put a Task
// directly under its Course.
const CSV_TEMPLATE = `Course (EN),Course (ES),Course Description (EN),Lesson (EN),Lesson (ES),Task Name (EN),Task Name (ES),Task Type,Duration (min)
Refrigerant Basics,Fundamentos de Refrigerantes,Core refrigerant handling,Core Concepts,Conceptos Básicos,Pressure-Temperature Chart,Tabla Presión-Temperatura,xAPI,10
Refrigerant Basics,Fundamentos de Refrigerantes,Core refrigerant handling,Core Concepts,Conceptos Básicos,Section 1 Quiz,Examen Sección 1,Quiz,15
Refrigerant Basics,Fundamentos de Refrigerantes,Core refrigerant handling,,,Final Exam,Examen Final,Quiz,30
`;

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

const PencilIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

export function NewCertificationStart({
  onFromScratch,
  onClose,
}: {
  onFromScratch: () => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<Method | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const pick = (m: Method) => {
    if (m === "scratch") {
      onFromScratch();
      return;
    }
    setMethod(m);
    setFileName(null);
  };

  return (
    <div className="cert-start">
      <div className="cert-start-inner">
        <div className="cert-start-head">
          <h1 className="cert-start-title">Create Certification</h1>
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <p className="cert-start-sub">Choose how you'd like to create this Certification.</p>

        <div className="cert-start-options">
          <OptionCard
            selected={method === "scratch"}
            icon={<PencilIcon />}
            title="From Scratch"
            desc="Build the Certification step by step using the full editor."
            onClick={() => pick("scratch")}
          />
          <OptionCard
            selected={method === "backup"}
            icon={<UploadIcon />}
            title="Upload Backup"
            desc="Restore from a Certification backup file exported from the ⋯ menu."
            onClick={() => pick("backup")}
          />
          <OptionCard
            selected={method === "csv"}
            icon={<DocumentIcon />}
            title="CSV Upload"
            desc="Bulk-create Courses, Lessons, and Tasks from a CSV file."
            onClick={() => pick("csv")}
          />
        </div>

        {method === "backup" && (
          <UploadPanel
            accept=".json,.cert,.zip"
            title="Drop a Certification backup to restore"
            sub="Accepts a .json or .cert backup exported from a Certification's ⋯ menu."
            fileName={fileName}
            onFile={setFileName}
            primaryLabel="Restore & Continue"
            onPrimary={onFromScratch}
          />
        )}

        {method === "csv" && (
          <UploadPanel
            accept=".csv"
            title="Drop a CSV to bulk-create this Certification"
            sub={
              <>
                Courses, Lessons, and Tasks are created from the rows.{" "}
                <a
                  className="qb-dropzone-link"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    downloadTextFile("certification-template.csv", CSV_TEMPLATE, "text/csv");
                  }}
                >
                  Download template
                </a>
              </>
            }
            fileName={fileName}
            onFile={setFileName}
            primaryLabel="Import & Continue"
            onPrimary={onFromScratch}
          />
        )}
      </div>
    </div>
  );
}

function OptionCard({
  selected,
  icon,
  title,
  desc,
  onClick,
}: {
  selected: boolean;
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`cert-start-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span className="cert-start-card-icon">{icon}</span>
      <span className="cert-start-card-title">{title}</span>
      <span className="cert-start-card-desc">{desc}</span>
    </button>
  );
}

function UploadPanel({
  accept,
  title,
  sub,
  fileName,
  onFile,
  primaryLabel,
  onPrimary,
}: {
  accept: string;
  title: string;
  sub: ReactNode;
  fileName: string | null;
  onFile: (name: string | null) => void;
  primaryLabel: string;
  onPrimary: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState(false);

  return (
    <div className="cert-start-upload">
      <label
        className={`qb-dropzone ${active ? "is-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setActive(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f.name);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => onFile(e.target.files?.[0]?.name ?? null)}
        />
        <div className="qb-dropzone-icon"><UploadIcon /></div>
        <div className="qb-dropzone-text">
          <div className="qb-dropzone-title">{fileName ?? title}</div>
          <div className="qb-dropzone-sub">
            {fileName ? "Click Browse files to choose a different file." : sub}
          </div>
        </div>
        <button
          className="qb-dropzone-btn"
          onClick={(e) => {
            e.preventDefault();
            fileRef.current?.click();
          }}
        >
          Browse files
        </button>
      </label>

      <div className="cert-start-upload-foot">
        <button className="cert-start-btn" disabled={!fileName} onClick={onPrimary}>
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
