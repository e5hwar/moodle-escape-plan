import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BILLING_CYCLES,
  currencySymbol,
  CURRENCY_SYMBOL,
  DEFAULT_RATES,
  TAX_STATUSES,
  TIERS,
  CSM_OPTIONS,

  getAssignedCsm,

  getAssignedSalesRep,
  SALES_REP_OPTIONS,
  defaultRate,
  getCompanyBilling,
  monthlyRate,
  stripePaymentLink,
  todayStamp,
  type BillingCycle,
  type CompanyBilling,
  type Company,
  type Currency,
  type PaymentCollection,
  type TaxStatus,
  type Tier,
} from "../data/companies";
import {
  COUNTRIES,
  DEFAULT_PHONE_COUNTRY,
  dialCodeFor,
  dialLabelFor,
  findPhoneCountry,
} from "../data/countries";
import { lookupZip } from "../data/zipcodes";
import { CheckIcon, CheckBoldIcon, CopyIcon, DropdownCaretIcon, ArrowUpRightIcon, TreeAddIcon, RemoveRowIcon } from "./icons";
import { ConfirmCard } from "./ConfirmCard";
import { MultiSelectTags } from "./MultiSelectTags";
import { DropdownSearch } from "./SearchPanelParts";
import { Stepper } from "./Stepper";
import { Dropdown } from "./Dropdown";
import { SelectField } from "./SelectField";
import { WizardStepRail, useWizardStepStatuses } from "./WizardStepRail";
import { useEdgeLineGate, WizardGateEdges } from "./wizardGate";
import { DateField } from "./DateField";
import { PrmModal } from "./PrmModal";
import { CopiedToast } from "./CopiedToast";
import { CURRENCY_INFO, currencyOptionFor, codeFromCurrencyOption } from "../data/currencies";

/* ─────────────── Constants ─────────────── */

// Address dropdown options (Figma 668:943 — searchable Country & State selects).
export const COUNTRY_OPTIONS = COUNTRIES;
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
/** Kept as an alias so the billing-diff types read as "a plan you pay for";
 *  every Tier is one now that Free Trial / Free Access are statuses. */
type PaidTier = Tier;

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

/* The assignable-owner lists moved to ../data/companies so the Companies
 * table's Assigned CSM / Assigned Sales Rep columns can seed from them too;
 * re-exported here because this is where the rest of the app imports them. */
export { CSM_OPTIONS, SALES_REP_OPTIONS };
/** The sales rep filling out the form — used as the default for new companies.
 *  Named rather than indexed, so re-ordering the picker can't move the default. */
export const CURRENT_SALES_REP = "Brendan Arsenault";

// A saved price holds a per-seat rate for one or more currencies, keyed by
// currency code (USD/CAD are always billed; others can be defined for future use).
/* `label` is the price's description on Stripe — not every price carries one,
   and the menu row simply drops its right-hand column when it is missing. */
/** `cycle` is set only on prices created through the modal, which captures one.
 *  The seeded defaults carry their cycle in the label instead, so anything
 *  reading it has to tolerate its absence. */
type SavedPrice = {
  id: string;
  label?: string;
  rates: Record<string, number>;
  cycle?: BillingCycle;
};

function r2(usd: number, cad: number): Record<string, number> {
  return { USD: usd, CAD: cad };
}

function buildDefaultSavedPrices(): SavedPrice[] {
  return [
    { id: "ess-mo",       label: "Essentials — Monthly (default)",          rates: r2(defaultRate("Essentials", "Monthly", "USD"), defaultRate("Essentials", "Monthly", "CAD")) },
    { id: "ess-an",       label: "Essentials — Annual (default)",            rates: r2(defaultRate("Essentials", "Annual",  "USD"), defaultRate("Essentials", "Annual",  "CAD")) },
    { id: "gro-mo",       label: "Growth — Monthly (default)",               rates: r2(defaultRate("Growth",     "Monthly", "USD"), defaultRate("Growth",     "Monthly", "CAD")) },
    { id: "gro-an",       label: "Growth — Annual (default)",                rates: r2(defaultRate("Growth",     "Annual",  "USD"), defaultRate("Growth",     "Annual",  "CAD")) },
    { id: "pro-mo",       label: "Professional — Monthly (default)",                  rates: r2(defaultRate("Professional",        "Monthly", "USD"), defaultRate("Professional",        "Monthly", "CAD")) },
    { id: "pro-an",       label: "Professional — Annual (default)",                   rates: r2(defaultRate("Professional",        "Annual",  "USD"), defaultRate("Professional",        "Annual",  "CAD")) },
    // Custom / partner prices. Annual ones are yearly amounts, like the
    // defaults above — a discount off ten months, not off a monthly rate.
    { id: "part-ess-mo",  label: "Essentials — Monthly (Preferred Partner)", rates: r2(27,  36)  },
    { id: "part-ess-an",  label: "Essentials — Annual (Preferred Partner)",  rates: r2(270, 360) },
    { id: "part-gro-mo",  label: "Growth — Monthly (Preferred Partner)",     rates: r2(36,  48)  },
    { id: "part-gro-an",  label: "Growth — Annual (Preferred Partner)",      rates: r2(360, 480) },
    { id: "ngo-ess-mo",   label: "Essentials — Monthly (NGO Rate)",          rates: r2(22,  29)  },
    { id: "ngo-gro-mo",   label: "Growth — Monthly (NGO Rate)",              rates: r2(30,  40)  },
    { id: "elite-pro-mo", label: "Professional — Monthly (Elite Partner)",  rates: r2(45,  60)  },
    { id: "elite-pro-an", label: "Professional — Annual (Elite Partner)",   rates: r2(450, 600) },
    // A Stripe price carries no nickname unless someone typed one, so a real
    // list has unnamed rows in it. They read as the amount alone.
    { id: "px-1J4nQ2",                                                       rates: r2(34,  45)  },
    { id: "px-8KdW7f",                                                       rates: r2(380, 505) },
    { id: "px-3RmT9c",                                                       rates: r2(58,  77)  },
  ];
}

// Currencies offerable in the Create-price dialog. USD/CAD are the billed
// currencies; the rest can be captured for other markets.

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
  // Renders only the Company-details step as a single page (no step rail).
  // Used by the "Edit Company" action on the Companies list: saving patches the
  // identity & segmentation fields only — plan, billing, and the admin account
  // are untouched.
  detailsOnly?: boolean;
  // Navigates to the B2B tab within Product Config, used by the Industry and
  // Partnership subtext links on the Company details step.
  onNavigateToProductConfig?: () => void;
};

/* Which plan step a company opens on. Tier only says WHICH plan it is on, so
 * whether that plan is being trialed, granted or paid for comes from status. */
function planFor(c: Company): Plan {
  const status = getCompanyBilling(c).status;
  if (status === "Free Trial" || status === "Trial Expired") return "free-trial";
  if (status === "Free Access" || status === "Free Access Ended") return "complimentary";
  return "subscription";
}

export function NewCompanyWizard({ onClose, onCreate, editCompany, onSave, subscriptionOnly = false, detailsOnly = false, onNavigateToProductConfig }: Props) {
  const isEdit = !!editCompany;
  // Billing defaults are derived for seed companies that have no explicit values,
  // so the edit form starts populated either way.
  const editBilling = editCompany ? getCompanyBilling(editCompany) : null;

  // A company whose free trial has expired cannot be put back onto a trial — it
  // can only convert to a paid Subscription or be granted Free Access.
  const trialExpired = isEdit && editBilling?.status === "Trial Expired";
  // Neither can one that is already on a Subscription or Complimentary Free Access:
  // the trial is a pre-sale state, and nothing here walks an account back into
  // it. (Creation is unaffected — there is no company to be on a plan yet.)
  const trialLocked = isEdit && !!editCompany && planFor(editCompany) !== "free-trial";
  // Free Access can't be granted over a subscription that is still running —
  // it has to be cancelled first. A cancellation scheduled for cycle end still
  // counts as running; one that has taken effect does not.
  // A company that invoices manually moves itself onto automatic collection —
  // it has to enter a payment method, which happens in its own dashboard, not
  // here. Admins can still push the other way.
  const automaticLocked =
    isEdit && !!editCompany && !!editBilling &&
    planFor(editCompany) === "subscription" &&
    editBilling.payment === "Invoice";
  const complimentaryLocked =
    isEdit && !!editBilling &&
    (editBilling.status === "Active" ||
      editBilling.status === "Past Due" ||
      (editBilling.status === "Canceled" && editBilling.cancelScheduled));

  // When editing a company that already has a running paid subscription, the
  // billing-impact rail becomes a change preview (diff + proration) instead of
  // the new-company "what happens on save" summary.
  const currentSub: CurrentSub | null =
    isEdit && editCompany && editBilling &&
    (editBilling.status === "Active" || editBilling.status === "Past Due") &&
    !!editCompany.tier && TIERS.includes(editCompany.tier)
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
  /* Editing shows the owners the Companies table shows, which for a record
     created before these fields existed is the derived one — reading the
     record raw made the form say "Unassigned" for an account the table
     credited to someone, and saving would then have silently cleared it.
     Both stay genuinely optional: the helpers return "" for an unassigned
     account, and the pickers open on their Unassigned option. */
  const [assignedCsm, setAssignedCsm] = useState(
    editCompany ? getAssignedCsm(editCompany) : "",
  );
  const [assignedSalesRep, setAssignedSalesRep] = useState(
    editCompany ? getAssignedSalesRep(editCompany) : CURRENT_SALES_REP,
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
  // Both fields are multi-select in the form AND multi-value on the record, so
  // they round-trip as lists — no comma-joining on the way in or out.
  const [industries, setIndustries] = useState<string[]>(editCompany?.industry ?? []);
  const [partnerships, setPartnerships] = useState<string[]>(editCompany?.partnership ?? []);

  // Step 2
  const [plan, setPlan] = useState<Plan>(
    editCompany ? planFor(editCompany) : "subscription",
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
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

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
  const sym = currencySymbol(currency);
  // Only USD and CAD have published rates. In any other currency there is no
  // default to fall back on — the price has to come from a saved price, so the
  // field starts empty rather than being seeded with the USD number.
  const isPricedCurrency = currency in DEFAULT_RATES.Growth.Monthly;
  const baseRate = isSubscription && isPricedCurrency ? defaultRate(tier, billingCycle, currency) : 0;
  // The subtext always quotes a published default. For a currency with none,
  // that is the USD one — `defaultRate` already falls back to it — so the note
  // carries the USD symbol rather than the selected currency's.
  const noteRate = isSubscription ? defaultRate(tier, billingCycle, currency) : 0;
  const noteSym = isPricedCurrency ? sym : currencySymbol("USD");
  const seatCount = parseInt(seats, 10) || 0;
  const effectiveRate = parseFloat(priceStr) || baseRate;
  // In the unit the cycle bills in: a yearly rate x seats is a yearly total.
  const planTotal = isSubscription ? effectiveRate * seatCount : 0;

  // Every plan-relevant value in one comparable key. The first render's copy is
  // kept for the life of the wizard, so "dirty" means "differs from what was
  // loaded" — putting a field back to its original value un-dirties the form.
  // Only the fields the CHOSEN plan actually uses. A tier or rate the form is
  // still holding from a subscription the admin looked at and moved away from
  // is not a change to a Free Access grant, and counting it would leave the
  // form dirty after the admin had put everything back.
  const planStateKey = JSON.stringify(
    plan === "subscription"
      ? { plan, tier, billingCycle, currency, rate: effectiveRate, seats: seatCount, payment }
      : plan === "complimentary"
      ? { plan, freeAccessEndDate: freeAccessEndDate.trim() }
      : { plan },
  );
  /* The Company-details equivalent of planStateKey — every field
     handleSaveDetails writes, so putting a value back un-dirties the form. */
  const detailsStateKey = JSON.stringify({
    name: name.trim(),
    taxStatus,
    assignedCsm,
    assignedSalesRep,
    industries,
    partnerships,
    country: country.trim(),
    line1: addrLine1.trim(),
    line2: addrLine2.trim(),
    city: addrCity.trim(),
    pin: addrPin.trim(),
    state: addrState.trim(),
  });
  const initialDetailsRef = useRef<string | null>(null);
  if (initialDetailsRef.current === null) initialDetailsRef.current = detailsStateKey;
  const detailsDirty = detailsStateKey !== initialDetailsRef.current;

  const initialPlanStateRef = useRef<string | null>(null);
  if (initialPlanStateRef.current === null) initialPlanStateRef.current = planStateKey;
  const planDirty = planStateKey !== initialPlanStateRef.current;
  const currentPlan = editCompany && editBilling ? currentPlanRows(editCompany, editBilling) : null;
  // Seats are fixed for an account that is already on a paid subscription —
  // they move through the seat-management flow, not this form. An account
  // arriving on Free Access or an expired trial has no billed seat count yet,
  // so converting it to a Subscription has to set one here.
  const seatsLocked = isEdit && !!editCompany && planFor(editCompany) === "subscription";
  const currentPlanKind: Plan | null = editCompany ? planFor(editCompany) : null;
  const currentAccessEnd =
    currentPlanKind === "complimentary" && editCompany ? editCompany.freeAccessEndDate ?? "" : null;

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
    // An unpriced currency clears the field instead: seeding it with a rate the
    // catalogue can't match would flag the field red the moment the currency
    // changed, for a number the user never typed.
    if (isSubscription) setPriceStr(isPricedCurrency ? String(baseRate) : "");
  }, [tier, billingCycle, currency, plan]);

  // Per-step validation gates the full wizard; in subscription-only mode these
  // fields aren't shown, so identity is taken as already-valid. Each list is
  // ordered top-to-bottom to match the form layout, so the CTA tooltip always
  // surfaces the first thing the admin needs to fix as they scan down the page.
  const step0Checks: { valid: boolean; message: string }[] = subscriptionOnly ? [] : [
    { valid: name.trim().length > 0, message: "Add a company name to continue." },
    { valid: addrPin.trim().length > 0, message: "Add a Zipcode to continue." },
    // Only when this step IS the save — in the full wizard it is a way-point,
    // and an untouched details step is a perfectly good one to walk past.
    ...(detailsOnly && isEdit
      ? [{ valid: detailsDirty, message: "Change something to save." }]
      : []),
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
    // Editing saves a CHANGE. With the form still exactly as it was loaded
    // there is nothing to write, so the CTA stays disabled and says why.
    ...(isEdit ? [{ valid: planDirty, message: "Change something to save." }] : []),
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

  /** Mandatory fields still empty on each step — feeds the rail's error glyph. */
  const stepChecks = [step0Checks, step1Checks, step2Checks];
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
  // Editing always saves changes, whatever the change turns out to be — the
  // preview states what will happen, so the button doesn't have to.
  const saveCta = isEdit
    ? "Save Changes"
    // Creating doesn't save from here — it hands off to the confirmation screen,
    // where "Create company" is the button that actually commits.
    : "Review Details";
  const previewModel = buildPreviewModel({
    change, planTypeChange, currentSub,
    plan, tier, billingCycle, payment, effectiveRate, seatCount, planTotal, sym,
    freeAccessEndDate, isEdit, planDirty, currentPlan, currentAccessEnd, currentPlanKind,
  });
  // What happens on save, in one line under the modal's title.
  const saveEffect = change?.anyChange
    ? change.chargeReason
    : plan === "complimentary"
    ? "Free access continues until the end date above. Nothing is charged."
    : planTypeChange
    ? "The change is scheduled for the end of the current billing cycle."
    : "The new plan takes effect today.";

  const STEPS: { id: string; label: string; sub: string; desc: string }[] = [
    {
      id: "details",
      label: "Company Details",
      sub: "Identity & segmentation",
      desc: "Identify the company. Industry and partnership are used for segmentation and reporting.",
    },
    {
      id: "admin",
      label: "Admin Account",
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
  // Wheel-past-the-edge step navigation, shared with every other wizard.
  const lastStep = STEPS.length - 1;
  const gate = useEdgeLineGate({
    step,
    setStep,
    lastStep,
    // detailsOnly / subscriptionOnly lock the wizard to a single step.
    enabled: !detailsOnly && !subscriptionOnly,
    // No canGoNext guard. The wheel walks the steps freely, the way it does in
    // every other wizard — refusing to scroll off an incomplete step read as
    // the gesture being broken here. A step left with a mandatory field still
    // empty is reported by the rail instead (stepStatuses below).
  });

  // Rail glyphs: a step passed (or skipped from the rail) with a mandatory
  // field still empty shows the red alert circle instead of a check.
  const stepStatuses = useWizardStepStatuses({
    step,
    count: STEPS.length,
    incomplete: (i) => (stepChecks[i] ?? []).some((c) => !c.valid),
  });

  // Details-only edit: patch the identity & segmentation fields onto the
  // existing company, leaving plan, billing, status, and the admin account
  // untouched — those live under Manage Subscription / Account Holder.
  function handleSaveDetails() {
    if (!editCompany) return;
    onSave?.({
      ...editCompany,
      name: name.trim(),
      taxStatus,
      assignedCsm: assignedCsm || undefined,
      assignedSalesRep: assignedSalesRep || undefined,
      industry: industries,
      partnership: partnerships,
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
    });
    onClose();
  }

  function handleCreate() {
    const company: Omit<Company, "id"> = {
      name: name.trim(),
      email: email.trim(),
      // Only a paying subscription is on a plan; a trial or a complimentary
      // grant carries no tier at all, and says so through `status` below.
      tier: plan === "subscription" ? tier : undefined,
      seats: seatCount,
      industry: industries,
      partnership: partnerships,
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
        : isEdit && editBilling?.status === "Pending Payment Setup"
        ? "Pending Payment Setup"
        : !isEdit && isSubscription && payment === "Automatic"
        ? "Pending Payment Setup"
        : "Active",
      // Stamp the real creation date on a new company so its Created On and
      // Last Access columns report the day it was made rather than a date
      // derived from its id.
      ...(isEdit ? {} : { createdAt: todayStamp() }),
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

  // Whether the Stripe link was put on the clipboard automatically when the
  // company was created — the payment-link screen then opens with the Copy
  // button already reading "Copied".
  const [linkAutoCopied, setLinkAutoCopied] = useState(false);

  function handleConfirmCreate() {
    if (!pendingCompany) return;
    // An automatically-billed subscription hands the admin a Stripe payment
    // link. Copy it right here, inside the click handler: browsers only honour
    // clipboard writes while a user gesture is still active, so doing it after
    // the screen mounts would be refused.
    if (!isEdit && isSubscription && pendingCompany.payment === "Automatic") {
      const link = stripePaymentLink(pendingCompany.email, pendingCompany.name);
      setLinkAutoCopied(false);
      navigator.clipboard?.writeText(link)
        .then(() => setLinkAutoCopied(true))
        .catch(() => { /* blocked — the Copy button still works by hand */ });
    }
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
      <PaymentLinkScreen company={createdCompany} autoCopied={linkAutoCopied} onClose={onClose} />
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
        onEditStep={(s) => { setPendingCompany(null); gate.goStep(s); }}
      />
    );
  }

  return (
    <div className={`wizard company-wizard${subscriptionOnly ? " company-wizard--sub" : ""}`}>
      <div className="wizard-body">
        {!subscriptionOnly && !detailsOnly && (
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
              const status = stepStatuses[i];
              return (
                <li
                  key={s.id}
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
        )}

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
                  noteRate={noteRate} noteSym={noteSym} effectiveRate={effectiveRate}
                  planTotal={planTotal} seatCount={seatCount} sym={sym}
                  savedPrices={savedPrices}
                  onCreatePrice={() => setShowNewPriceModal(true)}
                  trialExpired={trialExpired}
                  trialLocked={trialLocked}
                  complimentaryLocked={complimentaryLocked}
                  automaticLocked={automaticLocked}
                  freeAccessEndDate={freeAccessEndDate} setFreeAccessEndDate={setFreeAccessEndDate}
                  seatsLocked={seatsLocked}
                  manageMode={subscriptionOnly}
                  hideSummary
                />
              )}
              </div>
            </div>
          </div>
        </div>

        {step === 2 && <BillingImpactRail model={previewModel} />}
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          {step > 0 && !subscriptionOnly && (
            <button className="btn-save-draft wizard-gate-btn" onClick={() => gate.goStep(step - 1)}>
              <span className="wizard-gate-fill" ref={gate.backFillRef} />
              <span className="wizard-gate-btn-inner">Back</span>
            </button>
          )}
          {step === 0 ? (
            <button
              className={`btn-publish${detailsOnly ? "" : " wizard-gate-btn"}${ctaTooltip ? " has-cta-tooltip" : ""}`}
              disabled={!companyValid}
              data-tooltip={ctaTooltip}
              onClick={detailsOnly ? handleSaveDetails : () => gate.goStep(1)}
            >
              {!detailsOnly && <span className="wizard-gate-fill" ref={gate.nextFillRef} />}
              <span className="wizard-gate-btn-inner">{detailsOnly ? "Save Changes" : "Continue"}</span>
            </button>
          ) : step === 1 ? (
            <button
              className={`btn-publish wizard-gate-btn${ctaTooltip ? " has-cta-tooltip" : ""}`}
              disabled={!adminValid}
              data-tooltip={ctaTooltip}
              onClick={() => gate.goStep(2)}
            >
              <span className="wizard-gate-fill" ref={gate.nextFillRef} />
              <span className="wizard-gate-btn-inner">Continue</span>
            </button>
          ) : (
            <button
              className={`btn-publish${ctaTooltip ? " has-cta-tooltip" : ""}`}
              disabled={!canSave}
              data-tooltip={ctaTooltip}
              onClick={isEdit ? () => setShowSaveConfirm(true) : handleCreate}
            >
              {saveCta}
            </button>
          )}
        </div>
      </footer>

      {showSaveConfirm && (
        <SaveChangesModal
          model={previewModel}
          effect={saveEffect}
          onCancel={() => setShowSaveConfirm(false)}
          onConfirm={() => {
            setShowSaveConfirm(false);
            handleCreate();
          }}
        />
      )}

      {showNewPriceModal && (
        <CreatePriceModal
          initialCycle={billingCycle}
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

const TIER_ORDER: Record<PaidTier, number> = { Essentials: 0, Growth: 1, Professional: 2 };
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
function cycleWord(c: BillingCycle): string { return c === "Annual" ? "Annual" : "Monthly"; }
function payLabel(p: PaymentCollection): string { return p === "Automatic" ? "Automatic" : "Invoice"; }
// Per-cycle invoiced total. Rates are cycle-native (a yearly rate is already a
// year's price, see DEFAULT_RATES), so `total` is what the cycle invoices.
function totalDisplay(total: number, cycle: BillingCycle, sym: string): string {
  return `${money(total, sym)}/${shortCycle(cycle)}`;
}
// Per-seat price in the unit its own cycle bills in — Figma 616:1156 reads
// "$40.00/mo → $400.00/yr", so each side of a cycle switch carries its own unit
// rather than both being quoted monthly.
function perSeatDisplay(rate: number, cycle: BillingCycle, sym: string): string {
  return `${money(rate, sym)}/${shortCycle(cycle)}`;
}

// Full month names for the billing-impact timeline date labels (Figma 107:1236
// shows e.g. "JULY 1, 2026"). nextBillingDate is stored as "<Mon> 1" with no
// year, so years are derived relative to APP_TODAY.
const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function parseAccessEnd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
/** "Aug 15, 2026" — the short form the date field and the tables print. */
function fmtAccessDate(iso: string): string {
  const d = parseAccessEnd(iso);
  return d ? `${FULL_MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}` : "—";
}
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
// A currency with no published conversion is compared at par with USD — the
// rate was entered by hand, so there is nothing better to convert it by.
function usdValue(c: Currency): number { return USD_VALUE[c] ?? 1; }
function toUSD(amount: number, c: Currency): number { return amount * usdValue(c); }

type Target = {
  tier: PaidTier;
  cycle: BillingCycle;
  rate: number;
  seats: number;
  payment: PaymentCollection;
  currency: Currency;
};

/** `oldStr` is absent on a row that states a value rather than a change (Seats,
 *  which is locked while editing). */
type ChangeRow = { label: string; oldStr?: string; newStr: string };
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
  const oldSym = currencySymbol(cur.currency);
  const newSym = currencySymbol(tgt.currency);
  const oldTotal = cur.rate * cur.seats;
  const newTotal = tgt.rate * tgt.seats;
  // Cycle-native totals can't be compared across a cycle switch ($400/yr is not
  // ten times "bigger" than $40/mo), so every economic test below — direction,
  // proration, the recurring delta — runs on the monthly equivalent.
  const oldMonthly = monthlyRate(cur.rate, cur.cycle) * cur.seats;
  const newMonthly = monthlyRate(tgt.rate, tgt.cycle) * tgt.seats;
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
  const oldTotalUSD = toUSD(oldMonthly, cur.currency);
  const newTotalUSD = toUSD(newMonthly, tgt.currency);
  const totalEps = Math.max(1, oldTotalUSD * 0.01);
  const econDown = oldTotalUSD - newTotalUSD > totalEps;
  // Old recurring total expressed in the target currency, for the proration delta.
  const oldTotalInTgt = oldMonthly * (usdValue(cur.currency) / usdValue(tgt.currency));
  // Per-seat economic comparison (drives the price-increase / decrease label).
  const oldRateUSD = toUSD(monthlyRate(cur.rate, cur.cycle), cur.currency);
  const newRateUSD = toUSD(monthlyRate(tgt.rate, tgt.cycle), tgt.currency);
  const rateEconChanged = Math.abs(newRateUSD - oldRateUSD) > Math.max(0.5, oldRateUSD * 0.01);

  // ── Label ──
  const parts: string[] = [];
  if (cycleChanged) parts.push(toAnnual ? "Monthly → Annual" : "Annual → Monthly");
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
    chargeNow = Math.max(0, newMonthly - oldTotalInTgt) * frac;
    if (chargeNow > 0.005) {
      chargeReason = `+${money(newMonthly - oldTotalInTgt, newSym)} / mo · prorated for the ${daysLeft} of ${cycleDays} days left in this cycle.`;
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

  // The card carries the SAME fields as the untouched summary, in the order the
  // form on the left puts them: a row the edit did not touch states its value,
  // and only the ones that moved read old -> new. Dropping untouched rows made
  // the card change shape with every edit and took away the context the changed
  // numbers are read against.
  const diff = (label: string, changed: boolean, oldStr: string, newStr: string): ChangeRow =>
    changed ? { label, oldStr, newStr } : { label, newStr };
  const rows: ChangeRow[] = [
    { label: "Plan", newStr: "Subscription" },
    diff("Tier", dir !== 0, cur.tier, tgt.tier),
    diff("Cycle", cycleChanged, cycleWord(cur.cycle), cycleWord(tgt.cycle)),
    // A cycle switch re-denominates the per-seat price even when the rate
    // itself holds, so that counts as a change to this row too.
    diff(
      "Per Seat",
      rateChanged || currencyChanged || cycleChanged,
      perSeatDisplay(cur.rate, cur.cycle, oldSym),
      perSeatDisplay(tgt.rate, tgt.cycle, newSym),
    ),
    diff("Seats", seatsChanged, `${cur.seats}`, `${tgt.seats}`),
    diff("Payment", paymentChanged, payLabel(cur.payment), payLabel(tgt.payment)),
  ];
  // What the company is invoiced each cycle. It closes the card whether or not
  // the edit moved it, so the reader can always see what the plan costs.
  const oldTotalStr = totalDisplay(oldTotal, cur.cycle, oldSym);
  const newTotalStr = totalDisplay(newTotal, tgt.cycle, newSym);
  rows.push(diff("Recurring", oldTotalStr !== newTotalStr, oldTotalStr, newTotalStr));

  const applyLabel = !anyChange
    ? "Save Changes"
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
  const newCycleTotalStr = money(newTotal, newSym);
  const cycleAdj = tgt.cycle === "Annual" ? "annual" : "monthly";
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
    todayDesc = `Prorated charge for remainder of the ${remainderWord}`;
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
          // "<date> ONWARDS" folds the old "first full charge" and "recurring"
          // dots into the one entry the node shows (616:1060).
          date: `${fmtFullDate(renewDate).toUpperCase()} ONWARDS`,
          amount: newCycleTotalStr,
          desc: collectionOnly
            ? `Recurring ${cycleAdj} charge collected via ${payMethodWord}`
            : immediate
            ? `First full ${cycleAdj} charge for the ${tgt.tier} Tier`
            : `New plan starts — first full ${cycleAdj} charge for the ${tgt.tier} Tier`,
        },
      ]
    : [];

  return {
    anyChange, label, channel, immediate, prorationParam, rows,
    chargeNow, chargeStr: money(chargeNow, newSym), chargeReason,
    applyLabel, pill, timeline,
  };
}

// The four wizard cases normalise into one PreviewModel, so the rail and the
// save-confirmation modal render from a single shape.
function buildPreviewModel({
  change, planTypeChange, currentSub,
  plan, tier, billingCycle, payment, effectiveRate, seatCount, planTotal, sym,
  freeAccessEndDate, isEdit, planDirty, currentPlan, currentAccessEnd, currentPlanKind,
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
  planTotal: number;
  sym: string;
  /** "YYYY-MM-DD" from the Access End Date field, "" until one is picked. */
  freeAccessEndDate: string;
  isEdit: boolean;
  /** Whether any plan field differs from the values the wizard loaded. */
  planDirty: boolean;
  /** The company's plan as it stands today — the untouched-edit summary. */
  currentPlan: PreviewRow[] | null;
  /** The Free Access end date the company arrived with ("" if it had none),
   *  or null when it isn't on Free Access at all. */
  currentAccessEnd: string | null;
  /** The plan the company arrived on; null when creating one. */
  currentPlanKind: Plan | null;
}): PreviewModel {
  const model: PreviewModel =
    // Editing, nothing touched yet: there is no change to preview, so the card
    // states the plan as it stands instead. This runs ahead of computeChange,
    // which would otherwise answer the same case with its empty card.
    isEdit && !planDirty
      ? currentPlan
        ? { rows: currentPlan, timeline: [] }
        : { empty: plan === "complimentary" ? NO_ACCESS_CHANGES : NO_BILLING_CHANGES, rows: [], timeline: [] }
      // Already on Free Access and staying there: the end date is the change.
      : currentAccessEnd !== null && plan === "complimentary"
      ? accessChangeToModel(currentAccessEnd, freeAccessEndDate)
      : change
      ? changeToModel(change)
      : planTypeChange && currentSub
      ? planTypeChangeToModel(planTypeChange, currentSub, freeAccessEndDate)
      : createToModel({ plan, tier, billingCycle, payment, effectiveRate, seatCount, planTotal, sym, freeAccessEndDate });

  // Converting a trial or a Free Access grant into a Subscription (or between
  // those two) runs through the create model, which describes the NEW plan and
  // nothing else. The plan itself is the headline change, so it leads the card
  // as an old → new row — the way a tier or rate change does.
  const planChanged = isEdit && currentPlanKind !== null && currentPlanKind !== plan;
  const showPlanRow = planChanged && !model.empty && !change && !planTypeChange;
  return showPlanRow
    ? {
        ...model,
        rows: [
          { label: "Plan", oldStr: planLabel(currentPlanKind), newStr: planLabel(plan) },
          ...model.rows.filter((r) => r.label !== "Plan"),
        ],
      }
    : model;
}

/* Confirmation step for a Manage Subscription save (Figma 483:588's confirm
   shell). It restates the change exactly as the preview card does — the admin
   reads the same rows twice rather than a second, differently-worded summary —
   and says what saving will do. */
function SaveChangesModal({
  model, effect, onCancel, onConfirm,
}: {
  model: PreviewModel;
  effect: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <PrmModal
      title="Save Changes"
      description="Review the change before it is applied."
      confirmLabel="Save Changes"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <div className="prm-stack">
        {model.rows.length > 0 && (
          <div className="sub-summary">
            {model.rows.map((r) => (
              <div className="sub-summary-row" key={r.label}>
                <span className="sub-summary-label">{r.label}</span>
                <span className="sub-summary-val">
                  {r.oldStr != null && (
                    <>
                      <span className="sub-summary-old">{r.oldStr}</span>
                      <span className="sub-summary-arrow">→</span>
                    </>
                  )}
                  <span className="sub-summary-new">{r.newStr}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="prm-text">{effect}</p>
      </div>
    </PrmModal>
  );
}

// Presentational billing-impact rail shown on the Plan step.
function BillingImpactRail({ model }: { model: PreviewModel }) {
  return (
    <aside className="cw-impact">
      <h2 className="cw-impact-title">Preview</h2>
      <SubPreview model={model} />
    </aside>
  );
}

// Normalised model for the subscription preview. `rows` are either diffs
// (old → new, when there is a prior subscription) or plain summary values
// (new only, when creating). `empty` is the no-change-yet edit state.
type PreviewRow = { label: string; oldStr?: string; newStr: string };
type PreviewModel = {
  empty?: { title: string; sub: string };
  rows: PreviewRow[];
  timeline: TimelineEntry[];
};

/* The untouched Manage Subscription state: rather than an empty card, the rail
   states the plan as it stands today — every field the form below can change,
   plus the totals and dates those fields drive. Values only, no old → new.
   Status is deliberately absent: it is not a field this form changes, and the
   Companies table's status pill already says it. */
function planLabel(kind: Plan): string {
  return kind === "subscription" ? "Subscription" : kind === "free-trial" ? "Free Trial" : "Free Access";
}

function currentPlanRows(company: Company, billing: CompanyBilling): PreviewRow[] {
  const sym = currencySymbol(billing.currency);
  const kind = planFor(company);
  const row = (label: string, newStr: string) => ({ label, newStr });

  if (kind === "complimentary") {
    return [
      row("Plan", "Free Access"),
      // Past tense once the grant has lapsed, the way the trial row reads — the
      // card is the only place the state is stated, so "Ends" on a date that
      // has been and gone would read as though access were still running.
      row(
        billing.status === "Free Access Ended" ? "Access Ended" : "Access Ends",
        fmtAccessDate(company.freeAccessEndDate ?? ""),
      ),
    ];
  }
  if (kind === "free-trial") {
    return [
      row("Plan", "Free Trial"),
      row(billing.status === "Free Trial" ? "Trial Ends" : "Trial Ended", billing.trialEndsOn),
    ];
  }

  const cycle = billing.billingCycle;
  // The currency reads off the Per Seat amount's own prefix, and the total and
  // the next invoice date are consequences rather than fields of this form.
  return [
    row("Plan", "Subscription"),
    ...(company.tier ? [row("Tier", company.tier)] : []),
    row("Cycle", cycleWord(cycle)),
    row("Per Seat", perSeatDisplay(billing.ratePerSeat, cycle, sym)),
    row("Seats", company.seats.toLocaleString()),
    row("Payment", payLabel(billing.payment)),
    row("Recurring", totalDisplay(billing.ratePerSeat * company.seats, cycle, sym)),
  ];
}

/* The no-change-yet edit state. A paid subscription lists the levers it has;
   a company on Free Access has only the plan itself and its end date. */
const NO_BILLING_CHANGES = {
  title: "No billing changes",
  sub: "Change the tier, cycle, rate, seats, or payment method to preview the impact.",
};
const NO_ACCESS_CHANGES = {
  title: "No changes",
  sub: "Change the plan or the access end date to preview the impact.",
};

// Editing a running paid subscription (plan stays "subscription").
function changeToModel(change: ChangePreview): PreviewModel {
  if (!change.anyChange) {
    return { empty: NO_BILLING_CHANGES, rows: [], timeline: [] };
  }
  return {
    rows: change.rows.map((r) => ({ label: r.label, oldStr: r.oldStr, newStr: r.newStr })),
    timeline: change.timeline,
  };
}

/* Editing a company that is already on Free Access. The only thing there is to
   change is when the access ends, so the card diffs that one field the way the
   subscription card diffs a rate. */
function accessChangeToModel(prevIso: string, nextIso: string): PreviewModel {
  const next = parseAccessEnd(nextIso);
  const prev = parseAccessEnd(prevIso);
  // Pulling the end date in is the same edit run the other way, so it says so
  // rather than calling a cut short an extension.
  const shortened = !!prev && !!next && next.getTime() < prev.getTime();
  return {
    rows: [
      { label: "Plan", newStr: "Free Access" },
      { label: "Access Ends", oldStr: fmtAccessDate(prevIso), newStr: fmtAccessDate(nextIso) },
    ],
    timeline: [
      {
        date: `TODAY · ${fmtFullDate(APP_TODAY).toUpperCase()}`,
        desc: shortened
          ? "Complimentary free access shortened. No charge or payment method required"
          : "Complimentary free access extended. No charge or payment method required",
        now: true,
      },
      ...(next
        ? [{
            date: `FREE ACCESS ENDS · ${fmtFullDate(next).toUpperCase()}`,
            desc: "Complimentary Free Access can be reinstated",
          }]
        : []),
    ],
  };
}

// Editing a running paid subscription, switching plan type away from
// subscription (→ Free Trial / Free Access). Scheduled for cycle end; no charge.
function planTypeChangeToModel(
  ptc: { target: string; renew: string },
  cur: CurrentSub,
  freeAccessEndDate: string,
): PreviewModel {
  const curSym = currencySymbol(cur.currency);
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
    rows: [
      { label: "Plan", oldStr: `${cur.tier} Subscription`, newStr: ptc.target },
      // A grant has an end date; a trial's length is set in Product Config.
      ...(isTrial ? [] : [{ label: "Access Ends", newStr: fmtAccessDate(freeAccessEndDate) }]),
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
        date: `${renewStr.toUpperCase()} ONWARDS`,
        amount: money(0, curSym),
        desc: isTrial
          ? "Subscription ends and the free trial begins — converts to a paid subscription when the trial ends"
          : "Subscription ends and free access begins — continues until it is manually revoked",
      },
    ],
  };
}

// Creating a new company, or editing one without a running paid subscription.
// No prior state to diff against, so the timeline is built from the form alone.
function createToModel({
  plan, tier, billingCycle, payment, effectiveRate, seatCount, planTotal, sym, freeAccessEndDate,
}: {
  plan: Plan;
  tier: PaidTier;
  billingCycle: BillingCycle;
  payment: PaymentCollection;
  effectiveRate: number;
  seatCount: number;
  planTotal: number;
  sym: string;
  freeAccessEndDate: string;
}): PreviewModel {
  const y = APP_TODAY.getFullYear();
  const m = APP_TODAY.getMonth();
  const todayLabel = `TODAY · ${fmtFullDate(APP_TODAY).toUpperCase()}`;

  if (plan === "free-trial") {
    const trialEnd = new Date(APP_TODAY.getTime() + TRIAL_DAYS * 86400000);
    return {
      rows: [{ label: "Plan", newStr: "Free Trial" }],
      timeline: [
        {
          date: todayLabel,
          amount: money(0, sym),
          desc: "Free Trial begins. No charge or payment required",
          now: true,
        },
        {
          date: `TRIAL ENDS · ${fmtFullDate(trialEnd).toUpperCase()}`,
          desc: `Trial length is set in Product Config (${TRIAL_DAYS} days)`,
        },
      ],
    };
  }

  if (plan === "complimentary") {
    // The end date is required to save, but the preview renders while the field
    // is still empty. A dot that can't name its date says nothing, so it is left
    // out entirely until one is picked — and with no second dot the timeline
    // draws no connector below the first, which is what makes the half-line
    // hanging off the bottom impossible.
    const accessEnd = parseAccessEnd(freeAccessEndDate);
    return {
      rows: [
        { label: "Plan", newStr: "Free Access" },
        { label: "Access Ends", newStr: fmtAccessDate(freeAccessEndDate) },
      ],
      timeline: [
        {
          date: todayLabel,
          desc: "Free Access granted. No charge or payment method required",
          now: true,
        },
        // Mirrors the trial's second dot: the end date, then what happens after
        // it — no amount, since nothing is charged either way.
        ...(accessEnd
          ? [{
              date: `FREE ACCESS ENDS · ${fmtFullDate(accessEnd).toUpperCase()}`,
              desc: "Complimentary Free Access can be reinstated",
            }]
          : []),
      ],
    };
  }

  // New subscription — effective today. Everyone bills on the 1st, so both
  // cycles are prorated for the remainder of THIS month today and then charged
  // in full on the 1st: a month's worth on Monthly, the year's on Annual.
  // No rate chosen yet — a currency the catalogue does not price, and no saved
  // price picked. The rows still describe the plan, but Per Seat has nothing to
  // state and there is no amount to build a timeline of charges from.
  const hasRate = effectiveRate > 0;
  // Same order as the form on the left: Tier · Cycle · Per Seat · Seats.
  const rows: PreviewRow[] = [
    { label: "Tier", newStr: tier },
    { label: "Cycle", newStr: cycleWord(billingCycle) },
    { label: "Per Seat", newStr: hasRate ? perSeatDisplay(effectiveRate, billingCycle, sym) : "—" },
    { label: "Seats", newStr: seatCount.toLocaleString() },
    { label: "Payment", newStr: payLabel(payment) },
  ];
  if (!hasRate) return { rows, timeline: [] };

  const { frac } = daysLeftInCycle("", "Monthly");
  const firstFullDate = new Date(y, m + 1, 1);
  // Today's proration covers the rest of this month either way, so an annual
  // plan prorates its MONTHLY equivalent — the year itself starts on the 1st.
  const proratedNow = money(monthlyRate(planTotal, billingCycle) * frac, sym);
  const timeline: TimelineEntry[] = [
    {
      date: todayLabel,
      amount: proratedNow,
      desc: "Prorated charge for remainder of the month",
      now: true,
    },
    {
      date: `${fmtFullDate(firstFullDate).toUpperCase()} ONWARDS`,
      amount: money(planTotal, sym),
      desc: billingCycle === "Annual"
        ? `Recurring annual charge for the ${tier} Tier`
        : `First full monthly charge for the ${tier} Tier`,
    },
  ];

  return { rows, timeline };
}

// Subscription preview (Figma 616:969): a headerless summary card — old → new
// where there is a prior value — over the billing timeline. Both sit directly in
// the rail; there are no section headers between them.
function SubPreview({ model }: { model: PreviewModel }) {
  if (model.empty) {
    return (
      <div className="sub-preview-empty">
        <div className="sub-preview-empty-title">{model.empty.title}</div>
        <div className="sub-preview-empty-sub">{model.empty.sub}</div>
      </div>
    );
  }
  return (
    <>
      {model.rows.length > 0 && (
        <div className="sub-summary">
          {model.rows.map((r) => (
            <div className="sub-summary-row" key={r.label}>
              <span className="sub-summary-label">{r.label}</span>
              <span className="sub-summary-val">
                {r.oldStr != null && (
                  <>
                    <span className="sub-summary-old">{r.oldStr}</span>
                    <span className="sub-summary-arrow">→</span>
                  </>
                )}
                <span className="sub-summary-new">{r.newStr}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {/* An empty timeline renders nothing at all, rather than an empty rail —
          there is no price yet, so there are no charges to lay out. */}
      {model.timeline.length > 0 && (
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
      )}
    </>
  );
}

/* ─────────────── Step 1 — Company Details ─────────────── */

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
      <h1 className="wizard-title">Company Details</h1>
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
            searchPlaceholder="Search Countries..."
            maxVisibleOptions={5}
            renderTrigger={({ toggle, label }) => (
              <button type="button" className="address-row address-row-btn" onClick={toggle}>
                <span className="address-select">{label}</span>
                <span className="address-chevron"><DropdownCaretIcon /></span>
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
              onChange={(e) => {
                const zip = e.target.value;
                setAddrPin(zip);
                // The zipcode pins down the rest of the address, so a complete
                // one fills the fields it determines. They stay editable —
                // this only runs again if the zipcode itself changes.
                const match = lookupZip(zip);
                if (match) {
                  setCountry(match.country);
                  setAddrState(match.state);
                  if (match.city) setAddrCity(match.city);
                }
              }}
            />
          </div>
          <SelectField
            value={addrState}
            options={US_STATES}
            onChange={setAddrState}
            placeholder="State"
            searchPlaceholder="Search States..."
            maxVisibleOptions={5}
            renderTrigger={({ toggle, label, isPlaceholder }) => (
              <button type="button" className="address-row address-row-btn" onClick={toggle}>
                <span className={`address-select ${isPlaceholder ? "is-placeholder" : ""}`}>{label}</span>
                <span className="address-chevron"><DropdownCaretIcon /></span>
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
          <label className="form-label">Industry</label>
          <MultiSelect
            options={INDUSTRY_OPTIONS}
            value={industries}
            onChange={setIndustries}
            placeholder="Select Industries"
            searchPlaceholder="Search Industries..."
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
        <div className="form-group">
          <label className="form-label">Partnership</label>
          <MultiSelect
            options={PARTNERSHIP_OPTIONS}
            value={partnerships}
            onChange={setPartnerships}
            placeholder="Select Partnerships"
            searchPlaceholder="Search Partnerships..."
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

      <div className="form-row-2">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Assigned CSM</label>
          <SelectField
            value={assignedCsm}
            options={CSM_OPTIONS}
            onChange={setAssignedCsm}
            placeholder="Unassigned"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Assigned Sales Rep</label>
          <SelectField
            value={assignedSalesRep}
            options={SALES_REP_OPTIONS}
            onChange={setAssignedSalesRep}
            placeholder="Unassigned"
          />
        </div>
      </div>
    </>
  );
}

/* ─────────────── Step 2 — Admin Account ─────────────── */

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
  const [country, setCountry] = useState(
    () => findPhoneCountry(phone) ?? DEFAULT_PHONE_COUNTRY,
  );
  const [national, setNational] = useState(() => {
    const match = findPhoneCountry(phone);
    return formatPhoneNumber(match ? phone.slice(dialCodeFor(match).length) : phone);
  });

  function emit(code: string, nat: string) {
    setPhone(nat ? `${code} ${nat}` : "");
  }

  return (
    <div className="phone-field">
      {/* Figma 938:961 "Dropdown Menu - Countries": a "Search Countries..."
          header over rows that pair the country name with its dial code,
          right-aligned and muted. Long names wrap rather than truncate, so a
          row is 35px or taller. The collapsed control has room for the short
          form only, so it renders its own trigger reading "US ( +1 )". */}
      <SelectField
        value={country}
        options={COUNTRIES}
        onChange={(next) => {
          setCountry(next);
          emit(dialCodeFor(next), national);
        }}
        optionDetail={(name) => dialCodeFor(name)}
        searchPlaceholder="Search..."
        maxVisibleOptions={5}
        panelClass="ss-menu--countries"
        renderTrigger={({ open, toggle }) => (
          <button
            type="button"
            className={`select-field${open ? " is-open" : ""}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={toggle}
          >
            <span className="select-field-value">{dialLabelFor(country)}</span>
            <span className="field-chevron"><DropdownCaretIcon /></span>
          </button>
        )}
      />
      <input
        className="form-input"
        type="tel"
        inputMode="numeric"
        placeholder="Phone Number..."
        value={national}
        onChange={(e) => {
          const next = formatPhoneNumber(e.target.value);
          setNational(next);
          emit(dialCodeFor(country), next);
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
      <h1 className="wizard-title">Admin Account</h1>
      <p className="wizard-desc">
        The primary contact and first Admin account for the company.
      </p>

      <div className="form-group">
        <label className="form-label">Account Holder <span className="req">*</span></label>
        <input
          autoFocus
          className="form-input"
          placeholder="Name..."
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Email <span className="req">*</span></label>
        <input
          className="form-input"
          type="email"
          placeholder="Email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="form-help">
          Becomes the Stripe billing email and the company's first Admin account.
        </p>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Phone Number</label>
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
  noteRate, noteSym, effectiveRate, planTotal, seatCount, sym,
  savedPrices,
  onCreatePrice,
  trialExpired = false,
  trialLocked = false,
  complimentaryLocked = false,
  automaticLocked = false,
  freeAccessEndDate, setFreeAccessEndDate,
  seatsLocked = false,
  hideSummary = false,
  manageMode = false,
}: {
  plan: Plan; setPlan: (v: Plan) => void;
  tier: PaidTier; setTier: (v: PaidTier) => void;
  billingCycle: BillingCycle; setBillingCycle: (v: BillingCycle) => void;
  currency: Currency; setCurrency: (v: Currency) => void;
  priceStr: string; setPriceStr: (v: string) => void;
  seats: string; setSeats: (v: string) => void;
  payment: PaymentCollection; setPayment: (v: PaymentCollection) => void;
  noteRate: number; noteSym: string; effectiveRate: number; planTotal: number; seatCount: number; sym: string;
  savedPrices: SavedPrice[];
  onCreatePrice: () => void;
  trialExpired?: boolean;
  trialLocked?: boolean;
  complimentaryLocked?: boolean;
  automaticLocked?: boolean;
  freeAccessEndDate: string; setFreeAccessEndDate: (v: string) => void;
  seatsLocked?: boolean;
  hideSummary?: boolean;
  /** Manage Subscription: this step IS the page, so it heads itself. */
  manageMode?: boolean;
}) {
  const isSubscription = plan === "subscription";

  return (
    <>
      <h1 className="wizard-title">{manageMode ? "Manage Subscription" : "Plan Selection"}</h1>
      <p className="wizard-desc">
        {manageMode ? "Update the company's plan" : "Set up the company's plan"}
      </p>

      <div className="form-group">
        <label className="form-label">Plan <span className="req">*</span></label>
        <div className="radio-card-group">
          <RadioCard
            selected={plan === "subscription"}
            onSelect={() => setPlan("subscription")}
            title="Subscription"
            desc="Paid plan. You can set the Tier, Price-Per Seat, and Payment Method"
          />
          <RadioCard
            selected={plan === "free-trial"}
            onSelect={() => setPlan("free-trial")}
            disabled={trialExpired || trialLocked}
            title="Free Trial"
            desc={
              trialExpired
                ? "Unavailable — this company's trial has already expired. Convert to a Subscription or grant Complimentary Free Access."
                : trialLocked
                ? "Unavailable — this company is already on a paid or complimentary plan. A trial can't be started from here."
                : `${TRIAL_DAYS}-day free trial. No payment method required to start the trial.`
            }
          />
          <RadioCard
            selected={plan === "complimentary"}
            onSelect={() => setPlan("complimentary")}
            disabled={complimentaryLocked}
            title="Complimentary Free Access"
            desc={
              complimentaryLocked
                ? "Company's subscription must be cancelled before they can be given Free Access"
                : "Free access, with all the same features as that of the Pro Tier."
            }
          />
        </div>
      </div>

      {isSubscription && (
        <>
          <div className="form-group">
            <label className="form-label">Subscription Tier <span className="req">*</span></label>
            <div className="seg-control">
              {(TIERS as PaidTier[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`seg-btn ${tier === t ? "active accent" : ""}`}
                  onClick={() => setTier(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Billing Cycle <span className="req">*</span></label>
            <div className="seg-control">
              {BILLING_CYCLES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`seg-btn ${billingCycle === c ? "active accent" : ""}`}
                  onClick={() => setBillingCycle(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Per-Seat Price <span className="req">*</span></label>
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
              noteRate={noteRate}
              noteSym={noteSym}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Seats <span className="req">*</span></label>
            <Stepper
              value={seats}
              onChange={setSeats}
              min={1}
              disabled={seatsLocked}
            />
            <p className="form-help">
              {seatsLocked
                ? "Seat count is set when the company is created and can't be changed here."
                : "Minimum 1. Number of seats to be billed for the company's first invoice."}
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Payment Method <span className="req">*</span></label>
            <div className="radio-card-group">
              <RadioCard
                selected={payment === "Automatic"}
                onSelect={() => setPayment("Automatic")}
                disabled={automaticLocked}
                title="Automatically charge a payment method"
                desc={
                  automaticLocked
                    ? "Companies can switch to automatic payment via the Billing Tab of their Dashboard"
                    : "Generates a unique payment link that must be shared with the company"
                }
              />
              <RadioCard
                selected={payment === "Invoice"}
                onSelect={() => setPayment("Invoice")}
                title="Email invoice to pay manually"
                desc="Payment due 30 days after the invoice is sent"
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
                  {sym}{planTotal.toLocaleString()} / {billingCycle === "Annual" ? "year" : "month"}
                </span>
              </div>
              {billingCycle === "Annual" && (
                <div className="co-cost-sub">
                  Billed once a year — {sym}{(planTotal / 12).toLocaleString("en-US", { maximumFractionDigits: 2 })} / month equivalent
                </div>
              )}
            </div>
          )}
        </>
      )}

      {plan === "complimentary" && (
        <div className="form-group" style={{ marginTop: 16, marginBottom: 0 }}>
          <label className="form-label">Access End Date <span className="req">*</span></label>
          <DateField
            value={freeAccessEndDate}
            onChange={setFreeAccessEndDate}
            placeholder="Select Date..."
          />
        </div>
      )}
    </>
  );
}

/* ─────────────── Per-seat price — combined currency + price dropdown ─────────────── */

function PerSeatPriceField({
  currency, setCurrency,
  priceStr, setPriceStr,
  savedPrices, onCreatePrice,
  sym, tier, billingCycle, noteRate, noteSym,
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
  noteRate: number;
  noteSym: string;
}) {
  const [priceOpen, setPriceOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [priceSearch, setPriceSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const priceSearchRef = useRef<HTMLInputElement | null>(null);

  /* Figma 619:1332 opens with "Search Prices..." active, so the menu takes the
     caret as soon as it appears and the list filters from there — the field's
     own amount is no longer what narrows it. Reset between openings so a stale
     query never hides the list. */
  useEffect(() => {
    if (priceOpen) priceSearchRef.current?.focus();
    else setPriceSearch("");
  }, [priceOpen]);

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
  const entered = parseFloat(priceStr);
  const hasEntered = !isNaN(entered) && entered > 0;

  /* Saved prices available in the chosen currency, narrowed by the menu's own
     search. It matches the amount OR the price's name, since the row shows
     both and either is a reasonable thing to type. */
  const query = priceSearch.trim().toLowerCase();
  const matches = useMemo(() => {
    const pool = savedPrices.filter((p) => rateOf(p) > 0);
    if (!query) return pool;
    return pool.filter(
      (p) =>
        String(rateOf(p)).startsWith(query) ||
        (p.label ?? "").toLowerCase().includes(query),
    );
  }, [savedPrices, currency, query]);

  const exact = savedPrices.find((p) => rateOf(p) === entered) ?? null;
  const unitWordLong = billingCycle === "Annual" ? "year" : "month";

  function pick(p: SavedPrice) {
    setPriceStr(String(rateOf(p)));
    setPriceOpen(false);
  }

  return (
    <div className="cw-price" ref={wrapRef}>
      <div className={`cw-price-field${priceOpen || currencyOpen ? " is-open" : ""}${hasEntered && !exact ? " has-error" : ""}`}>
        {/* Each half of the shell is its own positioning context, so a menu sizes
            to the cell that opens it — the currency list to the currency cell,
            the prices list to the amount cell — instead of spanning the whole
            field. */}
        {/* Currency selector segment — the same picker the Create New Price
            modal uses (Figma 941:1115): "USD - United States Dollar" rows on
            the design-system menu, in a menu the width of its own cell. */}
        <SelectField
          value={currencyOptionFor(currency)}
          options={CURRENCY_INFO.map((c) => currencyOptionFor(c.code))}
          searchPlaceholder="Search..."
          onChange={(next) => {
            setCurrency(codeFromCurrencyOption(next) as Currency);
            setPriceOpen(false);
          }}
          maxVisibleOptions={5}
          panelClass="ss-menu--currency"
          onOpenChange={setCurrencyOpen}
          renderTrigger={({ open, toggle }) => (
            <button
              type="button"
              className="cw-price-cur"
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => { toggle(); setPriceOpen(false); }}
            >
              <span className="cw-price-cur-code">{currency}</span>
              <span className="cw-price-caret"><DropdownCaretIcon /></span>
            </button>
          )}
        />

        <div className="cw-price-seg cw-price-seg--grow">
          {/* One cell: the value, the unit, and the menu caret — the node draws no
              divider between them, only between currency and price. The price is
              picked from the menu, never typed, so this is a button rather than
              an input; the menu's own "Search Prices..." box is the only place
              anything is typed. */}
          <button
            type="button"
            className="cw-price-cell"
            aria-haspopup="listbox"
            aria-expanded={priceOpen}
            onClick={() => {
              setPriceOpen((o) => !o);
              setCurrencyOpen(false);
            }}
          >
            {/* The prefix belongs to an amount. With the field empty it would
                sit in front of the placeholder ("AED Select a Price..."), so it
                only appears once there is a number to prefix. */}
            {priceStr !== "" && <span className="cw-price-sym">{sym}</span>}
            <span className={`cw-price-value${priceStr === "" ? " is-placeholder" : ""}`}>
              {priceStr === "" ? "Select a Price..." : priceStr}
            </span>
            <span className="cw-price-unit">/seat/{unitWordLong}</span>
            <span className="cw-price-caret"><DropdownCaretIcon /></span>
          </button>
          {/* Saved-price dropdown — Figma 619:1332 "Dropdown Menu - Stripe
              Prices": a search header, the price rows, and an "Add New Price"
              footer, each divided by a #404040 hairline. */}
          {priceOpen && (
            <div className="cw-price-menu cw-price-menu--list">
              <DropdownSearch
                inputRef={priceSearchRef}
                placeholder="Search Prices..."
                value={priceSearch}
                onChange={setPriceSearch}
              />
  
              <div className="cw-price-list">
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  /* Marked against `exact`, not the rate — two saved prices can
                     share one rate, and `exact` is the one the note below the
                     field names as the current price. */
                  className={`cw-price-opt cw-price-opt--saved${p === exact ? " is-current" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                >
                  {/* Node 619:1332 writes the cycle into the row ("$56 USD/month"),
                      but a SavedPrice stores only a rate — its cycle lives in the
                      label, and the list is not filtered by the field's cycle, so
                      taking the unit from the field labels Monthly prices "/year".
                      The rate and currency are what the data can state. */}
                  <span className="cw-price-opt-rate">
                    {sym}{rateOf(p)} {currency}
                  </span>
                  {p.label && <span className="cw-price-opt-label">{p.label}</span>}
                </button>
              ))}
  
              {matches.length === 0 && (
                <div className="cw-price-empty">
                  {query ? `No matches for “${priceSearch.trim()}”` : "No saved prices in this currency."}
                </div>
              )}
              </div>
  
              {/* Figma 620:1446 — always available, not gated on having typed an
                  unsaved amount. */}
              <button
                type="button"
                className="cw-price-create"
                onMouseDown={(e) => { e.preventDefault(); setPriceOpen(false); onCreatePrice(); }}
              >
                {/* Figma 620:1453 is the Icon Library plus — the same glyph
                    TreeAddIcon already carries (16px, 1.333 stroke, square
                    caps), not a typed "+". */}
                <span className="cw-price-create-plus"><TreeAddIcon /></span>
                Add New Price
              </button>
            </div>
          )}
        </div>
      </div>

      {/* The field's only subtext. The "Saved price:" / "Custom price" notes
          that used to sit here are not a component in the design; the unsaved
          case still shows through the field's own error border, and the Create
          button stays disabled via `priceValid`. */}
      <p className="form-help">
        Default for {tier} {cycleWord(billingCycle)} is {noteSym}{noteRate} / seat / {unitWordLong}.
      </p>
    </div>
  );
}

/* ─────────────── Success screen ─────────────── */

function CompanySummaryRows({
  company, plan, tier,
}: {
  company: Omit<Company, "id">; plan: Plan; tier?: PaidTier;
}) {
  const isSubscription = plan === "subscription";
  const sym = company.currency ? currencySymbol(company.currency) : "$";

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
      {company.industry.length > 0 && detail("Industry", company.industry.join(", "))}
      {company.partnership.length > 0 && detail("Partnership", company.partnership.join(", "))}
      {company.taxStatus && detail("Tax status", company.taxStatus)}
      {company.assignedCsm && detail("Assigned CSM", company.assignedCsm)}
      {company.assignedSalesRep && detail("Assigned Sales Rep", company.assignedSalesRep)}
      <div className="success-divider" />
      {detail("Plan", plan === "free-trial" ? "Free Trial" : plan === "complimentary" ? "Free Access" : "Subscription")}
      {plan === "complimentary" && company.freeAccessEndDate && detail("Free access ends", company.freeAccessEndDate)}
      {isSubscription && tier && detail("Tier", tier)}
      {isSubscription && detail("Billing cycle", company.billingCycle === "Annual" ? "Annual" : "Monthly")}
      {isSubscription && detail("Currency", company.currency ?? "USD")}
      {isSubscription && detail("Per-seat rate", `${sym}${company.ratePerSeat} / ${company.billingCycle === "Annual" ? "year" : "month"}`)}
      {isSubscription && detail("Seats", String(company.seats))}
      {isSubscription && detail("Payment method", company.payment === "Automatic" ? "Automatic" : "Manual (invoice)")}
      {isSubscription && detail(
        company.billingCycle === "Annual" ? "Est. annual total" : "Est. monthly total",
        `${sym}${((company.ratePerSeat ?? 0) * company.seats).toLocaleString()}`,
      )}
    </>
  );
}

function StripeLinkBox({ stripeLink, onCopy }: {
  stripeLink: string;
  /** Fired on every copy, so the parent's toast rises alongside it. */
  onCopy?: () => void;
}) {
  function copy() {
    // The toast fires on the click, not on the promise: a browser that refuses
    // the write (an insecure origin, a denied permission) would otherwise leave
    // the button silent, with no sign the click registered at all. The link is
    // on screen and selectable either way.
    navigator.clipboard?.writeText(stripeLink).catch(() => {});
    onCopy?.();
  }

  return (
    <div className="stripe-link-box">
      {/* Figma 1046:1250 — a tinted card holding the link and a copy glyph. The
          glyph never swaps to a check: the toast is the whole acknowledgement,
          so the button reads the same before and after. */}
      <div className="stripe-link-row">
        <span className="stripe-link-url">{stripeLink}</span>
        <button
          className="stripe-link-copy"
          title="Copy link"
          aria-label="Copy payment link"
          onClick={copy}
        >
          <CopyIcon />
        </button>
      </div>
      <p className="stripe-link-note">
        Share this link with the company to collect their payment method. The Stripe
        subscription and Dashboard activate once payment method is added. The link remains
        active for 24 hours.
      </p>
    </div>
  );
}

/* Reviewed-but-not-yet-created — shown for brand-new companies (not edits)
 * after the wizard's final step, before anything is actually saved. No
 * payment link here; that only appears once the company is confirmed. */
function ConfirmCompanyScreen({
  company, plan, tier, onBack, onConfirm, onEditStep,
}: {
  company: Omit<Company, "id">; plan: Plan; tier?: PaidTier;
  onBack: () => void; onConfirm: () => void;
  /** Jumps back to the wizard step a card came from. */
  onEditStep: (step: number) => void;
}) {
  const isSubscription = plan === "subscription";
  const currency = company.currency ?? "USD";
  // The node reads "USD $79.00" — code, then symbol, then amount. A currency
  // with no symbol on file would repeat its code, so it prints the code alone.
  const rate = company.ratePerSeat ?? 0;
  const perSeat = `${currency} ${CURRENCY_SYMBOL[currency] ?? ""}${rate.toFixed(2)}`;

  const planLabel =
    plan === "free-trial" ? "Free Trial" : plan === "complimentary" ? "Free Access" : "Subscription";

  return (
    <div className="wizard">
      {/* The plain wizard body, not the centred success one — this is a page
          with a header and content, the same shape as the steps before it. */}
      <div className="wizard-body">
        <div className="wizard-content">
          <h1 className="wizard-title">Review Details</h1>
          <p className="wizard-desc">
            Review all the details. Once done, the company's account will be created.
          </p>

          {/* Confirm Details 6B — one full-width card per wizard step, stacked,
              each headed by its title and a pencil that returns to that step.
              The two detail cards list every field, blanks included, so a
              missing one is visible as "—"; the Subscription card drops fields
              that don't apply to the plan. */}
          <div className="confirm-cards">
            <ConfirmCard title="Company Details" fillBlanks onEdit={() => onEditStep(0)} rows={[
              ["Company Name", company.name],
              ["Address", company.address, true],
              ["Tax Behaviour", company.taxStatus],
              ["Industry", company.industry.join(", ")],
              ["Partnership", company.partnership.join(", ")],
              ["Assigned CSM", company.assignedCsm],
              ["Assigned Sales Rep", company.assignedSalesRep],
            ]} />

            <ConfirmCard title="Account Holder" fillBlanks onEdit={() => onEditStep(1)} rows={[
              ["Company Admin", company.contactName],
              ["Email", company.email],
              ["Phone Number", company.phone],
            ]} />

            <ConfirmCard title="Subscription" onEdit={() => onEditStep(2)} rows={[
              ["Plan", planLabel],
              ["Free Access Ends", plan === "complimentary" ? company.freeAccessEndDate : undefined],
              ["Subscription Tier", isSubscription ? tier : undefined],
              ["Billing Cycle", isSubscription ? (company.billingCycle === "Annual" ? "Annual" : "Monthly") : undefined],
              ["Price Per-Seat", isSubscription ? perSeat : undefined],
              ["No. of Seats", isSubscription ? String(company.seats) : undefined],
              ["Payment Method", isSubscription
                ? (company.payment === "Automatic" ? "Automatic Payment" : "Manual Invoice")
                : undefined],
            ]} />
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onBack}>Back</button>
        </div>
        <div className="wizard-actions">
          <button className="btn-publish" onClick={onConfirm}>Create Company</button>
        </div>
      </footer>
    </div>
  );
}

/* Shown right after a brand-new automatically-billed subscription is created —
 * just the company name and the Stripe link to send the account holder. The
 * full detail summary was already reviewed on the confirmation screen. */
function PaymentLinkScreen({
  company, autoCopied = false, onClose,
}: {
  company: Omit<Company, "id">; autoCopied?: boolean; onClose: () => void;
}) {
  const stripeLink = stripePaymentLink(company.email, company.name);
  // The toast (Figma 1046:1141) fires alongside the button's own "Copied"
  // flash — the auto-copy included — and re-fires on every manual click
  // rather than staying up for the one continuous auto-copied stretch.
  // `autoCopied` lands as a prop update after this screen has already
  // mounted (the clipboard write is still pending when the screen first
  // renders), so it's watched with an effect rather than a useState
  // initializer, which would only see the value at mount.
  const [showToast, setShowToast] = useState(false);
  useEffect(() => {
    if (autoCopied) setShowToast(true);
  }, [autoCopied]);
  return (
    <div className="wizard">
      <div className="wizard-body wizard-body--success pl-body">
        <div className="wizard-content wizard-success-content wizard-success-content--center">
          {/* Figma 1046:1111 "Icon Filled" — the brand-orange badge, not the
              green one the other success screens use. Its check is the icon
              library's own `tdesign:check`, which `CheckIcon` already draws. */}
          <div className="wizard-success-icon wizard-success-icon--brand">
            <CheckIcon />
          </div>
          <h1 className="wizard-title">Company Created</h1>
          <p className="wizard-desc">
            Almost done! Just the Payment Method needs to be added.
          </p>

          <StripeLinkBox stripeLink={stripeLink} onCopy={() => setShowToast(true)} />
        </div>

        {/* Inside the body, not the page, so the 40px offset is measured from
            where the footer begins rather than from the window's bottom. With
            no footer the body runs to the bottom and the 40px falls there. */}
        {showToast && <CopiedToast onDone={() => setShowToast(false)} />}
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
  initialCycle,
  onClose,
  onCreate,
}: {
  initialCycle: BillingCycle;
  onClose: () => void;
  onCreate: (p: SavedPrice) => void;
}) {
  const [label, setLabel] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  // Always USD then CAD, both empty. The wizard's own currency and rate are
  // deliberately NOT carried in: this creates a catalogue price, and seeding it
  // from whatever the form happened to show made the two look linked when they
  // are not. Any other currency is added from the row below.
  const [rows, setRows] = useState<{ code: string; amount: string }[]>([
    { code: "USD", amount: "" },
    { code: "CAD", amount: "" },
  ]);
  const usedCodes = rows.map((r) => r.code);
  const available = CURRENCY_INFO.filter((c) => !usedCodes.includes(c.code));
  // Every row's currency is now editable and every row is removable, so the
  // price is valid once ANY row carries a rate — not just the first. A price
  // that omits the wizard's own currency simply leaves its price field empty,
  // which the wizard already handles.
  const valid = rows.some((r) => parseFloat(r.amount) > 0);

  function setAmount(i: number, v: string) {
    if (v !== "" && !/^\d*\.?\d{0,2}$/.test(v)) return;
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, amount: v } : r)));
  }
  function setCode(i: number, code: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, code } : r)));
  }
  function addCurrency(code: string) {
    setRows((prev) => [...prev, { code, amount: "" }]);
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
    onCreate({ id: `custom-${Date.now()}`, label: label.trim(), rates, cycle });
  }

  // The shared modal shell (Figma 483:588 / 667:884) owns the card, the title +
  // close glyph and the Cancel / CTA footer, so this only supplies the form.
  // `.prm-body` already sets the 24px gutter and the gap between groups, which
  // is why the groups carry no bottom margin of their own.
  return (
    <PrmModal
      title="Create New Price"
      description="Set the per-seat rate per currency. This price becomes available to select for any future company."
      confirmLabel="Create Price"
      confirmDisabled={!valid}
      onCancel={onClose}
      onConfirm={submit}
    >
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Name</label>
        <input
          autoFocus
          className="form-input"
          placeholder="Name..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <p className="form-help">
          Optional - Internal-facing label for the saved-price list. Never shown to the customer.
        </p>
      </div>

      {/* The same segmented control the Plan step uses for Billing Cycle. */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Billing Cycle</label>
        <div className="seg-control">
          {BILLING_CYCLES.map((c) => (
            <button
              key={c}
              type="button"
              className={`seg-btn ${cycle === c ? "active accent" : ""}`}
              onClick={() => setCycle(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Price Per-Seat <span className="req">*</span></label>
        {/* Figma 940:1013 "Paywall - Single Price": a tinted card of rows, each
            a split currency+amount control with a remove glyph beside it, over
            an "Add Currency" action. */}
        <div className="cp-rate-rows">
          {rows.map((row, i) => (
            <div className="cp-rate-row" key={row.code}>
              <div className="cp-rate-control">
                {/* Only the codes not already spoken for, plus this row's own. */}
                {/* Figma 941:1115: the menu lists "USD - United States Dollar"
                    as one string, while the 146px cell has room for the code
                    alone — hence the custom trigger and the wider menu. */}
                <SelectField
                  value={currencyOptionFor(row.code)}
                  options={CURRENCY_INFO.filter(
                    (c) => c.code === row.code || !usedCodes.includes(c.code),
                  ).map((c) => currencyOptionFor(c.code))}
                  onChange={(next) => setCode(i, codeFromCurrencyOption(next))}
                  searchPlaceholder="Search..."
                  maxVisibleOptions={5}
                  panelClass="ss-menu--currency"
                  popupMenu
                  renderTrigger={({ open, toggle }) => (
                    <button
                      type="button"
                      className={`cp-rate-cur${open ? " is-open" : ""}`}
                      aria-haspopup="listbox"
                      aria-expanded={open}
                      onClick={toggle}
                    >
                      <span>{row.code}</span>
                      <span className="field-chevron"><DropdownCaretIcon /></span>
                    </button>
                  )}
                />
                <div className="cp-rate-amount-cell">
                  <input
                    className="cp-rate-amount"
                    type="text"
                    inputMode="decimal"
                    value={row.amount}
                    placeholder="0.00"
                    onChange={(e) => setAmount(i, e.target.value)}
                  />
                  {/* 941:1206 — the unit follows the cycle chosen above, so a
                      Annual price never reads "/seat/month". */}
                  <span className="cp-rate-unit">
                    /seat/{cycle === "Annual" ? "year" : "month"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="cp-rate-remove"
                aria-label={`Remove ${row.code}`}
                disabled={rows.length === 1}
                onClick={() => removeRow(i)}
              >
                <RemoveRowIcon />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="cp-add-btn"
            disabled={available.length === 0}
            onClick={() => addCurrency(available[0].code)}
          >
            <TreeAddIcon />
            Add Currency
          </button>
        </div>
        <p className="form-help">
          Set the price in all currencies we support. Leave blank if a price is not
          applicable to a certain country. Prices set here won’t automatically update
          if exchange rate changes.
        </p>
      </div>
    </PrmModal>
  );
}

/* ─────────────── Multi-select ─────────────── */

/* Figma 147:1147 keeps the field one row tall: two pills, then a "+N" counter
   for the rest. */

export function MultiSelect({
  options, value, onChange, placeholder, searchPlaceholder, popupMenu = false,
}: {
  options: string[]; value: string[]; onChange: (v: string[]) => void;
  placeholder: string;
  /** Search box label, e.g. "Search Industries…" (Figma 591:1322). OMIT it to
   *  drop the search header entirely — the same switch SelectField uses. A
   *  short, fixed list (cancellation reasons) reads faster without one. */
  searchPlaceholder?: string;
  /** Set when the field sits on a modal/popup — the panel takes the
   *  popup-context surface (Figma 668:972), same as SelectField's. */
  popupMenu?: boolean;
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
        panelClass={`ms-menu${popupMenu ? " ms-menu--popup" : ""}`}
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
              <MultiSelectTags
                tags={value.map((v) => ({
                  key: v,
                  label: v,
                  onRemove: () => onChange(value.filter((x) => x !== v)),
                }))}
              />
            )}
            <span className="field-chevron"><DropdownCaretIcon /></span>
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
  searchPlaceholder?: string; query: string; setQuery: (v: string) => void;
}) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!searchPlaceholder) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [searchPlaceholder]);

  return (
    <>
      {searchPlaceholder && (
        <DropdownSearch
          inputRef={searchRef}
          placeholder={searchPlaceholder}
          value={query}
          onChange={setQuery}
        />
      )}
      {/* Five rows, then scroll. Same arithmetic SelectField uses: a row is
          35px (8 + a 19px line + 8) and `.ms-menu .dropdown-list` pads 8px top
          and bottom, so five land exactly on the fifth row's edge and the
          clipped sixth reads as "there is more below". Shorter lists still
          collapse to their own height; the search header above stays put
          either way. */}
      <div className="dropdown-list" style={{ maxHeight: 5 * 35 + 16 }}>
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <button
              key={opt}
              // `is-current` sets the SemiBold selected row (Figma 591:1322),
              // the same class the single-select menu marks its value with.
              className={`dropdown-item${selected ? " is-current" : ""}`}
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
        {options.length === 0 && (
          <div className="ms-menu-empty">
            {query.trim() ? `No matches for “${query.trim()}”` : "No matches"}
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────── Shared sub-components ─────────────── */

export function RadioCard({
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
