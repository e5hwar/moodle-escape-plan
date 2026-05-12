import { useState } from "react";
import type { Task } from "../data/tasks";
import { HvacBlueprint2DContents, BLUEPRINT_W, BLUEPRINT_H } from "./HvacBlueprintPreview";

const DESIGN_W = 620;
const DESIGN_H = 720;

const M = {
  bg: "#0b0a09",
  ink: "#f4efe8",
  inkDim: "#9a948b",
  inkFaint: "#5e574f",
  hair: "#3a342d",
  hairSoft: "#221f1b",
  rim: "#544a40",
  rimHi: "#7a6f63",
  accent: "#e36a3a",
  accentDim: "#8a3f22",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
};

type Facet = {
  id: string;
  kicker: string;
  heading: string;
  subtext: string;
  detail: [string, string][];
  secondary?: { label: string; mono?: boolean; rows: [string, string][] };
  note?: string;
};

function buildFacets(task: Task): Facet[] {
  const primary = task.usedIn[0] ?? "—";
  const secondary = task.usedIn[1] ?? "—";
  const tags = task.tags && task.tags.length ? task.tags.join(" · ") : "—";
  return [
    {
      id: "type",
      kicker: "TYPE",
      heading: task.type,
      subtext: "Practical · manually reviewed",
      detail: [
        ["Format", task.requirements ? task.requirements : "Field submission · photo + reflection"],
        ["Review", "Manual · 7/10 passing score"],
        ["Effort", task.timeToComplete ?? "~45 minutes"],
      ],
      secondary: {
        label: "GRADING RUBRIC",
        mono: true,
        rows: [
          ["Joint cleanliness", "2 pts"],
          ["Heat application", "2 pts"],
          ["Filler placement", "2 pts"],
          ["Leak test", "2 pts"],
          ["Reflection quality", "2 pts"],
        ],
      },
      note: "Field tasks are reviewed within 24h of submission.",
    },
    {
      id: "usage",
      kicker: "USED IN",
      heading: primary,
      subtext: task.usedIn.length > 1 ? `+ ${task.usedIn.length - 1} more certification${task.usedIn.length > 2 ? "s" : ""}` : "Single certification",
      detail: [
        ["Primary", primary],
        ["Secondary", secondary],
        ["Tags", tags],
      ],
      secondary: {
        label: "COURSE PLACEMENT",
        rows: task.usedIn.length
          ? task.usedIn.slice(0, 3).map((c, i) => [c, `Module ${i + 2} · Lesson ${i * 2 + 3}`] as [string, string])
          : [["—", "—"]],
      },
      note: "Edits propagate to all courses sharing this task.",
    },
    {
      id: "lifecycle",
      kicker: "LIFECYCLE",
      heading: task.draft ? "Draft · unpublished" : (task.visibility ?? "Visible · published"),
      subtext: task.updated ? `Updated ${task.updated}` : task.dateModified ? `Updated ${task.dateModified}` : "Updated recently",
      detail: [
        ["Created", `${task.dateCreated ?? "—"} · ${task.createdBy}`],
        ["Updated", task.dateModified ?? task.updated ?? "—"],
        ["Owner", `${task.createdBy} curriculum team`],
      ],
      secondary: {
        label: "RECENT REVISIONS",
        mono: true,
        rows: [
          ["v3.2 · 2d ago", "Patel"],
          ["v3.1 · 2w ago", "Patel"],
          ["v3.0 · 6w ago", "Lin"],
          ["v2.4 · 3mo ago", task.createdBy],
        ],
      },
      note: "Pinned to course v3.x; bumps as part of the curriculum train.",
    },
    {
      id: "performance",
      kicker: "PERFORMANCE",
      heading: task.submissions ?? "312 attempts · 89%",
      subtext: "Median completion 38 min",
      detail: [
        ["Attempts", task.submissions ?? "312 total · 41 this week"],
        ["Pass rate", "89% on first review"],
        ["Median", "38 min to submission"],
      ],
      secondary: {
        label: "COHORT BREAKDOWN",
        mono: true,
        rows: [
          ["Apprentices", "92% pass · n=181"],
          ["Returning", "85% pass · n=104"],
          ["Bilingual", "88% pass · n=27"],
        ],
      },
      note: "Median submission time has dropped 6m since v3.1.",
    },
  ];
}

export function RotaryDialPreview({ task, onClose }: { task: Task; onClose: () => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const facets = buildFacets(task);

  const width = DESIGN_W;
  const height = DESIGN_H;

  const rOuter = Math.min(height * 0.4, 260);
  const rRing = rOuter - 8;
  const rDial = rOuter - 32;
  const rHub = rDial - 78;
  const rPointer = rDial - 16;

  const cx = rOuter - 0.62 * 2 * rOuter;
  const cy = height / 2;

  const detents = [-54, -18, 18, 54];
  const targetAngle = hover == null ? 0 : detents[hover];

  const polar = (r: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const headerH = 96;
  const footerH = 56;
  const cardLeft = cx + rOuter + 52;
  const cardTop = headerH + 16;
  const cardW = width - cardLeft - 24;
  const cardH = height - cardTop - footerH - 16;

  const headerKicker = `${task.id} · MODE SELECTOR`;
  const headerTitle = task.name.toUpperCase();
  const headerSub = task.type;
  const headerRightLabel = hover == null ? "IDLE · 12 O’CLOCK" : facets[hover].kicker;
  const headerRightActive = hover != null;
  const footerLeft = hover == null ? "◴ HOVER A LABEL" : `DETENT · ${facets[hover].kicker}`;

  return (
    <aside
      className="detail detail-rotary"
      onMouseLeave={() => setHover(null)}
    >
      <div
        className="rotary-stage"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: M.bg,
          borderLeft: `1px solid ${M.hair}`,
          overflow: "hidden",
          fontFamily: M.sans,
          color: M.ink,
        }}
      >
        {/* Scale wrapper — internal coordinates are in design pixels (width x height).
            We use a fixed-size container and CSS transform to scale to the parent. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width,
              height,
              transformOrigin: "top left",
            }}
            ref={(el) => {
              if (!el || !el.parentElement) return;
              const fit = () => {
                const pw = el.parentElement!.clientWidth;
                const s = pw / width;
                el.style.transform = `scale(${s})`;
                el.style.left = "0px";
                el.style.top = "0px";
              };
              fit();
              const ro = new ResizeObserver(fit);
              ro.observe(el.parentElement);
            }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                zIndex: 20,
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(11,10,9,0.6)",
                border: `1px solid ${M.hair}`,
                color: M.inkDim,
                cursor: "pointer",
                borderRadius: 2,
                padding: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            {/* Header */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                padding: "22px 28px 16px",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                borderBottom: `1px solid ${M.hairSoft}`,
                zIndex: 10,
              }}
            >
              <div>
                <div style={{ fontFamily: M.mono, fontSize: 9.5, letterSpacing: "0.22em", color: M.inkFaint }}>
                  {headerKicker}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, letterSpacing: "0.04em" }}>
                  {headerTitle}
                </div>
                <div style={{ fontSize: 12, color: M.inkDim, marginTop: 1 }}>{headerSub}</div>
              </div>
              <div
                style={{
                  fontFamily: M.mono,
                  fontSize: 9.5,
                  letterSpacing: "0.18em",
                  color: headerRightActive ? M.accent : M.inkFaint,
                  textAlign: "right",
                  paddingRight: 36,
                }}
              >
                {headerRightLabel}
              </div>
            </div>

            {/* Blueprint backplate — fades on hover */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 0,
                opacity: hover != null ? 0.05 : 0.15,
                transition: "opacity 460ms cubic-bezier(.2,.7,.2,1)",
              }}
            >
              <svg
                width={width}
                height={height}
                viewBox={`0 0 ${BLUEPRINT_W} ${BLUEPRINT_H}`}
                preserveAspectRatio="xMidYMid slice"
                style={{ position: "absolute", inset: 0 }}
              >
                <HvacBlueprint2DContents />
              </svg>
            </div>

            {/* Dial */}
            <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <defs>
                <radialGradient id="rd-bezel" cx="40%" cy="40%" r="70%">
                  <stop offset="0%" stopColor="#3a342d" />
                  <stop offset="55%" stopColor="#1c1916" />
                  <stop offset="100%" stopColor="#0a0908" />
                </radialGradient>
                <radialGradient id="rd-dial" cx="42%" cy="38%" r="65%">
                  <stop offset="0%" stopColor="#26221e" />
                  <stop offset="60%" stopColor="#15120f" />
                  <stop offset="100%" stopColor="#0a0908" />
                </radialGradient>
                <radialGradient id="rd-hub" cx="40%" cy="40%" r="65%">
                  <stop offset="0%" stopColor="#1a1714" />
                  <stop offset="100%" stopColor="#040302" />
                </radialGradient>
              </defs>

              <circle cx={cx} cy={cy} r={rOuter} fill="url(#rd-bezel)" stroke={M.rim} strokeWidth="1.5" />
              <circle cx={cx} cy={cy} r={rOuter - 4} fill="none" stroke={M.hairSoft} strokeWidth="1" />

              {[0, 90, 270].map((a) => {
                const [x, y] = polar(rOuter - 4, a);
                return (
                  <g key={a}>
                    <circle cx={x} cy={y} r="3.5" fill="#040302" stroke={M.hair} strokeWidth="0.75" />
                    <line x1={x - 2} y1={y} x2={x + 2} y2={y} stroke={M.rimHi} strokeWidth="0.6" />
                  </g>
                );
              })}

              {detents.map((deg, i) => {
                const [x0, y0] = polar(rOuter - 8, deg);
                const [x1, y1] = polar(rOuter - 16, deg);
                const isActive = hover === i;
                return (
                  <line
                    key={i}
                    x1={x0}
                    y1={y0}
                    x2={x1}
                    y2={y1}
                    stroke={isActive ? M.accent : M.rimHi}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    strokeOpacity={isActive ? 1 : 0.7}
                    style={{ transition: "stroke 250ms ease, stroke-width 250ms ease" }}
                  />
                );
              })}

              {hover != null && (
                <path
                  d={(() => {
                    const a0 = detents[hover] - 14;
                    const a1 = detents[hover] + 14;
                    const [x0, y0] = polar(rRing - 3, a0);
                    const [x1, y1] = polar(rRing - 3, a1);
                    return `M ${x0} ${y0} A ${rRing - 3} ${rRing - 3} 0 0 1 ${x1} ${y1}`;
                  })()}
                  fill="none"
                  stroke={M.accent}
                  strokeWidth="3"
                  strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 6px rgba(227,106,58,0.6))" }}
                />
              )}

              <g
                transform={`rotate(${targetAngle} ${cx} ${cy})`}
                style={{ transition: "transform 700ms cubic-bezier(.4,.05,.2,1)" }}
              >
                <circle cx={cx} cy={cy} r={rDial} fill="url(#rd-dial)" stroke={M.hair} strokeWidth="1" />
                <circle cx={cx} cy={cy} r={rDial - 12} fill="none" stroke={M.hairSoft} strokeWidth="1" />
                <circle cx={cx} cy={cy} r={rDial - 36} fill="none" stroke={M.hairSoft} strokeWidth="0.75" />

                {Array.from({ length: 60 }).map((_, k) => {
                  const a = k * 6;
                  const [x0, y0] = polar(rDial - 1, a);
                  const [x1, y1] = polar(rDial - 6, a);
                  return <line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke={M.rim} strokeWidth="0.5" opacity="0.6" />;
                })}

                <g>
                  <path
                    d={(() => {
                      const baseR = rDial - 30;
                      const half = 6;
                      const tip = polar(rPointer, 0);
                      const baseHalfDeg = (Math.atan2(half, baseR) * 180) / Math.PI;
                      const b1 = polar(baseR, -baseHalfDeg);
                      const b2 = polar(baseR, baseHalfDeg);
                      return `M ${tip[0]} ${tip[1]} L ${b1[0]} ${b1[1]} L ${b2[0]} ${b2[1]} Z`;
                    })()}
                    fill={M.accent}
                    style={{ filter: hover != null ? "drop-shadow(0 0 4px rgba(227,106,58,0.7))" : "none" }}
                  />
                  <line x1={cx + rHub + 6} y1={cy} x2={cx + rDial - 32} y2={cy} stroke={M.accentDim} strokeWidth="2" />
                </g>

                {Array.from({ length: 12 }).map((_, k) => {
                  const a = -90 + k * 30;
                  const [x0, y0] = polar(rDial - 14, a);
                  const [x1, y1] = polar(rDial - 22, a);
                  return <line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke={M.rimHi} strokeWidth="0.8" opacity="0.55" />;
                })}
              </g>

              {/* Center hub */}
              <circle cx={cx} cy={cy} r={rHub} fill="url(#rd-hub)" stroke={M.rim} strokeWidth="1.5" />
              <circle cx={cx} cy={cy} r={rHub - 8} fill="none" stroke={M.hairSoft} strokeWidth="1" />
              <circle cx={cx} cy={cy} r={rHub - 22} fill="none" stroke={M.hairSoft} strokeWidth="0.75" />
              {Array.from({ length: 24 }).map((_, k) => {
                const a = k * 15;
                const [x0, y0] = polar(rHub - 4, a);
                const [x1, y1] = polar(rHub - 8, a);
                return <line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke={M.rim} strokeWidth="0.5" opacity="0.55" />;
              })}
              <circle cx={cx - 11} cy={cy - rHub + 10} r="2.2" fill="#1a1612" stroke={M.rim} strokeWidth="0.5" />
              <circle cx={cx - 11} cy={cy - rHub + 10} r="1" fill={hover != null ? M.accent : M.rim} />
              <circle cx={cx + 11} cy={cy - rHub + 10} r="2.2" fill="#1a1612" stroke={M.rim} strokeWidth="0.5" />
              <circle cx={cx + 11} cy={cy - rHub + 10} r="1" fill={M.rimHi} />
              <circle cx={cx} cy={cy} r={4} fill="#0a0908" stroke={M.rim} strokeWidth="0.6" />
              <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke={M.rimHi} strokeWidth="0.6" />
              <line x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} stroke={M.rimHi} strokeWidth="0.6" />
              <text
                x={cx}
                y={cy + rHub - 22}
                textAnchor="middle"
                style={{ fontFamily: M.mono, fontSize: 7.5, fill: M.inkFaint, letterSpacing: "0.28em" }}
              >
                MODE
              </text>
              <text
                x={cx}
                y={cy + rHub - 10}
                textAnchor="middle"
                style={{ fontFamily: M.mono, fontSize: 6, fill: M.rim, letterSpacing: "0.22em" }}
              >
                ARGON · v3.2 · 60Hz
              </text>
              {[45, 135, 225, 315].map((a) => {
                const [x, y] = polar(rDial - 50, a);
                return (
                  <g key={a}>
                    <circle cx={x} cy={y} r="1.6" fill="#0a0908" stroke={M.hair} strokeWidth="0.4" />
                    <line x1={x - 1} y1={y} x2={x + 1} y2={y} stroke={M.rim} strokeWidth="0.4" />
                  </g>
                );
              })}
            </svg>

            {/* Labels around the dial */}
            {facets.map((facet, i) => {
              const deg = detents[i];
              const isActive = hover === i;
              const someoneActive = hover != null;
              const [outerX, outerY] = polar(rOuter + 14, deg);
              const [innerX, innerY] = polar(rOuter - 16, deg);
              const lx = someoneActive ? innerX : outerX;
              const ly = someoneActive ? innerY : outerY;
              const ox = someoneActive ? "-50%" : "0";
              return (
                <div
                  key={facet.id}
                  onMouseEnter={() => setHover(i)}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: `translate3d(${lx}px, ${ly}px, 0) translate(${ox}, -50%)`,
                    opacity: someoneActive && !isActive ? 0.55 : 1,
                    transition: "transform 620ms cubic-bezier(.33,.0,.2,1), opacity 360ms ease",
                    cursor: "pointer",
                    zIndex: 7,
                    willChange: "transform",
                  }}
                >
                  <div
                    style={{
                      width: 180,
                      opacity: someoneActive ? 0 : 1,
                      transition: "opacity 360ms ease",
                      pointerEvents: someoneActive ? "none" : "auto",
                      position: someoneActive ? "absolute" : "relative",
                      top: 0,
                      left: 0,
                    }}
                  >
                    <div style={{ fontFamily: M.mono, fontSize: 9, letterSpacing: "0.22em", color: M.inkFaint }}>
                      {String(i + 1).padStart(2, "0")} · {facet.kicker}
                    </div>
                    <div
                      style={{
                        fontFamily: M.sans,
                        fontSize: 14,
                        fontWeight: 600,
                        color: M.ink,
                        lineHeight: 1.2,
                        marginTop: 3,
                      }}
                    >
                      {facet.heading}
                    </div>
                    <div
                      style={{
                        fontFamily: M.sans,
                        fontSize: 11,
                        color: M.inkDim,
                        lineHeight: 1.4,
                        marginTop: 2,
                      }}
                    >
                      {facet.subtext}
                    </div>
                  </div>
                  <div
                    style={{
                      opacity: someoneActive ? 1 : 0,
                      transition: "opacity 360ms ease 80ms, border-color 280ms ease, background 280ms ease",
                      pointerEvents: someoneActive ? "auto" : "none",
                      position: someoneActive ? "relative" : "absolute",
                      top: 0,
                      left: 0,
                      padding: "5px 10px",
                      background: isActive ? "rgba(31,22,18,0.96)" : "rgba(11,10,9,0.92)",
                      border: `1px solid ${isActive ? M.accent : M.hair}`,
                      borderRadius: 2,
                      whiteSpace: "nowrap",
                      boxShadow: isActive
                        ? "0 0 12px rgba(227,106,58,0.35), 0 1px 0 rgba(0,0,0,0.4)"
                        : "0 1px 0 rgba(0,0,0,0.4)",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: M.mono,
                        fontSize: 8,
                        letterSpacing: "0.22em",
                        color: isActive ? M.accent : M.inkFaint,
                        transition: "color 200ms ease",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")} · {facet.kicker}
                    </div>
                    <div
                      style={{
                        fontFamily: M.sans,
                        fontSize: 12,
                        fontWeight: 600,
                        color: isActive ? M.ink : M.inkDim,
                        lineHeight: 1.2,
                        marginTop: 2,
                        transition: "color 200ms ease",
                      }}
                    >
                      {facet.heading}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Right-column hover catch */}
            <div
              onMouseLeave={() => setHover(null)}
              style={{
                position: "absolute",
                left: cardLeft - 24,
                top: cardTop - 8,
                width: cardW + 48,
                height: cardH + 16,
                pointerEvents: hover != null ? "auto" : "none",
                zIndex: 4,
              }}
            />

            {/* Big detail card */}
            <div
              style={{
                position: "absolute",
                left: cardLeft,
                top: cardTop,
                width: cardW,
                height: cardH,
                background: "rgba(11,10,9,0.82)",
                border: `1px solid ${hover != null ? M.rim : "transparent"}`,
                backdropFilter: "blur(3px)",
                WebkitBackdropFilter: "blur(3px)",
                padding: "24px 26px",
                boxSizing: "border-box",
                opacity: hover != null ? 1 : 0,
                transform: hover != null ? "translateX(0)" : "translateX(-8px)",
                transition: "opacity 240ms ease, transform 320ms cubic-bezier(.2,.7,.2,1), border-color 220ms ease",
                pointerEvents: hover != null ? "auto" : "none",
                zIndex: 5,
                overflow: "auto",
              }}
              onMouseEnter={() => hover != null && setHover(hover)}
            >
              {hover != null && <ExpandedFacet facet={facets[hover]} />}
            </div>

            {/* Idle hint */}
            <div
              style={{
                position: "absolute",
                left: cardLeft,
                top: cardTop,
                width: cardW,
                height: cardH,
                display: "flex",
                alignItems: "flex-end",
                opacity: hover == null ? 1 : 0,
                transition: "opacity 320ms ease",
                pointerEvents: "none",
                padding: "0 4px 8px",
                boxSizing: "border-box",
                zIndex: 2,
              }}
            >
              <div style={{ fontFamily: M.mono, fontSize: 9, letterSpacing: "0.22em", color: M.inkFaint }}>
                ◴ ROTATE TO INSPECT
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "12px 22px 14px 22px",
                borderTop: `1px solid ${M.hairSoft}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: M.mono,
                fontSize: 9.5,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: M.inkFaint,
                background: "linear-gradient(to top, rgba(11,10,9,0.95), rgba(11,10,9,0))",
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              <span style={{ color: M.ink }}>{footerLeft}</span>
              <span style={{ display: "flex", gap: 14, pointerEvents: "auto" }}>
                <span style={{ cursor: "pointer" }}>EDIT</span>
                <span style={{ color: M.accent, cursor: "pointer" }}>OPEN ↗</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ExpandedFacet({ facet }: { facet: Facet }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div
          style={{
            fontFamily: M.mono,
            fontSize: 10,
            letterSpacing: "0.24em",
            color: M.accent,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          {facet.kicker}
        </div>
        <div
          style={{
            fontFamily: M.sans,
            fontSize: 26,
            fontWeight: 600,
            lineHeight: 1.1,
            color: M.ink,
            letterSpacing: "-0.012em",
          }}
        >
          {facet.heading}
        </div>
        <div style={{ fontFamily: M.sans, fontSize: 13.5, lineHeight: 1.5, color: M.inkDim, marginTop: 6 }}>
          {facet.subtext}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${M.hair}`, paddingTop: 14 }}>
        {facet.detail.map(([k, v]) => (
          <div
            key={k}
            style={{
              display: "grid",
              gridTemplateColumns: "88px 1fr",
              gap: 14,
              padding: "7px 0",
              fontSize: 12.5,
              lineHeight: 1.45,
            }}
          >
            <div
              style={{
                fontFamily: M.mono,
                fontSize: 9.5,
                color: M.inkFaint,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                paddingTop: 2,
              }}
            >
              {k}
            </div>
            <div style={{ color: M.ink }}>{v}</div>
          </div>
        ))}
      </div>

      {facet.secondary && (
        <div>
          <div
            style={{
              fontFamily: M.mono,
              fontSize: 9,
              letterSpacing: "0.22em",
              color: M.inkFaint,
              textTransform: "uppercase",
              marginBottom: 8,
              paddingBottom: 8,
              borderBottom: `1px solid ${M.hairSoft}`,
            }}
          >
            {facet.secondary.label}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {facet.secondary.rows.map(([k, v], idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontSize: 12,
                  color: M.ink,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: M.inkDim }}>{k}</span>
                <span
                  style={{
                    fontFamily: facet.secondary!.mono ? M.mono : M.sans,
                    letterSpacing: facet.secondary!.mono ? "0.04em" : "normal",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {facet.note && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: 12,
            borderTop: `1px dashed ${M.hairSoft}`,
            fontSize: 11.5,
            color: M.inkDim,
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          {facet.note}
        </div>
      )}
    </div>
  );
}
