import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CheckBoldIcon,
  SmallXIcon,
  SearchIcon,
  UploadIcon,
} from "./icons";
import { RteToolbar } from "./RteToolbar";
import { WizardStepRail } from "./WizardStepRail";
import { tasks, type Task } from "../data/tasks";
import {
  type AwardRule,
  type MasterySkill,
  type Skill,
  type SkillStatus,
} from "../data/skills";

/* ─────────────── Shared badge (complete + auto-greyed states) ─────────────── */

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
            <span className="wizard-brand-eyebrow">
              {isEditing ? "Editing" : "Creating"}
            </span>
            <span className="wizard-brand-name">
              {isEditing
                ? props.editingSkill?.name ?? props.editingMastery?.name
                : isMastery
                  ? "New Mastery Skill"
                  : "New Skill"}
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
                  <WizardStepRail status={status} num={i + 1} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{s.label}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="wizard-content">
          <h1 className="wizard-title">{STEPS[step].label}</h1>
          <p className="wizard-desc">{STEPS[step].desc}</p>

          {step === 0 && (
            <DetailsStep data={data} update={update} isMastery={isMastery} />
          )}
          {step === 1 && !isMastery && <CriteriaStep data={data} update={update} />}
          {step === 1 && isMastery && (
            <LinkedSkillsStep data={data} update={update} allSkills={props.allSkills} />
          )}
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          {isEditing && (
            <span className="wizard-saved">Last saved 2 minutes ago</span>
          )}
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
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
  isMastery: boolean;
}) {
  const noun = isMastery ? "Mastery Skill" : "Skill";

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
          placeholderEn={`${noun} name`}
          placeholderEs={isMastery ? "Nombre de la habilidad de maestría" : "Nombre de la habilidad"}
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
        <ImagePicker />
        <p className="form-help">
          The badge artwork shown to learners on their earned-{noun.toLowerCase()} badge.
        </p>
      </div>
    </>
  );
}

function ImagePicker() {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="sk-image-picker">
      <div className="sk-image-pick-side">
        <button
          type="button"
          className={`sk-image-dropzone ${dragging ? "is-dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
        >
          <UploadIcon />
          <span className="sk-image-dropzone-title">
            Drag &amp; drop an image, or click to browse
          </span>
          <span className="sk-image-dropzone-hint">PNG, JPG or SVG · up to 2&nbsp;MB</span>
          <input ref={inputRef} type="file" accept="image/*" hidden />
        </button>
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
        <TaskPicker selected={selected} onToggle={toggle} />
        <p className="form-help">
          Awarding is based on binary Task completion only — a Task counts once it is marked complete per its completion criteria. The same Task can award multiple Skills.
        </p>
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
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return [];
    const pool = tasks.filter((t) => !t.draft);
    return pool.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
    );
  }, [q]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selectedTasks = selected
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t);

  const showList = open && !!q;

  return (
    <div className="sk-picker-wrap">
      {selectedTasks.length > 0 && (
        <div className="sk-picker-cards">
          {selectedTasks.map((t) => (
            <div key={t.id} className="sk-card">
              <div className="sk-card-main">
                <span className="sk-card-name">{t.name}</span>
                <span className="sk-card-meta">{t.type} · {t.id}</span>
              </div>
              <button className="sk-card-x" onClick={() => onToggle(t.id)} aria-label={`Remove ${t.name}`}>
                <SmallXIcon />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`sk-picker ${showList ? "is-open" : ""}`} ref={pickerRef}>
        <div className="sk-picker-search">
          <span className="search-icon"><SearchIcon /></span>
          <input
            className="sk-picker-search-input"
            placeholder="Search Tasks by name or ID…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          />
        </div>
        {showList && (
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
                    <span className="sk-picker-row-name">{t.name}</span>
                    <span className="sk-picker-row-type">· {t.type}</span>
                    <span className="sk-picker-row-id">{t.id}</span>
                  </button>
                );
              })
            )}
          </div>
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
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

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
          <div className="sk-picker-cards">
            {chosen.map((s) => (
              <div key={s.id} className="sk-card">
                <SkillBadge emoji={s.image} size={30} />
                <div className="sk-card-main">
                  <span className="sk-card-name">
                    {s.name}
                    {s.status === "Archived" && <span className="sk-chip-tag">Archived</span>}
                  </span>
                  <span className="sk-card-meta">{s.id}</span>
                </div>
                <button className="sk-card-x" onClick={() => toggle(s.id)} aria-label={`Remove ${s.name}`}>
                  <SmallXIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`sk-picker ${open ? "is-open" : ""}`} ref={pickerRef}>
          <div className="sk-picker-search">
            <span className="search-icon"><SearchIcon /></span>
            <input
              className="sk-picker-search-input"
              placeholder="Search Skills by name or ID…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
            />
          </div>
          {open && (
            <div className="sk-picker-list">
              {filtered.length === 0 ? (
                <div className="sk-picker-empty">No Skills match “{query}”.</div>
              ) : (
                filtered.map((s) => {
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
                })
              )}
            </div>
          )}
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

function LangField({
  en,
  es,
  onChangeEn,
  onChangeEs,
  placeholderEn,
  placeholderEs,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
}) {
  return (
    <div className="lang-field">
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input className="lang-field-input" value={en} placeholder={placeholderEn} onChange={(e) => onChangeEn(e.target.value)} />
      </div>
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <span className="lang-tag">ES</span>
        <input className="lang-field-input" value={es} placeholder={placeholderEs} onChange={(e) => onChangeEs(e.target.value)} />
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
  return (
    <div className="rte-field">
      <RteToolbar />
      <div className="rte-lang-row">
        <span className="lang-tag">EN</span>
        <AutoTextarea className="rte-area" value={en} onChange={onChangeEn} />
      </div>
      <div className="rte-field-divider" />
      <div className="rte-lang-row">
        <span className="lang-tag">ES</span>
        <AutoTextarea className="rte-area" value={es} onChange={onChangeEs} />
      </div>
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
