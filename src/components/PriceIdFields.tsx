// Paywall pricing is configured by Price ID, never a raw USD amount. Every paid
// paywall entry — a Certification, or a single Quiz attempt — maps to four
// store / processor products, so we collect four Price IDs per entry:
//   • Google      — Play Store product ID (B2C)
//   • Apple       — App Store product ID (B2C)
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

export const PRICE_CHANNELS: {
  key: PriceChannel;
  label: string;
  placeholder: string;
}[] = [
  { key: "googleB2c", label: "Google",        placeholder: "com.skillcat.product.id" },
  { key: "appleB2c",  label: "Apple",         placeholder: "com.skillcat.product.id" },
  { key: "stripeB2c", label: "Stripe (B2C)",  placeholder: "price_xxxxxxxxxxxxxxxxxxxxxxxx" },
  { key: "stripeB2b", label: "Stripe (B2B)",  placeholder: "price_xxxxxxxxxxxxxxxxxxxxxxxx" },
];

// Four labelled Price ID inputs — one paywall entry's worth of products. Laid
// out as a 2×2 grid (Google / Apple on top, Stripe B2C / Stripe B2B below).
export function PriceIdFields({
  value,
  onChange,
}: {
  value: PriceIds;
  onChange: (ids: PriceIds) => void;
}) {
  return (
    <div className="price-id-fields">
      {PRICE_CHANNELS.map((ch) => (
        <div key={ch.key} className="price-id-field">
          <label className="price-id-label">{ch.label}</label>
          <input
            className="form-input price-id-input"
            placeholder={ch.placeholder}
            value={value[ch.key]}
            onChange={(e) => onChange({ ...value, [ch.key]: e.target.value })}
            spellCheck={false}
          />
        </div>
      ))}
    </div>
  );
}
