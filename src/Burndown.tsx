import type { TimelineItem } from './types';

interface Props {
  items: TimelineItem[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const L = 48;   // chart left padding (for y-axis labels)
const R = 12;   // chart right padding
const T = 12;   // chart top padding
const B = 36;   // chart bottom padding (for x-axis labels)
const W = 800;  // SVG viewBox width
const H = 280;  // SVG viewBox height
const CW = W - L - R; // chart area width
const CH = H - T - B; // chart area height

export default function Burndown({ items }: Props) {
  const issues = items.filter(i => i.type === 'issue');

  if (issues.length === 0) {
    return <p className="tl-empty">No issues to plot a burndown for.</p>;
  }

  const MS = 86_400_000;
  const todayMs = Date.now();

  const allTs = issues.flatMap(i => [
    new Date(i.createdAt).getTime(),
    i.closedAt ? new Date(i.closedAt).getTime() : todayMs,
  ]);
  const minTime = Math.min(...allTs);
  const maxTime = Math.max(Math.max(...allTs), todayMs);
  const totalDays = Math.max(Math.ceil((maxTime - minTime) / MS), 1);

  // Daily open issue count
  const points = Array.from({ length: totalDays + 1 }, (_, i) => {
    const t = minTime + i * MS;
    const count = issues.filter(issue => {
      const created = new Date(issue.createdAt).getTime();
      const closed = issue.closedAt ? new Date(issue.closedAt).getTime() : Infinity;
      return created <= t && closed > t;
    }).length;
    return { t, count };
  });

  const maxCount = Math.max(...points.map(p => p.count), 1);

  const px = (i: number) => L + (i / (points.length - 1)) * CW;
  const py = (count: number) => T + (1 - count / maxCount) * CH;

  // Line + area paths
  const linePath = points
    .map(({ count }, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(count).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${(L + CW).toFixed(1)},${(T + CH).toFixed(1)} L${L.toFixed(1)},${(T + CH).toFixed(1)} Z`;

  // X axis: up to 8 evenly-spaced labels
  const numXLabels = Math.min(8, points.length);
  const xLabelIndices = Array.from({ length: numXLabels }, (_, i) =>
    Math.round((i / (numXLabels - 1)) * (points.length - 1)),
  );

  // Y axis: 5 labels from 0 to maxCount
  const yLabels = Array.from({ length: 5 }, (_, i) => Math.round((maxCount * i) / 4));

  // Today marker
  const todayFrac = Math.min((todayMs - minTime) / (maxTime - minTime), 1);
  const todayX = (L + todayFrac * CW).toFixed(1);
  const showToday = todayMs >= minTime;

  // Current open count annotation
  const currentOpen = points[points.length - 1].count;

  return (
    <div className="burndown-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label="Burndown chart"
      >
        {/* Horizontal grid lines */}
        {yLabels.map(count => (
          <line
            key={count}
            x1={L} y1={py(count).toFixed(1)}
            x2={L + CW} y2={py(count).toFixed(1)}
            className="bd-grid"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} className="bd-area" />

        {/* Line */}
        <path d={linePath} className="bd-line" />

        {/* Today marker */}
        {showToday && (
          <g>
            <line
              x1={todayX} y1={T}
              x2={todayX} y2={T + CH}
              className="bd-today"
            />
            <text x={parseFloat(todayX) + 4} y={T + 11} className="bd-today-label">
              Today
            </text>
          </g>
        )}

        {/* X axis baseline */}
        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} className="bd-axis" />

        {/* Y axis baseline */}
        <line x1={L} y1={T} x2={L} y2={T + CH} className="bd-axis" />

        {/* Y axis labels */}
        {yLabels.map(count => (
          <text key={count} x={L - 6} y={py(count) + 4} className="bd-label bd-label--y">
            {count}
          </text>
        ))}

        {/* X axis labels */}
        {xLabelIndices.map(i => (
          <text
            key={i}
            x={px(i)}
            y={T + CH + 22}
            className="bd-label bd-label--x"
          >
            {formatDate(new Date(points[i].t).toISOString())}
          </text>
        ))}

        {/* Current open count callout */}
        <text x={L + CW} y={T - 2} className="bd-label bd-label--callout">
          {currentOpen} open
        </text>
      </svg>
    </div>
  );
}
