import type { ReactNode } from "react";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  BulletListIcon,
  NumberListIcon,
  LinkSmallIcon,
  ImageAddIcon,
  SuperscriptIcon,
  SubscriptIcon,
  CodeBlockIcon,
  RteCaretIcon,
} from "./icons";

/* ─── Rich-text toolbar — Figma 327:137 "Rich Text Input - Dual Language" ───
   Six groups split by hairlines: block format, inline format, lists, insert,
   script, code. Every rich-text field in the app renders this same bar, so the
   toolbar lives here rather than being re-declared per wizard.

   The buttons are inert in the prototype, but they still take `onMouseDown`
   preventDefault + tabIndex -1 so clicking one never pulls the caret out of the
   editor — that mattered where a real command would run. */

function RteBtn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className="rte-btn"
      aria-label={label}
      title={label}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export function RteToolbar() {
  return (
    <div className="rte-toolbar">
      <div className="rte-group">
        <button
          type="button"
          className="rte-heading"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="rte-heading-label">Heading 1</span>
          <RteCaretIcon />
        </button>
      </div>
      <div className="rte-group">
        <RteBtn label="Bold"><BoldIcon /></RteBtn>
        <RteBtn label="Italic"><ItalicIcon /></RteBtn>
        <RteBtn label="Underline"><UnderlineIcon /></RteBtn>
      </div>
      <div className="rte-group">
        <RteBtn label="Bulleted list"><BulletListIcon /></RteBtn>
        <RteBtn label="Numbered list"><NumberListIcon /></RteBtn>
      </div>
      <div className="rte-group">
        <RteBtn label="Insert link"><LinkSmallIcon /></RteBtn>
        <RteBtn label="Insert image"><ImageAddIcon /></RteBtn>
      </div>
      <div className="rte-group">
        <RteBtn label="Superscript"><SuperscriptIcon /></RteBtn>
        <RteBtn label="Subscript"><SubscriptIcon /></RteBtn>
      </div>
      <div className="rte-group">
        <RteBtn label="Code"><CodeBlockIcon /></RteBtn>
      </div>
    </div>
  );
}

export default RteToolbar;
