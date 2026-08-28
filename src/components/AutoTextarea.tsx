import { useCallback, useLayoutEffect, useRef } from "react";

/* The auto-growing textarea behind every rich text field (`.rte-area`).
 *
 * Height is bounded at both ends — app-wide rule: the box opens at `minRows`,
 * a single line (Figma 620:1352 / 327:137 "Focus State"), grows a line at a
 * time up to `maxRows` (697:1001, the 4-line variant), then holds that height
 * and scrolls its own content. Both bounds are measured off the element's
 * computed line-height, so they follow `.rte-area`'s 23px instead of
 * hard-coding pixels.
 *
 * Every RTE consumer imports this one — don't re-declare a local copy.
 */
export function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
  onFocus,
  onBlur,
  disabled,
  minRows = 1,
  maxRows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  minRows?: number;
  maxRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Collapse first: at `height: auto` the box can report its `rows` height
    // rather than the content's, so deleting text would never shrink it back.
    el.style.height = "0px";
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const inset = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const content = el.scrollHeight;
    const floor = minRows * line + inset;
    // A field asked to open taller than the cap keeps its own height.
    const ceiling = Math.max(maxRows, minRows) * line + inset;
    el.style.height = Math.min(Math.max(content, floor), ceiling) + "px";
    el.style.overflowY = content > ceiling ? "auto" : "hidden";
  }, [minRows, maxRows]);

  useLayoutEffect(fit, [value, fit]);

  /* The first layout pass reports the whole app at zero width, and a zero-width
     textarea wraps its placeholder into a dozen lines — which the fit above
     would then freeze in place. Re-fit whenever the width actually changes,
     which also covers window resizes and the sidebar collapsing. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === last) return;
      last = el.clientWidth;
      fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      rows={minRows}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default AutoTextarea;
