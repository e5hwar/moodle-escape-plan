import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CheckBoldIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  BulletListIcon,
  NumberListIcon,
  IndentRightIcon,
  IndentLeftIcon,
  LinkSmallIcon,
  ImageIcon,
  SmallXIcon,
  SearchIcon,
  UploadIcon,
} from "./icons";
import { WizardStepRail } from "./WizardStepRail";
import { tasks, type Task } from "../data/tasks";
import {
  masteryUsing,
  type AwardRule,
  type MasterySkill,
  type Skill,
  type SkillStatus,
} from "../data/skills";

/* ─────────────── Shared badge (complete + auto-greyed states) ─────────────── */

const BADGE_EMOJI = ["🔥", "♻️", "🌡️", "📊", "🫧", "📈", "⚡", "🔋", "🔬", "🔧", "🦺", "💨", "🏅", "🎖️", "⚙️", "🛠️", "🧰", "🔌", "🧪", "🪛"];

export function SkillBadge({
  emoji,
  size = 40,
  incomplete = false,
  mastery = false,
}: {
  emoji: string;
  size?: number;
  incomplete?: boolean;
  mastery?: boolean;
}) {
  return (
    <span
      className={`sk-badge ${mastery ? "sk-badge--mastery" : ""} ${incomplete ? "sk-badge--incomplete" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

/* ─────────────── Wizard ─────────────── */

const TASK_KIND: Record<Task["type"], { letter: string; cls: string }> = {
  xAPI: { letter: "X", cls: "xapi" },
  Quiz: { letter: "Q", cls: "quiz" },
  "Hands-On Task": { letter: "H", cls: "handson" },
  "ID Upload": { letter: "ID", cls: "idup" },
  File: { letter: "F", cls: "file" },
  URL: { letter: "U", cls: "url" },
};

function TaskBadge({ type }: { type: Task["type"] }) {
  const k = TASK_KIND[type];
  return <span className={`task-kind-badge ${k.cls}`}>{k.letter}</span>;
}

type Kind = "skill" | "mastery";

type Props = {
  kind: Kind;
  editingSkill?: Skill;
  editingMastery?: MasterySkill;
  allSkills: Skill[];
  allMastery: MasterySkill[];
  onClose: () => void;
  onSaveSkill: (skill: Skill) => void;
  onSaveMastery: (mastery: MasterySkill) => void;
};

type Data = {
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  image: string;
  status: SkillStatus;
  // Skill criteria
  taskIds: string[];
  rule: AwardRule;
  // Mastery criteria
  skillIds: string[];
};

function initialData(p: Props): Data {
  if (p.kind === "skill" && p.editingSkill) {
    const s = p.editingSkill;
    return {
      nameEn: s.name, nameEs: s.nameEs ?? "",
      descEn: s.description ?? "", descEs: s.descriptionEs ?? "",
      image: s.image, status: s.status,
      taskIds: [...s.taskIds], rule: s.rule, skillIds: [],
    };
  }
  if (p.kind === "mastery" && p.editingMastery) {
    const m = p.editingMastery;
    return {
      nameEn: m.name, nameEs: m.nameEs ?? "",
      descEn: m.description ?? "", descEs: m.descriptionEs ?? "",
      image: m.image, status: m.status,
      taskIds: [], rule: "all", skillIds: [...m.skillIds],
    };
  }
  return {
    nameEn: "", nameEs: "", descEn: "", descEs: "",
    image: p.kind === "mastery" ? "🏅" : "🔥",
    status: "Active", taskIds: [], rule: "all", skillIds: [],
  };
}

export function NewSkillWizard(props: Props) {
  const { kind, onClose } = props;
  const isMastery = kind === "mastery";
  const isEditing = !!(props.editingSkill || props.editingMastery);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(() => initialData(props));
  const update = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  const STEPS = isMastery
    ? [
        { label: "Details", sub: "Name, description, image", desc: "Name, describe, and illustrate this Mastery Skill." },
        { label: "Linked Skills", sub: "Skills that compose it", desc: "Choose the Skills that make up this Mastery Skill. It is awarded automatically once a user holds all of them." },
      ]
    : [
        { label: "Details", sub: "Name, description, image", desc: "Name, describe, and illustrate this Skill." },
        { label: "Awarding criteria", sub: "Tasks that award it", desc: "Choose the Task or Tasks whose completion awards this Skill." },
      ];

  const nameValid = data.nameEn.trim().length > 0;
  const criteriaValid = isMastery ? data.skillIds.length > 0 : data.taskIds.length > 0;

  function handleSave() {
    const now = "Apr 28, 2026";
    if (isMastery) {
      const base = props.editingMastery;
      props.onSaveMastery({
        id: base?.id ?? `MS-${String(props.allMastery.length + 1).padStart(2, "0")}`,
        name: data.nameEn.trim(),
        nameEs: data.nameEs.trim() || undefined,
        description: data.descEn.trim() || undefined,
        descriptionEs: data.descEs.trim() || undefined,
        status: data.status,
        image: data.image,
        skillIds: data.skillIds,
        createdBy: base?.createdBy ?? "SkillCat",
        holders: base?.holders ?? 0,
        dateCreated: base?.dateCreated ?? now,
        dateModified: now,
      });
    } else {
      const base = props.editingSkill;
      props.onSaveSkill({
        id: base?.id ?? `SK-${props.allSkills.length + 113}`,
        name: data.nameEn.trim(),
        nameEs: data.nameEs.trim() || undefined,
        description: data.descEn.trim() || undefined,
        descriptionEs: data.descEs.trim() || undefined,
        status: data.status,
        image: data.image,
        taskIds: data.taskIds,
        rule: data.taskIds.length > 1 ? data.rule : "all",
        createdBy: base?.createdBy ?? "SkillCat",
        holders: base?.holders ?? 0,
        dateCreated: base?.dateCreated ?? now,
        dateModified: now,
      });
    }
    onClose();
  }

  return (
    <div className="wizard">
      <div className="wizard-body">
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-mark" />
            <span className="wizard-brand-name">
              {isEditing ? "Edit" : "New"} {isMastery ? "Mastery Skill" : "Skill"}
            </span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((s, i) => {
              const status = i === step ? "active" : i < step ? "done" : "upcoming";
              return (
                <li
                  key={s.label}
                  className={`wizard-step ${status}`}
                  onClick={() => (i === 0 || nameValid ? setStep(i) : undefined)}
                >
                  <WizardStepRail status={status} isLast={i === STEPS.length - 1} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{s.label}</div>
                    <div className="wizard-step-sub">{s.sub}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="wizard-progress">
            Step {step + 1} of {STEPS.length}
          </div>
        </aside>

        <div className="wizard-content">
          <h1 className="wizard-title">{STEPS[step].label}</h1>
          <p className="wizard-desc">{STEPS[step].desc}</p>
          <div className="required-fields-note">* Required Fields</div>

          {step === 0 && (
            <DetailsStep
              data={data}
              update={update}
              isMastery={isMastery}
              editingSkillId={props.editingSkill?.id}
              allMastery={props.allMastery}
            />
          )}
          {step === 1 && !isMastery && <CriteriaStep data={data} update={update} />}
          {step === 1 && isMastery && (
            <LinkedSkillsStep data={data} update={update} allSkills={props.allSkills} />
          )}
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <span className="wizard-saved">
            {isEditing ? "Last saved 2 minutes ago" : "Draft — not saved yet"}
          </span>
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          {step > 0 && (
            <button className="btn-save-draft" onClick={() => setStep(step - 1)}>Back</button>
          )}
          {step === 0 ? (
            <button className="btn-publish" disabled={!nameValid} onClick={() => setStep(1)}>
              Next: {STEPS[1].label}
            </button>
          ) : (
            <button className="btn-publish" disabled={!nameValid || !criteriaValid} onClick={handleSave}>
              {isEditing ? "Save changes" : "Publish"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ─────────────── Step 1 — Details ─────────────── */

function DetailsStep({
  data,
  update,
  isMastery,
  editingSkillId,
  allMastery,
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
  isMastery: boolean;
  editingSkillId?: string;
  allMastery: MasterySkill[];
}) {
  const noun = isMastery ? "Mastery Skill" : "Skill";

  // When archiving a Skill linked to Mastery Skills, warn which become
  // unearnable for new users (spec §11.3.4).
  const linkedMastery =
    !isMastery && editingSkillId ? masteryUsing(editingSkillId, allMastery) : [];
  const showArchiveWarning = data.status === "Archived" && linkedMastery.length > 0;

  return (
    <>
      <div className="form-group">
        <label className="form-label">
          {noun} name <span className="req">*</span>
        </label>
        <LangField
          en={data.nameEn}
          es={data.nameEs}
          onChangeEn={(v) => update({ nameEn: v })}
          onChangeEs={(v) => update({ nameEs: v })}
        />
        <p className="form-help">Shown to learners on their earned-{noun.toLowerCase()} badge. Required in English; Spanish is translated for Spanish-locale learners.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <RichTextField
          en={data.descEn}
          es={data.descEs}
          onChangeEn={(v) => update({ descEn: v })}
          onChangeEs={(v) => update({ descEs: v })}
        />
        <p className="form-help">Optional. Explains what real-world competency this {noun.toLowerCase()} represents.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Image <span className="req">*</span></label>
        <ImagePicker
          emoji={data.image}
          mastery={isMastery}
          onPick={(e) => update({ image: e })}
        />
        <p className="form-help">
          The badge artwork shown to learners. The greyed-out “not yet earned” state is generated automatically — preview both above.
        </p>
      </div>

      <div className="form-divider" />

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Status</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.status === "Active"}
            onSelect={() => update({ status: "Active" })}
            title="Active"
            desc={`Can be earned by users. New ${noun.toLowerCase()}s are awarded retroactively to everyone who already meets the criteria.`}
          />
          <RadioCard
            selected={data.status === "Archived"}
            onSelect={() => update({ status: "Archived" })}
            title="Archived"
            desc={`Cannot be earned by new users. Existing holders keep it. There is no Hidden status — delete and re-create if needed.`}
          />
        </div>

        {showArchiveWarning && (
          <div className="form-warning" style={{ marginTop: 14 }}>
            <span className="form-warning-icon"><WarnIcon /></span>
            <div>
              <strong>Archiving this Skill makes {linkedMastery.length} Mastery Skill{linkedMastery.length === 1 ? "" : "s"} unearnable for new users.</strong>{" "}
              One of their required Skills can no longer be earned. Existing holders are unaffected. Consider removing this Skill from their criteria first:
              <div className="sk-warn-chips">
                {linkedMastery.map((m) => (
                  <span key={m.id} className="sk-chip">
                    <SkillBadge emoji={m.image} size={18} mastery />
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ImagePicker({
  emoji,
  mastery,
  onPick,
}: {
  emoji: string;
  mastery: boolean;
  onPick: (e: string) => void;
}) {
  return (
    <div className="sk-image-picker">
      <div className="sk-image-preview">
        <div className="sk-image-preview-tile">
          <SkillBadge emoji={emoji} size={72} mastery={mastery} />
          <span className="sk-image-preview-label">Earned</span>
        </div>
        <div className="sk-image-preview-tile">
          <SkillBadge emoji={emoji} size={72} mastery={mastery} incomplete />
          <span className="sk-image-preview-label">Not yet earned</span>
        </div>
      </div>
      <div className="sk-image-pick-side">
        <button className="drop-slim"><UploadIcon /> Upload image</button>
        <div className="sk-emoji-grid">
          {BADGE_EMOJI.map((e) => (
            <button
              key={e}
              className={`sk-emoji-opt ${e === emoji ? "is-active" : ""}`}
              onClick={() => onPick(e)}
              aria-label={`Use ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Step 2 — Skill awarding criteria ─────────────── */

function CriteriaStep({ data, update }: { data: Data; update: (p: Partial<Data>) => void }) {
  const selected = data.taskIds;
  const multi = selected.length > 1;

  function toggle(id: string) {
    update({
      taskIds: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    });
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Awarding Tasks <span className="req">*</span>
        </label>
        <p className="form-help" style={{ marginTop: 0 }}>
          Awarding is based on binary Task completion only — a Task counts once it is marked complete per its completion criteria. The same Task can award multiple Skills.
        </p>

        <TaskPicker selected={selected} onToggle={toggle} />
      </div>

      {multi && (
        <div className="form-group">
          <label className="form-label">Awarded when the learner completes…</label>
          <div className="seg-control">
            <button
              type="button"
              className={`seg-btn ${data.rule === "all" ? "active" : ""}`}
              onClick={() => update({ rule: "all" })}
            >
              All of the Tasks
            </button>
            <button
              type="button"
              className={`seg-btn ${data.rule === "any" ? "active" : ""}`}
              onClick={() => update({ rule: "any" })}
            >
              Any one Task
            </button>
          </div>
          <p className="form-help">
            {data.rule === "all"
              ? "The learner must complete every selected Task to earn this Skill."
              : "Completing any one of the selected Tasks earns this Skill."}
          </p>
        </div>
      )}

      <RetroNote noun="Skill" />
    </>
  );
}

function TaskPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = tasks.filter((t) => !t.draft);
    if (!q) return pool;
    return pool.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
    );
  }, [query]);

  const selectedTasks = selected
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t);

  return (
    <div className="sk-picker">
      {selectedTasks.length > 0 && (
        <div className="sk-picker-chosen">
          {selectedTasks.map((t) => (
            <span key={t.id} className="sk-chip sk-chip--removable">
              <TaskBadge type={t.type} />
              {t.name}
              <button className="sk-chip-x" onClick={() => onToggle(t.id)} aria-label={`Remove ${t.name}`}>
                <SmallXIcon />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="sk-picker-search">
        <span className="search-icon"><SearchIcon /></span>
        <input
          className="sk-picker-search-input"
          placeholder="Search Tasks by name or ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="sk-picker-list">
        {filtered.length === 0 ? (
          <div className="sk-picker-empty">No Tasks match “{query}”.</div>
        ) : (
          filtered.slice(0, 60).map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                className={`sk-picker-row ${on ? "is-selected" : ""}`}
                onClick={() => onToggle(t.id)}
              >
                <span className={`checkbox ${on ? "checked" : ""}`}>
                  {on && <CheckBoldIcon />}
                </span>
                <TaskBadge type={t.type} />
                <span className="sk-picker-row-name">{t.name}</span>
                <span className="sk-picker-row-id">{t.id}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─────────────── Step 2 — Mastery linked Skills ─────────────── */

function LinkedSkillsStep({
  data,
  update,
  allSkills,
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
  allSkills: Skill[];
}) {
  const [query, setQuery] = useState("");
  const selected = data.skillIds;

  function toggle(id: string) {
    update({
      skillIds: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSkills;
    return allSkills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    );
  }, [query, allSkills]);

  const chosen = selected
    .map((id) => allSkills.find((s) => s.id === id))
    .filter((s): s is Skill => !!s);
  const archivedChosen = chosen.filter((s) => s.status === "Archived");

  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Linked Skills <span className="req">*</span>
        </label>

        {chosen.length > 0 && (
          <div className="sk-picker-chosen">
            {chosen.map((s) => (
              <span key={s.id} className="sk-chip sk-chip--removable">
                <SkillBadge emoji={s.image} size={18} />
                {s.name}
                {s.status === "Archived" && <span className="sk-chip-tag">Archived</span>}
                <button className="sk-chip-x" onClick={() => toggle(s.id)} aria-label={`Remove ${s.name}`}>
                  <SmallXIcon />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="sk-picker">
          <div className="sk-picker-search">
            <span className="search-icon"><SearchIcon /></span>
            <input
              className="sk-picker-search-input"
              placeholder="Search Skills by name or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="sk-picker-list">
            {filtered.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  className={`sk-picker-row ${on ? "is-selected" : ""}`}
                  onClick={() => toggle(s.id)}
                >
                  <span className={`checkbox ${on ? "checked" : ""}`}>
                    {on && <CheckBoldIcon />}
                  </span>
                  <SkillBadge emoji={s.image} size={22} incomplete={s.status === "Archived"} />
                  <span className="sk-picker-row-name">{s.name}</span>
                  {s.status === "Archived" && <span className="sk-chip-tag">Archived</span>}
                  <span className="sk-picker-row-id">{s.id}</span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="form-help">
          The Mastery Skill is awarded automatically the moment a user holds <strong>all</strong> linked Skills.
        </p>
      </div>

      {archivedChosen.length > 0 && (
        <div className="form-warning">
          <span className="form-warning-icon"><WarnIcon /></span>
          <div>
            <strong>This Mastery Skill includes {archivedChosen.length} archived Skill{archivedChosen.length === 1 ? "" : "s"}.</strong>{" "}
            New users can’t earn an archived Skill, so they won’t be able to earn this Mastery Skill. Existing holders are unaffected.
          </div>
        </div>
      )}

      <RetroNote noun="Mastery Skill" />
    </>
  );
}

/* ─────────────── Shared ─────────────── */

function RetroNote({ noun }: { noun: string }) {
  return (
    <div className="sk-retro-note">
      <span className="sk-retro-icon"><InfoIcon /></span>
      <div>
        <strong>Retroactive on save.</strong> Every user who already meets the criteria receives this {noun} immediately.
        Retroactive awards do <strong>not</strong> fire Rudderstack events (push notifications, email campaigns) — those only
        trigger when a user earns it through real-time Task completion. Updating criteria later never revokes a {noun} already earned.
      </div>
    </div>
  );
}

const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8.4v.01M11 12h1v4h1" />
  </svg>
);

function RadioCard({
  selected,
  onSelect,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  desc?: string;
}) {
  return (
    <button type="button" className={`radio-card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <span className="radio-dot" />
      <div className="radio-card-text">
        <div className="radio-card-title">{title}</div>
        {desc && <div className="radio-card-desc">{desc}</div>}
      </div>
    </button>
  );
}

function LangField({
  en,
  es,
  onChangeEn,
  onChangeEs,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
}) {
  return (
    <div className="lang-field">
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input className="lang-field-input" value={en} onChange={(e) => onChangeEn(e.target.value)} />
      </div>
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <span className="lang-tag">ES</span>
        <input className="lang-field-input" value={es} onChange={(e) => onChangeEs(e.target.value)} />
      </div>
    </div>
  );
}

function RichTextField({
  en,
  es,
  onChangeEn,
  onChangeEs,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
}) {
  const [focus, setFocus] = useState<"en" | "es">("en");
  return (
    <div className="rte-field">
      {focus === "en" && <RteToolbar />}
      <AutoTextarea className="rte-area" value={en} onChange={onChangeEn} onFocus={() => setFocus("en")} />
      <div className="rte-field-divider" />
      {focus === "es" && <RteToolbar />}
      <div className="rte-lang-row">
        <AutoTextarea className="rte-area" value={es} onChange={onChangeEs} onFocus={() => setFocus("es")} />
        <span className="lang-tag floating">ESPAÑOL</span>
      </div>
    </div>
  );
}

function RteToolbar() {
  return (
    <div className="rte-toolbar">
      <button className="rte-btn"><BoldIcon /></button>
      <button className="rte-btn"><ItalicIcon /></button>
      <button className="rte-btn"><UnderlineIcon /></button>
      <span className="rte-sep" />
      <button className="rte-btn"><BulletListIcon /></button>
      <button className="rte-btn"><NumberListIcon /></button>
      <button className="rte-btn"><IndentRightIcon /></button>
      <button className="rte-btn"><IndentLeftIcon /></button>
      <span className="rte-sep" />
      <button className="rte-btn"><LinkSmallIcon /></button>
      <button className="rte-btn"><ImageIcon /></button>
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  className,
  onFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  onFocus?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      rows={1}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
