import { useEffect, useMemo, useRef, useState } from "react";
import {
  mediaUrl,
  pastReviewOf,
  pastVersionOf,
  type TaskSubmission,
} from "../data/reviewSubmissions";
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, CommandIcon, DownloadIcon, EditOffIcon, EnterKeyIcon, KeyArrowLeftIcon, KeyArrowRightIcon, SortIcon } from "./icons";
import { tasks } from "../data/tasks";
import { QueueFilters, type QueueFilter } from "./ReviewQueueFilters";
import { UserDetailsHover } from "./UserDetailsHover";
import { ShortcutHint } from "./ShortcutHint";

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

/* Queue table columns (Figma 263:1904) — the first column is the queue position
   and carries no header label. `sortKey` maps onto the table page's sort. */
const QUEUE_COLS: { cls: string; label: string; sortKey?: string }[] = [
  { cls: "idx", label: "" },
  { cls: "user", label: "User", sortKey: "name" },
  { cls: "task", label: "Task Name", sortKey: "task" },
  { cls: "att", label: "Att", sortKey: "attempt" },
  { cls: "date", label: "Submitted", sortKey: "submittedOn" },
];

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
  queueFilters = [],
  sort,
  onSort,
  onExit,
  onRenameUser,
}: {
  /** The table's filtered + sorted submissions — becomes the review queue. */
  queue: TaskSubmission[];
  initialId: string;
  /** The table's filters, live-editable from the queue popover (Figma 263:1664).
   * They drive the table's own state, so the queue re-filters as they change. */
  queueFilters?: QueueFilter[];
  /** The table's sort, so the queue's column headers can reorder the queue. */
  sort?: { key: string; dir: "asc" | "desc" };
  onSort?: (key: string) => void;
  /** Back to the table. Reviewed ids + results are handed up so the table can
   * drop them from the pending list. */
  onExit: (reviewed: Record<string, Reviewed>) => void;
  /** Renamed from the submitter's user-details card — the queue owns the list,
   * so the new name comes back down through `queue`. */
  onRenameUser?: (userId: string, name: string) => void;
}) {
  const [currentId, setCurrentId] = useState(initialId);
  const [queueOpen, setQueueOpen] = useState(false);
  /* The queue popover highlights a row before committing to it — arrows move the
     highlight, Q/⏎ switches the submission being reviewed (Esc discards). */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const queueWrapRef = useRef<HTMLDivElement>(null);
  const [viewAttempt, setViewAttempt] = useState<number | null>(null); // 0-based chip; null = current
  const [mediaIndex, setMediaIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitted, setSubmitted] = useState<Record<string, Reviewed>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

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
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function goto(id: string) {
    setCurrentId(id);
    setViewAttempt(null);
    setMediaIndex(0);
  }

  function nextUnsubmitted(map: Record<string, Reviewed>): string | null {
    const ids = queue.map((x) => x.id);
    if (!ids.length) return null;
    const i = ids.indexOf(sub.id);
    for (let k = 1; k <= ids.length; k++) {
      const id = ids[(i + k) % ids.length];
      if (!map[id] && id !== sub.id) return id;
    }
    return null;
  }

  /* ── queue popover navigation ──
     Arrows only move the highlight; the submission on screen changes when the
     selection is committed with Q or ⏎ (Esc closes and discards it). */
  function moveQueue(d: number) {
    if (!queue.length) return;
    const from = highlightId ?? sub.id;
    const i = Math.max(0, queue.findIndex((x) => x.id === from));
    const next = Math.min(queue.length - 1, Math.max(0, i + d));
    setHighlightId(queue[next].id);
  }

  function commitQueue() {
    if (highlightId && highlightId !== sub.id) goto(highlightId);
    setQueueOpen(false);
  }

  /* Clamped, not wrapping — the stage's nav buttons hide at each end. */
  function stepMedia(d: number) {
    const len = media.length;
    if (len < 2) return;
    setMediaIndex(Math.min(len - 1, Math.max(0, mi + d)));
  }

  function doSubmit() {
    if (!reviewable) return;
    if (draft.score == null) {
      showToast("Pick a score first — keys 1–0");
      return;
    }
    const next = { ...submitted, [sub.id]: { score: draft.score, feedback: draft.feedback } };
    setSubmitted(next);
    const verdict = draft.score >= PASS_MIN ? "PASS" : "BELOW PASS";
    showToast(
      `Review submitted — ${draft.score}/10 ${verdict}` +
        (verdict === "BELOW PASS" ? ` · attempt returned to ${sub.userName.split(" ")[0]}` : ""),
    );
    const nid = nextUnsubmitted(next);
    if (nid) goto(nid);
  }

  function doSkip() {
    const nid = nextUnsubmitted(submitted);
    if (nid) {
      goto(nid);
      showToast("Skipped — it stays in the queue");
    } else showToast("Nothing else pending");
  }

  /* ── keyboard shortcuts (latest-state via ref so the listener binds once) ── */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
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
    /* While the queue popover is open it owns the keyboard, per its own footer
       legend (Figma 263:1607): ↑↓ navigate, ⏎ selects, Esc closes, Q saves and
       closes. The score keys stay inert until it's dismissed. */
    if (queueOpen) {
      if (e.key === "Escape") { setQueueOpen(false); return; }
      if (e.key === "Enter" || e.key === "q" || e.key === "Q") { commitQueue(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); moveQueue(1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); moveQueue(-1); return; }
      if (e.key >= "0" && e.key <= "9") return;
    }
    if (e.key >= "1" && e.key <= "9") { if (reviewable) toggleScore(+e.key); }
    else if (e.key === "0") { if (reviewable) toggleScore(10); }
    else if (e.key === "ArrowLeft") stepMedia(-1);
    else if (e.key === "ArrowRight") stepMedia(1);
    else if (e.key === "Enter") doSubmit();
    else if (e.key === "n" || e.key === "N") doSkip();
    else if (e.key === "q" || e.key === "Q") setQueueOpen((v) => !v);
    else if (e.key === "Escape") {
      if (isPast) { setViewAttempt(null); setMediaIndex(0); }
      else onExit(submitted);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* Opening the popover highlights whatever is on screen. */
  useEffect(() => {
    setHighlightId(queueOpen ? sub.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueOpen]);

  /* Changing a filter (or sort) keeps the reviewer on this submission but moves
     the highlight to the first row matching the new criteria — confirming is
     what actually switches. */
  const queueKey = queue.map((q) => q.id).join(",");
  const seenQueueKey = useRef(queueKey);
  useEffect(() => {
    if (seenQueueKey.current === queueKey) return;
    seenQueueKey.current = queueKey;
    if (queueOpen) setHighlightId(queue[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey]);

  /* Click outside the queue popover closes it. */
  useEffect(() => {
    if (!queueOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!queueWrapRef.current?.contains(e.target as Node)) setQueueOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [queueOpen]);

  /* ── derived display bits ── */
  const submittedCount = Object.keys(submitted).length;
  const pendingCount = queue.length - submittedCount;
  const hasScore = draft.score != null;

  return (
    <div className="main">
      <div className="workspace">
        <div className="rvc-root rvc-hor">
          {/* ── left column (Figma 756:2986) — the page header with the attempt
                 switcher on its right, then the write-up, voice note and media.
                 There's no breadcrumb any more; the rail footer's "Back" is the
                 way out of the console. ── */}
          <div className="rvc-main">
          <div className="rvc-header">
            <div className="rvc-pagehead">
              <div className="rvc-pagehead-id">
                <h1 className="tasks-title">
                  Task:{" "}
                  {taskRecord ? (
                    <button
                      className="rvc-headlink"
                      onClick={() => openInNewTab(`editTask=${taskRecord.id}`)}
                      title="Open this task's editor in a new tab"
                    >
                      {sub.taskName}
                    </button>
                  ) : (
                    sub.taskName
                  )}
                </h1>
                <div className="tasks-subtitle">
                  {/* Hovering the name peeks at the learner's details (Figma
                      436:572); clicking still opens their full profile. */}
                  <UserDetailsHover
                    user={sub}
                    onOpenProfile={(id) => openInNewTab(`profile=${id}`)}
                    onRenameUser={onRenameUser}
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
            {attemptCount > 1 && (
              <div className="rvc-versions">
                <span className="rvc-versions-label">Past submissions</span>
                <div className="rvc-version-chips">
                  {/* `versions` is newest-first, and so is this row (V5 … V1).
                      Chip v is v submissions back from the current one. */}
                  {sub.versions.map((label, v) => {
                    const active = attemptCount - 1 - v === attemptIdx;
                    return (
                      <button
                        key={label}
                        className={`rvc-version ${active ? "is-active" : ""}`}
                        aria-pressed={active}
                        onClick={() => {
                          setViewAttempt(v === 0 ? null : attemptCount - 1 - v);
                          setMediaIndex(0);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Past attempts announce themselves through the version switcher and
             the locked review card — no banner strip. */}

            {/* 4:3 stage with the remaining media stacked down its right side
                (Figma 756:3147). */}
            <div className="rvc-stagecol">
              <p className="rvc-desc">{view.description}</p>

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
                  onClick={() =>
                    downloadMedia(
                      mediaUrl(main.seed, 1600, 1200),
                      `${slug(sub.userName)}-${slug(sub.taskName)}-${mi + 1}.jpg`,
                    )
                  }
                >
                  <DownloadIcon /> Download
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
              {railReadOnly && (
                <div className="rvc-notice" role="note">
                  <span className="rvc-notice-icon"><EditOffIcon /></span>
                  <span className="rvc-notice-text">
                    <span className="rvc-notice-title">Read-Only</span>
                    <span className="rvc-notice-sub">
                      {ownedByCompany
                        ? `Grading done by ${sub.createdBy} for company-created Hands-On Tasks`
                        : "Grades and feedback once submitted, cannot be edited"}
                    </span>
                  </span>
                </div>
              )}

              {/* Reviewer's checklist — grader-only, so it drops out once the
                  attempt is read-only (Figma 263:1045) */}
              {!railReadOnly && (
                <div className="rvc-field">
                  <div className="rvc-field-head">
                    <span className="form-label">Reviewer’s Checklist</span>
                    <p className="form-help">
                      Hidden from the user. Only for the grader’s reference
                    </p>
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

              {/* Score + Feedback. A company task with no grade yet shows the
                  notice on its own (298:1924). */}
              {(!railReadOnly || gradedReview) && (
                <>
                  {/* Score — Figma 263:1015 / 263:985 / 263:910; read-only 298:1899 */}
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
                    <div className="rvc-scale-legend">
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
                    <label className="form-label" htmlFor="rvc-feedback">Feedback</label>
                    <textarea
                      id="rvc-feedback"
                      className="form-input rvc-feedback"
                      placeholder={
                        railReadOnly
                          ? undefined
                          : "Provide clear feedback on the submission, including what was done well, what needs improvement, and any safety or technical corrections."
                      }
                      readOnly={railReadOnly}
                      value={shownFeedback}
                      onChange={(e) => setDraft({ feedback: e.target.value })}
                    />
                    <p className="form-help">
                      Optional. Shown to the user along with their score.
                    </p>
                  </div>
                </>
              )}
            </div>

          {/* ── footer (Figma 756:3763) — now the bottom of the rail column, not
              a page-wide bar: "Back" out to the table on the left, then Skip and
              the primary CTA 16px apart. This design drops the View Queue
              button; the popover it used to open still hangs here and is reached
              with Q. ── */}
          <div className="wizard-footer rvc-footer">
            <button className="wizard-cancel" onClick={() => onExit(submitted)}>
              Back
            </button>
            {/* Zero-size anchor — the popover keeps its right-aligned,
                opens-upward placement now that it has no trigger of its own. */}
            <div className="rvc-queue-wrap" ref={queueWrapRef}>
              {queueOpen && (
                  <div className="rvc-qpanel" role="dialog" aria-label="Review queue">
                    <div className="rvc-qpanel-head">
                      <span className="rvc-qcount">{pendingCount} Pending</span>
                      <div className="rvc-qpanel-filters">
                        <QueueFilters filters={queueFilters} />
                      </div>
                    </div>

                    <div className="rvc-qhead">
                      {QUEUE_COLS.map((c) => {
                        const active = !!c.sortKey && sort?.key === c.sortKey;
                        if (!c.sortKey || !onSort) {
                          return <span key={c.cls} className={`rvc-qc rvc-qc--${c.cls}`}>{c.label}</span>;
                        }
                        return (
                          <button
                            key={c.cls}
                            className={`rvc-qc rvc-qc--${c.cls} rvc-qc--sortable`}
                            onClick={() => onSort(c.sortKey!)}
                          >
                            {c.label}
                            <SortIcon active={active} dir={active ? sort?.dir : undefined} />
                          </button>
                        );
                      })}
                    </div>

                    <div className="rvc-qlist">
                      {queue.map((q, i) => {
                        const sel = q.id === (highlightId ?? sub.id);
                        const done = !!submitted[q.id];
                        return (
                          <button
                            key={q.id}
                            className={`rvc-qrow ${sel ? "is-selected" : ""} ${done ? "is-done" : ""}`}
                            onClick={() => {
                              if (q.id !== sub.id) goto(q.id);
                              setQueueOpen(false);
                            }}
                          >
                            <span className="rvc-qc rvc-qc--idx">{i + 1}</span>
                            <span className="rvc-qc rvc-qc--user">{q.userName}</span>
                            <span className="rvc-qc rvc-qc--task">{q.taskName}</span>
                            <span className="rvc-qc rvc-qc--att">{q.versions.length}</span>
                            <span className="rvc-qc rvc-qc--date">
                              {done ? `Reviewed · ${submitted[q.id].score}/10` : longDate(q.submittedOn)}
                            </span>
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
            <div className="rvc-foot-actions">
              {/* Skip prints its own N keycap now (756:3836), so it no longer
                  needs the hover hint that used to name the shortcut. */}
              <button className="btn-save-draft rvc-skip" onClick={doSkip}>
                Skip
                <span className="kbd-letter">N</span>
              </button>
              {isPast ? (
                <button
                  className="btn-save-draft rvc-back-current"
                  onClick={() => { setViewAttempt(null); setMediaIndex(0); }}
                >
                  Back To Current Attempt
                  <span className="kbd-letter">Esc</span>
                </button>
              ) : reviewable ? (
                <button className={`btn-publish ${hasScore ? "" : "rvc-dim"}`} onClick={doSubmit}>
                  Submit &amp; Next
                  <span className="rvc-submit-keys">
                    <span className="rvc-qkey rvc-qkey--cmd"><CommandIcon /></span>
                    <span className="rvc-qkey"><EnterKeyIcon /></span>
                  </span>
                </button>
              ) : isDone ? (
                <span className="rvc-footer-note">
                  Reviewed — {submitted[sub.id].score}/10
                </span>
              ) : null}
            </div>
          </div>
          </div>

          {toast && <div className="rvc-toast">{toast}</div>}
        </div>
      </div>
    </div>
  );
}
