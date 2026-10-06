import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { RowKebabIcon } from "./icons";

/* Row actions for a table whose actions all live in a menu — the Full
   Profile's card tables (Figma 1278:1571) and Award Recipients' downloads. */

/* The row menu behind a card table's kebab — the shared `.u-menu` chrome,
   fixed-positioned and right-anchored to the glyph, closing on outside click /
   scroll / Escape like every other row menu. */
export type RowMenuItem = {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Why it is disabled — the shared tooltip adopts it. */
  title?: string;
  onPick: () => void;
};

export function RowMenu({
  rect, items, onClose,
}: {
  rect: DOMRect;
  items: RowMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    setPos({ top });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it) => (
        <button
          key={it.label}
          className="u-menu-item"
          disabled={it.disabled}
          title={it.title}
          onClick={() => {
            it.onPick();
            onClose();
          }}
        >
          {it.icon && <span className="u-menu-item-icon">{it.icon}</span>}
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* The kebab at the end of every row: the node's resting glyph, swapped on hover
   for the shared `.row-action-bar` pill (Figma 386:269) exactly as every list
   table does it — one cell here, since the menu holds the actions. Without the
   bar the bare glyph kept the button's own hover wash, which read as a grey box
   dropped on the row. */
export function RowKebab({ onOpen }: { onOpen: (rect: DOMRect) => void }) {
  const open = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onOpen(e.currentTarget.getBoundingClientRect());
  };
  return (
    <td className="col-actions">
      <button className="row-action-btn lone-dots" aria-label="More" onClick={open}>
        <RowKebabIcon />
      </button>
      <div className="row-action-bar">
        <button className="row-action-btn" aria-label="More" onClick={open}>
          <RowKebabIcon />
        </button>
      </div>
    </td>
  );
}
