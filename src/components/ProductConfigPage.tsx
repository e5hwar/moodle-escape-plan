import { useLayoutEffect, useRef, useState } from "react";
import { CANCELLATION_REASONS } from "../data/companies";
import { DEFAULT_PARTNERSHIPS, DEFAULT_TRADES } from "../data/productConfig";
import {
  UploadIcon,
  GlobeIcon,
  LockIcon,
} from "./icons";
import { RteToolbar } from "./RteToolbar";

/* ─── Icons ─── */
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M6 6l1 14a1 1 0 001 1h8a1 1 0 001-1l1-14M10 11v6M14 11v6" />
  </svg>
);
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
  </svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const RedirectIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
  </svg>
);

/* ─── Types ─── */
type Tab = "general" | "display" | "b2c" | "b2b" | "legal";

const TAB_LABELS: Record<Tab, string> = {
  general: "General Settings",
  display: "Display Settings",
  b2c: "B2C Management",
  b2b: "B2B Management",
  legal: "Legal",
};

type TabRow = {
  id: string;
  nameEn: string;
  nameEs: string;
  visible: boolean;
  url: string;
  icon: string | null;
};

type SupportLink = { id: string; label: string; url: string };

const tabRow = (id: string, nameEn: string, nameEs = ""): TabRow => ({
  id, nameEn, nameEs, visible: true, url: "", icon: null,
});

const DEFAULT_APP_TABS: TabRow[] = [
  tabRow("app-lab", "Lab"),
  tabRow("app-resources", "Resources"),
];

const DEFAULT_DASHBOARD_TABS: TabRow[] = [
  tabRow("dash-assessments", "Assessments"),
  tabRow("dash-troubleshooting", "Troubleshooting"),
  tabRow("dash-manuals", "Manuals"),
  tabRow("dash-error-codes", "Error Codes"),
  tabRow("dash-analytics", "Analytics"),
];

const DEFAULT_SUPPORT_LINKS: SupportLink[] = [
  { id: "sup-b2b-dashboard", label: "B2B Dashboard", url: "" },
  { id: "sup-guides", label: "Guides", url: "" },
  { id: "sup-message", label: "Send Us A Message", url: "" },
  { id: "sup-news", label: "News", url: "" },
];
type Tier = "Essentials" | "Growth" | "Pro";
type Cycle = "Monthly" | "Annual";

type PriceIds = Record<Tier, Record<Cycle, string>>;

const DEFAULT_PRICE_IDS: PriceIds = {
  Essentials: { Monthly: "", Annual: "" },
  Growth:     { Monthly: "", Annual: "" },
  Pro:        { Monthly: "", Annual: "" },
};

type Platform = "Google" | "Apple" | "Stripe";

type PlatformPriceIds = Record<Platform, Record<Cycle, string>>;

const DEFAULT_PLATFORM_PRICE_IDS: PlatformPriceIds = {
  Google: { Monthly: "", Annual: "" },
  Apple:  { Monthly: "", Annual: "" },
  Stripe: { Monthly: "", Annual: "" },
};

const PLATFORM_PLACEHOLDERS: Record<Platform, string> = {
  Google: "com.skillcat.app.monthly",
  Apple:  "com.skillcat.app.monthly",
  Stripe: "price_xxxxxxxxxxxxxxxxxxxxxxxx",
};

const DEFAULT_CANCEL_REASONS = [...CANCELLATION_REASONS];

type ForceUpdate = { id: string; version: string; date: string };

const DEFAULT_FORCE_UPDATES: ForceUpdate[] = [
  { id: "fu-3", version: "4.2.0", date: "Jun 02, 2026" },
  { id: "fu-2", version: "4.1.3", date: "Apr 18, 2026" },
  { id: "fu-1", version: "4.0.0", date: "Jan 27, 2026" },
];

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

/* ─── Paywall Pricing ─── */
function PaywallPricing({
  priceIds,
  onChange,
}: {
  priceIds: PriceIds;
  onChange: (ids: PriceIds) => void;
}) {
  const tiers: Tier[] = ["Essentials", "Growth", "Pro"];
  const cycles: Cycle[] = ["Monthly", "Annual"];

  function set(tier: Tier, cycle: Cycle, val: string) {
    onChange({
      ...priceIds,
      [tier]: { ...priceIds[tier], [cycle]: val },
    });
  }

  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">Paywall Pricing</h2>
        <p className="pc-section-desc">
          Set the Stripe Price ID for each tier and billing cycle. These IDs are used to create
          subscriptions and checkout sessions for B2B companies.
        </p>
      </div>

      <div className="pc-price-grid">
        {/* Header row */}
        <div className="pc-price-row pc-price-header">
          <div className="pc-price-tier-cell" />
          {cycles.map((c) => (
            <div key={c} className="pc-price-cycle-label">{c}</div>
          ))}
        </div>
        {/* Data rows */}
        {tiers.map((tier) => (
          <div key={tier} className="pc-price-row">
            <div className="pc-price-tier-cell">
              <span className="pc-tier-badge" data-tier={tier.toLowerCase()}>{tier}</span>
            </div>
            {cycles.map((cycle) => (
              <div key={cycle} className="pc-price-input-cell">
                <input
                  className="form-input pc-price-input"
                  placeholder="price_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={priceIds[tier][cycle]}
                  onChange={(e) => set(tier, cycle, e.target.value)}
                  spellCheck={false}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── B2C Paywall Pricing (per platform) ─── */
function B2CPaywallPricing({
  priceIds,
  onChange,
}: {
  priceIds: PlatformPriceIds;
  onChange: (ids: PlatformPriceIds) => void;
}) {
  const platforms: Platform[] = ["Google", "Apple", "Stripe"];
  const cycles: Cycle[] = ["Monthly", "Annual"];

  function set(platform: Platform, cycle: Cycle, val: string) {
    onChange({
      ...priceIds,
      [platform]: { ...priceIds[platform], [cycle]: val },
    });
  }

  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">Paywall Pricing</h2>
        <p className="pc-section-desc">
          Set the product / price ID for each platform and billing cycle. These IDs are used to
          create subscriptions and checkout sessions for individual learners.
        </p>
      </div>

      <div className="pc-price-grid">
        {/* Header row */}
        <div className="pc-price-row pc-price-header">
          <div className="pc-price-tier-cell" />
          {cycles.map((c) => (
            <div key={c} className="pc-price-cycle-label">{c}</div>
          ))}
        </div>
        {/* Data rows */}
        {platforms.map((platform) => (
          <div key={platform} className="pc-price-row">
            <div className="pc-price-tier-cell">
              <span className="pc-tier-badge" data-tier={platform.toLowerCase()}>{platform}</span>
            </div>
            {cycles.map((cycle) => (
              <div key={cycle} className="pc-price-input-cell">
                <input
                  className="form-input pc-price-input"
                  placeholder={PLATFORM_PLACEHOLDERS[platform]}
                  value={priceIds[platform][cycle]}
                  onChange={(e) => set(platform, cycle, e.target.value)}
                  spellCheck={false}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Cancellation Reasons ─── */
function CancellationReasons({
  reasons,
  onChange,
}: {
  reasons: string[];
  onChange: (r: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || reasons.includes(trimmed)) return;
    onChange([...reasons, trimmed]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(reasons.filter((_, i) => i !== idx));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); add(); }
  }

  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">Cancellation Reasons</h2>
        <p className="pc-section-desc">
          Options shown to admins when they cancel a B2B subscription. Add or remove reasons to
          customise the field values.
        </p>
      </div>

      <div className="pc-reason-list">
        {reasons.map((r, i) => (
          <div key={i} className="pc-reason-row">
            <span className="pc-reason-text">{r}</span>
            <button className="pc-reason-remove" onClick={() => remove(i)} title="Remove">
              <TrashIcon />
            </button>
          </div>
        ))}
        {reasons.length === 0 && (
          <div className="pc-reason-empty">No cancellation reasons configured.</div>
        )}
      </div>

      <div className="pc-reason-add-row">
        <input
          className="form-input pc-reason-input"
          placeholder="Add a cancellation reason…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="btn-primary pc-reason-add-btn"
          onClick={add}
        >
          <PlusIcon />
          Add
        </button>
      </div>
    </div>
  );
}

/* ─── Editable Option List (create / edit / remove) ─── */
function OptionListEditor({
  title,
  desc,
  options,
  onChange,
  addPlaceholder,
  emptyLabel,
}: {
  title: string;
  desc: string;
  options: string[];
  onChange: (o: string[]) => void;
  addPlaceholder: string;
  emptyLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...options, trimmed]);
    setDraft("");
  }

  function remove(idx: number) {
    if (editingIdx === idx) setEditingIdx(null);
    onChange(options.filter((_, i) => i !== idx));
  }

  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditValue(options[idx]);
  }

  function commitEdit() {
    if (editingIdx === null) return;
    const trimmed = editValue.trim();
    const dupe = options.some((o, i) => i !== editingIdx && o.toLowerCase() === trimmed.toLowerCase());
    if (!trimmed || dupe) { setEditingIdx(null); return; }
    onChange(options.map((o, i) => (i === editingIdx ? trimmed : o)));
    setEditingIdx(null);
  }

  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">{title}</h2>
        <p className="pc-section-desc">{desc}</p>
      </div>

      <div className="pc-reason-list">
        {options.map((opt, i) => (
          <div key={i} className="pc-reason-row">
            {editingIdx === i ? (
              <>
                <input
                  className="form-input pc-reason-input pc-reason-edit-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                    if (e.key === "Escape") { e.preventDefault(); setEditingIdx(null); }
                  }}
                  autoFocus
                />
                <div className="pc-reason-actions">
                  <button className="pc-reason-action pc-reason-save" onClick={commitEdit} title="Save">
                    <CheckIcon />
                  </button>
                  <button className="pc-reason-action" onClick={() => setEditingIdx(null)} title="Cancel">
                    <CloseIcon />
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="pc-reason-text">{opt}</span>
                <div className="pc-reason-actions">
                  <button className="pc-reason-action" onClick={() => startEdit(i)} title="Edit">
                    <EditIcon />
                  </button>
                  <button className="pc-reason-action pc-reason-remove-action" onClick={() => remove(i)} title="Remove">
                    <TrashIcon />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {options.length === 0 && (
          <div className="pc-reason-empty">{emptyLabel}</div>
        )}
      </div>

      <div className="pc-reason-add-row">
        <input
          className="form-input pc-reason-input"
          placeholder={addPlaceholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button className="btn-primary pc-reason-add-btn" onClick={add}>
          <PlusIcon />
          Add
        </button>
      </div>
    </div>
  );
}

/* ─── Free Trial Duration ─── */
function FreeTrialDuration({
  days,
  onChange,
  desc,
  placeholder = "14",
}: {
  days: string;
  onChange: (v: string) => void;
  desc: string;
  placeholder?: string;
}) {
  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">Free Trial Duration</h2>
        <p className="pc-section-desc">{desc}</p>
      </div>

      <div className="pc-trial-row">
        <div className="pc-trial-input-wrap">
          <input
            className="form-input pc-trial-input"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={placeholder}
            value={days}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <span className="pc-trial-unit">days</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Generic numeric setting ─── */
function NumberSetting({
  title,
  desc,
  value,
  onChange,
  placeholder,
  unit,
}: {
  title: string;
  desc: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
}) {
  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">{title}</h2>
        <p className="pc-section-desc">{desc}</p>
      </div>

      <div className="pc-trial-row">
        <div className="pc-trial-input-wrap">
          <input
            className="form-input pc-trial-input"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          />
          {unit && <span className="pc-trial-unit">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

/* ─── EPA Card (single Stripe Product ID) ─── */
function EpaCardSetting({
  value,
  onChange,
  note,
}: {
  value: string;
  onChange: (v: string) => void;
  note: string;
}) {
  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">EPA Card</h2>
        <p className="pc-section-desc">
          Stripe Product ID for the EPA card. Used to create the checkout session when a learner
          purchases their EPA card.
        </p>
      </div>

      <input
        className="form-input pc-epa-input"
        placeholder="prod_xxxxxxxxxxxxxx"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />

      <p className="pc-section-note">{note}</p>
    </div>
  );
}

/* ─── Force App Update ─── */
function ForceAppUpdate({
  history,
  onChange,
}: {
  history: ForceUpdate[];
  onChange: (h: ForceUpdate[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // History is newest-first; the most recent entry is the version currently forced.
  const current = history[0];

  const isValid = /^\d+(\.\d+)*$/.test(draft.trim());

  function add() {
    const version = draft.trim();
    if (!isValid || history.some((h) => h.version === version)) return;
    onChange([{ id: `fu-${Date.now()}`, version, date: formatToday() }, ...history]);
    setDraft("");
  }

  function remove(id: string) {
    onChange(history.filter((h) => h.id !== id));
    setConfirmId(null);
  }

  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">Force App Update</h2>
        <p className="pc-section-desc">
          Force learners on older app versions to update. Enter the minimum required version —
          users below it are prompted to update before they can continue.
        </p>
      </div>

      <div className="pc-reason-add-row">
        <input
          className="form-input pc-reason-input"
          placeholder="e.g. 4.3.0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          spellCheck={false}
        />
        <button
          className="btn-primary pc-reason-add-btn"
          onClick={add}
          disabled={!isValid || history.some((h) => h.version === draft.trim())}
        >
          <PlusIcon />
          Force Update
        </button>
      </div>

      {current && (
        <div className="pc-fu-current">
          Currently forcing version <strong>{current.version}</strong> · enabled {current.date}
        </div>
      )}

      <h3 className="pc-fu-log-title">Previous Force Updates</h3>
      <div className="pc-reason-list">
        {history.map((h, i) => {
          const fallback = history[i + 1];
          return (
            <div key={h.id} className="pc-reason-row pc-fu-row">
              {confirmId === h.id ? (
                <div className="pc-fu-confirm">
                  <span className="pc-fu-confirm-text">
                    Remove force update <strong>{h.version}</strong>?{" "}
                    {i === 0
                      ? fallback
                        ? <>Users will fall back to the previous forced version <strong>{fallback.version}</strong>.</>
                        : <>No version will be forced after this.</>
                      : <>This removes it from the log.</>}
                  </span>
                  <div className="pc-fu-confirm-actions">
                    <button className="pc-fu-confirm-cancel" onClick={() => setConfirmId(null)}>Cancel</button>
                    <button className="pc-fu-confirm-remove" onClick={() => remove(h.id)}>Remove</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pc-fu-row-main">
                    <span className="pc-fu-version">{h.version}</span>
                    {i === 0 && <span className="pc-fu-active-tag">Active</span>}
                    <span className="pc-fu-date">Enabled {h.date}</span>
                  </div>
                  <button className="pc-reason-remove" onClick={() => setConfirmId(h.id)} title="Remove">
                    <TrashIcon />
                  </button>
                </>
              )}
            </div>
          );
        })}
        {history.length === 0 && (
          <div className="pc-reason-empty">No force updates configured.</div>
        )}
      </div>
    </div>
  );
}

/* ─── Legal (rich text, EN + ES) ─── */
function LegalAutoTextarea({
  value,
  onChange,
  onFocus,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  placeholder?: string;
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
      className="rte-area"
      value={value}
      rows={3}
      placeholder={placeholder}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function LegalRichTextField({
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
        <LegalAutoTextarea value={en} onChange={onChangeEn} placeholder="Enter the English text…" />
      </div>
      <div className="rte-field-divider" />
      <div className="rte-lang-row">
        <span className="lang-tag">ES</span>
        <LegalAutoTextarea value={es} onChange={onChangeEs} placeholder="Introduce el texto en español…" />
      </div>
    </div>
  );
}

function LegalDocField({
  title,
  desc,
  doc,
  onChange,
}: {
  title: string;
  desc: string;
  doc: { en: string; es: string };
  onChange: (d: { en: string; es: string }) => void;
}) {
  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">{title}</h2>
        <p className="pc-section-desc">{desc}</p>
      </div>
      <LegalRichTextField
        en={doc.en}
        es={doc.es}
        onChangeEn={(v) => onChange({ ...doc, en: v })}
        onChangeEs={(v) => onChange({ ...doc, es: v })}
      />
    </div>
  );
}

/* ─── Display Settings ─── */
function IconUploader({
  icon,
  onChange,
}: {
  icon: string | null;
  onChange: (v: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function pick(file: File) {
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="pc-ds-icon">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }}
      />
      <button
        type="button"
        className={`pc-ds-icon-btn${icon ? " has-icon" : ""}`}
        onClick={() => ref.current?.click()}
        title={icon ? "Replace icon" : "Upload icon"}
      >
        {icon ? <img src={icon} alt="" /> : <UploadIcon />}
      </button>
      {icon && (
        <button type="button" className="pc-ds-icon-remove" onClick={() => onChange(null)} title="Remove icon">
          <CloseIcon />
        </button>
      )}
      <span className="pc-ds-icon-label">Icon</span>
    </div>
  );
}

function TabRowEditor({
  row,
  onChange,
}: {
  row: TabRow;
  onChange: (r: TabRow) => void;
}) {
  const set = (patch: Partial<TabRow>) => onChange({ ...row, ...patch });

  return (
    <div className="pc-ds-card">
      <IconUploader icon={row.icon} onChange={(icon) => set({ icon })} />
      <div className="pc-ds-fields">
        <div className="pc-ds-grid">
          <label className="pc-ds-field">
            <span className="pc-ds-label">Tab name (English)</span>
            <input className="form-input" value={row.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />
          </label>
          <label className="pc-ds-field">
            <span className="pc-ds-label">Tab name (Spanish)</span>
            <input className="form-input" value={row.nameEs} onChange={(e) => set({ nameEs: e.target.value })} placeholder="Español" />
          </label>
        </div>
        <div className="pc-ds-grid">
          <label className="pc-ds-field">
            <span className="pc-ds-label">URL</span>
            <input className="form-input" value={row.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" spellCheck={false} />
          </label>
          <div className="pc-ds-field">
            <span className="pc-ds-label">Visibility</span>
            <div className="pc-ds-vis">
              <button
                type="button"
                className={`toggle${row.visible ? " on" : ""}`}
                onClick={() => set({ visible: !row.visible })}
                role="switch"
                aria-checked={row.visible}
              >
                <span className="toggle-knob" />
              </button>
              <span className="pc-ds-vis-text">{row.visible ? "Yes" : "No"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabSection({
  title,
  desc,
  rows,
  onChange,
}: {
  title: string;
  desc: string;
  rows: TabRow[];
  onChange: (rows: TabRow[]) => void;
}) {
  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">{title}</h2>
        <p className="pc-section-desc">{desc}</p>
      </div>
      <div className="pc-ds-list">
        {rows.map((row) => (
          <TabRowEditor
            key={row.id}
            row={row}
            onChange={(r) => onChange(rows.map((x) => (x.id === row.id ? r : x)))}
          />
        ))}
      </div>
    </div>
  );
}

function SupportSection({
  links,
  onChange,
}: {
  links: SupportLink[];
  onChange: (links: SupportLink[]) => void;
}) {
  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">Support Pages</h2>
        <p className="pc-section-desc">
          Set the destination URL for each support page surfaced to users.
        </p>
      </div>
      <div className="pc-ds-support-list">
        {links.map((link) => (
          <div key={link.id} className="pc-ds-support-row">
            <span className="pc-ds-support-label">{link.label}</span>
            <input
              className="form-input"
              value={link.url}
              onChange={(e) => onChange(links.map((x) => (x.id === link.id ? { ...x, url: e.target.value } : x)))}
              placeholder="https://…"
              spellCheck={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── App Deep Links (read-only) ─── */
type DeepLink = { id: string; label: string; url: string; requiresLogin: boolean };

const APP_DEEP_LINKS: DeepLink[] = [
  { id: "dl-cert-list", label: "Certification List", url: "skillcat.app/browse", requiresLogin: false },
  { id: "dl-id-reupload", label: "ID Reupload", url: "skillcat.app/reupload-id", requiresLogin: true },
  { id: "dl-verify-cert", label: "Verify Certificate", url: "skillcat.app/verify-certificate", requiresLogin: false },
];

function DeepLinksSection({ links }: { links: DeepLink[] }) {
  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">App Deep Links</h2>
        <p className="pc-section-desc">
          Read-only reference of the app’s deep links and whether each destination requires the
          user to be logged in.
        </p>
      </div>
      <div className="pc-ds-support-list">
        {links.map((link) => {
          const href = `https://${link.url}`;
          return (
            <div key={link.id} className="pc-ds-support-row pc-dl-row">
              <span className="pc-ds-support-label">{link.label}</span>
              <code className="pc-dl-url">{link.url}</code>
              <span
                className={`pc-dl-access${link.requiresLogin ? " needs-login" : " public"}`}
                title={link.requiresLogin ? "Requires login" : "Can be opened without login"}
              >
                {link.requiresLogin ? <LockIcon /> : <GlobeIcon />}
                {link.requiresLogin ? "Login required" : "No login"}
              </span>
              <a
                className="pc-dl-redirect"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in a new tab"
                aria-label={`Open ${link.label} in a new tab`}
              >
                <RedirectIcon />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Placeholder sections ─── */
function PlaceholderSection({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">{title}</h2>
        <p className="pc-section-desc">{desc}</p>
      </div>
      <div className="pc-placeholder">
        <span>No settings configured yet.</span>
      </div>
    </div>
  );
}

/* ─── Main page ─── */
export function ProductConfigPage({ initialTab }: { initialTab?: Tab } = {}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "general");
  const [forceUpdates, setForceUpdates] = useState<ForceUpdate[]>(DEFAULT_FORCE_UPDATES);
  const [webcamFrequency, setWebcamFrequency] = useState("20");
  const [termsOfService, setTermsOfService] = useState({ en: "", es: "" });
  const [privacyPolicy, setPrivacyPolicy] = useState({ en: "", es: "" });
  const [appTabs, setAppTabs] = useState<TabRow[]>(DEFAULT_APP_TABS);
  const [dashboardTabs, setDashboardTabs] = useState<TabRow[]>(DEFAULT_DASHBOARD_TABS);
  const [supportLinks, setSupportLinks] = useState<SupportLink[]>(DEFAULT_SUPPORT_LINKS);
  const [priceIds, setPriceIds] = useState<PriceIds>(DEFAULT_PRICE_IDS);
  const [trialDays, setTrialDays] = useState("14");
  const [b2cTrialDays, setB2cTrialDays] = useState("3");
  const [b2cInitialTaskCount, setB2cInitialTaskCount] = useState("5");
  const [b2cPlatformPrices, setB2cPlatformPrices] = useState<PlatformPriceIds>(DEFAULT_PLATFORM_PRICE_IDS);
  const [b2cEpaCard, setB2cEpaCard] = useState("");
  const [b2bEpaCard, setB2bEpaCard] = useState("");
  const [cancelReasons, setCancelReasons] = useState<string[]>(DEFAULT_CANCEL_REASONS);
  const [partnerships, setPartnerships] = useState<string[]>(DEFAULT_PARTNERSHIPS);
  const [trades, setTrades] = useState<string[]>(DEFAULT_TRADES);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="pc-page">
          {/* Header */}
          <header className="pc-header">
            <div className="pc-header-top">
              <h1 className="pc-page-title">Product Config</h1>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saved}
              >
                {saved ? "Saved!" : "Save changes"}
              </button>
            </div>

            {/* Tabs */}
            <nav className="pc-tabs">
              {(["general", "display", "b2c", "b2b", "legal"] as Tab[]).map((t) => {
                const label = TAB_LABELS[t];
                return (
                  <button
                    key={t}
                    className={`pc-tab${tab === t ? " is-active" : ""}`}
                    onClick={() => setTab(t)}
                  >
                    {label}
                  </button>
                );
              })}
            </nav>
          </header>

          {/* Body */}
          <div className="pc-body">
            {tab === "general" && (
              <>
                <ForceAppUpdate history={forceUpdates} onChange={setForceUpdates} />
                <div className="pc-section-divider" />
                <NumberSetting
                  title="Webcam Capture Frequency"
                  desc="How often the webcam captures a frame during proctored sessions."
                  value={webcamFrequency}
                  onChange={setWebcamFrequency}
                  placeholder="20"
                  unit="seconds"
                />
                <div className="pc-section-divider" />
                <DeepLinksSection links={APP_DEEP_LINKS} />
              </>
            )}

            {tab === "display" && (
              <>
                <TabSection
                  title="App Tabs"
                  desc="Customise the tabs shown in the learner app. Set the name per language, visibility, destination URL, and an icon."
                  rows={appTabs}
                  onChange={setAppTabs}
                />
                <div className="pc-section-divider" />
                <TabSection
                  title="Dashboard Tabs"
                  desc="Customise the tabs shown in the B2B dashboard. Set the name per language, visibility, destination URL, and an icon."
                  rows={dashboardTabs}
                  onChange={setDashboardTabs}
                />
                <div className="pc-section-divider" />
                <SupportSection links={supportLinks} onChange={setSupportLinks} />
              </>
            )}

            {tab === "b2c" && (
              <>
                <PlaceholderSection
                  title="B2C Onboarding"
                  desc="Configure the self-sign-up flow, trial window, and conversion prompts for individual learners."
                />
                <div className="pc-section-divider" />
                <B2CPaywallPricing priceIds={b2cPlatformPrices} onChange={setB2cPlatformPrices} />
                <div className="pc-section-divider" />
                <FreeTrialDuration
                  days={b2cTrialDays}
                  onChange={setB2cTrialDays}
                  desc="Number of days an individual learner gets free access before their trial converts to a paid subscription."
                  placeholder="3"
                />
                <div className="pc-section-divider" />
                <NumberSetting
                  title="Initial Task Count"
                  desc="Number of tasks an individual learner is given to start with when they first sign up."
                  value={b2cInitialTaskCount}
                  onChange={setB2cInitialTaskCount}
                  placeholder="5"
                  unit="tasks"
                />
                <div className="pc-section-divider" />
                <EpaCardSetting
                  value={b2cEpaCard}
                  onChange={setB2cEpaCard}
                  note="Note: this ID applies to the user app only. For the dashboard EPA card, set it under the B2B Management tab."
                />
              </>
            )}

            {tab === "b2b" && (
              <>
                <PaywallPricing priceIds={priceIds} onChange={setPriceIds} />
                <div className="pc-section-divider" />
                <FreeTrialDuration
                  days={trialDays}
                  onChange={setTrialDays}
                  desc="Number of days a B2B company gets free access before their trial converts to a paid subscription."
                />
                <div className="pc-section-divider" />
                <OptionListEditor
                  title="Partnerships"
                  desc="Partner affiliation options assignable to B2B companies. Create, rename, or remove options as your partner programmes change."
                  options={partnerships}
                  onChange={setPartnerships}
                  addPlaceholder="Add a partnership…"
                  emptyLabel="No partnerships configured."
                />
                <div className="pc-section-divider" />
                <OptionListEditor
                  title="Trade"
                  desc="Trade categories used to classify B2B companies and tailor their content. Create, rename, or remove options as needed."
                  options={trades}
                  onChange={setTrades}
                  addPlaceholder="Add a trade…"
                  emptyLabel="No trades configured."
                />
                <div className="pc-section-divider" />
                <EpaCardSetting
                  value={b2bEpaCard}
                  onChange={setB2bEpaCard}
                  note="Note: this ID applies to the dashboard only. For the user app EPA card, set it under the B2C Management tab."
                />
                <div className="pc-section-divider" />
                <CancellationReasons reasons={cancelReasons} onChange={setCancelReasons} />
              </>
            )}

            {tab === "legal" && (
              <>
                <LegalDocField
                  title="Terms of Service"
                  desc="The Terms of Service shown to learners. Provide both English and Spanish versions."
                  doc={termsOfService}
                  onChange={setTermsOfService}
                />
                <div className="pc-section-divider" />
                <LegalDocField
                  title="Privacy Policy"
                  desc="The Privacy Policy shown to learners. Provide both English and Spanish versions."
                  doc={privacyPolicy}
                  onChange={setPrivacyPolicy}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
