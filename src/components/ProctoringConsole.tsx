import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { hasProctoringFootage } from "../data/proctoring";
import type { Submission, WebcamFrame } from "../data/proctoring";
import { ChevronRightIcon } from "./icons";
import { ZoomableIdCard, type IdCardData } from "./IdCard";
import { PrmModal } from "./PrmModal";
import { UserDetailsHover } from "./UserDetailsHover";
import { FullscreenViewer } from "./FullscreenViewer";
import { attemptTaskIdForExam } from "../data/certLookup";

/** Maps a submission's ID fields onto the shared card's shape. The "US " prefix
 *  is dropped from the document label because the card already shows the
 *  issuing region beside it ("CALIFORNIA · DRIVER'S LICENSE"). */
function idCardOf(s: Submission): IdCardData {
  return {
    name: s.candidateName,
    idType: s.idType.replace(/^US\s+/i, ""),
    idNumber: s.idNumber,
    dob: s.idDob,
    expires: s.idExpires,
    region: s.idRegion,
    photoSeed: s.idPhotoSeed,
  };
}

/* ── Proctoring console ───────────────────────────────────────────────────
   Full-page, queue-driven review screen for Exam Reviews
   submissions — modeled on ReviewConsole.tsx (the Hands-On review console):
   same page header/breadcrumb, footer and "View Queue" popover chrome
   (.rvc-* — shared with ReviewConsole rather than duplicated). The actual
   review content (ID card, webcam grids, integrity/mismatch banners, accept/
   reject/request-ID actions) is the same content ProctoringDetailModal used
   to show in an overlay — it just lives in a page body now. ── */

/* ── Integrity Note icons (Figma 457:583 / 457:586) ──
   Both transcribed from the exported assets. The note's 20px outline triangle
   and chevron are gone with the expand/collapse: it now carries an 11px FILLED
   alert circle and, on the right, the 10.5px open-in-new glyph. Each is drawn
   at its own natural size and centred by its wrapper span. */
const NoteAlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 0.666667C12.05 0.666667 15.3333 3.95 15.3333 8C15.3333 12.05 12.05 15.3333 8 15.3333C3.95 15.3333 0.666667 12.05 0.666667 8C0.666667 3.95 3.95 0.666667 8 0.666667ZM7.33333 9.33333H8.66667V4.33333H7.33333V9.33333ZM8.66933 10.3333H7.33333V11.6693H8.66933V10.3333Z"
      fill="currentColor"
    />
  </svg>
);

const NoteOpenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M5.25 2.33333H2.33333V11.6667H11.6667V8.75M11.2292 2.77083L7 7M8.16667 2.33333H11.6667V5.83333"
      stroke="currentColor"
      strokeWidth="1.16667"
      strokeLinecap="square"
    />
  </svg>
);


/** Standalone pages open in their own tab, matching the Users table's `?profile=` pattern. */
function openInNewTab(query: string) {
  window.open(`${window.location.origin}${window.location.pathname}?${query}`, "_blank", "noopener");
}

type ConfirmKind = "accept" | "reject" | "request";

export type RejectDetails = {
  reasons: string[];
  frameIndexes: number[];
};

/** Kept as its own constant because selecting it reveals the free-text field. */
const OTHER_REASON = "Other";

/* Wording per Figma 484:1779. */
const REJECT_REASONS = [
  "Eyes were not focused on the camera",
  "Camera was not clear",
  "Camera was not recording",
  OTHER_REASON,
];

export function ProctoringConsole({
  submission,
  queue,
  previousRejected,
  onGoto,
  onExit,
  originLabel,
  onExitToSection,
  onAccept,
  onReject,
  onRequestId,
  onUpdateName,
  onRenameUser,
}: {
  submission: Submission;
  /** The table's filtered + sorted pending submissions — the order Skip and
   *  ←/→ step through. It has no on-screen UI of its own any more. */
  queue: Submission[];
  previousRejected: Submission[];
  onGoto: (id: string) => void;
  onExit: () => void;
  /** When the console was opened from another page, that page's name — it
   *  becomes the trailing crumb, and Exam Reviews moves up a level. */
  originLabel?: string;
  /** The Exam Reviews crumb above `originLabel` — leaves the origin behind and
   *  goes to the Exam Reviews landing. */
  onExitToSection?: () => void;
  onAccept: () => void;
  onReject: (details?: RejectDetails) => void;
  onRequestId: () => void;
  /** The Name Mismatch banner's commit — resolves the mismatch. */
  onUpdateName: (name: string) => void;
  /** A plain rename from the candidate's user-details card. */
  onRenameUser?: (userId: string, name: string) => void;
}) {
  /* The frame viewer shows no title (same chrome as the ID full view), so the
     state is just the node to display. */
  const [zoom, setZoom] = useState<ReactNode | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  /* The ID card's full-view overlay owns the keyboard while it's open — it has
     its own Escape handler, so this page must not also act on the same event. */
  const [idFullView, setIdFullView] = useState(false);
  /* The footage rail's Flagged filter. It's a view filter, not a count — the
     FLAGGED stat stays the true total either way — and it is kept across queue
     navigation so a reviewer scanning flags can keep going. */
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  /* The Name Mismatch card's pending name. It lives here, not in the card, so
     it survives nothing but this submission — `approve` writes it, and moving
     to another candidate re-seeds it from that candidate's name. */
  const [nameDraft, setNameDraft] = useState(submission.candidateName);
  useEffect(() => setNameDraft(submission.candidateName), [submission.id, submission.candidateName]);

  /* The queue has no on-screen control (Figma 445:878 leaves Skip alone on the
     footer's left), but ←/→ still step through it for keyboard users. */
  const index = queue.findIndex((s) => s.id === submission.id);
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < queue.length - 1;

  function gotoIndex(idx: number) {
    if (idx < 0 || idx >= queue.length) return;
    onGoto(queue[idx].id);
  }

  /* Approving is what saves the name — the Name Mismatch card promises exactly
     that, and it's the only commit point: skipping, rejecting or walking away
     leaves the candidate's name alone. The name is written FIRST so the
     submission is accepted under the name the reviewer settled on. */
  function approve() {
    const next = nameDraft.trim();
    if (next && next !== submission.candidateName) onUpdateName(next);
    onAccept();
  }

  /* Footage follows the EXAM, not the queue the submission currently sits in —
     a proctored exam whose ID needs re-sending still has its recording. */
  const hasFootage = hasProctoringFootage(submission);
  /* Already asked for a new ID and still waiting on the candidate (the "Requested"
     state on the ID Re-uploads tab) — there's nothing to ask again for yet. */
  const idAlreadyRequested = submission.status === "id-requested";
  /** This row's document is a re-upload — the rail says so beside the title. */
  const isReupload = submission.kind === "id-reupload";
  const idVerified = hasFootage && !!submission.idPreviouslyVerified;
  const flaggedFrames = submission.frames.filter((f) => !!f.flag);
  /* The three AI CONFIDENCE bands the rail is designed against (Figma 308:2208
     90+ green / 999:1113 80-90 amber / 999:1168 under 80 red). */
  const confidenceClass =
    submission.idConfidence >= 90
      ? "is-strong"
      : submission.idConfidence >= 80
      ? "is-ok"
      : "is-weak";
  /* The rail's REASONS stat names the most common flag and counts the OTHER
     distinct reasons after it — "Looking Away +1" (Figma 1000:1194). Facts, not
     a verdict; the auditor judges. */
  const distinctReasons = [
    ...flaggedFrames.reduce(
      (m, f) => m.set(f.flag!, (m.get(f.flag!) ?? 0) + 1),
      new Map<string, number>(),
    ),
  ].sort((a, b) => b[1] - a[1]);
  const reasonsSummary =
    distinctReasons.length === 0
      ? "-" // Figma 308:2254 uses a plain hyphen here, not an em dash.
      : distinctReasons.length === 1
      ? distinctReasons[0][0]
      : `${distinctReasons[0][0]} +${distinctReasons.length - 1}`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (idFullView) return; // the ID full-view overlay handles its own keys
      if (zoom) { if (e.key === "Escape") setZoom(null); return; }
      if (confirmKind) { if (e.key === "Escape") setConfirmKind(null); return; }
      const tag = ((e.target as HTMLElement)?.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev) gotoIndex(index - 1);
      else if (e.key === "ArrowRight" && hasNext) gotoIndex(index + 1);
      /* The footer's keycaps (Figma 445:878). Reject keeps R (it matches the red
         button) and Request ID Re-Upload takes I. */
      else if (e.key === "a" || e.key === "A") setConfirmKind("accept");
      // No Reject button on ID-only submissions, so no R either.
      else if ((e.key === "r" || e.key === "R") && hasFootage) setConfirmKind("reject");
      else if ((e.key === "i" || e.key === "I") && !idAlreadyRequested) setConfirmKind("request");
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, confirmKind, idFullView, index, hasPrev, hasNext, hasFootage, idAlreadyRequested, queue, submission.id]);

  return (
    <div className="main">
      <div className="workspace">
        <div className="rvc-root">
          {/* ── header — breadcrumb over the candidate + exam ── */}
          <div className="rvc-header">
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Home</span>
                <ChevronRightIcon />
                <span className="rvc-crumb">Operations</span>
                <ChevronRightIcon />
                {/* Opened from the review queue, Exam Reviews IS the page to go
                    back to. Opened from a page that hangs off it, that page is
                    the trailing crumb instead and Exam Reviews reads as the
                    section it sits under. */}
                {originLabel ? (
                  <>
                    <button
                      className="rvc-crumb"
                      onClick={onExitToSection}
                      title="Back to Exam Reviews"
                    >
                      Exam Reviews
                    </button>
                    <ChevronRightIcon />
                    <button
                      className="rvc-crumb rvc-crumb--current"
                      onClick={onExit}
                      title={`Back to ${originLabel}`}
                    >
                      {originLabel}
                    </button>
                  </>
                ) : (
                  <button className="rvc-crumb rvc-crumb--current" onClick={onExit} title="Back to Exam Reviews">
                    Exam Reviews
                  </button>
                )}
              </nav>
              <div className="rvc-pagehead-id">
                <h1 className="tasks-title">
                  {/* Hovering the name peeks at the candidate's details (Figma
                      436:572) — same card the Hands-On review console uses, which
                      is also where the email now lives instead of the subtitle. */}
                  <UserDetailsHover
                    user={{
                      userId: submission.userId,
                      userName: submission.candidateName,
                      email: submission.candidateEmail,
                      phone: submission.candidatePhone,
                    }}
                    onOpenProfile={(id) => openInNewTab(`profile=${id}`)}
                    onRenameUser={onRenameUser}
                  >
                    <button
                      className="rvc-headlink"
                      onClick={() => openInNewTab(`profile=${submission.userId}`)}
                    >
                      {submission.candidateName}
                    </button>
                  </UserDetailsHover>
                </h1>
                {/* The exam + date line opens the quiz attempt behind this
                    submission; the tooltip says so (Figma 451:545). */}
                <QuizAttemptLink submission={submission}>
                  <span>{submission.examShort}</span>
                  <span className="tasks-subtitle-dot" />
                  <span>{submission.submittedAt}</span>
                </QuizAttemptLink>
              </div>
            </div>

            {/* The Integrity Note rides on the right of the page header, beside
                the candidate — it is context on WHO is being reviewed, not a
                heading for the review content, and up here it also stays put
                instead of scrolling away under the first section rail. */}
            <IntegrityNoteBanner submission={submission} previousRejected={previousRejected} />
          </div>

          {/* ── body — single column, the ID section heading it ── */}
          <div className="rvc-body">
            <div className="rvc-stagecol prc-stagecol">
              {/* Already accepted on an earlier submission? The rail says so
                  itself (Figma 1006:1348): a Verified pill beside the title and
                  the approval date in place of the AI read, since there is
                  nothing left for the reviewer to judge here. Proctored exams
                  only — on an ID-only submission the ID check IS the review. */}
              <ReviewSection
                title="ID Verification"
                /* Never both: requesting a re-upload drops the prior
                   verification (it vouched for the document being replaced),
                   so a row is one or the other. */
                badge={isReupload ? <ReuploadedIdPill /> : idVerified ? <VerifiedPill /> : undefined}
                stats={
                  idVerified ? (
                    <RailStat
                      label="Approved On"
                      value={shortDateOf(submission.idPreviouslyVerified!.at)}
                      tone="is-muted"
                    />
                  ) : (
                    <>
                      <RailStat
                        label="AI Confidence"
                        value={`${submission.idConfidence}%`}
                        tone={confidenceClass}
                        info
                      />
                      <RailStat label="Identified Document" value={submission.idType} />
                    </>
                  )
                }
              >
                {/* Card on the left, the name-mismatch prompt beside it on the
                    right. Shared card: hover magnifies, click opens full view,
                    and it rotates — the same component the Name Change Requests
                    page uses. The card is capped at its natural width so the
                    magnifier panel has room to open over the column beside it. */}
                <div className="prc-idrow">
                  <div className="prc-idcard">
                    <ZoomableIdCard data={idCardOf(submission)} onFullViewChange={setIdFullView} hideTools />
                  </div>
                  <NameMismatchBanner
                    submission={submission}
                    draft={nameDraft}
                    onDraftChange={setNameDraft}
                  />
                </div>
              </ReviewSection>

              {/* ID reviews and reupload requests are ID-only — no proctoring
                  footage was captured. The old separate "Flagged Images" section
                  is folded into this one: the FLAGGED stat itself filters the
                  wall (Figma 1000:1184 idle / 1003:1266 applied). */}
              {hasFootage && (
                <ReviewSection
                  title="Proctoring Footage"
                  bodyClass="prc-section-body--footage"
                  stats={
                    <>
                      <RailStat label="Total Frames" value={submission.webcamTotal} tone="is-muted" />
                      <RailStat
                        label="Flagged"
                        value={submission.webcamFlaggedCount}
                        tone={submission.webcamFlaggedCount > 0 ? "is-bad" : "is-strong"}
                        /* Nothing to narrow to when nothing is flagged, so the
                           stat stays a plain number there. */
                        onFilter={
                          submission.webcamFlaggedCount > 0
                            ? () => setFlaggedOnly((v) => !v)
                            : undefined
                        }
                        filtered={flaggedOnly}
                        filterLabel="Show only the flagged frames"
                        clearLabel="Show all frames"
                      />
                      <RailStat
                        label="Reason"
                        value={reasonsSummary}
                        tone={submission.webcamFlaggedCount > 0 ? "" : "is-muted"}
                      />
                    </>
                  }
                >
                  {flaggedOnly && flaggedFrames.length === 0 ? (
                    <div className="pr-empty">
                      No flagged frames found. AI can make mistakes. Review the footage
                      and decide yourself.
                    </div>
                  ) : (
                    <div className="pr-frame-grid">
                      {(flaggedOnly ? flaggedFrames : submission.frames).map((f, i) => (
                        <FrameCell
                          key={`${flaggedOnly ? "flag" : "all"}-${i}`}
                          frame={f}
                          onZoom={() => setZoom(<ZoomedFrame frame={f} />)}
                        />
                      ))}
                    </div>
                  )}
                </ReviewSection>
              )}
            </div>
          </div>

          {/* ── footer (Figma 445:878) — Skip + View Queue on the left, the three
                 CTAs on the right ── */}
          <div className="wizard-footer rvc-footer">
            <div className="wizard-footer-left prc-footer-left">
              <button
                className="prc-skip"
                onClick={() => gotoIndex(index + 1)}
                disabled={!hasNext}
                title="Move to the next submission without deciding this one"
              >
                Skip
              </button>
            </div>

            <div className="prc-footer-right">
              <button
                className="prc-cta prc-cta--secondary"
                onClick={() => setConfirmKind("request")}
                disabled={idAlreadyRequested}
                title={
                  idAlreadyRequested
                    ? "A new ID has already been requested — waiting on the candidate"
                    : undefined
                }
              >
                Request ID Re-Upload
                <span className="prc-key">I</span>
              </button>
              {/* ID-only submissions (ID reviews and re-uploads) can't be
                  rejected — there's no exam attempt to throw out, only an ID to
                  accept or ask again for. Reject is proctored-exam-only. */}
              {hasFootage && (
                <button
                  className="prc-cta prc-cta--danger"
                  onClick={() => setConfirmKind("reject")}
                >
                  Reject
                  <span className="prc-key">R</span>
                </button>
              )}
              <button
                className="prc-cta prc-cta--ok"
                onClick={() => setConfirmKind("accept")}
              >
                Approve
                <span className="prc-key">A</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {zoom && (
        <ImageZoomOverlay onClose={() => setZoom(null)}>
          {zoom}
        </ImageZoomOverlay>
      )}

      {confirmKind === "reject" && hasFootage ? (
        <RejectModal
          submission={submission}
          onCancel={() => setConfirmKind(null)}
          onConfirm={(details) => {
            setConfirmKind(null);
            onReject(details);
          }}
        />
      ) : confirmKind ? (
        <ConfirmActionModal
          kind={confirmKind}
          submission={submission}
          hasFootage={hasFootage}
          onCancel={() => setConfirmKind(null)}
          onConfirm={() => {
            setConfirmKind(null);
            if (confirmKind === "accept") approve();
            else if (confirmKind === "reject") onReject();
            else onRequestId();
          }}
        />
      ) : null}
    </div>
  );
}

/** tdesign:check, 11.2px, drawn at the design's offset inside the 16px box. */
const PrmCheckIcon = () => (
  <svg width="11.2" height="11.2" viewBox="0 0 11.2 11.2" fill="none" aria-hidden="true">
    <path
      d="M9.39137 3.90014L4.91234 8.38014L2.50007 5.96787"
      stroke="currentColor"
      strokeWidth="1.12"
      strokeLinecap="square"
    />
  </svg>
);

/** The modal's 16px checkbox (Figma 8:13495 / 8:13497) — used by the reason
 *  rows, the overlay on each supporting image, and the Full Profile's
 *  Download All Awards checklist. */
export function PrmCheck({ on }: { on: boolean }) {
  return (
    <span className={`prm-check ${on ? "is-on" : ""}`} aria-hidden>
      {on && <PrmCheckIcon />}
    </span>
  );
}

type ConfirmCopy = { title: string; body: ReactNode; confirmLabel: string };

/* Every confirm reads differently for a proctored exam than for an ID-only one:
   a proctored submission has an attempt to approve or reject, while an ID-only
   one is purely the document. `hasFootage` is what splits them. */
function confirmCopy(kind: ConfirmKind, s: Submission, hasFootage: boolean): ConfirmCopy {
  const name = s.candidateName;
  if (kind === "accept") {
    return hasFootage
      ? {
          title: "Approve Attempt?",
          body: (
            <>
              {name}&rsquo;s attempt for the {s.exam} Quiz will be approved. Only proceed if their{" "}
              <strong>ID and their webcam footage</strong> for the exam have been validated.
            </>
          ),
          confirmLabel: "Approve",
        }
      : {
          title: "Approve ID?",
          body: (
            <>
              {name}&rsquo;s ID will be marked as approved. This allows them to skip the
              ID-verification step in all future exams which require this.
            </>
          ),
          confirmLabel: "Approve",
        };
  }
  if (kind === "request") {
    return {
      title: "Request Reupload",
      body: hasFootage ? (
        <>
          {name} will be asked to reupload their ID. No certificates will be given out till the
          proctoring footage and new ID are approved.
        </>
      ) : (
        <>
          {name} will be asked to reupload their ID. No certificates will be given out till the new
          ID has been approved.
        </>
      ),
      confirmLabel: "Send Request",
    };
  }
  return {
    title: "Reject Attempt?",
    body: (
      <>
        {name}&rsquo;s attempt for the {s.exam} Quiz will be rejected and they will have to retake
        the quiz.
      </>
    ),
    confirmLabel: "Reject Attempt",
  };
}

function ConfirmActionModal({
  kind,
  submission,
  hasFootage,
  onCancel,
  onConfirm,
}: {
  kind: ConfirmKind;
  submission: Submission;
  hasFootage: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = confirmCopy(kind, submission, hasFootage);
  return (
    <PrmModal
      title={copy.title}
      confirmLabel={copy.confirmLabel}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="prm-text">{copy.body}</p>
    </PrmModal>
  );
}

/** Shared by both required fields in the reject modal. */
const REJECT_FIELD_HELP =
  "The reason for rejecting the attempt, along with any additional feedback is shared with the user";

function RejectModal({
  submission,
  onCancel,
  onConfirm,
}: {
  submission: Submission;
  onCancel: () => void;
  onConfirm: (details: RejectDetails) => void;
}) {
  /* Multi-select: an attempt can fail on more than one count, and every box can
     be unticked again. */
  const [reasons, setReasons] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState("");
  const [frames, setFrames] = useState<Set<number>>(new Set());

  const isOther = reasons.has(OTHER_REASON);
  const canReject =
    reasons.size > 0 && frames.size > 0 && (!isOther || otherText.trim().length > 0);

  function toggle<T>(set: React.Dispatch<React.SetStateAction<Set<T>>>, v: T) {
    set((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }

  const copy = confirmCopy("reject", submission, true);

  return (
    <PrmModal
      title={copy.title}
      confirmLabel={copy.confirmLabel}
      confirmDisabled={!canReject}
      wide
      onCancel={onCancel}
      onConfirm={() =>
        canReject &&
        onConfirm({
          // "Other" is stored as what was actually typed, not the literal word.
          reasons: [...reasons].map((r) => (r === OTHER_REASON ? otherText.trim() : r)),
          frameIndexes: [...frames],
        })
      }
    >
      <div className="prm-stack">
        <p className="prm-text">{copy.body}</p>

        <div className="prm-field">
          <span className="prm-label">
            Select a Reason<span className="prm-req">*</span>
          </span>
          <div className="prm-checklist">
            {REJECT_REASONS.map((r) => {
              const on = reasons.has(r);
              return (
                <div key={r}>
                  <button
                    className="prm-check-row"
                    onClick={() => toggle(setReasons, r)}
                    role="checkbox"
                    aria-checked={on}
                  >
                    <PrmCheck on={on} />
                    <span className="prm-check-label">{r}</span>
                  </button>
                  {/* Ticking "Other" has to capture what the reason actually was
                      — it is surfaced to the candidate and listed on their
                      record, so an unqualified "Other" would tell them nothing.
                      Indented to line up with the labels above it. */}
                  {r === OTHER_REASON && on && (
                    <div className="prm-other-wrap">
                      <input
                        className="prm-other"
                        placeholder="Enter your reason here..."
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="prm-help">{REJECT_FIELD_HELP}</p>
        </div>

        <div className="prm-field">
          <span className="prm-label">
            Add Supporting Images<span className="prm-req">*</span>
          </span>
          <div className="prm-grid">
            {submission.frames.map((f, i) => {
              const on = frames.has(i);
              return (
                <button
                  key={i}
                  className={`prm-tile ${on ? "is-on" : ""}`}
                  onClick={() => toggle(setFrames, i)}
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`Frame ${i + 1}${f.flag ? ` — ${f.flag}` : ""}`}
                >
                  <FrameAvatar tone={f.tone} flagged={!!f.flag} />
                  {f.flag && <span className="pr-frame-tag">{f.flag}</span>}
                  {/* The box shows in both states — it reads as selectable even
                      before anything is picked. */}
                  <span className="prm-tile-check">
                    <PrmCheck on={on} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </PrmModal>
  );
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

/** Fullscreen webcam-frame viewer — the same FullscreenViewer chrome the ID
 *  full view uses (bare close, bottom rotate + zoom toolbar, no title bar). */
function ImageZoomOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <FullscreenViewer onClose={onClose}>
      {({ rotation }) => (
        <div className="pr-zoom-stage" style={{ transform: `rotate(${rotation}deg)` }}>
          {children}
        </div>
      )}
    </FullscreenViewer>
  );
}

/* ── Section rails (Figma 308:2208 / 1000:1184 / 1003:1266) ──
   Each review section carries a "stat rail": the section title on the left and
   its stats on the right, divided by hairlines. The rail PINS to the top of the
   scrolling stage while its own section is in view and hands off when the next
   section arrives, so the counts stay visible through a long frame wall.
   Sections do not collapse — the old chevron was deliberately removed and both
   are always open. */

/** The caveat carried by the (i) on any AI-derived stat. */
const AI_CAVEAT =
  "Generated by AI to speed up review. It can make mistakes. The final decision is yours";

/** 9.167px "info" circle from the header asset (Figma 999:1103), centred in its
 *  10px box. Square caps and a 0.833 stroke — not the project's round-capped
 *  icons. */
const AiAssistIcon = () => (
  <svg width="9.16667" height="9.16667" viewBox="0 0 9.16667 9.16667" fill="none" aria-hidden="true">
    <path
      d="M0.416667 4.58333C0.416667 2.28208 2.28208 0.416667 4.58333 0.416667C6.88458 0.416667 8.75 2.28208 8.75 4.58333C8.75 6.88458 6.88458 8.75 4.58333 8.75C2.28208 8.75 0.416667 6.88458 0.416667 4.58333Z"
      stroke="currentColor"
      strokeWidth="0.833333"
      strokeLinecap="square"
    />
    <path
      d="M4.58333 6.45833V4.16667M4.58333 2.70833H4.58167V2.70667H4.58333V2.70833Z"
      stroke="currentColor"
      strokeWidth="0.833333"
      strokeLinecap="square"
    />
  </svg>
);

/** The 14px close-circle beside an applied stat filter — transcribed from the
 *  exported asset (Figma 1003:1286). Square caps and a 1.16667 stroke, not the
 *  project's round-capped CloseXIcon. */
const StatFilterClearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M1.16653 7.00028C1.16653 3.77862 3.7782 1.16695 6.99986 1.16695C10.2215 1.16695 12.8332 3.77862 12.8332 7.00029C12.8332 10.2219 10.2215 12.8336 6.99986 12.8336C3.7782 12.8336 1.16652 10.2219 1.16653 7.00028Z"
      stroke="currentColor"
      strokeWidth="1.16667"
      strokeLinecap="square"
    />
    <path
      d="M8.85593 5.14401L6.99997 6.99997M6.99997 6.99997L5.14362 8.85632M6.99997 6.99997L8.85593 8.85593M6.99997 6.99997L5.14362 5.14362"
      stroke="currentColor"
      strokeWidth="1.16667"
      strokeLinecap="square"
    />
  </svg>
);

/** One stat block on a rail — a small uppercase label over its value. `tone`
 *  colours the value (is-strong / is-ok / is-weak / is-bad / is-muted).
 *
 *  Passing `onFilter` makes the VALUE the control that narrows the section to
 *  what it counts (Figma 1000:1184 / 1003:1266) — there is no separate toggle.
 *  A dotted underline marks it as clickable, and while `filtered` a close-circle
 *  sits beside it to clear. The number itself never changes: it is the true
 *  total in both states, not a count of what's on screen. */
function RailStat({
  label,
  value,
  tone = "",
  info = false,
  onFilter,
  filtered = false,
  filterLabel,
  clearLabel,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  /** Adds the (i) after the label — this number came from the AI. */
  info?: boolean;
  /** Toggles this stat's filter. Omit for a stat that isn't a control. */
  onFilter?: () => void;
  filtered?: boolean;
  /** Tooltip on the value while the filter is off. */
  filterLabel?: string;
  /** Tooltip on the value and the clear button while it is on. */
  clearLabel?: string;
}) {
  const head = (
    <span className="prc-stat-head">
      <span className="prc-stat-label">{label}</span>
      {info && (
        <span className="prc-stat-info" data-tip={AI_CAVEAT} aria-label={AI_CAVEAT} role="img">
          <AiAssistIcon />
        </span>
      )}
    </span>
  );

  if (!onFilter) {
    return (
      <span className="prc-stat">
        {head}
        <span className={`prc-stat-value ${tone}`}>{value}</span>
      </span>
    );
  }

  const tip = filtered ? clearLabel : filterLabel;
  return (
    <span className={`prc-stat prc-stat--filter ${filtered ? "is-filtered" : ""}`}>
      <button
        type="button"
        className="prc-stat-btn"
        onClick={onFilter}
        aria-pressed={filtered}
        data-tip={tip}
        title={tip}
      >
        {head}
        <span className={`prc-stat-value ${tone}`}>{value}</span>
      </button>
      {filtered && (
        <button
          type="button"
          className="prc-stat-clear"
          onClick={onFilter}
          data-tip={clearLabel}
          aria-label={clearLabel}
        >
          <StatFilterClearIcon />
        </button>
      )}
    </span>
  );
}

/** A review section with a sticky stat rail. The <section> is the rail's
 *  containing block, which is what bounds its sticky range — this is load-
 *  bearing: with both rails in one block the first would never unpin and the
 *  two would overlap. Pinning is pure CSS and so is the pinned shadow (see
 *  .prc-rail in index.css): there is deliberately no observer or state here.
 *  A React commit and a repaint landing exactly at the pin moment showed as a
 *  hitch mid-scroll. */
function ReviewSection({
  title,
  badge,
  stats,
  bodyClass = "",
  children,
}: {
  title: string;
  /** A pill shown right after the title (the ID section's "Verified"). */
  badge?: ReactNode;
  /** Stat blocks, right-aligned on the rail. */
  stats: ReactNode;
  bodyClass?: string;
  children: ReactNode;
}) {
  return (
    <section className="prc-section">
      <div className="prc-rail">
        <div className="prc-rail-left">
          <h2 className="prc-rail-title">{title}</h2>
          {badge}
        </div>
        <div className="prc-rail-right">{stats}</div>
      </div>
      <div className={`prc-section-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

/** Integrity Note (Figma 302:883 collapsed / 303:905 expanded). Only renders
 *  when there's an admin note or a prior rejected attempt (for any exam) to
 *  surface. Collapsed shows the flag + admin note on one line; expanding
 *  reveals the candidate's rejected attempts with the reason each was rejected.
 *  The chevron only appears when there's something to expand. */
/* ── The header's exam + date line ──
   The line itself opens the attempt viewer for this candidate + exam in a new
   tab — the same `?attemptsUid=&attemptsTaskId=` deep link the Certification
   Lookup uses — and says so in the plain tooltip (Figma 451:545). The exam has
   to resolve to a task id first: EPA 609 has no certification in the data set,
   so there the line stays plain text with nothing to hover. */
function QuizAttemptLink({
  submission,
  children,
}: {
  submission: Submission;
  children: ReactNode;
}) {
  const taskId = attemptTaskIdForExam(submission.exam);

  if (!taskId) return <div className="tasks-subtitle prc-subtitle">{children}</div>;

  return (
    <button
      className="tasks-subtitle prc-subtitle prc-subtitle--link"
      data-tip="View Quiz Attempt"
      onClick={() =>
        openInNewTab(
          `attemptsUid=${encodeURIComponent(submission.userId)}&attemptsTaskId=${encodeURIComponent(taskId)}`,
        )
      }
    >
      {children}
    </button>
  );
}

/** The asset (Figma 1006:1381) is a 12px filled check-circle. */
const VerifiedCheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M6 11.5C9.0375 11.5 11.5 9.0375 11.5 6C11.5 2.9625 9.0375 0.5 6 0.5C2.9625 0.5 0.5 2.9625 0.5 6C0.5 9.0375 2.9625 11.5 6 11.5ZM3.75 5.293L5.25 6.793L8.25 3.793L8.957 4.5L5.25 8.207L3.043 6L3.75 5.293Z"
      fill="currentColor"
    />
  </svg>
);

/* The re-upload pill's alert glyph (Figma 1015:1463) — a filled 12px circle
   with an exclamation knocked out of it. */
const ReuploadAlertIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M6 0.5C9.0375 0.5 11.5 2.9625 11.5 6C11.5 9.0375 9.0375 11.5 6 11.5C2.9625 11.5 0.5 9.0375 0.5 6C0.5 2.9625 2.9625 0.5 6 0.5ZM5.5 7H6.5V3.25H5.5V7ZM6.502 7.75H5.5V8.752H6.502V7.75Z"
      fill="currentColor"
    />
  </svg>
);

/** The "Re-Uploaded ID" pill beside the ID Verification title when the document
 *  on screen is one the candidate re-sent after being asked (Figma 1015:1454).
 *  It says the reviewer is looking at a second attempt, not the original. */
function ReuploadedIdPill() {
  return (
    <span className="prc-pill prc-pill--warn">
      <ReuploadAlertIcon />
      Re-Uploaded ID
    </span>
  );
}

/** The "Verified" pill beside the ID Verification title when this candidate's
 *  document was already accepted on an earlier submission (Figma 1006:1378). */
function VerifiedPill() {
  return (
    <span className="prc-pill prc-pill--ok">
      <VerifiedCheckIcon />
      Verified
    </span>
  );
}

/** "March 2nd, 2026, 9:00 AM" → "Mar 2, 2026", the short date the verified
 *  rail's APPROVED ON stat carries (Figma 1006:1388). */
function shortDateOf(at: string): string {
  const d = new Date(at.replace(/(\d+)(st|nd|rd|th)/, "$1"));
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function IntegrityNoteBanner({
  submission,
  previousRejected,
}: {
  submission: Submission;
  previousRejected: Submission[];
}) {
  if (!submission.integrityNote && previousRejected.length === 0) return null;

  /* The note used to expand to list the rejected attempts inline. It doesn't any
     more (Figma 457:577): the whole banner is a link to the Attempts page for
     this candidate + exam, pre-filtered to Status "Rejected", which is the real
     record. Without a resolvable task there is nothing to open, so it falls back
     to a plain, non-interactive banner. */
  const taskId = attemptTaskIdForExam(submission.exam);
  const openRejected = taskId
    ? () =>
        openInNewTab(
          `attemptsUid=${encodeURIComponent(submission.userId)}` +
            `&attemptsTaskId=${encodeURIComponent(taskId)}` +
            `&attemptsStatus=${encodeURIComponent("Rejected")}`,
        )
    : undefined;

  const body = (
    <>
      <span className="prc-inote-lead">
        <span className="prc-inote-icon" aria-hidden>
          <NoteAlertIcon />
        </span>
        {/* Two lines now (Figma 458:590): the note sits UNDER the title rather
            than trailing it after a middot. */}
        <span className="prc-banner-text prc-inote-text">
          <span className="prc-inote-title">Past Attempt Flagged By Proctor</span>
          {submission.integrityNote && (
            <span className="prc-inote-sub">{submission.integrityNote}</span>
          )}
        </span>
      </span>
      {openRejected && (
        <span className="prc-inote-open" aria-hidden>
          <NoteOpenIcon />
        </span>
      )}
    </>
  );

  return openRejected ? (
    <button
      className="prc-inote prc-inote--link"
      onClick={openRejected}
      title="Open this candidate's rejected attempts in a new tab"
    >
      {body}
    </button>
  ) : (
    <div className="prc-inote">{body}</div>
  );
}

/** Name Mismatch card (Figma 308:2299). The reviewer sets the name to keep in an
 *  editable field seeded with the SkillCat name; the detected name sits below
 *  with a "Use This" link that fills the field with it.
 *
 *  Nothing here saves on its own — the card says so itself ("Saved when you
 *  approve the review"). It holds a DRAFT the console owns and writes only when
 *  the review is approved, so the card stays put while the reviewer works and
 *  an abandoned review leaves the name untouched. */
function NameMismatchBanner({
  submission,
  draft,
  onDraftChange,
}: {
  submission: Submission;
  draft: string;
  onDraftChange: (name: string) => void;
}) {
  if (!submission.idDetectedName || submission.idDetectedName === submission.candidateName) {
    return null;
  }

  return (
    <div className="prc-mismatch">
      <div className="prc-mismatch-head">
        <div className="prc-mismatch-title">Names Don&apos;t Match</div>
        <p className="prc-mismatch-sub">
          The ID reads a different name than the SkillCat profile. Set the name we
          should keep.
        </p>
      </div>

      <div className="prc-mismatch-field">
        <label className="form-label" htmlFor="prc-name">
          Name on SkillCat Profile<span className="req">*</span>
        </label>
        <input
          id="prc-name"
          className="form-input"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          /* Enter must not submit anything — the name rides along with Approve.
             Swallowing it also keeps the console's A/R/I shortcuts out of the
             way while the field has focus. */
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
        {/* The detected name reads as a sentence with the adopt link inside it,
            not as a boxed row (Figma 1014:1447). */}
        <p className="prc-mismatch-detected">
          <span>ID reads {submission.idDetectedName} ·</span>
          {/* Fills the field only — like typing it. The save still waits for
              Approve, so the reviewer can change their mind. */}
          <button
            className="prc-mismatch-use"
            onClick={() => onDraftChange(submission.idDetectedName!)}
          >
            Use This
          </button>
        </p>
      </div>

      <p className="prc-mismatch-note">
        Type to correct the name. Saved when you approve the review.
      </p>
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

/* The old bespoke .pr-id-card mock was replaced by the shared ZoomableIdCard
   (hover-magnify / full view / rotate) — see idCardOf above. */
