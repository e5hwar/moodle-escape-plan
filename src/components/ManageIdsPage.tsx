import { useEffect, useMemo, useState } from "react";
import {
  idRecords as seedRecords,
  type IdRecord,
  type IdStatus,
} from "../data/manageIds";
import { SearchIcon, ChevronLeftIcon, SmallXIcon, CheckIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { PillTrigger, summarize, SectionedMultiSelect } from "./Filters";

/** Filter labels shown in the Status pill, mapped to underlying IdStatus values. */
const STATUS_OPTIONS: { label: string; value: IdStatus }[] = [
  { label: "Approved", value: "approved" },
  { label: "In Review", value: "in-review" },
  { label: "Reupload Requested", value: "reupload-requested" },
];
const STATUS_LABELS = STATUS_OPTIONS.map((o) => o.label);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

const ReplaceIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-3.3-6.96" />
    <path d="M21 4v5h-5" />
  </svg>
);

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
  </svg>
);

function initialsOf(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

export function ManageIdsPage({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<IdRecord[]>(seedRecords);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [viewing, setViewing] = useState<IdRecord | null>(null);
  const [replacing, setReplacing] = useState<IdRecord | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const statuses = STATUS_OPTIONS.filter((o) =>
      statusFilter.includes(o.label),
    ).map((o) => o.value);
    return records.filter((r) => {
      if (statuses.length > 0 && !statuses.includes(r.status)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q)
      );
    });
  }, [records, query, statusFilter]);

  function applyReplace(record: IdRecord, status: IdStatus) {
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, status } : r)),
    );
    setReplacing(null);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks pr-page">
          <header className="tasks-header">
            <div>
              <button className="attempts-back" onClick={onBack}>
                <ChevronLeftIcon />
                Proctoring
              </button>
              <h1 className="tasks-title">Manage IDs</h1>
              <div className="tasks-subtitle">
                <span>{records.length} verified identities</span>
                <span className="tasks-subtitle-dot" />
                <span>View or replace a candidate's uploaded ID</span>
              </div>
            </div>
          </header>

          {/* Search — same styling as Tasks / Users pages */}
          <div className="mid-controls">
            <div className="usearch">
              <div className={`usearch-bar ${focused ? "open" : ""}`}>
                <span className="usearch-icon">
                  <SearchIcon />
                </span>
                <input
                  className="usearch-input"
                  placeholder="Search by name, email, or phone…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
                <span className="usearch-kbd">
                  <span className="kbd-cmd">⌘</span>
                  <span className="kbd-letter">K</span>
                </span>
              </div>
            </div>
          </div>

          {/* Filters — same styling as other admin pages */}
          <div className="filters">
            <StatusPill value={statusFilter} onApply={setStatusFilter} />
            {statusFilter.length > 0 && (
              <button
                className="filter-clear-link"
                onClick={() => setStatusFilter([])}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="tasks-scroll pr-scroll">
            <div className="mid-table">
              <div className="mid-thead">
                <div className="mid-th mid-col-user">User</div>
                <div className="mid-th mid-col-phone">Phone</div>
                <div className="mid-th mid-col-id">ID</div>
                <div className="mid-th mid-col-status">Status</div>
                <div className="mid-th mid-col-actions" aria-hidden />
              </div>
              <div className="mid-tbody">
                {filtered.length === 0 ? (
                  <div className="pr-empty">No users match your search.</div>
                ) : (
                  filtered.map((r) => (
                    <div key={r.id} className="mid-row">
                      <div className="mid-col-user">
                        <span className="mid-avatar">{initialsOf(r.name)}</span>
                        <div className="mid-user-text">
                          <div className="mid-user-name">{r.name}</div>
                          <div className="mid-user-email">{r.email}</div>
                        </div>
                      </div>
                      <div className="mid-col-phone mid-cell-body">{r.phone}</div>
                      <div className="mid-col-id mid-cell-body">{r.idType}</div>
                      <div className="mid-col-status">
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mid-col-actions">
                        <button
                          className="mid-action-btn"
                          onClick={() => setViewing(r)}
                        >
                          <EyeIcon />
                          <span>View ID</span>
                        </button>
                        <button
                          className="mid-action-btn"
                          onClick={() => setReplacing(r)}
                        >
                          <ReplaceIcon />
                          <span>Replace ID</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewing && (
        <ViewIdModal record={viewing} onClose={() => setViewing(null)} />
      )}
      {replacing && (
        <ReplaceIdModal
          record={replacing}
          onClose={() => setReplacing(null)}
          onApprove={() => applyReplace(replacing, "approved")}
          onInReview={() => applyReplace(replacing, "in-review")}
          onRequestReupload={() => applyReplace(replacing, "reupload-requested")}
        />
      )}
    </div>
  );
}

function StatusPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, STATUS_LABELS);
  return (
    <Dropdown
      width={200}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="ID Status"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: STATUS_LABELS }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

const STATUS_LABEL: Record<IdStatus, string> = {
  approved: "Approved",
  "in-review": "In Review",
  "reupload-requested": "Reupload Requested",
};

function StatusBadge({ status }: { status: IdStatus }) {
  return (
    <span className={`mid-badge mid-badge--${status}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function ViewIdModal({
  record,
  onClose,
}: {
  record: IdRecord;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pr-modal-overlay" onClick={onClose}>
      <div
        className="mid-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mid-modal-head">
          <div>
            <div className="mid-modal-title">{record.name}'s ID</div>
            <div className="mid-modal-sub">
              {record.idType}
              <span className="pr-meta-dot" />
              Uploaded {record.uploadedAt}
            </div>
          </div>
          <button className="pr-modal-close" onClick={onClose} aria-label="Close">
            <SmallXIcon />
          </button>
        </div>
        <div className="mid-modal-body">
          <IdCard name={record.name} idType={record.idType} />
        </div>
      </div>
    </div>
  );
}

function ReplaceIdModal({
  record,
  onClose,
  onApprove,
  onInReview,
  onRequestReupload,
}: {
  record: IdRecord;
  onClose: () => void;
  onApprove: () => void;
  onInReview: () => void;
  onRequestReupload: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pr-modal-overlay" onClick={onClose}>
      <div className="mid-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mid-modal-head">
          <div>
            <div className="mid-modal-title">Replace ID</div>
            <div className="mid-modal-sub">
              {record.name}
              <span className="pr-meta-dot" />
              {record.email}
            </div>
          </div>
          <button className="pr-modal-close" onClick={onClose} aria-label="Close">
            <SmallXIcon />
          </button>
        </div>
        <div className="mid-modal-body">
          <label className="mid-upload">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="mid-upload-input"
              onChange={(e) =>
                setFileName(e.target.files?.[0]?.name ?? null)
              }
            />
            <span className="mid-upload-icon">
              <UploadIcon />
            </span>
            {fileName ? (
              <>
                <span className="mid-upload-title">{fileName}</span>
                <span className="mid-upload-hint">Click to choose a different file</span>
              </>
            ) : (
              <>
                <span className="mid-upload-title">Upload a new ID</span>
                <span className="mid-upload-hint">
                  Drag & drop or click to browse · PNG, JPG, or PDF
                </span>
              </>
            )}
          </label>

          <div className="mid-decision">
            <span className="mid-decision-label">
              After uploading, set the ID status:
            </span>
            <div className="mid-decision-actions">
              <button
                className="mid-decide-btn mid-decide-btn--approve"
                disabled={!fileName}
                onClick={onApprove}
              >
                <CheckIcon />
                Mark as Approved
              </button>
              <button
                className="mid-decide-btn mid-decide-btn--review"
                disabled={!fileName}
                onClick={onInReview}
              >
                Leave as In-Review
              </button>
            </div>
            <button
              className="mid-decide-reupload"
              onClick={onRequestReupload}
            >
              <ReplaceIcon />
              Request new upload from candidate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Stylized mock ID card — mirrors the proctoring detail card without external assets. */
function IdCard({ name, idType }: { name: string; idType: string }) {
  const upperName = name.toUpperCase();
  const isPassport = idType.toLowerCase().includes("passport");
  return (
    <div className={`pr-id-card ${isPassport ? "pr-id-card--passport" : ""}`}>
      <div className="pr-id-card-inner">
        <div className="pr-id-card-header">
          <span className="pr-id-card-title">
            {isPassport ? "PASSPORT" : "DRIVER'S LICENSE"}
          </span>
          <span className="pr-id-card-star">★</span>
        </div>
        <div className="pr-id-card-row">
          <div className="pr-id-card-photo mid-id-photo" aria-hidden>
            {initialsOf(name)}
          </div>
          <div className="pr-id-card-fields">
            <div className="pr-id-field pr-id-field--name">{upperName}</div>
            <div className="pr-id-field">123 ANYWHERE ST</div>
            <div className="pr-id-field">CITY, STATE 12345</div>
            <div className="pr-id-field pr-id-field--mono">D123-456-789-000</div>
            <div className="pr-id-field-row">
              <span>DOB 04/15/1993</span>
              <span>ISS 09/12/2022</span>
            </div>
            <div className="pr-id-field-row">
              <span>SEX M</span>
              <span>EYES BRO</span>
              <span>HGT 6-01</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
