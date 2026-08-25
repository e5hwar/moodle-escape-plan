import { useState, type ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { BoldIcon, ItalicIcon, UnderlineIcon, BulletListIcon, NumberListIcon, LinkSmallIcon, ImageAddIcon, SuperscriptIcon, SubscriptIcon, CodeBlockIcon, RteCaretIcon } from "./icons";

/* ─── Rich-text toolbar — Figma 327:137 "Rich Text Input - Dual Language" ───
   Six groups split by hairlines: block format, inline format, lists, insert,
   script, code. Every rich-text field in the app renders this same bar, so the
   toolbar lives here rather than being re-declared per wizard.

   Buttons carry a selected state (Figma 640:922): a toggled control fills
   rgba(115,115,115,0.2) and its glyph goes white. The block-format picker opens
   the reduced-size dropdown menu (Figma 640:1005). No command runs against the
   text in the prototype — the state is per-toolbar, purely visual.

   `onMouseDown` preventDefault + tabIndex -1 everywhere (menu rows included) so
   clicking a control never pulls the caret out of the editor. */

const BLOCK_FORMATS = ["Paragraph", "Heading 1", "Heading 2", "Heading 3"] as const;
type BlockFormat = (typeof BLOCK_FORMATS)[number];

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

export function RteToolbar() {
  const [block, setBlock] = useState<BlockFormat>("Paragraph");
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());

  const toggle = (label: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const btn = (label: string, icon: ReactNode) => (
    <RteBtn label={label} active={active.has(label)} onToggle={() => toggle(label)}>
      {icon}
    </RteBtn>
  );

  return (
    <div className="rte-toolbar">
      <div className="rte-group">
        <Dropdown
          overlay
          width="auto"
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
