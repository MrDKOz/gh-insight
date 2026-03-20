import { useState, useRef } from 'react';
import type { TimelineItem } from './types';

interface Props {
  items: TimelineItem[];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const L = 48, R = 16, T = 20, B = 44, W = 800, H = 280;
const CW = W - L - R;
const CH = H - T - B;
const MS = 86_400_000;

const COL = {
  closedFill:  'rgba(9,105,218,0.22)',
  openFill:    'rgba(209,213,218,0.35)',
  closedLine:  '#0969da',
  openedLine:  '#57606a',
  axis:        '#57606a',
  grid:        '#d0d7de',
  label:       '#57606a',
  cursor:      'rgba(248,81,73,0.55)',
};

interface DayPt {
  t:      number;
  opened: number;
  closed: number;
}

interface HoverState {
  wrapX: number;
  wrapY: number;
  dayIdx: number;
}

export default function CumulativeFlow({ items }: Props) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  if (items.length === 0) {
    return <p className="tl-empty">No items to plot cumulative flow for.</p>;
  }

  const allTs = items.flatMap(item => {
    const end = item.type === 'issue' ? item.closedAt : (item.mergedAt ?? item.closedAt);
    return [new Date(item.createdAt).getTime(), ...(end ? [new Date(end).getTime()] : [])];
  });
  const minTime   = Math.min(...allTs);
  const maxTime   = Math.max(...allTs);
  const totalDays = Math.max(Math.ceil((maxTime - minTime) / MS), 1);

  const pts: DayPt[] = Array.from({ length: totalDays + 1 }, (_, i) => {
    const t = minTime + i * MS;
    const opened = items.filter(item => new Date(item.createdAt).getTime() <= t).length;
    const closed = items.filter(item => {
      const end = item.type === 'issue' ? item.closedAt : (item.mergedAt ?? item.closedAt);
      return end != null && new Date(end).getTime() <= t;
    }).length;
    return { t, opened, closed };
  });

  const maxOpened = Math.max(...pts.map(p => p.opened), 1);

  const pxFn = (i: number)     => L + (pts.length > 1 ? (i / (pts.length - 1)) * CW : CW / 2);
  const pyFn = (count: number) => T + (1 - count / maxOpened) * CH;

  // Closed area: trace closed line right → drop to x-axis → back left
  const closedLinePts = pts
    .map(({ closed }, i) => `${i === 0 ? 'M' : 'L'}${pxFn(i).toFixed(1)},${pyFn(closed).toFixed(1)}`)
    .join(' ');
  const closedAreaPath = `${closedLinePts} L${(L + CW).toFixed(1)},${(T + CH).toFixed(1)} L${L.toFixed(1)},${(T + CH).toFixed(1)} Z`;

  // Open band: trace opened line right → trace closed line reversed back left
  const openedLinePts = pts
    .map(({ opened }, i) => `${i === 0 ? 'M' : 'L'}${pxFn(i).toFixed(1)},${pyFn(opened).toFixed(1)}`)
    .join(' ');
  const closedReversed = [...pts].reverse()
    .map(({ closed }, ri) => `L${pxFn(pts.length - 1 - ri).toFixed(1)},${pyFn(closed).toFixed(1)}`)
    .join(' ');
  const openBandPath = `${openedLinePts} ${closedReversed} Z`;

  // Y axis labels
  const yStep   = maxOpened <= 12 ? 1 : maxOpened <= 30 ? 2 : Math.ceil(maxOpened / 8);
  const yLabels = Array.from({ length: Math.floor(maxOpened / yStep) + 1 }, (_, i) => i * yStep);

  // X axis labels — up to 8, first/last anchored
  const numX      = Math.min(8, pts.length);
  const xIndices  = Array.from({ length: numX }, (_, i) =>
    Math.round((i / Math.max(numX - 1, 1)) * (pts.length - 1)),
  );

  // Track mouse over the wrapper div, map to day index
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect  = e.currentTarget.getBoundingClientRect();
    const wrapX = e.clientX - rect.left;
    const svgX  = (wrapX / rect.width) * W;
    if (svgX >= L && svgX <= L + CW) {
      const frac   = (svgX - L) / CW;
      const dayIdx = Math.max(0, Math.min(pts.length - 1, Math.round(frac * (pts.length - 1))));
      setHover({ wrapX, wrapY: e.clientY - rect.top, dayIdx });
    } else {
      setHover(null);
    }
  };

  const hovered = hover !== null ? pts[hover.dayIdx] : null;
  const hoverSvgX = hover !== null ? pxFn(hover.dayIdx) : 0;

  const cardStyle = (() => {
    if (!hover) return {};
    const w = wrapRef.current?.offsetWidth ?? 800;
    return {
      top:  hover.wrapY < 120 ? hover.wrapY + 14 : hover.wrapY - 90,
      ...(hover.wrapX > w - 200 ? { right: w - hover.wrapX + 14 } : { left: hover.wrapX + 14 }),
    };
  })();

  return (
    <div
      className="chart-wrap"
      ref={wrapRef}
      style={{ position: 'relative' }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      {hovered && hover && (
        <div className="bd-hovercard" style={cardStyle}>
          <span className="bd-hovercard-date">{fmtDate(new Date(hovered.t).toISOString())}</span>
          <span className="bd-hovercard-count">
            <span className="bd-hovercard-dot" style={{ background: COL.openedLine }} />
            {hovered.opened} created
          </span>
          <span className="bd-hovercard-count">
            <span className="bd-hovercard-dot" style={{ background: COL.closedLine }} />
            {hovered.closed} completed
          </span>
          <span className="bd-hovercard-count" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {hovered.opened - hovered.closed} open
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        aria-label="Cumulative flow diagram"
      >
        {/* Grid */}
        {yLabels.map(c => (
          <line key={c}
            x1={L} y1={pyFn(c).toFixed(1)} x2={L + CW} y2={pyFn(c).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" />
        ))}

        {/* Open band (top area: between opened and closed lines) */}
        <path d={openBandPath} fill={COL.openFill} />

        {/* Closed band (bottom area: from x-axis to closed line) */}
        <path d={closedAreaPath} fill={COL.closedFill} />

        {/* Lines on top of fills */}
        <path d={openedLinePts} fill="none" stroke={COL.openedLine} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={closedLinePts} fill="none" stroke={COL.closedLine} strokeWidth={2}   strokeLinejoin="round" />

        {/* Hover cursor line */}
        {hover !== null && (
          <line
            x1={hoverSvgX.toFixed(1)} y1={T}
            x2={hoverSvgX.toFixed(1)} y2={T + CH}
            stroke={COL.cursor} strokeWidth={1.5} strokeDasharray="4 3"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Axes */}
        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} />

        {/* Y labels */}
        {yLabels.map(c => (
          <text key={c} x={L - 6} y={pyFn(c) + 4} textAnchor="end"
            fill={COL.label} fontSize={11} fontFamily="inherit">
            {c}
          </text>
        ))}

        {/* X labels */}
        {xIndices.map((pi, li) => (
          <text key={pi} x={pxFn(pi)} y={T + CH + 20}
            textAnchor={li === 0 ? 'start' : li === numX - 1 ? 'end' : 'middle'}
            fill={COL.label} fontSize={11} fontFamily="inherit">
            {fmtDate(new Date(pts[pi].t).toISOString())}
          </text>
        ))}

        {/* Legend */}
        {[
          { col: COL.closedLine, label: 'Completed (cumulative)' },
          { col: COL.openedLine, label: 'Created (cumulative)' },
        ].map(({ col, label }, i) => (
          <g key={i} transform={`translate(${L + 4}, ${T + i * 15})`}>
            <line x1={0} y1={-3} x2={16} y2={-3} stroke={col} strokeWidth={i === 0 ? 2 : 1.5} />
            <text x={20} y={0} fill={COL.label} fontSize={10} fontFamily="inherit">{label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
