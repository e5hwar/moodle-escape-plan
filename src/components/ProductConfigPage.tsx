import { useDsText } from "../designSystem";
import { useEffect, useMemo, useRef, useState } from "react";
import { SYSTEM_DEEP_LINKS, type SystemDeepLink } from "../data/deepLinks";
import type { AwardDesignTemplate } from "../data/awards";
import {
  DEFAULT_B2B_TRIAL_DAYS,
  DEFAULT_CANCELLATION_REASONS,
  DEFAULT_PARTNERSHIPS,
  DEFAULT_TRADES,
} from "../data/productConfig";
import {
  DEFAULT_PRIVACY_POLICY_EN,
  DEFAULT_PRIVACY_POLICY_ES,
  DEFAULT_TERMS_OF_SERVICE_EN,
  DEFAULT_TERMS_OF_SERVICE_ES,
} from "../data/legal";
import { formatShortDate } from "../formatDate";
import { richTextContent } from "../richText";
import { AddIcon, CheckBoldIcon, PlusThinIcon, RowCloseIcon, RowEditIcon, RowExternalLinkIcon, InfoIcon12 } from "./icons";
import { NO_CHANGES_TIP, PrmModal } from "./PrmModal";
import { ChangesFooter, ChangesReviewList, type StagedChange } from "./ChangesFooter";
import { ImageUploadField, type PickedImage } from "./ImageUploadField";
import { RichDocField } from "./RichDocField";
import { Stepper } from "./Stepper";
import { PermissionsSection } from "./PermissionsPage";
import { AwardTemplatesSection } from "./AwardTemplatesSection";
import { PlaceholderPage } from "./PlaceholderPage";
import { MultiSelect } from "./NewCompanyWizard";
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
     header row, a row per entry and an orange "+ Add" row closing the card —
     in its PROPORTIONAL variant (`.ct-prop`): the columns grow together;
   - numbers are the `Stepper` (618:1264), Price IDs the paywall matrix
     (752:2816), bilingual copy `LangField`, the legal documents `RichDocField`;
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
type PriceTable<K extends string> = Record<K, Record<Cycle, string>>;

type PriceRow<K extends string> = { key: K; name: string };

/* B2B paywall rows: a Stripe Price ID per tier. (B2C Management's own
   Paywall Pricing — Apple / Google / Stripe IDs — was removed 2026-11-05.) */
const B2B_PRICE_ROWS: PriceRow<Tier>[] = [
  { key: "Essentials", name: "Stripe Price ID" },
  { key: "Growth", name: "Stripe Price ID" },
  { key: "Professional", name: "Stripe Price ID" },
];

/* The default B2B rates: a sample Stripe Price ID in every tier × cycle, so
   none starts blank. */
const DEFAULT_B2B_PRICES: PriceTable<Tier> = {
  Essentials: { Monthly: "price_1QEssMo7Hk2LpXa9TbR4vNcE", Annual: "price_1QEssAn3Wd8FqZt6YmK2sGhJ" },
  Growth: { Monthly: "price_1QGroMo5Rn9VbCx2LpQ8wEdT", Annual: "price_1QGroAn8Jt4MzKs7NfH3yUcB" },
  Professional: { Monthly: "price_1QProMo2Xc6TgWq9DkL5aVbN", Annual: "price_1QProAn9Ly3HsRf4PeG7mZtK" },
};

/** `date` is ISO "YYYY-MM-DD"; it prints through the app's `formatShortDate`. */
/** One released app version: the platforms it's available on, and whether it's
 *  marked as the minimum there — a version can only be the minimum on a
 *  platform it's available on. The newest marked version per platform is the
 *  one being forced; older marks are history. */
type AppPlatform = "ios" | "android";
type PlatformFlags = Record<AppPlatform, boolean>;
type AppVersion = {
  id: string;
  version: string;
  available: PlatformFlags;
  minimum: PlatformFlags;
  date: string;
};
/** Table order (iOS first, as the list has always read). */
const APP_PLATFORMS: { key: AppPlatform; name: string; head: string }[] = [
  { key: "ios", name: "iOS", head: "AVAILABLE ON IOS" },
  { key: "android", name: "Android", head: "AVAILABLE ON ANDROID" },
];
/** The Add New Version modal's order (user, 2026-11-05): the Android pair
 *  first, then the iOS pair. */
const MODAL_PLATFORMS = [...APP_PLATFORMS].reverse();
const NO_PLATFORMS: PlatformFlags = { ios: false, android: false };
const platformFlags = (on: AppPlatform[]): PlatformFlags => ({
  ios: on.includes("ios"),
  android: on.includes("android"),
});
/** A seeded version: available on `available`, and marked as the minimum on
 *  `minimum` (every available platform unless said otherwise). */
const appVersion = (
  id: string,
  version: string,
  date: string,
  available: AppPlatform[],
  minimum: AppPlatform[] = available,
): AppVersion => ({ id, version, date, available: platformFlags(available), minimum: platformFlags(minimum) });

/** A What's New page and the app versions that open it after updating. A
 *  version belongs to one page at most. */
type WhatsNewPage = { id: string; url: string; versions: string[] };
/** The released app versions a What's New page can be set for, newest first. */
const APP_VERSIONS = ["4.3.0", "4.2.1", "4.2.0", "4.1.3", "4.1.2", "4.1.0", "4.0.0"];

type BilingualDoc = { en: string; es: string };


/* A seeded tab's icon: every tab needs one, so the defaults carry a plain
   lettered tile, saved earlier (no byte size on record). */
const seedIcon = (slug: string, letter: string): PickedImage => ({
  name: `${slug}-icon.png`,
  size: 0,
  ext: "PNG",
  url:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="20" fill="#f05523"/><text x="48" y="62" font-family="Arial,sans-serif" font-size="44" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`,
    ),
});

const tabRow = (id: string, nameEn: string, nameEs: string, url: string): TabRow => ({
  id, nameEn, nameEs, visible: true, url, icon: seedIcon(id, nameEn[0]),
});

/* Every value the page's Save Changes covers. One object, so "is anything
   unsaved?" is one comparison against the last saved copy. The saved copy
   lives in App state, so it outlasts a visit to another page. */
export type ProductSettings = {
  forceUpdates: AppVersion[];
  whatsNewPages: WhatsNewPage[];
  webcamFrequency: string;
  initialTaskCount: string;
  appTabs: TabRow[];
  dashboardTabs: TabRow[];
  supportLinks: SupportLink[];
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
    appVersion("fu-5", "4.2.1", "2026-07-14", ["android"]),
    appVersion("fu-4", "4.2.0", "2026-06-02", ["ios", "android"]),
    appVersion("fu-3", "4.1.3", "2026-04-18", ["ios"]),
    appVersion("fu-2", "4.1.0", "2026-03-03", ["ios", "android"], []),
    appVersion("fu-1", "4.0.0", "2026-01-27", ["ios", "android"]),
  ],
  whatsNewPages: [
    { id: "wn-2", url: "https://skillcat.app/whats-new/4-2", versions: ["4.2.1", "4.2.0"] },
    { id: "wn-1", url: "https://skillcat.app/whats-new/4-1", versions: ["4.1.3", "4.1.2", "4.1.0"] },
  ],
  webcamFrequency: "20",
  initialTaskCount: "5",
  appTabs: [
    tabRow("app-lab", "Lab", "Laboratorio", "https://skillcat.app/lab"),
    tabRow("app-resources", "Resources", "Recursos", "https://skillcat.app/resources"),
  ],
  dashboardTabs: [
    tabRow("dash-assessments", "Assessments", "Evaluaciones", "https://dashboard.skillcat.app/assessments"),
    tabRow("dash-troubleshooting", "Troubleshooting", "Solución de Problemas", "https://dashboard.skillcat.app/troubleshooting"),
    tabRow("dash-manuals", "Manuals", "Manuales", "https://dashboard.skillcat.app/manuals"),
    tabRow("dash-error-codes", "Error Codes", "Códigos de Error", "https://dashboard.skillcat.app/error-codes"),
    tabRow("dash-analytics", "Analytics", "Analíticas", "https://dashboard.skillcat.app/analytics"),
  ],
  supportLinks: [
    { id: "sup-b2b-dashboard", label: "B2B Dashboard", url: "https://dashboard.skillcat.app" },
    { id: "sup-guides", label: "Guides", url: "https://skillcat.app/guides" },
    { id: "sup-message", label: "Send Us A Message", url: "https://skillcat.app/contact" },
    { id: "sup-news", label: "News", url: "https://skillcat.app/news" },
  ],
  b2cTrialDays: "3",
  b2cEpaCard: "prod_QEpaApp7Lx2Nc9RvTb",
  b2bPrices: DEFAULT_B2B_PRICES,
  b2bTrialDays: String(DEFAULT_B2B_TRIAL_DAYS),
  partnerships: DEFAULT_PARTNERSHIPS,
  trades: DEFAULT_TRADES,
  b2bEpaCard: "prod_QEpaDash4Kt8Wm3BzHs",
  cancelReasons: DEFAULT_CANCELLATION_REASONS,
  termsOfService: { en: DEFAULT_TERMS_OF_SERVICE_EN, es: DEFAULT_TERMS_OF_SERVICE_ES },
  privacyPolicy: { en: DEFAULT_PRIVACY_POLICY_EN, es: DEFAULT_PRIVACY_POLICY_ES },
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
const EMPTY_ERROR = "Cannot be left empty";
/** Why a number setting can't be saved, or null when it can. */
function numberProblem(key: NumberKey, value: string): string | null {
  if (!value.trim()) return EMPTY_ERROR;
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

/* ─── Column widths ───
   Product Config's lists are the PROPORTIONAL card table (`.ct-prop`): each
   data column's starting width is its content's (longest typical value or
   header label, measured at 16px Fira Sans), and the card's spare width is
   shared across the data columns in proportion to it. The glyph columns
   (✕, edit, open, actions) stay fixed. */
const cw = (px: number) => ({ "--cw": px }) as React.CSSProperties;
// Equal peers (user): the version, both platforms, the date and the status.
const FU_COLS = { version: cw(140), ios: cw(140), android: cw(140), date: cw(140), status: cw(140) };
// Add New Version's platform table: the name, then its two switch columns.
const PLATFORM_COLS = { platform: cw(120), available: cw(100), required: cw(150) };
const WN_COLS = { link: cw(360), versions: cw(200) };
const DL_COLS = { dest: cw(160), link: cw(280), login: cw(120) };
const TAB_COLS = { name: cw(160), url: cw(360), visible: cw(64) };
const SUP_COLS = { page: cw(160), url: cw(400) };
const OPTION_COLS = { name: cw(240) };

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

/* A URL, on the Spotlight Button Destination's shell (Figma 699:1071 without
   its host prefix): the address and a "Test It Out" link that opens it in a
   new tab, both inside the one cell. The link only shows once there is an
   address (1675:1438 is the empty field, link-free). Every URL on the page is
   required, so a blank one goes red. */
function UrlField({
  value,
  onChange,
  ariaLabel,
  autoFocus,
  flagBlank = true,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  autoFocus?: boolean;
  /** Off while a new entry's field hasn't been visited yet, so an empty
   *  modal doesn't open red. */
  flagBlank?: boolean;
  onBlur?: () => void;
}) {
  const t = useDsText();
  const blank = !value.trim();
  return (
    <div className={`deeplink-input${blank && flagBlank ? " invalid" : ""}`}>
      <div className="deeplink-cell">
        <input
          className="deeplink-slug"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("URL...")}
          aria-label={ariaLabel}
          aria-invalid={(blank && flagBlank) || undefined}
          autoFocus={autoFocus}
          onBlur={onBlur}
          spellCheck={false}
        />
        {/* Empty (Figma 1675:1438): the field alone — no link to follow. */}
        {!blank && (
          <button
            type="button"
            className="deeplink-copy"
            onClick={() => window.open(value.trim(), "_blank", "noopener,noreferrer")}
          >
            {t("Test It Out")}
          </button>
        )}
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
  const t = useDsText();
  return (
    <div className="form-group">
      <label className="form-label">
        {t(label)}
        <span className="req">*</span>
        {error && <span className="form-label-error">{error}</span>}
      </label>
      <Stepper
        value={value}
        onChange={(v) => onChange(v.replace(/[^0-9]/g, ""))}
        min={min}
        ariaLabel={label}
        hasError={!!error}
      />
      <p className="form-help">{t(help)}</p>
    </div>
  );
}

/* Price IDs per row × billing cycle, on the paywall matrix (Figma 752:2816):
   the row labels on the left, one column of inputs per cycle. There is no Add
   tile — the tiers and cycles are fixed. The label column repeats the heading
   row as invisible text so its rows stay level with the inputs. Every ID is
   required: a blank one goes red and blocks Save. */
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
                className={`form-input${value[r.key][cycle].trim() ? "" : " has-error"}`}
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
  versions,
  onChange,
}: {
  versions: AppVersion[];
  onChange: (v: AppVersion[]) => void;
}) {
  const t = useDsText();
  const [modal, setModal] = useState<{ kind: "new" } | { kind: "edit"; entry: AppVersion } | null>(null);
  const [removing, setRemoving] = useState<AppVersion | null>(null);
  const editing = modal?.kind === "edit" ? modal.entry : null;

  // An edit keeps the row's id, place and Added On date; only its number and
  // platforms change. A new version goes on top, dated today.
  function save(patch: VersionPatch) {
    onChange(
      editing
        ? versions.map((v) => (v.id === editing.id ? { ...v, ...patch } : v))
        : [{ id: `fu-${Date.now()}`, ...patch, date: todayIso() }, ...versions],
    );
    setModal(null);
  }

  function remove(id: string) {
    onChange(versions.filter((v) => v.id !== id));
    setRemoving(null);
  }

  return (
    <div className="form-group">
      <label className="form-label">{t("Force App Update")}</label>
      {/* One row per released version, newest first. The newest row marked as
          the minimum on a platform is the version forced there — so the list
          IS the current state, and older marks are history. A row can be the
          minimum on iOS while a newer Android-only row holds Android. */}
      <div className="qsec ct-prop">
        <div className="qsec-hd">
          <span className="ct-col" style={FU_COLS.version}>VERSION</span>
          {APP_PLATFORMS.map((p) => (
            <span key={p.key} className="ct-col" style={FU_COLS[p.key]}>{p.head}</span>
          ))}
          <span className="ct-col" style={FU_COLS.date}>ADDED ON</span>
          <span className="ct-col pc-col-status" style={FU_COLS.status}>STATUS</span>
          <span className="pc-col-actions" aria-hidden />
        </div>

        {versions.length === 0 && (
          <div className="qsec-row">
            <span className="qsec-empty">{t("No App Versions Added Yet")}</span>
          </div>
        )}

        {versions.map((v) => {
          const minimumFor = minimumPlatforms(versions, v);
          return (
            <div className="qsec-row" key={v.id}>
              <span className="ct-col pc-strong" style={FU_COLS.version}>{v.version}</span>
              {APP_PLATFORMS.map((p) =>
                v.available[p.key] ? (
                  <span
                    key={p.key}
                    className="ct-col pc-check"
                    style={FU_COLS[p.key]}
                    role="img"
                    aria-label={`Available on ${p.name}`}
                  >
                    <CheckBoldIcon />
                  </span>
                ) : (
                  <span key={p.key} className="ct-col pc-muted" style={FU_COLS[p.key]}>
                    —
                  </span>
                ),
              )}
              <span className="ct-col pc-muted" style={FU_COLS.date}>{formatShortDate(v.date)}</span>
              <span className="ct-col pc-col-status" style={FU_COLS.status}>
                {minimumFor.length === 0 ? (
                  <span className="pc-muted">—</span>
                ) : (
                  <span className="co-status-pill co-status-pill--green">
                    {minimumFor.length === APP_PLATFORMS.length
                      ? "Minimum Version"
                      : `Minimum on ${minimumFor.map((p) => p.name).join(" & ")}`}
                  </span>
                )}
              </span>
              <span className="pc-col-actions">
                <button
                  className="qsec-x"
                  title="Edit"
                  aria-label={`Edit version ${v.version}`}
                  onClick={() => setModal({ kind: "edit", entry: v })}
                >
                  <RowEditIcon />
                </button>
                <button
                  className="qsec-x"
                  title="Remove"
                  aria-label={`Remove version ${v.version}`}
                  onClick={() => setRemoving(v)}
                >
                  <RowCloseIcon />
                </button>
              </span>
            </div>
          );
        })}

        <div className="qsec-foot">
          <button className="qsec-add" onClick={() => setModal({ kind: "new" })}>
            <PlusThinIcon />
            {t("Add New Version")}
          </button>
        </div>
      </div>
      <p className="form-help">
        Every released app version and where it's available. Mark a version as the minimum on a
        platform to force learners there on older versions to update before they can continue.
      </p>

      {modal && (
        <VersionModal
          // Keyed so switching from one row's edit to another starts fresh.
          key={editing?.id ?? "new"}
          entry={editing}
          versions={versions}
          onSave={save}
          onCancel={() => setModal(null)}
        />
      )}
      {removing && (
        <RemoveVersionModal
          entry={removing}
          versions={versions}
          onRemove={() => remove(removing.id)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

/** The platform's newest version marked as its minimum — the one forced there. */
const minimumEntry = (versions: AppVersion[], p: AppPlatform) => versions.find((v) => v.minimum[p]);

/** The platforms this version is the current minimum on. */
const minimumPlatforms = (versions: AppVersion[], entry: AppVersion) =>
  APP_PLATFORMS.filter((p) => minimumEntry(versions, p.key)?.id === entry.id);

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

/** What's wrong with the typed version, if anything. Blank is no error here —
 *  the CTA's tip asks for it. Requiring the update on a platform raises the
 *  bar: the version has to beat the minimum it takes over from — for a new
 *  version the one forced there now, for an edited row the newest mark BELOW
 *  it (older history above it doesn't apply, or every past minimum would
 *  fail its own edit). `self` is the row being edited, which never counts as
 *  its own duplicate. */
function versionError(
  v: string,
  versions: AppVersion[],
  minimum: PlatformFlags,
  self: AppVersion | null,
): string | null {
  if (!v) return null;
  if (!VERSION_RE.test(v)) return "Use numbers separated by dots, e.g. 4.3.0.";
  if (versions.some((x) => x.id !== self?.id && compareVersions(x.version, v) === 0))
    return `Version ${v} is already in the list.`;
  const older = self ? versions.slice(versions.findIndex((x) => x.id === self.id) + 1) : versions;
  for (const p of APP_PLATFORMS) {
    if (!minimum[p.key]) continue;
    const below = minimumEntry(older, p.key)?.version;
    if (below && compareVersions(v, below) <= 0)
      return `Must be higher than the ${self ? "previous " : ""}${p.name} minimum, ${below}.`;
  }
  return null;
}

/** The UPDATE REQUIRED? column's ⓘ. */
const UPDATE_REQUIRED_TIP =
  "Learners on this platform below this version are prompted to update before they can continue.\nOnly available once the version is available on the platform.";

type VersionPatch = Pick<AppVersion, "version" | "available" | "minimum">;

/* Add or edit a released version — the shared modal shell (667:884), the
   What's New Page shape: "Add New Version" / "Add Version" from the Add row,
   "Edit Version" / "Save Version" from a row's pencil, prefilled. The version
   number on its own line, then a Card Table (710:1083, as Product Config's
   lists draw it) with a row per platform and a switch in each of its
   AVAILABLE? and UPDATE REQUIRED? columns. The Update Required switch only
   opens once the version is available there, and turns off again when
   availability is switched off (user, 2026-11-05 — a card table instead of
   the first cut's paired check rows, then switch rows, same day). Save
   Version waits for a change (the app's Save Changes gate). */
function VersionModal({
  entry,
  versions,
  onSave,
  onCancel,
}: {
  entry: AppVersion | null;
  versions: AppVersion[];
  onSave: (patch: VersionPatch) => void;
  onCancel: () => void;
}) {
  const t = useDsText();
  const [version, setVersion] = useState(entry?.version ?? "");
  const [available, setAvailable] = useState<PlatformFlags>(entry?.available ?? NO_PLATFORMS);
  const [minimum, setMinimum] = useState<PlatformFlags>(entry?.minimum ?? NO_PLATFORMS);
  const typed = version.trim();
  const error = versionError(typed, versions, minimum, entry);
  const anyPlatform = APP_PLATFORMS.some((p) => available[p.key]);
  const unchanged =
    !!entry &&
    typed === entry.version &&
    sameValue(available, entry.available) &&
    sameValue(minimum, entry.minimum);
  const isValid = !!typed && !error && anyPlatform && !unchanged;
  const tip = unchanged
    ? NO_CHANGES_TIP
    : !typed
      ? "Enter a version number"
      : !anyPlatform
        ? "Select at least one platform"
        : undefined;

  useEscape(onCancel);

  function toggleAvailable(p: AppPlatform) {
    const on = !available[p];
    setAvailable((a) => ({ ...a, [p]: on }));
    if (!on) setMinimum((m) => ({ ...m, [p]: false }));
  }

  function submit() {
    if (isValid) onSave({ version: typed, available, minimum });
  }

  return (
    <PrmModal
      title={t(entry ? "Edit Version" : "Add New Version")}
      description={
        entry
          ? "Change the version number or the platforms it's available on. Requiring the update on a platform prompts learners there on older versions to update before they can continue."
          : "Add a released app version and the platforms it's available on. Requiring the update on a platform prompts learners there on older versions to update before they can continue."
      }
      confirmLabel={t(entry ? "Save Version" : "Add Version")}
      confirmDisabled={!isValid}
      confirmTip={tip}
      onCancel={onCancel}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            Version<span className="prm-req">*</span>
            {error && <span className="form-label-error">{error}</span>}
          </span>
          <input
            autoFocus
            className={`form-input${error ? " has-error" : ""}`}
            placeholder={`e.g. ${nextVersionHint(versions[0]?.version)}`}
            aria-label="Version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            spellCheck={false}
          />
        </div>
        <div className="prm-field">
          <span className="prm-label">
            Platforms<span className="prm-req">*</span>
          </span>
          <div className="qsec ct-prop">
            <div className="qsec-hd">
              <span className="ct-col" style={PLATFORM_COLS.platform}>PLATFORM</span>
              <span className="ct-col pc-col-toggle" style={PLATFORM_COLS.available}>AVAILABLE?</span>
              <span className="ct-col pc-col-toggle" style={PLATFORM_COLS.required}>
                UPDATE REQUIRED?
                <span
                  className="form-help-info"
                  tabIndex={0}
                  role="note"
                  aria-label={UPDATE_REQUIRED_TIP}
                  data-tip={UPDATE_REQUIRED_TIP}
                >
                  <InfoIcon12 />
                </span>
              </span>
            </div>
            {MODAL_PLATFORMS.map((p) => (
              <div className="qsec-row" key={p.key}>
                <span className="ct-col pc-strong" style={PLATFORM_COLS.platform}>{p.name}</span>
                <span className="ct-col pc-col-toggle" style={PLATFORM_COLS.available}>
                  <Switch
                    label={`Available on ${p.name}`}
                    on={available[p.key]}
                    onToggle={() => toggleAvailable(p.key)}
                  />
                </span>
                <span className="ct-col pc-col-toggle" style={PLATFORM_COLS.required}>
                  <Switch
                    label={`Update required on ${p.name}`}
                    on={minimum[p.key]}
                    disabled={!available[p.key]}
                    onToggle={() => setMinimum((m) => ({ ...m, [p.key]: !m[p.key] }))}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PrmModal>
  );
}

/** The bare 41×24 switch in a card-table cell (the Tabs lists' VISIBLE?).
 *  Disabled = the app's solid-grey look (knob #7a7a7a), never opacity. */
function Switch({
  label,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`toggle${on ? " on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onToggle()}
    >
      <span className="toggle-knob" />
    </button>
  );
}

/** A plausible next version to show as the placeholder: the newest in the
 *  list with its minor part bumped ("4.2.1" → "4.3.0"). */
function nextVersionHint(newest?: string): string {
  if (!newest) return "4.3.0";
  const [major = 0, minor = 0] = newest.split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}

function RemoveVersionModal({
  entry,
  versions,
  onRemove,
  onCancel,
}: {
  entry: AppVersion;
  versions: AppVersion[];
  onRemove: () => void;
  onCancel: () => void;
}) {
  const t = useDsText();
  useEscape(onCancel);

  // Any version can go. Where it's the minimum on a platform, that platform's
  // previous marked version takes over; older rows are history.
  const minimumFor = minimumPlatforms(versions, entry);
  const rest = versions.filter((v) => v.id !== entry.id);

  return (
    <PrmModal
      title={t("Remove Version?")}
      confirmLabel="Remove"
      danger
      onCancel={onCancel}
      onConfirm={onRemove}
    >
      <p className="prm-content">
        Remove version <strong>{entry.version}</strong>?{" "}
        {minimumFor.length === 0 ? (
          <>It isn't the minimum on any platform, so no learner is affected.</>
        ) : (
          minimumFor.map((p, i) => {
            const fallback = minimumEntry(rest, p.key)?.version;
            return (
              <span key={p.key}>
                {i > 0 && " "}
                {fallback ? (
                  <>
                    {p.name} users will fall back to the previous minimum,{" "}
                    <strong>{fallback}</strong>.
                  </>
                ) : (
                  <>No minimum will be forced on {p.name} after this.</>
                )}
              </span>
            );
          })
        )}
      </p>
    </PrmModal>
  );
}

/* What's New Page — the OptionListField pattern: plain rows (the link and its
   versions) with an edit pencil and a remove ✕, and the Add row closing the
   card. Adding and editing open WhatsNewModal; both write to the page draft,
   so Save Changes saves them like the Force App Update log above. */
function WhatsNewField({
  pages,
  onChange,
}: {
  pages: WhatsNewPage[];
  onChange: (p: WhatsNewPage[]) => void;
}) {
  const t = useDsText();
  const [modal, setModal] = useState<{ kind: "new" } | { kind: "edit"; page: WhatsNewPage } | null>(null);
  const [removing, setRemoving] = useState<WhatsNewPage | null>(null);
  const editing = modal?.kind === "edit" ? modal.page : null;

  return (
    <div className="form-group">
      <label className="form-label">{t("What's New Page")}</label>
      <div className="qsec ct-prop">
        <div className="qsec-hd">
          <span className="ct-col" style={WN_COLS.link}>LINK</span>
          <span className="ct-col" style={WN_COLS.versions}>VERSIONS</span>
          <span className="pc-col-actions" aria-hidden />
        </div>

        {pages.length === 0 && (
          <div className="qsec-row">
            <span className="qsec-empty">{t("No What's New Pages Added Yet")}</span>
          </div>
        )}

        {pages.map((p) => (
          <div className="qsec-row" key={p.id}>
            <span className="ct-col pc-muted" style={WN_COLS.link}>{p.url}</span>
            <span className="ct-col pc-strong" style={WN_COLS.versions}>
              {sortVersions(p.versions).join(", ")}
            </span>
            <span className="pc-col-actions">
              <button
                className="qsec-x"
                title="Edit"
                aria-label={`Edit What's New page ${p.url}`}
                onClick={() => setModal({ kind: "edit", page: p })}
              >
                <RowEditIcon />
              </button>
              <button
                className="qsec-x"
                title="Remove"
                aria-label={`Remove What's New page ${p.url}`}
                onClick={() => setRemoving(p)}
              >
                <RowCloseIcon />
              </button>
            </span>
          </div>
        ))}

        <div className="qsec-foot">
          <button className="qsec-add" onClick={() => setModal({ kind: "new" })}>
            <PlusThinIcon />
            {t("Add What's New Page")}
          </button>
        </div>
      </div>
      <p className="form-help">
        {t("The page learners see after updating the app to one of its versions. Each version opens one page at most.")}
      </p>

      {modal && (
        <WhatsNewModal
          page={editing}
          others={pages.filter((p) => p.id !== editing?.id)}
          onCancel={() => setModal(null)}
          onSubmit={(patch) => {
            onChange(
              editing
                ? pages.map((p) => (p.id === editing.id ? { ...p, ...patch } : p))
                : [{ id: `wn-${Date.now()}`, ...patch }, ...pages],
            );
            setModal(null);
          }}
        />
      )}
      {removing && (
        <RemoveWhatsNewModal
          page={removing}
          onCancel={() => setRemoving(null)}
          onRemove={() => {
            onChange(pages.filter((p) => p.id !== removing.id));
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

/** Newest first ("4.10.0" before "4.9.2"). */
const sortVersions = (v: string[]) => [...v].sort((a, b) => compareVersions(b, a));

/* New / Edit a What's New page — the shared modal shell, OptionNameModal's
   shape: Link (the page's URL field, with Test It Out) and Versions (the
   shared multiselect), both required. Versions another page already has stay
   listed but locked. A new entry's fields only go red once visited. */
function WhatsNewModal({
  page,
  others,
  onSubmit,
  onCancel,
}: {
  /** Null when adding. */
  page: WhatsNewPage | null;
  /** Every other page — their links can't repeat, their versions are taken. */
  others: WhatsNewPage[];
  onSubmit: (patch: Pick<WhatsNewPage, "url" | "versions">) => void;
  onCancel: () => void;
}) {
  const t = useDsText();
  const [url, setUrl] = useState(page?.url ?? "");
  const [versions, setVersions] = useState<string[]>(page?.versions ?? []);
  const [urlVisited, setUrlVisited] = useState(!!page);
  const [versionsVisited, setVersionsVisited] = useState(!!page);
  const link = url.trim();
  const isDuplicate = !!link && others.some((p) => p.url.trim().toLowerCase() === link.toLowerCase());
  const unchanged = !!page && link === page.url && sameValue(sortVersions(versions), sortVersions(page.versions));
  const isValid = !!link && versions.length > 0 && !isDuplicate && !unchanged;
  const locked = Object.fromEntries(
    others.flatMap((p) => p.versions.map((v) => [v, { detail: "On another page" }])),
  );
  const urlError = isDuplicate
    ? "This link is already in the list."
    : urlVisited && !link
      ? EMPTY_ERROR
      : null;
  const versionsError = versionsVisited && versions.length === 0 ? "Select at least one version" : null;

  useEscape(onCancel);

  return (
    <PrmModal
      title={page ? "Edit What's New Page" : "New What's New Page"}
      description="Learners who update the app to one of these versions are shown this page."
      confirmLabel={t(page ? "Save What's New Page" : "Create What's New Page")}
      confirmDisabled={!isValid}
      confirmTip={
        unchanged ? NO_CHANGES_TIP : !link || versions.length === 0 ? "Enter a link and select at least one version" : undefined
      }
      onCancel={onCancel}
      onConfirm={() => isValid && onSubmit({ url: link, versions: sortVersions(versions) })}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            Link<span className="prm-req">*</span>
            {urlError && <span className="form-label-error">{urlError}</span>}
          </span>
          <UrlField
            value={url}
            onChange={setUrl}
            ariaLabel="Link"
            autoFocus={!page}
            flagBlank={urlVisited}
            onBlur={() => setUrlVisited(true)}
          />
        </div>
        <div className="prm-field">
          <span className="prm-label">
            Versions<span className="prm-req">*</span>
            {versionsError && <span className="form-label-error">{versionsError}</span>}
          </span>
          <MultiSelect
            options={APP_VERSIONS}
            value={sortVersions(versions)}
            onChange={setVersions}
            placeholder={t("Select Versions")}
            searchPlaceholder={t("Search Versions...")}
            locked={locked}
            popupMenu
            hasError={!!versionsError}
            onLeave={() => setVersionsVisited(true)}
          />
        </div>
      </div>
    </PrmModal>
  );
}

function RemoveWhatsNewModal({
  page,
  onRemove,
  onCancel,
}: {
  page: WhatsNewPage;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const t = useDsText();
  useEscape(onCancel);
  return (
    <PrmModal
      title={t("Remove What's New Page?")}
      confirmLabel="Remove"
      danger
      onCancel={onCancel}
      onConfirm={onRemove}
    >
      <p className="prm-content">
        Remove <strong>{page.url}</strong>? Learners updating to{" "}
        <strong>{sortVersions(page.versions).join(", ")}</strong> will no longer be shown a
        What's New page.
      </p>
    </PrmModal>
  );
}

/* Read-only: a reference list, so the rows carry no controls — just the link
   out to each destination. */
function DeepLinksField({ links }: { links: SystemDeepLink[] }) {
  const t = useDsText();
  return (
    <div className="form-group">
      <label className="form-label">{t("App Deep Links")}</label>
      <div className="qsec ct-prop">
        <div className="qsec-hd">
          <span className="ct-col" style={DL_COLS.dest}>DESTINATION</span>
          <span className="ct-col" style={DL_COLS.link}>DEEP LINK</span>
          <span className="ct-col pc-nowrap" style={DL_COLS.login}>LOGIN REQUIRED?</span>
          <span className="qsec-x" aria-hidden />
        </div>
        {links.map((link) => (
          <div className="qsec-row" key={link.id}>
            <span className="ct-col pc-strong" style={DL_COLS.dest}>{t(link.label)}</span>
            <span className="ct-col pc-muted" style={DL_COLS.link}>{link.url}</span>
            <span className="ct-col pc-muted" style={DL_COLS.login}>{link.requiresLogin ? "Yes" : "No"}</span>
            <a
              className="pc-open"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={t("Open in a New Tab")}
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
  const t = useDsText();
  const [editing, setEditing] = useState<TabRow | null>(null);
  const setRow = (id: string, patch: Partial<TabRow>) =>
    onUpdate((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="form-group">
      <label className="form-label">{t(label)}</label>
      <div className="qsec ct-prop">
        <div className="qsec-hd">
          <span className="ct-col" style={TAB_COLS.name}>TAB NAME</span>
          <span className="ct-col" style={TAB_COLS.url}>URL</span>
          <span className="ct-col pc-col-toggle" style={TAB_COLS.visible}>VISIBLE?</span>
          <span className="pc-col-edit" aria-hidden />
        </div>
        {rows.map((row) => {
          const name = row.nameEn.trim() || "this tab";
          return (
            <div className="qsec-row" key={row.id}>
              <span className="ct-col pc-strong" style={TAB_COLS.name}>{row.nameEn}</span>
              <span className="ct-col pc-muted" style={TAB_COLS.url}>{row.url.trim() || "—"}</span>
              <span className="ct-col pc-col-toggle" style={TAB_COLS.visible}>
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
      <p className="form-help">{t(help)}</p>

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
  const t = useDsText();
  const [nameEn, setNameEn] = useState(row.nameEn);
  const [nameEs, setNameEs] = useState(row.nameEs);
  const [url, setUrl] = useState(row.url);
  const [icon, setIcon] = useState<PickedImage | null>(row.icon);
  // Every field but the Spanish name is required, and Save Tab waits for an
  // actual change (the app's Save Changes gate).
  const unchanged =
    nameEn.trim() === row.nameEn && nameEs.trim() === row.nameEs && url.trim() === row.url && icon === row.icon;
  const isValid =
    !!nameEn.trim() && !!url.trim() && !!icon && !isOver(NAME_MAX, nameEn, nameEs) && !unchanged;

  useEscape(onCancel);

  return (
    <PrmModal
      title={t("Edit Tab")}
      confirmLabel={t("Save Tab")}
      confirmDisabled={!isValid}
      confirmTip={unchanged ? NO_CHANGES_TIP : undefined}
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
            placeholderEn={t("Tab Name...")}
            placeholderEs={t("Nombre de la Pesta\u00f1a...")}
            maxLength={NAME_MAX}
          />
        </div>
        <div className="prm-field">
          <span className="prm-label">
            URL<span className="prm-req">*</span>
            {!url.trim() && <span className="form-label-error">{EMPTY_ERROR}</span>}
          </span>
          <UrlField value={url} onChange={setUrl} ariaLabel="URL" />
        </div>
        <div className="prm-field">
          <span className="prm-label">
            Icon<span className="prm-req">*</span>
            {!icon && <span className="form-label-error">{EMPTY_ERROR}</span>}
          </span>
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
  const t = useDsText();
  return (
    <div className="form-group">
      <label className="form-label">
        {t("Support Pages")}
        <span className="req">*</span>
        {links.some((l) => !l.url.trim()) && (
          <span className="form-label-error">{EMPTY_ERROR}</span>
        )}
      </label>
      <div className="qsec ct-prop">
        <div className="qsec-hd">
          <span className="ct-col" style={SUP_COLS.page}>PAGE</span>
          <span className="ct-col" style={SUP_COLS.url}>URL</span>
        </div>
        {links.map((link) => (
          <div className="qsec-row" key={link.id}>
            <span className="ct-col pc-strong" style={SUP_COLS.page}>{t(link.label)}</span>
            <div className="ct-col" style={SUP_COLS.url}>
              <UrlField
                value={link.url}
                onChange={(url) =>
                  onChange(links.map((x) => (x.id === link.id ? { ...x, url } : x)))
                }
                ariaLabel={`URL for ${link.label}`}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="form-help">{t("Set the destination URL for each support page surfaced to users.")}</p>
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
  const t = useDsText();
  // Required, like every Price ID: blank goes red and blocks Save.
  const blank = !value.trim();
  return (
    <div className="form-group">
      <label className="form-label">
        {t("EPA Card")}
        <span className="req">*</span>
        {blank && <span className="form-label-error">{EMPTY_ERROR}</span>}
      </label>
      <input
        className={`form-input${blank ? " has-error" : ""}`}
        placeholder={t("Stripe Product ID...")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <p className="form-help">
        {t("Stripe Product ID for the EPA card. Checkout uses the Product's default Price when a learner purchases their EPA card.")}
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
  const t = useDsText();
  const [modal, setModal] = useState<{ kind: "new" } | { kind: "edit"; index: number } | null>(
    null,
  );
  const removeAt = (i: number) => onChange(options.filter((_, j) => j !== i));
  const editing = modal?.kind === "edit" ? modal.index : -1;

  return (
    <div className="form-group">
      <label className="form-label">{t(label)}</label>
      <div className="qsec ct-prop">
        <div className="qsec-hd">
          <span className="ct-col" style={OPTION_COLS.name}>{column}</span>
          <span className="pc-col-actions" aria-hidden />
        </div>

        {options.length === 0 && (
          <div className="qsec-row">
            <span className="qsec-empty">{emptyLabel}</span>
          </div>
        )}

        {options.map((opt, i) => (
          <div className="qsec-row" key={opt}>
            <span className="ct-col pc-strong" style={OPTION_COLS.name}>{opt}</span>
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
            {t(`Add ${noun}`)}
          </button>
        </div>
      </div>
      <p className="form-help">{t(help)}</p>

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
  // Editing: nothing to save until the name actually changes.
  const unchanged = !!defaultValue && trimmed === defaultValue;
  const isValid = !!trimmed && !isDuplicate && !isOver(NAME_MAX, value) && !unchanged;

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
      confirmTip={unchanged ? NO_CHANGES_TIP : undefined}
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

/** A legal document is required in English; Spanish is optional. */
const docBlank = (doc: BilingualDoc) => !richTextContent(doc.en);

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
  const t = useDsText();
  // Required in English (the copy learners agree to); Spanish is optional.
  const blank = docBlank(doc);
  return (
    <div className="form-group">
      <label className="form-label">
        {t(title)}
        <span className="req">*</span>
        {blank && <span className="form-label-error">{EMPTY_ERROR}</span>}
      </label>
      <RichDocField
        error={blank}
        label={title}
        en={doc.en}
        es={doc.es}
        onChangeEn={(v) => onChange({ ...doc, en: v })}
        onChangeEs={(v) => onChange({ ...doc, es: v })}
        placeholderEn={`${title}...`}
        placeholderEs={`${titleEs}...`}
        minRows={4}
        maxRows={16}
      />
      <p className="form-help">{t(desc)}</p>
    </div>
  );
}

/* ─── Unsaved changes ─── */

/* The draft against the saved copy, one entry per thing an admin would call a
   change — a row, a cell, a document — for the save bar's "N Changes Made"
   card and the Review & Save confirm. Each entry's drop puts back the saved
   value for just that piece, leaving the rest of the draft alone. */
const LIST_NAMES: Record<B2BListKey, string> = {
  partnerships: "Partnerships",
  trades: "Trade",
  cancelReasons: "Cancellation Reasons",
};

function describeChanges(
  draft: Settings,
  saved: Settings,
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
): StagedChange[] {
  const out: StagedChange[] = [];
  const revert = <K extends keyof Settings>(key: K, fn: (d: Settings[K], s: Settings[K]) => Settings[K]) =>
    () => setSettings((d) => ({ ...d, [key]: fn(d[key], saved[key]) }));
  const edited = (v: string) => (v.trim() ? "Changed" : "Cleared");

  // Force App Update — versions added, edited or removed, by id.
  const savedIds = new Set(saved.forceUpdates.map((h) => h.id));
  const draftIds = new Set(draft.forceUpdates.map((h) => h.id));
  for (const h of draft.forceUpdates) {
    const was = saved.forceUpdates.find((x) => x.id === h.id);
    if (!was) {
      out.push({
        key: `fu-${h.id}`, subject: `Force App Update · ${h.version}`, action: "Added",
        onDrop: revert("forceUpdates", (d) => d.filter((x) => x.id !== h.id)),
      });
      continue;
    }
    if (sameValue(h, was)) continue;
    const what = [
      h.version !== was.version && "Version Changed",
      !sameValue(h.available, was.available) && "Availability Changed",
      !sameValue(h.minimum, was.minimum) && "Update Required Changed",
    ]
      .filter((x): x is string => !!x)
      .join(", ");
    out.push({
      key: `fu-${h.id}`, subject: `Force App Update · ${was.version}`, action: what,
      onDrop: revert("forceUpdates", (d) => d.map((x) => (x.id === h.id ? was : x))),
    });
  }
  for (const h of saved.forceUpdates)
    if (!draftIds.has(h.id))
      out.push({
        key: `fu-${h.id}`, subject: `Force App Update · ${h.version}`, action: "Removed",
        // Back in its saved place. Rows still in the draft keep their draft
        // copy, so undoing a removal never undoes an edit to another row.
        onDrop: revert("forceUpdates", (d, sv) => {
          const keep = new Set([...d.map((x) => x.id), h.id]);
          return [
            ...d.filter((x) => !savedIds.has(x.id)),
            ...sv.filter((x) => keep.has(x.id)).map((x) => d.find((y) => y.id === x.id) ?? x),
          ];
        }),
      });

  // What's New Page — added, removed, or its link / versions changed, by id.
  for (const p of draft.whatsNewPages) {
    const was = saved.whatsNewPages.find((x) => x.id === p.id);
    if (was && sameValue(p, was)) continue;
    const what = was
      ? [p.url !== was.url && "Link Changed", !sameValue(p.versions, was.versions) && "Versions Changed"]
          .filter((x): x is string => !!x)
          .join(", ")
      : "Added";
    out.push({
      key: `wn-${p.id}`, subject: `What's New Page · ${(was ?? p).url}`, action: what,
      onDrop: revert("whatsNewPages", (d) => (was ? d.map((x) => (x.id === p.id ? was : x)) : d.filter((x) => x.id !== p.id))),
    });
  }
  for (const p of saved.whatsNewPages)
    if (!draft.whatsNewPages.some((x) => x.id === p.id))
      out.push({
        key: `wn-${p.id}`, subject: `What's New Page · ${p.url}`, action: "Removed",
        onDrop: revert("whatsNewPages", (d, sv) => {
          // Back in its saved place, with the other rows as they now stand.
          const keep = new Set([...d.map((x) => x.id), p.id]);
          const savedIds = new Set(sv.map((x) => x.id));
          return [
            ...d.filter((x) => !savedIds.has(x.id)),
            ...sv.filter((x) => keep.has(x.id)).map((x) => d.find((y) => y.id === x.id) ?? x),
          ];
        }),
      });

  // Whole numbers.
  for (const k of Object.keys(NUMBER_MINS) as NumberKey[])
    if (draft[k] !== saved[k])
      out.push({
        key: k, subject: NUMBER_LABELS[k],
        action: draft[k].trim() ? `Changed from ${saved[k]} to ${draft[k]}` : "Cleared",
        onDrop: revert(k, (_, sv) => sv),
      });

  // App / Dashboard Tabs — per tab, what about it moved.
  for (const [key, label] of [["appTabs", "App Tabs"], ["dashboardTabs", "Dashboard Tabs"]] as const)
    for (const row of draft[key]) {
      const was = saved[key].find((r) => r.id === row.id);
      if (!was || sameValue(row, was)) continue;
      const what = [
        (row.nameEn !== was.nameEn || row.nameEs !== was.nameEs) && "Renamed",
        row.url !== was.url && "URL Changed",
        row.icon !== was.icon && "Icon Changed",
        row.visible !== was.visible && (row.visible ? "Shown" : "Hidden"),
      ].filter((x): x is string => !!x);
      out.push({
        key: `${key}-${row.id}`, subject: `${label} · ${was.nameEn}`, action: what.join(", "),
        onDrop: revert(key, (d) => d.map((r) => (r.id === row.id ? was : r))),
      });
    }

  // Support Pages.
  for (const link of draft.supportLinks) {
    const was = saved.supportLinks.find((l) => l.id === link.id);
    if (!was || link.url === was.url) continue;
    out.push({
      key: `sup-${link.id}`, subject: `Support Pages · ${link.label}`, action: `URL ${edited(link.url)}`,
      onDrop: revert("supportLinks", (d) => d.map((l) => (l.id === link.id ? was : l))),
    });
  }

  // B2B Paywall Pricing — per tier × cycle.
  for (const r of B2B_PRICE_ROWS)
    for (const c of CYCLES)
      if (draft.b2bPrices[r.key][c] !== saved.b2bPrices[r.key][c])
        out.push({
          key: `b2bPrices-${r.key}-${c}`, subject: `B2B Paywall Pricing · ${r.key} ${c}`,
          action: `${r.name} ${edited(draft.b2bPrices[r.key][c])}`,
          onDrop: () =>
            setSettings((x) => ({
              ...x,
              b2bPrices: { ...x.b2bPrices, [r.key]: { ...x.b2bPrices[r.key], [c]: saved.b2bPrices[r.key][c] } },
            })),
        });

  // EPA Cards.
  for (const [key, label] of [["b2cEpaCard", "B2C EPA Card"], ["b2bEpaCard", "B2B EPA Card"]] as const)
    if (draft[key] !== saved[key])
      out.push({
        key, subject: label, action: `Product ID ${edited(draft[key])}`,
        onDrop: revert(key, (_, sv) => sv),
      });

  // Partnerships / Trade / Cancellation Reasons. Edits rename in place and adds
  // append, so the lists line up by position.
  for (const key of Object.keys(LIST_NAMES) as B2BListKey[]) {
    const d = draft[key];
    const sv = saved[key];
    d.forEach((v, i) => {
      if (i < sv.length && v === sv[i]) return;
      const added = i >= sv.length;
      out.push({
        key: `${key}-${i}`,
        subject: `${LIST_NAMES[key]} · ${added ? v : sv[i]}`,
        action: added ? "Added" : `Renamed to ${v}`,
        onDrop: revert(key, (cur, s0) =>
          added ? cur.filter((_, j) => j !== i) : cur.map((x, j) => (j === i ? s0[i] : x)),
        ),
      });
    });
  }

  // Legal documents.
  for (const [key, label] of [["termsOfService", "Terms of Service"], ["privacyPolicy", "Privacy Policy"]] as const) {
    const d = draft[key];
    const sv = saved[key];
    if (sameValue(d, sv)) continue;
    const langs = [d.en !== sv.en && "English", d.es !== sv.es && "Spanish"].filter(Boolean);
    out.push({
      key, subject: label, action: `${langs.join(" and ")} Edited`,
      onDrop: revert(key, (_, s0) => s0),
    });
  }

  return out;
}

/* Review & Save: a plain confirmation listing every change, as on Industries. */
function SaveReviewModal({
  changes,
  onCancel,
  onConfirm,
}: {
  changes: StagedChange[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useDsText();
  useEscape(onCancel);
  return (
    <PrmModal
      title={`Save ${changes.length} ${changes.length === 1 ? "Change" : "Changes"}?`}
      confirmLabel={t("Save Changes")}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <ChangesReviewList changes={changes} />
    </PrmModal>
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
}) {
  const t = useDsText();
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
  /* One toast for the page: the save footer's "Settings Saved" and the Award
     Templates delete. */
  const [toast, toastNode] = useToast();
  const dirty = useMemo(
    () => SETTING_KEYS.some((k) => !sameValue(settings[k], saved[k])),
    [settings, saved],
  );
  // Unsaved settings ask before any way off the page throws them away. Tabs
  // and the template pages don’t: the settings live up here and survive both.
  useLeaveGuard(dirty);
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
  // Required IDs and URLs left blank — every Price ID, both EPA cards, every
  // Support Page and tab URL.
  const pricesBlank = (t: PriceTable<string>) =>
    Object.values(t).some((c) => !c.Monthly.trim() || !c.Annual.trim());
  const b2bPricesBlank = pricesBlank(settings.b2bPrices);
  const blanks = [
    settings.appTabs.some((r) => !r.url.trim()) && "App Tabs URL",
    settings.dashboardTabs.some((r) => !r.url.trim()) && "Dashboard Tabs URL",
    settings.supportLinks.some((l) => !l.url.trim()) && "Support Pages URL",
    !settings.b2cEpaCard.trim() && "B2C EPA Card",
    b2bPricesBlank && "B2B Paywall Pricing",
    !settings.b2bEpaCard.trim() && "B2B EPA Card",
    docBlank(settings.termsOfService) && "Terms of Service",
    docBlank(settings.privacyPolicy) && "Privacy Policy",
  ].filter((x): x is string => !!x);
  const canSave = overLimit.length === 0 && badNumbers.length === 0 && blanks.length === 0;
  const blockedTip = canSave
    ? undefined
    : [
        ...(overLimit.length ? ["Shorten these to save:", ...overLimit.map((l) => `• ${l}`)] : []),
        ...(badNumbers.length ? ["Fill in a valid number to save:", ...badNumbers.map((l) => `• ${l}`)] : []),
        ...(blanks.length ? ["Fill these in to save:", ...blanks.map((l) => `• ${l}`)] : []),
      ].join("\n");
  const changes = dirty ? describeChanges(settings, saved, setSettings) : [];
  const [reviewOpen, setReviewOpen] = useState(false);

  const set =
    <K extends keyof Settings>(key: K) =>
    (value: Settings[K]) =>
      setSettings((s) => ({ ...s, [key]: value }));
  const update =
    <K extends keyof Settings>(key: K) =>
    (fn: (value: Settings[K]) => Settings[K]) =>
      setSettings((s) => ({ ...s, [key]: fn(s[key]) }));

  /* Award Templates is a record list, not a settings form: it saves through its
     own pages and modals, so it keeps its state (and its Create CTA) here
     rather than under the page's Save Changes. */
  const [templateWizard, setTemplateWizard] = useState<
    { kind: "new" } | { kind: "edit"; template: AwardDesignTemplate } | null
  >(null);
  const onTemplatesTab = tab === "award-templates";
  /* Award Templates' own delete confirm and row menu report up, so C
     stands down while one is open — on top of the hook's own overlay check. */
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  useCreateShortcut(
    () => setTemplateWizard({ kind: "new" }),
    onTemplatesTab && !templateWizard && !templatesModalOpen,
  );

  /* Create / Edit Design Template aren't designed yet (user, 2026-10-13), so
     both open a placeholder page; the crumb returns to this tab. */
  if (templateWizard) {
    return (
      <div className="main">
        <div className="workspace">
          <PlaceholderPage
            name={templateWizard.kind === "edit" ? "Edit Design Template" : "Create Design Template"}
            crumb={{ label: "Product Config", onClick: () => setTemplateWizard(null) }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks pc-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">{t("Product Config")}</h1>
            </div>
            {onTemplatesTab && (
              <div className="tasks-header-actions">
                <button className="new-task" onClick={() => setTemplateWizard({ kind: "new" })}>
                  <AddIcon />
                  {t("Create Design Template")}
                  <span className="cta-kbd">C</span>
                </button>
              </div>
            )}
          </header>

          <div className="tabbar pc-tabs" role="tablist" aria-label={t("Product Config")}>
            {TAB_ORDER.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={`tab${tab === k ? " is-active" : ""}`}
                onClick={() => setTab(k)}
              >
                {t(TAB_LABELS[k])}
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
                        versions={settings.forceUpdates}
                        onChange={set("forceUpdates")}
                      />
                      <WhatsNewField
                        pages={settings.whatsNewPages}
                        onChange={set("whatsNewPages")}
                      />
                      <NumberField
                        label={t("Webcam Capture Frequency in Seconds")}
                        help={t("How often the webcam captures a frame during proctored sessions. Changes apply to future Proctored Quiz attempts only.")}
                        value={settings.webcamFrequency}
                        onChange={set("webcamFrequency")}
                        min={NUMBER_MINS.webcamFrequency}
                        error={numberErr.webcamFrequency}
                      />
                      <NumberField
                        label={t("Initial Tasks Count")}
                        help={t("How many Tasks from the start of each Certification are open to B2C Starter users and B2B companies with no active plan. Final Exams stay locked regardless.")}
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
                        label={t("App Tabs")}
                        help="Customise the tabs shown in the learner app. Set the name per language, visibility, destination URL, and an icon."
                        rows={settings.appTabs}
                        onUpdate={update("appTabs")}
                      />
                      <TabsField
                        label={t("Dashboard Tabs")}
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
                      <NumberField
                        label={t("Free Trial Duration in Days")}
                        help="The trial length in days for new users."
                        value={settings.b2cTrialDays}
                        onChange={set("b2cTrialDays")}
                        min={NUMBER_MINS.b2cTrialDays}
                        error={numberErr.b2cTrialDays}
                      />
                      <EpaCardField
                        value={settings.b2cEpaCard}
                        onChange={set("b2cEpaCard")}
                        note={t("This ID applies to the user app only. For the dashboard EPA card, set it under the B2B Management tab.")}
                      />
                    </>
                  )}

                  {tab === "b2b" && (
                    <>
                      <div className="form-group">
                        <label className="form-label">
                          {t("Paywall Pricing")}
                          <span className="req">*</span>
                          {b2bPricesBlank && <span className="form-label-error">{EMPTY_ERROR}</span>}
                        </label>
                        <PriceIdGrid
                          rows={B2B_PRICE_ROWS}
                          ghost="Tier"
                          value={settings.b2bPrices}
                          onChange={set("b2bPrices")}
                        />
                        <p className="form-help">
                          {t("Set the Stripe Price ID for each tier and billing cycle. These IDs are used to create subscriptions and checkout sessions for B2B companies.")}
                        </p>
                      </div>
                      <EpaCardField
                        value={settings.b2bEpaCard}
                        onChange={set("b2bEpaCard")}
                        note={t("This ID applies to the dashboard only. For the user app EPA card, set it under the B2C Management tab.")}
                      />
                      <NumberField
                        label={t("Free Trial Duration in Days")}
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
                        emptyLabel={t("No Partnerships Configured Yet")}
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
                        emptyLabel={t("No Trades Configured Yet")}
                        options={settings.trades}
                        onChange={set("trades")}
                        onRequestRemove={onRemoveValue && requestRemove("trades", "Trade")}
                      />
                      <OptionListField
                        label={t("Cancellation Reasons")}
                        help="Options shown to admins when they cancel a B2B subscription. Add or remove reasons to customise the field values."
                        column="REASON"
                        noun="Reason"
                        fieldLabel="Reason"
                        modalDesc="An option admins can pick when they cancel a B2B subscription."
                        emptyLabel={t("No Cancellation Reasons Configured Yet")}
                        options={settings.cancelReasons}
                        onChange={set("cancelReasons")}
                        onRequestRemove={onRemoveValue && requestRemove("cancelReasons", "Reason")}
                      />
                    </>
                  )}

                  {tab === "legal" && (
                    <>
                      <LegalDocField
                        title={t("Terms of Service")}
                        titleEs="Términos de Servicio"
                        desc={t("The Terms of Service shown to learners. Provide both English and Spanish versions.")}
                        doc={settings.termsOfService}
                        onChange={set("termsOfService")}
                      />
                      <LegalDocField
                        title={t("Privacy Policy")}
                        titleEs="Política de Privacidad"
                        desc={t("The Privacy Policy shown to learners. Provide both English and Spanish versions.")}
                        doc={settings.privacyPolicy}
                        onChange={set("privacyPolicy")}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* The staged-changes save bar (Manage User Progress, Industries):
              "N Changes Made" lists every change on hover, each droppable on
              its own; Discard; Review & Save (⌘↵) → the confirm below. In-flow
              as the column's last child, so it stops at the left nav, and up
              on every tab while anything is unsaved, Award Templates included. */}
          <ChangesFooter
            changes={changes}
            onDiscard={() => setSettings(saved)}
            onReview={() => setReviewOpen(true)}
            shortcutEnabled={!reviewOpen && !removing && !templatesModalOpen}
            blockedTip={blockedTip}
          />
        </div>
      </div>
      {reviewOpen && changes.length > 0 && (
        <SaveReviewModal
          changes={changes}
          onCancel={() => setReviewOpen(false)}
          onConfirm={() => {
            onSave(settings);
            setReviewOpen(false);
            toast("Settings Saved");
          }}
        />
      )}
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
