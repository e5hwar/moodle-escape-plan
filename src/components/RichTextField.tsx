import { AutoTextarea } from "./AutoTextarea";
import { CharCount } from "./CharCount";
import { RteToolbar } from "./RteToolbar";

/* Rich Text Input — Figma 327:137 "Dual Language - Focus State" (single
   language sibling: 620:1352). At rest the field reads as a plain text field:
   border, radius, language rows, no editor chrome. The toolbar strip sits
   along the BOTTOM edge and is revealed by CSS alone while the caret is
   inside (`.rte-field:not(:focus-within) .rte-toolbar`), so no focus state is
   tracked here — toolbar controls preventDefault their mousedown, which keeps
   the textarea focused while they're used.

   Height variants come from `minRows`/`maxRows`, which pass straight through
   to {@link AutoTextarea} — 1 line at rest by default, 2 and 4 for the taller
   Figma variants.

   Every rich-text consumer imports this one — don't re-declare a per-wizard
   copy. */
export function RichTextField({
  en,
  es,
  onChangeEn,
  onChangeEs,
  placeholderEn,
  placeholderEs,
  disabled,
  error,
  maxLength,
  minRows,
  maxRows,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
  disabled?: boolean;
  /** Mandatory and still empty after a blocked save — reddens the shell, the
   * same flag `.lang-field` / `.form-input` carry. */
  error?: boolean;
  /** Resting height of each language row, in lines. Defaults to the 1-line
   * variant; pass 2 or 4 for the taller Figma variants. */
  minRows?: number;
  /** Line count the row grows to before it holds and scrolls (default 4). */
  maxRows?: number;
  /** A SOFT character limit per language (Figma 1376:1599): each row shows
   *  the characters left at its bottom-right corner, and running past the
   *  limit flags the shell like `error` does — the caller names the limit in
   *  the label row. */
  maxLength?: number;
}) {
  const over = maxLength !== undefined && Math.max(en.length, es.length) > maxLength;
  return (
    <div
      className={`rte-field${disabled ? " is-disabled" : ""}${
        error || over ? " has-error" : ""
      }`}
    >
      <div className="rte-lang-row">
        <span className="lang-tag">EN</span>
        <AutoTextarea
          className="rte-area"
          value={en}
          placeholder={placeholderEn}
          onChange={onChangeEn}
          disabled={disabled}
          minRows={minRows}
          maxRows={maxRows}
        />
        {maxLength !== undefined && <CharCount value={en} max={maxLength} />}
      </div>
      <div className="rte-field-divider" />
      <div className="rte-lang-row">
        <span className="lang-tag">ES</span>
        <AutoTextarea
          className="rte-area"
          value={es}
          placeholder={placeholderEs}
          onChange={onChangeEs}
          disabled={disabled}
          minRows={minRows}
          maxRows={maxRows}
        />
        {maxLength !== undefined && <CharCount value={es} max={maxLength} />}
      </div>
      <RteToolbar />
    </div>
  );
}

export default RichTextField;
