import type { TimelineItem } from "../types";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useRef, useState } from "react";
import { COLORS, COLORS_CB, MS, fmtDate, hoverCardPos, itemEndDate } from "../utils/utils";

type Props = {
  items: TimelineItem[];
  highlightWeekends: boolean;
  colorblindMode: boolean;
};

const L = 48, R = 16, T = 20, B = 44, W = 800, H = 280;
const CW = W - L - R;
const CH = H - T - B;

const makeCOL = (cb: boolean) => {
  const p = cb ? COLORS_CB : COLORS;
  return {
    closedFill: cb ? "rgba(0,114,178,0.22)"    : "rgba(9,105,218,0.22)",
    openFill:   "rgba(209,213,218,0.35)",
    closedLine: p.issue,
    openedLine: p.chartAxis,
    axis:       p.chartAxis,
    grid:       p.chartGrid,
    label:      p.chartAxis,
    cursor:     "rgba(87, 96, 106, 0.5)",
  };
};

type DayPt = {
  t:      number;
  opened: number;
  closed: number;
};

type HoverState = {
  wrapX: number;
  wrapY: number;
  dayIdx: number;
};

const CumulativeFlowInner: FunctionComponent<Props> = ({ items, highlightWeekends, colorblindMode }) => {
  const COL = makeCOL(colorblindMode);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  if (items.length === 0) {
    return <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", py: 2.5 }}>No items to plot cumulative flow for.</Typography>;
  }

  const allTs = items.flatMap((item) => {
    const end = itemEndDate(item);
    return [new Date(item.createdAt).getTime(), ...(end ? [new Date(end).getTime()] : [])];
  });
  const minTime   = Math.min(...allTs);
  const maxTime   = Math.max(...allTs);
  const totalDays = Math.max(Math.ceil((maxTime - minTime) / MS), 1);

  const sortedOpenedTs = items.map((item) => new Date(item.createdAt).getTime()).sort((a, b) => a - b);
  const sortedClosedTs = items
    .flatMap((item) => { const e = itemEndDate(item); return e ? [new Date(e).getTime()] : []; })
    .sort((a, b) => a - b);

  const upperBound = (sorted: number[], t: number): number => {
    let lo = 0, hi = sorted.length;
    // sorted[mid] is always within bounds: mid = (lo+hi)>>>1, and lo < hi throughout the loop
    while (lo < hi) { const mid = (lo + hi) >>> 1; sorted[mid]! <= t ? (lo = mid + 1) : (hi = mid); }
    return lo;
  };

  const pts: DayPt[] = Array.from({ length: totalDays + 1 }, (_, i) => {
    const t = minTime + i * MS;
    return { t, opened: upperBound(sortedOpenedTs, t), closed: upperBound(sortedClosedTs, t) };
  });

  const maxOpened = Math.max(...pts.map((p) => p.opened), 1);

  const pxFn = (i: number)     => L + (pts.length > 1 ? (i / (pts.length - 1)) * CW : CW / 2);
  const pyFn = (count: number) => T + (1 - count / maxOpened) * CH;

  // Closed area: trace closed line right → drop to x-axis → back left
  const closedLinePts = pts
    .map(({ closed }, i) => `${i === 0 ? "M" : "L"}${pxFn(i).toFixed(1)},${pyFn(closed).toFixed(1)}`)
    .join(" ");
  const closedAreaPath = `${closedLinePts} L${(L + CW).toFixed(1)},${(T + CH).toFixed(1)} L${L.toFixed(1)},${(T + CH).toFixed(1)} Z`;

  // Open band: trace opened line right → trace closed line reversed back left
  const openedLinePts = pts
    .map(({ opened }, i) => `${i === 0 ? "M" : "L"}${pxFn(i).toFixed(1)},${pyFn(opened).toFixed(1)}`)
    .join(" ");
  const closedReversed = [...pts].reverse()
    .map(({ closed }, ri) => `L${pxFn(pts.length - 1 - ri).toFixed(1)},${pyFn(closed).toFixed(1)}`)
    .join(" ");
  const openBandPath = `${openedLinePts} ${closedReversed} Z`;

  const yStep   = maxOpened <= 12 ? 1 : maxOpened <= 30 ? 2 : Math.ceil(maxOpened / 8);
  const yLabels = Array.from({ length: Math.floor(maxOpened / yStep) + 1 }, (_, i) => i * yStep);

  const numX     = Math.min(8, pts.length);
  const xIndices = Array.from({ length: numX }, (_, i) =>
    Math.round((i / Math.max(numX - 1, 1)) * (pts.length - 1)),
  );

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

  // hover.dayIdx is clamped to [0, pts.length-1] in onMouseMove
  const hovered = hover !== null ? pts[hover.dayIdx]! : null;
  const hoverSvgX = hover !== null ? pxFn(hover.dayIdx) : 0;

  const cardStyle = hover
    ? hoverCardPos(hover.wrapX, hover.wrapY, wrapRef.current?.offsetWidth ?? 800, 200, 90)
    : {};

  return (
    <Box
      role="presentation"
      className="chart-wrap"
      ref={wrapRef}
      style={{ position: "relative" }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      {hovered && hover && (
        <Paper elevation={2} sx={{ position: "absolute", display: "flex", flexDirection: "column", gap: "5px", minWidth: 148, px: 1.5, py: 1, pointerEvents: "none", zIndex: 50, ...cardStyle }}>
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>{fmtDate(new Date(hovered.t).toISOString())}</Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: COL.openedLine, flexShrink: 0 }} />
            {hovered.opened} created
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: COL.closedLine, flexShrink: 0 }} />
            {hovered.closed} completed
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600, color: "text.secondary" }}>
            {hovered.opened - hovered.closed} open
          </Box>
        </Paper>
      )}

      <table className="sr-only" aria-label="Cumulative flow data">
        <caption>Cumulative items created and completed over time</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Created (cumulative)</th>
            <th scope="col">Completed (cumulative)</th>
            <th scope="col">Open</th>
          </tr>
        </thead>
        <tbody>
          {pts.map((p) => (
            <tr key={p.t}>
              <td>{fmtDate(new Date(p.t).toISOString())}</td>
              <td>{p.opened}</td>
              <td>{p.closed}</td>
              <td>{p.opened - p.closed}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
        aria-hidden="true"
      >
        {highlightWeekends && Array.from({ length: totalDays + 1 }, (_, i) => {
          const day = new Date(minTime + i * MS);
          if (day.getUTCDay() !== 6) {return null;}
          const x = L + (i / totalDays) * CW;
          const w = Math.min((2 / totalDays) * CW, CW - (x - L));
          return <rect key={i} x={x.toFixed(1)} y={T} width={w.toFixed(1)} height={CH} fill="rgba(0,0,0,0.04)" className="chart-weekend" />;
        })}

        {yLabels.map((c) => (
          <line key={c}
            x1={L} y1={pyFn(c).toFixed(1)} x2={L + CW} y2={pyFn(c).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        <path d={openBandPath} fill={COL.openFill} />
        <path d={closedAreaPath} fill={COL.closedFill} />

        <path d={openedLinePts} fill="none" stroke={COL.openedLine} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={closedLinePts} fill="none" stroke={COL.closedLine} strokeWidth={2}   strokeLinejoin="round" />

        {hover !== null && hovered !== null && (
          <>
            <line
              x1={hoverSvgX.toFixed(1)} y1={T}
              x2={hoverSvgX.toFixed(1)} y2={T + CH}
              stroke={COL.cursor} strokeWidth={1.5} strokeDasharray="4 3"
              style={{ pointerEvents: "none" }}
            />
            <circle cx={hoverSvgX.toFixed(1)} cy={pyFn(hovered.closed).toFixed(1)} r={4} fill={COL.closedLine} style={{ pointerEvents: "none" }} />
            <circle cx={hoverSvgX.toFixed(1)} cy={pyFn(hovered.opened).toFixed(1)} r={4} fill={COL.openedLine} style={{ pointerEvents: "none" }} />
          </>
        )}

        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((c) => (
          <text key={c} x={L - 6} y={pyFn(c) + 4} textAnchor="end"
            fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {c}
          </text>
        ))}

        {xIndices.map((pi, li) => (
          <text key={pi} x={pxFn(pi)} y={T + CH + 20}
            textAnchor={li === 0 ? "start" : li === numX - 1 ? "end" : "middle"}
            fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(pts[pi]!.t).toISOString())}
          </text>
        ))}

        {[
          { col: COL.closedLine, label: "Completed (cumulative)" },
          { col: COL.openedLine, label: "Created (cumulative)" },
        ].map(({ col, label }, i) => (
          <g key={label} transform={`translate(${L + 4}, ${T + i * 15})`}>
            <line x1={0} y1={-3} x2={16} y2={-3} stroke={col} strokeWidth={i === 0 ? 2 : 1.5} />
            <text x={20} y={0} fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">{label}</text>
          </g>
        ))}
      </svg>
    </Box>
  );
};

const CumulativeFlow = memo(CumulativeFlowInner);

export { CumulativeFlow };
