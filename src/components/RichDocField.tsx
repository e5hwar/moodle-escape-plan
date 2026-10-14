import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PrmModal } from "./PrmModal";
import { RteToolbar, type BlockFormat, type RteLive } from "./RteToolbar";
import { sanitizeRichHtml } from "../richText";

/* A dual-language rich-text DOCUMENT field (Product Config's Legal tab): the
   shared Rich Text Input — same `.rte-field` shell, EN / ES rows and 38px
   toolbar (Figma 327:137) — but each row is a live editor rather than a
   textarea, so headings, bold, lists and links render as they will read, and
   the toolbar actually applies them. The value is HTML (see `richText.ts`).

   `RichTextField` stays the plain-text field every other form uses; this one
   is for long, formatted copy. */

const BLOCK_TAGS: Record<BlockFormat, string> = {
  Paragraph: "p",
  "Heading 1": "h1",
  "Heading 2": "h2",
  "Heading 3": "h3",
};

/* Toolbar label → the browser editing command it runs. */
const COMMANDS: Record<string, string> = {
  Bold: "bold",
  Italic: "italic",
  Underline: "underline",
  "Bulleted list": "insertUnorderedList",
  "Numbered list": "insertOrderedList",
  Superscript: "superscript",
  Subscript: "subscript",
};

const elementOf = (n: Node | null | undefined): Element | null =>
  !n ? null : n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;

/* What the selection inside `root` carries right now, or null when the
   selection is elsewhere. */
function readState(root: HTMLElement): { active: Set<string>; block: BlockFormat } | null {
  const sel = document.getSelection();
  const at = sel?.anchorNode;
  if (!at || !root.contains(at)) return null;
  const active = new Set<string>();
  for (const [label, cmd] of Object.entries(COMMANDS)) {
    try {
      if (document.queryCommandState(cmd)) active.add(label);
    } catch {
      /* unsupported command: leave it off */
    }
  }
  const el = elementOf(at);
  // The browser reads a heading's weight as Bold and a link's underline as
  // Underline; only real markup should light those controls.
  if (!el?.closest("b, strong")) active.delete("Bold");
  if (!el?.closest("u")) active.delete("Underline");
  if (el?.closest("a")) active.add("Insert link");
  if (el?.closest("pre")) active.add("Code");
  const tag = el?.closest("h1, h2, h3")?.tagName.toLowerCase();
  const block = (Object.keys(BLOCK_TAGS) as BlockFormat[]).find((f) => BLOCK_TAGS[f] === tag) ?? "Paragraph";
  return { active, block };
}

/* One language row's editor. Uncontrolled while typing: the DOM is only
   rewritten when the value changes from outside (Discard, a dropped change),
   so the caret never jumps. */
function DocArea({
  value,
  onChange,
  placeholder,
  ariaLabel,
  minRows,
  maxRows,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel: string;
  minRows: number;
  maxRows: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && value !== last.current) {
      el.innerHTML = value;
      last.current = value;
    }
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    // Blocks with nothing in them at all (an insert into an empty box leaves
    // them either side) would only add margin. A <p><br></p> — where the
    // caret sits on a fresh line — is not one of them.
    el.querySelectorAll("p:empty, h1:empty, h2:empty, h3:empty, pre:empty").forEach((n) => n.remove());
    // A box emptied by the user often keeps a stray <br>/<p>; that's empty.
    const html = el.textContent?.trim() || el.querySelector("li, img") ? el.innerHTML : "";
    last.current = html;
    onChange(html);
  };

  return (
    <div
      ref={ref}
      className={`rte-area rte-doc${value ? "" : " is-empty"}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      spellCheck
      /* 19px lines (the field's pitch), plus the row's 12px insets. */
      style={{ minHeight: minRows * 19 + 24, maxHeight: maxRows * 19 + 24 }}
      onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
      onInput={emit}
      onPaste={(e) => {
        // Formatting survives a paste; other editors' styling and spacer
        // paragraphs don't.
        const html = e.clipboardData.getData("text/html");
        const text = e.clipboardData.getData("text/plain");
        e.preventDefault();
        if (html) document.execCommand("insertHTML", false, sanitizeRichHtml(html));
        else document.execCommand("insertText", false, text);
      }}
      onKeyDown={(e) => {
        // ⌘K / Ctrl+K: link, as in every editor.
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") e.preventDefault();
      }}
    />
  );
}

export function RichDocField({
  en,
  es,
  onChangeEn,
  onChangeEs,
  placeholderEn,
  placeholderEs,
  label,
  error,
  minRows = 4,
  maxRows = 12,
}: {
  /** Required and empty — reddens the shell; the message is the caller's. */
  error?: boolean;
  en: string;
  es: string;
  onChangeEn: (html: string) => void;
  onChangeEs: (html: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
  /** Names the two editors for assistive tech ("Terms of Service"). */
  label: string;
  minRows?: number;
  maxRows?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ active: Set<string>; block: BlockFormat }>({
    active: new Set(),
    block: "Paragraph",
  });
  /* The selection the link dialog will apply to — the dialog takes focus, so
     it is saved on the way in and restored on the way out. */
  const [linking, setLinking] = useState<{ range: Range; href: string } | null>(null);

  const sync = useCallback(() => {
    if (!root.current) return;
    const next = readState(root.current);
    if (next) setState(next);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, [sync]);

  /* The editor the caret is in — commands act on the live selection, so this
     is only needed to fire its input event afterwards. */
  const activeArea = () => {
    const el = elementOf(document.getSelection()?.anchorNode);
    return el && root.current?.contains(el) ? el.closest<HTMLElement>(".rte-doc") : null;
  };
  const afterEdit = (area: HTMLElement | null) => {
    area?.dispatchEvent(new Event("input", { bubbles: true }));
    sync();
  };

  const openLink = () => {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || !activeArea()) return;
    const a = elementOf(sel.anchorNode)?.closest("a");
    if (a) {
      // Already a link: the control toggles it off.
      const range = document.createRange();
      range.selectNodeContents(a);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("unlink");
      afterEdit(activeArea());
      return;
    }
    setLinking({ range: sel.getRangeAt(0).cloneRange(), href: "" });
  };

  /* Insert image: the file picker takes focus, so the caret's place is saved
     on the way out and the image lands there. Same file types as every image
     upload in the app. */
  const fileInput = useRef<HTMLInputElement>(null);
  const imageAt = useRef<Range | null>(null);
  const openImage = () => {
    const sel = document.getSelection();
    imageAt.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    fileInput.current?.click();
  };
  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const range = imageAt.current;
      const area = elementOf(range?.startContainer)?.closest<HTMLElement>(".rte-doc") ?? null;
      if (!range || !area) return;
      area.focus();
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand("insertImage", false, String(reader.result));
      afterEdit(area);
    };
    reader.readAsDataURL(file);
  };

  const live: RteLive = {
    active: state.active,
    block: state.block,
    run: (label) => {
      const area = activeArea();
      if (!area) return;
      if (label === "Insert link") return openLink();
      if (label === "Insert image") return openImage();
      if (label === "Code") {
        document.execCommand("formatBlock", false, state.active.has("Code") ? "<p>" : "<pre>");
      } else if (COMMANDS[label]) {
        document.execCommand(COMMANDS[label], false);
      }
      afterEdit(area);
    },
    setBlock: (f) => {
      const area = activeArea();
      if (!area) return;
      document.execCommand("formatBlock", false, `<${BLOCK_TAGS[f]}>`);
      afterEdit(area);
    },
  };

  const applyLink = (href: string) => {
    if (!linking) return;
    const sel = document.getSelection();
    const area = elementOf(linking.range.startContainer)?.closest<HTMLElement>(".rte-doc") ?? null;
    area?.focus();
    sel?.removeAllRanges();
    sel?.addRange(linking.range);
    if (linking.range.collapsed) {
      // Nothing selected: the address itself becomes the link text.
      const a = document.createElement("a");
      a.href = href;
      a.textContent = href;
      document.execCommand("insertHTML", false, a.outerHTML);
    } else {
      document.execCommand("createLink", false, href);
    }
    setLinking(null);
    afterEdit(area);
  };

  return (
    <>
    <div
      ref={root}
      className={`rte-field rte-doc-field${error ? " has-error" : ""}`}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") openLink();
      }}
    >
      <div className="rte-lang-row">
        <span className="lang-tag">EN</span>
        <DocArea
          value={en}
          onChange={onChangeEn}
          placeholder={placeholderEn}
          ariaLabel={`${label} (English)`}
          minRows={minRows}
          maxRows={maxRows}
        />
      </div>
      <div className="rte-field-divider" />
      <div className="rte-lang-row">
        <span className="lang-tag">ES</span>
        <DocArea
          value={es}
          onChange={onChangeEs}
          placeholder={placeholderEs}
          ariaLabel={`${label} (Spanish)`}
          minRows={minRows}
          maxRows={maxRows}
        />
      </div>
      <RteToolbar live={live} />
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImage(file);
          e.target.value = "";
        }}
      />
    </div>
    {/* Outside the field, so its input doesn't count as the field's focus. */}
    {linking && <LinkModal onCancel={() => setLinking(null)} onInsert={applyLink} />}
    </>
  );
}

/* Insert Link — the shared modal shell with one required address. */
function LinkModal({ onCancel, onInsert }: { onCancel: () => void; onInsert: (href: string) => void }) {
  const [href, setHref] = useState("");
  const v = href.trim();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <PrmModal
      title="Insert Link"
      confirmLabel="Insert Link"
      confirmDisabled={!v}
      onCancel={onCancel}
      onConfirm={() => v && onInsert(v)}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            URL<span className="prm-req">*</span>
          </span>
          <input
            autoFocus
            className="form-input"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && v) onInsert(v);
            }}
            placeholder="URL..."
            spellCheck={false}
          />
        </div>
      </div>
    </PrmModal>
  );
}
