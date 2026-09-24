import { useEffect, useMemo, useRef, useState } from "react";
import { CANCELLATION_REASONS } from "../data/companies";
import { DEFAULT_PARTNERSHIPS, DEFAULT_TRADES } from "../data/productConfig";
import {
  designTemplates as seedTemplates,
  type Award,
  type AwardDesignTemplate,
} from "../data/awards";
import { formatShortDate } from "../formatDate";
import {
  AddIcon,
  ImageAddIcon,
  InfoTipIcon,
  PlusThinIcon,
  RowCloseIcon,
  RowEditIcon,
  RowExternalLinkIcon,
  SmallXIcon,
} from "./icons";
import { PrmModal } from "./PrmModal";
import { RichTextField } from "./RichTextField";
import { Stepper } from "./Stepper";
import { PermissionsSection } from "./PermissionsPage";
import { AwardTemplatesSection } from "./AwardTemplatesSection";
import { NewDesignTemplateWizard } from "./NewDesignTemplateWizard";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

/* Product Config — platform-wide settings, one tab per area.

   Every tab is assembled from the shared design system, the same parts the
   wizards and Content Links use:
   - the `.tasks` shell, the page header and the underline tabs (659:896);
   - per tab, the one flat form every wizard step uses — label → control →
     subtext, 32px apart, fields filling the page width;
   - every list is the Quiz wizard's boxed `.qsec` table (1097:1205): a muted
     header row, a row per entry and an orange "+ Add" row closing the card;
   - numbers are the `Stepper` (618:1264), Price IDs the paywall matrix
     (752:2816), bilingual copy `LangField` / `RichTextField`;
   - forcing and removing an app version confirm through `PrmModal` (483:588);
   - nothing is saved until the Content Links save footer's Save Changes
     (561:2236), which only appears once something has changed.
   Award Templates is the exception: a record table with its own wizard and
   modals, so it brings its own full-height body and saves on its own. */

/* ─── Types ─── */
type Tab = "general" | "display" | "award-templates" | "b2c" | "b2b" | "legal" | "permissions";

const TAB_LABELS: Record<Tab, string> = {
  general: "General Settings",
  display: "Display Settings",
  "award-templates": "Award Templates",
  b2c: "B2C Management",
  b2b: "B2B Management",
  legal: "Legal",
  permissions: "Permissions",
};

const TAB_ORDER: Tab[] = ["general", "display", "award-templates", "b2c", "b2b", "legal", "permissions"];

type TabRow = {
  id: string;
  nameEn: string;
  nameEs: string;
  visible: boolean;
  url: string;
  icon: string | null;
};

type SupportLink = { id: string; label: string; url: string };

type Cycle = "Monthly" | "Annual";
const CYCLES: Cycle[] = ["Monthly", "Annual"];

type Tier = "Essentials" | "Growth" | "Professional";
type Platform = "Apple" | "Google" | "Stripe";
type PriceTable<K extends string> = Record<K, Record<Cycle, string>>;

type PriceRow<K extends string> = { key: K; name: string };

/* Paywall rows. Apple leads, as on every paywall in the app (748:1593), and
   the placeholders follow the same rule: the stores issue Product IDs, Stripe
   issues Price IDs. */
const B2C_PRICE_ROWS: PriceRow<Platform>[] = [
  { key: "Apple", name: "Apple Product ID" },
  { key: "Google", name: "Google Product ID" },
  { key: "Stripe", name: "Stripe Price ID" },
];

const B2B_PRICE_ROWS: PriceRow<Tier>[] = [
  { key: "Essentials", name: "Stripe Price ID" },
  { key: "Growth", name: "Stripe Price ID" },
  { key: "Professional", name: "Stripe Price ID" },
];

const emptyPrices = <K extends string>(rows: PriceRow<K>[]): PriceTable<K> =>
  Object.fromEntries(rows.map((r) => [r.key, { Monthly: "", Annual: "" }])) as PriceTable<K>;

/** `date` is ISO "YYYY-MM-DD"; it prints through the app's `formatShortDate`. */
type ForceUpdate = { id: string; version: string; date: string };

type BilingualDoc = { en: string; es: string };

type DeepLink = { id: string; label: string; url: string; requiresLogin: boolean };

const APP_DEEP_LINKS: DeepLink[] = [
  { id: "dl-cert-list", label: "Certification List", url: "skillcat.app/browse", requiresLogin: false },
  { id: "dl-id-reupload", label: "ID Reupload", url: "skillcat.app/reupload-id", requiresLogin: true },
  { id: "dl-verify-cert", label: "Verify Certificate", url: "skillcat.app/verify-certificate", requiresLogin: false },
];

const tabRow = (id: string, nameEn: string, nameEs = ""): TabRow => ({
  id, nameEn, nameEs, visible: true, url: "", icon: null,
});

/* Every value the page's Save Changes covers. One object, so "is anything
   unsaved?" is one comparison against the last saved copy. */
type Settings = {
  forceUpdates: ForceUpdate[];
  webcamFrequency: string;
  appTabs: TabRow[];
  dashboardTabs: TabRow[];
  supportLinks: SupportLink[];
  b2cPrices: PriceTable<Platform>;
  b2cTrialDays: string;
  b2cInitialTaskCount: string;
  b2cEpaCard: string;
  b2bPrices: PriceTable<Tier>;
  b2bTrialDays: string;
  partnerships: string[];
  trades: string[];
  b2bEpaCard: string;
  cancelReasons: string[];
  termsOfService: BilingualDoc;
  privacyPolicy: BilingualDoc;
};

const DEFAULT_SETTINGS: Settings = {
  forceUpdates: [
    { id: "fu-3", version: "4.2.0", date: "2026-06-02" },
    { id: "fu-2", version: "4.1.3", date: "2026-04-18" },
    { id: "fu-1", version: "4.0.0", date: "2026-01-27" },
  ],
  webcamFrequency: "20",
  appTabs: [
    tabRow("app-lab", "Lab"),
    tabRow("app-resources", "Resources"),
  ],
  dashboardTabs: [
    tabRow("dash-assessments", "Assessments"),
    tabRow("dash-troubleshooting", "Troubleshooting"),
    tabRow("dash-manuals", "Manuals"),
    tabRow("dash-error-codes", "Error Codes"),
    tabRow("dash-analytics", "Analytics"),
  ],
  supportLinks: [
    { id: "sup-b2b-dashboard", label: "B2B Dashboard", url: "" },
    { id: "sup-guides", label: "Guides", url: "" },
    { id: "sup-message", label: "Send Us A Message", url: "" },
    { id: "sup-news", label: "News", url: "" },
  ],
  b2cPrices: emptyPrices(B2C_PRICE_ROWS),
  b2cTrialDays: "3",
  b2cInitialTaskCount: "5",
  b2cEpaCard: "",
  b2bPrices: emptyPrices(B2B_PRICE_ROWS),
  b2bTrialDays: "14",
  partnerships: DEFAULT_PARTNERSHIPS,
  trades: DEFAULT_TRADES,
  b2bEpaCard: "",
  cancelReasons: [...CANCELLATION_REASONS],
  termsOfService: { en: "", es: "" },
  privacyPolicy: { en: "", es: "" },
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

/* By value, not reference: adding an option and then clearing it again leaves
   an equal but new array, which is not an unsaved change. */
const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Today as ISO "YYYY-MM-DD", in the viewer's own timezone. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Esc dismisses a modal — PrmModal itself only closes on the overlay and
 *  its close glyph. */
function useEscape(onClose: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/* ─── Shared field parts ─── */

/* Dual-language text input (Figma 49:348) — the same local LangField every
   wizard carries: one bordered box, EN over ES, split by a hairline. */
function LangField({
  en,
  es,
  onChangeEn,
  onChangeEs,
  placeholderEn,
  placeholderEs,
  ariaLabel,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
  /** Names both inputs when the field's label isn't adjacent (a table cell). */
  ariaLabel?: string;
}) {
  return (
    <div className="lang-field">
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input
          className="lang-field-input"
          value={en}
          onChange={(e) => onChangeEn(e.target.value)}
          placeholder={placeholderEn}
          aria-label={ariaLabel ? `${ariaLabel} (English)` : undefined}
        />
      </div>
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <span className="lang-tag">ES</span>
        <input
          className="lang-field-input"
          value={es}
          onChange={(e) => onChangeEs(e.target.value)}
          placeholder={placeholderEs}
          aria-label={ariaLabel ? `${ariaLabel} (Spanish)` : undefined}
        />
      </div>
    </div>
  );
}

/* A whole number, on the shared +/− Stepper. The unit rides in the label, the
   way the Quiz wizard's "Set Time in Minutes" does. */
function NumberField({
  label,
  help,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <Stepper
        value={value}
        onChange={(v) => onChange(v.replace(/[^0-9]/g, ""))}
        min={min}
        ariaLabel={label}
      />
      <p className="form-help">{help}</p>
    </div>
  );
}

/* Price IDs per row × billing cycle, on the paywall matrix (Figma 752:2816):
   the row labels on the left, one column of inputs per cycle. There is no Add
   tile — the tiers and cycles are fixed. The label column repeats the heading
   row as invisible text so its rows stay level with the inputs. */
function PriceIdGrid<K extends string>({
  rows,
  ghost,
  value,
  onChange,
}: {
  rows: PriceRow<K>[];
  /** The invisible label-column heading ("Tier", "Platform"). */
  ghost: string;
  value: PriceTable<K>;
  onChange: (v: PriceTable<K>) => void;
}) {
  return (
    <div className="price-id-matrix">
      <div className="price-idm-labels" aria-hidden="true">
        <div className="price-idm-head price-idm-ghost">{ghost}</div>
        {rows.map((r) => (
          <div key={r.key} className="price-idm-label">
            <span>{r.key}</span>
          </div>
        ))}
      </div>
      <div className="price-idm-cols">
        {CYCLES.map((cycle) => (
          <div key={cycle} className="price-idm-col">
            <div className="price-idm-head">
              <span>{cycle}</span>
            </div>
            {rows.map((r) => (
              <input
                key={r.key}
                className="form-input"
                placeholder={`${r.name}...`}
                aria-label={`${r.key} ${r.name}, ${cycle}`}
                value={value[r.key][cycle]}
                onChange={(e) =>
                  onChange({ ...value, [r.key]: { ...value[r.key], [cycle]: e.target.value } })
                }
                spellCheck={false}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── General Settings ─── */

function ForceAppUpdateField({
  history,
  onChange,
}: {
  history: ForceUpdate[];
  onChange: (h: ForceUpdate[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ForceUpdate | null>(null);

  function force(version: string) {
    onChange([{ id: `fu-${Date.now()}`, version, date: todayIso() }, ...history]);
    setAdding(false);
  }

  function remove(id: string) {
    onChange(history.filter((h) => h.id !== id));
    setRemoving(null);
  }

  return (
    <div className="form-group">
      <label className="form-label">Force App Update</label>
      {/* History is newest-first, and the newest entry is the version being
          forced — so the log IS the current state: its first row is Active. */}
      <div className="qsec">
        <div className="qsec-hd">
          <span className="pc-col-grow">VERSION</span>
          <span className="pc-col-date">ENABLED ON</span>
          <span className="pc-col-status">STATUS</span>
          <span className="qsec-x" aria-hidden />
        </div>

        {history.length === 0 && (
          <div className="qsec-row">
            <span className="qsec-empty">No force updates configured.</span>
          </div>
        )}

        {history.map((h, i) => (
          <div className="qsec-row" key={h.id}>
            <span className="pc-col-grow pc-strong">{h.version}</span>
            <span className="pc-col-date pc-muted">{formatShortDate(h.date)}</span>
            <span className="pc-col-status">
              {i === 0 ? (
                <span className="co-status-pill co-status-pill--green">Active</span>
              ) : (
                <span className="pc-muted">—</span>
              )}
            </span>
            <button
              className="qsec-x"
              aria-label={`Remove force update ${h.version}`}
              onClick={() => setRemoving(h)}
            >
              <RowCloseIcon />
            </button>
          </div>
        ))}

        <div className="qsec-foot">
          <button className="qsec-add" onClick={() => setAdding(true)}>
            <PlusThinIcon />
            Force New Version
          </button>
        </div>
      </div>
      <p className="form-help">
        Force learners on older app versions to update. Enter the minimum required version —
        users below it are prompted to update before they can continue.
      </p>

      {adding && (
        <ForceUpdateModal
          existing={history.map((h) => h.version)}
          onForce={force}
          onCancel={() => setAdding(false)}
        />
      )}
      {removing && (
        <RemoveForceUpdateModal
          entry={removing}
          history={history}
          onRemove={() => remove(removing.id)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

const VERSION_RE = /^\d+(\.\d+)*$/;

function ForceUpdateModal({
  existing,
  onForce,
  onCancel,
}: {
  existing: string[];
  onForce: (version: string) => void;
  onCancel: () => void;
}) {
  const [version, setVersion] = useState("");
  const v = version.trim();
  const isFormat = VERSION_RE.test(v);
  const isDuplicate = isFormat && existing.includes(v);
  const isValid = isFormat && !isDuplicate;

  useEscape(onCancel);

  function submit() {
    if (isValid) onForce(v);
  }

  return (
    <PrmModal
      title="Force New Version"
      description="Users below the minimum required version are prompted to update before they can continue."
      confirmLabel="Force Update"
      confirmDisabled={!isValid}
      onCancel={onCancel}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            Minimum Version<span className="prm-req">*</span>
          </span>
          <input
            autoFocus
            className="form-input"
            placeholder="e.g. 4.3.0"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            spellCheck={false}
          />
          {v && !isFormat && (
            <p className="form-help oc-error">Use numbers separated by dots, e.g. 4.3.0.</p>
          )}
          {isDuplicate && (
            <p className="form-help oc-error">Version {v} is already in the log.</p>
          )}
        </div>
      </div>
    </PrmModal>
  );
}

function RemoveForceUpdateModal({
  entry,
  history,
  onRemove,
  onCancel,
}: {
  entry: ForceUpdate;
  history: ForceUpdate[];
  onRemove: () => void;
  onCancel: () => void;
}) {
  useEscape(onCancel);

  const i = history.findIndex((h) => h.id === entry.id);
  const fallback = history[i + 1];

  return (
    <PrmModal
      title="Remove Force Update?"
      description={
        <>
          Remove force update <strong>{entry.version}</strong>?{" "}
          {i === 0 ? (
            fallback ? (
              <>
                Users will fall back to the previous forced version{" "}
                <strong>{fallback.version}</strong>.
              </>
            ) : (
              <>No version will be forced after this.</>
            )
          ) : (
            <>This removes it from the log.</>
          )}
        </>
      }
      confirmLabel="Remove"
      danger
      onCancel={onCancel}
      onConfirm={onRemove}
    />
  );
}

/* Read-only: a reference list, so the rows carry no controls — just the link
   out to each destination. */
function DeepLinksField({ links }: { links: DeepLink[] }) {
  return (
    <div className="form-group">
      <label className="form-label">App Deep Links</label>
      <div className="qsec">
        <div className="qsec-hd">
          <span className="pc-col-name">DESTINATION</span>
          <span className="pc-col-grow">DEEP LINK</span>
          <span className="pc-col-login">LOGIN REQUIRED?</span>
          <span className="qsec-x" aria-hidden />
        </div>
        {links.map((link) => (
          <div className="qsec-row" key={link.id}>
            <span className="pc-col-name pc-strong">{link.label}</span>
            <span className="pc-col-grow pc-muted">{link.url}</span>
            <span className="pc-col-login pc-muted">{link.requiresLogin ? "Yes" : "No"}</span>
            <a
              className="pc-open"
              href={`https://${link.url}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in a New Tab"
              aria-label={`Open ${link.label} in a new tab`}
            >
              <RowExternalLinkIcon />
            </a>
          </div>
        ))}
      </div>
      <p className="form-help">
        Read-only reference of the app’s deep links and whether each destination requires the
        user to be logged in.
      </p>
    </div>
  );
}

/* ─── Display Settings ─── */

/* A tab's icon: a 45px upload tile — the height of every control on the form.
   Dashed while empty, the picked image filling it once set, with a ✕ on its
   corner to clear it. */
function IconTile({
  icon,
  name,
  onChange,
}: {
  icon: string | null;
  name: string;
  onChange: (v: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function pick(file: File) {
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="pc-col-icon pc-icon">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={`pc-icon-btn${icon ? " has-icon" : ""}`}
        onClick={() => ref.current?.click()}
        title={icon ? "Replace Icon" : "Upload Icon"}
        aria-label={icon ? `Replace the ${name} icon` : `Upload an icon for ${name}`}
      >
        {icon ? <img src={icon} alt="" /> : <ImageAddIcon />}
      </button>
      {icon && (
        <button
          type="button"
          className="pc-icon-x"
          onClick={() => onChange(null)}
          title="Remove Icon"
          aria-label={`Remove the ${name} icon`}
        >
          <SmallXIcon />
        </button>
      )}
    </div>
  );
}

function TabsField({
  label,
  help,
  rows,
  onUpdate,
}: {
  label: string;
  help: string;
  rows: TabRow[];
  /** Takes an updater, not a value: an icon lands after its FileReader
   *  finishes, and must not write back a copy of the rows from before an
   *  edit made in the meantime. */
  onUpdate: (fn: (rows: TabRow[]) => TabRow[]) => void;
}) {
  const setRow = (id: string, patch: Partial<TabRow>) =>
    onUpdate((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="qsec">
        <div className="qsec-hd">
          <span className="pc-col-icon">ICON</span>
          <span className="pc-col-grow">TAB NAME</span>
          <span className="pc-col-grow">URL</span>
          <span className="pc-col-toggle">VISIBLE?</span>
        </div>
        {rows.map((row) => {
          const name = row.nameEn.trim() || "this tab";
          return (
            <div className="qsec-row" key={row.id}>
              <IconTile icon={row.icon} name={name} onChange={(icon) => setRow(row.id, { icon })} />
              <div className="pc-col-grow">
                <LangField
                  en={row.nameEn}
                  es={row.nameEs}
                  onChangeEn={(v) => setRow(row.id, { nameEn: v })}
                  onChangeEs={(v) => setRow(row.id, { nameEs: v })}
                  placeholderEn="Tab Name..."
                  placeholderEs="Nombre de la Pestaña..."
                  ariaLabel="Tab name"
                />
              </div>
              <div className="pc-col-grow">
                <input
                  className="form-input"
                  value={row.url}
                  onChange={(e) => setRow(row.id, { url: e.target.value })}
                  placeholder="URL..."
                  aria-label={`URL for ${name}`}
                  spellCheck={false}
                />
              </div>
              <span className="pc-col-toggle">
                <button
                  type="button"
                  className={`toggle${row.visible ? " on" : ""}`}
                  aria-pressed={row.visible}
                  aria-label={`Show ${name}`}
                  onClick={() => setRow(row.id, { visible: !row.visible })}
                >
                  <span className="toggle-knob" />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <p className="form-help">{help}</p>
    </div>
  );
}

function SupportPagesField({
  links,
  onChange,
}: {
  links: SupportLink[];
  onChange: (links: SupportLink[]) => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label">Support Pages</label>
      <div className="qsec">
        <div className="qsec-hd">
          <span className="pc-col-name">PAGE</span>
          <span className="pc-col-grow">URL</span>
        </div>
        {links.map((link) => (
          <div className="qsec-row" key={link.id}>
            <span className="pc-col-name pc-strong">{link.label}</span>
            <div className="pc-col-grow">
              <input
                className="form-input"
                value={link.url}
                onChange={(e) =>
                  onChange(links.map((x) => (x.id === link.id ? { ...x, url: e.target.value } : x)))
                }
                placeholder="URL..."
                aria-label={`URL for ${link.label}`}
                spellCheck={false}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="form-help">Set the destination URL for each support page surfaced to users.</p>
    </div>
  );
}

/* ─── B2C / B2B Management ─── */

function EpaCardField({
  value,
  onChange,
  note,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Which surface this ID covers — the other tab holds the other one. */
  note: string;
}) {
  return (
    <div className="form-group">
      <label className="form-label">EPA Card</label>
      <input
        className="form-input"
        placeholder="Stripe Product ID..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <p className="form-help">
        Stripe Product ID for the EPA card. Used to create the checkout session when a learner
        purchases their EPA card.
        <span className="form-help-info" tabIndex={0} role="note" aria-label={note} data-tip={note}>
          <InfoTipIcon />
        </span>
      </p>
    </div>
  );
}

/* A list of named options (Partnerships, Trade, Cancellation Reasons): a plain
   row per option with an edit pencil and a remove ✕, and the Add row closing
   the card. Adding and editing both open the same small name modal — the Question
   Bank's New / Rename Category pair — so the rows themselves never turn into
   inputs and never change height under the cursor. */
function OptionListField({
  label,
  help,
  column,
  noun,
  fieldLabel,
  modalDesc,
  emptyLabel,
  options,
  onChange,
}: {
  label: string;
  help: string;
  /** Header cell, e.g. "PARTNERSHIP". */
  column: string;
  /** Singular, Title Case — the Add row and the modal titles use it. */
  noun: string;
  /** The modal's field label ("Name", "Reason"). */
  fieldLabel: string;
  /** One line under the modal title saying what an option is for. */
  modalDesc: string;
  emptyLabel: string;
  options: string[];
  onChange: (o: string[]) => void;
}) {
  const [modal, setModal] = useState<{ kind: "new" } | { kind: "edit"; index: number } | null>(
    null,
  );
  const removeAt = (i: number) => onChange(options.filter((_, j) => j !== i));
  const editing = modal?.kind === "edit" ? modal.index : -1;

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="qsec">
        <div className="qsec-hd">
          <span className="pc-col-grow">{column}</span>
          <span className="pc-col-actions" aria-hidden />
        </div>

        {options.length === 0 && (
          <div className="qsec-row">
            <span className="qsec-empty">{emptyLabel}</span>
          </div>
        )}

        {options.map((opt, i) => (
          <div className="qsec-row" key={opt}>
            <span className="pc-col-grow pc-strong">{opt}</span>
            <span className="pc-col-actions">
              <button
                className="qsec-x"
                title="Edit"
                aria-label={`Edit ${opt}`}
                onClick={() => setModal({ kind: "edit", index: i })}
              >
                <RowEditIcon />
              </button>
              <button
                className="qsec-x"
                title="Remove"
                aria-label={`Remove ${opt}`}
                onClick={() => removeAt(i)}
              >
                <RowCloseIcon />
              </button>
            </span>
          </div>
        ))}

        <div className="qsec-foot">
          <button className="qsec-add" onClick={() => setModal({ kind: "new" })}>
            <PlusThinIcon />
            Add {noun}
          </button>
        </div>
      </div>
      <p className="form-help">{help}</p>

      {modal && (
        <OptionNameModal
          title={modal.kind === "new" ? `New ${noun}` : `Edit ${noun}`}
          description={modalDesc}
          fieldLabel={fieldLabel}
          confirmLabel={modal.kind === "new" ? `Create ${noun}` : `Save ${noun}`}
          defaultValue={editing >= 0 ? options[editing] : ""}
          others={options.filter((_, j) => j !== editing)}
          onCancel={() => setModal(null)}
          onSubmit={(name) => {
            onChange(
              editing >= 0
                ? options.map((o, j) => (j === editing ? name : o))
                : [...options, name],
            );
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

/* New / Edit an option — the shared modal shell (Figma 483:588) with one
   required field, the same shape as the Question Bank's New / Rename Category.
   Names are unique (case-insensitively) and never blank; Enter submits and Esc
   dismisses. */
function OptionNameModal({
  title,
  description,
  fieldLabel,
  confirmLabel,
  defaultValue,
  others,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  fieldLabel: string;
  confirmLabel: string;
  defaultValue: string;
  /** Every other option in the list — the duplicate check runs against these. */
  others: string[];
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const trimmed = value.trim();
  const isDuplicate =
    !!trimmed && others.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const isValid = !!trimmed && !isDuplicate;

  useEscape(onCancel);

  function submit() {
    if (isValid) onSubmit(trimmed);
  }

  return (
    <PrmModal
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      confirmDisabled={!isValid}
      onCancel={onCancel}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            {fieldLabel}<span className="prm-req">*</span>
          </span>
          <input
            autoFocus
            className="form-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={`${fieldLabel}...`}
          />
          {isDuplicate && (
            <p className="form-help oc-error">“{trimmed}” is already in the list.</p>
          )}
        </div>
      </div>
    </PrmModal>
  );
}

/* ─── Legal ─── */

function LegalDocField({
  title,
  titleEs,
  desc,
  doc,
  onChange,
}: {
  title: string;
  /** Spanish name of the document, for the ES placeholder. */
  titleEs: string;
  desc: string;
  doc: BilingualDoc;
  onChange: (d: BilingualDoc) => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{title}</label>
      <RichTextField
        en={doc.en}
        es={doc.es}
        onChangeEn={(v) => onChange({ ...doc, en: v })}
        onChangeEs={(v) => onChange({ ...doc, es: v })}
        placeholderEn={`${title}...`}
        placeholderEs={`${titleEs}...`}
        minRows={4}
        maxRows={12}
      />
      <p className="form-help">{desc}</p>
    </div>
  );
}

/* ─── Main page ─── */
export function ProductConfigPage({
  initialTab,
  onEditAward,
}: {
  initialTab?: Tab;
  /** Leaves for the Awards page, on one Award — the Award Templates tab uses
   *  it to reach an Award that still holds a template you tried to delete. */
  onEditAward?: (award: Award) => void;
} = {}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "general");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<Settings>(DEFAULT_SETTINGS);
  const dirty = useMemo(
    () => SETTING_KEYS.some((k) => !sameValue(settings[k], saved[k])),
    [settings, saved],
  );

  const set =
    <K extends keyof Settings>(key: K) =>
    (value: Settings[K]) =>
      setSettings((s) => ({ ...s, [key]: value }));
  const update =
    <K extends keyof Settings>(key: K) =>
    (fn: (value: Settings[K]) => Settings[K]) =>
      setSettings((s) => ({ ...s, [key]: fn(s[key]) }));

  /* Award Templates is a record list, not a settings form: it saves through its
     own wizard and modals, so it keeps its state (and its Create CTA) here
     rather than under the page's Save Changes. */
  const [templates, setTemplates] = useState<AwardDesignTemplate[]>(seedTemplates);
  const [templateWizard, setTemplateWizard] = useState<
    { kind: "new" } | { kind: "edit"; template: AwardDesignTemplate } | null
  >(null);
  const onTemplatesTab = tab === "award-templates";
  useCreateShortcut(() => setTemplateWizard({ kind: "new" }), onTemplatesTab && !templateWizard);

  if (templateWizard) {
    return (
      <NewDesignTemplateWizard
        editingTemplate={templateWizard.kind === "edit" ? templateWizard.template : undefined}
        allTemplates={templates}
        onClose={() => setTemplateWizard(null)}
        onSave={(t) =>
          setTemplates((prev) => {
            const i = prev.findIndex((x) => x.id === t.id);
            if (i < 0) return [t, ...prev];
            const next = [...prev]; next[i] = t; return next;
          })
        }
      />
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks pc-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Product Config</h1>
            </div>
            {onTemplatesTab && (
              <div className="tasks-header-actions">
                <button className="new-task" onClick={() => setTemplateWizard({ kind: "new" })}>
                  <AddIcon />
                  Create Design Template
                  <span className="cta-kbd">C</span>
                </button>
              </div>
            )}
          </header>

          <div className="tabbar pc-tabs" role="tablist" aria-label="Product Config">
            {TAB_ORDER.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`tab${tab === t ? " is-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* The Award Templates tab brings its own full-height table shell, so
              it replaces the form body rather than sitting in it. Keyed by tab
              so switching starts the next one back at the top. */}
          {onTemplatesTab ? (
            <AwardTemplatesSection
              templates={templates}
              onEdit={(template) => setTemplateWizard({ kind: "edit", template })}
              onDelete={(id) => setTemplates((prev) => prev.filter((t) => t.id !== id))}
              onEditLinkedAward={onEditAward}
            />
          ) : (
            <div className="pc-body" key={tab}>
              {tab === "permissions" ? (
                <PermissionsSection />
              ) : (
                <div className="wizard-fields">
                  {tab === "general" && (
                    <>
                      <ForceAppUpdateField
                        history={settings.forceUpdates}
                        onChange={set("forceUpdates")}
                      />
                      <NumberField
                        label="Webcam Capture Frequency in Seconds"
                        help="How often the webcam captures a frame during proctored sessions."
                        value={settings.webcamFrequency}
                        onChange={set("webcamFrequency")}
                        min={1}
                      />
                      <DeepLinksField links={APP_DEEP_LINKS} />
                    </>
                  )}

                  {tab === "display" && (
                    <>
                      <TabsField
                        label="App Tabs"
                        help="Customise the tabs shown in the learner app. Set the name per language, visibility, destination URL, and an icon."
                        rows={settings.appTabs}
                        onUpdate={update("appTabs")}
                      />
                      <TabsField
                        label="Dashboard Tabs"
                        help="Customise the tabs shown in the B2B dashboard. Set the name per language, visibility, destination URL, and an icon."
                        rows={settings.dashboardTabs}
                        onUpdate={update("dashboardTabs")}
                      />
                      <SupportPagesField
                        links={settings.supportLinks}
                        onChange={set("supportLinks")}
                      />
                    </>
                  )}

                  {tab === "b2c" && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Paywall Pricing</label>
                        <PriceIdGrid
                          rows={B2C_PRICE_ROWS}
                          ghost="Platform"
                          value={settings.b2cPrices}
                          onChange={set("b2cPrices")}
                        />
                        <p className="form-help">
                          Set the product / price ID for each platform and billing cycle. These IDs
                          are used to create subscriptions and checkout sessions for individual
                          learners.
                        </p>
                      </div>
                      <NumberField
                        label="Free Trial Duration in Days"
                        help="Number of days an individual learner gets free access before their trial converts to a paid subscription."
                        value={settings.b2cTrialDays}
                        onChange={set("b2cTrialDays")}
                      />
                      <NumberField
                        label="Initial Task Count"
                        help="Number of tasks an individual learner is given to start with when they first sign up."
                        value={settings.b2cInitialTaskCount}
                        onChange={set("b2cInitialTaskCount")}
                      />
                      <EpaCardField
                        value={settings.b2cEpaCard}
                        onChange={set("b2cEpaCard")}
                        note="This ID applies to the user app only. For the dashboard EPA card, set it under the B2B Management tab."
                      />
                    </>
                  )}

                  {tab === "b2b" && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Paywall Pricing</label>
                        <PriceIdGrid
                          rows={B2B_PRICE_ROWS}
                          ghost="Tier"
                          value={settings.b2bPrices}
                          onChange={set("b2bPrices")}
                        />
                        <p className="form-help">
                          Set the Stripe Price ID for each tier and billing cycle. These IDs are used
                          to create subscriptions and checkout sessions for B2B companies.
                        </p>
                      </div>
                      <NumberField
                        label="Free Trial Duration in Days"
                        help="Number of days a B2B company gets free access before their trial converts to a paid subscription."
                        value={settings.b2bTrialDays}
                        onChange={set("b2bTrialDays")}
                      />
                      <OptionListField
                        label="Partnerships"
                        help="Partner affiliation options assignable to B2B companies. Create, rename, or remove options as your partner programmes change."
                        column="PARTNERSHIP"
                        noun="Partnership"
                        fieldLabel="Name"
                        modalDesc="A partner affiliation that can be assigned to B2B companies."
                        emptyLabel="No partnerships configured."
                        options={settings.partnerships}
                        onChange={set("partnerships")}
                      />
                      <OptionListField
                        label="Trade"
                        help="Trade categories used to classify B2B companies and tailor their content. Create, rename, or remove options as needed."
                        column="TRADE"
                        noun="Trade"
                        fieldLabel="Name"
                        modalDesc="A trade category used to classify B2B companies and tailor their content."
                        emptyLabel="No trades configured."
                        options={settings.trades}
                        onChange={set("trades")}
                      />
                      <EpaCardField
                        value={settings.b2bEpaCard}
                        onChange={set("b2bEpaCard")}
                        note="This ID applies to the dashboard only. For the user app EPA card, set it under the B2C Management tab."
                      />
                      <OptionListField
                        label="Cancellation Reasons"
                        help="Options shown to admins when they cancel a B2B subscription. Add or remove reasons to customise the field values."
                        column="REASON"
                        noun="Reason"
                        fieldLabel="Reason"
                        modalDesc="An option admins can pick when they cancel a B2B subscription."
                        emptyLabel="No cancellation reasons configured."
                        options={settings.cancelReasons}
                        onChange={set("cancelReasons")}
                      />
                    </>
                  )}

                  {tab === "legal" && (
                    <>
                      <LegalDocField
                        title="Terms of Service"
                        titleEs="Términos de Servicio"
                        desc="The Terms of Service shown to learners. Provide both English and Spanish versions."
                        doc={settings.termsOfService}
                        onChange={set("termsOfService")}
                      />
                      <LegalDocField
                        title="Privacy Policy"
                        titleEs="Política de Privacidad"
                        desc="The Privacy Policy shown to learners. Provide both English and Spanish versions."
                        doc={settings.privacyPolicy}
                        onChange={set("privacyPolicy")}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Content Links' save bar: in-flow as the column's last child, so it
              spans the content area and stops at the left nav. It stays up on
              every tab while anything is unsaved, Award Templates included. */}
          {dirty && (
            <footer className="sp-save-footer">
              <div className="sp-save-footer-text">Unsaved Changes</div>
              <div className="sp-save-footer-actions">
                <button className="btn-save-draft" onClick={() => setSettings(saved)}>
                  Discard
                </button>
                <button className="btn-publish" onClick={() => setSaved(settings)}>
                  Save Changes
                </button>
              </div>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
