import { useEffect, useMemo, useRef, useState } from "react";
import {
  mediaUrl,
  pastReviewOf,
  pastVersionOf,
  type TaskSubmission,
} from "../data/reviewSubmissions";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CommandIcon,
  DownloadIcon,
  EnterKeyIcon,
  LockIcon,
  SortIcon,
} from "./icons";
import { PageBreak } from "./PageBreak";
import { QueueFilters, type QueueFilter } from "./ReviewQueueFilters";

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

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

/* Queue table columns (Figma 263:1904) — the first column is the queue position
   and carries no header label. `sortKey` maps onto the table page's sort. */
const QUEUE_COLS: { cls: string; label: string; sortKey?: string }[] = [
  { cls: "idx", label: "" },
  { cls: "user", label: "User", sortKey: "name" },
  { cls: "task", label: "Task Name", sortKey: "task" },
  { cls: "att", label: "Att", sortKey: "attempt" },
  { cls: "date", label: "Submitted", sortKey: "submittedOn" },
];

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
}) {
  const [currentId, setCurrentId] = useState(initialId);
  const [queueOpen, setQueueOpen] = useState(false);
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

  const ownedByCompany = sub.createdBy !== "SkillCat";
  const isDone = !!submitted[sub.id];
  const reviewable = !isPast && !ownedByCompany && !isDone;

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

  /* ── queue popover navigation (only while the panel is open) ── */
  function moveQueue(d: number) {
    if (!queue.length) return;
    const i = Math.max(0, queue.findIndex((x) => x.id === sub.id));
    const next = Math.min(queue.length - 1, Math.max(0, i + d));
    if (next !== i) goto(queue[next].id);
  }

  function stepMedia(d: number) {
    const len = media.length;
    if (len < 2) return;
    setMediaIndex(((mi + d) % len + len) % len);
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
      if (e.key === "Escape" || e.key === "Enter" || e.key === "q" || e.key === "Q") {
        setQueueOpen(false);
        return;
      }
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
  const nextId = nextUnsubmitted(submitted);
  const nextSub = nextId ? queue.find((x) => x.id === nextId) : null;

  const pastScores = Array.from({ length: attemptCount - 1 }, (_, i) => pastReviewOf(sub, attemptCount - 1 - i).score);
  const attemptSummary = pastScores.length
    ? `${pastScores.length} prior · best ${Math.max(...pastScores)}/10`
    : "";

  const hasScore = draft.score != null;
  const passed = hasScore && draft.score! >= PASS_MIN;

  return (
    <div className="main">
      <div className="workspace">
        <div className="rvc-root">
          {/* ── header ── */}
          <div className="rvc-header">
            <button className="rvc-back" onClick={() => onExit(submitted)} aria-label="Back to the table">
              <ChevronLeftIcon />
            </button>
            <div>
              <div className="wizard-brand-eyebrow">Reviewing</div>
              <div className="rvc-title-row">
                <span className="wizard-brand-name">Hands-On Task Submissions</span>
                <span className="co-status-pill co-status-pill--accent">{pendingCount} pending</span>
              </div>
            </div>

            <div className="rvc-flex" />

            {/* ── queue: a collapsed popover docked to the header's right edge
                   (trigger Figma 263:1579, panel 263:1587) ── */}
            <div className="rvc-queue-wrap" ref={queueWrapRef}>
              <button
                className={`rvc-queue-btn ${queueOpen ? "is-open" : ""}`}
                onClick={() => setQueueOpen((v) => !v)}
                aria-expanded={queueOpen}
              >
                <span className="rvc-queue-btn-text">
                  <span className="rvc-queue-btn-eyebrow">
                    Next · {pendingCount} waiting
                  </span>
                  <span className="rvc-queue-btn-name">
                    {nextSub ? nextSub.userName : "Nothing pending"}
                  </span>
                </span>
                <span className="kbd-letter">Q</span>
              </button>

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
                      const sel = q.id === sub.id;
                      const done = !!submitted[q.id];
                      return (
                        <button
                          key={q.id}
                          className={`rvc-qrow ${sel ? "is-selected" : ""} ${done ? "is-done" : ""}`}
                          onClick={() => goto(q.id)}
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
          </div>

          {/* ── submission header ── */}
          <div className="rvc-subheader">
            <div className="rvc-subheader-id">
              <div className="rvc-subtask">{sub.taskName}</div>
              <div className="rvc-subwho">
                <span className="rvc-avatar">{initialsOf(sub.userName)}</span>
                <span className="rvc-subname">{sub.userName}</span>
                <span className="rvc-subdot">·</span>
                <span className="rvc-subago">submitted {sub.lastActivity.toLowerCase()}</span>
              </div>
            </div>
            <div className="rvc-flex" />
            {attemptCount > 1 && (
              <div className="rvc-attempts">
                <span className="page-break-label">Attempts</span>
                {Array.from({ length: attemptCount }, (_, i) => {
                  const isCur = i === attemptCount - 1;
                  const active = i === attemptIdx;
                  const score = isCur ? null : pastScores[i];
                  const band = isCur ? "cur" : score != null && score >= PASS_MIN ? "pass" : "fail";
                  return (
                    <button
                      key={i}
                      className={`rvc-attempt rvc-attempt--${band} ${active ? "is-active" : ""}`}
                      onClick={() => {
                        setViewAttempt(isCur ? null : i);
                        setMediaIndex(0);
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
                <span className="rvc-attempts-sum">{attemptSummary}</span>
              </div>
            )}
          </div>

          {/* ── past attempt banner ── */}
          {isPast && pastReview && (
            <div className="rvc-past-banner">
              <span className="rvc-past-banner-title">Viewing a past attempt</span>
              <span className="rvc-past-banner-sub">
                Attempt {attemptIdx + 1} of {attemptCount} — reviewed {formatDate(pastReview.reviewedOn)} by {pastReview.reviewer}
              </span>
              <div className="rvc-flex" />
              <button className="btn-save-draft" onClick={() => { setViewAttempt(null); setMediaIndex(0); }}>
                Back to current
              </button>
            </div>
          )}

          {/* ── body ── */}
          <div className="rvc-body">
            {/* left — submission. 4:3 stage with the other media stacked to its
                right (Figma-driven layout update). */}
            <div className="rvc-stagecol">
              <div>
                <PageBreak label="Project Description" />
                <div className="rvc-desc">{view.description}</div>
              </div>

              <div className="rvc-media">
              <div className="rvc-stage">
                <img src={mediaUrl(main.seed, 1000, 640)} alt="" />
                {main.kind === "video" && (
                  <>
                    <span className="rvc-stage-play"><PlayGlyph /></span>
                    <span className="rvc-stage-dur">{main.duration}</span>
                  </>
                )}
                {media.length > 1 && (
                  <>
                    <button className="rvc-stage-nav rvc-stage-nav--prev" onClick={() => stepMedia(-1)} aria-label="Previous media">
                      <ChevronLeftIcon />
                    </button>
                    <button className="rvc-stage-nav rvc-stage-nav--next" onClick={() => stepMedia(1)} aria-label="Next media">
                      <ChevronRightIcon />
                    </button>
                  </>
                )}
                <span className="rvc-stage-counter">{mi + 1} / {media.length}</span>
                <button className="btn-save-draft rvc-stage-download">
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
                        <img src={mediaUrl(m.seed, 320, 240)} alt="" />
                        {m.kind === "video" && <span className="rvc-thumb-play"><PlayGlyph /></span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* right — review rail */}
            <div className="rvc-rail">
              {isPast && pastReview ? (
                <>
                  <div className="rvc-rail-past">
                    <PageBreak
                      label={`Review — Attempt ${attemptIdx + 1} of ${attemptCount}`}
                      trailing={<span className="co-status-pill co-status-pill--grey">Locked</span>}
                    />
                    <div className="rvc-rail-past-score">
                      <span className="rvc-rail-past-num">{pastReview.score}/10</span>
                      <span
                        className={`co-status-pill ${
                          pastReview.score >= PASS_MIN ? "co-status-pill--green" : "co-status-pill--red"
                        }`}
                      >
                        {pastReview.score >= PASS_MIN ? "PASS" : "BELOW PASS"}
                      </span>
                    </div>
                    <blockquote className="rvc-rail-past-quote">
                      <div className="rvc-rail-past-fb">“{pastReview.feedback}”</div>
                      <div className="rvc-rail-past-by">— {pastReview.reviewer}, SkillCat Admin · {formatDate(pastReview.reviewedOn)}</div>
                    </blockquote>
                    <p className="form-help">
                      Scores and feedback are locked once submitted. The learner saw this feedback with their result.
                    </p>
                  </div>
                  <button className="btn-save-draft rvc-back-current" onClick={() => { setViewAttempt(null); setMediaIndex(0); }}>
                    Back to current attempt
                  </button>
                </>
              ) : ownedByCompany ? (
                <div className="rvc-owner-note" role="note">
                  <span className="rvc-owner-note-icon"><LockIcon /></span>
                  <span>
                    Reviewed by <strong>{sub.createdBy}</strong>. SkillCat does not review
                    submissions for company-created tasks.
                  </span>
                </div>
              ) : (
                <>
                  {/* Reviewer's checklist — Figma 263:1045 */}
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

                  {/* Score — Figma 263:1015 (ungraded) / 263:985 (passed) / 263:910 (rejected) */}
                  <div className="rvc-field">
                    <div className="rvc-field-head">
                      <span className="form-label">
                        Score<span className="req">*</span>
                      </span>
                      <p className="form-help">
                        Required. Final once submitted and shown to the user.
                      </p>
                    </div>
                    <div className="rvc-scores">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          className={`rvc-score ${
                            draft.score === n ? (n >= PASS_MIN ? "is-pass" : "is-fail") : ""
                          }`}
                          aria-pressed={draft.score === n}
                          onClick={() => toggleScore(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="rvc-scale-legend">
                      <span className={`rvc-legend-fail ${hasScore && !passed ? "is-on" : ""}`}>
                        1-{PASS_MIN - 1}: Rejected
                      </span>
                      <span className={`rvc-legend-pass ${hasScore && passed ? "is-on" : ""}`}>
                        {PASS_MIN}-10: Pass
                      </span>
                    </div>
                  </div>

                  {/* Feedback — Figma 263:865 */}
                  <div className="rvc-field rvc-field--fb">
                    <div className="rvc-field-head">
                      <label className="form-label" htmlFor="rvc-feedback">Feedback</label>
                      <p className="form-help">
                        Optional. Shown to the user along with their score.
                      </p>
                    </div>
                    <textarea
                      id="rvc-feedback"
                      className="form-input rvc-feedback"
                      placeholder="Provide clear feedback on the submission, including what was done well, what needs improvement, and any safety or technical corrections."
                      value={draft.feedback}
                      onChange={(e) => setDraft({ feedback: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── footer (Figma 267:1985) — keycap hints + the primary CTA ── */}
          <div className="wizard-footer rvc-footer">
            <button className="wizard-cancel" onClick={doSkip}>Skip</button>
            <div className="rvc-flex" />
            <div className="rvc-footer-hints">
              {reviewable && (
                <span className="rvc-qhint">
                  <span className="rvc-qkeypair rvc-qkeypair--tight">
                    <span className="rvc-qkey rvc-qkey--text">1</span>
                    <span className="rvc-qkey rvc-qkey--text">2</span>
                    <span className="rvc-qkey-ellipsis">…</span>
                    <span className="rvc-qkey rvc-qkey--text">0</span>
                  </span>
                  Score
                </span>
              )}
              {media.length > 1 && (
                <span className="rvc-qhint">
                  <span className="rvc-qkeypair">
                    <span className="rvc-qkey"><ArrowLeftIcon /></span>
                    <span className="rvc-qkey"><ArrowRightIcon /></span>
                  </span>
                  Media
                </span>
              )}
            </div>
            {isPast ? (
              <>
                <span className="rvc-footer-note">Viewing a past attempt — read-only</span>
                <button className="btn-save-draft" onClick={() => { setViewAttempt(null); setMediaIndex(0); }}>
                  Back to current attempt
                </button>
              </>
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

          {toast && <div className="rvc-toast">{toast}</div>}
        </div>
      </div>
    </div>
  );
}
