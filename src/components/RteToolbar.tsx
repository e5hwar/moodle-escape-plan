import { useState, type ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { BoldIcon, ItalicIcon, UnderlineIcon, BulletListIcon, NumberListIcon, LinkSmallIcon, ImageAddIcon, SuperscriptIcon, SubscriptIcon, CodeBlockIcon, RteCaretIcon } from "./icons";

/* ─── Rich-text toolbar — Figma 327:137 / 620:1352 "Focus State" ───
   Six groups split by hairlines: block format, inline format, lists, insert,
   script, code. Every rich-text field in the app renders this same bar, so the
   toolbar lives here rather than being re-declared per wizard. It sits along
   the field's bottom edge and is only visible while the field owns focus —
   the reveal is pure CSS (`.rte-field:not(:focus-within) .rte-toolbar`).

   Buttons carry a selected state (Figma 640:922): a toggled control fills
   rgba(115,115,115,0.2) and its glyph goes white. The block-format picker opens
   the reduced-size dropdown menu (Figma 640:1005). By default no command runs
   against the text — the state is per-toolbar, purely visual (the textarea
   fields). Pass `live` (`RichDocField`) and the bar drives a real editor: its
   state mirrors the selection and every control runs its command.

   `onMouseDown` preventDefault + tabIndex -1 everywhere (menu rows included) so
   clicking a control never pulls the caret out of the editor. */

export const BLOCK_FORMATS = ["Paragraph", "Heading 1", "Heading 2", "Heading 3"] as const;
export type BlockFormat = (typeof BLOCK_FORMATS)[number];

/** A working editor behind the bar: what the selection currently carries, and
 *  how to apply a control (by its label) or a block format. */
export type RteLive = {
  active: ReadonlySet<string>;
  block: BlockFormat;
  run: (label: string) => void;
  setBlock: (f: BlockFormat) => void;
};

function RteBtn({ label, active, onToggle, children }: {
  label: string;
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rte-btn${active ? " is-active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
    >
      {children}
    </button>
  );
}

export function RteToolbar({ live }: { live?: RteLive } = {}) {
  const [ownBlock, setOwnBlock] = useState<BlockFormat>("Paragraph");
  const [ownActive, setActive] = useState<ReadonlySet<string>>(new Set());
  const block = live ? live.block : ownBlock;
  const active = live ? live.active : ownActive;
  const setBlock = live ? live.setBlock : setOwnBlock;

  const toggle = (label: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const btn = (label: string, icon: ReactNode) => (
    <RteBtn
      label={label}
      active={active.has(label)}
      onToggle={() => (live ? live.run(label) : toggle(label))}
    >
      {icon}
    </RteBtn>
  );

  return (
    // preventDefault on the strip itself: clicking its background must not
    // blur the textarea, or the :focus-within reveal would drop the bar
    // mid-interaction.
    <div className="rte-toolbar" onMouseDown={(e) => e.preventDefault()}>
      <div className="rte-group">
        <Dropdown
          overlay
          width="auto"
          /* The rows carry a 13px text inset (1px panel border + 4px panel
             padding + 8px row padding) and the trigger has none, so the panel
             opens 13px to the left — the menu's "Paragraph" then sits exactly
             under the button's. */
          offsetX={-13}
          panelClass="rte-para-menu"
          trigger={({ open, toggle: toggleMenu }) => (
            <button
              type="button"
              className="rte-heading"
              aria-haspopup="listbox"
              aria-expanded={open}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleMenu}
            >
              <span className="rte-heading-label">{block}</span>
              <RteCaretIcon />
            </button>
          )}
        >
          {({ close }) => (
            <div className="dropdown-list" role="listbox">
              {BLOCK_FORMATS.map((f) => (
                <button
                  type="button"
                  key={f}
                  role="option"
                  aria-selected={f === block}
                  className={`dropdown-item${f === block ? " is-current" : ""}`}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setBlock(f);
                    close();
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      </div>
      <div className="rte-group">
        {btn("Bold", <BoldIcon />)}
        {btn("Italic", <ItalicIcon />)}
        {btn("Underline", <UnderlineIcon />)}
      </div>
      <div className="rte-group">
        {btn("Bulleted list", <BulletListIcon />)}
        {btn("Numbered list", <NumberListIcon />)}
      </div>
      <div className="rte-group">
        {btn("Insert link", <LinkSmallIcon />)}
        {btn("Insert image", <ImageAddIcon />)}
      </div>
      <div className="rte-group">
        {btn("Superscript", <SuperscriptIcon />)}
        {btn("Subscript", <SubscriptIcon />)}
      </div>
      <div className="rte-group">
        {btn("Code", <CodeBlockIcon />)}
      </div>
    </div>
  );
}

export default RteToolbar;
