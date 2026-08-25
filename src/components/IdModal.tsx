import { useEffect, useState } from "react";
import { idDocOf, idTimelineOf, type IdRecord, type IdStatus } from "../data/manageIds";
import { SmallXIcon } from "./icons";
import { STATUS_LABEL } from "./ManageIdsSearch";
import { ZoomableIdCard, type IdCardData } from "./IdCard";
import { IdDetailsHover } from "./UserDetailsHover";

/** Profiles open in their own tab, matching the Users table's `?profile=` pattern. */
function openInNewTab(query: string) {
  window.open(`${window.location.origin}${window.location.pathname}?${query}`, "_blank", "noopener");
}

/** Maps a record onto the shared ID card's shape. The card's header band shows
 *  the issuing region beside the document, so the "US " prefix is dropped —
 *  same adaptation the Proctoring console makes. */
export function idCardOf(record: IdRecord): IdCardData {
  const doc = idDocOf(record);
  return {
    name: record.name,
    idType: record.idType.replace(/^US\s+/i, ""),
    idNumber: doc.idNumber,
    dob: doc.dob,
    expires: doc.expires,
    region: doc.region,
    photoSeed: doc.photoSeed,
  };
}

const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
  </svg>
);

/* ── ID popup ──────────────────────────────────────────────────────────────
   One modal with two modes: the uploaded document (the old "View ID"), and the
   replace flow that used to be a second modal opened from its own row button.
   Replace is reached from the footer here, so a reviewer who opened the row to
   look at the ID can act on it without going back to the table.

   Shared by the Manage IDs table (row click) and the Full Profile's "View ID"
   button — same document, same actions, wherever it is opened from. */
export function IdModal({
  record,
  onClose,
  onReplace,
  onApprove,
}: {
  record: IdRecord;
  onClose: () => void;
  onReplace: (status: IdStatus) => void;
  onApprove: () => void;
}) {
  /* The upload dialog stacks ON TOP of this one — the ID stays on screen behind
     it, its ✕ drops back to the ID, and either upload action decides the record
     and closes both. */
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  /* The card's full-view overlay owns Escape while it's open — without this the
     same keypress would also close the modal underneath. */
  const [idFullView, setIdFullView] = useState(false);

  const timeline = idTimelineOf(record);

  function closeUpload() {
    setUploadOpen(false);
    setFileName(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (idFullView) return;
      if (e.key !== "Escape") return;
      if (uploadOpen) closeUpload();
      else onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, uploadOpen, idFullView]);

  /* An upload decides the ID outright, so it takes the whole stack down with it. */
  function decide(status: IdStatus) {
    onReplace(status);
    setFileName(null);
    setUploadOpen(false);
    onClose();
  }

  return (
    <>
      <div className="pm-overlay" onClick={onClose}>
        <div
          className="pm-modal mid-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${record.name}'s ID`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Figma 460:1792 (Approved), 460:2445 (Review Pending), 460:2546
              (Reupload Requested) — one layout for all three: the name over an
              "ID Status: …" line, the document, and a footer whose Approve
              button is the only per-state difference. The document type and
              upload stamp are gone; both read off the ID itself. */}
          <div className="mid-head">
            <div className="mid-head-left">
              <h2 className="tasks-title mid-title">
                {/* The name opens the full profile in a new tab. It carries no
                    hover card of its own — the user-details peek belongs to the
                    Users page, and this popup is about the document. */}
                <button
                  className="rvc-headlink"
                  onClick={() => openInNewTab(`profile=${record.id}`)}
                >
                  {record.name}
                </button>
              </h2>
              {/* Hovering the status alone gives the timeline on its own
                  (Figma 679:2039) — which stamps show depends on what has
                  happened to the document. */}
              <div className="mid-head-sub">
                ID Status:{" "}
                <IdDetailsHover timeline={timeline}>
                  <span className="mid-head-status">{STATUS_LABEL[record.status]}</span>
                </IdDetailsHover>
              </div>
            </div>
            <button className="mid-close" aria-label="Close" onClick={onClose}>
              <SmallXIcon />
            </button>
          </div>

          {/* The design shows the document alone — no full-view/rotate row under
              it and no hover magnifier (the card still opens full view on
              click). */}
          <div className="mid-body">
            <ZoomableIdCard
              data={idCardOf(record)}
              onFullViewChange={setIdFullView}
              hideTools
              noMagnify
            />
            {/* Plain caption, not a control — the card itself is the target. */}
            <div className="mid-body-cap">Click for the Full-Screen View</div>
          </div>
          <div className="mid-foot">
            <button className="btn-save-draft" onClick={() => setUploadOpen(true)}>
              Replace ID
            </button>
            {/* Only an ID that still needs a decision offers Approve. */}
            {record.status !== "approved" && (
              <button className="btn-primary" onClick={onApprove}>
                Approve
              </button>
            )}
          </div>
        </div>
      </div>

      {uploadOpen && (
        /* Figma 467:673 / 467:950 — a narrower dialog (its document is 420px
           where the ID view's is 640), layered over the ID rather than
           replacing it. The drop zone fills the body until a file is chosen,
           then the document itself takes its place. */
        <div className="pm-overlay mid-upload-overlay" onClick={closeUpload}>
          <div
            className="pm-modal mid-modal mid-modal--upload"
            role="dialog"
            aria-modal="true"
            aria-label={`Upload a new ID for ${record.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mid-head">
              <div className="mid-head-left">
                <h2 className="tasks-title mid-title">Upload ID</h2>
              </div>
              <button className="mid-close" aria-label="Close" onClick={closeUpload}>
                <SmallXIcon />
              </button>
            </div>

            <div className="mid-body mid-body--upload">
              {fileName ? (
                /* Stand-in for the file just chosen: the prototype has no real
                   upload, so the record's own document stands in for it. */
                <ZoomableIdCard
                  data={idCardOf(record)}
                  onFullViewChange={setIdFullView}
                  hideTools
                  noMagnify
                />
              ) : (
                <label className="mid-drop">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/heic,image/heif,image/webp"
                    className="mid-drop-input"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  />
                  <span className="mid-drop-icon">
                    <UploadIcon />
                  </span>
                  <span className="mid-drop-title">Drag and drop, or click to upload</span>
                  <span className="mid-drop-hint">
                    Accepted File Types: PNG, JPG, HEIC, HEIF, WebP
                    <br />
                    Maximum File Size: 100MB
                  </span>
                </label>
              )}
            </div>
            <div className="mid-foot">
              <button
                className="btn-save-draft"
                disabled={!fileName}
                onClick={() => decide("in-review")}
              >
                Upload Without Approval
              </button>
              <button
                className="btn-primary"
                disabled={!fileName}
                onClick={() => decide("approved")}
              >
                Upload &amp; Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
