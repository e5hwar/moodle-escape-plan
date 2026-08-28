import { AutoTextarea } from "./AutoTextarea";
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
  /** Resting height of each language row, in lines. Defaults to the 1-line
   * variant; pass 2 or 4 for the taller Figma variants. */
  minRows?: number;
  /** Line count the row grows to before it holds and scrolls (default 4). */
  maxRows?: number;
}) {
  return (
    <div className={`rte-field${disabled ? " is-disabled" : ""}`}>
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
      </div>
      <RteToolbar />
    </div>
  );
}

export default RichTextField;
