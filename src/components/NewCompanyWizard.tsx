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
import { CheckBoldIcon, ChevronLeftIcon, SmallXIcon } from "./icons";

/* ─────────────── Constants ─────────────── */

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

const INDUSTRY_OPTIONS = [
  "HVAC", "Electrical", "Plumbing", "Solar", "Roofing",
  "Refrigeration", "Fire Protection", "Construction",
  "Appliance Repair", "Utilities", "Other",
];

const PARTNERSHIP_OPTIONS = [
  "Preferred Partner", "Elite Partner", "NGO Partner",
  "NexStar", "National Account", "Channel Partner",
];

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
};

function planFor(c: Company): Plan {
  if (c.tier === "Free Trial") return "free-trial";
  if (c.tier === "Complimentary Access") return "complimentary";
  return "subscription";
}

export function NewCompanyWizard({ onClose, onCreate, editCompany, onSave }: Props) {
  const isEdit = !!editCompany;
  // Billing defaults are derived for seed companies that have no explicit values,
  // so the edit form starts populated either way.
  const editBilling = editCompany ? getCompanyBilling(editCompany) : null;

  // A company whose free trial has expired cannot be put back onto a trial — it
  // can only convert to a paid Subscription or be granted Complimentary Access.
  const trialExpired = isEdit && editBilling?.status === "Trial Expired";

  // When editing a company that already has a running paid subscription, the
  // billing-impact rail becomes a change preview (diff + proration) instead of
  // the new-company "what happens on save" summary.
  const currentSub: CurrentSub | null =
    isEdit && editCompany && editBilling &&
    (editBilling.status === "Active" || editBilling.status === "Paused") &&
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
  const [address, setAddress] = useState(editCompany?.address ?? "");
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
    editCompany ? (trialExpired ? "subscription" : planFor(editCompany)) : "free-trial",
  );
  const [tier, setTier] = useState<PaidTier>(
    editCompany && planFor(editCompany) === "subscription" ? (editCompany.tier as PaidTier) : "Essentials",
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(editBilling?.billingCycle ?? "Monthly");
  const [currency, setCurrency] = useState<Currency>(editBilling?.currency ?? "USD");
  const [priceStr, setPriceStr] = useState(
    editCompany && planFor(editCompany) === "subscription" && editBilling ? String(editBilling.ratePerSeat) : "",
  );
  const [seats, setSeats] = useState(editCompany ? String(editCompany.seats) : "");
  const [payment, setPayment] = useState<PaymentCollection>(editBilling?.payment ?? "Automatic");
  const [savedPrices, setSavedPrices] = useState<SavedPrice[]>(buildDefaultSavedPrices);
  const [showNewPriceModal, setShowNewPriceModal] = useState(false);

  // Success
  const [createdCompany, setCreatedCompany] = useState<Omit<Company, "id"> | null>(null);

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

  const detailsValid = name.trim().length > 0 && contactName.trim().length > 0 && email.trim().length > 0;
  // A subscription must have at least one paid seat before it can be saved.
  const seatsValid = !isSubscription || seatCount > 0;
  const canSave = detailsValid && seatsValid;
  const saveHint = !detailsValid
    ? "Add a company name, account holder, and email to continue."
    : !seatsValid
    ? "Enter at least one seat for a subscription."
    : "";

  function handleCreate() {
    const company: Omit<Company, "id"> = {
      name: name.trim(),
      email: email.trim(),
      tier: plan === "subscription" ? tier : plan === "complimentary" ? "Complimentary Access" : "Free Trial",
      seats: seatCount,
      industry: industries.join(", "),
      partnership: partnerships.join(", "),
      taxStatus,
      address: address.trim() || undefined,
      contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      // Preserve a Paused subscription on edit instead of silently reactivating it.
      status: plan === "free-trial"
        ? "Free Trial"
        : plan === "complimentary"
        ? "Complimentary"
        : isEdit && editBilling?.status === "Paused"
        ? "Paused"
        : "Active",
      ...(isSubscription
        ? {
            billingCycle,
            currency,
            payment,
            ratePerSeat: effectiveRate,
          }
        : {}),
    };
    if (isEdit && editCompany) {
      onSave?.({ ...company, id: editCompany.id });
    } else {
      onCreate?.(company);
    }
    setCreatedCompany(company);
  }

  if (createdCompany) {
    return (
      <SuccessScreen
        company={createdCompany}
        plan={plan}
        tier={isSubscription ? tier : undefined}
        isEdit={isEdit}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="wizard cw-wizard">
      <div className="cw-topbar">
        <div className="wizard-breadcrumb" style={{ margin: 0 }}>
          <button className="wizard-back-btn" onClick={onClose}>
            <ChevronLeftIcon />
            BACK
          </button>
          <span className="sep">/</span>
          <span className="wizard-current">{isEdit ? "EDIT COMPANY" : "NEW COMPANY"}</span>
        </div>
      </div>

      <div className="cw-split">
        <div className="cw-form-col">
          <Step1Details
            name={name} setName={setName}
            taxStatus={taxStatus} setTaxStatus={setTaxStatus}
            address={address} setAddress={setAddress}
            contactName={contactName} setContactName={setContactName}
            email={email} setEmail={setEmail}
            phone={phone} setPhone={setPhone}
            industries={industries} setIndustries={setIndustries}
            partnerships={partnerships} setPartnerships={setPartnerships}
          />

          <div className="form-divider" style={{ margin: "32px 0" }} />

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
            hideSummary
          />
        </div>

        <BillingImpact
          plan={plan}
          tier={tier}
          billingCycle={billingCycle}
          currency={currency}
          payment={payment}
          effectiveRate={effectiveRate}
          seatCount={seatCount}
          monthlyTotal={monthlyTotal}
          sym={sym}
          isEdit={isEdit}
          currentSub={currentSub}
          canSave={canSave}
          saveHint={saveHint}
          onSave={handleCreate}
          onCancel={onClose}
        />
      </div>

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
  effectiveText: string;
  nextInvoiceStr: string;
  bullets: string[];
  applyLabel: string;
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

  // ── Charge + reason + bullets ──
  let chargeNow = 0;
  let chargeReason = "";
  let bullets: string[] = [];
  const effectiveText = immediate ? "Immediately" : `At cycle end · ${renew}`;
  const nextInvoiceStr = `${totalDisplay(newTotal, tgt.cycle, newSym)} · ${renew}`;

  if (!billingChanged && paymentChanged) {
    chargeReason = "Only how invoices are collected changes. Nothing is prorated or charged now.";
    bullets = [
      `Collection method switches to ${tgt.payment === "Automatic" ? "automatic — Stripe charges the card / ACH each period" : "manual — Stripe issues an invoice each period"}.`,
      "No change to tier, cycle, or price. No proration.",
    ];
  } else if (immediate) {
    chargeNow = Math.max(0, newTotal - oldTotalInTgt) * frac;
    if (chargeNow > 0.005) {
      chargeReason = `+${money(newTotal - oldTotalInTgt, newSym)} / mo · prorated for the ${daysLeft} of ${cycleDays} days left in this cycle.`;
      bullets = [
        `Subscription items are updated to ${money(tgt.rate, newSym)} / seat immediately${dir !== 0 ? ` (${tgt.tier} tier)` : ""}.`,
        `A prorated invoice for ${money(chargeNow, newSym)} is created and charged to the card on file now.`,
        `The next renewal on ${renew} bills ${totalDisplay(newTotal, tgt.cycle, newSym)} at the new rate.`,
      ];
    } else {
      // Applies now but there is nothing to prorate: equal total, currency
      // redenomination, or a cycle switch that does not raise the recurring total.
      chargeReason = currencyChanged
        ? `Billing currency changes to ${tgt.currency}. Amounts are redenominated, not increased — no proration is charged now.`
        : "No increase to the recurring total — no proration is charged now.";
      bullets = [
        `Subscription items are updated immediately${dir !== 0 ? ` (${tgt.tier} tier)` : ""}.`,
        "No prorated charge is created now.",
        `The next renewal on ${renew} bills ${totalDisplay(newTotal, tgt.cycle, newSym)}.`,
      ];
    }
    if (cycleChanged) {
      bullets.unshift(toAnnual ? "Billing switches to a yearly cycle." : "Billing switches to a monthly cycle.");
    }
  } else {
    // Scheduled for cycle end — no proration or refund now.
    chargeReason = "No prorations or refunds. The company stays on the current plan until the cycle ends, then moves to the new plan.";
    bullets = [
      "The change is scheduled for cycle end via a subscription schedule.",
      "No prorations or refunds are applied now.",
      `The next bill on ${renew} reflects the new plan (${totalDisplay(newTotal, tgt.cycle, newSym)}).`,
    ];
  }

  if (paymentChanged && billingChanged) {
    bullets = bullets.concat([
      `Collection method switches to ${tgt.payment === "Automatic" ? "automatic billing" : "manual invoicing"}.`,
    ]);
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

  return {
    anyChange, label, channel, immediate, prorationParam, rows,
    chargeNow, chargeStr: money(chargeNow, newSym), chargeReason,
    effectiveText, nextInvoiceStr, bullets, applyLabel,
  };
}

function BillingImpact({
  plan, tier, billingCycle, currency, payment, effectiveRate, seatCount, monthlyTotal, sym,
  isEdit, currentSub, canSave, saveHint, onSave, onCancel,
}: {
  plan: Plan;
  tier: PaidTier;
  billingCycle: BillingCycle;
  currency: Currency;
  payment: PaymentCollection;
  effectiveRate: number;
  seatCount: number;
  monthlyTotal: number;
  sym: string;
  isEdit: boolean;
  currentSub: CurrentSub | null;
  canSave: boolean;
  saveHint: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  // Editing a running paid subscription → show the change preview (diff + proration).
  const change =
    currentSub && plan === "subscription"
      ? computeChange(currentSub, {
          tier, cycle: billingCycle, rate: effectiveRate, seats: seatCount, payment, currency,
        })
      : null;

  // Editing a paid sub but switching the plan type away from subscription.
  const planTypeChange =
    currentSub && plan !== "subscription"
      ? {
          target: plan === "free-trial" ? "Free Trial" : "Complimentary Access",
          renew: currentSub.nextBillingDate,
        }
      : null;

  let cardBody: React.ReactNode;
  let cta: string;

  if (change) {
    cardBody = <ChangeCard change={change} />;
    cta = change.applyLabel;
  } else if (planTypeChange) {
    cta = "Schedule change";
    cardBody = (
      <>
        <div className="cw-impact-head">Billing impact</div>
        <div className="cw-chg-badge cw-chg-badge--scheduled">
          <span className="cw-chg-badge-dot" />
          Plan change
          <span className="cw-chg-channel">CS</span>
        </div>
        <div className="cw-chg-rows">
          <div className="cw-chg-row">
            <span className="cw-chg-row-label">Plan</span>
            <span className="cw-chg-row-val">
              <span className="cw-chg-old">{currentSub!.tier} subscription</span>
              <span className="cw-chg-arrow">→</span>
              <span className="cw-chg-new">{planTypeChange.target}</span>
            </span>
          </div>
        </div>
        <div className="cw-impact-callout cw-impact-callout--scheduled">
          <div className="cw-impact-callout-title">Scheduled — no charge now</div>
          <div className="cw-impact-callout-amt">At cycle end · {planTypeChange.renew}</div>
          <div className="cw-impact-callout-desc">
            The current subscription stays active until the cycle ends, then converts. No proration or refund is applied now.
          </div>
          <div className="cw-chg-param">subscription schedule · proration_behavior = none</div>
        </div>
        <div className="cw-impact-bullets-label">What happens on save</div>
        <ul className="cw-impact-bullets">
          <li>The current subscription is scheduled to end at the cycle end.</li>
          <li>
            {plan === "free-trial"
              ? "Switches to a free trial — no charge."
              : "Switches to complimentary access — no charge."}
          </li>
          <li>No proration or refund is applied now.</li>
        </ul>
      </>
    );
  } else {
    cardBody = (
      <OnSaveCard
        plan={plan}
        tier={tier}
        billingCycle={billingCycle}
        payment={payment}
        effectiveRate={effectiveRate}
        seatCount={seatCount}
        monthlyTotal={monthlyTotal}
        sym={sym}
      />
    );
    cta = isEdit ? "Save changes" : "Create company";
  }

  return (
    <aside className="cw-impact">
      <div className="cw-impact-card">{cardBody}</div>

      <div className="cw-impact-actions">
        <button className="btn-publish cw-impact-cta" disabled={!canSave} onClick={onSave}>
          {cta}
        </button>
        <button className="wizard-cancel cw-impact-cancel" onClick={onCancel}>Cancel</button>
        {!canSave && saveHint && (
          <div className="cw-impact-hint">{saveHint}</div>
        )}
      </div>
    </aside>
  );
}

function ChangeCard({ change }: { change: ChangePreview }) {
  if (!change.anyChange) {
    return (
      <>
        <div className="cw-impact-head">Billing impact</div>
        <div className="cw-chg-empty">
          <div className="cw-chg-empty-title">No billing changes</div>
          <div className="cw-chg-empty-sub">Change the tier, cycle, rate, seats, or payment method to preview the impact.</div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="cw-impact-head">Billing impact</div>

      <div className={`cw-chg-badge cw-chg-badge--${change.immediate ? "immediate" : "scheduled"}`}>
        <span className="cw-chg-badge-dot" />
        {change.label}
        <span className="cw-chg-channel">{change.channel}</span>
      </div>

      <div className="cw-chg-rows">
        {change.rows.map((r) => (
          <div className="cw-chg-row" key={r.label}>
            <span className="cw-chg-row-label">{r.label}</span>
            <span className="cw-chg-row-val">
              <span className="cw-chg-old">{r.oldStr}</span>
              <span className="cw-chg-arrow">→</span>
              <span className="cw-chg-new">{r.newStr}</span>
            </span>
          </div>
        ))}
      </div>

      {change.immediate ? (
        <div className={`cw-impact-callout cw-impact-callout--${change.chargeNow > 0 ? "charge" : "scheduled"}`}>
          <div className="cw-impact-callout-title">{change.chargeNow > 0 ? "Charged now — prorated" : "Applies now — no charge"}</div>
          {change.chargeNow > 0 && <div className="cw-impact-callout-amt cw-chg-amount">{change.chargeStr}</div>}
          <div className="cw-impact-callout-desc">{change.chargeReason}</div>
          <div className="cw-chg-param">{change.prorationParam}</div>
        </div>
      ) : (
        <div className="cw-impact-callout cw-impact-callout--scheduled">
          <div className="cw-impact-callout-title">Scheduled — no charge now</div>
          <div className="cw-impact-callout-amt">{change.effectiveText}</div>
          <div className="cw-impact-callout-desc">{change.chargeReason}</div>
          <div className="cw-chg-param">{change.prorationParam}</div>
        </div>
      )}

      <div className="cw-impact-nextinvoice">
        <span>Next invoice</span>
        <span className="cw-impact-nextinvoice-val">{change.nextInvoiceStr}</span>
      </div>

      <div className="cw-impact-bullets-label">What Stripe does</div>
      <ul className="cw-impact-bullets">
        {change.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </>
  );
}

function OnSaveCard({
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
}) {
  const isSubscription = plan === "subscription";
  const cycleLabel = billingCycle === "Annual" ? "Yearly" : "Monthly";
  const planLabel =
    plan === "free-trial" ? "Free Trial" : plan === "complimentary" ? "Complimentary Access" : "Subscription";

  let tone: "neutral" | "good" | "charge" = "neutral";
  let calloutTitle = "";
  let calloutAmount: string | null = null;
  let calloutDesc = "";
  let bullets: string[] = [];

  if (plan === "free-trial") {
    tone = "neutral";
    calloutTitle = "No charge now";
    calloutDesc = "No payment method required. Converts to a paid subscription at the end of the trial window.";
    bullets = [
      "No Stripe subscription is created yet.",
      "Trial runs for the globally configured window.",
      "Converts to paid automatically when the trial ends.",
    ];
  } else if (plan === "complimentary") {
    tone = "good";
    calloutTitle = "No charge";
    calloutDesc = "Admin-granted free access. No Stripe subscription or invoice is created.";
    bullets = [
      "No Stripe subscription or invoice is created.",
      "Full Pro access continues until it is manually revoked.",
    ];
  } else if (payment === "Automatic") {
    tone = "charge";
    calloutTitle = "Payment link generated";
    calloutAmount = `${sym}${monthlyTotal.toLocaleString()} / mo`;
    calloutDesc = "A Stripe subscription is created. Share the payment link to collect the card or ACH.";
    bullets = [
      `Creates a Stripe subscription for ${tier}.`,
      "Generates a payment link for the account holder.",
      "Card / ACH is charged on each billing date.",
    ];
  } else {
    tone = "charge";
    calloutTitle = "Invoice on save";
    calloutAmount = `${sym}${monthlyTotal.toLocaleString()}`;
    calloutDesc = "Stripe issues an invoice payable within the configured payment window.";
    bullets = [
      `Creates a Stripe subscription for ${tier}.`,
      `Issues an invoice for ${sym}${monthlyTotal.toLocaleString()}.`,
      "Marked paid when payment is received within the window.",
    ];
  }

  const nextInvoice = billingCycle === "Annual"
    ? `${sym}${(monthlyTotal * 12).toLocaleString()} / yr`
    : `${sym}${monthlyTotal.toLocaleString()} / mo`;

  const row = (label: string, value: React.ReactNode) => (
    <div className="cw-impact-row">
      <span className="cw-impact-row-label">{label}</span>
      <span className="cw-impact-row-value">{value}</span>
    </div>
  );

  return (
    <>
      <div className="cw-impact-head">Billing impact</div>

      <div className="cw-impact-rows">
        {row("Plan", planLabel)}
        {isSubscription && row("Tier", tier)}
        {isSubscription && row("Cycle", cycleLabel)}
        {isSubscription && row("Per seat", `${sym}${effectiveRate} / mo`)}
        {isSubscription && row("Seats", seatCount.toLocaleString())}
      </div>

      {isSubscription && (
        <div className="cw-impact-total">
          <span>Total</span>
          <span className="cw-impact-total-val">
            {sym}{monthlyTotal.toLocaleString()}<small> / mo</small>
          </span>
        </div>
      )}

      <div className={`cw-impact-callout cw-impact-callout--${tone}`}>
        <div className="cw-impact-callout-title">{calloutTitle}</div>
        {calloutAmount && <div className="cw-impact-callout-amt">{calloutAmount}</div>}
        <div className="cw-impact-callout-desc">{calloutDesc}</div>
      </div>

      {isSubscription && (
        <div className="cw-impact-nextinvoice">
          <span>Next invoice</span>
          <span className="cw-impact-nextinvoice-val">{nextInvoice}</span>
        </div>
      )}

      <div className="cw-impact-bullets-label">What happens on save</div>
      <ul className="cw-impact-bullets">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </>
  );
}

/* ─────────────── Step 1 — Company details ─────────────── */

function Step1Details({
  name, setName,
  taxStatus, setTaxStatus,
  address, setAddress,
  contactName, setContactName,
  email, setEmail,
  phone, setPhone,
  industries, setIndustries,
  partnerships, setPartnerships,
}: {
  name: string; setName: (v: string) => void;
  taxStatus: TaxStatus; setTaxStatus: (v: TaxStatus) => void;
  address: string; setAddress: (v: string) => void;
  contactName: string; setContactName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  industries: string[]; setIndustries: (v: string[]) => void;
  partnerships: string[]; setPartnerships: (v: string[]) => void;
}) {
  return (
    <>
      <h1 className="wizard-title">Company details</h1>
      <p className="wizard-desc">
        Identify the company and its primary contact. Industry and partnership are used for
        segmentation and reporting.
      </p>

      <div className="form-group">
        <label className="form-label">Company name <span className="req">*</span></label>
        <input
          autoFocus
          className="form-input"
          placeholder="e.g. Apex HVAC Solutions"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Tax status</label>
        <div className="tab-switch">
          {TAX_STATUSES.map((t) => (
            <button
              key={t}
              type="button"
              className={`tab-switch-tab ${taxStatus === t ? "active" : ""}`}
              onClick={() => setTaxStatus(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="form-help">
          Controls how tax is applied on Stripe invoices for this company.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Address</label>
        <input
          className="form-input"
          placeholder="123 Main St, City, State, ZIP"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div className="form-divider" />

      <div className="form-row-2">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Account Holder <span className="req">*</span></label>
          <input
            className="form-input"
            placeholder="e.g. Jane Smith"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Phone number</label>
          <input
            className="form-input"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 24 }}>
        <label className="form-label">Email <span className="req">*</span></label>
        <input
          className="form-input"
          type="email"
          placeholder="admin@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="form-help">Becomes the Stripe billing email and the company's first Admin account.</p>
      </div>

      <div className="form-divider" />

      <div className="form-row-2">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Industry</label>
          <MultiSelect
            options={INDUSTRY_OPTIONS}
            value={industries}
            onChange={setIndustries}
            placeholder="Select industries…"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Partnership <span className="co-w-note">(optional)</span></label>
          <MultiSelect
            options={PARTNERSHIP_OPTIONS}
            value={partnerships}
            onChange={setPartnerships}
            placeholder="Select partnerships…"
          />
        </div>
      </div>
    </>
  );
}

/* ─────────────── Step 2 — Plan selection ─────────────── */

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
  hideSummary?: boolean;
}) {
  const isSubscription = plan === "subscription";

  return (
    <>
      <h1 className="wizard-title">Plan selection</h1>
      <p className="wizard-desc">Choose the access plan. Subscription plans require billing configuration.</p>

      <div className="form-group">
        <label className="form-label">Plan</label>
        <div className="radio-card-group">
          <RadioCard
            selected={plan === "free-trial"}
            onSelect={() => setPlan("free-trial")}
            disabled={trialExpired}
            title="Free Trial"
            desc={
              trialExpired
                ? "Unavailable — this company's trial has already expired. Convert to a Subscription or grant Complimentary Access."
                : "No payment method required. Limited access for the configured trial window, then converts to paid."
            }
          />
          <RadioCard
            selected={plan === "subscription"}
            onSelect={() => setPlan("subscription")}
            title="Subscription"
            desc="Paid plan. Choose a tier, billing cycle, and rate. Stripe subscription is created on save."
          />
          <RadioCard
            selected={plan === "complimentary"}
            onSelect={() => setPlan("complimentary")}
            title="Complimentary Access"
            desc="Admin-granted free access. No Stripe subscription is created."
          />
        </div>
      </div>

      {isSubscription && (
        <>
          <div className="form-divider" />

          <div className="form-group">
            <label className="form-label">Tier</label>
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
            <label className="form-label">Billing cycle</label>
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
            <label className="form-label">Per-seat price</label>
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
            <label className="form-label">Seats</label>
            <input
              className="form-input"
              style={{ maxWidth: 160 }}
              type="number"
              min={0}
              placeholder="0"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
            <p className="form-help">Every seat is paid, including empty seats. Seats can be reassigned at no charge.</p>
          </div>

          <div className="form-divider" />

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Payment method</label>
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
        <div className="co-plan-note" style={{ marginTop: 8 }}>
          <strong>Free access granted.</strong> No subscription is created in Stripe. Eligible only
          for companies without an active or paused subscription.
        </div>
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

  function pick(p: SavedPrice) {
    setPriceStr(String(rateOf(p)));
    setPriceOpen(false);
  }

  return (
    <div className="cw-price" ref={wrapRef}>
      <div className={`cw-price-field${priceOpen || currencyOpen ? " is-open" : ""}`}>
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

        <span className="cw-price-unit">/ seat / mo</span>

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
          <div className="cw-price-note cw-price-note--custom">
            <span className="cw-price-note-mark">✎</span>
            <span className="cw-price-note-lead">Custom price — not saved on Stripe:</span>
            <span className="cw-price-note-label">{sym}{entered} / seat / mo</span>
          </div>
        )
      )}

      <p className="form-help" style={{ marginTop: 8 }}>
        Default for {tier} {billingCycle === "Annual" ? "Yearly" : "Monthly"} is {sym}{baseRate} / seat / month.
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

function SuccessScreen({
  company, plan, tier, isEdit = false, onClose,
}: {
  company: Omit<Company, "id">; plan: Plan; tier?: PaidTier; isEdit?: boolean; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isSubscription = plan === "subscription";
  const isAutomatic = company.payment === "Automatic";
  const sym = company.currency ? CURRENCY_SYMBOL[company.currency as Currency] : "$";
  // No new Stripe payment link on edits — billing changes are handled in Stripe.
  const stripeLink = !isEdit && isSubscription && isAutomatic ? fakeStripeLink(company.email, company.name) : null;

  function copy() {
    if (!stripeLink) return;
    navigator.clipboard.writeText(stripeLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const detail = (label: string, value: React.ReactNode) => (
    <div className="success-detail-row">
      <span className="success-detail-label">{label}</span>
      <span className="success-detail-value">{value}</span>
    </div>
  );

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
            {detail("Company", company.name)}
            {company.address && detail("Address", company.address)}
            {company.contactName && detail("Account Holder", company.contactName)}
            {detail("Email", company.email)}
            {company.phone && detail("Phone", company.phone)}
            {company.industry && detail("Industry", company.industry)}
            {company.partnership && detail("Partnership", company.partnership)}
            {company.taxStatus && detail("Tax status", company.taxStatus)}
            <div className="success-divider" />
            {detail("Plan", plan === "free-trial" ? "Free Trial" : plan === "complimentary" ? "Complimentary Access" : "Subscription")}
            {isSubscription && tier && detail("Tier", tier)}
            {isSubscription && detail("Billing cycle", company.billingCycle === "Annual" ? "Yearly" : "Monthly")}
            {isSubscription && detail("Currency", company.currency ?? "USD")}
            {isSubscription && detail("Per-seat rate", `${sym}${company.ratePerSeat} / month`)}
            {isSubscription && detail("Seats", String(company.seats))}
            {isSubscription && detail("Payment method", company.payment === "Automatic" ? "Automatic" : "Manual (invoice)")}
            {isSubscription && detail("Est. monthly total", `${sym}${((company.ratePerSeat ?? 0) * company.seats).toLocaleString()}`)}
          </div>

          {stripeLink && (
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
          )}
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

function MultiSelect({
  options, value, onChange, placeholder,
}: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }

  return (
    <div className="multiselect" ref={ref}>
      <div className="multiselect-field" onClick={() => setOpen(!open)}>
        {value.length === 0 ? (
          <span className="multiselect-placeholder">{placeholder}</span>
        ) : (
          <div className="multiselect-tags">
            {value.map((v) => (
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
          </div>
        )}
        <span className="multiselect-chevron">▾</span>
      </div>
      {open && (
        <div className="multiselect-dropdown">
          {options.map((opt) => {
            const selected = value.includes(opt);
            return (
              <button
                key={opt}
                className={`multiselect-opt${selected ? " is-selected" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); toggle(opt); }}
              >
                <span className="multiselect-check">{selected ? <CheckBoldIcon /> : null}</span>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
