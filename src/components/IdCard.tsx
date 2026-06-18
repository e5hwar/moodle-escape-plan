import { useState } from "react";
import { idPhotoUrl, type NameChangeRequest } from "../data/nameChangeRequests";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

/** A realistic-looking mock ID card rendered as SVG so it stays crisp when zoomed. */
export function IdCard({ request }: { request: NameChangeRequest }) {
  return (
    <svg
      className="idcard-svg"
      viewBox="0 0 520 328"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${request.idType} for ${request.currentName}`}
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
        {request.region.toUpperCase()}
      </text>
      <text x="496" y="36" fill="#dce8f6" fontFamily="var(--font-sans)" fontSize="15" fontWeight="600" textAnchor="end">
        {request.idType.toUpperCase()}
      </text>

      {/* Photo */}
      <rect x="26" y="90" width="124" height="154" rx="10" fill="#cfd9e6" stroke="#b3c2d6" strokeWidth="2" />
      <image
        href={idPhotoUrl(request.photoSeed)}
        x="28"
        y="92"
        width="120"
        height="150"
        clipPath="url(#idc-photo)"
        preserveAspectRatio="xMidYMid slice"
      />

      {/* Fields */}
      <FieldLabel x={176} y={104} label="NAME" />
      <FieldValue x={176} y={126} value={request.currentName} size={21} />

      <FieldLabel x={176} y={158} label="DOB" />
      <FieldValue x={176} y={178} value={formatDate(request.dob)} />

      <FieldLabel x={340} y={158} label="EXP" />
      <FieldValue x={340} y={178} value={formatDate(request.expires)} />

      <FieldLabel x={176} y={206} label="ID NO." />
      <FieldValue x={176} y={226} value={request.idNumber} mono />

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

const ZoomInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
  </svg>
);
const ZoomOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3M8 11h6" />
  </svg>
);
const ResetIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const STEP = 0.25;

/** ID card with +/- zoom controls. Scrolls to pan when zoomed in. */
export function ZoomableIdCard({ request }: { request: NameChangeRequest }) {
  const [zoom, setZoom] = useState(1);
  const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  return (
    <div className="idzoom">
      {/* Width-based zoom (not transform) so the viewport can scroll to pan. */}
      <div className="idzoom-viewport">
        <div className="idzoom-scale" style={{ width: `${zoom * 100}%` }}>
          <IdCard request={request} />
        </div>
      </div>
      <div className="idzoom-controls">
        <button
          className="idzoom-btn"
          onClick={() => setZoom((z) => clamp(z - STEP))}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
        >
          <ZoomOutIcon />
        </button>
        <span className="idzoom-level">{Math.round(zoom * 100)}%</span>
        <button
          className="idzoom-btn"
          onClick={() => setZoom((z) => clamp(z + STEP))}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
        >
          <ZoomInIcon />
        </button>
        <button className="idzoom-btn idzoom-btn--reset" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Reset zoom">
          <ResetIcon />
        </button>
      </div>
    </div>
  );
}
