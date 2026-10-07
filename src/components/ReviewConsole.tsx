import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isReadOnly,
  mediaUrl,
  pastReviewOf,
  pastVersionOf,
  type TaskSubmission,
} from "../data/reviewSubmissions";
import { CaretDownIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon12, EditOffIcon, InfoIcon14, KeyArrowDownIcon, KeyArrowLeftIcon, KeyArrowRightIcon, KeyArrowUpIcon, KeyEnterIcon, RowExternalLinkIcon } from "./icons";
import { WizardKeyHint } from "./wizardKeys";
import { tasks } from "../data/tasks";
import { UserDetailsHover } from "./UserDetailsHover";
import { ShortcutHint } from "./ShortcutHint";
import { PrmModal } from "./PrmModal";
import { CopiedToast } from "./CopiedToast";
import { NoteCard } from "./NoteCard";
import { CharCount, LimitError } from "./CharCount";
import { DESCRIPTION_MAX, isOver, limitClass, limitMessage } from "../data/fieldLimits";

/* ── Review console ─────────────────────────────────────────────────────────
   Queue-driven, keyboard-first review screen for Hands-On submissions, per the
   "Hands-On Review Prototype" reference. Opened from the Review Hands-On Tasks
   table; the table's filtered list becomes the queue. Shortcuts: 1–0 score,
   ← → media, ⏎ submit, N skip, Q queue, Esc back/close.

   Chrome comes from the shared design system (Figma "Components" 11:15114) —
   page header, table pills, applied-filter pills, page breaks, form fields,
   primary/secondary buttons, wizard footer and inline links. See the block
   comment above `.rvc-root` in index.css for the full mapping. ── */

const PASS_MIN = 5; // app-wide Hands-On semantic: 1–4 rejected, 5–10 pass

type Draft = { score: number | null; feedback: string };
type Reviewed = { score: number; feedback: string };

const EMPTY_DRAFT: Draft = { score: null, feedback: "" };

/** "Sep 12, 2026" — the attempts dropdown's SUBMITTED column (Figma 1169:2137). */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "22nd July 2025" — the queue table's submitted-on format (Figma 263:1926). */
function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
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


const BASE = import.meta.env.BASE_URL;

/** Standalone pages open in their own tab, matching the Users table's pattern. */
function openInNewTab(query: string) {
  window.open(`${BASE}?${query}`, "_blank", "noopener");
}

/** Save the media the reviewer is looking at. Fetching to a blob keeps the
 *  filename we choose; if the host blocks that, fall back to opening it. */
async function downloadMedia(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** The voice note's play button (Figma 440:757 — tdesign:play, accent-filled). */
const AudioPlayGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M13.1714 7.4733C13.5574 7.71891 13.5573 8.2823 13.1714 8.52788L3.96052 14.3888C3.54445 14.6536 3 14.3547 3 13.8615V2.1386C3 1.64541 3.54449 1.34653 3.96057 1.61133L13.1714 7.4733Z" />
  </svg>
);

/** "0:34" → "00:34" — the player prints two-digit minutes (Figma 440:816). */
function clockDuration(d: string): string {
  const [m, sec] = d.split(":");
  return sec == null ? d : `${m.padStart(2, "0")}:${sec}`;
}

const PlayGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export function ReviewConsole({
  queue,
  initialId,
  onExit,
  onRenameUser,
}: {
  /** The table's filtered + sorted submissions — becomes the review queue. */
  queue: TaskSubmission[];
  initialId: string;
  /** Back to the table. Reviewed ids + results are handed up so the table can
   * drop them from the pending list; `toast` is the verdict toast when the exit
   * IS the last submit, for the table to show on arrival. */
  onExit: (reviewed: Record<string, Reviewed>, toast?: string) => void;
  /** Renamed from the submitter's user-details card — the queue owns the list,
   * so the new name comes back down through `queue`. */
  onRenameUser?: (userId: string, name: string) => void;
}) {
  const [currentId, setCurrentId] = useState(initialId);
  const [viewAttempt, setViewAttempt] = useState<number | null>(null); // 0-based chip; null = current
  /* Attempts dropdown (Figma 1169:1598 trigger / 1169:2024 panel). `attHi` is
     the keyboard-highlighted row, counted in steps back from the current
     attempt — the same unit the rows are keyed on. */
  const [attOpen, setAttOpen] = useState(false);
  const [attHi, setAttHi] = useState(0);
  /* Submit & Next asks before the verdict goes out. */
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  /* The console's one toast — the shared green `CopiedToast` (Figma 1046:1141):
     "Submission Passed/Rejected", "Name Updated", "Download Started". `n` keys it, so a
     second toast restarts the timer instead of being cut short. */
  const [toast, setToast] = useState<{ msg: string; n: number } | null>(null);
  const hideToast = useCallback(() => setToast(null), []);
  const attWrapRef = useRef<HTMLDivElement>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitted, setSubmitted] = useState<Record<string, Reviewed>>({});

  /* Filters can be changed from the queue popover, which may drop the
     submission being reviewed out of the queue — keep showing it rather than
     yanking the screen out from under the reviewer. */
  const lastSub = useRef<TaskSubmission>(queue.find((s) => s.id === initialId) ?? queue[0]);
  const sub = queue.find((s) => s.id === currentId) ?? lastSub.current;
  lastSub.current = sub;

  /* ── attempt being viewed ── */
  const attemptCount = sub.versions.length;
  const attemptIdx = viewAttempt == null ? attemptCount - 1 : Math.min(viewAttempt, attemptCount - 1);
  const stepsBack = attemptCount - 1 - attemptIdx;
  const isPast = stepsBack > 0;
  const view = useMemo(
    () => (stepsBack === 0 ? sub : pastVersionOf(sub, stepsBack)),
    [sub, stepsBack],
  );
  const pastReview = useMemo(
    () => (stepsBack === 0 ? null : pastReviewOf(sub, stepsBack)),
    [sub, stepsBack],
  );

  /* One row per PAST attempt for the dropdown (Figma 1441:2113), newest first,
     keyed by `stepsBack` (1 = the one before the current). The current attempt
     isn't listed (user, 2026-10-02) — the trigger names it, and the footer's
     "Back To Current Attempt" returns to it from a past one. */
  const attemptRows = useMemo(
    () =>
      sub.versions.slice(1).map((_, i) => {
        const v = i + 1;
        const review = pastReviewOf(sub, v);
        return {
          v,
          num: attemptCount - v,
          submittedOn: pastVersionOf(sub, v).submittedOn,
          reviewer: review?.reviewer ?? null,
          score: review?.score ?? null,
          feedback: review?.feedback || null,
        };
      }),
    [sub, attemptCount],
  );

  function selectAttempt(v: number) {
    setViewAttempt(v === 0 ? null : attemptCount - 1 - v);
    setMediaIndex(0);
    setAttOpen(false);
  }

  const media = view.media;
  const mi = media.length ? Math.min(Math.max(mediaIndex, 0), media.length - 1) : 0;
  const main = media[mi];

  const draft = drafts[sub.id] ?? EMPTY_DRAFT;
  const setDraft = (patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [sub.id]: { ...(prev[sub.id] ?? EMPTY_DRAFT), ...patch } }));

  /** Picking the score that's already set clears it, so a mis-click is undoable
   * without leaving a grade behind. */
  const toggleScore = (n: number) => setDraft({ score: draft.score === n ? null : n });

  /* The task behind this submission, so its name can open the task editor. */
  const taskRecord = tasks.find((t) => t.name === sub.taskName);

  const ownedByCompany = sub.createdBy !== "SkillCat";
  const isDone = !!submitted[sub.id];
  const reviewable = !isPast && !ownedByCompany && !isDone;

  /* Which rail to show. A graded attempt (an older version, or one just
     submitted) and company-created tasks are all read-only, per Figma
     298:1049 / 298:1924 / 298:1973. */
  const gradedReview = isPast ? pastReview : isDone ? submitted[sub.id] : null;
  const railReadOnly = !reviewable;
  const shownScore = railReadOnly ? gradedReview?.score ?? null : draft.score;
  const shownFeedback = railReadOnly ? gradedReview?.feedback ?? "" : draft.feedback;
  const shownPassed = shownScore != null && shownScore >= PASS_MIN;

  function showToast(msg: string) {
    setToast((t) => ({ msg, n: (t?.n ?? 0) + 1 }));
  }

  function goto(id: string) {
    setCurrentId(id);
    setViewAttempt(null);
    setMediaIndex(0);
  }

  /* The queue only moves forward (user, 2026-10-07): "next" is the first
     submission AFTER this one that still waits on a review here — SkillCat's
     own Task, status Review Pending, not reviewed this session. It never wraps,
     so a skipped submission is behind you and leaves the count. */
  const awaitsReview = (x: TaskSubmission, map: Record<string, Reviewed>) =>
    !isReadOnly(x) && x.status === "Review Pending" && !map[x.id];
  function pendingAfter(map: Record<string, Reviewed>): TaskSubmission[] {
    const i = queue.findIndex((x) => x.id === sub.id);
    return queue.slice(i + 1).filter((x) => awaitsReview(x, map));
  }
  function nextUnsubmitted(map: Record<string, Reviewed>): string | null {
    return pendingAfter(map)[0]?.id ?? null;
  }

  /* Clamped, not wrapping — the stage's nav buttons hide at each end. */
  function stepMedia(d: number) {
    const len = media.length;
    if (len < 2) return;
    setMediaIndex(Math.min(len - 1, Math.max(0, mi + d)));
  }

  /* Submit & Next (button or ⌘↵) confirms in a modal before anything is sent —
     the verdict reaches the learner. Until the review can go (`canSubmit`) it
     does nothing: the dimmed button's hover tip says what's missing, as the
     wizards' gated Create buttons do — no toast. */
  function doSubmit() {
    if (!reviewable || !canSubmit) return;
    setConfirmSubmit(true);
  }

  function commitSubmit() {
    setConfirmSubmit(false);
    if (!reviewable || draft.score == null) return;
    const next = { ...submitted, [sub.id]: { score: draft.score, feedback: draft.feedback } };
    setSubmitted(next);
    // The toast names the verdict that was just sent — the same 5+ split the
    // score scale and the confirm use.
    const verdict = draft.score >= PASS_MIN ? "Submission Passed" : "Submission Rejected";
    const nid = nextUnsubmitted(next);
    // Nothing pending after this one: the last Submit goes back to the table
    // (user, 2026-10-07), which shows the toast.
    if (!nid) { onExit(next, verdict); return; }
    showToast(verdict);
    goto(nid);
  }

  /* No toast (user, 2026-10-07) — the screen changing is the feedback. */
  function doSkip() {
    const nid = nextUnsubmitted(submitted);
    if (nid) goto(nid);
  }

  /* ── keyboard shortcuts (latest-state via ref so the listener binds once) ── */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    /* The submit confirm owns the keyboard while it's up: ⌘↵ (the same keys
       that opened it) or ⏎ confirms, Esc backs out. */
    if (confirmSubmit) {
      if (e.key === "Escape") { e.preventDefault(); setConfirmSubmit(false); }
      else if (e.key === "Enter") { e.preventDefault(); commitSubmit(); }
      return;
    }
    /* ⌘↵ / Ctrl+↵ submits from anywhere — including the feedback field, which
       is why the CTA carries those keycaps (Figma 267:2036). */
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      doSubmit();
      return;
    }
    const tag = ((e.target as HTMLElement)?.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input") {
      if (e.key === "Escape") (e.target as HTMLElement).blur();
      return;
    }
    /* The attempts dropdown owns the keyboard while it's open, per its own
       legend (Figma 1169:2087): ↑↓ navigate, ⏎ selects, Esc closes. */
    if (attOpen) {
      if (e.key === "Escape") { setAttOpen(false); return; }
      if (e.key === "Enter") { e.preventDefault(); selectAttempt(attHi); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setAttHi((i) => Math.min(attemptCount - 1, i + 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setAttHi((i) => Math.max(1, i - 1)); return; }
      return;
    }
    if (e.key >= "1" && e.key <= "9") { if (reviewable) toggleScore(+e.key); }
    else if (e.key === "0") { if (reviewable) toggleScore(10); }
    else if (e.key === "ArrowLeft") stepMedia(-1);
    else if (e.key === "ArrowRight") stepMedia(1);
    else if (e.key === "Enter") doSubmit();
    else if (e.key === "n" || e.key === "N") doSkip();
    /* Esc only steps back from a past attempt (its button carries the key).
       It no longer leaves the console — Back is a click (user, 2026-10-02). */
    else if (e.key === "Escape" && isPast) { setViewAttempt(null); setMediaIndex(0); }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* Opening the dropdown highlights the past attempt on screen, or the most
     recent past one when the current attempt is showing (it isn't listed). */
  useEffect(() => {
    if (attOpen) setAttHi(Math.max(1, stepsBack));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attOpen]);

  /* Click outside the attempts dropdown closes it. */
  useEffect(() => {
    if (!attOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!attWrapRef.current?.contains(e.target as Node)) setAttOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [attOpen]);

  /* ── derived display bits ── */
  /* "· n Pending" counts what still waits on a review AFTER this one — not the
     queue's length, and not this submission. Skip hides at 0, and the primary
     drops "& Next" (nothing to go to). */
  const pendingCount = pendingAfter(submitted).length;
  const submitLabel = pendingCount > 0 ? "Submit & Next" : "Submit";
  // The CTA dims until a score is picked and the feedback fits its limit; its
  // tip names whatever is still in the way.
  const feedbackOver = isOver(DESCRIPTION_MAX, draft.feedback);
  const canSubmit = draft.score != null && !feedbackOver;
  const submitBlockedTip = canSubmit
    ? undefined
    : [
        draft.score == null && "Pick a score first — keys 1–0",
        feedbackOver && `Feedback is too long — ${limitMessage(DESCRIPTION_MAX).toLowerCase()}`,
      ]
        .filter(Boolean)
        .join("\n");

  return (
    <div className="main">
      <div className="workspace">
        <div className="rvc-root rvc-hor">
          {/* The two columns share a row; the footer (1164:1509) spans both
              beneath them. ── */}
          <div className="rvc-cols">
          {/* ── left column (Figma 756:2986) — the page header with the attempt
                 switcher on its right, then the write-up, voice note and media.
                 There's no breadcrumb any more; the rail footer's "Back" is the
                 way out of the console. ── */}
          <div className="rvc-main">
          <div className="rvc-header">
            <div className="rvc-pagehead">
              <div className="rvc-pagehead-id">
                {/* Page Header + Button (Figma 1441:1859): the title is plain
                    text; only the 16px open-in-new-tab icon 8px after it opens
                    the Task's brief, and only the icon hovers (#a8a8a8 → #fff). */}
                <h1 className="tasks-title rvc-headtitle">
                  Task: {sub.taskName}
                  {taskRecord && (
                    <button
                      type="button"
                      className="rvc-headicon"
                      onClick={() => openInNewTab(`taskBrief=${taskRecord.id}`)}
                      aria-label="Open this Task's brief in a new tab"
                      title="View this Task's Instructions, Materials Required and the Reference Files uploaded"
                    >
                      <RowExternalLinkIcon />
                    </button>
                  )}
                </h1>
                <div className="tasks-subtitle">
                  {/* Hovering the name peeks at the learner's details (Figma
                      436:572); clicking still opens their full profile. */}
                  <UserDetailsHover
                    user={sub}
                    onOpenProfile={(id) => openInNewTab(`profile=${id}`)}
                    // Left undefined when the queue can't rename — that's what
                    // hides the card's pencil.
                    onRenameUser={
                      onRenameUser &&
                      ((userId, name) => {
                        onRenameUser(userId, name);
                        showToast("Name Updated");
                      })
                    }
                  >
                    <button
                      className="rvc-headlink"
                      onClick={() => openInNewTab(`profile=${sub.userId}`)}
                    >
                      {sub.userName}
                    </button>
                  </UserDetailsHover>
                  {" · "}
                  {longDate(sub.submittedOn)}
                </div>
              </div>
            </div>
            <div className="rvc-flex" />
            {/* ── attempts dropdown (Figma 1169:1598 / 1169:2024) — replaced the
                "PAST SUBMISSIONS" V5…V1 chip row: one Secondary Button naming
                the attempt on screen, opening a table of every attempt with the
                verdict and feedback it drew. ── */}
            {attemptCount > 1 && (
              <div className="rvc-att" ref={attWrapRef}>
                <button
                  className="btn-save-draft rvc-att-trigger"
                  aria-expanded={attOpen}
                  aria-haspopup="dialog"
                  onClick={() => setAttOpen((v) => !v)}
                >
                  Attempt {attemptCount - stepsBack}
                  <span className="rvc-att-caret"><CaretDownIcon /></span>
                </button>

                {attOpen && (
                  <div className="rvc-apanel" role="dialog" aria-label="Attempts">
                    {/* Column order (Figma 1441:2113): # · Result · Feedback ·
                        Reviewed By · Submitted. */}
                    <div className="rvc-arow rvc-arow--head">
                      <span className="rvc-ac rvc-ac--idx">#</span>
                      <span className="rvc-ac rvc-ac--result">Result</span>
                      <span className="rvc-ac rvc-ac--fb">Feedback</span>
                      <span className="rvc-ac rvc-ac--who">Reviewed By</span>
                      <span className="rvc-ac rvc-ac--date">Submitted</span>
                    </div>
                    <div className="rvc-alist">
                      {attemptRows.map((r) => {
                        const passed = r.score != null && r.score >= PASS_MIN;
                        return (
                          <button
                            key={r.v}
                            /* An attempt with no verdict yet dims its empty
                               cells to #7a7a7a (1169:2135); a reviewed row's
                               own blanks stay at the row colour (1169:2084). */
                            className={`rvc-arow ${attHi === r.v ? "is-hi" : ""} ${
                              r.score == null ? "is-ungraded" : ""
                            }`}
                            onMouseEnter={() => setAttHi(r.v)}
                            onClick={() => selectAttempt(r.v)}
                          >
                            <span className="rvc-ac rvc-ac--idx">{r.num}</span>
                            <span
                              className={`rvc-ac rvc-ac--result ${
                                r.score == null ? "is-empty" : passed ? "is-pass" : "is-fail"
                              }`}
                            >
                              {r.score == null ? "—" : `${passed ? "Passed" : "Rejected"} · ${r.score}/10`}
                            </span>
                            {/* Two lines, then an ellipsis — the full text on
                                hover, only when it was cut. */}
                            <span
                              className={`rvc-ac rvc-ac--fb ${r.feedback ? "" : "is-empty"}`}
                              data-tip={r.feedback ?? undefined}
                              data-tip-overflow={r.feedback ? "" : undefined}
                            >
                              {r.feedback ?? "—"}
                            </span>
                            <span className={`rvc-ac rvc-ac--who ${r.reviewer ? "" : "is-empty"}`}>
                              {r.reviewer ?? "—"}
                            </span>
                            <span className="rvc-ac rvc-ac--date">{shortDate(r.submittedOn)}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Same legend atoms as the queue popover (1169:2087). */}
                    <div className="rvc-qpanel-foot">
                      <div className="rvc-qhints">
                        <span className="rvc-qhint">
                          <span className="cta-kbd-group">
                            <span className="cta-kbd cta-kbd--hint"><KeyArrowUpIcon /></span>
                            <span className="cta-kbd cta-kbd--hint"><KeyArrowDownIcon /></span>
                          </span>
                          To navigate
                        </span>
                        <span className="rvc-qhint">
                          <span className="cta-kbd cta-kbd--hint"><KeyEnterIcon /></span>
                          To select
                        </span>
                        <span className="rvc-qhint">
                          <span className="cta-kbd cta-kbd--hint">Esc</span>
                          To close
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Past attempts announce themselves through the version switcher and
             the locked review card — no banner strip. */}

            {/* 4:3 stage with the remaining media stacked down its right side
                (Figma 756:3147). */}
            <div className="rvc-stagecol">
              {/* The write-up under its label (Figma 1441:1852). */}
              <div className="rvc-notes">
                <p className="rvc-notes-label">Learner&rsquo;s Notes</p>
                <p className="rvc-desc">{view.description}</p>
              </div>

              {/* Voice note, when the learner recorded one (Figma 440:812) */}
              {view.hasAudio && (
                <div className="rvc-audio">
                  <button className="rvc-audio-play" aria-label="Play voice note">
                    <AudioPlayGlyph />
                  </button>
                  <span className="rvc-audio-time">{clockDuration(view.audioDuration)}</span>
                </div>
              )}

              <div className={`rvc-media ${media.length > 1 ? "has-thumbs" : ""}`}>
              <div className="rvc-stage">
                <img src={mediaUrl(main.seed, 1000, 750)} alt="" />
                {main.kind === "video" && (
                  <>
                    <span className="rvc-stage-play"><PlayGlyph /></span>
                    <span className="rvc-stage-chip rvc-stage-dur">{main.duration}</span>
                  </>
                )}
                {/* ← / → step through the media; the arrows name that on hover
                    (Figma 439:686 / 439:680). */}
                {mi > 0 && (
                  <ShortcutHint label="Previous" keyIcon={<KeyArrowLeftIcon />}>
                    <button className="rvc-stage-nav rvc-stage-nav--prev" onClick={() => stepMedia(-1)} aria-label="Previous media">
                      <ChevronLeftIcon />
                    </button>
                  </ShortcutHint>
                )}
                {mi < media.length - 1 && (
                  <ShortcutHint label="Next" keyIcon={<KeyArrowRightIcon />}>
                    <button className="rvc-stage-nav rvc-stage-nav--next" onClick={() => stepMedia(1)} aria-label="Next media">
                      <ChevronRightIcon />
                    </button>
                  </ShortcutHint>
                )}
                <button
                  className="rvc-stage-chip rvc-stage-download"
                  onClick={() => {
                    downloadMedia(
                      mediaUrl(main.seed, 1600, 1200),
                      `${slug(sub.userName)}-${slug(sub.taskName)}-${mi + 1}.jpg`,
                    );
                    showToast("Download Started");
                  }}
                >
                  <DownloadIcon12 /> Download
                </button>
              </div>

                {media.length > 1 && (
                  <div className="rvc-thumbs">
                    {media.map((m, i) => (
                      <button
                        key={i}
                        className={`rvc-thumb ${i === mi ? "is-active" : ""}`}
                        onClick={() => setMediaIndex(i)}
                      >
                        <img src={mediaUrl(m.seed, 400, 300)} alt="" />
                        {m.kind === "video" && <span className="rvc-thumb-play"><PlayGlyph /></span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── right column (Figma 756:3091) — the review rail over its own
              footer, running the full height of the page. Gradable attempts get
              the editable fields; everything else is read-only (Figma 298:1049
              previously graded, 298:1924 company-created ungraded, 298:1973
              company graded). */}
          <div className="rvc-railcol">
            <div className="rvc-rail">
              {/* The shared callout (NoteCard — Figma 1448:2554, the same card
                  as the Skills "Applies to Existing Users" note). */}
              {railReadOnly && (
                <NoteCard
                  className="rvc-notice"
                  role="note"
                  mutedIcon
                  icon={<EditOffIcon />}
                  title="Read-Only"
                  body={
                    ownedByCompany
                      ? `Grading done by ${sub.createdBy} for company-created Hands-On Tasks`
                      : "Grades and feedback once submitted, cannot be edited"
                  }
                />
              )}

              {/* Reviewer's checklist — grader-only, so it drops out once the
                  attempt is read-only (Figma 263:1045) */}
              {!railReadOnly && (
                <div className="rvc-field">
                  <div className="rvc-field-head">
                    <span className="form-label rvc-check-label">
                      Reviewer’s Checklist
                      {/* The grey subtext moved into this glyph's tooltip
                          (Figma 1172:2237/1172:2238). */}
                      <span
                        className="rvc-check-info"
                        tabIndex={0}
                        aria-label="About the checklist"
                        title="Hidden from the user. Only for the grader’s reference"
                      >
                        <InfoIcon14 />
                      </span>
                    </span>
                  </div>
                  <div className="rvc-checklist">
                    <ul>
                      {sub.criteria.map((c) => (
                        <li key={c.id}>{c.label}</li>
                      ))}
                    </ul>
                    {sub.failCriteria.length > 0 && (
                      <>
                        <p className="rvc-checklist-fail">Fail if:</p>
                        <ul>
                          {sub.failCriteria.map((c) => (
                            <li key={c.id}>{c.label}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              )}
              {/* The rail's ONE rule, 28px clear of both neighbours — Score and
                  Feedback are no longer separated by one (1172:2245). */}
              {!railReadOnly && <div className="rvc-rail-rule" />}

              {/* Score + Feedback. A company task with no grade yet shows the
                  notice on its own (298:1924). */}
              {(!railReadOnly || gradedReview) && (
                <>
                  {/* Score — Figma 263:1015 / 263:985 / 263:910; read-only 1446:2440 */}
                  <div className="rvc-field">
                    <div className="rvc-field-head">
                      <span className="form-label">
                        Score<span className="req">*</span>
                      </span>
                    </div>
                    <div className="rvc-scores">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          className={`rvc-score ${
                            shownScore === n ? (n >= PASS_MIN ? "is-pass" : "is-fail") : ""
                          }`}
                          aria-pressed={shownScore === n}
                          disabled={railReadOnly}
                          onClick={() => toggleScore(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className={`rvc-scale-legend${railReadOnly ? " is-locked" : ""}`}>
                      <span
                        className={`rvc-legend-fail ${
                          shownScore != null && !shownPassed ? "is-on" : ""
                        }`}
                      >
                        1-{PASS_MIN - 1}: Rejected
                      </span>
                      <span className={`rvc-legend-pass ${shownPassed ? "is-on" : ""}`}>
                        {PASS_MIN}-10: Pass
                      </span>
                    </div>
                  </div>

                  {/* Feedback — Figma 263:865; read-only 298:1092 */}
                  <div className="rvc-field">
                    <label className="form-label" htmlFor="rvc-feedback">
                      Feedback
                      {!railReadOnly && <LimitError max={DESCRIPTION_MAX} values={[shownFeedback]} />}
                    </label>
                    <div className="limit-input is-multiline">
                      <textarea
                        id="rvc-feedback"
                        className={`form-input rvc-feedback${
                          railReadOnly ? "" : ` ${limitClass(DESCRIPTION_MAX, shownFeedback)}`
                        }`.trimEnd()}
                        placeholder={
                          railReadOnly
                            ? undefined
                            : "Provide clear feedback on the submission, including what was done well, what needs improvement, and any safety or technical corrections."
                        }
                        readOnly={railReadOnly}
                        value={shownFeedback}
                        onChange={(e) => setDraft({ feedback: e.target.value })}
                      />
                      {!railReadOnly && <CharCount value={shownFeedback} max={DESCRIPTION_MAX} />}
                    </div>
                    <p className="form-help">
                      Optional. Shown to the user along with their score.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          </div>

          {/* ── footer (Figma 1164:1509) — a page-wide bar under BOTH columns
              again (it used to sit inside the rail): "Back" out to the table on
              the left, then Skip and the primary CTA 16px apart. The queue
              popover (and its Q key) is gone — user, 2026-10-07. ── */}
          <div className="wizard-footer rvc-footer">
            <button className="wizard-cancel" onClick={() => onExit(submitted)}>
              Back
            </button>
            <div className="rvc-foot-actions">
              {/* Skip prints its own N keycap now (756:3836), so it no longer
                  needs the hover hint that used to name the shortcut. With
                  nothing pending after this one it stays, disabled (user,
                  2026-10-07) — on a company Task's read-only screen it is the
                  footer's only button. */}
              <button
                className="btn-save-draft rvc-skip"
                onClick={doSkip}
                disabled={pendingCount === 0}
              >
                <span className="rvc-skip-label">
                  Skip to Next{" "}
                  <span className="rvc-skip-count">· {pendingCount} Pending</span>
                </span>
                <span className="cta-kbd">N</span>
              </button>
              {isPast ? (
                <button
                  className="btn-save-draft rvc-back-current"
                  onClick={() => { setViewAttempt(null); setMediaIndex(0); }}
                >
                  Back To Current Attempt
                  <span className="cta-kbd">Esc</span>
                </button>
              ) : reviewable ? (
                /* `aria-disabled`, not `disabled`: a disabled button fires no
                   mouse events, so it couldn't show its tip. */
                <button
                  className={`btn-publish${canSubmit ? "" : " is-disabled"}`}
                  aria-disabled={!canSubmit}
                  data-tip={submitBlockedTip}
                  onClick={doSubmit}
                >
                  {submitLabel}
                  <WizardKeyHint />
                </button>
              ) : null}
            </div>
          </div>

          {toast && <CopiedToast key={toast.n} label={toast.msg} onDone={hideToast} />}
        </div>
      </div>

      {confirmSubmit && draft.score != null && (
        <PrmModal
          title="Submit Review?"
          confirmLabel={submitLabel}
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={commitSubmit}
        >
          <p className="prm-content">
            {sub.userName}&rsquo;s submission will be marked{" "}
            <strong>
              {draft.score >= PASS_MIN ? "Passed" : "Rejected"} · {draft.score}/10
            </strong>
            {draft.score >= PASS_MIN
              ? "."
              : ` and returned to ${sub.userName.split(" ")[0]} to resubmit.`}{" "}
            {draft.feedback.trim()
              ? "Your feedback is sent with it."
              : "No feedback will be sent with it."}{" "}
            A submitted review can&rsquo;t be changed.
          </p>
        </PrmModal>
      )}
    </div>
  );
}
