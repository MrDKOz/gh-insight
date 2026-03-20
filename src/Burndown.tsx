import { useState, useRef } from 'react';
import type { TimelineItem } from './types';
import { MS, fmtDate, COLORS, hoverCardPos } from './utils';

interface Props {
  items: TimelineItem[];
}

// SVG chart dimensions
const L = 48;   // left padding (y-axis labels)
const R = 16;   // right padding
const T = 24;   // top padding
const B = 36;   // bottom padding (x-axis labels)
const W = 800;
const H = 280;
const CW = W - L - R;
const CH = H - T - B;

// Hardcoded fallback colours used as SVG presentation attributes so
// html-to-image captures them correctly (CSS custom properties don't
// resolve inside the cloned document it creates).
const C = {
  area:       'rgba(9,105,218,0.12)',
  line:       COLORS.issue,
  grid:       COLORS.chartGrid,
  axis:       COLORS.chartAxis,
  today:      'rgba(248,81,73,0.7)',
  todayLabel: 'rgba(248,81,73,0.9)',
  label:      COLORS.chartAxis,
  callout:    '#24292f',
  dot:        COLORS.issue,
};

interface HoverInfo {
  x: number;
  y: number;
  date: string;
  count: number;
}

export default function Burndown({ items }: Props) {
  const issues = items.filter(i => i.type === 'issue');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  if (issues.length === 0) {
    return <p className="tl-empty">No issues to plot a burndown for.</p>;
  }

  const todayMs = Date.now();
  const hasOpenIssues = issues.some(i => !i.closedAt);

  // X-axis range: end at the last close date for fully-closed milestones.
  // Only extend to today when issues are still open, otherwise all closed
  // data gets squashed to the left when today is months/years later.
  const createdTs = issues.map(i => new Date(i.createdAt).getTime());
  const closedTs  = issues.filter(i => i.closedAt).map(i => new Date(i.closedAt!).getTime());
  const minTime   = Math.min(...createdTs);
  const maxTime   = hasOpenIssues
    ? Math.max(...[...createdTs, ...closedTs], todayMs)
    : Math.max(...[...createdTs, ...closedTs]);
  const totalDays = Math.max(Math.ceil((maxTime - minTime) / MS), 1);

  // Daily open issue count
  const points = Array.from({ length: totalDays + 1 }, (_, i) => {
    const t = minTime + i * MS;
    const count = issues.filter(issue => {
      const created = new Date(issue.createdAt).getTime();
      const closed  = issue.closedAt ? new Date(issue.closedAt).getTime() : Infinity;
      return created <= t && closed > t;
    }).length;
    return { t, count };
  });

  const maxCount = Math.max(...points.map(p => p.count), 1);

  const pxFn = (i: number) =>
    L + (points.length > 1 ? (i / (points.length - 1)) * CW : CW / 2);
  const pyFn = (count: number) => T + (1 - count / maxCount) * CH;

  // Paths
  const linePath = points
    .map(({ count }, i) => `${i === 0 ? 'M' : 'L'}${pxFn(i).toFixed(1)},${pyFn(count).toFixed(1)}`)
    .join(' ');
  const areaPath =
    `${linePath} L${(L + CW).toFixed(1)},${(T + CH).toFixed(1)} L${L.toFixed(1)},${(T + CH).toFixed(1)} Z`;

  // X axis: up to 8 evenly-spaced labels; first anchored start, last anchored end
  const numXLabels   = Math.min(8, points.length);
  const xLabelIndices = Array.from({ length: numXLabels }, (_, i) =>
    Math.round((i / Math.max(numXLabels - 1, 1)) * (points.length - 1)),
  );

  // Y axis: every integer up to maxCount, with a step for large counts
  const yStep  = maxCount <= 15 ? 1 : maxCount <= 40 ? 2 : Math.ceil(maxCount / 15);
  const yLabels = Array.from({ length: Math.floor(maxCount / yStep) + 1 }, (_, i) => i * yStep);

  // Today marker
  const showToday      = todayMs >= minTime && todayMs <= maxTime;
  const todayFrac      = (todayMs - minTime) / (maxTime - minTime);
  const todayXNum      = L + todayFrac * CW;
  const todayX         = todayXNum.toFixed(1);
  const todayFlipLeft  = todayFrac > 0.85;

  const currentOpen = points[points.length - 1].count;

  const handleDotEnter = (e: React.MouseEvent, t: number, count: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, date: fmtDate(new Date(t).toISOString()), count });
  };

  const hoverCardStyle = hover
    ? hoverCardPos(hover.x, hover.y, wrapRef.current?.offsetWidth ?? 800, 180, 52)
    : {};

  return (
    <div className="burndown-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      {/* Hover card */}
      {hover && (
        <div className="bd-hovercard" style={hoverCardStyle}>
          <span className="bd-hovercard-date">{hover.date}</span>
          <span className="bd-hovercard-count">
            <span className="bd-hovercard-dot" />
            {hover.count} open issue{hover.count !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label="Burndown chart"
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines */}
        {yLabels.map(count => (
          <line
            key={count}
            x1={L} y1={pyFn(count).toFixed(1)}
            x2={L + CW} y2={pyFn(count).toFixed(1)}
            stroke={C.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={C.area} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={C.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover dots — invisible until hovered */}
        {points.map(({ t, count }, i) => (
          <circle
            key={`dot-${i}`}
            cx={pxFn(i).toFixed(1)}
            cy={pyFn(count).toFixed(1)}
            r={6}
            fill={C.dot}
            className="bd-dot"
            onMouseEnter={e => handleDotEnter(e, t, count)}
          />
        ))}

        {/* Today marker */}
        {showToday && (
          <g>
            <line
              x1={todayX} y1={T} x2={todayX} y2={T + CH}
              stroke={C.today} strokeWidth={2} strokeDasharray="5 3"
            />
            <text
              x={todayFlipLeft ? todayXNum - 4 : todayXNum + 4}
              y={T + 11}
              textAnchor={todayFlipLeft ? 'end' : 'start'}
              fill={C.todayLabel} fontSize={11} fontFamily="inherit"
            >
              Today
            </text>
          </g>
        )}

        {/* Axes */}
        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={C.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={C.axis} strokeWidth={1} className="chart-axis" />

        {/* Y axis labels — every step value */}
        {yLabels.map(count => (
          <text key={count} x={L - 6} y={pyFn(count) + 4}
            textAnchor="end" fill={C.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {count}
          </text>
        ))}

        {/* X axis labels — first left-anchored, last right-anchored to prevent clipping */}
        {xLabelIndices.map((ptIdx, labelIdx) => (
          <text
            key={ptIdx}
            x={pxFn(ptIdx)}
            y={T + CH + 22}
            textAnchor={labelIdx === 0 ? 'start' : labelIdx === numXLabels - 1 ? 'end' : 'middle'}
            fill={C.label} fontSize={11} fontFamily="inherit" className="chart-label"
          >
            {fmtDate(new Date(points[ptIdx].t).toISOString())}
          </text>
        ))}

        {/* Current open count callout */}
        <text x={L + CW - 4} y={T - 6} textAnchor="end"
          fill={C.callout} fontSize={12} fontWeight="bold" fontFamily="inherit"
          className="bd-callout-text">
          {currentOpen} open
        </text>
      </svg>
    </div>
  );
}
