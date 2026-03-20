import type { TimelineItem } from './types';

interface Props {
  items: TimelineItem[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const L = 48;   // chart left padding (for y-axis labels)
const R = 12;   // chart right padding
const T = 20;   // chart top padding
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

  const hasOpenIssues = issues.some(i => !i.closedAt);

  // X-axis range: end at the last close date when all issues are resolved,
  // or today when issues are still open. Avoids squashing closed-milestone data.
  const createdTs = issues.map(i => new Date(i.createdAt).getTime());
  const closedTs = issues.filter(i => i.closedAt).map(i => new Date(i.closedAt!).getTime());
  const minTime = Math.min(...createdTs);
  const maxTime = hasOpenIssues
    ? Math.max(...[...createdTs, ...closedTs], todayMs)
    : Math.max(...[...createdTs, ...closedTs]);
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

  const px = (i: number) => L + (points.length > 1 ? (i / (points.length - 1)) * CW : CW / 2);
  const py = (count: number) => T + (1 - count / maxCount) * CH;

  // Line + area paths
  const linePath = points
    .map(({ count }, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(count).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${(L + CW).toFixed(1)},${(T + CH).toFixed(1)} L${L.toFixed(1)},${(T + CH).toFixed(1)} Z`;

  // X axis: up to 8 evenly-spaced labels
  const numXLabels = Math.min(8, points.length);
  const xLabelIndices = Array.from({ length: numXLabels }, (_, i) =>
    Math.round((i / Math.max(numXLabels - 1, 1)) * (points.length - 1)),
  );

  // Y axis: 5 labels from 0 to maxCount
  const yLabels = Array.from({ length: 5 }, (_, i) => Math.round((maxCount * i) / 4));

  // Today marker (only shown if today is within the chart range)
  const showToday = todayMs >= minTime && todayMs <= maxTime;
  const todayFrac = (todayMs - minTime) / (maxTime - minTime);
  const todayXNum = L + todayFrac * CW;
  const todayX = todayXNum.toFixed(1);
  // Flip "Today" label to left of line when near the right edge
  const todayLabelRight = todayFrac > 0.85;

  // Current open count annotation — anchor to left edge so it never clips
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

        {/* Hover dots — one per day, invisible until hovered */}
        {points.map(({ t, count }, i) => (
          <circle
            key={`dot-${i}`}
            cx={px(i).toFixed(1)}
            cy={py(count).toFixed(1)}
            r={6}
            className="bd-dot"
          >
            <title>{formatDate(new Date(t).toISOString())}: {count} open issue{count !== 1 ? 's' : ''}</title>
          </circle>
        ))}

        {/* Today marker */}
        {showToday && (
          <g>
            <line
              x1={todayX} y1={T}
              x2={todayX} y2={T + CH}
              className="bd-today"
            />
            <text
              x={todayLabelRight ? todayXNum - 4 : todayXNum + 4}
              y={T + 11}
              textAnchor={todayLabelRight ? 'end' : 'start'}
              className="bd-today-label"
            >
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
          <text key={count} x={L - 6} y={py(count) + 4} textAnchor="end" className="bd-label">
            {count}
          </text>
        ))}

        {/* X axis labels */}
        {xLabelIndices.map(i => (
          <text
            key={i}
            x={px(i)}
            y={T + CH + 22}
            textAnchor="middle"
            className="bd-label"
          >
            {formatDate(new Date(points[i].t).toISOString())}
          </text>
        ))}

        {/* Current open count callout — anchored left of right edge so it never clips */}
        <text
          x={L + CW - 4}
          y={T - 6}
          textAnchor="end"
          className="bd-label bd-label--callout"
        >
          {currentOpen} open
        </text>
      </svg>
    </div>
  );
}
