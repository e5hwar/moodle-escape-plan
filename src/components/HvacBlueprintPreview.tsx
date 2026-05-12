// 2D HVAC plan drawing — used as the backplate of the Rotary Dial preview.
// Pure SVG so it can be composed inside another panel.

const WIDTH = 520;
const HEIGHT = 720;
const WALL = "#3a342e";
const HVAC = "#6a5f53";
const HINT = "#2a2520";

const TOP = 96;
const BOT = HEIGHT - 84;
const oL = 26;
const oR = 26;
const W = WIDTH - oL - oR;
const H = BOT - TOP;
const tw = 4;

function Diffuser({ cx, cy, s }: { cx: number; cy: number; s: number }) {
  return (
    <g stroke={HVAC} fill="none" strokeWidth="1.05">
      <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} />
      <line x1={cx - s / 2} y1={cy - s / 2} x2={cx + s / 2} y2={cy + s / 2} strokeWidth="0.65" />
      <line x1={cx + s / 2} y1={cy - s / 2} x2={cx - s / 2} y2={cy + s / 2} strokeWidth="0.65" />
    </g>
  );
}

function RoundTerm({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g stroke={HVAC} fill="none" strokeWidth="1">
      <circle cx={cx} cy={cy} r={r} />
      <circle cx={cx} cy={cy} r={r * 0.55} strokeWidth="0.6" />
    </g>
  );
}

function Bubble({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g stroke={HVAC} fill="#0a0908" strokeWidth="0.9">
      <circle cx={cx} cy={cy} r={r} />
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} strokeWidth="0.5" />
    </g>
  );
}

function Hex({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts = [0, 60, 120, 180, 240, 300]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      return `${cx + r * Math.cos(rad)},${cy + r * Math.sin(rad)}`;
    })
    .join(" ");
  return <polygon points={pts} stroke={HVAC} fill="#0a0908" strokeWidth="0.85" />;
}

export function HvacBlueprint2DContents() {
  const vX = [oL + W * 0.32, oL + W * 0.66];
  const hY = [TOP + H * 0.42, TOP + H * 0.74];
  const trunkY = TOP + 50;
  const tH = 14;
  const ahuX = oL + W - 130;
  const ahuY = trunkY - 20;

  const drops = [
    { x: oL + 80, branchY: hY[0] + 24, diffXs: [oL + 30, oL + 92, oL + 160, oL + 230] },
    { x: vX[0] + 30, branchY: hY[0] + 30, diffXs: [vX[0] + 10, vX[0] + 60, vX[0] + 110] },
    { x: oL + W - 90, branchY: hY[0] + 26, diffXs: [vX[1] + 14, vX[1] + 60, vX[1] + 110] },
    { x: oL + 100, branchY: hY[1] + 30, diffXs: [oL + 30, oL + 110, oL + 200] },
    { x: vX[1] + 30, branchY: hY[1] + 30, diffXs: [vX[1] + 10, vX[1] + 70, vX[1] + 130] },
  ];
  const bH = 10;

  return (
    <>
      <g stroke={HVAC} fill="none">
        <rect x={oL - 12} y={TOP - 16} width={W + 24} height={H + 32} strokeWidth="0.8" />
        <rect x={oL - 6} y={TOP - 10} width={W + 12} height={H + 20} strokeWidth="0.5" />
        {[
          [oL - 16, TOP - 20],
          [oL + W + 16, TOP - 20],
          [oL - 16, BOT + 20],
          [oL + W + 16, BOT + 20],
        ].map(([x, y], k) => {
          const dx = k % 2 ? -10 : 10;
          const dy = k > 1 ? -10 : 10;
          return (
            <g key={k} strokeWidth="1">
              <line x1={x} y1={y} x2={x + dx} y2={y} />
              <line x1={x} y1={y} x2={x} y2={y + dy} />
            </g>
          );
        })}
      </g>

      <g stroke={WALL} fill="none" strokeWidth="0.85">
        <rect x={oL} y={TOP} width={W} height={H} />
        <rect x={oL + tw} y={TOP + tw} width={W - 2 * tw} height={H - 2 * tw} strokeWidth="0.65" />
      </g>

      <g stroke={WALL} fill="none" strokeWidth="0.7">
        <line x1={vX[0]} y1={TOP + tw} x2={vX[0]} y2={hY[0] - 18} />
        <line x1={vX[0]} y1={hY[0] - 4} x2={vX[0]} y2={hY[1] - 4} />
        <line x1={vX[0]} y1={hY[1] + 14} x2={vX[0]} y2={BOT - tw} />
        <line x1={vX[1]} y1={TOP + tw} x2={vX[1]} y2={hY[0] - 4} />
        <line x1={vX[1]} y1={hY[0] - 4} x2={vX[1]} y2={hY[1] - 18} />
        <line x1={vX[1]} y1={hY[1] - 4} x2={vX[1]} y2={BOT - tw} />
        <line x1={oL + tw} y1={hY[0]} x2={vX[0] - 18} y2={hY[0]} />
        <line x1={vX[0]} y1={hY[0]} x2={vX[1]} y2={hY[0]} />
        <line x1={vX[1] + 14} y1={hY[0]} x2={oL + W - tw} y2={hY[0]} />
        <line x1={oL + tw} y1={hY[1]} x2={vX[0]} y2={hY[1]} />
        <line x1={vX[0] + 14} y1={hY[1]} x2={vX[1] - 14} y2={hY[1]} />
        <line x1={vX[1]} y1={hY[1]} x2={oL + W - tw} y2={hY[1]} />
        <g strokeWidth="0.55">
          <path d={`M ${vX[0]} ${hY[0] - 18} A 14 14 0 0 1 ${vX[0] + 14} ${hY[0] - 4}`} />
          <path d={`M ${vX[1]} ${hY[1] - 18} A 14 14 0 0 0 ${vX[1] - 14} ${hY[1] - 4}`} />
          <path d={`M ${vX[0] - 18} ${hY[0]} A 18 18 0 0 1 ${vX[0]} ${hY[0] + 18}`} />
        </g>
        <g strokeWidth="0.55">
          <rect x={oL + 14} y={TOP + 16} width={28} height={20} />
          <rect x={oL + 50} y={TOP + 16} width={28} height={20} />
          <ellipse cx={oL + 110} cy={TOP + 28} rx={14} ry={8} />
          <rect x={vX[0] + 14} y={TOP + 18} width={26} height={20} />
          <rect x={vX[0] + 14} y={TOP + 44} width={26} height={20} />
          <rect x={vX[1] + 12} y={TOP + 18} width={24} height={14} />
          <ellipse cx={vX[1] + 24} cy={TOP + 44} rx={10} ry={6} />
          <rect x={oL + 16} y={hY[1] + 14} width={48} height={28} />
          <rect x={vX[0] + 16} y={hY[1] + 14} width={36} height={28} />
          <rect x={vX[0] + 16} y={hY[0] + 14} width={36} height={20} />
          <rect x={vX[1] + 14} y={hY[1] + 14} width={42} height={28} />
          {Array.from({ length: 5 }).map((_, k) => (
            <line key={k} x1={oL + 16} y1={hY[0] + 16 + k * 8} x2={oL + 96} y2={hY[0] + 16 + k * 8} strokeWidth="0.45" />
          ))}
          <rect x={oL + 16} y={hY[0] + 12} width={80} height={48} />
          <line x1={oL + 16} y1={hY[0] + 60} x2={oL + 96} y2={hY[0] + 12} strokeWidth="0.5" />
        </g>
      </g>

      <g stroke={HVAC} fill="none" strokeWidth="1.4">
        <line x1={oL + 60} y1={trunkY - tH / 2} x2={ahuX} y2={trunkY - tH / 2} />
        <line x1={oL + 60} y1={trunkY + tH / 2} x2={ahuX} y2={trunkY + tH / 2} />
        <line x1={oL + 60} y1={trunkY - tH / 2} x2={oL + 60} y2={trunkY + tH / 2} />
        <line x1={oL + 60} y1={trunkY} x2={ahuX} y2={trunkY} stroke={HINT} strokeWidth="0.5" strokeDasharray="6 4" />
        <line x1={oL + 60} y1={trunkY - tH / 2} x2={oL + 46} y2={trunkY - tH / 2 - 4} />
        <line x1={oL + 60} y1={trunkY + tH / 2} x2={oL + 46} y2={trunkY + tH / 2 + 4} />
        <line x1={oL + 46} y1={trunkY - tH / 2 - 4} x2={oL + 46} y2={trunkY + tH / 2 + 4} />
      </g>

      <g stroke={HVAC} fill="#0a0908" strokeWidth="1.5">
        <rect x={ahuX} y={ahuY} width={88} height={56} />
        <line x1={ahuX + 22} y1={ahuY} x2={ahuX + 22} y2={ahuY + 56} strokeWidth="0.7" />
        <line x1={ahuX + 50} y1={ahuY} x2={ahuX + 50} y2={ahuY + 56} strokeWidth="0.7" />
        {Array.from({ length: 6 }).map((_, k) => (
          <line key={k} x1={ahuX + 2} y1={ahuY + 4 + k * 8.5} x2={ahuX + 20} y2={ahuY + 4 + k * 8.5} stroke={HVAC} strokeWidth="0.55" />
        ))}
        <path
          d={`M ${ahuX + 24} ${ahuY + 8} q 4 6 8 0 t 8 0 t 8 0 M ${ahuX + 24} ${ahuY + 22} q 4 6 8 0 t 8 0 t 8 0 M ${ahuX + 24} ${ahuY + 36} q 4 6 8 0 t 8 0 t 8 0 M ${ahuX + 24} ${ahuY + 50} q 4 6 8 0 t 8 0 t 8 0`}
          fill="none"
          stroke={HVAC}
          strokeWidth="0.9"
        />
        <circle cx={ahuX + 68} cy={ahuY + 28} r={13} strokeWidth="1" />
        <line x1={ahuX + 60} y1={ahuY + 22} x2={ahuX + 76} y2={ahuY + 34} strokeWidth="0.8" />
        <line x1={ahuX + 76} y1={ahuY + 22} x2={ahuX + 60} y2={ahuY + 34} strokeWidth="0.8" />
        <circle cx={ahuX + 68} cy={ahuY + 28} r={2.5} fill={HVAC} stroke="none" />
      </g>

      <g stroke={HVAC} fill="#0a0908" strokeWidth="1">
        <rect x={ahuX + 56} y={TOP + 6} width={20} height={ahuY - TOP - 6} />
        <ellipse cx={ahuX + 66} cy={TOP + 6} rx={10} ry={3} />
      </g>

      <RoundTerm cx={ahuX + 102} cy={ahuY + 28} r={9} />
      <line x1={ahuX + 88} y1={ahuY + 28} x2={ahuX + 93} y2={ahuY + 28} stroke={HVAC} strokeWidth="1.2" />

      {[oL + 100, oL + 200, oL + 320].map((gx, k) => (
        <g key={k}>
          <line x1={gx} y1={trunkY - tH / 2} x2={gx} y2={trunkY - tH / 2 - 14} stroke={HVAC} strokeWidth="1" />
          <circle cx={gx} cy={trunkY - tH / 2 - 22} r={7} stroke={HVAC} fill="#0a0908" strokeWidth="0.9" />
          <line x1={gx} y1={trunkY - tH / 2 - 22} x2={gx + 4} y2={trunkY - tH / 2 - 26} stroke={HVAC} strokeWidth="0.7" />
        </g>
      ))}

      {drops.map((d, i) => {
        const xs = d.diffXs;
        const x0 = Math.min(d.x - bH / 2, ...xs) - 6;
        const x1 = Math.max(d.x + bH / 2, ...xs) + 6;
        return (
          <g key={i}>
            <g stroke={HVAC} fill="none" strokeWidth="1.1">
              <line x1={d.x - bH / 2} y1={trunkY + tH / 2} x2={d.x - bH / 2} y2={d.branchY + bH / 2} />
              <line x1={d.x + bH / 2} y1={trunkY + tH / 2} x2={d.x + bH / 2} y2={d.branchY + bH / 2} />
              <line x1={d.x - bH / 2} y1={trunkY + tH / 2} x2={d.x + bH / 2} y2={trunkY + tH / 2} strokeWidth="0.7" />
              <line
                x1={d.x - bH / 2 - 3}
                y1={(trunkY + d.branchY) / 2 - 5}
                x2={d.x + bH / 2 + 3}
                y2={(trunkY + d.branchY) / 2 + 5}
                strokeWidth="1.1"
              />
              <circle cx={d.x} cy={(trunkY + d.branchY) / 2} r={1.5} fill={HVAC} stroke="none" />
            </g>
            <g stroke={HVAC} fill="none" strokeWidth="1.05">
              <line x1={x0} y1={d.branchY - bH / 2} x2={x1} y2={d.branchY - bH / 2} />
              <line x1={x0} y1={d.branchY + bH / 2} x2={x1} y2={d.branchY + bH / 2} />
              <line x1={x0} y1={d.branchY - bH / 2} x2={x0} y2={d.branchY + bH / 2} />
              <line x1={x1} y1={d.branchY - bH / 2} x2={x1} y2={d.branchY + bH / 2} />
            </g>
            {xs.map((dx, j) => {
              const dy = d.branchY + 22;
              return (
                <g key={j}>
                  <line x1={dx} y1={d.branchY + bH / 2} x2={dx} y2={dy - 8} stroke={HVAC} strokeWidth="0.95" />
                  <Diffuser cx={dx} cy={dy} s={14} />
                </g>
              );
            })}
          </g>
        );
      })}

      <g stroke={HVAC} fill="none" strokeWidth="0.85">
        <path
          d={`M ${ahuX + 88} ${ahuY + 6} L ${oL + W - 18} ${ahuY + 6} L ${oL + W - 18} ${BOT - 60} L ${oL + W - 80} ${BOT - 60}`}
          strokeDasharray="4 3"
        />
        <path
          d={`M ${ahuX + 88} ${ahuY + 14} L ${oL + W - 26} ${ahuY + 14} L ${oL + W - 26} ${BOT - 52} L ${oL + W - 80} ${BOT - 52}`}
          strokeDasharray="2 2"
        />
        <rect x={oL + W - 116} y={BOT - 70} width={36} height={28} stroke={HVAC} fill="#0a0908" />
        <circle cx={oL + W - 98} cy={BOT - 56} r={9} stroke={HVAC} strokeWidth="0.9" />
        <path
          d={`M ${oL + W - 105} ${BOT - 60} q 7 -4 14 0 M ${oL + W - 105} ${BOT - 56} q 7 -4 14 0 M ${oL + W - 105} ${BOT - 52} q 7 -4 14 0`}
          stroke={HVAC}
          strokeWidth="0.7"
        />
      </g>

      <g>
        <line x1={oL + 4} y1={TOP - 24} x2={oL + W - 4} y2={TOP - 24} stroke={HINT} strokeWidth="0.6" />
        {[oL + 4, oL + W * 0.32, oL + W * 0.66, oL + W - 4].map((x, k) => (
          <g key={k}>
            <line x1={x - 4} y1={TOP - 24} x2={x + 4} y2={TOP - 24} stroke={HINT} strokeWidth="0.6" />
            <line x1={x} y1={TOP - 28} x2={x} y2={TOP - 4} stroke={HINT} strokeWidth="0.4" />
          </g>
        ))}
        <line x1={oL + 4} y1={BOT + 24} x2={oL + W - 4} y2={BOT + 24} stroke={HINT} strokeWidth="0.6" />
        {[oL + 4, oL + W * 0.25, oL + W * 0.5, oL + W * 0.75, oL + W - 4].map((x, k) => (
          <g key={k}>
            <line x1={x} y1={BOT + 20} x2={x} y2={BOT + 28} stroke={HINT} strokeWidth="0.6" />
            <line x1={x} y1={BOT + 4} x2={x} y2={BOT + 20} stroke={HINT} strokeWidth="0.4" />
          </g>
        ))}
        <line x1={oL - 24} y1={TOP + 4} x2={oL - 24} y2={BOT - 4} stroke={HINT} strokeWidth="0.6" />
        {[TOP + 4, TOP + H * 0.42, TOP + H * 0.74, BOT - 4].map((y, k) => (
          <g key={k}>
            <line x1={oL - 28} y1={y} x2={oL - 20} y2={y} stroke={HINT} strokeWidth="0.6" />
            <line x1={oL - 28} y1={y} x2={oL - 4} y2={y} stroke={HINT} strokeWidth="0.4" />
          </g>
        ))}
      </g>

      <Hex cx={oL + 50} cy={TOP + H * 0.42 + 18} r={9} />
      <Hex cx={oL + W * 0.5} cy={TOP + 90} r={9} />
      <Hex cx={oL + W * 0.66 + 40} cy={TOP + H * 0.74 + 18} r={9} />
      <Hex cx={oL + W - 50} cy={TOP + H * 0.42 - 14} r={9} />
      <Bubble cx={oL + 14} cy={TOP + H * 0.42 + 4} r={10} />
      <Bubble cx={oL + W - 14} cy={TOP + H * 0.74 + 4} r={10} />

      <g stroke={HVAC} fill="none" strokeWidth="0.9">
        <circle cx={oL + 26} cy={BOT - 26} r={13} fill="#0a0908" />
        <path
          d={`M ${oL + 26} ${BOT - 38} L ${oL + 30} ${BOT - 16} L ${oL + 26} ${BOT - 20} L ${oL + 22} ${BOT - 16} Z`}
          fill={HVAC}
          stroke="none"
        />
        <line x1={oL + 26} y1={BOT - 14} x2={oL + 26} y2={BOT - 38} strokeWidth="0.4" />
      </g>

      {(() => {
        const tbX = oL + W - 168;
        const tbY = BOT + 8;
        return (
          <g stroke={HVAC} fill="none" strokeWidth="0.7">
            <rect x={tbX} y={tbY} width={168} height={56} />
            <line x1={tbX} y1={tbY + 18} x2={tbX + 168} y2={tbY + 18} />
            <line x1={tbX} y1={tbY + 36} x2={tbX + 168} y2={tbY + 36} />
            <line x1={tbX + 56} y1={tbY} x2={tbX + 56} y2={tbY + 56} />
            <line x1={tbX + 112} y1={tbY} x2={tbX + 112} y2={tbY + 56} />
            <rect x={tbX + 6} y={tbY + 4} width={44} height={10} strokeWidth="0.5" />
            <line x1={tbX + 10} y1={tbY + 9} x2={tbX + 46} y2={tbY + 9} strokeWidth="0.4" />
            <line x1={tbX + 60} y1={tbY + 4} x2={tbX + 108} y2={tbY + 4} strokeWidth="0.4" />
            <line x1={tbX + 60} y1={tbY + 10} x2={tbX + 108} y2={tbY + 10} strokeWidth="0.4" />
            <line x1={tbX + 60} y1={tbY + 14} x2={tbX + 90} y2={tbY + 14} strokeWidth="0.4" />
            <line x1={tbX + 116} y1={tbY + 4} x2={tbX + 164} y2={tbY + 4} strokeWidth="0.4" />
            <line x1={tbX + 116} y1={tbY + 10} x2={tbX + 150} y2={tbY + 10} strokeWidth="0.4" />
            <line x1={tbX + 116} y1={tbY + 14} x2={tbX + 158} y2={tbY + 14} strokeWidth="0.4" />
            <line x1={tbX + 6} y1={tbY + 24} x2={tbX + 50} y2={tbY + 24} strokeWidth="0.4" />
            <line x1={tbX + 6} y1={tbY + 30} x2={tbX + 44} y2={tbY + 30} strokeWidth="0.4" />
            <line x1={tbX + 60} y1={tbY + 24} x2={tbX + 108} y2={tbY + 24} strokeWidth="0.4" />
            <line x1={tbX + 60} y1={tbY + 30} x2={tbX + 100} y2={tbY + 30} strokeWidth="0.4" />
            <line x1={tbX + 116} y1={tbY + 24} x2={tbX + 164} y2={tbY + 24} strokeWidth="0.4" />
            <line x1={tbX + 116} y1={tbY + 30} x2={tbX + 156} y2={tbY + 30} strokeWidth="0.4" />
            <rect x={tbX + 116} y={tbY + 40} width={48} height={14} stroke={HVAC} strokeWidth="0.6" />
          </g>
        );
      })()}

      <g stroke={HVAC} fill="none" strokeWidth="0.8">
        <path
          d={`M ${oL + W - 22} ${TOP + 8} L ${oL + W - 8} ${TOP + 22} L ${oL + W - 36} ${TOP + 22} Z`}
          fill="#0a0908"
        />
      </g>

      <g stroke={HVAC} fill="none" strokeWidth="0.7">
        <line x1={oL + 60} y1={BOT + 36} x2={oL + 160} y2={BOT + 36} />
        {[0, 25, 50, 75, 100].map((p) => (
          <line key={p} x1={oL + 60 + p} y1={BOT + 32} x2={oL + 60 + p} y2={BOT + 40} strokeWidth="0.5" />
        ))}
        <rect x={oL + 60} y={BOT + 33} width={25} height={6} fill={HVAC} stroke="none" />
        <rect x={oL + 110} y={BOT + 33} width={25} height={6} fill={HVAC} stroke="none" />
      </g>
    </>
  );
}

export const BLUEPRINT_W = WIDTH;
export const BLUEPRINT_H = HEIGHT;
