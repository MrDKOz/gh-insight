import { useState, useRef, useCallback } from "react";
import type { FunctionComponent } from "react";
import type { TimelineItem } from "../types";
import { MS, fmtDate, itemEndDate, COLORS, hoverCardPos } from "../utils/utils";

type Props = {
  items: TimelineItem[];
};

const L = 52, R = 16, T = 28, B = 44, W = 800, H = 280;
const CW = W - L - R;
const CH = H - T - B;

const COL = {
  issue:    COLORS.issue,
  prMerged: COLORS.prMerged,
  prClosed: COLORS.prClosed,
  axis:     COLORS.chartAxis,
  grid:     COLORS.chartGrid,
  label:    COLORS.chartAxis,
  median:   "#1a7f37",
  mean:     "#d97706",
};

type Pt = {
  item: TimelineItem;
  endDate: string;
  endMs: number;
  days: number;
  col: string;
  typeLabel: string;
};

type Hover = {
  x: number;
  y: number;
  pt: Pt;
  url: string;
};

const CycleTime: FunctionComponent<Props> = ({ items }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const pts: Pt[] = items.flatMap((item) => {
    const endDate = itemEndDate(item);
    if (!endDate) return [];
    const days = Math.round(
      (new Date(endDate).getTime() - new Date(item.createdAt).getTime()) / MS,
    );
    const col =
      item.type === "issue" ? COL.issue
        : item.mergedAt     ? COL.prMerged
                            : COL.prClosed;
    const typeLabel =
      item.type === "issue"  ? "Issue"
        : item.mergedAt      ? "PR (merged)"
                             : "PR (closed)";
    return [{ item, endDate, endMs: new Date(endDate).getTime(), days, col, typeLabel }];
  });

  if (pts.length === 0) {
    return <p className="tl-empty">No completed items to plot cycle times for.</p>;
  }

  const endTimes = pts.map((p) => p.endMs);
  const minTime  = Math.min(...endTimes);
  const maxTime  = Math.max(...endTimes);
  const totalMs  = maxTime - minTime || 1;
  const maxDays  = Math.max(...pts.map((p) => p.days), 1);

  const yStep   = maxDays <= 14 ? 1 : maxDays <= 56 ? 7 : Math.ceil(maxDays / 8) * (maxDays > 100 ? 10 : 7);
  const yLabels = Array.from({ length: Math.floor(maxDays / yStep) + 1 }, (_, i) => i * yStep);

  const pxFn = (ms: number)   => L + ((ms - minTime) / totalMs) * CW;
  const pyFn = (days: number) => T + (1 - days / maxDays) * CH;

  const sorted = [...pts.map((p) => p.days)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean   = Math.round(sorted.reduce((s, d) => s + d, 0) / sorted.length);
  const showMean = mean !== median && Math.abs(pyFn(mean) - pyFn(median)) > 16;

  const numX   = Math.min(8, pts.length);
  const xTimes = Array.from({ length: numX }, (_, i) =>
    minTime + (totalMs * i) / Math.max(numX - 1, 1),
  );

  const svgPts = pts.map((p) => ({ x: pxFn(p.endMs), y: pyFn(p.days) }));

  const CLUSTER_R = 14;
  const SPREAD_STEP = 13;
  const spreadOffsets: { dy: number }[] = pts.map(() => ({ dy: 0 }));
  if (hoveredIdx !== null) {
    const { x: hx, y: hy } = svgPts[hoveredIdx];
    const cluster = pts
      .map((_, i) => i)
      .filter((i) => {
        const dx = svgPts[i].x - hx, dy = svgPts[i].y - hy;
        return Math.sqrt(dx * dx + dy * dy) < CLUSTER_R;
      });
    if (cluster.length > 1) {
      cluster.sort((a, b) => svgPts[a].y - svgPts[b].y);
      cluster.forEach((idx, rank) => {
        spreadOffsets[idx] = { dy: (rank - (cluster.length - 1) / 2) * SPREAD_STEP };
      });
    }
  }

  const onEnter = useCallback((e: React.MouseEvent, p: Pt, idx: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, pt: p, url: p.item.url });
    setHoveredIdx(idx);
  }, []);

  const cardStyle = hover
    ? hoverCardPos(hover.x, hover.y, wrapRef.current?.offsetWidth ?? 800, 230, 96)
    : {};

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ position: "relative" }}>
      {hover && (
        <a
          className="bd-hovercard bd-hovercard--link"
          style={cardStyle}
          href={hover.url}
          target="_blank"
          rel="noreferrer"
        >
          <span className="bd-hovercard-date">
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: hover.pt.col, marginRight: 5, verticalAlign: "middle" }} />
            {hover.pt.typeLabel} #{hover.pt.item.number}
          </span>
          <span className="ct-hovercard-title">{hover.pt.item.title}</span>
          <span className="bd-hovercard-count">
            {hover.pt.days} day{hover.pt.days !== 1 ? "s" : ""}
          </span>
          <span className="bd-hovercard-date">
            {fmtDate(hover.pt.item.createdAt)} → {fmtDate(hover.pt.endDate)}
          </span>
        </a>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-label="Cycle time scatter chart"
        onMouseLeave={() => { setHover(null); setHoveredIdx(null); }}
      >
        {yLabels.map((d) => (
          <line key={d}
            x1={L} y1={pyFn(d).toFixed(1)} x2={L + CW} y2={pyFn(d).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        <line
          x1={L} y1={pyFn(median).toFixed(1)} x2={L + CW} y2={pyFn(median).toFixed(1)}
          stroke={COL.median} strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={L + 4} y={pyFn(median) - 4} textAnchor="start"
          fill={COL.median} fontSize={10} fontFamily="inherit">
          median {median}d
        </text>

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

        {pts.map((p, i) => (
          <g key={i}
            style={{ transition: "transform 0.15s ease" }}
            transform={`translate(0, ${spreadOffsets[i].dy})`}
          >
            <circle
              cx={svgPts[i].x.toFixed(1)} cy={svgPts[i].y.toFixed(1)}
              r={5} fill={p.col} opacity={0.82}
              className="ct-dot"
              onMouseEnter={(e) => onEnter(e, p, i)}
              onClick={() => window.open(p.item.url, "_blank", "noreferrer")} />
          </g>
        ))}

        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((d) => (
          <text key={d} x={L - 6} y={pyFn(d) + 4} textAnchor="end"
            fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {d}d
          </text>
        ))}

        {xTimes.map((t, i) => (
          <text key={i} x={pxFn(t)} y={T + CH + 20}
            textAnchor={i === 0 ? "start" : i === numX - 1 ? "end" : "middle"}
            fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(t).toISOString())}
          </text>
        ))}

        <text x={12} y={T + CH / 2} textAnchor="middle"
          fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label"
          transform={`rotate(-90 12 ${T + CH / 2})`}>
          Days to close
        </text>
      </svg>
    </div>
  );
};

export { CycleTime };
