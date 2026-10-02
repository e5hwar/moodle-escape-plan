/**
 * Postal-code shapes for the company address block's Zipcode check.
 *
 * Keyed by the country NAME, because that is what the address Country select
 * stores. Most countries use a fixed run of digits, so they are written as a
 * digit count and checked with spaces and hyphens ignored ("12 345", "00-950"
 * and "1000-001" all count their digits). The few alphanumeric formats (Canada,
 * the UK, the Netherlands, Ireland…) carry their own pattern and an example.
 *
 * A country missing from the table is not checked beyond being non-empty —
 * guessing a format for it would block a real address.
 */

type PostalRule =
  /** A fixed number of digits; `alt` allows a second length (US ZIP+4). */
  | { digits: number; alt?: number }
  /** Anything else: the full pattern, and an example for the error copy. */
  | { pattern: RegExp; example: string };

const RULES: Record<string, PostalRule> = {
  "United States": { digits: 5, alt: 9 },
  Canada: { pattern: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i, example: "A1A 1A1" },
  "United Kingdom": { pattern: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, example: "SW1A 1AA" },
  Netherlands: { pattern: /^\d{4} ?[A-Z]{2}$/i, example: "1234 AB" },
  Ireland: { pattern: /^[A-Z]\d[\dW] ?[A-Z\d]{4}$/i, example: "D02 X285" },
  Argentina: { pattern: /^([A-Z]\d{4}[A-Z]{3}|\d{4})$/i, example: "C1425ABC" },
  Latvia: { pattern: /^(LV-?)?\d{4}$/i, example: "LV-1050" },
  Lithuania: { pattern: /^(LT-?)?\d{5}$/i, example: "LT-01100" },

  Australia: { digits: 4 },
  Austria: { digits: 4 },
  Bangladesh: { digits: 4 },
  Belgium: { digits: 4 },
  Brazil: { digits: 8 },
  Bulgaria: { digits: 4 },
  Chile: { digits: 7 },
  China: { digits: 6 },
  Colombia: { digits: 6 },
  Croatia: { digits: 5 },
  Czechia: { digits: 5 },
  Denmark: { digits: 4 },
  Egypt: { digits: 5 },
  Estonia: { digits: 5 },
  Finland: { digits: 5 },
  France: { digits: 5 },
  Germany: { digits: 5 },
  Greece: { digits: 5 },
  Hungary: { digits: 4 },
  Iceland: { digits: 3 },
  India: { digits: 6 },
  Indonesia: { digits: 5 },
  Israel: { digits: 7 },
  Italy: { digits: 5 },
  Japan: { digits: 7 },
  Kenya: { digits: 5 },
  Luxembourg: { digits: 4 },
  Malaysia: { digits: 5 },
  Mexico: { digits: 5 },
  "New Zealand": { digits: 4 },
  Nigeria: { digits: 6 },
  Norway: { digits: 4 },
  Pakistan: { digits: 5 },
  Philippines: { digits: 4 },
  Poland: { digits: 5 },
  Portugal: { digits: 7 },
  Romania: { digits: 6 },
  Russia: { digits: 6 },
  "Saudi Arabia": { digits: 5 },
  Singapore: { digits: 6 },
  Slovakia: { digits: 5 },
  Slovenia: { digits: 4 },
  "South Africa": { digits: 4 },
  "South Korea": { digits: 5 },
  Spain: { digits: 5 },
  Sweden: { digits: 5 },
  Switzerland: { digits: 4 },
  Thailand: { digits: 5 },
  Türkiye: { digits: 5 },
  Ukraine: { digits: 5 },
  Vietnam: { digits: 6 },
};

/* Countries with no postal-code system — the Zipcode is optional there, since
 * an address in Doha or Kampala has no code to type. Names as the Country
 * select spells them. */
const NO_POSTAL_CODE = new Set([
  "Angola", "Antigua and Barbuda", "Bahamas", "Belize", "Benin", "Bolivia",
  "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Central African Republic",
  "Chad", "Comoros", "Congo (Brazzaville)", "Congo (Kinshasa)", "Côte d'Ivoire",
  "Djibouti", "Dominica", "Equatorial Guinea", "Eritrea", "Fiji", "Gambia",
  "Ghana", "Grenada", "Guyana", "Kiribati", "Libya", "Malawi", "Mali",
  "Mauritania", "Nauru", "North Korea", "Qatar", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "São Tomé and Príncipe", "Seychelles",
  "Sierra Leone", "Solomon Islands", "Suriname", "Syria", "Timor-Leste", "Togo",
  "Tonga", "Tuvalu", "Uganda", "United Arab Emirates", "Vanuatu", "Yemen",
  "Zimbabwe",
]);

/** Whether the address needs a Zipcode — false for countries without one. */
export function zipRequired(country: string): boolean {
  return !NO_POSTAL_CODE.has(country);
}

/** Why `zip` doesn't fit `country`'s postal format ("Zipcode must be 5
 *  digits"), or null when it fits — or when the country has no rule here. An
 *  empty value is null too: "cannot be left empty" is the caller's own check. */
export function zipFormatError(zip: string, country: string): string | null {
  const v = zip.trim();
  const rule = RULES[country];
  if (!v || !rule) return null;
  if ("pattern" in rule) {
    return rule.pattern.test(v) ? null : `Zipcode must look like ${rule.example}`;
  }
  const digits = v.replace(/[\s-]/g, "");
  const ok = /^\d+$/.test(digits) && (digits.length === rule.digits || digits.length === rule.alt);
  if (ok) return null;
  return rule.alt
    ? `Zipcode must be ${rule.digits} or ${rule.alt} digits`
    : `Zipcode must be ${rule.digits} digits`;
}
