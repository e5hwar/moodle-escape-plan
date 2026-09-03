import { useMemo, useState } from "react";
import { CheckBoldIcon, SearchIcon, CheckIcon } from "./icons";
import { WizardStepRail, useWizardStepStatuses } from "./WizardStepRail";
import { useEdgeLineGate, WizardGateEdges } from "./wizardGate";
import { certifications } from "../data/certifications";
import {
  MERIT_TIERS,
  MERIT_HEX,
  MERIT_INTENT,
  certIdsWithAward,
  certName,
  type Award,
  type AwardDesignTemplate,
  type AwardStatus,
  type MeritTier,
} from "../data/awards";

type Props = {
  editingAward?: Award;
  allAwards: Award[];
  templates: AwardDesignTemplate[];
  onClose: () => void;
  onSave: (award: Award) => void;
  /** Jump to the Design Templates tab to build a new template. */
  onCreateTemplate?: () => void;
};

type Data = {
  certificationId: string;
  meritTier: MeritTier;
  cardTemplateId?: string;
  certificateTemplateId?: string;
  status: AwardStatus;
};

function initialData(p: Props): Data {
  if (p.editingAward) {
    const a = p.editingAward;
    return {
      certificationId: a.certificationId,
      meritTier: a.meritTier,
      cardTemplateId: a.cardTemplateId,
      certificateTemplateId: a.certificateTemplateId,
      status: a.status,
    };
  }
  return { certificationId: "", meritTier: "Bronze", status: "Active" };
}

export function NewAwardWizard(props: Props) {
  const { onClose } = props;
  const isEditing = !!props.editingAward;
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(() => initialData(props));
  const update = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  const STEPS = [
    {
      label: "Certification & Tier",
      sub: "Link a Certification, set Merit Tier",
      desc: "Link this Award to the Certification that triggers it, and set its Merit Tier. Completing the Certification issues this Award.",
    },
    {
      label: "Appearances",
      sub: "Card and/or Certificate design",
      desc: "Choose an Award Design Template for the Card and, optionally, the Certificate. The shared QR code and Unique Award Number appear on both.",
    },
  ];

  const certValid = data.certificationId.trim().length > 0;
  // Every Award should display a Card on the Portfolio; require at least one appearance.
  const appearanceValid = !!data.cardTemplateId || !!data.certificateTemplateId;
  // Wheel-past-the-edge step navigation, shared with every other wizard.
  const lastStep = STEPS.length - 1;
  const gate = useEdgeLineGate({ step, setStep, lastStep });
  // Rail glyphs: a step passed without its mandatory choice made shows the red
  // alert circle rather than a check.
  const stepStatuses = useWizardStepStatuses({
    step,
    count: STEPS.length,
    incomplete: (i) => (i === 0 ? !certValid : !appearanceValid),
  });

  function handleSave() {
    const now = "Apr 28, 2026";
    const base = props.editingAward;
    props.onSave({
      id: base?.id ?? `AW-${props.allAwards.length + 101}`,
      certificationId: data.certificationId,
      meritTier: data.meritTier,
      cardTemplateId: data.cardTemplateId,
      certificateTemplateId: data.certificateTemplateId,
      status: data.status,
      createdBy: base?.createdBy ?? "SkillCat",
      holders: base?.holders ?? 0,
      dateCreated: base?.dateCreated ?? now,
      dateModified: now,
    });
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
              {props.editingAward ? certName(props.editingAward) : "New Award"}
            </span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((s, i) => {
              const status = stepStatuses[i];
              return (
                <li
                  key={s.label}
                  className={`wizard-step ${status}`}
                  onClick={() => gate.goStep(i)}
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

        <div className="wizard-main">
          <WizardGateEdges
            gate={gate}
            step={step}
            lastStep={lastStep}
            labels={STEPS.map((s) => s.label)}
          />
          <div className="wizard-content" ref={gate.scrollRef}>
            <div className="wizard-paneout" ref={gate.paneOutRef}>
              <div className="wizard-pane" key={step}>
              <h1 className="wizard-title">{STEPS[step].label}</h1>
              <p className="wizard-desc">{STEPS[step].desc}</p>

              {step === 0 && (
                <LinkStep
                  data={data}
                  update={update}
                  editingAwardId={props.editingAward?.id}
                  allAwards={props.allAwards}
                />
              )}
              {step === 1 && (
                <AppearanceStep
                  data={data}
                  update={update}
                  templates={props.templates}
                  onCreateTemplate={props.onCreateTemplate}
                />
              )}
              </div>
            </div>
          </div>
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
            <button className="btn-save-draft wizard-gate-btn" onClick={() => gate.goStep(step - 1)}>
              <span className="wizard-gate-fill" ref={gate.backFillRef} />
              <span className="wizard-gate-btn-inner">Back</span>
            </button>
          )}
          {step === 0 ? (
            <button className="btn-publish wizard-gate-btn" onClick={() => gate.goStep(1)}>
              <span className="wizard-gate-fill" ref={gate.nextFillRef} />
              <span className="wizard-gate-btn-inner">Next: {STEPS[1].label}</span>
            </button>
          ) : (
            <button
              className="btn-publish"
              disabled={!certValid || !appearanceValid}
              onClick={handleSave}
            >
              {isEditing ? "Save changes" : "Create Award"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ─────────────── Step 1 — Certification & Merit Tier ─────────────── */

function LinkStep({
  data,
  update,
  editingAwardId,
  allAwards,
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
  editingAwardId?: string;
  allAwards: Award[];
}) {
  const [query, setQuery] = useState("");
  // One Award per Certification — those that already have one aren't eligible.
  const taken = useMemo(
    () => certIdsWithAward(allAwards, editingAwardId),
    [allAwards, editingAwardId],
  );

  // Only Certifications without an Award are linkable, so only those appear here.
  // The one being edited stays eligible (it's excluded from `taken` above).
  const eligible = useMemo(
    () =>
      certifications
        .filter((c) => !c.draft && !taken.has(c.id))
        .sort(
          (a, b) =>
            new Date(b.dateCreated ?? 0).getTime() -
            new Date(a.dateCreated ?? 0).getTime(),
        ),
    [taken],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q)
      return eligible.filter(
        (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
      );
    // Empty search: the 3 most recently created eligible Certifications, plus the
    // one currently linked (when editing) so it stays visible even if older.
    const top = eligible.slice(0, 3);
    const selected = eligible.find((c) => c.id === data.certificationId);
    if (selected && !top.includes(selected)) top.push(selected);
    return top;
  }, [query, eligible, data.certificationId]);

  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Linked Certification <span className="req">*</span>
        </label>
        <div className="sk-picker">
          <div className="sk-picker-search">
            <span className="search-icon"><SearchIcon /></span>
            <input
              className="sk-picker-search-input"
              placeholder="Search Certifications by name or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {!query.trim() && filtered.length > 0 && (
            <div className="sk-picker-note">
              Showing the {filtered.length} most recently created — search to find others.
            </div>
          )}
          <div className="sk-picker-list">
            {filtered.length === 0 ? (
              <div className="sk-picker-empty">
                {query.trim()
                  ? `No Certifications without an Award match “${query}”.`
                  : "Every Certification already has an Award."}
              </div>
            ) : (
              filtered.map((c) => {
                const on = data.certificationId === c.id;
                return (
                  <button
                    key={c.id}
                    className={`sk-picker-row ${on ? "is-selected" : ""}`}
                    onClick={() => update({ certificationId: c.id })}
                  >
                    <span className={`aw-radio ${on ? "checked" : ""}`}>
                      {on && <CheckBoldIcon />}
                    </span>
                    <span className="sk-picker-row-name">{c.name}</span>
                    <span className="aw-cert-industry">{c.industry}</span>
                    <span className="sk-picker-row-id">{c.id}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <p className="form-help">
          Only Certifications without an Award are shown — a Certification can have at most one.
          Completing it issues the Award; users who already completed it receive it retroactively
          on save.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Merit Tier <span className="req">*</span></label>
        <div className="aw-tier-grid">
          {MERIT_TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              className={`aw-tier-card ${data.meritTier === tier ? "selected" : ""}`}
              onClick={() => update({ meritTier: tier })}
              style={{ "--tier": MERIT_HEX[tier] } as React.CSSProperties}
            >
              <span className="aw-tier-dot" />
              <span className="aw-tier-name">{tier}</span>
              <span className="aw-tier-intent">{MERIT_INTENT[tier]}</span>
            </button>
          ))}
        </div>
        <p className="form-help">
          Tiers are fixed and control where the Award sits in the user’s Portfolio —
          Platinum at the top, Bronze at the bottom.
        </p>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Status</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.status === "Active"}
            onSelect={() => update({ status: "Active" })}
            title="Active"
            desc="Issued to anyone who completes the Certification. Users who already completed it receive it retroactively."
          />
          <RadioCard
            selected={data.status === "Archived"}
            onSelect={() => update({ status: "Archived" })}
            title="Archived"
            desc="Stops being issued to new users. Existing holders keep it."
          />
        </div>
      </div>
    </>
  );
}

/* ─────────────── Step 2 — Card / Certificate appearances ─────────────── */

function AppearanceStep({
  data,
  update,
  templates,
  onCreateTemplate,
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
  templates: AwardDesignTemplate[];
  onCreateTemplate?: () => void;
}) {
  return (
    <>
      <AppearanceSlot
        title="Card"
        required
        hint="Compact visual shown on the user’s Portfolio. Recommended for every Award."
        templates={templates}
        selectedId={data.cardTemplateId}
        onSelect={(id) => update({ cardTemplateId: id })}
        onCreateTemplate={onCreateTemplate}
      />

      <AppearanceSlot
        title="Certificate"
        hint="Detailed document for printing, PDF export, and formal verification (e.g. Trade School diplomas). Optional."
        templates={templates}
        selectedId={data.certificateTemplateId}
        onSelect={(id) => update({ certificateTemplateId: id })}
        onCreateTemplate={onCreateTemplate}
      />

      <div className="sk-retro-note">
        <span className="sk-retro-icon"><InfoIcon /></span>
        <div>
          <strong>Shared identity.</strong> The QR code and Unique Award Number are minted per
          user on issuance and are the same across the Card and Certificate. The user’s name and
          Certification name are never frozen — they always reflect the current values. Adding or
          removing an appearance takes effect immediately for all issued instances.
        </div>
      </div>
    </>
  );
}

function AppearanceSlot({
  title,
  hint,
  required = false,
  templates,
  selectedId,
  onSelect,
  onCreateTemplate,
}: {
  title: string;
  hint: string;
  required?: boolean;
  templates: AwardDesignTemplate[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onCreateTemplate?: () => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label">
        {title} design {required && <span className="req">*</span>}
      </label>
      <div className="aw-template-pick">
        <button
          type="button"
          className={`aw-template-opt aw-template-none ${!selectedId ? "selected" : ""}`}
          onClick={() => onSelect(undefined)}
        >
          <div className="aw-template-none-box">None</div>
          <span className="aw-template-opt-name">No {title.toLowerCase()}</span>
        </button>
        {templates.map((t) => {
          const on = selectedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`aw-template-opt ${on ? "selected" : ""}`}
              onClick={() => onSelect(t.id)}
            >
              <div className="aw-template-thumb" style={{ background: t.swatch }}>
                {on && <span className="aw-template-check"><CheckIcon /></span>}
              </div>
              <span className="aw-template-opt-name">{t.name}</span>
            </button>
          );
        })}
      </div>
      <p className="form-help">{hint}</p>
      {onCreateTemplate && (
        <button className="aw-link-btn" onClick={onCreateTemplate} type="button">
          + Create a new Design Template
        </button>
      )}
    </div>
  );
}

/* ─────────────── Shared ─────────────── */

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

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8.4v.01M11 12h1v4h1" />
  </svg>
);
