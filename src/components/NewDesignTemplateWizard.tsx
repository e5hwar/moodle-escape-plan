import { useRef, useState } from "react";
import { UploadIcon } from "./icons";
import { leave, useMaxVisited, useTouchedKeys } from "./fieldFlags";
import { WizardStepRail, useWizardStepStatuses } from "./WizardStepRail";
import { useEdgeLineGate, WizardGateEdges } from "./wizardGate";
import { draftKey, useLeaveGuard } from "./LeaveGuard";
import type { AwardDesignTemplate } from "../data/awards";
import { LimitError } from "./CharCount";
import { LimitedInput } from "./LimitedInput";
import { NAME_MAX, isOver } from "../data/fieldLimits";

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
  // Fields clicked into and out of, and the furthest step opened (fieldFlags.tsx).
  const { touched, touch } = useTouchedKeys();
  const maxVisited = useMaxVisited(step);
  const [data, setData] = useState<Data>(() => initialData(props));
  const update = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  /* The template as it opened (an edit prefills it, so untouched is clean).
     Changed, Cancel stops to ask first (the shared LeaveGuard); Save leaves
     directly. */
  const pristine = useRef(data);
  const dirty = draftKey(data) !== draftKey(pristine.current);
  const guard = useLeaveGuard(dirty, { noun: "Design Template", creating: !isEditing });

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
  /* Soft limit (data/fieldLimits.ts): typing runs on, but a name past it holds
     the step's buttons the way an empty one does. */
  const nameOver = isOver(NAME_MAX, data.name);
  const detailsReady = nameValid && !nameOver && bgValid;
  const nameMissing = !nameValid && (maxVisited > 0 || touched.has("name"));
  const bgMissing = !bgValid && (maxVisited > 0 || touched.has("bg"));
  // Wheel-past-the-edge step navigation, shared with every other wizard.
  const lastStep = STEPS.length - 1;
  // No canGoNext guard: the wheel walks the steps freely, as in every other
  // wizard. Details left incomplete are reported by the rail, not by refusing
  // to scroll.
  const gate = useEdgeLineGate({ step, setStep, lastStep });
  // Rail glyphs: Details passed without a name or background shows the red
  // alert circle rather than a check. Field positioning has nothing mandatory.
  const stepStatuses = useWizardStepStatuses({
    step,
    count: STEPS.length,
    incomplete: (i) => i === 0 && !detailsReady,
  });

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
              <h1 className="tasks-title">{STEPS[step].label}</h1>
              <p className="tasks-subtitle wizard-desc">{STEPS[step].desc}</p>

              {step === 0 && <DetailsStep data={data} update={update} nameMissing={nameMissing} bgMissing={bgMissing} touch={touch} />}
              {step === 1 && <PositioningStep />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={() => guard(onClose)}>Cancel</button>
        </div>
        <div className="wizard-actions">
          {step > 0 && (
            <button className="btn-save-draft wizard-gate-btn" onClick={() => gate.goStep(step - 1)}>
              <span className="wizard-gate-fill" ref={gate.backFillRef} />
              <span className="wizard-gate-btn-inner">Back</span>
            </button>
          )}
          {step === 0 ? (
            <button className="btn-publish wizard-gate-btn" disabled={!detailsReady} onClick={() => gate.goStep(1)}>
              <span className="wizard-gate-fill" ref={gate.nextFillRef} />
              <span className="wizard-gate-btn-inner">Next: {STEPS[1].label}</span>
            </button>
          ) : (
            /* Editing with nothing changed: nothing to save, so it stays off. */
            <button
              className="btn-publish"
              disabled={!detailsReady || (isEditing && !dirty)}
              data-tip={detailsReady && isEditing && !dirty ? "No changes to save" : undefined}
              onClick={handleSave}
            >
              {isEditing ? "Save Changes" : "Create Template"}
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
  nameMissing = false,
  bgMissing = false,
  touch,
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
  nameMissing?: boolean;
  bgMissing?: boolean;
  touch: (key: string) => void;
}) {
  return (
    <>
      <div className="form-group" onBlur={leave(() => touch("name"))}>
        <label className="form-label">
          Template name<span className="req">*</span>
          {nameMissing && <span className="form-label-error">Template name cannot be left empty</span>}
          <LimitError max={NAME_MAX} values={[data.name]} warn={false} />
        </label>
        <LimitedInput
          max={NAME_MAX}
          warn={false}
          className={`form-input${nameMissing ? " has-error" : ""}`}
          aria-invalid={nameMissing || undefined}
          placeholder="e.g. EPA Card — 2026 Brand"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <p className="form-help">Internal name used by admins to find and reuse this template.</p>
      </div>

      <div className="form-group" onBlur={leave(() => touch("bg"))}>
        <label className="form-label">
          Background image<span className="req">*</span>
          {bgMissing && <span className="form-label-error">Background image cannot be left empty</span>}
        </label>
        <div className={`aw-bg-picker${bgMissing ? " has-error" : ""}`}>
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
            <p className="form-help">JPEG or PNG. This is the visual base of the Card or Certificate.</p>
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
