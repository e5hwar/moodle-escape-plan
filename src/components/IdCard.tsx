import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { idPhotoUrl, type NameChangeRequest } from "../data/nameChangeRequests";

/** The ID document fields this card renders. Kept separate from any one page's
 *  record type so the card (and its hover-magnify / full-view / rotate tools)
 *  can be shared — Name Change Requests and Proctoring both feed it. */
export type IdCardData = {
  name: string;
  /** Free-form so callers can pass their own wording ("Driver License",
   *  "Driver's License", …); rendered upper-cased in the header band. */
  idType: string;
  idNumber: string;
  dob: string; // ISO date
  expires: string; // ISO date
  region: string; // issuing state / country
  /** picsum seed used for the ID portrait photo. */
  photoSeed: string;
};

/** Adapter for the Name Change Requests page's record shape. */
export function idCardFromRequest(r: NameChangeRequest): IdCardData {
  return {
    name: r.currentName,
    idType: r.idType,
    idNumber: r.idNumber,
    dob: r.dob,
    expires: r.expires,
    region: r.region,
    photoSeed: r.photoSeed,
  };
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

/** A realistic-looking mock ID card rendered as SVG so it stays crisp when zoomed. */
export function IdCard({ data }: { data: IdCardData }) {
  return (
    <svg
      className="idcard-svg"
      viewBox="0 0 520 328"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${data.idType} for ${data.name}`}
    >
      <defs>
        <linearGradient id="idc-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3f6fb" />
          <stop offset="1" stopColor="#e4ecf6" />
        </linearGradient>
        <linearGradient id="idc-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f4e8a" />
          <stop offset="1" stopColor="#2f73b8" />
        </linearGradient>
        <clipPath id="idc-photo">
          <rect x="28" y="92" width="120" height="150" rx="8" />
        </clipPath>
      </defs>

      {/* Card body */}
      <rect x="2" y="2" width="516" height="324" rx="18" fill="url(#idc-bg)" stroke="#c4d2e4" strokeWidth="2" />

      {/* Header band */}
      <rect x="2" y="2" width="516" height="54" rx="18" fill="url(#idc-band)" />
      <rect x="2" y="38" width="516" height="18" fill="url(#idc-band)" />
      <text x="24" y="36" fill="#fff" fontFamily="var(--font-sans)" fontSize="20" fontWeight="700">
        {data.region.toUpperCase()}
      </text>
      <text x="496" y="36" fill="#dce8f6" fontFamily="var(--font-sans)" fontSize="15" fontWeight="600" textAnchor="end">
        {data.idType.toUpperCase()}
      </text>

      {/* Photo */}
      <rect x="26" y="90" width="124" height="154" rx="10" fill="#cfd9e6" stroke="#b3c2d6" strokeWidth="2" />
      <image
        href={idPhotoUrl(data.photoSeed)}
        x="28"
        y="92"
        width="120"
        height="150"
        clipPath="url(#idc-photo)"
        preserveAspectRatio="xMidYMid slice"
      />

      {/* Fields */}
      <FieldLabel x={176} y={104} label="NAME" />
      <FieldValue x={176} y={126} value={data.name} size={21} />

      <FieldLabel x={176} y={158} label="DOB" />
      <FieldValue x={176} y={178} value={formatDate(data.dob)} />

      <FieldLabel x={340} y={158} label="EXP" />
      <FieldValue x={340} y={178} value={formatDate(data.expires)} />

      <FieldLabel x={176} y={206} label="ID NO." />
      <FieldValue x={176} y={226} value={data.idNumber} mono />

      {/* Signature line */}
      <text x={28} y={272} fill="#7c8aa0" fontFamily="var(--font-sans)" fontSize="11" fontWeight="600">
        SIGNATURE
      </text>
      <path d="M104 268 q14 -12 26 0 t26 0 t30 -4 t24 6" fill="none" stroke="#33485f" strokeWidth="2.4" strokeLinecap="round" />

      {/* Barcode strip */}
      <g transform="translate(28 288)">
        {Array.from({ length: 58 }, (_, i) => {
          const w = (i * 37) % 5 < 2 ? 1.6 : 3.2;
          return <rect key={i} x={i * 8.2} y={0} width={w} height={26} fill="#22303f" />;
        })}
      </g>
    </svg>
  );
}

function FieldLabel({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <text x={x} y={y} fill="#7c8aa0" fontFamily="var(--font-sans)" fontSize="12" fontWeight="700" letterSpacing="1">
      {label}
    </text>
  );
}

function FieldValue({
  x,
  y,
  value,
  size = 16,
  mono = false,
}: {
  x: number;
  y: number;
  value: string;
  size?: number;
  mono?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      fill="#16263a"
      fontFamily={mono ? "var(--font-mono)" : "var(--font-sans)"}
      fontSize={size}
      fontWeight="600"
    >
      {value}
    </text>
  );
}

const RotateIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/** Magnifier strength and the size of the panel the magnified region is drawn into. */
const ZOOM = 2.5;
const PANEL_W = 400;
const PANEL_H = 300;
const LENS_W = PANEL_W / ZOOM;
const LENS_H = PANEL_H / ZOOM;

/** Rotating a landscape card to portrait needs it scaled down to stay inside the
 *  stage box — the box keeps its unrotated size because transforms don't reflow. */
function fitScale(rotation: number, box: { w: number; h: number }): number {
  if (rotation % 180 === 0 || box.w === 0) return 1;
  return box.h / box.w;
}

/**
 * ID card with hover-to-magnify: a lens tracks the pointer and a panel beside the
 * card renders that region enlarged. Click (or the caption button) opens full view.
 */
export function ZoomableIdCard({
  data,
  onFullViewChange,
}: {
  data: IdCardData;
  /** Fires when the full-view overlay opens/closes. Host pages that bind their
   *  own window-level keys need this: the overlay handles its own Escape, so
   *  without it the host's Escape handler fires on the same event too (in the
   *  Proctoring console that closed the overlay AND exited the review page). */
  onFullViewChange?: (open: boolean) => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [fullView, setFullViewState] = useState(false);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  const setFullView = (open: boolean) => {
    setFullViewState(open);
    onFullViewChange?.(open);
  };

  // The stage keeps its natural (unrotated) size, so one measurement covers both
  // the lens clamp and the rotate fit.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    // Keep the lens fully inside the card — the panel never shows dead space.
    const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(0, max));
    setLens({
      x: clamp(e.clientX - r.left - LENS_W / 2, r.width - LENS_W),
      y: clamp(e.clientY - r.top - LENS_H / 2, r.height - LENS_H),
    });
  }

  const scale = fitScale(rotation, box);
  const cardStyle = { transform: `rotate(${rotation}deg) scale(${scale})` };

  return (
    <div className="idhz">
      <div className="idhz-frame">
        <div
          ref={stageRef}
          className="idhz-stage"
          onMouseMove={onMove}
          onMouseLeave={() => setLens(null)}
          onClick={() => setFullView(true)}
          role="button"
          tabIndex={0}
          aria-label="Open ID in full view"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFullView(true);
            }
          }}
        >
          <div className="idhz-card" style={cardStyle}>
            <IdCard data={data} />
          </div>
          {lens && (
            <span
              className="idhz-lens"
              style={{ left: lens.x, top: lens.y, width: LENS_W, height: LENS_H }}
            />
          )}
        </div>

        {lens && (
          <div className="idhz-panel" style={{ width: PANEL_W, height: PANEL_H }}>
            <div
              className="idhz-panel-inner"
              style={{
                width: box.w,
                height: box.h,
                transform: `scale(${ZOOM}) translate(${-lens.x}px, ${-lens.y}px)`,
              }}
            >
              <div className="idhz-card" style={cardStyle}>
                <IdCard data={data} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="idhz-tools">
        <button className="idhz-full" onClick={() => setFullView(true)}>
          Click to see full view
        </button>
        <button
          className="idhz-tool"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          aria-label="Rotate ID"
        >
          <RotateIcon />
          Rotate
        </button>
      </div>

      {fullView && (
        <IdFullView data={data} rotation={rotation} onClose={() => setFullView(false)} />
      )}
    </div>
  );
}

/** Full-view overlay — reuses the shared .ncr-fs-* shell used by Proctoring. */
function IdFullView({
  data,
  rotation: initial,
  onClose,
}: {
  data: IdCardData;
  rotation: number;
  onClose: () => void;
}) {
  const [rotation, setRotation] = useState(initial);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="ncr-fs-overlay" onClick={onClose}>
      <div className="ncr-fs-bar">
        <div className="ncr-fs-title">
          {data.idType} — {data.name}
        </div>
        <div className="ncr-fs-actions">
          <button
            className="idhz-tool"
            onClick={(e) => {
              e.stopPropagation();
              setRotation((r) => (r + 90) % 360);
            }}
            aria-label="Rotate ID"
          >
            <RotateIcon />
            Rotate
          </button>
          <button className="ncr-fs-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="ncr-fs-stage" onClick={(e) => e.stopPropagation()}>
        {/* Measured on the untransformed box — reading the rect off the rotated
            card itself would feed the fit calculation its own output. */}
        <div ref={stageRef} className="idhz-fs-box">
          <div className="idhz-card" style={{ transform: `rotate(${rotation}deg) scale(${fitScale(rotation, box)})` }}>
            <IdCard data={data} />
          </div>
        </div>
      </div>
      <div className="ncr-fs-hint">Press Esc or click outside to close</div>
    </div>
  );
}
