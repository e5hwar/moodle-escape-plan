import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BILLING_CYCLES,
  CURRENCIES,
  CURRENCY_SYMBOL,
  TAX_STATUSES,
  defaultRate,
  getCompanyBilling,
  type BillingCycle,
  type Company,
  type Currency,
  type PaymentCollection,
  type TaxStatus,
  type Tier,
} from "../data/companies";
import { CheckIcon, CheckBoldIcon, SmallXIcon, ChevronDownIcon, ArrowUpRightIcon, SearchIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { SelectField } from "./SelectField";
import { WizardStepRail } from "./WizardStepRail";
import { PageBreak } from "./PageBreak";
import { DateField } from "./DateField";

/* ─────────────── Constants ─────────────── */

// Address dropdown options (Figma 101:337 — Country & State selects).
export const COUNTRY_OPTIONS = [
  "United States", "Canada", "United Kingdom", "Australia", "India",
  "Germany", "France", "Mexico", "Brazil", "Other",
];
export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

type Plan = "free-trial" | "subscription" | "complimentary";
type PaidTier = "Essentials" | "Growth" | "Pro";

// Snapshot of a company's existing paid subscription, used to diff against the
// edited values and preview the billing change.
type CurrentSub = {
  tier: PaidTier;
  cycle: BillingCycle;
  rate: number;
  seats: number;
  payment: PaymentCollection;
  currency: Currency;
  nextBillingDate: string;
};

export const INDUSTRY_OPTIONS = [
  "HVAC", "Electrical", "Plumbing", "Solar", "Roofing",
  "Refrigeration", "Fire Protection", "Construction",
  "Appliance Repair", "Utilities", "Other",
];

export const PARTNERSHIP_OPTIONS = [
  "Preferred Partner", "Elite Partner", "NGO Partner",
  "NexStar", "National Account", "Channel Partner",
];

export const CSM_OPTIONS = ["Leanna Olbinsky", "Corinne Hayes", "Simran Phulwani"];
export const SALES_REP_OPTIONS = ["Ruchir Shah", "Brendan Arsenault", "Elliot Ling"];
/** The sales rep filling out the form — used as the default for new companies. */
export const CURRENT_SALES_REP = SALES_REP_OPTIONS[0];

// A saved price holds a per-seat rate for one or more currencies, keyed by
// currency code (USD/CAD are always billed; others can be defined for future use).
type SavedPrice = { id: string; label: string; rates: Record<string, number> };

function r2(usd: number, cad: number): Record<string, number> {
  return { USD: usd, CAD: cad };
}

function buildDefaultSavedPrices(): SavedPrice[] {
  return [
    { id: "ess-mo",       label: "Essentials — Monthly (default)",          rates: r2(defaultRate("Essentials", "Monthly", "USD"), defaultRate("Essentials", "Monthly", "CAD")) },
    { id: "ess-an",       label: "Essentials — Annual (default)",            rates: r2(defaultRate("Essentials", "Annual",  "USD"), defaultRate("Essentials", "Annual",  "CAD")) },
    { id: "gro-mo",       label: "Growth — Monthly (default)",               rates: r2(defaultRate("Growth",     "Monthly", "USD"), defaultRate("Growth",     "Monthly", "CAD")) },
    { id: "gro-an",       label: "Growth — Annual (default)",                rates: r2(defaultRate("Growth",     "Annual",  "USD"), defaultRate("Growth",     "Annual",  "CAD")) },
    { id: "pro-mo",       label: "Pro — Monthly (default)",                  rates: r2(defaultRate("Pro",        "Monthly", "USD"), defaultRate("Pro",        "Monthly", "CAD")) },
    { id: "pro-an",       label: "Pro — Annual (default)",                   rates: r2(defaultRate("Pro",        "Annual",  "USD"), defaultRate("Pro",        "Annual",  "CAD")) },
    // Custom / partner prices
    { id: "part-ess-mo",  label: "Essentials — Monthly (Preferred Partner)", rates: r2(42,  56)  },
    { id: "part-ess-an",  label: "Essentials — Annual (Preferred Partner)",  rates: r2(33,  44)  },
    { id: "part-gro-mo",  label: "Growth — Monthly (Preferred Partner)",     rates: r2(65,  87)  },
    { id: "part-gro-an",  label: "Growth — Annual (Preferred Partner)",      rates: r2(52,  70)  },
    { id: "ngo-ess-mo",   label: "Essentials — Monthly (NGO Rate)",          rates: r2(29,  39)  },
    { id: "ngo-gro-mo",   label: "Growth — Monthly (NGO Rate)",              rates: r2(49,  65)  },
    { id: "elite-pro-mo", label: "Pro — Monthly (Elite Partner)",            rates: r2(99,  132) },
    { id: "elite-pro-an", label: "Pro — Annual (Elite Partner)",             rates: r2(79,  105) },
  ];
}

// Currencies offerable in the Create-price dialog. USD/CAD are the billed
// currencies; the rest can be captured for other markets.
const PRICE_CURRENCIES: { code: string; symbol: string; name: string }[] = [
  { code: "USD", symbol: "$",   name: "US Dollar" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "EUR", symbol: "€",   name: "Euro" },
  { code: "GBP", symbol: "£",   name: "British Pound" },
  { code: "AUD", symbol: "A$",  name: "Australian Dollar" },
];

const PAID_TIER_DESC: Record<PaidTier, string> = {
  Essentials: "Core software features with standard CS support.",
  Growth: "Expanded features and priority CS support for scaling teams.",
  Pro: "Full feature set with dedicated CS and the highest level of support.",
};

/* ─────────────── Main wizard ─────────────── */

type Props = {
  onClose: () => void;
  onCreate?: (company: Omit<Company, "id">) => void;
  // When provided, the wizard runs in edit mode: fields are prefilled from the
  // company and saving calls onSave with the same id instead of creating a new one.
  editCompany?: Company;
  onSave?: (company: Company) => void;
  // Renders only the Plan step as a single page (no step rail / Company-details
  // step). Used by the "Manage Subscription" action on the Companies list.
  subscriptionOnly?: boolean;
  // Navigates to the B2B tab within Product Config, used by the Industry and
  // Partnership subtext links on the Company details step.
  onNavigateToProductConfig?: () => void;
};

function planFor(c: Company): Plan {
  if (c.tier === "Free Trial") return "free-trial";
  if (c.tier === "Free Access") return "complimentary";
  return "subscription";
}

export function NewCompanyWizard({ onClose, onCreate, editCompany, onSave, subscriptionOnly = false, onNavigateToProductConfig }: Props) {
  const isEdit = !!editCompany;
  // Billing defaults are derived for seed companies that have no explicit values,
  // so the edit form starts populated either way.
  const editBilling = editCompany ? getCompanyBilling(editCompany) : null;

  // A company whose free trial has expired cannot be put back onto a trial — it
  // can only convert to a paid Subscription or be granted Free Access.
  const trialExpired = isEdit && editBilling?.status === "Trial Expired";

  // When editing a company that already has a running paid subscription, the
  // billing-impact rail becomes a change preview (diff + proration) instead of
  // the new-company "what happens on save" summary.
  const currentSub: CurrentSub | null =
    isEdit && editCompany && editBilling &&
    (editBilling.status === "Active" || editBilling.status === "Past Due") &&
    (["Essentials", "Growth", "Pro"] as Tier[]).includes(editCompany.tier)
      ? {
          tier: editCompany.tier as PaidTier,
          cycle: editBilling.billingCycle,
          rate: editBilling.ratePerSeat,
          seats: editCompany.seats,
          payment: editBilling.payment,
          currency: editBilling.currency,
          nextBillingDate: editBilling.nextBillingDate,
        }
      : null;

  // Company details
  const [name, setName] = useState(editCompany?.name ?? "");
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(editCompany?.taxStatus ?? "Taxable");
  const [assignedCsm, setAssignedCsm] = useState(editCompany?.assignedCsm ?? "");
  const [assignedSalesRep, setAssignedSalesRep] = useState(
    editCompany?.assignedSalesRep ?? CURRENT_SALES_REP,
  );
  // Structured address (Figma 101:337). Composed into a flat string on save.
  const [country, setCountry] = useState(editCompany?.addressParts?.country ?? "United States");
  const [addrLine1, setAddrLine1] = useState(editCompany?.addressParts?.line1 ?? "");
  const [addrLine2, setAddrLine2] = useState(editCompany?.addressParts?.line2 ?? "");
  const [addrCity, setAddrCity] = useState(editCompany?.addressParts?.city ?? "");
  const [addrPin, setAddrPin] = useState(editCompany?.addressParts?.pin ?? "");
  const [addrState, setAddrState] = useState(editCompany?.addressParts?.state ?? "");
  const [contactName, setContactName] = useState(editCompany?.contactName ?? "");
  const [email, setEmail] = useState(editCompany?.email ?? "");
  const [phone, setPhone] = useState(editCompany?.phone ?? "");
  const [industries, setIndustries] = useState<string[]>(
    editCompany?.industry ? editCompany.industry.split(",").map((s) => s.trim()).filter(Boolean) : [],
  );
  const [partnerships, setPartnerships] = useState<string[]>(
    editCompany?.partnership ? editCompany.partnership.split(",").map((s) => s.trim()).filter(Boolean) : [],
  );

  // Step 2
  const [plan, setPlan] = useState<Plan>(
    editCompany ? (trialExpired ? "subscription" : planFor(editCompany)) : "subscription",
  );
  const [tier, setTier] = useState<PaidTier>(
    editCompany && planFor(editCompany) === "subscription" ? (editCompany.tier as PaidTier) : "Growth",
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(editBilling?.billingCycle ?? "Monthly");
  const [currency, setCurrency] = useState<Currency>(editBilling?.currency ?? "USD");
  const [priceStr, setPriceStr] = useState(
    editCompany && planFor(editCompany) === "subscription" && editBilling ? String(editBilling.ratePerSeat) : "",
  );
  const [seats, setSeats] = useState(editCompany ? String(editCompany.seats) : "1");
  const [payment, setPayment] = useState<PaymentCollection>(editBilling?.payment ?? "Automatic");
  const [freeAccessEndDate, setFreeAccessEndDate] = useState(editCompany?.freeAccessEndDate ?? "");
  const [savedPrices, setSavedPrices] = useState<SavedPrice[]>(buildDefaultSavedPrices);
  const [showNewPriceModal, setShowNewPriceModal] = useState(false);

  // Three-step split-view wizard (matches the Tasks wizard shell): 0 = Company
  // details, 1 = Admin account, 2 = Plan. The billing-impact rail and the save
  // action live on the Plan step; the footer drives navigation. In
  // subscription-only mode the wizard is locked to the Plan step and the step
  // rail is hidden.
  const [step, setStep] = useState(subscriptionOnly ? 2 : 0);

  // Success / confirmation
  const [createdCompany, setCreatedCompany] = useState<Omit<Company, "id"> | null>(null);
  // Built but not yet created — shown on the confirmation screen so a brand-new
  // company (not an edit) can be reviewed before it's actually saved.
  const [pendingCompany, setPendingCompany] = useState<Omit<Company, "id"> | null>(null);

  const isSubscription = plan === "subscription";
  const sym = CURRENCY_SYMBOL[currency];
  const baseRate = isSubscription ? defaultRate(tier, billingCycle, currency) : 0;
  const seatCount = parseInt(seats, 10) || 0;
  const effectiveRate = parseFloat(priceStr) || baseRate;
  const monthlyTotal = isSubscription ? effectiveRate * seatCount : 0;

  // Auto-fill price when tier / cycle / currency changes. Skip the first run in
  // edit mode so a prefilled custom rate isn't clobbered by the default.
  // useLayoutEffect so the new rate is flushed before paint — no stale-rate frame
  // in the billing-impact rail after a tier switch.
  const priceInitRef = useRef(false);
  useLayoutEffect(() => {
    if (!priceInitRef.current) {
      priceInitRef.current = true;
      if (isEdit) return;
    }
    if (isSubscription) setPriceStr(String(baseRate));
  }, [tier, billingCycle, currency, plan]);

  // Per-step validation gates the full wizard; in subscription-only mode these
  // fields aren't shown, so identity is taken as already-valid. Each list is
  // ordered top-to-bottom to match the form layout, so the CTA tooltip always
  // surfaces the first thing the admin needs to fix as they scan down the page.
  const step0Checks: { valid: boolean; message: string }[] = subscriptionOnly ? [] : [
    { valid: name.trim().length > 0, message: "Add a company name to continue." },
    { valid: addrPin.trim().length > 0, message: "Add a Zipcode to continue." },
  ];
  const step1Checks: { valid: boolean; message: string }[] = subscriptionOnly ? [] : [
    { valid: contactName.trim().length > 0, message: "Add an account holder name to continue." },
    { valid: email.trim().length > 0, message: "Add an account email to continue." },
  ];
  // A per-seat rate that isn't a saved Stripe price can't be used to create a
  // subscription — the admin must save it as a new price first.
  const priceValid = !isSubscription || savedPrices.some((p) => (p.rates[currency] ?? 0) === effectiveRate);
  // A subscription must have at least one paid seat before it can be saved.
  const seatsValid = !isSubscription || seatCount > 0;
  // Free Access is open-ended unless an end date is set, so one is required.
  const freeAccessValid = plan !== "complimentary" || freeAccessEndDate.trim().length > 0;
  const step2Checks: { valid: boolean; message: string }[] = [
    ...(isSubscription
      ? [
          { valid: priceValid, message: "Save the custom price before creating the subscription." },
          { valid: seatsValid, message: "Enter at least one seat for a subscription." },
        ]
      : []),
    ...(plan === "complimentary"
      ? [{ valid: freeAccessValid, message: "Set an end date for Free Access." }]
      : []),
  ];

  const companyValid = step0Checks.every((c) => c.valid);
  const adminValid = step1Checks.every((c) => c.valid);
  const detailsValid = companyValid && adminValid;
  const canSave = detailsValid && step2Checks.every((c) => c.valid);

  // First unmet requirement on the step currently in view, shown as a tooltip
  // on the disabled CTA (hover, not static text).
  const ctaTooltip = step === 0
    ? step0Checks.find((c) => !c.valid)?.message ?? ""
    : step === 1
    ? step1Checks.find((c) => !c.valid)?.message ?? ""
    : step2Checks.find((c) => !c.valid)?.message ?? "";

  // Editing a running paid subscription → the rail shows a change preview (diff +
  // proration); switching plan type away from subscription → a scheduled change.
  // Both also drive the footer's primary-action label.
  const change =
    currentSub && plan === "subscription"
      ? computeChange(currentSub, {
          tier, cycle: billingCycle, rate: effectiveRate, seats: seatCount, payment, currency,
        })
      : null;
  const planTypeChange =
    currentSub && plan !== "subscription"
      ? {
          target: plan === "free-trial" ? "Free Trial" : "Free Access",
          renew: currentSub.nextBillingDate,
        }
      : null;
  const saveCta = change
    ? change.applyLabel
    : planTypeChange
    ? "Schedule change"
    : isEdit
    ? "Save changes"
    : "Create company";

  const STEPS: { id: string; label: string; sub: string; desc: string }[] = [
    {
      id: "details",
      label: "Company details",
      sub: "Identity & segmentation",
      desc: "Identify the company. Industry and partnership are used for segmentation and reporting.",
    },
    {
      id: "admin",
      label: "Admin account",
      sub: "Primary contact",
      desc: "The primary contact and first Admin account for the company.",
    },
    {
      id: "plan",
      label: "Plan",
      sub: "Access & billing",
      desc: "Choose the access plan. Subscription plans require billing configuration.",
    },
  ];


  function handleCreate() {
    const company: Omit<Company, "id"> = {
      name: name.trim(),
      email: email.trim(),
      tier: plan === "subscription" ? tier : plan === "complimentary" ? "Free Access" : "Free Trial",
      seats: seatCount,
      industry: industries.join(", "),
      partnership: partnerships.join(", "),
      taxStatus,
      assignedCsm: assignedCsm || undefined,
      assignedSalesRep: assignedSalesRep || undefined,
      address: [addrLine1, addrLine2, addrCity, addrState, addrPin, country]
        .map((s) => s.trim()).filter(Boolean).join(", ") || undefined,
      addressParts: [country, addrLine1, addrLine2, addrCity, addrPin, addrState].some((s) => s.trim())
        ? {
            country: country.trim() || undefined,
            line1: addrLine1.trim() || undefined,
            line2: addrLine2.trim() || undefined,
            city: addrCity.trim() || undefined,
            pin: addrPin.trim() || undefined,
            state: addrState.trim() || undefined,
          }
        : undefined,
      contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      // Preserve a Past Due subscription on edit instead of silently clearing the
      // overdue state; a plan change doesn't settle the outstanding invoice.
      status: plan === "free-trial"
        ? "Free Trial"
        : plan === "complimentary"
        ? "Free Access"
        : isEdit && editBilling?.status === "Past Due"
        ? "Past Due"
        : "Active",
      ...(isSubscription
        ? {
            billingCycle,
            currency,
            payment,
            ratePerSeat: effectiveRate,
          }
        : {}),
      ...(plan === "complimentary"
        ? { freeAccessEndDate: freeAccessEndDate.trim() || undefined }
        : {}),
    };
    if (isEdit && editCompany) {
      onSave?.({ ...company, id: editCompany.id });
      setCreatedCompany(company);
    } else {
      // New companies go through a confirmation screen before they're actually
      // created — nothing is saved yet.
      setPendingCompany(company);
    }
  }

  function handleConfirmCreate() {
    if (!pendingCompany) return;
    onCreate?.(pendingCompany);
    setCreatedCompany(pendingCompany);
    setPendingCompany(null);
  }

  if (createdCompany) {
    // A subscription billed automatically gets a Stripe payment link to send to
    // the account holder; everything else (invoicing, trials, free access, or an
    // edit) has nothing further to collect, so it goes straight to the full summary.
    const showPaymentLink = !isEdit && isSubscription && createdCompany.payment === "Automatic";
    return showPaymentLink ? (
      <PaymentLinkScreen company={createdCompany} onClose={onClose} />
    ) : (
      <SuccessScreen
        company={createdCompany}
        plan={plan}
        tier={isSubscription ? tier : undefined}
        isEdit={isEdit}
        onClose={onClose}
      />
    );
  }

  if (pendingCompany) {
    return (
      <ConfirmCompanyScreen
        company={pendingCompany}
        plan={plan}
        tier={isSubscription ? tier : undefined}
        onBack={() => setPendingCompany(null)}
        onConfirm={handleConfirmCreate}
      />
    );
  }

  return (
    <div className={`wizard company-wizard${subscriptionOnly ? " company-wizard--sub" : ""}`}>
      <div className="wizard-body">
        {!subscriptionOnly && (
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">
              {isEdit ? "Editing" : "Creating"}
            </span>
            <span className="wizard-brand-name">
              {editCompany ? editCompany.name : "New Company"}
            </span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((s, i) => {
              const status = i === step ? "active" : i < step ? "done" : "upcoming";
              return (
                <li
                  key={s.id}
                  className={`wizard-step ${status}`}
                  onClick={() => setStep(i)}
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
        )}

        <div className="wizard-content">
          {step === 0 ? (
            <Step1Details
              name={name} setName={setName}
              taxStatus={taxStatus} setTaxStatus={setTaxStatus}
              assignedCsm={assignedCsm} setAssignedCsm={setAssignedCsm}
              assignedSalesRep={assignedSalesRep} setAssignedSalesRep={setAssignedSalesRep}
              country={country} setCountry={setCountry}
              addrLine1={addrLine1} setAddrLine1={setAddrLine1}
              addrLine2={addrLine2} setAddrLine2={setAddrLine2}
              addrCity={addrCity} setAddrCity={setAddrCity}
              addrPin={addrPin} setAddrPin={setAddrPin}
              addrState={addrState} setAddrState={setAddrState}
              industries={industries} setIndustries={setIndustries}
              partnerships={partnerships} setPartnerships={setPartnerships}
              onNavigateToProductConfig={onNavigateToProductConfig}
            />
          ) : step === 1 ? (
            <StepAdminAccount
              contactName={contactName} setContactName={setContactName}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
            />
          ) : (
            <Step2Plan
              plan={plan} setPlan={setPlan}
              tier={tier} setTier={setTier}
              billingCycle={billingCycle} setBillingCycle={setBillingCycle}
              currency={currency} setCurrency={setCurrency}
              priceStr={priceStr} setPriceStr={setPriceStr}
              seats={seats} setSeats={setSeats}
              payment={payment} setPayment={setPayment}
              baseRate={baseRate} effectiveRate={effectiveRate}
              monthlyTotal={monthlyTotal} seatCount={seatCount} sym={sym}
              savedPrices={savedPrices}
              onCreatePrice={() => setShowNewPriceModal(true)}
              trialExpired={trialExpired}
              freeAccessEndDate={freeAccessEndDate} setFreeAccessEndDate={setFreeAccessEndDate}
              seatsLocked={isEdit}
              hideSummary
            />
          )}
        </div>

        {step === 2 && (
          <BillingImpactRail
            change={change}
            planTypeChange={planTypeChange}
            currentSub={currentSub}
            plan={plan}
            tier={tier}
            billingCycle={billingCycle}
            payment={payment}
            effectiveRate={effectiveRate}
            seatCount={seatCount}
            monthlyTotal={monthlyTotal}
            sym={sym}
          />
        )}
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          {step > 0 && !subscriptionOnly && (
            <button className="btn-save-draft" onClick={() => setStep(step - 1)}>Back</button>
          )}
          {step === 0 ? (
            <button
              className={`btn-publish${ctaTooltip ? " has-cta-tooltip" : ""}`}
              disabled={!companyValid}
              data-tooltip={ctaTooltip}
              onClick={() => setStep(1)}
            >
              Continue
            </button>
          ) : step === 1 ? (
            <button
              className={`btn-publish${ctaTooltip ? " has-cta-tooltip" : ""}`}
              disabled={!adminValid}
              data-tooltip={ctaTooltip}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          ) : (
            <button
              className={`btn-publish${ctaTooltip ? " has-cta-tooltip" : ""}`}
              disabled={!canSave}
              data-tooltip={ctaTooltip}
              onClick={handleCreate}
            >
              {saveCta}
            </button>
          )}
        </div>
      </footer>

      {showNewPriceModal && (
        <CreatePriceModal
          initialCurrency={currency}
          initialRate={priceStr}
          onClose={() => setShowNewPriceModal(false)}
          onCreate={(p) => {
            setSavedPrices((prev) => [...prev, p]);
            setPriceStr(p.rates[currency] ? String(p.rates[currency]) : "");
            setShowNewPriceModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ─────────────── Billing impact rail ─────────────── */

const TIER_ORDER: Record<PaidTier, number> = { Essentials: 0, Growth: 1, Pro: 2 };
const MONTH_IDX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};
// The admin tool's notion of "today" (matches the session date used elsewhere).
const APP_TODAY = new Date(2026, 5, 24);
// Mirrors the default "Free Trial Length" configured in Product Config → B2B Management.
const TRIAL_DAYS = 14;

function money(n: number, sym: string): string {
  return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function shortCycle(c: BillingCycle): string { return c === "Annual" ? "yr" : "mo"; }
function cycleWord(c: BillingCycle): string { return c === "Annual" ? "Yearly" : "Monthly"; }
function payLabel(p: PaymentCollection): string { return p === "Automatic" ? "Automatic" : "Manual (invoice)"; }
// Per-cycle invoiced total. `total` is the monthly-equivalent (rate × seats);
// annual plans invoice 12× that once a year.
function cycleTotal(total: number, cycle: BillingCycle): number {
  return cycle === "Annual" ? total * 12 : total;
}
function totalDisplay(total: number, cycle: BillingCycle, sym: string): string {
  return `${money(cycleTotal(total, cycle), sym)} / ${shortCycle(cycle)}`;
}

// Full month names for the billing-impact timeline date labels (Figma 107:1236
// shows e.g. "JULY 1, 2026"). nextBillingDate is stored as "<Mon> 1" with no
// year, so years are derived relative to APP_TODAY.
const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function fmtFullDate(d: Date): string {
  return `${FULL_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
// The first occurrence of the 1st of `monthIdx` strictly after APP_TODAY.
function nextFirstOfMonth(monthIdx: number): Date {
  const y = APP_TODAY.getFullYear();
  const d = new Date(y, monthIdx, 1);
  return d.getTime() > APP_TODAY.getTime() ? d : new Date(y + 1, monthIdx, 1);
}

// Days remaining in the current billing period, relative to APP_TODAY. Everyone
// bills on the 1st: a monthly cycle's days-left is the distance to the next 1st;
// an annual cycle's is the distance to the renewal month's 1st.
function daysLeftInCycle(nextBillingDate: string, cycle: BillingCycle): { daysLeft: number; cycleDays: number; frac: number } {
  if (cycle === "Annual") {
    const cycleDays = 365;
    const mo = MONTH_IDX[nextBillingDate.slice(0, 3)];
    let daysLeft = Math.round(cycleDays * 0.6);
    if (mo !== undefined) {
      let d = new Date(2026, mo, 1);
      if (d.getTime() <= APP_TODAY.getTime()) d = new Date(2027, mo, 1);
      const diff = Math.round((d.getTime() - APP_TODAY.getTime()) / 86400000);
      daysLeft = Math.max(1, Math.min(cycleDays, diff));
    }
    return { daysLeft, cycleDays, frac: daysLeft / cycleDays };
  }
  // Monthly: days until the next 1st of the month.
  const cycleDays = 30;
  const next = new Date(APP_TODAY.getFullYear(), APP_TODAY.getMonth() + 1, 1);
  const diff = Math.round((next.getTime() - APP_TODAY.getTime()) / 86400000);
  const daysLeft = Math.max(1, Math.min(cycleDays, diff));
  return { daysLeft, cycleDays, frac: daysLeft / cycleDays };
}

// Conversion to a common currency (USD) so cross-currency totals can be compared
// and prorated without treating, say, CA$105 as larger than $79. Derived from the
// default-rate table (CAD ≈ 1.33 × USD).
const USD_VALUE: Record<Currency, number> = { USD: 1, CAD: 0.75 };
function toUSD(amount: number, c: Currency): number { return amount * USD_VALUE[c]; }

type Target = {
  tier: PaidTier;
  cycle: BillingCycle;
  rate: number;
  seats: number;
  payment: PaymentCollection;
  currency: Currency;
};

type ChangeRow = { label: string; oldStr: string; newStr: string };
// One dot on the billing-impact timeline (Figma 107:1236 "Billing Impact").
type TimelineEntry = { date: string; amount?: string; desc: string; now?: boolean; muted?: boolean };
type ChangePreview = {
  anyChange: boolean;
  label: string;
  channel: "Self-serve" | "CS";
  immediate: boolean;
  prorationParam: string;
  rows: ChangeRow[];
  chargeNow: number;
  chargeStr: string;
  chargeReason: string;
  applyLabel: string;
  // Subscription-preview redesign (Figma 107:1236): an "Effective Today"-style
  // pill on the What's-Changing header, and the Billing Impact timeline.
  pill: { text: string; muted: boolean } | null;
  timeline: TimelineEntry[];
};

function computeChange(cur: CurrentSub, tgt: Target): ChangePreview {
  const oldSym = CURRENCY_SYMBOL[cur.currency];
  const newSym = CURRENCY_SYMBOL[tgt.currency];
  const oldTotal = cur.rate * cur.seats;
  const newTotal = tgt.rate * tgt.seats;
  const dir = TIER_ORDER[tgt.tier] - TIER_ORDER[cur.tier];
  const cycleChanged = cur.cycle !== tgt.cycle;
  const toAnnual = tgt.cycle === "Annual";
  const rateChanged = cur.rate !== tgt.rate;
  const currencyChanged = cur.currency !== tgt.currency;
  const seatsChanged = cur.seats !== tgt.seats;
  const paymentChanged = cur.payment !== tgt.payment;
  const billingChanged = dir !== 0 || cycleChanged || rateChanged || seatsChanged || currencyChanged;
  const anyChange = billingChanged || paymentChanged;

  const { daysLeft, cycleDays, frac } = daysLeftInCycle(cur.nextBillingDate, cur.cycle);
  const renew = cur.nextBillingDate;

  // Normalise to USD so cross-currency edits compare and prorate sensibly
  // (a CA$105 plan must not read as "larger" than a $79 one).
  const oldTotalUSD = toUSD(oldTotal, cur.currency);
  const newTotalUSD = toUSD(newTotal, tgt.currency);
  const totalEps = Math.max(1, oldTotalUSD * 0.01);
  const econDown = oldTotalUSD - newTotalUSD > totalEps;
  // Old recurring total expressed in the target currency, for the proration delta.
  const oldTotalInTgt = oldTotal * (USD_VALUE[cur.currency] / USD_VALUE[tgt.currency]);
  // Per-seat economic comparison (drives the price-increase / decrease label).
  const oldRateUSD = toUSD(cur.rate, cur.currency);
  const newRateUSD = toUSD(tgt.rate, tgt.currency);
  const rateEconChanged = Math.abs(newRateUSD - oldRateUSD) > Math.max(0.5, oldRateUSD * 0.01);

  // ── Label ──
  const parts: string[] = [];
  if (cycleChanged) parts.push(toAnnual ? "Monthly → Yearly" : "Yearly → Monthly");
  if (dir > 0) parts.push("Tier upgrade");
  else if (dir < 0) parts.push("Tier downgrade");
  if (currencyChanged) parts.push(`Currency ${cur.currency} → ${tgt.currency}`);
  if (rateEconChanged && dir === 0 && !cycleChanged) parts.push(newRateUSD > oldRateUSD ? "Price increase" : "Price decrease");
  else if (rateEconChanged) parts.push("custom rate");
  if (seatsChanged) parts.push(tgt.seats > cur.seats ? "Seats added" : "Seats removed");
  if (parts.length === 0 && paymentChanged) parts.push("Payment method update");
  const label = parts.join(" + ") || "Plan update";

  // ── Immediate vs scheduled ──
  let immediate: boolean;
  if (!billingChanged && paymentChanged) immediate = true; // collection-only change
  else if (cycleChanged) immediate = toAnnual ? dir >= 0 : dir > 0;
  else immediate = !econDown; // an increase or a flat redenomination applies now

  const channel: "Self-serve" | "CS" = immediate ? "Self-serve" : "CS";
  const prorationParam = !billingChanged && paymentChanged
    ? "collection_method update · no proration"
    : immediate
    ? "proration_behavior = always_invoice"
    : "subscription schedule · proration_behavior = none";

  // ── Charge + reason ──
  let chargeNow = 0;
  let chargeReason = "";

  if (!billingChanged && paymentChanged) {
    chargeReason = "Only how invoices are collected changes. Nothing is prorated or charged now.";
  } else if (immediate) {
    chargeNow = Math.max(0, newTotal - oldTotalInTgt) * frac;
    if (chargeNow > 0.005) {
      chargeReason = `+${money(newTotal - oldTotalInTgt, newSym)} / mo · prorated for the ${daysLeft} of ${cycleDays} days left in this cycle.`;
    } else {
      // Applies now but there is nothing to prorate: equal total, currency
      // redenomination, or a cycle switch that does not raise the recurring total.
      chargeReason = currencyChanged
        ? `Billing currency changes to ${tgt.currency}. Amounts are redenominated, not increased — no proration is charged now.`
        : "No increase to the recurring total — no proration is charged now.";
    }
  } else {
    // Scheduled for cycle end — no proration or refund now.
    chargeReason = "No prorations or refunds. The company stays on the current plan until the cycle ends, then moves to the new plan.";
  }

  // ── Diff rows (only what changed) ──
  const rows: ChangeRow[] = [];
  if (dir !== 0) rows.push({ label: "Tier", oldStr: cur.tier, newStr: tgt.tier });
  if (cycleChanged) rows.push({ label: "Cycle", oldStr: cycleWord(cur.cycle), newStr: cycleWord(tgt.cycle) });
  if (rateChanged || currencyChanged) {
    rows.push({ label: "Rate", oldStr: `${money(cur.rate, oldSym)}/seat/mo`, newStr: `${money(tgt.rate, newSym)}/seat/mo` });
  }
  if (seatsChanged) rows.push({ label: "Seats", oldStr: `${cur.seats}`, newStr: `${tgt.seats}` });
  const oldTotalStr = totalDisplay(oldTotal, cur.cycle, oldSym);
  const newTotalStr = totalDisplay(newTotal, tgt.cycle, newSym);
  if (oldTotalStr !== newTotalStr) rows.push({ label: "Total", oldStr: oldTotalStr, newStr: newTotalStr });
  if (paymentChanged) rows.push({ label: "Payment", oldStr: payLabel(cur.payment), newStr: payLabel(tgt.payment) });

  const applyLabel = !anyChange
    ? "Save changes"
    : !immediate
    ? "Schedule change"
    : chargeNow > 0
    ? `Apply · charge ${money(chargeNow, newSym)}`
    : "Apply change";

  // ── What's-Changing pill + Billing Impact timeline (Figma 107:1236) ──
  const pill: ChangePreview["pill"] = !anyChange
    ? null
    : immediate
    ? { text: "Effective Today", muted: false }
    : { text: "At Cycle End", muted: true };

  // The next billing boundary (cycle end) for the CURRENT sub: monthly subs
  // renew on the next 1st of the month; annual subs on the 1st of their renewal
  // month. The new plan's first full charge lands there; "onward" is one
  // new-cycle later. Amounts are the new recurring total in the target currency.
  const renewDate = cur.cycle === "Annual"
    ? nextFirstOfMonth(MONTH_IDX[renew.slice(0, 3)] ?? APP_TODAY.getMonth())
    : new Date(APP_TODAY.getFullYear(), APP_TODAY.getMonth() + 1, 1);
  const onwardDate = tgt.cycle === "Annual"
    ? new Date(renewDate.getFullYear() + 1, renewDate.getMonth(), 1)
    : new Date(renewDate.getFullYear(), renewDate.getMonth() + 1, 1);
  const newCycleTotalStr = money(cycleTotal(newTotal, tgt.cycle), newSym);
  const cycleAdj = tgt.cycle === "Annual" ? "yearly" : "monthly";
  const remainderWord = cur.cycle === "Annual" ? "year" : "month";
  // Collection-method-only edits (no tier/cycle/rate/seat change) must not be
  // framed as a new tier charge in the timeline.
  const collectionOnly = !billingChanged && paymentChanged;
  const payMethodWord = tgt.payment === "Automatic" ? "automatic card / ACH charge" : "manual invoice";

  let todayAmount: string;
  let todayDesc: string;
  if (!immediate) {
    todayAmount = money(0, newSym);
    todayDesc = `No charge today — the change is scheduled for cycle end on ${fmtFullDate(renewDate)}.`;
  } else if (collectionOnly) {
    todayAmount = money(0, newSym);
    todayDesc = "Collection method updated — nothing prorated or charged today.";
  } else if (chargeNow > 0.005) {
    todayAmount = money(chargeNow, newSym);
    // A mid-cycle upgrade that also switches to annual only prorates the current
    // (monthly) cycle today; the full annual term begins at renewal.
    todayDesc = cycleChanged && toAnnual
      ? `Prorated tier difference for the remainder of the ${remainderWord}; the yearly term begins at renewal.`
      : `Prorated difference charged now for the remainder of the ${remainderWord}.`;
  } else {
    todayAmount = money(0, newSym);
    todayDesc = currencyChanged
      ? "Redenominated to the new currency — no charge today."
      : "Applies now — no proration is charged today.";
  }

  const timeline: TimelineEntry[] = anyChange
    ? [
        {
          date: `TODAY · ${fmtFullDate(APP_TODAY).toUpperCase()}`,
          amount: todayAmount,
          desc: todayDesc,
          now: true,
        },
        {
          date: fmtFullDate(renewDate).toUpperCase(),
          amount: newCycleTotalStr,
          desc: collectionOnly
            ? `Next invoice collected via ${payMethodWord} — same amount.`
            : immediate
            ? `First full ${cycleAdj} charge for the ${tgt.tier} Tier.`
            : `New plan starts — first ${cycleAdj} charge for the ${tgt.tier} Tier.`,
        },
        {
          date: `${fmtFullDate(onwardDate).toUpperCase()} ONWARD`,
          amount: newCycleTotalStr,
          desc: collectionOnly
            ? `Recurring ${cycleAdj} via ${payMethodWord}.`
            : tgt.cycle === "Annual"
            ? `Recurring yearly on the 1st of ${FULL_MONTHS[renewDate.getMonth()]}.`
            : "Recurring monthly on the 1st of each month.",
          muted: true,
        },
      ]
    : [];

  return {
    anyChange, label, channel, immediate, prorationParam, rows,
    chargeNow, chargeStr: money(chargeNow, newSym), chargeReason,
    applyLabel, pill, timeline,
  };
}

// Presentational billing-impact rail shown on the Plan step. The change /
// planTypeChange decisions and the primary-action label are computed by the
// wizard; the footer owns the save button, so this only renders the card.
function BillingImpactRail({
  change, planTypeChange, currentSub,
  plan, tier, billingCycle, payment, effectiveRate, seatCount, monthlyTotal, sym,
}: {
  change: ChangePreview | null;
  planTypeChange: { target: string; renew: string } | null;
  currentSub: CurrentSub | null;
  plan: Plan;
  tier: PaidTier;
  billingCycle: BillingCycle;
  payment: PaymentCollection;
  effectiveRate: number;
  seatCount: number;
  monthlyTotal: number;
  sym: string;
}) {
  // Every case renders the same subscription-preview design (Figma 107:1236):
  // a top diff/summary card + a Billing Impact timeline. The three inputs are
  // normalised into one PreviewModel so there is a single render path.
  const model: PreviewModel =
    change
      ? changeToModel(change)
      : planTypeChange && currentSub
      ? planTypeChangeToModel(planTypeChange, currentSub)
      : createToModel({ plan, tier, billingCycle, payment, effectiveRate, seatCount, monthlyTotal, sym });

  return (
    <aside className="cw-impact">
      <div className="cw-impact-card">
        <SubPreview model={model} />
      </div>
    </aside>
  );
}

// Normalised model for the subscription preview. `rows` are either diffs
// (old → new, when there is a prior subscription) or plain summary values
// (new only, when creating). `empty` is the no-change-yet edit state.
type PreviewRow = { label: string; oldStr?: string; newStr: string };
type PreviewModel = {
  empty?: boolean;
  topLabel: string;
  pill: { text: string; muted: boolean } | null;
  rows: PreviewRow[];
  timeline: TimelineEntry[];
};

// Editing a running paid subscription (plan stays "subscription").
function changeToModel(change: ChangePreview): PreviewModel {
  if (!change.anyChange) {
    return { empty: true, topLabel: "What's Changing", pill: null, rows: [], timeline: [] };
  }
  return {
    topLabel: "What's Changing",
    pill: change.pill,
    rows: change.rows.map((r) => ({ label: r.label, oldStr: r.oldStr, newStr: r.newStr })),
    timeline: change.timeline,
  };
}

// Editing a running paid subscription, switching plan type away from
// subscription (→ Free Trial / Free Access). Scheduled for cycle end; no charge.
function planTypeChangeToModel(
  ptc: { target: string; renew: string },
  cur: CurrentSub,
): PreviewModel {
  const curSym = CURRENCY_SYMBOL[cur.currency];
  const curTotal = cur.rate * cur.seats;
  const isTrial = ptc.target === "Free Trial";
  // The true cycle boundary, computed the same way as computeChange(): monthly
  // subs end at the next 1st of the month; annual subs at their renewal month's
  // 1st. (The stored nextBillingDate month is only meaningful for annual subs.)
  const renewDate = cur.cycle === "Annual"
    ? nextFirstOfMonth(MONTH_IDX[ptc.renew.slice(0, 3)] ?? APP_TODAY.getMonth())
    : new Date(APP_TODAY.getFullYear(), APP_TODAY.getMonth() + 1, 1);
  const renewStr = fmtFullDate(renewDate);
  return {
    topLabel: "What's Changing",
    pill: { text: "At Cycle End", muted: true },
    rows: [
      { label: "Plan", oldStr: `${cur.tier} Subscription`, newStr: ptc.target },
      { label: "Recurring", oldStr: totalDisplay(curTotal, cur.cycle, curSym), newStr: money(0, curSym) },
    ],
    timeline: [
      {
        date: `TODAY · ${fmtFullDate(APP_TODAY).toUpperCase()}`,
        amount: money(0, curSym),
        desc: `No charge today — the change is scheduled for cycle end on ${renewStr}.`,
        now: true,
      },
      {
        date: renewStr.toUpperCase(),
        amount: money(0, curSym),
        desc: isTrial
          ? "Subscription ends and the free trial begins — no charge."
          : "Subscription ends and free access begins — no charge.",
      },
      {
        date: "ONGOING",
        amount: money(0, curSym),
        desc: isTrial
          ? "Converts to a paid subscription automatically when the trial ends."
          : "Full access continues until it is manually revoked.",
        muted: true,
      },
    ],
  };
}

// Creating a new company, or editing one without a running paid subscription.
// No prior state to diff against, so the top card is a plain plan summary.
function createToModel({
  plan, tier, billingCycle, payment, effectiveRate, seatCount, monthlyTotal, sym,
}: {
  plan: Plan;
  tier: PaidTier;
  billingCycle: BillingCycle;
  payment: PaymentCollection;
  effectiveRate: number;
  seatCount: number;
  monthlyTotal: number;
  sym: string;
}): PreviewModel {
  const y = APP_TODAY.getFullYear();
  const m = APP_TODAY.getMonth();
  const todayLabel = `TODAY · ${fmtFullDate(APP_TODAY).toUpperCase()}`;

  if (plan === "free-trial") {
    const trialEnd = new Date(APP_TODAY.getTime() + TRIAL_DAYS * 86400000);
    return {
      topLabel: "Plan Summary",
      pill: { text: "No Charge", muted: true },
      rows: [{ label: "Plan", newStr: "Free Trial" }],
      timeline: [
        {
          date: todayLabel,
          amount: money(0, sym),
          desc: "Free trial begins — no charge and no payment method required.",
          now: true,
        },
        {
          date: `TRIAL ENDS · ${fmtFullDate(trialEnd).toUpperCase()}`,
          desc: `Trial length is set in Product Config (${TRIAL_DAYS} days).`,
          muted: true,
        },
      ],
    };
  }

  if (plan === "complimentary") {
    return {
      topLabel: "Plan Summary",
      pill: { text: "No Charge", muted: true },
      rows: [{ label: "Plan", newStr: "Free Access" }],
      timeline: [
        {
          date: todayLabel,
          amount: money(0, sym),
          desc: "Free access granted — no Stripe subscription or invoice is created.",
          now: true,
        },
        {
          date: "ONGOING",
          amount: money(0, sym),
          desc: "Full access continues until it is manually revoked.",
          muted: true,
        },
      ],
    };
  }

  // New subscription — effective today. Everyone bills on the 1st, so a monthly
  // sub is prorated for the remainder of the month today, then charged the full
  // amount on the 1st; an annual sub is charged the full year upfront and renews
  // a year out (no near-term second charge to prorate).
  const automatic = payment === "Automatic";
  const rows: PreviewRow[] = [
    { label: "Plan", newStr: "Subscription" },
    { label: "Tier", newStr: tier },
    { label: "Cycle", newStr: cycleWord(billingCycle) },
    { label: "Per seat", newStr: `${money(effectiveRate, sym)} / mo` },
    { label: "Seats", newStr: seatCount.toLocaleString() },
    { label: "Total", newStr: totalDisplay(monthlyTotal, billingCycle, sym) },
  ];

  let timeline: TimelineEntry[];
  if (billingCycle === "Annual") {
    const fullYear = money(cycleTotal(monthlyTotal, "Annual"), sym);
    const renewDate = new Date(y + 1, m, 1);
    const onwardDate = new Date(y + 2, m, 1);
    timeline = [
      {
        date: todayLabel,
        amount: fullYear,
        desc: automatic
          ? `First yearly charge for the ${tier} Tier — collected via the payment link.`
          : `First yearly invoice for the ${tier} Tier — payable within the configured window.`,
        now: true,
      },
      { date: fmtFullDate(renewDate).toUpperCase(), amount: fullYear, desc: `Renews — yearly charge for the ${tier} Tier.` },
      {
        date: `${fmtFullDate(onwardDate).toUpperCase()} ONWARD`,
        amount: fullYear,
        desc: `Recurring yearly on ${FULL_MONTHS[m]} 1.`,
        muted: true,
      },
    ];
  } else {
    const fullMonth = money(monthlyTotal, sym);
    const { daysLeft, cycleDays, frac } = daysLeftInCycle("", "Monthly");
    const proratedNow = money(monthlyTotal * frac, sym);
    const firstFullDate = new Date(y, m + 1, 1);
    const onwardDate = new Date(y, m + 2, 1);
    timeline = [
      {
        date: todayLabel,
        amount: proratedNow,
        desc: automatic
          ? `Prorated first charge for the ${daysLeft} of ${cycleDays} days left this month — collected via the payment link.`
          : `Prorated first invoice for the ${daysLeft} of ${cycleDays} days left this month.`,
        now: true,
      },
      { date: fmtFullDate(firstFullDate).toUpperCase(), amount: fullMonth, desc: `First full monthly charge for the ${tier} Tier.` },
      {
        date: `${fmtFullDate(onwardDate).toUpperCase()} ONWARD`,
        amount: fullMonth,
        desc: "Recurring monthly on the 1st of each month.",
        muted: true,
      },
    ];
  }

  return {
    topLabel: "Plan Summary",
    pill: { text: "Effective Today", muted: false },
    rows,
    timeline,
  };
}

// Subscription preview (Figma 107:1236): a "What's Changing" / "Plan Summary"
// card + a "Billing Impact" timeline. One render path for every wizard case.
function SubPreview({ model }: { model: PreviewModel }) {
  if (model.empty) {
    return (
      <div className="sub-preview-empty">
        <div className="sub-preview-empty-title">No billing changes</div>
        <div className="sub-preview-empty-sub">Change the tier, cycle, rate, seats, or payment method to preview the impact.</div>
      </div>
    );
  }
  return (
    <div className="sub-preview">
      <section className="sub-preview-sec">
        <PageBreak
          label={model.topLabel}
          trailing={
            model.pill && (
              <span className={`sub-pill ${model.pill.muted ? "sub-pill--muted" : "sub-pill--accent"}`}>
                {model.pill.text}
              </span>
            )
          }
        />
        <div className="sub-changes-wrap">
          <div className="sub-changes">
            {model.rows.map((r) => (
              <div className="sub-change-row" key={r.label}>
                <span className="sub-change-label">{r.label}</span>
                <span className="sub-change-val">
                  {r.oldStr != null && (
                    <>
                      <span className="sub-change-old">{r.oldStr}</span>
                      <span className="sub-change-arrow">→</span>
                    </>
                  )}
                  <span className="sub-change-new">{r.newStr}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sub-preview-sec">
        <PageBreak label="Billing Impact" />
        <div className="sub-timeline">
          {model.timeline.map((t, i) => (
            <div className="sub-timeline-item" key={i}>
              <div className="sub-timeline-rail">
                <span className={`sub-timeline-dot ${t.now ? "is-now" : ""}`} />
                {i < model.timeline.length - 1 && <span className="sub-timeline-divider" />}
              </div>
              <div className="sub-timeline-body">
                <p className="sub-timeline-date">{t.date}</p>
                {t.amount != null && (
                  <p className={`sub-timeline-amount ${t.muted ? "is-muted" : ""}`}>{t.amount}</p>
                )}
                <p className="sub-timeline-desc">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────── Step 1 — Company details ─────────────── */

function Step1Details({
  name, setName,
  taxStatus, setTaxStatus,
  assignedCsm, setAssignedCsm,
  assignedSalesRep, setAssignedSalesRep,
  country, setCountry,
  addrLine1, setAddrLine1,
  addrLine2, setAddrLine2,
  addrCity, setAddrCity,
  addrPin, setAddrPin,
  addrState, setAddrState,
  industries, setIndustries,
  partnerships, setPartnerships,
  onNavigateToProductConfig,
}: {
  name: string; setName: (v: string) => void;
  taxStatus: TaxStatus; setTaxStatus: (v: TaxStatus) => void;
  assignedCsm: string; setAssignedCsm: (v: string) => void;
  assignedSalesRep: string; setAssignedSalesRep: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  addrLine1: string; setAddrLine1: (v: string) => void;
  addrLine2: string; setAddrLine2: (v: string) => void;
  addrCity: string; setAddrCity: (v: string) => void;
  addrPin: string; setAddrPin: (v: string) => void;
  addrState: string; setAddrState: (v: string) => void;
  industries: string[]; setIndustries: (v: string[]) => void;
  partnerships: string[]; setPartnerships: (v: string[]) => void;
  onNavigateToProductConfig?: () => void;
}) {
  return (
    <>
      <h1 className="wizard-title">Company details</h1>
      <p className="wizard-desc">
        Identify the company. Industry and partnership are used for segmentation and reporting.
      </p>

      <div className="form-group">
        <label className="form-label">Company Name <span className="req">*</span></label>
        <input
          autoFocus
          className="form-input"
          placeholder="Company Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="form-help">This will be the name shown on Stripe's receipts</p>
      </div>

      <div className="form-group">
        <label className="form-label">Address <span className="req">*</span></label>
        <div className="address-field">
          <SelectField
            value={country}
            options={COUNTRY_OPTIONS}
            onChange={setCountry}
            renderTrigger={({ toggle, label }) => (
              <button type="button" className="address-row address-row-btn" onClick={toggle}>
                <span className="address-select">{label}</span>
                <span className="address-chevron"><ChevronDownIcon /></span>
              </button>
            )}
          />
          <input
            className="address-input"
            placeholder="Address Line 1"
            value={addrLine1}
            onChange={(e) => setAddrLine1(e.target.value)}
          />
          <input
            className="address-input"
            placeholder="Address Line 2"
            value={addrLine2}
            onChange={(e) => setAddrLine2(e.target.value)}
          />
          <div className="address-split">
            <input
              className="address-input address-cell"
              placeholder="City"
              value={addrCity}
              onChange={(e) => setAddrCity(e.target.value)}
            />
            <input
              className="address-input address-cell"
              placeholder="Zipcode*"
              value={addrPin}
              onChange={(e) => setAddrPin(e.target.value)}
            />
          </div>
          <SelectField
            value={addrState}
            options={US_STATES}
            onChange={setAddrState}
            placeholder="State"
            renderTrigger={({ toggle, label, isPlaceholder }) => (
              <button type="button" className="address-row address-row-btn" onClick={toggle}>
                <span className={`address-select ${isPlaceholder ? "is-placeholder" : ""}`}>{label}</span>
                <span className="address-chevron"><ChevronDownIcon /></span>
              </button>
            )}
          />
        </div>
        <p className="form-help">Country and Zipcode are mandatory</p>
      </div>

      <div className="form-group">
        <label className="form-label">Tax Status <span className="req">*</span></label>
        <SelectField value={taxStatus} options={TAX_STATUSES} onChange={setTaxStatus} />
        <p className="form-help">
          Refer to{" "}
          <a
            href="https://docs.stripe.com/tax/zero-tax"
            target="_blank"
            rel="noopener noreferrer"
            className="form-help-link"
          >
            Stripe's Documentation
          </a>{" "}
          for more details
        </p>
      </div>

      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label">Assigned CSM</label>
          <SelectField
            value={assignedCsm}
            options={CSM_OPTIONS}
            onChange={setAssignedCsm}
            placeholder="Unassigned"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Assigned Sales Rep</label>
          <SelectField
            value={assignedSalesRep}
            options={SALES_REP_OPTIONS}
            onChange={setAssignedSalesRep}
            placeholder="Unassigned"
          />
        </div>
      </div>

      <div className="form-row-2">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Industry</label>
          <MultiSelect
            options={INDUSTRY_OPTIONS}
            value={industries}
            onChange={setIndustries}
            placeholder="Select Industries"
            searchPlaceholder="Search Industries…"
          />
          <p className="form-help co-w-manage-link">
            Manage Industries on{" "}
            <a
              href="#"
              className="text-link"
              onClick={(e) => {
                e.preventDefault();
                onNavigateToProductConfig?.();
              }}
            >
              Product Config <ArrowUpRightIcon />
            </a>
          </p>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Partnership</label>
          <MultiSelect
            options={PARTNERSHIP_OPTIONS}
            value={partnerships}
            onChange={setPartnerships}
            placeholder="Select Partnerships"
            searchPlaceholder="Search Partnerships…"
          />
          <p className="form-help co-w-manage-link">
            Manage Partnerships on{" "}
            <a
              href="#"
              className="text-link"
              onClick={(e) => {
                e.preventDefault();
                onNavigateToProductConfig?.();
              }}
            >
              Product Config <ArrowUpRightIcon />
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

/* ─────────────── Step 2 — Admin account ─────────────── */

// Country dial codes for the phone field. First entry is the default.
const DIAL_CODES: { code: string; label: string }[] = [
  { code: "+1",  label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+61", label: "AU (+61)" },
  { code: "+91", label: "IN (+91)" },
  { code: "+49", label: "DE (+49)" },
  { code: "+33", label: "FR (+33)" },
  { code: "+52", label: "MX (+52)" },
  { code: "+55", label: "BR (+55)" },
];

// Strip everything but digits, then group as XXX-XXX-XXXX… (3-3-rest). This is
// what the phone input shows as the user types; non-digits are simply dropped.
function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Dial-code select + auto-formatting number field. The composed value stored in
// `phone` is "<dial> <formatted>" (e.g. "+1 555-123-4567").
function PhoneField({ phone, setPhone }: { phone: string; setPhone: (v: string) => void }) {
  const [dialCode, setDialCode] = useState(() => {
    const match = DIAL_CODES.find((d) => phone.startsWith(d.code));
    return match ? match.code : DIAL_CODES[0].code;
  });
  const [national, setNational] = useState(() => {
    const match = DIAL_CODES.find((d) => phone.startsWith(d.code));
    return formatPhoneNumber(match ? phone.slice(match.code.length) : phone);
  });

  function emit(code: string, nat: string) {
    setPhone(nat ? `${code} ${nat}` : "");
  }

  return (
    <div className="phone-field">
      <div className="address-row phone-field-code">
        <select
          className="address-select"
          value={dialCode}
          onChange={(e) => {
            setDialCode(e.target.value);
            emit(e.target.value, national);
          }}
        >
          {DIAL_CODES.map((d) => (
            <option key={d.code} value={d.code}>{d.label}</option>
          ))}
        </select>
        <span className="address-chevron"><ChevronDownIcon /></span>
      </div>
      <input
        className="form-input"
        type="tel"
        inputMode="numeric"
        placeholder="555-000-0000"
        value={national}
        onChange={(e) => {
          const next = formatPhoneNumber(e.target.value);
          setNational(next);
          emit(dialCode, next);
        }}
      />
    </div>
  );
}

function StepAdminAccount({
  contactName, setContactName,
  email, setEmail,
  phone, setPhone,
}: {
  contactName: string; setContactName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
}) {
  return (
    <>
      <h1 className="wizard-title">Admin account</h1>
      <p className="wizard-desc">
        The primary contact and first Admin account for the company.
      </p>

      <div className="form-group">
        <label className="form-label">Account Holder <span className="req">*</span></label>
        <input
          autoFocus
          className="form-input"
          placeholder="e.g. Jane Smith"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Email <span className="req">*</span></label>
        <input
          className="form-input"
          type="email"
          placeholder="admin@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="form-help">
          Becomes the Stripe billing email and the company's first Admin account.
        </p>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Phone number</label>
        <PhoneField phone={phone} setPhone={setPhone} />
      </div>
    </>
  );
}

/* ─────────────── Step 3 — Plan selection ─────────────── */

function Step2Plan({
  plan, setPlan,
  tier, setTier,
  billingCycle, setBillingCycle,
  currency, setCurrency,
  priceStr, setPriceStr,
  seats, setSeats,
  payment, setPayment,
  baseRate, effectiveRate, monthlyTotal, seatCount, sym,
  savedPrices,
  onCreatePrice,
  trialExpired = false,
  freeAccessEndDate, setFreeAccessEndDate,
  seatsLocked = false,
  hideSummary = false,
}: {
  plan: Plan; setPlan: (v: Plan) => void;
  tier: PaidTier; setTier: (v: PaidTier) => void;
  billingCycle: BillingCycle; setBillingCycle: (v: BillingCycle) => void;
  currency: Currency; setCurrency: (v: Currency) => void;
  priceStr: string; setPriceStr: (v: string) => void;
  seats: string; setSeats: (v: string) => void;
  payment: PaymentCollection; setPayment: (v: PaymentCollection) => void;
  baseRate: number; effectiveRate: number; monthlyTotal: number; seatCount: number; sym: string;
  savedPrices: SavedPrice[];
  onCreatePrice: () => void;
  trialExpired?: boolean;
  freeAccessEndDate: string; setFreeAccessEndDate: (v: string) => void;
  seatsLocked?: boolean;
  hideSummary?: boolean;
}) {
  const isSubscription = plan === "subscription";

  return (
    <>
      <h1 className="wizard-title">Plan selection</h1>
      <p className="wizard-desc">Choose the access plan. Subscription plans require billing configuration.</p>

      <div className="form-group">
        <label className="form-label">Plan <span className="req">*</span></label>
        <div className="radio-card-group">
          <RadioCard
            selected={plan === "subscription"}
            onSelect={() => setPlan("subscription")}
            title="Subscription"
            desc="Paid plan. Choose a tier, billing cycle, and rate. Stripe subscription is created on save."
          />
          <RadioCard
            selected={plan === "free-trial"}
            onSelect={() => setPlan("free-trial")}
            disabled={trialExpired}
            title="Free Trial"
            desc={
              trialExpired
                ? "Unavailable — this company's trial has already expired. Convert to a Subscription or grant Free Access."
                : "No payment method required. Limited access for the configured trial window, then converts to paid."
            }
          />
          <RadioCard
            selected={plan === "complimentary"}
            onSelect={() => setPlan("complimentary")}
            title="Free Access"
            desc="Admin-granted free access. No Stripe subscription is created."
          />
        </div>
      </div>

      {isSubscription && (
        <>
          <div className="form-divider" />

          <div className="form-group">
            <label className="form-label">Tier <span className="req">*</span></label>
            <div className="radio-card-group">
              {(["Essentials", "Growth", "Pro"] as PaidTier[]).map((t) => (
                <RadioCard
                  key={t}
                  selected={tier === t}
                  onSelect={() => setTier(t)}
                  title={t}
                  desc={PAID_TIER_DESC[t]}
                />
              ))}
            </div>
          </div>

          <div className="form-divider" />

          <div className="form-group">
            <label className="form-label">Billing cycle <span className="req">*</span></label>
            <div className="tab-switch">
              {BILLING_CYCLES.map((c) => (
                <button
                  key={c}
                  className={`tab-switch-tab ${billingCycle === c ? "active" : ""}`}
                  onClick={() => setBillingCycle(c)}
                >
                  {c === "Annual" ? "Yearly" : c}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 28 }}>
            <label className="form-label">Per-seat price <span className="req">*</span></label>
            <PerSeatPriceField
              currency={currency}
              setCurrency={setCurrency}
              priceStr={priceStr}
              setPriceStr={setPriceStr}
              savedPrices={savedPrices}
              onCreatePrice={onCreatePrice}
              sym={sym}
              tier={tier}
              billingCycle={billingCycle}
              baseRate={baseRate}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Seats <span className="req">*</span></label>
            <input
              className="form-input"
              style={{ maxWidth: 160 }}
              type="number"
              min={1}
              placeholder="1"
              value={seats}
              disabled={seatsLocked}
              onChange={(e) => setSeats(e.target.value)}
            />
            <p className="form-help">
              {seatsLocked
                ? "Seat count is set when the company is created and can't be changed here."
                : "Every seat is paid, including empty seats. Seats can be reassigned at no charge. Minimum 1 seat."}
            </p>
          </div>

          <div className="form-divider" />

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Payment method <span className="req">*</span></label>
            <div className="radio-card-group">
              <RadioCard
                selected={payment === "Automatic"}
                onSelect={() => setPayment("Automatic")}
                title="Automatic"
                desc="Stripe charges the saved card or ACH on each billing date. A payment link is generated on save."
              />
              <RadioCard
                selected={payment === "Manual"}
                onSelect={() => setPayment("Manual")}
                title="Manual (invoice)"
                desc="Stripe issues an invoice paid within the payment window. For invoice or cheque accounts."
              />
            </div>
          </div>

          {!hideSummary && (
            <div className="co-cost-summary">
              <div className="co-cost-row">
                <span>
                  {sym}{effectiveRate} × {seatCount || 0} seats
                </span>
                <span className="co-cost-total">
                  {sym}{monthlyTotal.toLocaleString()} / month
                </span>
              </div>
              {billingCycle === "Annual" && (
                <div className="co-cost-sub">
                  Billed yearly — {sym}{(monthlyTotal * 12).toLocaleString()} / year
                </div>
              )}
            </div>
          )}
        </>
      )}

      {plan === "free-trial" && (
        <div className="co-plan-note" style={{ marginTop: 8 }}>
          <strong>No payment method required.</strong> The trial runs for the globally configured
          window, then converts to a paid subscription.
        </div>
      )}

      {plan === "complimentary" && (
        <>
          <div className="co-plan-note" style={{ marginTop: 8 }}>
            <strong>Free access granted.</strong> No subscription is created in Stripe. Eligible only
            for companies without an active or paused subscription.
          </div>
          <div className="form-group" style={{ marginTop: 16, marginBottom: 0 }}>
            <label className="form-label">Free Access End Date <span className="req">*</span></label>
            <DateField value={freeAccessEndDate} onChange={setFreeAccessEndDate} />
          </div>
        </>
      )}
    </>
  );
}

/* ─────────────── Per-seat price — combined currency + price dropdown ─────────────── */

const CURRENCY_NAMES: Record<Currency, string> = {
  USD: "US Dollar",
  CAD: "Canadian Dollar",
};

function PerSeatPriceField({
  currency, setCurrency,
  priceStr, setPriceStr,
  savedPrices, onCreatePrice,
  sym, tier, billingCycle, baseRate,
}: {
  currency: Currency;
  setCurrency: (v: Currency) => void;
  priceStr: string;
  setPriceStr: (v: string) => void;
  savedPrices: SavedPrice[];
  onCreatePrice: () => void;
  sym: string;
  tier: PaidTier;
  billingCycle: BillingCycle;
  baseRate: number;
}) {
  const [priceOpen, setPriceOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close both menus on any outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setPriceOpen(false);
        setCurrencyOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const rateOf = (p: SavedPrice) => p.rates[currency] ?? 0;
  const query = priceStr.trim();
  const entered = parseFloat(priceStr);
  const hasEntered = !isNaN(entered) && entered > 0;

  // Saved prices available in the chosen currency, filtered by the typed number.
  const matches = useMemo(() => {
    const pool = savedPrices.filter((p) => rateOf(p) > 0);
    if (!query) return pool;
    return pool.filter((p) => String(rateOf(p)).startsWith(query));
  }, [savedPrices, currency, query]);

  const exact = savedPrices.find((p) => rateOf(p) === entered) ?? null;
  const showCreate = hasEntered && !exact;
  const unitWord = billingCycle === "Annual" ? "yr" : "mo";
  const unitWordLong = billingCycle === "Annual" ? "year" : "month";

  function pick(p: SavedPrice) {
    setPriceStr(String(rateOf(p)));
    setPriceOpen(false);
  }

  return (
    <div className="cw-price" ref={wrapRef}>
      <div className={`cw-price-field${priceOpen || currencyOpen ? " is-open" : ""}${hasEntered && !exact ? " has-error" : ""}`}>
        {/* Currency selector segment */}
        <button
          type="button"
          className="cw-price-cur"
          onClick={() => { setCurrencyOpen((o) => !o); setPriceOpen(false); }}
        >
          <span className="cw-price-cur-code">{currency}</span>
          <span className="cw-price-caret">▾</span>
        </button>

        <span className="cw-price-sym">{sym}</span>

        <input
          className="cw-price-input"
          type="text"
          inputMode="decimal"
          placeholder="Find or add a price…"
          value={priceStr}
          onFocus={() => { setPriceOpen(true); setCurrencyOpen(false); }}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) {
              setPriceStr(v);
              setPriceOpen(true);
            }
          }}
        />

        <span className="cw-price-unit">/ seat / {unitWord}</span>

        <button
          type="button"
          className="cw-price-toggle"
          aria-label="Saved prices"
          onMouseDown={(e) => { e.preventDefault(); setPriceOpen((o) => !o); setCurrencyOpen(false); }}
        >
          ▾
        </button>

        {/* Currency dropdown */}
        {currencyOpen && (
          <div className="cw-price-menu cw-price-menu--cur">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`cw-price-opt${c === currency ? " is-active" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); setCurrency(c); setCurrencyOpen(false); }}
              >
                <span className="cw-price-opt-code">{c}</span>
                <span className="cw-price-opt-name">{CURRENCY_NAMES[c]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Saved-price dropdown */}
        {priceOpen && (
          <div className="cw-price-menu cw-price-menu--list">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                className="cw-price-opt cw-price-opt--saved"
                onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              >
                <span className="cw-price-opt-label">{p.label || `${sym}${rateOf(p)}`}</span>
                <span className="cw-price-opt-rate">{sym}{rateOf(p)}</span>
              </button>
            ))}

            {query && matches.length === 0 && (
              <div className="cw-price-empty">No saved price matches “{query}”.</div>
            )}

            {showCreate && (
              <button
                type="button"
                className="cw-price-create"
                onMouseDown={(e) => { e.preventDefault(); setPriceOpen(false); onCreatePrice(); }}
              >
                <span className="cw-price-create-plus">+</span>
                Create new price · {sym}{entered} {currency}
              </button>
            )}

            <div className="cw-price-foot">Filtered to {currency}.</div>
          </div>
        )}
      </div>

      {/* Saved / custom indicator */}
      {hasEntered && (
        exact ? (
          <div className="cw-price-note cw-price-note--saved">
            <span className="cw-price-note-mark">✓</span>
            <span className="cw-price-note-lead">Saved price:</span>
            <span className="cw-price-note-label">{exact.label || `${sym}${entered}`}</span>
          </div>
        ) : (
          <div className="cw-price-note cw-price-note--error">
            <span className="cw-price-note-mark">!</span>
            <span className="cw-price-note-lead">Custom price — not saved on Stripe:</span>
            <span className="cw-price-note-label">{sym}{entered} / seat / {unitWord}</span>
          </div>
        )
      )}
      {hasEntered && !exact && (
        <p className="cw-price-error">
          This price can't be used to create a subscription until it's saved. Save it as a new price to continue.
        </p>
      )}

      <p className="form-help">
        Default for {tier} {billingCycle === "Annual" ? "Yearly" : "Monthly"} is {sym}{baseRate} / seat / {unitWordLong}.
      </p>
    </div>
  );
}

/* ─────────────── Success screen ─────────────── */

function fakeStripeLink(email: string, name: string): string {
  let h = 0;
  for (let i = 0; i < (email + name).length; i++) h = (h * 31 + (email + name).charCodeAt(i)) >>> 0;
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  let seed = h;
  for (let i = 0; i < 14; i++) { code += chars[seed % chars.length]; seed = (seed * 1664525 + 1013904223) >>> 0; }
  return `https://buy.stripe.com/${code}`;
}

function CompanySummaryRows({
  company, plan, tier,
}: {
  company: Omit<Company, "id">; plan: Plan; tier?: PaidTier;
}) {
  const isSubscription = plan === "subscription";
  const sym = company.currency ? CURRENCY_SYMBOL[company.currency as Currency] : "$";

  const detail = (label: string, value: React.ReactNode) => (
    <div className="success-detail-row" key={label}>
      <span className="success-detail-label">{label}</span>
      <span className="success-detail-value">{value}</span>
    </div>
  );

  return (
    <>
      {detail("Company", company.name)}
      {company.address && detail("Address", company.address)}
      {company.contactName && detail("Account Holder", company.contactName)}
      {detail("Email", company.email)}
      {company.phone && detail("Phone", company.phone)}
      {company.industry && detail("Industry", company.industry)}
      {company.partnership && detail("Partnership", company.partnership)}
      {company.taxStatus && detail("Tax status", company.taxStatus)}
      {company.assignedCsm && detail("Assigned CSM", company.assignedCsm)}
      {company.assignedSalesRep && detail("Assigned Sales Rep", company.assignedSalesRep)}
      <div className="success-divider" />
      {detail("Plan", plan === "free-trial" ? "Free Trial" : plan === "complimentary" ? "Free Access" : "Subscription")}
      {plan === "complimentary" && company.freeAccessEndDate && detail("Free access ends", company.freeAccessEndDate)}
      {isSubscription && tier && detail("Tier", tier)}
      {isSubscription && detail("Billing cycle", company.billingCycle === "Annual" ? "Yearly" : "Monthly")}
      {isSubscription && detail("Currency", company.currency ?? "USD")}
      {isSubscription && detail("Per-seat rate", `${sym}${company.ratePerSeat} / month`)}
      {isSubscription && detail("Seats", String(company.seats))}
      {isSubscription && detail("Payment method", company.payment === "Automatic" ? "Automatic" : "Manual (invoice)")}
      {isSubscription && detail("Est. monthly total", `${sym}${((company.ratePerSeat ?? 0) * company.seats).toLocaleString()}`)}
    </>
  );
}

function StripeLinkBox({ stripeLink }: { stripeLink: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(stripeLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="stripe-link-box">
      <div className="stripe-link-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        Stripe Payment Link
      </div>
      <div className="stripe-link-row">
        <span className="stripe-link-url">{stripeLink}</span>
        <button className="stripe-link-copy" onClick={copy}>
          {copied ? (
            <>
              <CheckBoldIcon />
              Copied
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <p className="stripe-link-note">
        Share this link with the account holder to collect their payment method. The Stripe
        subscription activates once payment is confirmed.
      </p>
    </div>
  );
}

/* Reviewed-but-not-yet-created — shown for brand-new companies (not edits)
 * after the wizard's final step, before anything is actually saved. No
 * payment link here; that only appears once the company is confirmed. */
function ConfirmCompanyScreen({
  company, plan, tier, onBack, onConfirm,
}: {
  company: Omit<Company, "id">; plan: Plan; tier?: PaidTier; onBack: () => void; onConfirm: () => void;
}) {
  return (
    <div className="wizard">
      <div className="wizard-body wizard-body--success">
        <div className="wizard-content wizard-success-content">
          <div className="wizard-success-icon wizard-success-icon--review">
            <CheckBoldIcon />
          </div>
          <h1 className="wizard-title">Confirm details</h1>
          <p className="wizard-desc">
            Review the details below before creating <strong>{company.name}</strong>.
          </p>

          <div className="success-summary">
            <CompanySummaryRows company={company} plan={plan} tier={tier} />
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onBack}>Back</button>
        </div>
        <div className="wizard-actions">
          <button className="btn-publish" onClick={onConfirm}>Confirm & create</button>
        </div>
      </footer>
    </div>
  );
}

/* Shown right after a brand-new automatically-billed subscription is created —
 * just the company name and the Stripe link to send the account holder. The
 * full detail summary was already reviewed on the confirmation screen. */
function PaymentLinkScreen({
  company, onClose,
}: {
  company: Omit<Company, "id">; onClose: () => void;
}) {
  const stripeLink = fakeStripeLink(company.email, company.name);

  return (
    <div className="wizard">
      <div className="wizard-body wizard-body--success">
        <div className="wizard-content wizard-success-content">
          <div className="wizard-success-icon">
            <CheckBoldIcon />
          </div>
          <h1 className="wizard-title">Company created</h1>
          <p className="wizard-desc">
            <strong>{company.name}</strong> has been added.
          </p>

          <StripeLinkBox stripeLink={stripeLink} />
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left" />
        <div className="wizard-actions">
          <button className="btn-publish" onClick={onClose}>Done</button>
        </div>
      </footer>
    </div>
  );
}

function SuccessScreen({
  company, plan, tier, isEdit = false, onClose,
}: {
  company: Omit<Company, "id">; plan: Plan; tier?: PaidTier; isEdit?: boolean; onClose: () => void;
}) {
  return (
    <div className="wizard">
      <div className="wizard-body wizard-body--success">
        <div className="wizard-content wizard-success-content">
          <div className="wizard-success-icon">
            <CheckBoldIcon />
          </div>
          <h1 className="wizard-title">{isEdit ? "Company updated" : "Company created"}</h1>
          <p className="wizard-desc">
            <strong>{company.name}</strong> has been {isEdit ? "updated" : "added"}. Here's a summary of what was set up.
          </p>

          <div className="success-summary">
            <CompanySummaryRows company={company} plan={plan} tier={tier} />
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left" />
        <div className="wizard-actions">
          <button className="btn-publish" onClick={onClose}>Done</button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────── Create Price modal ─────────────── */

function CreatePriceModal({
  initialCurrency,
  initialRate,
  onClose,
  onCreate,
}: {
  initialCurrency: Currency;
  initialRate: string;
  onClose: () => void;
  onCreate: (p: SavedPrice) => void;
}) {
  const [label, setLabel] = useState("");
  // The first row is the currency the admin is working in (selected in the
  // wizard) and is prefilled with the typed rate. CAD is always shown too; other
  // currencies can be added below.
  const otherBase = initialCurrency === "USD" ? "CAD" : "USD";
  const [rows, setRows] = useState<{ code: string; amount: string }[]>([
    { code: initialCurrency, amount: initialRate },
    { code: otherBase, amount: "" },
  ]);
  const [addOpen, setAddOpen] = useState(false);

  const usedCodes = rows.map((r) => r.code);
  const available = PRICE_CURRENCIES.filter((c) => !usedCodes.includes(c.code));
  // The first row feeds the wizard, so it must carry a positive rate.
  const valid = parseFloat(rows[0]?.amount) > 0;

  function setAmount(i: number, v: string) {
    if (v !== "" && !/^\d*\.?\d{0,2}$/.test(v)) return;
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, amount: v } : r)));
  }
  function addCurrency(code: string) {
    setRows((prev) => [...prev, { code, amount: "" }]);
    setAddOpen(false);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (!valid) return;
    const rates: Record<string, number> = {};
    rows.forEach((r) => {
      const n = parseFloat(r.amount);
      if (n > 0) rates[r.code] = n;
    });
    onCreate({ id: `custom-${Date.now()}`, label: label.trim(), rates });
  }

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Create new price</h3>
          <p className="cl-modal-sub">
            Set the per-seat rate per currency. This price becomes available to select for any future company.
          </p>
        </div>

        <div style={{ padding: "0 24px 8px" }}>
          <div className="form-group">
            <label className="form-label">Price name <span className="co-w-note">(optional)</span></label>
            <input
              autoFocus
              className="form-input"
              placeholder="e.g. Growth Annual — Partner"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="form-help">Internal-facing label for the saved-price list — never shown to the customer.</p>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Rate per seat / month</label>
            <div className="cp-rate-rows">
              {rows.map((row, i) => {
                const c = PRICE_CURRENCIES.find((x) => x.code === row.code);
                const isFirst = i === 0;
                const removable = i > 1; // USD/CAD base rows stay; added rows can be removed
                return (
                  <div className={`cp-rate-row${isFirst ? " is-primary" : ""}`} key={row.code}>
                    <div className="cp-rate-cur">
                      <span className="cp-rate-code">{row.code}</span>
                      <span className="cp-rate-name">{c?.name}</span>
                      {isFirst && <span className="cp-rate-tag">Wizard</span>}
                    </div>
                    <div className="price-input cp-rate-input">
                      <span className="price-input-prefix">{c?.symbol ?? row.code}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.amount}
                        placeholder="0.00"
                        onChange={(e) => setAmount(i, e.target.value)}
                      />
                    </div>
                    {removable ? (
                      <button className="cp-rate-remove" aria-label={`Remove ${row.code}`} onClick={() => removeRow(i)}>
                        <SmallXIcon />
                      </button>
                    ) : (
                      <span className="cp-rate-remove-spacer" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="cp-add-wrap">
              <button
                className="cp-add-btn"
                disabled={available.length === 0}
                onClick={() => setAddOpen((o) => !o)}
              >
                + Add currency
              </button>
              {addOpen && available.length > 0 && (
                <div className="cp-add-menu">
                  {available.map((c) => (
                    <button key={c.code} className="cp-add-opt" onClick={() => addCurrency(c.code)}>
                      <span className="cp-rate-code">{c.code}</span>
                      <span className="cp-rate-name">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="form-help">
              The first row is the currency selected in the wizard. Leave a currency blank if you don't bill in it.
            </p>
          </div>
        </div>

        <div className="cl-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>Cancel</button>
          <button className="btn-publish" disabled={!valid} onClick={submit}>Create price</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Multi-select ─────────────── */

/* Figma 147:1147 keeps the field one row tall: two pills, then a "+N" counter
   for the rest. */
const PILL_LIMIT = 2;

export function MultiSelect({
  options, value, onChange, placeholder, searchPlaceholder,
}: {
  options: string[]; value: string[]; onChange: (v: string[]) => void;
  placeholder: string;
  /** Search box label, e.g. "Search Industries…" (Figma 591:1322). */
  searchPlaceholder: string;
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  // The panel is portalled, so it can't inherit the field's width — it is
  // measured and passed through instead.
  const [fieldWidth, setFieldWidth] = useState(0);

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => setFieldWidth(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }

  return (
    <div className="multiselect">
      <Dropdown
        overlay
        constrainHeight
        width={fieldWidth || 300}
        panelClass="ms-menu"
        onOpenChange={(o) => { if (!o) setQuery(""); }}
        trigger={({ open, toggle: toggleOpen }) => (
          <div
            ref={fieldRef}
            className={`multiselect-field${open ? " is-open" : ""}`}
            onClick={toggleOpen}
          >
            {value.length === 0 ? (
              <span className="multiselect-placeholder">{placeholder}</span>
            ) : (
              <div className="multiselect-tags">
                {value.slice(0, PILL_LIMIT).map((v) => (
                  <span key={v} className="multiselect-tag">
                    {v}
                    <button
                      className="multiselect-tag-remove"
                      onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }}
                      aria-label={`Remove ${v}`}
                    >
                      <SmallXIcon />
                    </button>
                  </span>
                ))}
                {value.length > PILL_LIMIT && (
                  <span className="multiselect-tag multiselect-tag-more">
                    +{value.length - PILL_LIMIT}
                  </span>
                )}
              </div>
            )}
            <span className="field-chevron"><ChevronDownIcon /></span>
          </div>
        )}
      >
        {() => (
          <MultiSelectMenu
            options={filtered}
            value={value}
            toggle={toggle}
            searchPlaceholder={searchPlaceholder}
            query={query}
            setQuery={setQuery}
          />
        )}
      </Dropdown>
    </div>
  );
}

/* The panel body. It focuses its own search box rather than relying on
   `autoFocus`: the overlay Dropdown's first paint is the hidden one it measures,
   and focusing a hidden element does nothing. */
function MultiSelectMenu({
  options, value, toggle, searchPlaceholder, query, setQuery,
}: {
  options: string[]; value: string[]; toggle: (opt: string) => void;
  searchPlaceholder: string; query: string; setQuery: (v: string) => void;
}) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <div className="dropdown-search">
        <span className="dropdown-search-icon">
          <SearchIcon />
        </span>
        <input
          ref={searchRef}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="dropdown-list">
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <button
              key={opt}
              className="dropdown-item"
              // Ticking an option must not pull focus out of the search — it
              // stays live so the user can keep typing and filtering.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                toggle(opt);
                searchRef.current?.focus();
              }}
            >
              <span className={`checkbox ${selected ? "checked" : ""}`}>
                {selected && <CheckIcon />}
              </span>
              <span className="ms-menu-label">{opt}</span>
            </button>
          );
        })}
        {options.length === 0 && <div className="ms-menu-empty">No matches</div>}
      </div>
    </>
  );
}

/* ─────────────── Shared sub-components ─────────────── */

function RadioCard({
  selected, onSelect, title, desc, disabled = false,
}: {
  selected: boolean; onSelect: () => void; title: React.ReactNode; desc?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`radio-card ${selected ? "selected" : ""}${disabled ? " is-disabled" : ""}`}
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-disabled={disabled}
    >
      <span className="radio-dot" />
      <div className="radio-card-text">
        <div className="radio-card-title">{title}</div>
        {desc && <div className="radio-card-desc">{desc}</div>}
      </div>
    </button>
  );
}
