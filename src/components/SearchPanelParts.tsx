import { KeyCommandIcon, SearchIcon, SearchClearIcon } from "./icons";

// Shared dropdown footer + "search for" action used by the Tasks / Users / Review
// search combobox panels. Matches the Figma "Expanded Search" components.

const EnterMini = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 2.5V5.5C10 6.05 9.55 6.5 9 6.5H3M3 6.5L5 4.5M3 6.5L5 8.5"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArrowMini = ({ up }: { up?: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={up ? { transform: "rotate(180deg)" } : undefined}
  >
    <path d="M6 2.5V9.5M6 9.5L3 6.5M6 9.5L9 6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Keyboard hints footer — shown when the search box is empty. */
export function SearchHints() {
  return (
    <div className="usearch-foot">
      <span className="usearch-hint">
        <span className="usearch-keycap">
          <EnterMini />
        </span>
        <span className="usearch-hint-label">To select</span>
      </span>
      <span className="usearch-hint">
        <span className="usearch-keycap usearch-keycap--text">ESC</span>
        <span className="usearch-hint-label">To close</span>
      </span>
      <span className="usearch-hint">
        <span className="usearch-keycap-group">
          <span className="usearch-keycap">
            <ArrowMini up />
          </span>
          <span className="usearch-keycap">
            <ArrowMini />
          </span>
        </span>
        <span className="usearch-hint-label">To navigate</span>
      </span>
    </div>
  );
}

/** "Search for "<query>" in <scope>" action row — shown when text is entered. */
export function SearchForRow({
  query,
  scope,
  active,
  onHover,
  onClick,
}: {
  query: string;
  scope: string;
  active?: boolean;
  onHover?: () => void;
  onClick: () => void;
}) {
  // Default-selected when no explicit active state is provided, so Enter runs the search.
  const on = active === undefined ? true : active;
  return (
    <button
      className={`usearch-searchfor ${on ? "active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <span className="usearch-searchfor-icon">
        <SearchIcon />
      </span>
      <span className="usearch-searchfor-text">
        Search for <span className="q">“{query}”</span> in {scope}
      </span>
    </button>
  );
}

/** The search bar's trailing slot (Figma 902:3585 "Text Entered" / 772:1110
 *  "Filter Applied"). The bar shows the ⌘K badge only while it is empty; the
 *  moment there is something to clear — typed text OR an applied filter chip —
 *  the badge gives way to a ✕ that clears it. The big `.usearch-*` combobox
 *  bars already worked this way; this is the same control for the plain
 *  `.search-wrap` bars every list page carries. */
export function SearchTrailing({
  active,
  onClear,
}: {
  /** There is something to clear — text typed, or a filter applied. */
  active: boolean;
  onClear: () => void;
}) {
  if (!active) {
    return (
      <span className="search-kbd">
        <span className="kbd-cmd"><KeyCommandIcon /></span>
        <span className="kbd-letter">K</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="search-clear"
      aria-label="Clear search"
      title="Clear search"
      /* Keep the input focused — clearing should not close a panel that is
         open because the field has focus. */
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClear}
    >
      <SearchClearIcon />
    </button>
  );
}

/** The search header inside a dropdown panel (Figma 934:1117): a search glyph,
 *  the query, and — once anything is typed — an X that clears it. Shared by the
 *  SelectField / filter / picker menus so the searched state looks and behaves
 *  the same in all of them.
 *
 *  `onChange` is called with "" when the X is hit, so the owner's own filtering
 *  resets through the one path it already has. The mousedown is prevented so
 *  clearing never blurs the field and closes the menu underneath. */
export function DropdownSearch({
  value,
  onChange,
  placeholder,
  inputRef,
  onKeyDown,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="dropdown-search">
      <span className="dropdown-search-icon">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {value !== "" && (
        <button
          type="button"
          className="dropdown-search-clear"
          aria-label="Clear search"
          title="Clear search"
          onMouseDown={(e) => {
            e.preventDefault();
            onChange("");
            inputRef?.current?.focus();
          }}
        >
          <SearchClearIcon />
        </button>
      )}
    </div>
  );
}
