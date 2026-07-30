import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Submission, WebcamFrame } from "../data/proctoring";
import { ChevronLeftIcon, SmallXIcon } from "./icons";

const ChevronRightIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const SectionCaretIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const CheckMarkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

const RejectXIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const RequestIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 8l9 6 9-6" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
  </svg>
);

/** Opens the candidate's Manage Users profile in a new tab — the same
 *  standalone `?profile=` route UsersPage uses, since submissions and
 *  users share the same underlying User records. */
function openUserProfile(userId: string) {
  window.open(
    `${window.location.origin}${window.location.pathname}?profile=${userId}`,
    "_blank",
    "noopener",
  );
}

const WarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.8L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const ZoomInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
  </svg>
);
const ZoomOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3M8 11h6" />
  </svg>
);
const ResetIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

type ConfirmKind = "accept" | "reject" | "request";

type Props = {
  submission: Submission;
  previousRejected?: Submission[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onAccept?: () => void;
  onReject?: (details?: RejectDetails) => void;
  onRequestId?: () => void;
  onUpdateName?: (name: string) => void;
};

export type RejectDetails = {
  reasons: string[];
  frameIndexes: number[];
};

const REJECT_REASONS = [
  "Eyes were not focused on camera",
  "Camera was not clear",
  "Camera wasn't recording",
];

export function ProctoringDetailModal({
  submission,
  previousRejected = [],
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onAccept,
  onReject,
  onRequestId,
  onUpdateName,
}: Props) {
  const [zoom, setZoom] = useState<{ title: string; content: ReactNode } | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoom) setZoom(null);
        else if (confirmKind) setConfirmKind(null);
        else onClose();
      } else if (!zoom && !confirmKind && e.key === "ArrowLeft" && hasPrev) onPrev?.();
      else if (!zoom && !confirmKind && e.key === "ArrowRight" && hasNext) onNext?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext, hasPrev, hasNext, zoom, confirmKind]);

  // ID reviews and reupload requests only involve the ID — no exam was proctored.
  const hasFootage = submission.kind === "proctoring";
  const flaggedFrames = submission.frames.filter((f) => !!f.flag);
  const confidenceClass =
    submission.idConfidence >= 90
      ? "is-strong"
      : submission.idConfidence >= 75
      ? "is-ok"
      : "is-weak";

  return (
    <div className="pr-modal-overlay" onClick={onClose}>
      <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pr-modal-head">
          <div className="pr-modal-nav">
            <button
              className="pr-nav-btn"
              disabled={!hasPrev}
              onClick={onPrev}
              aria-label="Previous submission"
              title="Previous"
            >
              <ChevronLeftIcon />
            </button>
            <button
              className="pr-nav-btn"
              disabled={!hasNext}
              onClick={onNext}
              aria-label="Next submission"
              title="Next"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="pr-modal-title-block">
            <div className="pr-modal-name-row">
              <span className="pr-modal-name">{submission.candidateName}</span>
              <button className="pr-modal-edit" aria-label="Edit candidate">
                <EditIcon />
              </button>
              <button
                className="pr-modal-edit"
                aria-label="View full profile"
                title="Open full profile in Manage Users"
                onClick={() => openUserProfile(submission.userId)}
              >
                <ExternalLinkIcon />
              </button>
            </div>
            <div className="pr-modal-meta">
              <span>{submission.examShort}</span>
              <span className="pr-meta-dot" />
              <span>{submission.submittedAt}</span>
              <span className="pr-meta-dot" />
              <span>Grade {submission.grade}</span>
            </div>
          </div>

          <div className="pr-modal-actions">
            <button className="pr-action-btn pr-action-btn--accept" onClick={() => setConfirmKind("accept")}>
              <CheckMarkIcon />
              <span>ACCEPT</span>
            </button>
            <button className="pr-action-btn pr-action-btn--reject" onClick={() => setConfirmKind("reject")}>
              <RejectXIcon />
              <span>REJECT</span>
            </button>
            <button className="pr-action-btn pr-action-btn--request" onClick={() => setConfirmKind("request")}>
              <RequestIcon />
              <span>REQUEST ID</span>
            </button>
          </div>

          <button
            className="pr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <SmallXIcon />
          </button>
        </div>

        {/* Body */}
        <div className="pr-modal-body">
          <IntegrityNoteBanner submission={submission} previousRejected={previousRejected} />

          {/* ID Verification */}
          <section className="pr-section">
            <div className="pr-section-head">
              <span className="pr-section-caret">
                <SectionCaretIcon />
              </span>
              <span className="pr-section-title">ID Verification</span>
              <span className="pr-meta-dot" />
              <span className={`pr-section-stat ${confidenceClass}`}>
                {submission.idConfidence}% Confidence
              </span>
              <span className="pr-meta-dot" />
              <span className="pr-section-meta">{submission.idType}</span>
            </div>
            <NameMismatchBanner submission={submission} onUpdate={onUpdateName} />
            <div className="pr-id-row">
              <div
                className="pr-zoomable"
                onClick={() =>
                  setZoom({
                    title: `${submission.idType} · ${submission.candidateName}`,
                    content: (
                      <MockIdCard candidateName={submission.candidateName} idType={submission.idType} />
                    ),
                  })
                }
                role="button"
                tabIndex={0}
                aria-label="Zoom ID image"
              >
                <MockIdCard candidateName={submission.candidateName} idType={submission.idType} />
              </div>
            </div>
          </section>

          {/* ID reviews and reupload requests are ID-only — no proctoring footage was captured. */}
          {hasFootage && (
            <>
              {/* Complete webcam footage */}
              <section className="pr-section">
                <div className="pr-section-head">
                  <span className="pr-section-caret">
                    <SectionCaretIcon />
                  </span>
                  <span className="pr-section-title">Complete Webcam Footage</span>
                  <span className="pr-meta-dot" />
                  <span
                    className={`pr-section-stat ${
                      submission.webcamFlaggedCount > 0 ? "is-bad" : "is-strong"
                    }`}
                  >
                    {submission.webcamFlaggedCount}/{submission.webcamTotal} Images Flagged
                  </span>
                </div>
                <div className="pr-frame-grid">
                  {submission.frames.map((f, i) => (
                    <FrameCell key={`all-${i}`} frame={f} onZoom={() => setZoom({ title: frameZoomTitle(f, i), content: <ZoomedFrame frame={f} /> })} />
                  ))}
                </div>
              </section>

              {/* Flagged images */}
              <section className="pr-section">
                <div className="pr-section-head">
                  <span className="pr-section-caret">
                    <SectionCaretIcon />
                  </span>
                  <span className="pr-section-title">Flagged Images</span>
                  <span className="pr-meta-dot" />
                  <span className="pr-section-meta">
                    {flaggedFrames.length} {flaggedFrames.length === 1 ? "frame" : "frames"}
                  </span>
                </div>
                {flaggedFrames.length === 0 ? (
                  <div className="pr-empty">
                    No flagged frames. The candidate maintained good camera presence
                    throughout the exam.
                  </div>
                ) : (
                  <div className="pr-frame-grid">
                    {flaggedFrames.map((f, i) => (
                      <FrameCell key={`flag-${i}`} frame={f} onZoom={() => setZoom({ title: frameZoomTitle(f, i), content: <ZoomedFrame frame={f} /> })} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {zoom && (
        <ImageZoomOverlay title={zoom.title} onClose={() => setZoom(null)}>
          {zoom.content}
        </ImageZoomOverlay>
      )}

      {confirmKind === "reject" && hasFootage ? (
        <RejectModal
          submission={submission}
          onCancel={() => setConfirmKind(null)}
          onConfirm={(details) => {
            setConfirmKind(null);
            onReject?.(details);
          }}
        />
      ) : confirmKind ? (
        <ConfirmActionModal
          kind={confirmKind}
          candidateName={submission.candidateName}
          onCancel={() => setConfirmKind(null)}
          onConfirm={() => {
            setConfirmKind(null);
            if (confirmKind === "accept") onAccept?.();
            else if (confirmKind === "reject") onReject?.();
            else onRequestId?.();
          }}
        />
      ) : null}
    </div>
  );
}

const CONFIRM_COPY: Record<
  ConfirmKind,
  { title: string; body: (name: string) => string; confirmLabel: string; icon: () => JSX.Element }
> = {
  accept: {
    title: "Accept this submission?",
    body: (name) => `${name}'s exam will be marked approved and removed from the review queue.`,
    confirmLabel: "Accept",
    icon: CheckMarkIcon,
  },
  reject: {
    title: "Reject this submission?",
    body: (name) => `${name}'s exam will be marked rejected and removed from the review queue.`,
    confirmLabel: "Reject",
    icon: RejectXIcon,
  },
  request: {
    title: "Request a new ID upload?",
    body: (name) =>
      `${name} will be asked to re-upload a clearer ID. This submission moves to the ID Re-uploads tab until they do.`,
    confirmLabel: "Request ID",
    icon: RequestIcon,
  },
};

function ConfirmActionModal({
  kind,
  candidateName,
  onCancel,
  onConfirm,
}: {
  kind: ConfirmKind;
  candidateName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = CONFIRM_COPY[kind];
  const Icon = copy.icon;

  return (
    <div className="pr-confirm-overlay" onClick={onCancel}>
      <div className="pr-confirm" onClick={(e) => e.stopPropagation()}>
        <div className={`pr-confirm-icon pr-confirm-icon--${kind}`}>
          <Icon />
        </div>
        <div className="pr-confirm-title">{copy.title}</div>
        <div className="pr-confirm-body">{copy.body(candidateName)}</div>
        <div className="pr-confirm-actions">
          <button className="pr-confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className={`pr-confirm-confirm pr-confirm-confirm--${kind}`} onClick={onConfirm}>
            <Icon />
            <span>{copy.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  submission,
  onCancel,
  onConfirm,
}: {
  submission: Submission;
  onCancel: () => void;
  onConfirm: (details: RejectDetails) => void;
}) {
  const [reasons, setReasons] = useState<Set<string>>(new Set());
  const [frames, setFrames] = useState<Set<number>>(new Set());

  const canReject = reasons.size > 0 && frames.size > 0;

  function toggleReason(r: string) {
    setReasons((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });
  }

  function toggleFrame(i: number) {
    setFrames((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="pr-confirm-overlay" onClick={onCancel}>
      <div className="pr-reject-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pr-reject-head">
          <div className="pr-confirm-icon pr-confirm-icon--reject">
            <RejectXIcon />
          </div>
          <div className="pr-reject-head-text">
            <div className="pr-confirm-title">Reject {submission.candidateName}&apos;s attempt?</div>
            <div className="pr-confirm-body">
              Select at least one reason and the images to attach to the proctoring report.
            </div>
          </div>
          <button className="pr-modal-close" onClick={onCancel} aria-label="Close">
            <SmallXIcon />
          </button>
        </div>

        <div className="pr-reject-body">
          <div className="pr-reject-section">
            <div className="pr-reject-label">
              Reason for rejection <span className="pr-reject-hint">select all that apply</span>
            </div>
            <div className="pr-reject-reasons">
              {REJECT_REASONS.map((r) => {
                const on = reasons.has(r);
                return (
                  <button
                    key={r}
                    className={`pr-reason ${on ? "is-on" : ""}`}
                    onClick={() => toggleReason(r)}
                    aria-pressed={on}
                  >
                    <span className="pr-reason-check">{on && <CheckMarkIcon />}</span>
                    <span>{r}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pr-reject-section">
            <div className="pr-reject-label">
              Attach images to report{" "}
              <span className="pr-reject-hint">
                {frames.size > 0 ? `${frames.size} selected` : "select at least one"}
              </span>
            </div>
            <div className="pr-reject-grid">
              {submission.frames.map((f, i) => {
                const on = frames.has(i);
                return (
                  <button
                    key={i}
                    className={`pr-reject-frame ${on ? "is-on" : ""} ${f.flag ? "is-flagged" : ""}`}
                    onClick={() => toggleFrame(i)}
                    aria-pressed={on}
                    aria-label={`Frame ${i + 1}${f.flag ? ` — ${f.flag}` : ""}`}
                  >
                    <FrameAvatar tone={f.tone} flagged={!!f.flag} />
                    {f.flag && <span className="pr-frame-tag">{f.flag}</span>}
                    <span className="pr-reject-frame-check">{on && <CheckMarkIcon />}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pr-confirm-actions pr-reject-foot">
          <button className="pr-confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="pr-confirm-confirm pr-confirm-confirm--reject"
            disabled={!canReject}
            onClick={() =>
              canReject &&
              onConfirm({ reasons: [...reasons], frameIndexes: [...frames] })
            }
          >
            <RejectXIcon />
            <span>Reject</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function frameZoomTitle(frame: WebcamFrame, index: number) {
  return frame.flag ? `Frame ${index + 1} · ${frame.flag}` : `Frame ${index + 1}`;
}

function FrameCell({ frame, onZoom }: { frame: WebcamFrame; onZoom: () => void }) {
  const flagged = !!frame.flag;
  return (
    <div
      className={`pr-frame ${flagged ? "is-flagged" : ""} pr-frame--${frame.tone}`}
      onClick={onZoom}
      role="button"
      tabIndex={0}
      aria-label="Zoom webcam frame"
    >
      <div className="pr-frame-img" aria-hidden>
        <FrameAvatar tone={frame.tone} flagged={flagged} />
      </div>
      {flagged && (
        <span className="pr-frame-tag">{frame.flag}</span>
      )}
    </div>
  );
}

function ZoomedFrame({ frame }: { frame: WebcamFrame }) {
  return (
    <div className="pr-zoom-frame">
      <FrameAvatar tone={frame.tone} flagged={!!frame.flag} />
    </div>
  );
}

/** Fullscreen zoom overlay for ID images and webcam frames (reuses .ncr-fs-* shell). */
function ImageZoomOverlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [scale, setScale] = useState(1);
  const clamp = (z: number) => Math.min(3, Math.max(1, z));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="ncr-fs-overlay" onClick={onClose}>
      <div className="ncr-fs-bar">
        <div className="ncr-fs-title">{title}</div>
        <button className="ncr-fs-close" onClick={onClose} aria-label="Close">
          <SmallXIcon />
        </button>
      </div>
      <div className="ncr-fs-stage" onClick={(e) => e.stopPropagation()}>
        <div className="idzoom">
          <div className="idzoom-viewport">
            <div className="pr-zoom-stage" style={{ transform: `scale(${scale})` }}>
              {children}
            </div>
          </div>
          <div className="idzoom-controls">
            <button
              className="idzoom-btn"
              onClick={() => setScale((z) => clamp(z - 0.25))}
              disabled={scale <= 1}
              aria-label="Zoom out"
            >
              <ZoomOutIcon />
            </button>
            <span className="idzoom-level">{Math.round(scale * 100)}%</span>
            <button
              className="idzoom-btn"
              onClick={() => setScale((z) => clamp(z + 0.25))}
              disabled={scale >= 3}
              aria-label="Zoom in"
            >
              <ZoomInIcon />
            </button>
            <button
              className="idzoom-btn idzoom-btn--reset"
              onClick={() => setScale(1)}
              disabled={scale === 1}
              aria-label="Reset zoom"
            >
              <ResetIcon />
            </button>
          </div>
        </div>
      </div>
      <div className="ncr-fs-hint">Press Esc or click outside to close</div>
    </div>
  );
}

/** Not every candidate has integrity concerns — the banner only renders when there's
 * an admin note or a prior rejected attempt (for any exam) to surface. */
function IntegrityNoteBanner({
  submission,
  previousRejected,
}: {
  submission: Submission;
  previousRejected: Submission[];
}) {
  if (!submission.integrityNote && previousRejected.length === 0) return null;

  return (
    <div className="pr-integrity">
      <div className="pr-integrity-icon" aria-hidden>
        <WarningIcon />
      </div>
      <div className="pr-integrity-body">
        <div className="pr-integrity-title">Integrity Note</div>

        {submission.integrityNote && (
          <div className="pr-integrity-section">
            <div className="pr-integrity-label">Admin Note</div>
            <div className="pr-integrity-text">{submission.integrityNote}</div>
          </div>
        )}

        {previousRejected.length > 0 && (
          <div className="pr-integrity-section">
            <div className="pr-integrity-label">
              Previously Rejected Attempts ({previousRejected.length})
            </div>
            <div className="pr-integrity-list">
              {previousRejected.map((r) => (
                <div key={r.id} className="pr-integrity-item">
                  <span className="pr-integrity-item-exam">{r.exam}</span>
                  <span className="pr-meta-dot" />
                  <span className="pr-integrity-item-date">{r.submittedAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NameMismatchBanner({
  submission,
  onUpdate,
}: {
  submission: Submission;
  onUpdate?: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(submission.idDetectedName ?? "");

  if (!submission.idDetectedName || submission.idDetectedName === submission.candidateName) {
    return null;
  }

  return (
    <div className="pr-mismatch">
      <div className="pr-mismatch-icon" aria-hidden>
        <WarningIcon />
      </div>
      <div className="pr-mismatch-body">
        <div className="pr-mismatch-title">Names Don&apos;t Match</div>
        <div className="pr-mismatch-sub">
          User&apos;s name on SkillCat doesn&apos;t match the name detected on the ID
        </div>

        <div className="pr-mismatch-rows">
          <div className="pr-mismatch-row">
            <span className="pr-mismatch-label">SkillCat</span>
            <span>{submission.candidateName}</span>
          </div>
          <div className="pr-mismatch-row">
            <span className="pr-mismatch-label">Uploaded ID</span>
            <span>{submission.idDetectedName}</span>
          </div>
        </div>

        {editing ? (
          <div className="pr-mismatch-edit">
            <input
              className="pr-mismatch-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <div className="pr-mismatch-actions">
              <button className="pr-mismatch-btn pr-mismatch-btn--secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button
                className="pr-mismatch-btn pr-mismatch-btn--primary"
                disabled={!draft.trim()}
                onClick={() => {
                  onUpdate?.(draft.trim());
                  setEditing(false);
                }}
              >
                <CheckMarkIcon />
                <span>Save Name</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="pr-mismatch-question">
              Update the name on SkillCat to “{submission.idDetectedName}”?
            </div>
            <div className="pr-mismatch-actions">
              <button
                className="pr-mismatch-btn pr-mismatch-btn--primary"
                onClick={() => onUpdate?.(submission.idDetectedName!)}
              >
                <CheckMarkIcon />
                <span>Update Name</span>
              </button>
              <button
                className="pr-mismatch-btn pr-mismatch-btn--secondary"
                onClick={() => {
                  setDraft(submission.idDetectedName ?? "");
                  setEditing(true);
                }}
              >
                <EditIcon />
                <span>Edit Name</span>
              </button>
            </div>
          </>
        )}

        <div className="pr-mismatch-note">
          Our AI can make mistakes. Please confirm the correct name before proceeding.
        </div>
      </div>
    </div>
  );
}

function FrameAvatar({ tone, flagged }: { tone: "neutral" | "side" | "dark"; flagged: boolean }) {
  // Stylized SVG silhouette to suggest a webcam thumbnail without external assets
  if (tone === "dark") {
    return (
      <svg viewBox="0 0 148 148" preserveAspectRatio="xMidYMid slice" className="pr-frame-svg">
        <defs>
          <linearGradient id="bg-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c1c20" />
            <stop offset="100%" stopColor="#0a0a0c" />
          </linearGradient>
        </defs>
        <rect width="148" height="148" fill="url(#bg-dark)" />
        <text
          x="74"
          y="80"
          textAnchor="middle"
          fill="#3a3a3f"
          fontFamily="Fira Sans, sans-serif"
          fontWeight="600"
          fontSize="11"
          letterSpacing="0.08em"
        >
          NO FACE
        </text>
      </svg>
    );
  }
  const sideShift = tone === "side" ? 14 : 0;
  return (
    <svg viewBox="0 0 148 148" preserveAspectRatio="xMidYMid slice" className="pr-frame-svg">
      <defs>
        <linearGradient id={`bg-${tone}-${flagged ? "f" : "n"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2622" />
          <stop offset="100%" stopColor="#1a1614" />
        </linearGradient>
        <radialGradient id={`face-${tone}-${flagged ? "f" : "n"}`} cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#d6a984" />
          <stop offset="100%" stopColor="#6b4f3d" />
        </radialGradient>
      </defs>
      <rect width="148" height="148" fill={`url(#bg-${tone}-${flagged ? "f" : "n"})`} />
      {/* shoulders */}
      <path
        d={`M${10 + sideShift} 148 Q${74 + sideShift} 100 ${138 + sideShift} 148 Z`}
        fill="#1a1612"
      />
      {/* head */}
      <ellipse
        cx={74 + sideShift}
        cy={68}
        rx={32}
        ry={38}
        fill={`url(#face-${tone}-${flagged ? "f" : "n"})`}
      />
      {/* hair */}
      <path
        d={`M${42 + sideShift} 50 Q${74 + sideShift} 24 ${106 + sideShift} 50 L${104 + sideShift} 64 Q${74 + sideShift} 44 ${44 + sideShift} 64 Z`}
        fill="#1f1611"
      />
      {/* glasses */}
      {tone !== "side" && (
        <g stroke="#0a0807" strokeWidth="2" fill="none" opacity="0.85">
          <circle cx={62} cy={72} r="6" />
          <circle cx={86} cy={72} r="6" />
          <path d="M68 72 H80" />
        </g>
      )}
      {/* headphone */}
      <path
        d={`M${42 + sideShift} 60 Q${74 + sideShift} 36 ${106 + sideShift} 60`}
        stroke="#0a0a0c"
        strokeWidth="4"
        fill="none"
      />
      <rect x={36 + sideShift} y={62} width="10" height="14" rx="3" fill="#0a0a0c" />
      <rect x={102 + sideShift} y={62} width="10" height="14" rx="3" fill="#0a0a0c" />
    </svg>
  );
}

function MockIdCard({ candidateName, idType }: { candidateName: string; idType: string }) {
  const upperName = candidateName.toUpperCase();
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
          <div className="pr-id-card-photo" aria-hidden>
            <FrameAvatar tone="neutral" flagged={false} />
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
