import { useState, useRef } from 'react';
import type { TimelineItem } from './types';

interface Props {
  items: TimelineItem[];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Returns the Monday of the ISO week containing `ms` (midnight UTC). */
function weekStart(ms: number): number {
  const d = new Date(ms);
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=Mon … 6=Sun
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime();
}

const L = 48, R = 16, T = 20, B = 44, W = 800, H = 280;
const CW = W - L - R;
const CH = H - T - B;

const COL = {
  issue:    '#0969da',
  prMerged: '#8250df',
  prClosed: '#dc3545',
  axis:     '#57606a',
  grid:     '#d0d7de',
  label:    '#57606a',
};

interface Week {
  startMs: number;
  endMs:   number;
  issues:  number;
  merged:  number;
  closed:  number;
}

interface Hover {
  x: number; y: number;
  week: Week;
}

export default function Velocity({ items }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // Bucket completed items by calendar week
  const buckets = new Map<number, Week>();
  for (const item of items) {
    const endDate =
      item.type === 'issue' ? item.closedAt : (item.mergedAt ?? item.closedAt);
    if (!endDate) continue;
    const ws = weekStart(new Date(endDate).getTime());
    if (!buckets.has(ws)) {
      buckets.set(ws, { startMs: ws, endMs: ws + 6 * 86_400_000, issues: 0, merged: 0, closed: 0 });
    }
    const w = buckets.get(ws)!;
    if (item.type === 'issue')      w.issues++;
    else if (item.mergedAt)         w.merged++;
    else                            w.closed++;
  }

  const weeks = [...buckets.values()].sort((a, b) => a.startMs - b.startMs);

  if (weeks.length === 0) {
    return <p className="tl-empty">No completed items to plot velocity for.</p>;
  }

  const maxTotal = Math.max(...weeks.map(w => w.issues + w.merged + w.closed), 1);

  const pyFn = (count: number) => T + (1 - count / maxTotal) * CH;

  const slotW   = CW / weeks.length;
  const barW    = Math.min(Math.max(slotW * 0.72, 6), 80);
  const barX    = (i: number) => L + i * slotW + (slotW - barW) / 2;

  // Y labels — every integer when small, stepped otherwise
  const yStep   = maxTotal <= 12 ? 1 : maxTotal <= 30 ? 2 : Math.ceil(maxTotal / 8);
  const yLabels = Array.from({ length: Math.floor(maxTotal / yStep) + 1 }, (_, i) => i * yStep);

  // X axis — up to 8 labels (week start dates)
  const numX      = Math.min(8, weeks.length);
  const xIndices  = Array.from({ length: numX }, (_, i) =>
    Math.round((i / Math.max(numX - 1, 1)) * (weeks.length - 1)),
  );

  const onEnter = (e: React.MouseEvent, week: Week) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, week });
  };

  const cardStyle = (() => {
    if (!hover) return {};
    const w = wrapRef.current?.offsetWidth ?? 800;
    return {
      top:  hover.y < 100 ? hover.y + 14 : hover.y - 94,
      ...(hover.x > w - 200 ? { right: w - hover.x + 14 } : { left: hover.x + 14 }),
    };
  })();

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      {hover && (
        <div className="bd-hovercard" style={cardStyle}>
          <span className="bd-hovercard-date">
            {fmtDate(new Date(hover.week.startMs).toISOString())} – {fmtDate(new Date(hover.week.endMs).toISOString())}
          </span>
          {hover.week.issues > 0 && (
            <span className="bd-hovercard-count">
              <span className="bd-hovercard-dot" style={{ background: COL.issue }} />
              {hover.week.issues} issue{hover.week.issues !== 1 ? 's' : ''} closed
            </span>
          )}
          {hover.week.merged > 0 && (
            <span className="bd-hovercard-count">
              <span className="bd-hovercard-dot" style={{ background: COL.prMerged }} />
              {hover.week.merged} PR{hover.week.merged !== 1 ? 's' : ''} merged
            </span>
          )}
          {hover.week.closed > 0 && (
            <span className="bd-hovercard-count">
              <span className="bd-hovercard-dot" style={{ background: COL.prClosed }} />
              {hover.week.closed} PR{hover.week.closed !== 1 ? 's' : ''} closed
            </span>
          )}
          <span className="bd-hovercard-date" style={{ borderTop: '1px solid #d0d7de', paddingTop: 4, marginTop: 2 }}>
            Total: {hover.week.issues + hover.week.merged + hover.week.closed}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label="Velocity bar chart"
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid */}
        {yLabels.map(c => (
          <line key={c}
            x1={L} y1={pyFn(c).toFixed(1)} x2={L + CW} y2={pyFn(c).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" />
        ))}

        {/* Stacked bars: issues (bottom) → merged PRs → closed PRs (top) */}
        {weeks.map((week, i) => {
          const bx     = barX(i);
          const bottom = T + CH;
          const hIssue  = (week.issues / maxTotal) * CH;
          const hMerged = (week.merged / maxTotal) * CH;
          const hClosed = (week.closed / maxTotal) * CH;
          const yIssue  = bottom - hIssue;
          const yMerged = yIssue  - hMerged;
          const yClosed = yMerged - hClosed;

          return (
            <g key={i}>
              {week.issues > 0 && (
                <rect x={bx.toFixed(1)} y={yIssue.toFixed(1)}
                  width={barW.toFixed(1)} height={hIssue.toFixed(1)}
                  fill={COL.issue} opacity={0.88} rx={2} />
              )}
              {week.merged > 0 && (
                <rect x={bx.toFixed(1)} y={yMerged.toFixed(1)}
                  width={barW.toFixed(1)} height={hMerged.toFixed(1)}
                  fill={COL.prMerged} opacity={0.88} rx={2} />
              )}
              {week.closed > 0 && (
                <rect x={bx.toFixed(1)} y={yClosed.toFixed(1)}
                  width={barW.toFixed(1)} height={hClosed.toFixed(1)}
                  fill={COL.prClosed} opacity={0.88} rx={2} />
              )}
              {/* Transparent full-height hover target */}
              <rect
                x={bx.toFixed(1)} y={T}
                width={barW.toFixed(1)} height={CH}
                fill="transparent"
                className="vel-hover-area"
                onMouseEnter={e => onEnter(e, week)}
              />
            </g>
          );
        })}

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
        {xIndices.map((wi, li) => (
          <text key={wi}
            x={(barX(wi) + barW / 2).toFixed(1)}
            y={T + CH + 20}
            textAnchor={li === 0 ? 'start' : li === numX - 1 ? 'end' : 'middle'}
            fill={COL.label} fontSize={11} fontFamily="inherit">
            {fmtDate(new Date(weeks[wi].startMs).toISOString())}
          </text>
        ))}

        {/* Legend */}
        {[
          { col: COL.issue,    label: 'Issues closed' },
          { col: COL.prMerged, label: 'PRs merged' },
          { col: COL.prClosed, label: 'PRs closed' },
        ].map(({ col, label }, i) => (
          <g key={i} transform={`translate(${L + CW - 160 + i * 0}, ${T + i * 15})`}>
            <rect x={0} y={-8} width={10} height={10} fill={col} rx={2} />
            <text x={14} y={0} fill={COL.label} fontSize={10} fontFamily="inherit">{label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
