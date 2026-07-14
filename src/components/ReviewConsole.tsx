import { useEffect, useMemo, useRef, useState } from "react";
import {
  mediaUrl,
  pastReviewOf,
  pastVersionOf,
  REVIEW_TODAY,
  type TaskSubmission,
} from "../data/reviewSubmissions";
import { ChevronLeftIcon, LockIcon } from "./icons";

/* ── Review console ─────────────────────────────────────────────────────────
   Queue-driven, keyboard-first review screen for Hands-On submissions, per the
   "Hands-On Review Prototype" reference. Opened from the Review Hands-On Tasks
   table; the table's filtered list becomes the queue. Shortcuts: 1–0 score,
   ← → media, ⏎ submit, N skip, Q queue, Esc back/close. ── */

const PASS_MIN = 5; // app-wide Hands-On semantic: 1–4 rejected, 5–10 pass

type Draft = { score: number | null; feedback: string };
type Reviewed = { score: number; feedback: string };

const EMPTY_DRAFT: Draft = { score: null, feedback: "" };

function waitInfo(s: TaskSubmission): { label: string; level: 0 | 1 | 2 } {
  const days = Math.max(
    0,
    Math.round((REVIEW_TODAY.getTime() - new Date(`${s.submittedOn}T00:00:00`).getTime()) / 86400000),
  );
  return {
    label: days <= 0 ? "today" : `${days}d`,
    level: days >= 3 ? 2 : days === 2 ? 1 : 0,
  };
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
  activeFilters = [],
  onExit,
}: {
  /** The table's filtered + sorted submissions — becomes the review queue. */
  queue: TaskSubmission[];
  initialId: string;
  /** The table's active filters, echoed read-only in the queue bar so the
   * reviewer sees the same scope they filtered to. */
  activeFilters?: { label: string; value: string }[];
  /** Back to the table. Reviewed ids + results are handed up so the table can
   * drop them from the pending list. */
  onExit: (reviewed: Record<string, Reviewed>) => void;
}) {
  const [currentId, setCurrentId] = useState(initialId);
  const [queueOpen, setQueueOpen] = useState(true);
  const [viewAttempt, setViewAttempt] = useState<number | null>(null); // 0-based chip; null = current
  const [mediaIndex, setMediaIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitted, setSubmitted] = useState<Record<string, Reviewed>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const sub = queue.find((s) => s.id === currentId) ?? queue[0];

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
    const tag = ((e.target as HTMLElement)?.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input") {
      if (e.key === "Escape") (e.target as HTMLElement).blur();
      return;
    }
    if (e.key >= "1" && e.key <= "9") { if (reviewable) setDraft({ score: +e.key }); }
    else if (e.key === "0") { if (reviewable) setDraft({ score: 10 }); }
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

  /* ── derived display bits ── */
  const submittedCount = Object.keys(submitted).length;
  const pendingCount = queue.length - submittedCount;
  const pos = Math.max(0, queue.findIndex((x) => x.id === sub.id)) + 1;
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
              <div className="rvc-eyebrow">Reviewing</div>
              <div className="rvc-title-row">
                <span className="rvc-title">Hands-On Task Submissions</span>
                <span className="rvc-pending-pill">{pendingCount} pending</span>
              </div>
            </div>
          </div>

          {/* ── queue bar ── */}
          <div className="rvc-queuebar">
            <div className="rvc-queuebar-controls">
              <button className="rvc-chipbtn" onClick={() => setQueueOpen((v) => !v)}>
                {queueOpen ? "Hide queue ▴" : "Show queue ▾"}
              </button>
              {activeFilters.length > 0 ? (
                activeFilters.map((f) => (
                  <span className="rvc-filter-chip is-inherited" key={`${f.label}:${f.value}`}>
                    <span className="rvc-filter-chip-kind">{f.label}:</span>
                    <span className="rvc-filter-chip-label">{f.value}</span>
                  </span>
                ))
              ) : (
                <span className="rvc-allnote">All submissions</span>
              )}
              {!queueOpen && (
                <span className="rvc-upnext">
                  Up next: <span>{nextSub ? `${nextSub.userName} · ${nextSub.taskName}` : "—"}</span>
                </span>
              )}
              <div className="rvc-flex" />
              <span className="rvc-pos">{pos} / {queue.length}</span>
              <div className="rvc-progress">
                <div style={{ width: `${Math.round((pos / Math.max(1, queue.length)) * 100)}%` }} />
              </div>
            </div>

            {queueOpen && (
              <div className="rvc-queue">
                {queue.map((q) => {
                  const sel = q.id === sub.id;
                  const done = !!submitted[q.id];
                  const w = waitInfo(q);
                  return (
                    <button
                      key={q.id}
                      className={`rvc-qcard ${sel ? "is-selected" : ""} ${done ? "is-done" : ""}`}
                      onClick={() => goto(q.id)}
                    >
                      <span className={`rvc-qdot ${done ? "dot-done" : `dot-${w.level}`}`} />
                      <span className="rvc-qname">{q.userName}</span>
                      <span className="rvc-qtask">
                        {q.taskName}
                        {q.versions.length > 1 ? ` · attempt ${q.versions.length}` : ""}
                      </span>
                      <span className={`rvc-qmeta ${done ? "is-done" : ""}`}>
                        {done ? `✓ ${submitted[q.id].score}` : w.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
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
                <span className="rvc-attempts-label">Attempts</span>
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
              <button className="rvc-past-banner-back" onClick={() => { setViewAttempt(null); setMediaIndex(0); }}>
                Back to current ›
              </button>
            </div>
          )}

          {/* ── body ── */}
          <div className="rvc-body">
            {/* left — submission */}
            <div className="rvc-stagecol">
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
                    <button className="rvc-stage-nav rvc-stage-nav--prev" onClick={() => stepMedia(-1)} aria-label="Previous media">‹</button>
                    <button className="rvc-stage-nav rvc-stage-nav--next" onClick={() => stepMedia(1)} aria-label="Next media">›</button>
                  </>
                )}
                <span className="rvc-stage-counter">{mi + 1} / {media.length}</span>
                <button className="rvc-stage-download">Download</button>
              </div>

              <div className="rvc-thumbs">
                {media.map((m, i) => (
                  <button
                    key={i}
                    className={`rvc-thumb ${i === mi ? "is-active" : ""}`}
                    onClick={() => setMediaIndex(i)}
                  >
                    <img src={mediaUrl(m.seed, 200, 140)} alt="" />
                    {m.kind === "video" && <span className="rvc-thumb-play"><PlayGlyph /></span>}
                  </button>
                ))}
                <div className="rvc-flex" />
                <button className="rvc-download-all">Download all ↓</button>
              </div>

              <div className="rvc-desc-block">
                <div className="rvc-desc-label">Project description</div>
                <div className="rvc-desc">{view.description}</div>
              </div>
            </div>

            {/* right — review rail */}
            <div className="rvc-rail">
              {isPast && pastReview ? (
                <>
                  <div className="rvc-rail-past">
                    <div className="rvc-rail-past-head">
                      <span className="rvc-rail-heading">Review — Attempt {attemptIdx + 1} of {attemptCount}</span>
                      <span className="rvc-tagpill">Locked</span>
                    </div>
                    <div className="rvc-rail-past-score">
                      <span className="rvc-rail-past-num">{pastReview.score}/10</span>
                      <span className={`rvc-verdict ${pastReview.score >= PASS_MIN ? "is-pass" : "is-fail"}`}>
                        {pastReview.score >= PASS_MIN ? "PASS" : "BELOW PASS"}
                      </span>
                    </div>
                    <blockquote className="rvc-rail-past-quote">
                      <div className="rvc-rail-past-fb">“{pastReview.feedback}”</div>
                      <div className="rvc-rail-past-by">— {pastReview.reviewer}, SkillCat Admin · {formatDate(pastReview.reviewedOn)}</div>
                    </blockquote>
                    <p className="rvc-rail-past-note">
                      Scores and feedback are locked once submitted. The learner saw this feedback with their result.
                    </p>
                  </div>
                  <button className="rvc-back-current" onClick={() => { setViewAttempt(null); setMediaIndex(0); }}>
                    Back to current attempt ›
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
                  <div>
                    <div className="rvc-rail-row">
                      <span className="rvc-rail-heading">Reviewer checklist</span>
                      <span className="rvc-tagpill">Hidden from user</span>
                    </div>
                    <div className="rvc-checklist-static">
                      <ul>
                        {sub.criteria.map((c) => (
                          <li key={c.id}>{c.label}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rvc-checklist-note">
                      What the task author asks you to look for — reference only.
                    </div>
                  </div>

                  <div className="rvc-rail-section">
                    <div className="rvc-rail-row">
                      <span className="rvc-rail-eyebrow">Score</span>
                      <span className="rvc-passpill">Pass ≥ {PASS_MIN}</span>
                    </div>
                    <div className="rvc-scores">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          className={`rvc-score ${draft.score === n ? "is-selected" : ""} ${n === PASS_MIN ? "rvc-score--passgap" : ""}`}
                          onClick={() => setDraft({ score: n })}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="rvc-score-readout">
                      <span className="rvc-score-text">{hasScore ? `${draft.score} / 10` : "— / 10"}</span>
                      <span className={`rvc-verdict ${hasScore ? (passed ? "is-pass" : "is-fail") : ""}`}>
                        {hasScore ? (passed ? "PASS" : "BELOW PASS") : "NO SCORE"}
                      </span>
                      <div className="rvc-flex" />
                      <span className="rvc-keys-hint">keys 1–0</span>
                    </div>
                  </div>

                  <div className="rvc-rail-section rvc-rail-section--fb">
                    <div className="rvc-desc-label">
                      Feedback to {sub.userName.split(" ")[0]} <span className="rvc-optional">(optional)</span>
                    </div>
                    <textarea
                      className="rvc-feedback"
                      placeholder="One thing done well, one thing to improve…"
                      value={draft.feedback}
                      onChange={(e) => setDraft({ feedback: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── footer ── */}
          <div className="rvc-footer">
            <button className="rvc-skip" onClick={doSkip}>Skip for now</button>
            <div className="rvc-flex" />
            <span className="rvc-shortcuts">1–0 score · ← → media · ⏎ submit · N skip · Q queue</span>
            {isPast ? (
              <>
                <span className="rvc-footer-note">Viewing a past attempt — read-only</span>
                <button className="rvc-submit" onClick={() => { setViewAttempt(null); setMediaIndex(0); }}>
                  Back to current attempt
                </button>
              </>
            ) : reviewable ? (
              <button className={`rvc-submit ${hasScore ? "" : "is-dim"}`} onClick={doSubmit}>
                Submit &amp; next
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
