import { SearchIcon } from "./icons";

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
