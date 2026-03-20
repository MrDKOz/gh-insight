import { useState, useRef } from 'react';
import type { TimelineItem } from './types';

interface Props {
  items: TimelineItem[];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const L = 52, R = 16, T = 28, B = 44, W = 800, H = 280;
const CW = W - L - R;
const CH = H - T - B;

const COL = {
  issue:    '#0969da',
  prMerged: '#8250df',
  prClosed: '#dc3545',
  axis:     '#57606a',
  grid:     '#d0d7de',
  label:    '#57606a',
  median:   '#1a7f37',
  mean:     '#d97706',
};

interface Pt {
  item: TimelineItem;
  endDate: string;
  endMs: number;
  days: number;
  col: string;
  typeLabel: string;
}

interface Hover {
  x: number; y: number;
  pt: Pt;
  url: string;
}

export default function CycleTime({ items }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const pts: Pt[] = items.flatMap(item => {
    const endDate =
      item.type === 'issue' ? item.closedAt : (item.mergedAt ?? item.closedAt);
    if (!endDate) return [];
    const days = Math.round(
      (new Date(endDate).getTime() - new Date(item.createdAt).getTime()) / 86_400_000,
    );
    const col =
      item.type === 'issue' ? COL.issue
        : item.mergedAt     ? COL.prMerged
                            : COL.prClosed;
    const typeLabel =
      item.type === 'issue'  ? 'Issue'
        : item.mergedAt      ? 'PR (merged)'
                             : 'PR (closed)';
    return [{ item, endDate, endMs: new Date(endDate).getTime(), days, col, typeLabel }];
  });

  if (pts.length === 0) {
    return <p className="tl-empty">No completed items to plot cycle times for.</p>;
  }

  const endTimes = pts.map(p => p.endMs);
  const minTime  = Math.min(...endTimes);
  const maxTime  = Math.max(...endTimes);
  const totalMs  = maxTime - minTime || 1;
  const maxDays  = Math.max(...pts.map(p => p.days), 1);

  const yStep   = maxDays <= 14 ? 1 : maxDays <= 56 ? 7 : Math.ceil(maxDays / 8) * (maxDays > 100 ? 10 : 7);
  const yLabels = Array.from({ length: Math.floor(maxDays / yStep) + 1 }, (_, i) => i * yStep);

  const pxFn = (ms: number)   => L + ((ms - minTime) / totalMs) * CW;
  const pyFn = (days: number) => T + (1 - days / maxDays) * CH;

  const sorted = [...pts.map(p => p.days)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean   = Math.round(sorted.reduce((s, d) => s + d, 0) / sorted.length);
  const showMean = mean !== median && Math.abs(pyFn(mean) - pyFn(median)) > 16;

  const numX   = Math.min(8, pts.length);
  const xTimes = Array.from({ length: numX }, (_, i) =>
    minTime + (totalMs * i) / Math.max(numX - 1, 1),
  );

  const onEnter = (e: React.MouseEvent, p: Pt) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, pt: p, url: p.item.url });
  };

  const cardStyle = (() => {
    if (!hover) return {};
    const w = wrapRef.current?.offsetWidth ?? 800;
    return {
      top:  hover.y < 110 ? hover.y + 14 : hover.y - 96,
      ...(hover.x > w - 230 ? { right: w - hover.x + 14 } : { left: hover.x + 14 }),
    };
  })();

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      {hover && (
        <a
          className="bd-hovercard bd-hovercard--link"
          style={cardStyle}
          href={hover.url}
          target="_blank"
          rel="noreferrer"
        >
          <span className="bd-hovercard-date">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: hover.pt.col, marginRight: 5, verticalAlign: 'middle' }} />
            {hover.pt.typeLabel} #{hover.pt.item.number}
          </span>
          <span className="ct-hovercard-title">{hover.pt.item.title}</span>
          <span className="bd-hovercard-count">
            {hover.pt.days} day{hover.pt.days !== 1 ? 's' : ''}
          </span>
          <span className="bd-hovercard-date">
            {fmtDate(hover.pt.item.createdAt)} → {fmtDate(hover.pt.endDate)}
          </span>
        </a>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label="Cycle time scatter chart"
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid */}
        {yLabels.map(d => (
          <line key={d}
            x1={L} y1={pyFn(d).toFixed(1)} x2={L + CW} y2={pyFn(d).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        {/* Median reference line */}
        <line
          x1={L} y1={pyFn(median).toFixed(1)} x2={L + CW} y2={pyFn(median).toFixed(1)}
          stroke={COL.median} strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={L + 4} y={pyFn(median) - 4} textAnchor="start"
          fill={COL.median} fontSize={10} fontFamily="inherit">
          median {median}d
        </text>

        {/* Mean reference line (only when visually distinct from median) */}
        {showMean && (
          <>
            <line
              x1={L} y1={pyFn(mean).toFixed(1)} x2={L + CW} y2={pyFn(mean).toFixed(1)}
              stroke={COL.mean} strokeWidth={1.5} strokeDasharray="6 4" />
            <text x={L + 4} y={pyFn(mean) - 4} textAnchor="start"
              fill={COL.mean} fontSize={10} fontFamily="inherit">
              mean {mean}d
            </text>
          </>
        )}

        {/* Data dots */}
        {pts.map((p, i) => (
          <circle key={i}
            cx={pxFn(p.endMs).toFixed(1)} cy={pyFn(p.days).toFixed(1)}
            r={5} fill={p.col} opacity={0.82}
            className="ct-dot"
            onMouseEnter={e => onEnter(e, p)}
            onClick={() => window.open(p.item.url, '_blank', 'noreferrer')} />
        ))}

        {/* Axes */}
        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

        {/* Y labels */}
        {yLabels.map(d => (
          <text key={d} x={L - 6} y={pyFn(d) + 4} textAnchor="end"
            fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {d}d
          </text>
        ))}

        {/* X labels */}
        {xTimes.map((t, i) => (
          <text key={i} x={pxFn(t)} y={T + CH + 20}
            textAnchor={i === 0 ? 'start' : i === numX - 1 ? 'end' : 'middle'}
            fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(t).toISOString())}
          </text>
        ))}

        {/* Rotated Y axis label */}
        <text x={12} y={T + CH / 2} textAnchor="middle"
          fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label"
          transform={`rotate(-90 12 ${T + CH / 2})`}>
          Days to close
        </text>
      </svg>
    </div>
  );
}
