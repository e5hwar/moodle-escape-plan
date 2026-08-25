import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { hasProctoringFootage } from "../data/proctoring";
import type { Submission, WebcamFrame } from "../data/proctoring";
import type { SortKey, SortDir } from "./ProctoringPage";
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, EnterKeyIcon, SortIcon } from "./icons";
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

/* Transcribed from the header's exported "Icon Library" asset (444:821 et al):
   a 9.219×5.552 chevron with a 1.33333 SQUARE-capped stroke, placed at the
   asset's own offsets inside the 16px box — so it spans x 4.333→11.667,
   y 6.333→10. Deliberately NOT the project's round-capped ChevronDownIcon. */
const SectionCaretIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M11.6667 6.3333L8 10L4.3333 6.3333"
      stroke="currentColor"
      strokeWidth="1.33333"
      strokeLinecap="square"
    />
  </svg>
);



/* ── Integrity Note icons (Figma 457:583 / 457:586) ──
   Both transcribed from the exported assets. The note's 20px outline triangle
   and chevron are gone with the expand/collapse: it now carries an 11px FILLED
   alert circle and, on the right, the 10.5px open-in-new glyph. Each is drawn
   at its own natural size and centred by its wrapper span. */
const NoteAlertIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
    <path
      d="M5.5 0C8.5375 0 11 2.4625 11 5.5C11 8.5375 8.5375 11 5.5 11C2.4625 11 0 8.5375 0 5.5C0 2.4625 2.4625 0 5.5 0ZM5 6.5H6V2.75H5V6.5ZM6.002 7.25H5V8.252H6.002V7.25Z"
      fill="currentColor"
    />
  </svg>
);

const NoteOpenIcon = () => (
  <svg width="10.5" height="10.5" viewBox="0 0 10.5 10.5" fill="none" aria-hidden="true">
    <path
      d="M3.5 0.583333H0.583333V9.91667H9.91667V7M9.47917 1.02083L5.25 5.25M6.41667 0.583333H9.91667V4.08333"
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

/* Queue popover columns — mirrors ReviewConsole's QUEUE_COLS, minus the
   attempt-count column (no equivalent here). */
const QUEUE_COLS: { cls: string; label: string; sortKey?: SortKey }[] = [
  { cls: "idx", label: "" },
  { cls: "user", label: "Candidate", sortKey: "candidate" },
  { cls: "task", label: "Exam", sortKey: "exam" },
  { cls: "date", label: "Submitted", sortKey: "submittedAt" },
];

export function ProctoringConsole({
  submission,
  queue,
  previousRejected,
  examFilter,
  sort,
  onSort,
  onGoto,
  onExit,
  onAccept,
  onReject,
  onRequestId,
  onUpdateName,
  onRenameUser,
}: {
  submission: Submission;
  /** The table's filtered + sorted pending submissions — becomes the queue. */
  queue: Submission[];
  previousRejected: Submission[];
  /** The table's applied Exam filter, echoed read-only in the queue popover head. */
  examFilter: string[];
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  onGoto: (id: string) => void;
  onExit: () => void;
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
  const [queueOpen, setQueueOpen] = useState(false);
  /* Same highlight-then-commit interaction as ReviewConsole's queue: arrows
     move the highlight, Q/⏎ commits, Esc discards, a row click commits at once. */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const queueWrapRef = useRef<HTMLDivElement>(null);

  /* Prev/next has no on-screen control any more (the queue popover is the
     navigation UI) but ←/→ still step through the queue for keyboard users. */
  const index = queue.findIndex((s) => s.id === submission.id);
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < queue.length - 1;

  function gotoIndex(idx: number) {
    if (idx < 0 || idx >= queue.length) return;
    onGoto(queue[idx].id);
  }

  function moveQueue(d: number) {
    if (!queue.length) return;
    const from = highlightId ?? submission.id;
    const i = Math.max(0, queue.findIndex((x) => x.id === from));
    const next = Math.min(queue.length - 1, Math.max(0, i + d));
    setHighlightId(queue[next].id);
  }

  function commitQueue() {
    if (highlightId && highlightId !== submission.id) onGoto(highlightId);
    setQueueOpen(false);
  }

  /* Footage follows the EXAM, not the queue the submission currently sits in —
     a proctored exam whose ID needs re-sending still has its recording. */
  const hasFootage = hasProctoringFootage(submission);
  /* Already asked for a new ID and still waiting on the candidate (the "Requested"
     state on the ID Re-uploads tab) — there's nothing to ask again for yet. */
  const idAlreadyRequested = submission.status === "id-requested";
  const flaggedFrames = submission.frames.filter((f) => !!f.flag);
  const confidenceClass =
    submission.idConfidence >= 90
      ? "is-strong"
      : submission.idConfidence >= 75
      ? "is-ok"
      : "is-weak";
  // The header's Reason column surfaces the most common flag across the footage.
  const dominantReason =
    flaggedFrames.length === 0
      ? "-" // Figma 308:2254 uses a plain hyphen here, not an em dash.
      : [
          ...flaggedFrames.reduce(
            (m, f) => m.set(f.flag!, (m.get(f.flag!) ?? 0) + 1),
            new Map<string, number>(),
          ),
        ].sort((a, b) => b[1] - a[1])[0][0];

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
      /* While the queue popover is open it owns the keyboard, same as ReviewConsole:
         ↑↓ navigate, ⏎/Q commit, Esc closes and discards. */
      if (queueOpen) {
        if (e.key === "Escape") { setQueueOpen(false); return; }
        if (e.key === "Enter" || e.key === "q" || e.key === "Q") { commitQueue(); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); moveQueue(1); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); moveQueue(-1); return; }
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev) gotoIndex(index - 1);
      else if (e.key === "ArrowRight" && hasNext) gotoIndex(index + 1);
      else if (e.key === "q" || e.key === "Q") setQueueOpen((v) => !v);
      /* The footer's keycaps (Figma 445:878). Its "Request ID Again" cap reads R,
         the same letter as Reject — one of the two can't work, so Reject keeps R
         (it matches the red button) and Request ID Again takes I. */
      else if (e.key === "a" || e.key === "A") setConfirmKind("accept");
      // No Reject button on ID-only submissions, so no R either.
      else if ((e.key === "r" || e.key === "R") && hasFootage) setConfirmKind("reject");
      else if ((e.key === "i" || e.key === "I") && !idAlreadyRequested) setConfirmKind("request");
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, confirmKind, idFullView, queueOpen, index, hasPrev, hasNext, hasFootage, idAlreadyRequested, queue, highlightId, submission.id]);

  /* Opening the popover highlights whatever is on screen. */
  useEffect(() => {
    setHighlightId(queueOpen ? submission.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueOpen]);

  /* Click outside the queue popover closes it. */
  useEffect(() => {
    if (!queueOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!queueWrapRef.current?.contains(e.target as Node)) setQueueOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [queueOpen]);

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
                <button className="rvc-crumb rvc-crumb--current" onClick={onExit} title="Back to Exam Reviews">
                  Exam Reviews
                </button>
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
          </div>

          {/* ── body — single column; the integrity note is a full-width card
                 heading it, above the ID ── */}
          <div className="rvc-body">
            <div className="rvc-stagecol prc-stagecol">
              <IntegrityNoteBanner submission={submission} previousRejected={previousRejected} />

              <CollapsibleSection
                title="ID Verification"
                meta={
                  <span className="pr-section-stats">
                    <SectionAiAssist />
                    <SectionStat
                      label="Confidence"
                      value={`${submission.idConfidence}%`}
                      tone={confidenceClass}
                    />
                    <SectionStat label="Document" value={submission.idType} />
                  </span>
                }
              >
                {/* Shown above the card when this candidate's ID was already
                    accepted on an earlier submission. */}
                {hasFootage && submission.idPreviouslyVerified && (
                  <IdPreviouslyVerifiedBanner detail={submission.idPreviouslyVerified} />
                )}

                {/* Card on the left, the name-mismatch prompt beside it on the
                    right. Shared card: hover magnifies, click opens full view,
                    and it rotates — the same component the Name Change Requests
                    page uses. The card is capped at its natural width so the
                    magnifier panel has room to open over the column beside it. */}
                <div className="prc-idrow">
                  <div className="prc-idcard">
                    <ZoomableIdCard data={idCardOf(submission)} onFullViewChange={setIdFullView} hideTools />
                  </div>
                  <NameMismatchBanner submission={submission} onUpdate={onUpdateName} />
                </div>
              </CollapsibleSection>

              {/* ID reviews and reupload requests are ID-only — no proctoring footage was captured. */}
              {hasFootage && (
                <>
                  <CollapsibleSection
                    title="Complete Proctoring Footage"
                    meta={
                      <span className="pr-section-stats">
                        <SectionAiAssist />
                        <SectionStat label="Frames" value={submission.webcamTotal} tone="is-muted" />
                        <SectionStat
                          label="Flagged"
                          value={submission.webcamFlaggedCount}
                          tone={submission.webcamFlaggedCount > 0 ? "is-bad" : "is-strong"}
                        />
                        <SectionStat
                          label="Reason"
                          value={dominantReason}
                          tone={submission.webcamFlaggedCount > 0 ? "" : "is-muted"}
                        />
                      </span>
                    }
                  >
                    <div className="pr-frame-grid">
                      {submission.frames.map((f, i) => (
                        <FrameCell key={`all-${i}`} frame={f} onZoom={() => setZoom(<ZoomedFrame frame={f} />)} />
                      ))}
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Flagged Images">
                    {flaggedFrames.length === 0 ? (
                      <div className="pr-empty">
                        No flagged frames found. AI can make mistakes. Review the footage
                        and decide yourself.
                      </div>
                    ) : (
                      <div className="pr-frame-grid">
                        {flaggedFrames.map((f, i) => (
                          <FrameCell key={`flag-${i}`} frame={f} onZoom={() => setZoom(<ZoomedFrame frame={f} />)} />
                        ))}
                      </div>
                    )}
                  </CollapsibleSection>
                </>
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
              <div className="rvc-queue-wrap" ref={queueWrapRef}>
                <button
                  className="btn-save-draft rvc-viewqueue"
                  onClick={() => setQueueOpen((v) => !v)}
                  aria-expanded={queueOpen}
                >
                  <span className="rvc-viewqueue-text">
                    <span className="rvc-viewqueue-label">View Queue</span>
                    <span className="rvc-viewqueue-count">· {queue.length} waiting</span>
                  </span>
                  <span className="kbd-letter">Q</span>
                </button>

                {queueOpen && (
                  <div className="rvc-qpanel rvc-qpanel--proctoring" role="dialog" aria-label="Proctoring queue">
                    <div className="rvc-qpanel-head">
                      <span className="rvc-qcount">{queue.length} Pending</span>
                      {examFilter.length > 0 && (
                        <div className="rvc-qpanel-filters">
                          {examFilter.map((name) => (
                            <span key={name} className="filter-applied">
                              <span className="filter-applied-main">
                                <span className="label">Exam</span>
                                <span className="sep" />
                                <span className="value">{name}</span>
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rvc-qhead">
                      {QUEUE_COLS.map((c) => {
                        const active = !!c.sortKey && sort.key === c.sortKey;
                        if (!c.sortKey) {
                          return <span key={c.cls} className={`rvc-qc rvc-qc--${c.cls}`}>{c.label}</span>;
                        }
                        return (
                          <button
                            key={c.cls}
                            className={`rvc-qc rvc-qc--${c.cls} rvc-qc--sortable`}
                            onClick={() => onSort(c.sortKey!)}
                          >
                            {c.label}
                            <SortIcon active={active} dir={active ? sort.dir : undefined} />
                          </button>
                        );
                      })}
                    </div>

                    <div className="rvc-qlist">
                      {queue.map((q, i) => {
                        const sel = q.id === (highlightId ?? submission.id);
                        return (
                          <button
                            key={q.id}
                            className={`rvc-qrow ${sel ? "is-selected" : ""}`}
                            onClick={() => {
                              if (q.id !== submission.id) onGoto(q.id);
                              setQueueOpen(false);
                            }}
                          >
                            <span className="rvc-qc rvc-qc--idx">{i + 1}</span>
                            <span className="rvc-qc rvc-qc--user">{q.candidateName}</span>
                            <span className="rvc-qc rvc-qc--task">{q.examShort}</span>
                            <span className="rvc-qc rvc-qc--date">{q.submittedAt}</span>
                          </button>
                        );
                      })}
                      {queue.length === 0 && (
                        <div className="rvc-qempty">No submissions match these filters.</div>
                      )}
                    </div>

                    <div className="rvc-qpanel-foot">
                      <div className="rvc-qhints">
                        <span className="rvc-qhint">
                          <span className="rvc-qkeypair">
                            <span className="rvc-qkey"><ArrowUpIcon /></span>
                            <span className="rvc-qkey"><ArrowDownIcon /></span>
                          </span>
                          To navigate
                        </span>
                        <span className="rvc-qhint">
                          <span className="rvc-qkey"><EnterKeyIcon /></span>
                          To select
                        </span>
                        <span className="rvc-qhint">
                          <span className="rvc-qkey rvc-qkey--text">Esc</span>
                          To close
                        </span>
                      </div>
                      <span className="rvc-qhint">
                        <span className="rvc-qkey rvc-qkey--text">Q</span>
                        Save &amp; update queue
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="prc-footer-right">
              <button
                className="prc-cta prc-cta--warn"
                onClick={() => setConfirmKind("request")}
                disabled={idAlreadyRequested}
                title={
                  idAlreadyRequested
                    ? "A new ID has already been requested — waiting on the candidate"
                    : undefined
                }
              >
                Request ID Again
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
            if (confirmKind === "accept") onAccept();
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

/** A review section whose header collapses it. The chevron that was decorative
 *  is now the control: it points down while open (at the content below) and
 *  rotates to the right when collapsed. The whole header is the hit target. */
/** One labelled stat column in a section header (Figma 302:104) — a small
 *  uppercase label stacked over its value. `tone` colours the value
 *  (is-strong / is-ok / is-weak / is-bad / is-muted). */
/** 9.167px "info" circle from the header asset (482:560), centred in its 10px
 *  box. Square caps and a 0.833 stroke — not the project's round-capped icons. */
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

/** Leads the stat group on any header whose numbers are AI-derived (Figma
 *  444:825). One centred row rather than the label-over-value stack, with the
 *  info icon carrying the caveat. */
function SectionAiAssist() {
  return (
    <span className="pr-hstat pr-hstat--assist">
      <span className="pr-hstat-label">AI Assist</span>
      <span
        className="pr-hstat-info"
        data-tip="Generated by AI to speed up review. It can make mistakes. The final decision is yours"
        aria-label="Generated by AI to speed up review. It can make mistakes. The final decision is yours"
        role="img"
      >
        <AiAssistIcon />
      </span>
    </span>
  );
}

function SectionStat({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <span className="pr-hstat">
      <span className="pr-hstat-label">{label}</span>
      <span className={`pr-hstat-value ${tone}`}>{value}</span>
    </span>
  );
}

function CollapsibleSection({
  title,
  meta,
  children,
}: {
  title: string;
  /** Stats/labels shown after the title in the header. */
  meta?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`pr-section ${open ? "" : "is-collapsed"}`}>
      {/* Figma 308:2208 / 2254 / 2269 / 2284: title + stats grouped on the left,
          the chevron alone on the far right. */}
      <button
        className="pr-section-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="pr-section-headleft">
          <span className="pr-section-title">{title}</span>
          {meta}
        </span>
        <span className="pr-section-caret">
          <SectionCaretIcon />
        </span>
      </button>
      {open && children}
    </section>
  );
}

/** "November 5th, 2025, 2:30 PM" → "5th November 2025", the ordinal long date
 *  the Integrity Note's rejected-attempt lines use (Figma 303:942). */
function longDateOf(submittedAt: string): string {
  const d = new Date(submittedAt.replace(/(\d+)(st|nd|rd|th)/, "$1"));
  if (Number.isNaN(d.getTime())) return submittedAt;
  const day = d.getDate();
  const tens = day % 100;
  const suffix =
    tens >= 11 && tens <= 13
      ? "th"
      : day % 10 === 1
      ? "st"
      : day % 10 === 2
      ? "nd"
      : day % 10 === 3
      ? "rd"
      : "th";
  return `${day}${suffix} ${d.toLocaleDateString("en-US", { month: "long" })} ${d.getFullYear()}`;
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

/** The asset (456:574) is an 11px filled check-circle centred in a 12px box. */
const VerifiedCheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
    <path
      d="M5.5 11C8.5375 11 11 8.5375 11 5.5C11 2.4625 8.5375 0 5.5 0C2.4625 0 0 2.4625 0 5.5C0 8.5375 2.4625 11 5.5 11ZM3.25 4.793L4.75 6.293L7.75 3.293L8.457 4L4.75 7.707L2.543 5.5L3.25 4.793Z"
      fill="currentColor"
    />
  </svg>
);

/** "ID Previously Verified" banner (Figma 456:563). Proctored exams only — on
 *  an ID-only submission the ID check IS the review, so there is nothing to
 *  skip. The date reuses longDateOf, which is why `at` is stored in the same
 *  display format as `submittedAt`. */
function IdPreviouslyVerifiedBanner({ detail }: { detail: { at: string; by: string } }) {
  return (
    <div className="prc-idverified">
      <span className="prc-idverified-icon">
        <VerifiedCheckIcon />
      </span>
      <span className="prc-banner-text">
        <span className="prc-idverified-title">ID Previously Verified</span>
        <span className="prc-idverified-detail">
          · Approved on {longDateOf(detail.at)} by {detail.by}
        </span>
      </span>
    </div>
  );
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
        <span className="prc-banner-text">
          <span className="prc-inote-title">Past Attempt Flagged By Proctor</span>
          {submission.integrityNote && (
            <span className="prc-inote-sub">· {submission.integrityNote}</span>
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
 *  editable field seeded with the SkillCat name; the detected name sits below with
 *  a "Use This" link that adopts it.
 *
 *  The design has no explicit save control, so the field commits on blur or Enter
 *  (only when non-empty and actually changed) — "Use This" commits immediately.
 *  Committing resolves the mismatch, which unmounts this card. */
function NameMismatchBanner({
  submission,
  onUpdate,
}: {
  submission: Submission;
  onUpdate?: (name: string) => void;
}) {
  const [draft, setDraft] = useState(submission.candidateName);

  // Re-seed when navigating to another candidate.
  useEffect(() => setDraft(submission.candidateName), [submission.id, submission.candidateName]);

  if (!submission.idDetectedName || submission.idDetectedName === submission.candidateName) {
    return null;
  }

  function commit() {
    const next = draft.trim();
    if (next && next !== submission.candidateName) onUpdate?.(next);
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

      <div className="prc-mismatch-body">
        <div className="prc-mismatch-field">
          <label className="form-label" htmlFor="prc-name">
            Name on SkillCat<span className="req">*</span>
          </label>
          <input
            id="prc-name"
            className="form-input prc-mismatch-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
          />
          <p className="form-help prc-mismatch-help">
            Detection can be wrong. Confirm the spelling before you accept.
          </p>
        </div>

        <div className="prc-mismatch-detected">
          <span className="prc-mismatch-detected-text">
            On The Uploaded ID: <strong>{submission.idDetectedName}</strong>
          </span>
          <button
            className="prc-mismatch-use"
            onClick={() => {
              setDraft(submission.idDetectedName!);
              onUpdate?.(submission.idDetectedName!);
            }}
          >
            Use This
          </button>
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

/* The old bespoke .pr-id-card mock was replaced by the shared ZoomableIdCard
   (hover-magnify / full view / rotate) — see idCardOf above. */
