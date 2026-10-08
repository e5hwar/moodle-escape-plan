import { useEffect, useState } from "react";
import { hasIdDocument, idDocOf, idTimelineOf, type IdRecord } from "../data/manageIds";
import { NoteCard } from "./NoteCard";
import { PrmModal } from "./PrmModal";
import { STATUS_LABEL } from "./ManageIdsSearch";
import { ZoomableIdCard, type IdCardData } from "./IdCard";
import { IdDetailsHover } from "./UserDetailsHover";

/** Profiles open in their own tab, matching the Users table's `?profile=` pattern. */
function openInNewTab(query: string) {
  window.open(`${window.location.origin}${window.location.pathname}?${query}`, "_blank", "noopener");
}

/** Maps a record onto the shared ID card's shape. The card's header band shows
 *  the issuing region beside the document, so the "US " prefix is dropped —
 *  same adaptation the Proctoring console makes. The card prints the name the
 *  DOCUMENT carries, not the account's current one. */
export function idCardOf(record: IdRecord): IdCardData {
  const doc = idDocOf(record);
  return {
    name: record.docName,
    idType: record.idType.replace(/^US\s+/i, ""),
    idNumber: doc.idNumber,
    dob: doc.dob,
    expires: doc.expires,
    region: doc.region,
    photoSeed: doc.photoSeed,
  };
}

/* What the drop zone's hint promises — enforced, not just printed. */
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/heic", "image/heif", "image/webp"];
const ACCEPTED_EXT = /\.(png|jpe?g|heic|heif|webp)$/i;
const MAX_BYTES = 100 * 1024 * 1024;
/** Browsers can't draw HEIC / HEIF, so those preview as the stand-in card. */
const PREVIEWABLE = ["image/png", "image/jpeg", "image/webp"];

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
  onReplace: (status: "approved" | "in-review") => void;
  onApprove: () => void;
}) {
  /* The upload dialog stacks ON TOP of this one — the ID stays on screen behind
     it, its ✕ drops back to the ID, and either upload action decides the record
     and closes both. */
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const hasDoc = hasIdDocument(record);
  /* The card's full-view overlay owns Escape while it's open — without this the
     same keypress would also close the modal underneath. */
  const [idFullView, setIdFullView] = useState(false);

  const timeline = idTimelineOf(record);

  // The preview's object URL lives as long as the file it shows.
  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!(ACCEPTED_TYPES.includes(f.type) || ACCEPTED_EXT.test(f.name))) {
      setFileError("Upload a PNG, JPG, HEIC, HEIF or WebP file");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError("File is larger than 100MB");
      return;
    }
    setFileError(null);
    setFile(f);
    setFileUrl(PREVIEWABLE.includes(f.type) ? URL.createObjectURL(f) : null);
  }

  function closeUpload() {
    setUploadOpen(false);
    setFile(null);
    setFileUrl(null);
    setFileError(null);
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
  function decide(status: "approved" | "in-review") {
    onReplace(status);
    closeUpload();
    onClose();
  }

  return (
    <>
      {/* Figma 460:1792 (Approved), 460:2445 (Review Pending), 460:2546
          (Reupload Requested) — one layout for all three on the shared modal
          shell (PrmModal, 667:884): the name over an "ID Status: …" line, the
          document, and a footer whose Approve button is the only per-state
          difference. The document type and upload stamp are gone; both read off
          the ID itself. */}
      <PrmModal
        className="mid-modal"
        ariaLabel={`${record.name}'s ID`}
        title={
          /* The name opens the full profile in a new tab. It carries no hover
             card of its own — the user-details peek belongs to the Users page,
             and this popup is about the document. */
          <button className="rvc-headlink" onClick={() => openInNewTab(`profile=${record.id}`)}>
            {record.name}
          </button>
        }
        description={
          /* Hovering the status alone gives the timeline on its own (Figma
             679:2039) — which stamps show depends on what has happened to the
             document. */
          <>
            ID Status:{" "}
            <IdDetailsHover timeline={timeline}>
              <span className="mid-head-status">{STATUS_LABEL[record.status]}</span>
            </IdDetailsHover>
          </>
        }
        hideCancel
        footerExtra={
          <button className="prm-quiet" onClick={() => setUploadOpen(true)}>
            {hasDoc ? "Replace ID" : "Upload ID"}
          </button>
        }
        /* Only a document waiting on a decision offers Approve — never an
           approved one, and never while a re-upload is awaited (there is
           nothing on file to approve). */
        confirmLabel={record.status === "in-review" ? "Approve" : undefined}
        onConfirm={onApprove}
        onCancel={onClose}
      >
        {/* The design shows the document alone — no full-view/rotate row under
            it and no hover magnifier (the card still opens full view on click).
            A re-upload request removed the rejected document, so until the new
            one arrives there is nothing to show. */}
        {hasDoc ? (
          <ZoomableIdCard
            data={idCardOf(record)}
            onFullViewChange={setIdFullView}
            hideTools
            noMagnify
            caption
          />
        ) : (
          <NoteCard
            title="Waiting for a new ID"
            body={`${record.name} was asked to upload their ID again. The rejected document has been removed.`}
          />
        )}
      </PrmModal>

      {uploadOpen && (
        /* Figma 467:673 / 467:950 — a narrower dialog (its document is 420px
           where the ID view's is 640), stacked over the ID rather than
           replacing it. The drop zone fills the body until a file is chosen,
           then the document itself takes its place. */
        <PrmModal
          className="mid-modal--upload"
          title="Upload ID"
          ariaLabel={`Upload a new ID for ${record.name}`}
          hideCancel
          /* An approved ID is replaced by another approved one — leaving it
             unapproved would take an already-verified user back to review. */
          footerExtra={
            record.status === "approved" ? undefined : (
              <button className="prm-quiet" disabled={!file} onClick={() => decide("in-review")}>
                Upload Without Approval
              </button>
            )
          }
          confirmLabel="Upload & Approve"
          confirmDisabled={!file}
          onConfirm={() => decide("approved")}
          onCancel={closeUpload}
        >
          {file ? (
            fileUrl ? (
              /* The file just chosen, at the document's own size. */
              <img className="mid-upload-preview" src={fileUrl} alt={file.name} />
            ) : (
              /* HEIC / HEIF can't be drawn by the browser — the document
                 stand-in takes its place. */
              <ZoomableIdCard
                data={{ ...idCardOf(record), name: record.name }}
                onFullViewChange={setIdFullView}
                hideTools
                noMagnify
              />
            )
          ) : (
            <label className={`mid-drop${fileError ? " has-error" : ""}`}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/heic,image/heif,image/webp,.heic,.heif"
                className="mid-drop-input"
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
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
              {fileError && <span className="mid-drop-error">{fileError}</span>}
            </label>
          )}
        </PrmModal>
      )}
    </>
  );
}
