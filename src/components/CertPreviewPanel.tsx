import { useEffect, useMemo, useState } from "react";
import type { Certification } from "../data/certifications";
import { buildCertPreview, type CertPreviewCourse, type CertPreviewTask } from "../data/certPreview";
import { pickTag, pickTags, TRADE_TAGS, PARTNERSHIP_TAGS, USER_TYPE_TAGS } from "../data/filters";
import { IdCardIcon, SmallXIcon } from "./icons";
import type { TaskType } from "../data/tasks";

/* ─────────────── Certification preview side panel ───────────────
 * Opens when a Certification row is clicked. Three tabs:
 *   Details — the basics (industry, stage, type, payment, CEUs…)
 *   Content — the Courses / Lessons / Tasks inside the Certification
 *   More    — additional details (dates, tags, keywords, payment behaviour)
 */

type PanelTab = "details" | "content" | "more";

const BookIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const CaretIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);
const FlagIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

// Same letter badges the Certification wizard tree uses.
const KIND_BADGE: Record<TaskType, { cls: string; label: string }> = {
  xAPI: { cls: "xapi", label: "X" },
  Quiz: { cls: "quiz", label: "Q" },
  "Hands-On Task": { cls: "handson", label: "H" },
  Resource: { cls: "file", label: "R" },
};

export function CertPreviewPanel({ cert, onClose }: { cert: Certification; onClose: () => void }) {
  const [tab, setTab] = useState<PanelTab>("details");
  // Reset to the first tab when the selection moves to another Certification.
  useEffect(() => setTab("details"), [cert.id]);

  const structure = useMemo(() => buildCertPreview(cert), [cert]);

  return (
    <aside className="co-panel">
      <div className="co-panel-head">
        <div className="co-drawer-title-row">
          <div className="co-drawer-avatar"><IdCardIcon /></div>
          <div className="co-drawer-titles">
            <div className="co-drawer-name">{cert.name}</div>
            <div className="co-drawer-id">{cert.id}{cert.type ? ` · ${cert.type}` : ""}</div>
          </div>
        </div>
        <button className="co-drawer-close" aria-label="Close" onClick={onClose}>
          <SmallXIcon />
        </button>
      </div>

      <div className="co-panel-pills">
        <span className="co-pill-muted">{cert.industry}</span>
        {cert.draft ? (
          <span className="co-pill-muted">Draft</span>
        ) : (
          <span className="co-pill-muted">{cert.visibility ?? "Visible"}</span>
        )}
        <span className="co-pill-muted">{cert.createdBy}</span>
      </div>

      <div className="tabbar co-panel-tabs">
        <button className={`tab ${tab === "details" ? "is-active" : ""}`} onClick={() => setTab("details")}>
          Details
        </button>
        <button className={`tab ${tab === "content" ? "is-active" : ""}`} onClick={() => setTab("content")}>
          Content
        </button>
        <button className={`tab ${tab === "more" ? "is-active" : ""}`} onClick={() => setTab("more")}>
          More
        </button>
      </div>

      <div className="co-panel-body">
        {tab === "details" && <DetailsTab cert={cert} />}
        {tab === "content" && <ContentTab structure={structure} />}
        {tab === "more" && <MoreTab cert={cert} />}
      </div>
    </aside>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="co-dt-item">
      <div className="co-dt-label">{label}</div>
      <div className="co-dt-value">{value}</div>
    </div>
  );
}

/* ─────────────── Tab 1: basic details ─────────────── */

function DetailsTab({ cert }: { cert: Certification }) {
  return (
    <div className="co-detail-grid">
      <Detail label="Industry" value={cert.industry} />
      <Detail label="Career stage" value={cert.careerStage ?? "—"} />
      <Detail label="Type" value={cert.type ?? "—"} />
      <Detail
        label="Payment"
        value={
          cert.payment ? (
            <span className={`pay-badge pay-badge--${cert.payment === "Consumable" ? "consumable" : "nonconsumable"}`}>
              {cert.payment}
            </span>
          ) : (
            <span className="pay-badge pay-badge--free">Free</span>
          )
        }
      />
      <Detail label="CEUs" value={cert.ceus} />
      <Detail label="Tasks" value={cert.tasks} />
      <Detail label="Created by" value={cert.createdBy} />
      <Detail label="Status" value={cert.draft ? "Draft" : cert.visibility ?? "Visible"} />
    </div>
  );
}

/* ─────────────── Tab 2: Courses / Lessons / Tasks ─────────────── */

function ContentTab({ structure }: { structure: ReturnType<typeof buildCertPreview> }) {
  return (
    <>
      <div className="certpv-summary">
        {structure.courseCount} Course{structure.courseCount === 1 ? "" : "s"} ·{" "}
        {structure.lessonCount} Lesson{structure.lessonCount === 1 ? "" : "s"} ·{" "}
        {structure.taskCount} Task{structure.taskCount === 1 ? "" : "s"}
      </div>
      <div className="certpv-tree">
        {structure.courses.map((course, i) => (
          <PreviewCourse key={i} course={course} index={i} />
        ))}
      </div>
    </>
  );
}

function PreviewCourse({ course, index }: { course: CertPreviewCourse; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const taskCount = course.children.reduce(
    (n, ch) => n + (ch.kind === "task" ? 1 : ch.lesson.tasks.length),
    0,
  );
  return (
    <div className={`certpv-course ${open ? "open" : ""}`}>
      <button className="certpv-course-head" onClick={() => setOpen((o) => !o)}>
        <span className="certpv-caret"><CaretIcon /></span>
        <span className="certpv-course-name">{course.name}</span>
        <span className="certpv-course-meta">{taskCount} task{taskCount === 1 ? "" : "s"}</span>
      </button>
      {open && (
        <div className="certpv-course-body">
          {course.children.map((ch, i) =>
            ch.kind === "lesson" ? (
              <PreviewLesson key={i} name={ch.lesson.name} tasks={ch.lesson.tasks} />
            ) : (
              <PreviewTask key={i} task={ch.task} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function PreviewLesson({ name, tasks }: { name: string; tasks: CertPreviewTask[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`certpv-lesson ${open ? "open" : ""}`}>
      <button className="certpv-lesson-head" onClick={() => setOpen((o) => !o)}>
        <span className="certpv-caret"><CaretIcon /></span>
        <span className="certpv-lesson-icon"><BookIcon /></span>
        <span className="certpv-lesson-name">{name}</span>
        <span className="certpv-course-meta">{tasks.length} task{tasks.length === 1 ? "" : "s"}</span>
      </button>
      {open && tasks.map((t) => <PreviewTask key={t.id} task={t} indent />)}
    </div>
  );
}

function PreviewTask({ task, indent }: { task: CertPreviewTask; indent?: boolean }) {
  const badge = KIND_BADGE[task.type];
  return (
    <div className={`certpv-task ${indent ? "certpv-task--nested" : ""}`}>
      <span className={`task-kind-badge ${badge.cls}`} title={task.type}>{badge.label}</span>
      <span className="certpv-task-name" title={task.name}>{task.name}</span>
      {task.finalExam && (
        <span className="certpv-final" title="Final Exam"><FlagIcon /></span>
      )}
      <span className="certpv-task-dur">{task.duration}</span>
    </div>
  );
}

/* ─────────────── Tab 3: additional details ─────────────── */

function Chips({ items }: { items: string[] }) {
  return (
    <div className="task-panel-chips">
      {items.map((t) => (
        <span className="task-panel-chip" key={t}>{t}</span>
      ))}
    </div>
  );
}

function MoreTab({ cert }: { cert: Certification }) {
  const tradeTags = pickTags(cert.tags, TRADE_TAGS);
  const partnershipTags = pickTags(cert.tags, PARTNERSHIP_TAGS);
  const userTypeTag = pickTag(cert.tags, USER_TYPE_TAGS);
  return (
    <>
      <div className="co-detail-grid">
        <Detail label="ID" value={cert.id} />
        <Detail label="Visibility" value={cert.visibility ?? "Visible"} />
        <Detail label="Date created" value={cert.dateCreated ?? "—"} />
        <Detail label="Date modified" value={cert.dateModified ?? "—"} />
        {cert.payment === "Consumable" && (
          <Detail label="On consume" value={cert.resetsProgress ? "Resets progress" : "Keeps progress"} />
        )}
      </div>

      <div className="co-section-title" style={{ marginTop: 18, marginBottom: 10 }}>Trade tags</div>
      {tradeTags.length ? <Chips items={tradeTags} /> : <div className="co-dt-value">—</div>}

      <div className="co-section-title" style={{ marginTop: 18, marginBottom: 10 }}>Partnership tags</div>
      {partnershipTags.length ? <Chips items={partnershipTags} /> : <div className="co-dt-value">—</div>}

      <div className="co-section-title" style={{ marginTop: 18, marginBottom: 10 }}>User type</div>
      {userTypeTag ? <Chips items={[userTypeTag]} /> : <div className="co-dt-value">—</div>}

      <div className="co-section-title" style={{ marginTop: 18, marginBottom: 10 }}>Keywords</div>
      {cert.keywords?.length ? <Chips items={cert.keywords} /> : <div className="co-dt-value">—</div>}
    </>
  );
}
