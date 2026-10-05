import { useState } from "react";
import { SelectField } from "./SelectField";
import { DropdownCaretIcon } from "./icons";
import {
  COUNTRIES,
  DEFAULT_PHONE_COUNTRY,
  dialCodeFor,
  dialLabelFor,
  findPhoneCountry,
} from "../data/countries";

/* The phone field from B2B Company Create (Admin Account step) — a dial-code
   picker beside an auto-formatting number — shared with Edit User. */

// Strip everything but digits, then group in the app's bracket format,
// (XXX) XXX-XXXX… — what every stored phone reads like (the user, 2026-10-04).
// The brackets only appear once a 4th digit does, so backspacing never gets
// stuck re-adding a ") " the user just deleted. Non-digits are dropped.
function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Dial-code select + auto-formatting number field. The composed value stored in
// `phone` is "<dial> <formatted>" (e.g. "+1 (555) 123-4567").
export function PhoneField({
  phone,
  setPhone,
  invalid,
}: {
  phone: string;
  setPhone: (v: string) => void;
  /** Paints the number input in the field error state. */
  invalid?: boolean;
}) {
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
        className={`form-input${invalid ? " has-error" : ""}`}
        type="tel"
        aria-invalid={invalid || undefined}
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
