import { useState } from "react";
import { SmallXIcon, ImageIcon } from "./icons";

type Draft = {
  headingEn: string;
  headingEs: string;
  descriptionEn: string;
  descriptionEs: string;
  ctaTextEn: string;
  ctaTextEs: string;
  ctaUrl: string;
  endDate: string;
  imageHint?: string;
};

type Props = {
  onClose: () => void;
  onSubmit: (draft: Draft) => void;
  placeholderPosition: number;
  totalAfter: number;
};

const TODAY = "2026-05-15";
const MAX_END = "2026-11-15"; // 6 months from today

export function CreateSpotlightPanel({
  onClose,
  onSubmit,
  placeholderPosition,
  totalAfter,
}: Props) {
  const [draft, setDraft] = useState<Draft>({
    headingEn: "",
    headingEs: "",
    descriptionEn: "",
    descriptionEs: "",
    ctaTextEn: "",
    ctaTextEs: "",
    ctaUrl: "",
    endDate: "",
    imageHint: undefined,
  });
  const [imageName, setImageName] = useState<string | null>(null);

  function update<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  const ctaRequired = draft.ctaTextEn.trim().length > 0;
  const valid =
    draft.headingEn.trim().length > 0 &&
    draft.endDate.trim().length > 0 &&
    (!ctaRequired || draft.ctaUrl.trim().length > 0);

  function handleSubmit() {
    if (!valid) return;
    onSubmit({ ...draft, imageHint: imageName ?? undefined });
  }

  return (
    <aside className="sp-panel">
      <div className="sp-panel-header">
        <div>
          <div className="sp-panel-eyebrow">NEW SPOTLIGHT</div>
          <h2 className="sp-panel-title">Create a Spotlight</h2>
          <p className="sp-panel-sub">
            Spotlights appear on the app's Home Screen. They must be approved
            before users see them.
          </p>
        </div>
        <button
          className="sp-panel-close"
          aria-label="Close"
          onClick={onClose}
        >
          <SmallXIcon />
        </button>
      </div>

      <div className="sp-panel-body">
        <section className="sp-section">
          <label className="form-label">
            Heading <span className="req">*</span>
          </label>
          <LangPair
            placeholderEn="e.g. New! Plumbing Certifications on SkillCat"
            placeholderEs="Versión en español"
            en={draft.headingEn}
            es={draft.headingEs}
            onEn={(v) => update("headingEn", v)}
            onEs={(v) => update("headingEs", v)}
          />
          <p className="form-help">
            English is required. If Spanish is empty, Spanish-language users
            see the English version.
          </p>
        </section>

        <section className="sp-section">
          <label className="form-label">Description</label>
          <LangPair
            multiline
            placeholderEn="Optional. One or two sentences explaining what the user will see when they tap."
            placeholderEs="Versión en español"
            en={draft.descriptionEn}
            es={draft.descriptionEs}
            onEn={(v) => update("descriptionEn", v)}
            onEs={(v) => update("descriptionEs", v)}
          />
        </section>

        <section className="sp-section">
          <label className="form-label">Call-to-action</label>
          <div className="sp-cta-grid">
            <div>
              <label className="form-sub-label">Button text</label>
              <LangPair
                placeholderEn="e.g. Explore Plumbing"
                placeholderEs="e.g. Explorar Plomería"
                en={draft.ctaTextEn}
                es={draft.ctaTextEs}
                onEn={(v) => update("ctaTextEn", v)}
                onEs={(v) => update("ctaTextEs", v)}
              />
            </div>
            <div>
              <label className="form-sub-label">
                Redirect URL
                {ctaRequired && <span className="req">*</span>}
              </label>
              <input
                className="form-input"
                placeholder="https://… or skillcat://path/to/page"
                value={draft.ctaUrl}
                onChange={(e) => update("ctaUrl", e.target.value)}
              />
              <p className="form-help">
                Standard URL or a Deep Link to a Certification, Task, or app
                page. Leave blank if the Spotlight has no CTA.
              </p>
            </div>
          </div>
        </section>

        <section className="sp-section">
          <label className="form-label">Background image</label>
          {imageName ? (
            <div className="sp-image-row">
              <div className="sp-image-thumb">
                <ImageIcon />
              </div>
              <div className="sp-image-meta">
                <div className="sp-image-name">{imageName}</div>
                <div className="sp-image-sub">
                  Recommended 1200 × 600 px · displayed behind heading & CTA
                </div>
              </div>
              <button
                className="btn-save-draft"
                onClick={() => setImageName(null)}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              className="drop-slim"
              onClick={() => setImageName("upload.jpg")}
            >
              + Upload background image
            </button>
          )}
          <p className="form-help">
            Optional. If empty, the platform default image is used.
          </p>
        </section>

        <section className="sp-section">
          <label className="form-label">
            End date <span className="req">*</span>
          </label>
          <input
            className="form-input sp-date-input"
            type="date"
            min={TODAY}
            max={MAX_END}
            value={draft.endDate}
            onChange={(e) => update("endDate", e.target.value)}
          />
          <p className="form-help">
            The Spotlight is automatically deactivated after this date. Maximum
            duration: 6 months.
          </p>
        </section>

        <section className="sp-section sp-section--position">
          <label className="form-label">Queue position</label>
          <div className="sp-position-card">
            <div className="sp-position-pos">
              <div className="sp-position-pos-num">{placeholderPosition}</div>
              <div className="sp-position-pos-sub">
                of {totalAfter} after approval
              </div>
            </div>
            <div className="sp-position-text">
              <div className="sp-position-title">
                Drag the dashed card on the left to reposition.
              </div>
              <div className="sp-position-desc">
                The Spotlight in position 1 is shown to users first. Approvers
                can adjust this before approving. Positions are relative —
                they're maintained if neighbouring Spotlights are removed.
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="sp-panel-footer">
        <button className="btn-save-draft" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-publish sp-submit"
          onClick={handleSubmit}
          disabled={!valid}
        >
          Submit for approval
        </button>
      </div>
    </aside>
  );
}

function LangPair({
  en,
  es,
  onEn,
  onEs,
  placeholderEn,
  placeholderEs,
  multiline,
}: {
  en: string;
  es: string;
  onEn: (v: string) => void;
  onEs: (v: string) => void;
  placeholderEn: string;
  placeholderEs: string;
  multiline?: boolean;
}) {
  return (
    <div className="lang-field">
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        {multiline ? (
          <textarea
            className="lang-field-input sp-multiline"
            placeholder={placeholderEn}
            value={en}
            onChange={(e) => onEn(e.target.value)}
            rows={3}
          />
        ) : (
          <input
            className="lang-field-input"
            placeholder={placeholderEn}
            value={en}
            onChange={(e) => onEn(e.target.value)}
          />
        )}
      </div>
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <span className="lang-tag">ES</span>
        {multiline ? (
          <textarea
            className="lang-field-input sp-multiline"
            placeholder={placeholderEs}
            value={es}
            onChange={(e) => onEs(e.target.value)}
            rows={3}
          />
        ) : (
          <input
            className="lang-field-input"
            placeholder={placeholderEs}
            value={es}
            onChange={(e) => onEs(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
