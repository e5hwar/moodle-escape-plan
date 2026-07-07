import { useState } from "react";
import { UploadIcon } from "./icons";
import { WizardStepRail } from "./WizardStepRail";
import type { AwardDesignTemplate } from "../data/awards";

type Props = {
  editingTemplate?: AwardDesignTemplate;
  allTemplates: AwardDesignTemplate[];
  onClose: () => void;
  onSave: (template: AwardDesignTemplate) => void;
};

type Data = {
  name: string;
  background: string;
  swatch: string;
};

const SWATCHES = [
  "linear-gradient(135deg, #0e3a3a 0%, #0a1f1f 100%)",
  "linear-gradient(135deg, #11302f 0%, #0c1a19 60%, #1a2a14 100%)",
  "linear-gradient(135deg, #2a2a2f 0%, #131315 100%)",
  "linear-gradient(135deg, #2e2412 0%, #161009 100%)",
  "linear-gradient(135deg, #1c2740 0%, #0c1320 100%)",
  "linear-gradient(135deg, #3a2a2a 0%, #1a1212 100%)",
];

function initialData(p: Props): Data {
  if (p.editingTemplate) {
    const t = p.editingTemplate;
    return { name: t.name, background: t.background, swatch: t.swatch };
  }
  return { name: "", background: "", swatch: SWATCHES[2] };
}

export function NewDesignTemplateWizard(props: Props) {
  const { onClose } = props;
  const isEditing = !!props.editingTemplate;
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(() => initialData(props));
  const update = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  const STEPS = [
    {
      label: "Details",
      sub: "Name and background image",
      desc: "Name this Design Template and upload the background image. The name is internal — only admins see it.",
    },
    {
      label: "Field positioning",
      sub: "Place the dynamic fields",
      desc: "Position the dynamic fields — User’s Name, Certification Name, Date, Unique Award Number, and QR Code — on top of the background.",
    },
  ];

  const nameValid = data.name.trim().length > 0;
  const bgValid = data.background.trim().length > 0;

  function handleSave() {
    const now = "Apr 28, 2026";
    const base = props.editingTemplate;
    props.onSave({
      id: base?.id ?? `DT-${String(props.allTemplates.length + 1).padStart(2, "0")}`,
      name: data.name.trim(),
      background: data.background.trim() || "background.png",
      swatch: data.swatch,
      createdBy: base?.createdBy ?? "SkillCat",
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
              {props.editingTemplate ? props.editingTemplate.name : "New Design Template"}
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
        </aside>

        <div className="wizard-content">
          <h1 className="wizard-title">{STEPS[step].label}</h1>
          <p className="wizard-desc">{STEPS[step].desc}</p>

          {step === 0 && <DetailsStep data={data} update={update} />}
          {step === 1 && <PositioningStep />}
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
            <button className="btn-publish" disabled={!nameValid || !bgValid} onClick={() => setStep(1)}>
              Next: {STEPS[1].label}
            </button>
          ) : (
            <button className="btn-publish" disabled={!nameValid || !bgValid} onClick={handleSave}>
              {isEditing ? "Save changes" : "Create Template"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ─────────────── Step 1 — Details ─────────────── */

function DetailsStep({ data, update }: { data: Data; update: (p: Partial<Data>) => void }) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">Template name <span className="req">*</span></label>
        <input
          className="form-input"
          placeholder="e.g. EPA Card — 2026 Brand"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <p className="form-help">Internal name used by admins to find and reuse this template.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Background image <span className="req">*</span></label>
        <div className="aw-bg-picker">
          <div className="aw-bg-preview" style={{ background: data.swatch }}>
            {data.background ? (
              <span className="aw-bg-filename">{data.background}</span>
            ) : (
              <span className="aw-bg-empty">No image uploaded</span>
            )}
          </div>
          <div className="aw-bg-side">
            <button
              className="drop-slim"
              onClick={() => update({ background: data.background || "background.png" })}
            >
              <UploadIcon /> Upload image
            </button>
            <p className="form-help" style={{ marginTop: 4 }}>JPEG or PNG. This is the visual base of the Card or Certificate.</p>
            <div className="aw-swatch-row">
              {SWATCHES.map((sw) => (
                <button
                  key={sw}
                  className={`aw-swatch ${data.swatch === sw ? "is-active" : ""}`}
                  style={{ background: sw }}
                  onClick={() => update({ swatch: sw })}
                  aria-label="Pick background"
                />
              ))}
            </div>
          </div>
        </div>
        <p className="form-help">
          Editing a template updates every Award that uses it — both Cards and Certificates,
          including already-issued instances.
        </p>
      </div>
    </>
  );
}

/* ─────────────── Step 2 — Field positioning (not built yet) ─────────────── */

function PositioningStep() {
  return (
    <div className="co-empty-state" style={{ minHeight: 360 }}>
      <div className="co-empty-glyph">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
          <rect x="6.5" y="12" width="6" height="2.4" rx="0.6" />
          <rect x="6.5" y="16" width="9" height="1.6" rx="0.6" />
          <circle cx="17.5" cy="15.5" r="2.2" />
        </svg>
      </div>
      <div className="co-empty-title">Field positioning isn’t built yet</div>
      <div className="co-empty-sub" style={{ maxWidth: 460 }}>
        This is where you’ll place the dynamic fields — User’s Name, Certification Name, Date,
        Unique Award Number, and QR Code — on top of the background. The editor approach is still
        being decided. You can save the template now and position fields later.
      </div>
    </div>
  );
}
