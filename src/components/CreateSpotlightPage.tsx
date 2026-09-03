import { useEffect, useRef, useState } from "react";
import { CloseXIcon, SmallXIcon, UploadTrayIcon } from "./icons";
import defaultSpotlightBg from "../assets/spotlight-default-bg.png";
import { formatShortDate } from "../formatDate";
import type { Spotlight } from "../data/spotlights";
import { DateField, type DateShortcut } from "./DateField";

export type SpotlightDraft = {
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
  onSubmit: (draft: SpotlightDraft) => void;
  /** Editing an existing Spotlight rather than creating one: the fields start
   *  from it and saving writes back over it in place. */
  editing?: Spotlight;
  /** That edit is an archived Spotlight being switched back on. Same form, but
   *  its end date has already been and gone, so the field starts empty and a
   *  fresh one — inside the create window — has to be picked. */
  enabling?: boolean;
  /** Coming back from the queue-placement step via "Continue Editing": seeds
   *  the fields the same way, but this is still a create. */
  resuming?: Spotlight;
};

/* End-date bounds, derived from today so the picker, its shortcuts, and the
   validation all agree: the earliest end date is tomorrow, the latest is 6
   months out. */
const TODAY = startOfToday();
const MIN_END = toISO(addDays(TODAY, 1));
const MAX_END = toISO(addMonths(TODAY, 6));

/* Duration presets in the picker's Shortcuts panel (Figma 552:1520), each
   resolved from today. */
const END_DATE_SHORTCUTS: DateShortcut[] = [
  { label: "1 Week", value: toISO(addDays(TODAY, 7)) },
  { label: "2 Weeks", value: toISO(addDays(TODAY, 14)) },
  { label: "1 Month", value: toISO(addMonths(TODAY, 1)) },
  { label: "3 Months", value: toISO(addMonths(TODAY, 3)) },
];

/* The uploaded background, kept as an object URL so the preview shows the real
   image the admin picked. */
type PickedImage = { name: string; size: number; url: string };

export function CreateSpotlightPage({ onClose, onSubmit, editing, enabling, resuming }: Props) {
  // Both paths seed the same fields; only `editing` changes the page's copy and
  // what saving does.
  const seed = editing ?? resuming;
  const [headingEn, setHeadingEn] = useState(seed?.headingEn ?? "");
  const [headingEs, setHeadingEs] = useState(seed?.headingEs ?? "");
  const [descriptionEn, setDescriptionEn] = useState(seed?.descriptionEn ?? "");
  const [descriptionEs, setDescriptionEs] = useState(seed?.descriptionEs ?? "");
  // The re-direct button is opt-in; its name and destination only apply (and
  // only show) once it is enabled.
  const [ctaEnabled, setCtaEnabled] = useState(Boolean(seed?.ctaTextEn || seed?.ctaUrl));
  const [ctaTextEn, setCtaTextEn] = useState(seed?.ctaTextEn ?? "");
  const [ctaTextEs, setCtaTextEs] = useState(seed?.ctaTextEs ?? "");
  const [ctaUrl, setCtaUrl] = useState(seed?.ctaUrl ?? "");
  const [endDate, setEndDate] = useState(enabling ? "" : seed?.endDate ?? "");
  const [image, setImage] = useState<PickedImage | null>(null);

  // Only revoke on unmount / replacement, never on every render.
  const imageUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
  }, []);

  function pickImage(file: File) {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    const url = URL.createObjectURL(file);
    imageUrlRef.current = url;
    setImage({ name: file.name, size: file.size, url });
  }

  function clearImage() {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = null;
    setImage(null);
  }

  // Ordered top-to-bottom to match the form, so the disabled CTA's tooltip
  // always names the first thing to fix as the admin scans down the page.
  const checks: { valid: boolean; message: string }[] = [
    { valid: headingEn.trim().length > 0, message: "Add an English title to continue." },
    ...(ctaEnabled
      ? [
          { valid: ctaTextEn.trim().length > 0, message: "Add an English button name." },
          { valid: ctaUrl.trim().length > 0, message: "Add a button destination." },
        ]
      : []),
    { valid: endDate.trim().length > 0, message: "Set an end date to continue." },
    /* An existing Spotlight's date may already sit outside the create window
       (it was set months ago); only a CHANGED date has to fall inside it. An
       enable is always a change — the old date is exactly what expired. */
    { valid: !endDate || (!enabling && endDate === seed?.endDate) || (endDate >= MIN_END && endDate <= MAX_END), message: `End date must be between ${formatShortDate(MIN_END)} and ${formatShortDate(MAX_END)}.` },
  ];
  const valid = checks.every((c) => c.valid);
  const ctaTooltip = checks.find((c) => !c.valid)?.message ?? "";

  function handleSubmit() {
    onSubmit(
      {
        headingEn,
        headingEs,
        descriptionEn,
        descriptionEs,
        // A disabled re-direct button carries no name or destination, whatever
        // was typed before it was switched off.
        ctaTextEn: ctaEnabled ? ctaTextEn : "",
        ctaTextEs: ctaEnabled ? ctaTextEs : "",
        ctaUrl: ctaEnabled ? ctaUrl : "",
        endDate,
        imageHint: image?.name,
      },
    );
  }

  return (
    <div className="wizard spc-page">
      <div className="wizard-body">
        <div className="wizard-content spc-form">
          <h1 className="wizard-title">
            {enabling ? "Enable Spotlight" : editing ? "Edit Spotlight" : "Create Spotlight"}
          </h1>
          <p className="wizard-desc">
            {enabling
              ? "Set a new end date to put this Spotlight back on the SkillCat Home Page."
              : editing
                ? "Shown on the SkillCat Home Page. It keeps its place in the queue."
                : "Shown on the SkillCat Home Page. You'll place it in the queue next."}
          </p>

          <div className="form-group">
            <label className="form-label">
              Title <span className="req">*</span>
            </label>
            <LangField
              en={headingEn}
              es={headingEs}
              onEn={setHeadingEn}
              onEs={setHeadingEs}
              placeholderEn="Title"
              placeholderEs="Título"
            />
            <p className="form-help">
              English is required. If Spanish is empty, Spanish-language users
              see the English version.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <LangField
              multiline
              en={descriptionEn}
              es={descriptionEs}
              onEn={setDescriptionEn}
              onEs={setDescriptionEs}
              placeholderEn="Description"
              placeholderEs="Descripción"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Background Image</label>
            {image ? (
              <div className="file-row spc-file-row">
                <span className="spc-file-thumb">
                  <img src={image.url} alt="" />
                </span>
                <div className="file-meta">
                  <div className="file-name">{image.name}</div>
                  <div className="file-sub">{formatSize(image.size)}</div>
                </div>
                <button
                  className="file-remove"
                  aria-label="Remove background image"
                  onClick={clearImage}
                >
                  <SmallXIcon />
                </button>
              </div>
            ) : (
              <ImagePicker onPick={pickImage}>
                {(open) => (
                  <button
                    className="drop-big drop-big--tall"
                    type="button"
                    onClick={open}
                  >
                    <span className="drop-big-icon">
                      <UploadTrayIcon />
                    </span>
                    <div className="drop-big-title">
                      Drag and drop, or click to upload
                    </div>
                    <div className="drop-big-hint">
                      <div>Accepted File Types: JPEG, PNG, HEIC, HEIF</div>
                      <div>Maximum File Size: 20MB</div>
                    </div>
                  </button>
                )}
              </ImagePicker>
            )}
            <p className="form-help">
              If blank, the default image for Spotlights is used (Shown on the
              Preview)
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Add Re-Direct Button to Spotlight</label>
            <div className="seg-control">
              <button
                className={`seg-btn${ctaEnabled ? "" : " active"}`}
                onClick={() => setCtaEnabled(false)}
              >
                Disabled
              </button>
              <button
                className={`seg-btn${ctaEnabled ? " active" : ""}`}
                onClick={() => setCtaEnabled(true)}
              >
                Enabled
              </button>
            </div>
            <p className="form-help">
              Enable to set the button's name and where it redirects the user
              when clicked.
            </p>
          </div>

          {ctaEnabled && (
            <>
              <div className="form-group">
                <label className="form-label">
                  Button Name <span className="req">*</span>
                </label>
                <LangField
                  en={ctaTextEn}
                  es={ctaTextEs}
                  onEn={setCtaTextEn}
                  onEs={setCtaTextEs}
                  placeholderEn="Button Name"
                  placeholderEs="Nombre del Botón"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Button Destination <span className="req">*</span>
                </label>
                <div className="spc-url-field">
                  <input
                    className="spc-url-input"
                    placeholder="Add URL or DeepLink"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    className="spc-url-test"
                    disabled={!ctaUrl.trim()}
                    onClick={() =>
                      window.open(ctaUrl.trim(), "_blank", "noopener,noreferrer")
                    }
                  >
                    Test It Out
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">
              End Date <span className="req">*</span>
            </label>
            <DateField
              value={endDate}
              onChange={setEndDate}
              placeholder="Select End Date"
              min={MIN_END}
              max={MAX_END}
              shortcuts={END_DATE_SHORTCUTS}
            />
            <p className="form-help">
              Maximum duration for a Spotlight is 6 months
            </p>
          </div>
        </div>

        <aside className="spc-rail">
          <h2 className="spc-preview-title">Preview</h2>
          <SpotlightCardPreview
            title={headingEn.trim()}
            description={descriptionEn.trim()}
            cta={ctaTextEn.trim()}
            ctaEnabled={ctaEnabled}
            imageUrl={image?.url}
          />
        </aside>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="wizard-actions">
          <button
            className={`btn-publish${ctaTooltip ? " has-cta-tooltip" : ""}`}
            disabled={!valid}
            data-tooltip={ctaTooltip}
            /* An edit keeps the Spotlight's queue slot, so there is no position
               step to continue to — it saves straight away. */
            onClick={handleSubmit}
          >
            {enabling ? "Enable Spotlight" : editing ? "Save Changes" : "Continue"}
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────── Spotlight card preview (Figma 556:1975) ───────────────
   630×250 card: the background image under a dark wash that fades out to the
   right, title / description / button pill down the left, dismiss ✕ top right.
   With nothing uploaded it shows the platform default background. */

export function SpotlightCardPreview({
  title,
  description,
  cta,
  ctaEnabled,
  ctaHref,
  imageUrl,
}: {
  title: string;
  description: string;
  cta: string;
  ctaEnabled: boolean;
  /** Makes the button live, pointing at the Spotlight's re-direct. The form's
   *  own preview leaves this off — there the card is a picture of the result,
   *  and the URL field's "Test It Out" is what follows the link. */
  ctaHref?: string;
  imageUrl?: string;
}) {
  return (
    <div className="spc-hero">
      <img
        className="spc-hero-img"
        src={imageUrl ?? defaultSpotlightBg}
        alt=""
      />
      <span className="spc-hero-scrim" aria-hidden />
      <div className="spc-hero-row">
        <div className="spc-hero-col">
          <div className="spc-hero-text">
            <div className="spc-hero-title">
              {title || "Title appears here..."}
            </div>
            <div className="spc-hero-desc">
              {description || "Description appears here..."}
            </div>
          </div>
          {ctaEnabled &&
            (ctaHref ? (
              <a
                className="spc-hero-pill spc-hero-pill--link"
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {cta || "Button Name..."}
              </a>
            ) : (
              <span className="spc-hero-pill">{cta || "Button Name..."}</span>
            ))}
        </div>
        <span className="spc-hero-close" aria-hidden>
          <CloseXIcon />
        </span>
      </div>
    </div>
  );
}

/* ─────────────── Fields ─────────────── */

function LangField({
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
            rows={2}
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
            rows={2}
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

function ImagePicker({
  onPick,
  children,
}: {
  onPick: (file: File) => void;
  children: (open: () => void) => JSX.Element;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      {children(() => ref.current?.click())}
    </>
  );
}

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Clamps to the last day of the target month, so Aug 31 + 1 month is Sep 30
// rather than rolling into October.
function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
