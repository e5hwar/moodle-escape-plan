import { useEffect, useRef, useState, type ReactNode } from "react";

type TriggerArgs = { open: boolean; toggle: () => void };

type Props = {
  trigger: (args: TriggerArgs) => ReactNode;
  children: (args: { close: () => void }) => ReactNode;
  width?: number;
  align?: "left" | "right";
  direction?: "down" | "up";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Dropdown({
  trigger,
  children,
  width = 300,
  align = "left",
  direction = "down",
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
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
      {trigger({ open, toggle: () => setOpen(!open) })}
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
