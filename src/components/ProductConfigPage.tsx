import { useEffect, useMemo, useRef, useState } from "react";
import { SYSTEM_DEEP_LINKS, type SystemDeepLink } from "../data/deepLinks";
import type { Award, AwardDesignTemplate } from "../data/awards";
import {
  DEFAULT_B2B_TRIAL_DAYS,
  DEFAULT_CANCELLATION_REASONS,
  DEFAULT_PARTNERSHIPS,
  DEFAULT_TRADES,
} from "../data/productConfig";
import { formatShortDate } from "../formatDate";
import { AddIcon, PlusThinIcon, RowCloseIcon, RowEditIcon, RowExternalLinkIcon, InfoIcon12 } from "./icons";
import { PrmModal } from "./PrmModal";
import { ImageUploadField, type PickedImage } from "./ImageUploadField";
import { RichTextField } from "./RichTextField";
import { Stepper } from "./Stepper";
import { PermissionsSection } from "./PermissionsPage";
import { AwardTemplatesSection } from "./AwardTemplatesSection";
import { NewDesignTemplateWizard } from "./NewDesignTemplateWizard";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { useLeaveGuard } from "./LeaveGuard";
import { useToast } from "./useToast";
import { CharCount, LimitError } from "./CharCount";
import { LimitedInput } from "./LimitedInput";
import { NAME_MAX, isOver, limitClass, limitLabel } from "../data/fieldLimits";

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
export type ProductConfigTab = "general" | "display" | "award-templates" | "b2c" | "b2b" | "legal" | "permissions";
type Tab = ProductConfigTab;

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
  /** The tab's icon — the shared single-image upload's pick. */
  icon: PickedImage | null;
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

/* The default B2B rates: a sample Stripe Price ID in every tier × cycle, so
   none starts blank. */
const DEFAULT_B2B_PRICES: PriceTable<Tier> = {
  Essentials: { Monthly: "price_1QEssMo7Hk2LpXa9TbR4vNcE", Annual: "price_1QEssAn3Wd8FqZt6YmK2sGhJ" },
  Growth: { Monthly: "price_1QGroMo5Rn9VbCx2LpQ8wEdT", Annual: "price_1QGroAn8Jt4MzKs7NfH3yUcB" },
  Professional: { Monthly: "price_1QProMo2Xc6TgWq9DkL5aVbN", Annual: "price_1QProAn9Ly3HsRf4PeG7mZtK" },
};

/** `date` is ISO "YYYY-MM-DD"; it prints through the app's `formatShortDate`. */
type ForceUpdate = { id: string; version: string; date: string };

type BilingualDoc = { en: string; es: string };


const tabRow = (id: string, nameEn: string, nameEs = ""): TabRow => ({
  id, nameEn, nameEs, visible: true, url: "", icon: null,
});

/* Every value the page's Save Changes covers. One object, so "is anything
   unsaved?" is one comparison against the last saved copy. The saved copy
   lives in App state, so it outlasts a visit to another page. */
export type ProductSettings = {
  forceUpdates: ForceUpdate[];
  webcamFrequency: string;
  initialTaskCount: string;
  appTabs: TabRow[];
  dashboardTabs: TabRow[];
  supportLinks: SupportLink[];
  b2cPrices: PriceTable<Platform>;
  b2cTrialDays: string;
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

type Settings = ProductSettings;

/** The B2B lists whose values records carry — removing one strips it from them. */
export type B2BListKey = "partnerships" | "trades" | "cancelReasons";
/** How many records carry a list value. Cancellation Reasons live on
 *  companies only, so their Task / Certification counts are always 0. */
export type B2BValueUsage = { companies: number; tasks: number; certifications: number };

export const DEFAULT_PRODUCT_SETTINGS: Settings = {
  forceUpdates: [
    { id: "fu-3", version: "4.2.0", date: "2026-06-02" },
    { id: "fu-2", version: "4.1.3", date: "2026-04-18" },
    { id: "fu-1", version: "4.0.0", date: "2026-01-27" },
  ],
  webcamFrequency: "20",
  initialTaskCount: "5",
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
  b2cEpaCard: "",
  b2bPrices: DEFAULT_B2B_PRICES,
  b2bTrialDays: String(DEFAULT_B2B_TRIAL_DAYS),
  partnerships: DEFAULT_PARTNERSHIPS,
  trades: DEFAULT_TRADES,
  b2bEpaCard: "",
  cancelReasons: DEFAULT_CANCELLATION_REASONS,
  termsOfService: { en: "", es: "" },
  privacyPolicy: { en: "", es: "" },
};

const SETTING_KEYS = Object.keys(DEFAULT_PRODUCT_SETTINGS) as (keyof Settings)[];

/* The whole-number settings and the least each may be saved at. Blank or
   below the minimum blocks Save Changes and flags the field. */
const NUMBER_MINS = {
  webcamFrequency: 1,
  initialTaskCount: 1,
  b2cTrialDays: 1,
  b2bTrialDays: 1,
} as const;
type NumberKey = keyof typeof NUMBER_MINS;
const NUMBER_LABELS: Record<NumberKey, string> = {
  webcamFrequency: "Webcam Capture Frequency",
  initialTaskCount: "Initial Tasks Count",
  b2cTrialDays: "B2C Free Trial Duration",
  b2bTrialDays: "B2B Free Trial Duration",
};
/** Why a number setting can't be saved, or null when it can. */
function numberProblem(key: NumberKey, value: string): string | null {
  if (!value.trim()) return "Cannot be left empty";
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < NUMBER_MINS[key]) return `Must be at least ${NUMBER_MINS[key]}`;
  return null;
}

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
  maxLength,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
  /** Names both inputs when the field's label isn't adjacent (a table cell). */
  ariaLabel?: string;
  /** A SOFT limit per language: each row shows the characters left and the
   *  shell flags amber past the suggested length, red past the limit — the
   *  caller's label row names the tier (`LimitError`) and Save Changes
   *  blocks on the red one. */
  maxLength?: number;
}) {
  const flag = maxLength !== undefined ? limitClass(maxLength, en, es) : "";
  const over = flag === "has-error";
  return (
    <div className={`lang-field ${flag}`}>
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input
          className="lang-field-input"
          value={en}
          onChange={(e) => onChangeEn(e.target.value)}
          placeholder={placeholderEn}
          aria-label={ariaLabel ? `${ariaLabel} (English)` : undefined}
          aria-invalid={over || undefined}
        />
        {maxLength !== undefined && <CharCount value={en} max={maxLength} />}
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
        {maxLength !== undefined && <CharCount value={es} max={maxLength} />}
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
  error,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  /** Blank or under `min` — the label row says which, the shell goes red,
   *  and Save Changes is blocked. */
  error?: string | null;
}) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
        {error && <span className="form-label-error">{error}</span>}
      </label>
      <Stepper
        value={value}
        onChange={(v) => onChange(v.replace(/[^0-9]/g, ""))}
        min={min}
        ariaLabel={label}
        hasError={!!error}
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
            <span className="qsec-empty">No Force Updates Configured Yet</span>
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
          active={history[0]?.version}
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

/** Compares dotted versions part by part ("4.10.0" > "4.9.2"; "4.2" = "4.2.0"). */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function ForceUpdateModal({
  existing,
  active,
  onForce,
  onCancel,
}: {
  existing: string[];
  /** The version currently forced — a new one must be higher. */
  active?: string;
  onForce: (version: string) => void;
  onCancel: () => void;
}) {
  const [version, setVersion] = useState("");
  const v = version.trim();
  const isFormat = VERSION_RE.test(v);
  const isDuplicate = isFormat && existing.includes(v);
  const isLower = isFormat && !isDuplicate && !!active && compareVersions(v, active) <= 0;
  const isValid = isFormat && !isDuplicate && !isLower;

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
            {v && !isFormat ? (
              <span className="form-label-error">Use numbers separated by dots, e.g. 4.3.0.</span>
            ) : isDuplicate ? (
              <span className="form-label-error">Version {v} is already in the log.</span>
            ) : isLower ? (
              <span className="form-label-error">Must be higher than the Active version, {active}.</span>
            ) : null}
          </span>
          <input
            autoFocus
            className={`form-input${(v && !isFormat) || isDuplicate || isLower ? " has-error" : ""}`}
            placeholder="e.g. 4.3.0"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            spellCheck={false}
          />
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
      confirmLabel="Remove"
      danger
      onCancel={onCancel}
      onConfirm={onRemove}
    >
      <p className="prm-content">
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
      </p>
    </PrmModal>
  );
}

/* Read-only: a reference list, so the rows carry no controls — just the link
   out to each destination. */
function DeepLinksField({ links }: { links: SystemDeepLink[] }) {
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
              href={link.url}
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

/* App / Dashboard tabs — the page's OptionListField pattern (user,
   2026-10-06: "This table should just show the name and URL, not as an input
   field. Edit icon opens the editor"): plain `.qsec` rows — the EN name, the
   URL ("—" when blank) and the visibility switch — with an edit pencil. The
   tabs are a fixed set, so there is no remove ✕ and no Add row. The pencil
   opens TabEditModal, where the name, URL and icon are edited; it writes back
   to the page draft, so Save Changes saves it like every other setting. */
function TabsField({
  label,
  help,
  rows,
  onUpdate,
}: {
  label: string;
  help: string;
  rows: TabRow[];
  onUpdate: (fn: (rows: TabRow[]) => TabRow[]) => void;
}) {
  const [editing, setEditing] = useState<TabRow | null>(null);
  const setRow = (id: string, patch: Partial<TabRow>) =>
    onUpdate((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="qsec">
        <div className="qsec-hd">
          <span className="pc-col-grow">TAB NAME</span>
          <span className="pc-col-grow">URL</span>
          <span className="pc-col-toggle">VISIBLE?</span>
          <span className="pc-col-edit" aria-hidden />
        </div>
        {rows.map((row) => {
          const name = row.nameEn.trim() || "this tab";
          return (
            <div className="qsec-row" key={row.id}>
              <span className="pc-col-grow pc-strong">{row.nameEn}</span>
              <span className="pc-col-grow pc-muted">{row.url.trim() || "—"}</span>
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
              <span className="pc-col-edit">
                <button
                  className="qsec-x"
                  title="Edit"
                  aria-label={`Edit ${name}`}
                  onClick={() => setEditing(row)}
                >
                  <RowEditIcon />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <p className="form-help">{help}</p>

      {editing && (
        <TabEditModal
          row={editing}
          onCancel={() => setEditing(null)}
          onSave={(patch) => {
            setRow(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* Edit one tab — the shared modal shell (Figma 667:884), OptionNameModal's
   shape: Tab Name (dual-language, required, the 128 soft limit named in its
   label row), URL, and the Icon on the shared single-image upload (678:2012 /
   1529:3890). */
function TabEditModal({
  row,
  onCancel,
  onSave,
}: {
  row: TabRow;
  onCancel: () => void;
  onSave: (patch: Pick<TabRow, "nameEn" | "nameEs" | "url" | "icon">) => void;
}) {
  const [nameEn, setNameEn] = useState(row.nameEn);
  const [nameEs, setNameEs] = useState(row.nameEs);
  const [url, setUrl] = useState(row.url);
  const [icon, setIcon] = useState<PickedImage | null>(row.icon);
  const isValid = !!nameEn.trim() && !isOver(NAME_MAX, nameEn, nameEs);

  useEscape(onCancel);

  return (
    <PrmModal
      title="Edit Tab"
      confirmLabel="Save Tab"
      confirmDisabled={!isValid}
      onCancel={onCancel}
      onConfirm={() =>
        isValid && onSave({ nameEn: nameEn.trim(), nameEs: nameEs.trim(), url: url.trim(), icon })
      }
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            Tab Name<span className="prm-req">*</span>
            <LimitError max={NAME_MAX} values={[nameEn, nameEs]} />
          </span>
          <LangField
            en={nameEn}
            es={nameEs}
            onChangeEn={setNameEn}
            onChangeEs={setNameEs}
            placeholderEn="Tab Name..."
            placeholderEs="Nombre de la Pestaña..."
            maxLength={NAME_MAX}
          />
        </div>
        <div className="prm-field">
          <span className="prm-label">URL</span>
          <input
            className="form-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL..."
            spellCheck={false}
          />
        </div>
        <div className="prm-field">
          <span className="prm-label">Icon</span>
          <ImageUploadField value={icon} onChange={setIcon} />
        </div>
      </div>
    </PrmModal>
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
        Stripe Product ID for the EPA card. Checkout uses the Product's default Price when a
        learner purchases their EPA card.
        <span className="form-help-info" tabIndex={0} role="note" aria-label={note} data-tip={note}>
          <InfoIcon12 />
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
  onRequestRemove,
}: {
  /** Removing goes through the caller (a usage warning and a confirm) instead
   *  of dropping the row straight away. */
  onRequestRemove?: (value: string) => void;
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
                onClick={() => (onRequestRemove ? onRequestRemove(opt) : removeAt(i))}
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

/* Removing a Partnership, Trade or Cancellation Reason. Records carry these
   values, so the warning says how many do before anything goes — then the
   standard second confirm every destructive action gets. */
function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
function usageSentence(u: B2BValueUsage): string | null {
  const parts = [
    u.companies > 0 && plural(u.companies, "company", "companies"),
    u.tasks > 0 && plural(u.tasks, "Task"),
    u.certifications > 0 && plural(u.certifications, "Certification"),
  ].filter((p): p is string => !!p);
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
function RemoveValueModal({
  noun, value, usage, onCancel, onConfirm,
}: {
  noun: string;
  value: string;
  usage: B2BValueUsage;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const carriedBy = usageSentence(usage);
  return (
    <PrmModal
      title={`Remove ${noun}?`}
      confirmLabel={`Remove ${noun}`}
      cancelLabel="Cancel"
      danger
      onCancel={onCancel}
      onConfirm={onConfirm}
      doubleConfirmLabel={`Yes, Remove ${noun}`}
      doubleConfirm={
        <>
          <strong>{value}</strong> will be removed
          {carriedBy ? <> from {carriedBy}</> : null} and from every filter and picker. This
          can't be undone.
        </>
      }
    >
      <p className="prm-content">
        {carriedBy ? (
          <>
            <strong>{value}</strong> is on {carriedBy}. Removing it takes it off all of them,
            and out of every filter and picker. This is saved straight away.
          </>
        ) : (
          <>
            No companies, Tasks or Certifications carry <strong>{value}</strong>. Removing it
            takes it out of every filter and picker. This is saved straight away.
          </>
        )}
      </p>
    </PrmModal>
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
  const isValid = !!trimmed && !isDuplicate && !isOver(NAME_MAX, value);

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
            {isDuplicate && (
              <span className="form-label-error">“{trimmed}” is already in the list.</span>
            )}
            <LimitError max={NAME_MAX} values={[value]} />
          </span>
          <LimitedInput
            max={NAME_MAX}
            autoFocus
            className={`form-input${isDuplicate ? " has-error" : ""}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={`${fieldLabel}...`}
          />
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
  navKey,
  saved,
  onSave,
  templates,
  setTemplates,
  onEditAward,
  usageOf,
  onRemoveValue,
}: {
  /** How many companies / Tasks / Certifications carry a list value. */
  usageOf?: (list: B2BListKey, value: string) => B2BValueUsage;
  /** Confirmed removal of a list value: App drops it from the SAVED list and
   *  strips it from every record that carries it. Saved straight away — it
   *  can't wait for Save Changes, the records have already lost it. */
  onRemoveValue?: (list: B2BListKey, value: string) => void;
  initialTab?: Tab;
  /** Changes on every navigation to this page (App's view object), so a link
   *  to a tab switches to it even while the page is already open. */
  navKey?: unknown;
  /** The last SAVED settings — App state, so they persist across pages. */
  saved: Settings;
  /** Save Changes: App stores them and publishes what other pages read. */
  onSave: (settings: Settings) => void;
  /** Award Design Templates — App state, shared with the Award wizard. */
  templates: AwardDesignTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<AwardDesignTemplate[]>>;
  /** Leaves for the Awards page, on one Award — the Award Templates tab uses
   *  it to reach an Award that still holds a template you tried to delete. */
  onEditAward?: (award: Award) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "general");
  // A tab link followed while already here: go to that tab. (Not on mount —
  // useState above already opened on it.)
  const firstNav = useRef(true);
  useEffect(() => {
    if (firstNav.current) {
      firstNav.current = false;
      return;
    }
    if (initialTab) setTab(initialTab);
  }, [navKey, initialTab]);
  const [settings, setSettings] = useState<Settings>(saved);
  /* A list value waiting on the remove warning (Partnerships, Trade,
     Cancellation Reasons). */
  const [removing, setRemoving] = useState<{ list: B2BListKey; noun: string; value: string } | null>(null);
  const requestRemove = (list: B2BListKey, noun: string) => (value: string) =>
    setRemoving({ list, noun, value });
  /* One toast for the page: the save footer's "Settings Saved", and the
     template wizard's create/edit (raised here because the wizard closes back
     to this page as it saves) and the Award Templates delete. */
  const [toast, toastNode] = useToast();
  const dirty = useMemo(
    () => SETTING_KEYS.some((k) => !sameValue(settings[k], saved[k])),
    [settings, saved],
  );
  // Unsaved settings ask before any way off the page throws them away. Tabs
  // and the template wizard don't: the settings live up here and survive both.
  const guard = useLeaveGuard(dirty);
  // Tab names carry a SOFT limit: typing past it is allowed, saving isn't.
  // (Option names are gated in their own modal, so they never land here long.)
  const tabsOver = (rows: TabRow[]) => rows.some((r) => isOver(NAME_MAX, r.nameEn, r.nameEs));
  const overLimit = [
    tabsOver(settings.appTabs) && limitLabel("App Tabs", NAME_MAX),
    tabsOver(settings.dashboardTabs) && limitLabel("Dashboard Tabs", NAME_MAX),
  ].filter((x): x is string => !!x);
  // Number settings left blank or under their minimum.
  const numberErr = Object.fromEntries(
    (Object.keys(NUMBER_MINS) as NumberKey[]).map((k) => [k, numberProblem(k, settings[k])]),
  ) as Record<NumberKey, string | null>;
  const badNumbers = (Object.keys(NUMBER_MINS) as NumberKey[])
    .filter((k) => numberErr[k])
    .map((k) => `${NUMBER_LABELS[k]} (at least ${NUMBER_MINS[k]})`);
  const canSave = overLimit.length === 0 && badNumbers.length === 0;
  const blockedTip = canSave
    ? undefined
    : [
        ...(overLimit.length ? ["Shorten these to save:", ...overLimit.map((l) => `• ${l}`)] : []),
        ...(badNumbers.length ? ["Fill in a valid number to save:", ...badNumbers.map((l) => `• ${l}`)] : []),
      ].join("\n");

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
  const [templateWizard, setTemplateWizard] = useState<
    { kind: "new" } | { kind: "edit"; template: AwardDesignTemplate } | null
  >(null);
  const onTemplatesTab = tab === "award-templates";
  /* Award Templates' own confirms (delete, "still in use") report up, so C
     stands down while one is open — on top of the hook's own overlay check. */
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  useCreateShortcut(
    () => setTemplateWizard({ kind: "new" }),
    onTemplatesTab && !templateWizard && !templatesModalOpen,
  );

  if (templateWizard) {
    return (
      <NewDesignTemplateWizard
        editingTemplate={templateWizard.kind === "edit" ? templateWizard.template : undefined}
        allTemplates={templates}
        onClose={() => setTemplateWizard(null)}
        onSave={(t) => {
          const existed = templates.some((x) => x.id === t.id);
          setTemplates((prev) => {
            const i = prev.findIndex((x) => x.id === t.id);
            if (i < 0) return [t, ...prev];
            const next = [...prev]; next[i] = t; return next;
          });
          toast(existed ? "Template Updated" : "Template Created");
        }}
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
              onDelete={(id) => {
                setTemplates((prev) => prev.filter((t) => t.id !== id));
                toast("Template Deleted");
              }}
              onEditLinkedAward={onEditAward && ((award) => guard(() => onEditAward(award)))}
              onModalChange={setTemplatesModalOpen}
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
                        help="How often the webcam captures a frame during proctored sessions. Changes apply to future Proctored Quiz attempts only."
                        value={settings.webcamFrequency}
                        onChange={set("webcamFrequency")}
                        min={NUMBER_MINS.webcamFrequency}
                        error={numberErr.webcamFrequency}
                      />
                      <NumberField
                        label="Initial Tasks Count"
                        help="How many Tasks from the start of each Certification are open to B2C Starter users and B2B companies with no active plan. Final Exams stay locked regardless."
                        value={settings.initialTaskCount}
                        onChange={set("initialTaskCount")}
                        min={NUMBER_MINS.initialTaskCount}
                        error={numberErr.initialTaskCount}
                      />
                      <DeepLinksField links={SYSTEM_DEEP_LINKS} />
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
                        help="The trial length in days for new users."
                        value={settings.b2cTrialDays}
                        onChange={set("b2cTrialDays")}
                        min={NUMBER_MINS.b2cTrialDays}
                        error={numberErr.b2cTrialDays}
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
                        help="The trial length in days for new companies. The trial needs no payment method."
                        value={settings.b2bTrialDays}
                        onChange={set("b2bTrialDays")}
                        min={NUMBER_MINS.b2bTrialDays}
                        error={numberErr.b2bTrialDays}
                      />
                      <OptionListField
                        label="Partnerships"
                        help="Partner affiliation options assignable to B2B companies. Create, rename, or remove options as your partner programmes change."
                        column="PARTNERSHIP"
                        noun="Partnership"
                        fieldLabel="Name"
                        modalDesc="A partner affiliation that can be assigned to B2B companies."
                        emptyLabel="No Partnerships Configured Yet"
                        options={settings.partnerships}
                        onChange={set("partnerships")}
                        onRequestRemove={onRemoveValue && requestRemove("partnerships", "Partnership")}
                      />
                      <OptionListField
                        label="Trade"
                        help="Trade categories used to classify B2B companies and tailor their content. Create, rename, or remove options as needed."
                        column="TRADE"
                        noun="Trade"
                        fieldLabel="Name"
                        modalDesc="A trade category used to classify B2B companies and tailor their content."
                        emptyLabel="No Trades Configured Yet"
                        options={settings.trades}
                        onChange={set("trades")}
                        onRequestRemove={onRemoveValue && requestRemove("trades", "Trade")}
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
                        emptyLabel="No Cancellation Reasons Configured Yet"
                        options={settings.cancelReasons}
                        onChange={set("cancelReasons")}
                        onRequestRemove={onRemoveValue && requestRemove("cancelReasons", "Reason")}
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
                {/* `aria-disabled` rather than `disabled`, so the tooltip naming
                    what is over its limit still shows on hover. */}
                <button
                  className={`btn-publish${canSave ? "" : " is-disabled"}`}
                  aria-disabled={!canSave}
                  data-tip={blockedTip}
                  onClick={() => {
                    if (!canSave) return;
                    onSave(settings);
                    toast("Settings Saved");
                  }}
                >
                  Save Changes
                </button>
              </div>
            </footer>
          )}
        </div>
      </div>
      {removing && (
        <RemoveValueModal
          noun={removing.noun}
          value={removing.value}
          usage={usageOf?.(removing.list, removing.value) ?? { companies: 0, tasks: 0, certifications: 0 }}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const { list, value, noun } = removing;
            // Off the draft too, so the list on screen and the saved one agree.
            setSettings((s) => ({ ...s, [list]: s[list].filter((v) => v !== value) }));
            onRemoveValue?.(list, value);
            setRemoving(null);
            toast(`${noun} Removed`);
          }}
        />
      )}
      {toastNode}
    </div>
  );
}
