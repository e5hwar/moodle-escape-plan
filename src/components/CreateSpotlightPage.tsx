import { useEffect, useRef, useState } from "react";
import { FileNameLink } from "./FileNameLink";
import { CloseXIcon, MoveIcon, SmallXIcon, UploadTrayIcon } from "./icons";
import { WizardStepRail, useWizardStepStatuses } from "./WizardStepRail";
import { useEdgeLineGate, WizardGateEdges } from "./wizardGate";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";
import defaultSpotlightBg from "../assets/spotlight-default-bg.png";
import { formatShortDate } from "../formatDate";
import { SPOTLIGHT_TITLE_MAX, SPOTLIGHT_DESCRIPTION_MAX, type Spotlight } from "../data/spotlights";
import { CharCount } from "./CharCount";
import { leave, useMovedPast, useTouchedKeys } from "./fieldFlags";
import { DateField, type DateShortcut } from "./DateField";
import { DeepLinkModal } from "./DeepLinkModal";
import { draftKey, useLeaveGuard } from "./LeaveGuard";

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
  /** `position` is the Spotlight's 0-based slot in the live queue, from the
   *  Queue Position step. */
  onSubmit: (draft: SpotlightDraft, position: number) => void;
  /** Editing an existing Spotlight rather than creating one: the fields start
   *  from it and saving writes back over it in place. */
  editing?: Spotlight;
  /** That edit is an archived Spotlight being switched back on. Same form, but
   *  its end date has already been and gone, so the field starts empty and a
   *  fresh one — inside the create window — has to be picked. */
  enabling?: boolean;
  /** The live queue (Active + In-Review, in order) the Queue Position step
   *  places this Spotlight among — without the Spotlight itself. */
  queue: Spotlight[];
  /** Its starting slot in that queue: the end for a new or re-enabled one, its
   *  current slot for an edit. */
  startPosition: number;
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

/* Two steps: the Spotlight itself, then where it sits in the Home-Screen
   queue. The preview rail stays beside both. */
const STEPS = [
  {
    label: "Details",
    desc: "What the Spotlight says, how it looks, and how long it runs on the SkillCat Home Page.",
  },
  {
    label: "Queue Position",
    desc: "Drag the Spotlight to where it should sit in the Home Screen queue. Position 1 shows first.",
  },
];
const LAST_STEP = STEPS.length - 1;

export function CreateSpotlightPage({ onClose, onSubmit, editing, enabling, queue, startPosition }: Props) {
  const seed = editing;
  const [step, setStep] = useState(0);
  // Fields clicked into and out of, and the furthest step opened — what lets
  // a mandatory field say "cannot be left empty" (fieldFlags.tsx).
  const { touched, touch } = useTouchedKeys();
  const movedPast = useMovedPast(step);
  const [position, setPosition] = useState(Math.min(startPosition, queue.length));
  const [headingEn, setHeadingEn] = useState(seed?.headingEn ?? "");
  const [headingEs, setHeadingEs] = useState(seed?.headingEs ?? "");
  const [descriptionEn, setDescriptionEn] = useState(seed?.descriptionEn ?? "");
  const [descriptionEs, setDescriptionEs] = useState(seed?.descriptionEs ?? "");
  // The re-direct button starts enabled on a new Spotlight; an existing one
  // keeps whatever it was saved with. Its name and destination only apply (and
  // only show) while it is enabled.
  const [ctaEnabled, setCtaEnabled] = useState(seed ? Boolean(seed.ctaTextEn || seed.ctaUrl) : true);
  const [ctaTextEn, setCtaTextEn] = useState(seed?.ctaTextEn ?? "");
  const [ctaTextEs, setCtaTextEs] = useState(seed?.ctaTextEs ?? "");
  const [ctaUrl, setCtaUrl] = useState(seed?.ctaUrl ?? "");
  const [endDate, setEndDate] = useState(enabling ? "" : seed?.endDate ?? "");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [deepLinksOpen, setDeepLinksOpen] = useState(false);

  /* The form as it opened — an edit's saved Spotlight included, so only a
     real change counts. Anything the admin changes (a field, the image, the
     queue slot) makes `dirty` true, which is what decides whether Cancel and
     the app's own exits stop to ask (the shared LeaveGuard); an untouched
     page closes straight away. The step is navigation, not work. */
  const snapshot = draftKey({
    position,
    headingEn,
    headingEs,
    descriptionEn,
    descriptionEs,
    ctaEnabled,
    ctaTextEn,
    ctaTextEs,
    ctaUrl,
    endDate,
    image: image?.url ?? null,
  });
  const pristine = useRef(snapshot);
  const dirty = snapshot !== pristine.current;
  const guard = useLeaveGuard(dirty, {
    noun: "Spotlight",
    creating: !editing,
  });

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

  // The limits are soft (Figma 1369:1478): the field lets you run past them,
  // its counter goes negative, and the label row + this gate say so.
  const titleOver = Math.max(headingEn.length, headingEs.length) > SPOTLIGHT_TITLE_MAX;
  const descriptionOver =
    Math.max(descriptionEn.length, descriptionEs.length) > SPOTLIGHT_DESCRIPTION_MAX;
  const passed = movedPast(0);
  const titleMissing = !headingEn.trim() && (passed || touched.has("title"));
  const ctaTextMissing = ctaEnabled && !ctaTextEn.trim() && (passed || touched.has("ctaText"));
  const ctaUrlMissing = ctaEnabled && !ctaUrl.trim() && (passed || touched.has("ctaUrl"));
  const endDateMissing = !endDate.trim() && (passed || touched.has("endDate"));

  /* Everything the final save needs, top-to-bottom in form order. The blocked
     button's tooltip lists EVERY failing one — the Task / Certification /
     Award wizards' "Fill in every required field" list, one bullet per field
     with the step it lives on. */
  const checks: { valid: boolean; label: string }[] = [
    { valid: headingEn.trim().length > 0, label: "English Title" },
    { valid: !titleOver, label: `Title (${SPOTLIGHT_TITLE_MAX} characters max)` },
    { valid: !descriptionOver, label: `Description (${SPOTLIGHT_DESCRIPTION_MAX} characters max)` },
    ...(ctaEnabled
      ? [
          { valid: ctaTextEn.trim().length > 0, label: "English Button Name" },
          { valid: ctaUrl.trim().length > 0, label: "Button Destination" },
        ]
      : []),
    { valid: endDate.trim().length > 0, label: "End Date" },
    /* An existing Spotlight's date may already sit outside the create window
       (it was set months ago); only a CHANGED date has to fall inside it. An
       enable is always a change — the old date is exactly what expired. */
    {
      valid: !endDate || (!enabling && endDate === seed?.endDate) || (endDate >= MIN_END && endDate <= MAX_END),
      label: `End Date between ${formatShortDate(MIN_END)} and ${formatShortDate(MAX_END)}`,
    },
  ];
  const valid = checks.every((c) => c.valid);
  /* Editing with nothing changed: Save Changes has nothing to save, so it
     stays dimmed. Enabling is its own action and isn't gated on a change. */
  const unchanged = editing && !enabling && !dirty;
  const canSave = valid && !unchanged;
  const saveVerb = enabling ? "enable" : editing ? "save" : "submit";
  const ctaTooltip = canSave
    ? ""
    : valid
    ? "No changes to save"
    : [
        `Fill in every required field to ${saveVerb}:`,
        ...checks.filter((c) => !c.valid).map((c) => `• ${c.label} — ${STEPS[0].label}`),
      ].join("\n");

  /* Steps are free to walk, as in every other wizard: Next, the rail and the
     wheel all move on with Details incomplete — the rail flags it red once it
     has been left — and only the final save is gated. */
  const gate = useEdgeLineGate({ step, setStep, lastStep: LAST_STEP });
  // A blocked save attempt flags Details even before it has been left.
  const [flagAll, setFlagAll] = useState(false);
  const stepStatuses = useWizardStepStatuses({
    step,
    count: STEPS.length,
    incomplete: (i) => i === 0 && !valid,
    flagAll,
  });

  function next() {
    if (step < LAST_STEP) {
      gate.goStep(step + 1);
    } else if (canSave) {
      handleSubmit();
    } else if (!valid) {
      // ⌘↵ on a blocked save: take the admin to what's missing.
      setFlagAll(true);
      gate.goStep(0);
    }
  }
  // ⌘/Ctrl+Enter — Next on Details, the final save on Queue Position.
  useWizardEnterShortcut(next, undefined, !deepLinksOpen);

  /* Queue Position's row for this Spotlight, built from what was typed. An edit
     keeps its status; a re-enabled one comes back Active unless it had been
     rejected; a new one waits for review. */
  const status: Spotlight["status"] = editing
    ? enabling
      ? editing.status === "rejected" ? "pending" : "approved"
      : editing.status
    : "pending";
  const self = {
    title: headingEn.trim() || "Untitled Spotlight",
    description: descriptionEn.trim(),
    status,
    imageUrl: image?.url,
    endDate,
  };

  const finalLabel = enabling ? "Enable Spotlight" : editing ? "Save Changes" : "Submit for Review";

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
      position,
    );
  }

  return (
    <div className="wizard spc-page">
      <div className="wizard-body">
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">
              {enabling ? "Enabling" : editing ? "Editing" : "Creating"}
            </span>
            <span className="wizard-brand-name">
              {editing ? editing.headingEn : "New Spotlight"}
            </span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((s, i) => {
              const st = stepStatuses[i];
              return (
                <li
                  key={s.label}
                  className={`wizard-step ${st}`}
                  onClick={() => gate.goStep(i)}
                >
                  <WizardStepRail status={st} num={i + 1} />
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
            lastStep={LAST_STEP}
            labels={STEPS.map((s) => s.label)}
          />
          <div className="wizard-content spc-form" ref={gate.scrollRef}>
            <div className="wizard-paneout" ref={gate.paneOutRef}>
              <div className="wizard-pane" key={step}>
                <h1 className="tasks-title">{STEPS[step].label}</h1>
                <p className="tasks-subtitle wizard-desc">
                  {step === 0 && enabling
                    ? "Set a new end date to put this Spotlight back on the SkillCat Home Page."
                    : STEPS[step].desc}
                </p>

                {step === 1 ? (
                  <QueuePositionStep
                    queue={queue}
                    self={self}
                    isNew={!editing}
                    position={position}
                    onMove={setPosition}
                  />
                ) : (
                  <>
                    <div className="form-group" onBlur={leave(() => touch("title"))}>
                      <label className="form-label">
                        Title<span className="req">*</span>
                        {titleOver ? (
                          <span className="form-label-error">
                            *Use {SPOTLIGHT_TITLE_MAX} characters or lesser
                          </span>
                        ) : titleMissing ? (
                          <span className="form-label-error">Title cannot be left empty</span>
                        ) : null}
                      </label>
                      <LangField
                        en={headingEn}
                        es={headingEs}
                        onEn={setHeadingEn}
                        onEs={setHeadingEs}
                        placeholderEn="Title"
                        placeholderEs="Título"
                        maxLength={SPOTLIGHT_TITLE_MAX}
                        error={titleMissing}
                      />
                      <p className="form-help">
                        English is required. If Spanish is empty, Spanish-language users
                        see the English version.
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Description
                        {descriptionOver && (
                          <span className="form-label-error">
                            *Use {SPOTLIGHT_DESCRIPTION_MAX} characters or lesser
                          </span>
                        )}
                      </label>
                      <LangField
                        en={descriptionEn}
                        es={descriptionEs}
                        onEn={setDescriptionEn}
                        onEs={setDescriptionEs}
                        placeholderEn="Description"
                        placeholderEs="Descripción"
                        maxLength={SPOTLIGHT_DESCRIPTION_MAX}
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
                            <FileNameLink name={image.name} url={image.url} />
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
                        <div className="form-group" onBlur={leave(() => touch("ctaText"))}>
                          <label className="form-label">
                            Button Name<span className="req">*</span>
                            {ctaTextMissing && (
                              <span className="form-label-error">Button Name cannot be left empty</span>
                            )}
                          </label>
                          <LangField
                            en={ctaTextEn}
                            es={ctaTextEs}
                            onEn={setCtaTextEn}
                            onEs={setCtaTextEs}
                            placeholderEn="Button Name"
                            error={ctaTextMissing}
                            placeholderEs="Nombre del Botón"
                          />
                        </div>

                        <div className="form-group" onBlur={leave(() => touch("ctaUrl"))}>
                          <label className="form-label">
                            Button Destination<span className="req">*</span>
                            {ctaUrlMissing && (
                              <span className="form-label-error">Button Destination cannot be left empty</span>
                            )}
                          </label>
                          <div className={`spc-url-field${ctaUrlMissing ? " has-error" : ""}`}>
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
                          <p className="form-help">
                            Need help finding a Deep Link?{" "}
                            <button
                              type="button"
                              className="form-help-link"
                              onClick={() => setDeepLinksOpen(true)}
                            >
                              Click Here
                            </button>
                          </p>
                        </div>
                      </>
                    )}

                    <div className="form-group" onBlur={leave(() => touch("endDate"))}>
                      <label className="form-label">
                        End Date<span className="req">*</span>
                        {endDateMissing && (
                          <span className="form-label-error">End Date cannot be left empty</span>
                        )}
                      </label>
                      <DateField
                        value={endDate}
                        onChange={setEndDate}
                        placeholder="Select End Date"
                        hasError={endDateMissing}
                        min={MIN_END}
                        max={MAX_END}
                        shortcuts={END_DATE_SHORTCUTS}
                      />
                      <p className="form-help">
                        Maximum duration for a Spotlight is 6 months
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details only — Queue Position gives the queue the full width. */}
        {step === 0 && (
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
        )}
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={() => guard(onClose)}>
            Cancel
          </button>
        </div>
        <div className="wizard-actions">
          {step > 0 && (
            <button className="btn-save-draft wizard-gate-btn" onClick={() => gate.goStep(step - 1)}>
              <span className="wizard-gate-fill" ref={gate.backFillRef} />
              <span className="wizard-gate-btn-inner">Back</span>
            </button>
          )}
          {step < LAST_STEP ? (
            <button className="btn-publish wizard-gate-btn" onClick={next}>
              <span className="wizard-gate-fill" ref={gate.nextFillRef} />
              <span className="wizard-gate-btn-inner">
                Next: {STEPS[step + 1].label}
                <WizardKeyHint />
              </span>
            </button>
          ) : (
            /* Gated the way the Task / Award wizards gate saving: `is-disabled`
               rather than `disabled`, so it can still show the shared tooltip
               naming what's missing and answer a click by going to it. */
            <button
              className={`btn-publish${canSave ? "" : " is-disabled"}`}
              aria-disabled={!canSave}
              data-tip={ctaTooltip || undefined}
              onClick={next}
            >
              {finalLabel}
              <WizardKeyHint />
            </button>
          )}
        </div>
      </footer>

      {deepLinksOpen && (
        <DeepLinkModal
          onCancel={() => setDeepLinksOpen(false)}
          onPick={(url) => {
            setCtaUrl(url);
            setDeepLinksOpen(false);
          }}
        />
      )}
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
          {/* Only what the user has typed — no placeholder copy on the card. */}
          {(title || description) && (
            <div className="spc-hero-text">
              {title && <div className="spc-hero-title">{title}</div>}
              {description && <div className="spc-hero-desc">{description}</div>}
            </div>
          )}
          {ctaEnabled && cta &&
            (ctaHref ? (
              <a
                className="spc-hero-pill spc-hero-pill--link"
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {cta}
              </a>
            ) : (
              <span className="spc-hero-pill">{cta}</span>
            ))}
        </div>
        <span className="spc-hero-close" aria-hidden>
          <CloseXIcon />
        </span>
      </div>
    </div>
  );
}

/* ─────────────── Backdrop thumbnail ───────────────
   The 144×76 artwork tile (558:2070) — the Spotlight table's Backdrop column
   and the Queue Position step's. The prototype keeps no per-Spotlight image
   file, only an `imageHint` filename, so a saved Spotlight shows the default
   artwork (tinted by `backgroundColor` when it was authored without an image);
   `imageUrl` is the one being created, whose uploaded file is still in hand. */
export function SpotlightThumb({ spotlight, imageUrl }: { spotlight?: Spotlight; imageUrl?: string }) {
  const tint = !imageUrl ? spotlight?.backgroundColor : undefined;
  return (
    <div className="sp-thumb" style={tint ? { background: tint } : undefined}>
      {!tint || spotlight?.imageHint ? (
        <img className="sp-thumb-img" src={imageUrl ?? defaultSpotlightBg} alt="" />
      ) : null}
    </div>
  );
}

/* ─────────────── Step 2 — Queue Position ───────────────
   The live queue as an ordered card — the Quiz Questions card's shell (`.qz`,
   750:1672): ORDER with its move handle, the Backdrop tile the Spotlight
   table shows, the title over its description, and the status pill. Only this Spotlight moves; the others are
   fixed here (they reorder on the Spotlight table), so they keep an invisible
   handle to hold the column. Drag is pointer-based like the Quiz card's, and
   the handle also takes ↑ / ↓ from the keyboard. */

type QueueSelf = { title: string; description: string; status: Spotlight["status"]; imageUrl?: string; endDate: string };

function QueuePositionStep({
  queue,
  self,
  isNew,
  position,
  onMove,
}: {
  queue: Spotlight[];
  self: QueueSelf;
  /** Creating rather than editing: this Spotlight's row wears the orange
   *  "New" tag (Table Pill - Accent, 107:1132) instead of a status. */
  isNew: boolean;
  position: number;
  onMove: (position: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());

  // The rendered order: the queue with this Spotlight spliced in at `position`.
  const rows: ({ kind: "other"; s: Spotlight } | { kind: "self" })[] = queue.map((s) => ({
    kind: "other" as const,
    s,
  }));
  rows.splice(position, 0, { kind: "self" });

  const slotUnder = (y: number) => {
    let target: number | null = null;
    rowRefs.current.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) target = i;
    });
    return target;
  };

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    setOver(position);
    const onPointerMove = (ev: PointerEvent) => setOver(slotUnder(ev.clientY));
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
      const target = slotUnder(ev.clientY);
      if (target !== null) onMove(target);
      setDragging(false);
      setOver(null);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp" && position > 0) {
      e.preventDefault();
      onMove(position - 1);
    } else if (e.key === "ArrowDown" && position < queue.length) {
      e.preventDefault();
      onMove(position + 1);
    }
  };

  const rowRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(i, el);
    else rowRefs.current.delete(i);
  };

  return (
    <div className={`qz spq${dragging ? " qz-dragging" : ""}`}>
      <div className="qz-hd">
        <span className="qz-ord-col">
          <span className="qz-drag qz-drag--ghost" aria-hidden="true">
            <MoveIcon />
          </span>
          <span className="qz-ord">ORDER</span>
        </span>
        <span className="spq-hd-thumb">BACKDROP</span>
        <span className="qz-hd-q">SPOTLIGHT</span>
        <span className="spq-hd-status">STATUS</span>
        <span className="spq-hd-date">END DATE</span>
      </div>

      {rows.map((row, i) => {
        const isSelf = row.kind === "self";
        const title = isSelf ? self.title : row.s.headingEn;
        const description = isSelf ? self.description : row.s.descriptionEn ?? "";
        const pending = (isSelf ? self.status : row.s.status) === "pending";
        const cls = `qz-row${isSelf ? " spq-self" : ""}${isSelf && dragging ? " dragging" : ""}${
          dragging && over === i && !isSelf ? " drag-over" : ""
        }`;
        return (
          <div key={isSelf ? "self" : row.s.id} ref={rowRef(i)} className={cls}>
            <span className="qz-ord-col">
              {isSelf ? (
                <button
                  className="qz-drag"
                  aria-label={`Position ${i + 1} of ${rows.length}. Drag, or use the arrow keys, to move it`}
                  onPointerDown={startDrag}
                  onKeyDown={onKey}
                >
                  <MoveIcon />
                </button>
              ) : (
                <span className="qz-drag qz-drag--ghost" aria-hidden="true">
                  <MoveIcon />
                </span>
              )}
              <span className="qz-ord">{i + 1}</span>
            </span>
            {isSelf ? <SpotlightThumb imageUrl={self.imageUrl} /> : <SpotlightThumb spotlight={row.s} />}
            <div className="qz-q">
              <div className="qz-q-title">{title}</div>
              {description && <div className="qz-q-type">{description}</div>}
            </div>
            <span className="spq-status">
              {isSelf && isNew ? (
                <span className="co-status-pill co-status-pill--accent">New</span>
              ) : (
                <span className={`co-status-pill co-status-pill--${pending ? "yellow" : "green"}`}>
                  {pending ? "In-Review" : "Active"}
                </span>
              )}
            </span>
            {/* Same short format as the Spotlight table; "—" until this
                Spotlight's date is picked on Details. */}
            <span className="spq-date">
              {(() => {
                const d = isSelf ? self.endDate : row.s.endDate;
                return d ? formatShortDate(d) : "—";
              })()}
            </span>
          </div>
        );
      })}
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
  maxLength,
  error = false,
}: {
  en: string;
  es: string;
  onEn: (v: string) => void;
  onEs: (v: string) => void;
  placeholderEn: string;
  placeholderEs: string;
  /** Required and left empty — the red shell; the page's label says so. */
  error?: boolean;
  /* Applied to both languages. A SOFT limit (Figma 1369:1696 / 1369:1478):
     each row shows the characters left, and running past it turns the count
     and the shell red rather than stopping the keystroke — the page's gate
     and label row carry the message. */
  maxLength?: number;
}) {
  const over = maxLength !== undefined && Math.max(en.length, es.length) > maxLength;
  // Single-line in both languages — Title and Description alike.
  return (
    <div className={`lang-field${over || error ? " has-error" : ""}`}>
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input
          className="lang-field-input"
          placeholder={placeholderEn}
          value={en}
          onChange={(e) => onEn(e.target.value)}
          aria-invalid={over || error || undefined}
        />
        {maxLength !== undefined && <CharCount value={en} max={maxLength} />}
      </div>
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <span className="lang-tag">ES</span>
        <input
          className="lang-field-input"
          placeholder={placeholderEs}
          value={es}
          onChange={(e) => onEs(e.target.value)}
        />
        {maxLength !== undefined && <CharCount value={es} max={maxLength} />}
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
