import { useEffect, useRef, useState, type ReactNode } from "react";

type TriggerArgs = { open: boolean; toggle: () => void };

type Props = {
  trigger: (args: TriggerArgs) => ReactNode;
  children: (args: { close: () => void }) => ReactNode;
  width?: number;
  align?: "left" | "right";
  direction?: "down" | "up";
};

export function Dropdown({ trigger, children, width = 300, align = "left", direction = "down" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="dropdown-wrap" ref={wrapRef}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={`dropdown ${direction === "up" ? "up" : ""}`}
          style={{ width, [align === "right" ? "right" : "left"]: 0 }}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}
