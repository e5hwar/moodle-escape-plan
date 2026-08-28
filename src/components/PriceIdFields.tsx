import { useId } from "react";
import { SmallXIcon, StepperPlusIcon } from "./icons";

// Paywall pricing is configured by Price ID, never a raw USD amount. Every paid
// paywall entry — a Certification, or a single Quiz attempt — maps to four
// store / processor products, so we collect four Price IDs per entry:
//   • Apple       — App Store product ID (B2C)
//   • Google      — Play Store product ID (B2C)
//   • Stripe B2C  — Stripe Price ID for individual learners
//   • Stripe B2B  — Stripe Price ID for companies
export type PriceChannel = "googleB2c" | "appleB2c" | "stripeB2c" | "stripeB2b";

export type PriceIds = Record<PriceChannel, string>;

export const EMPTY_PRICE_IDS: PriceIds = {
  googleB2c: "",
  appleB2c: "",
  stripeB2c: "",
  stripeB2b: "",
};

// A fresh, independent copy. Callers store these in component state and mutate
// per-field, so they must not share the EMPTY_PRICE_IDS reference.
export const newPriceIds = (): PriceIds => ({ ...EMPTY_PRICE_IDS });

/* Row order and copy are Figma 748:1593 / 752:2816 — Apple leads, and the two
   Stripe rows wrap their audience onto a second line. The stores issue Product
   IDs while Stripe issues Price IDs, so the two halves are named differently. */
export const PRICE_CHANNELS: {
  key: PriceChannel;
  /** One entry per line: the Stripe rows are two-line labels. */
  label: string[];
  /** Field name. Placeholders are this plus an ellipsis. */
  name: string;
}[] = [
  { key: "appleB2c",  label: ["Apple"],           name: "Apple Product ID" },
  { key: "googleB2c", label: ["Google"],          name: "Google Product ID" },
  { key: "stripeB2c", label: ["Stripe", "(B2C)"], name: "Stripe (B2C) Price ID" },
  { key: "stripeB2b", label: ["Stripe", "(B2B)"], name: "Stripe (B2B) Price ID" },
];

export type PriceIdColumnSpec = {
  key: string;
  title: string;
  value: PriceIds;
  onChange: (ids: PriceIds) => void;
  onRemove?: () => void;
};

/* Multi-price paywall grid (Figma 752:2816 "Paywall - Multiple Prices"): one
   tinted card holding a shared platform-label column, a column of Price ID
   inputs per paywall entry (Attempt 1, …, All Subsequent Attempts), and a
   dashed Add tile on the right. The label column repeats the heading row as
   invisible text so its 45px rows stay level with the input columns'. */
export function PriceIdMatrix({
  columns,
  onAdd,
  addLabel = "Add Attempt Price",
}: {
  columns: PriceIdColumnSpec[];
  onAdd: () => void;
  addLabel?: string;
}) {
  return (
    <div className="price-id-matrix">
      <div className="price-idm-labels" aria-hidden="true">
        <div className="price-idm-head price-idm-ghost">Platform</div>
        {PRICE_CHANNELS.map((ch) => (
          <div key={ch.key} className="price-idm-label">
            {ch.label.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="price-idm-cols">
        {columns.map((col) => (
          <div key={col.key} className="price-idm-col">
            <div className="price-idm-head">
              <span>{col.title}</span>
              {col.onRemove && (
                <button
                  className="price-idm-x"
                  aria-label={`Remove ${col.title} prices`}
                  onClick={col.onRemove}
                >
                  <SmallXIcon />
                </button>
              )}
            </div>
            {PRICE_CHANNELS.map((ch) => (
              <input
                key={ch.key}
                className="form-input"
                /* Every column shows the same placeholder, so the column's own
                   heading has to carry into the accessible name. */
                placeholder={`${ch.name}...`}
                aria-label={`${ch.name} for ${col.title}`}
                value={col.value[ch.key]}
                onChange={(e) => col.onChange({ ...col.value, [ch.key]: e.target.value })}
                spellCheck={false}
              />
            ))}
          </div>
        ))}
      </div>
      <button className="price-idm-add" onClick={onAdd}>
        <StepperPlusIcon />
        <span>{addLabel}</span>
      </button>
    </div>
  );
}

/* Four labelled Price ID inputs — one paywall entry's worth of products
   (Figma 748:1593 "Paywall - Certification"): a tinted 12px card holding a
   label column beside a column of standard text inputs, 12px between rows.
   One grid rather than two stacked columns, so each label still belongs to its
   own input. */
export function PriceIdFields({
  value,
  onChange,
}: {
  value: PriceIds;
  onChange: (ids: PriceIds) => void;
}) {
  // Several of these sit on the Quiz wizard's payments step (one per attempt),
  // so the label/input pairing needs ids unique to this instance.
  const uid = useId();

  return (
    <div className="price-id-fields">
      {PRICE_CHANNELS.map((ch) => {
        const id = `${uid}-${ch.key}`;
        return (
          <div key={ch.key} className="price-id-row">
            <label className="price-id-label" htmlFor={id}>
              {ch.label.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </label>
            <input
              id={id}
              className="form-input price-id-input"
              placeholder={`${ch.name}...`}
              value={value[ch.key]}
              onChange={(e) => onChange({ ...value, [ch.key]: e.target.value })}
              spellCheck={false}
            />
          </div>
        );
      })}
    </div>
  );
}
