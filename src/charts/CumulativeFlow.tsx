import type { TimelineItem } from "../types";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useRef, useState } from "react";
import { CHART_EMPTY_STATE_SX, FS, HOVER_CARD_BASE_SX, MS, fmtDate, hoverCardPos, itemEndDate, makeChartColors, upperBound } from "../utils/utils";

type Props = {
  items: TimelineItem[];
  highlightWeekends: boolean;
  colorblindMode: boolean;
};

const L = 52, R = 20, T = 24, B = 48, W = 1200, H = 320;
const CW = W - L - R;
const CH = H - T - B;

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
  const COL = makeChartColors(colorblindMode);
  // chart-specific derived colours not in the shared factory
  const closedFill  = colorblindMode ? "rgba(0,114,178,0.22)" : "rgba(9,105,218,0.22)";
  const openFill    = "rgba(209,213,218,0.35)";
  const closedLine  = COL.issue;
  const openedLine  = COL.axis;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  if (items.length === 0) {
    return <Typography sx={CHART_EMPTY_STATE_SX}>No items to plot cumulative flow for.</Typography>;
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
        <Paper elevation={2} sx={{ ...HOVER_CARD_BASE_SX, ...cardStyle }}>
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>{fmtDate(new Date(hovered.t).toISOString())}</Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: openedLine, flexShrink: 0 }} />
            {hovered.opened} created
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: closedLine, flexShrink: 0 }} />
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

      <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
        {[
          { color: closedLine, label: "Completed (cumulative)" },
          { color: openedLine, label: "Created (cumulative)" },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: color, opacity: 0.88, flexShrink: 0 }} />
            <Typography sx={{ fontSize: FS.sm, color: "text.secondary" }}>{label}</Typography>
          </Box>
        ))}
      </Box>

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
          return <rect key={i} x={x.toFixed(1)} y={T} width={w.toFixed(1)} height={CH} fill={COL.weekendBand} className="chart-weekend" />;
        })}

        {yLabels.map((c) => (
          <line key={c}
            x1={L} y1={pyFn(c).toFixed(1)} x2={L + CW} y2={pyFn(c).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        <path d={openBandPath} fill={openFill} />
        <path d={closedAreaPath} fill={closedFill} />

        <path d={openedLinePts} fill="none" stroke={openedLine} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={closedLinePts} fill="none" stroke={closedLine} strokeWidth={2}   strokeLinejoin="round" />

        {hover !== null && hovered !== null && (
          <>
            <line
              x1={hoverSvgX.toFixed(1)} y1={T}
              x2={hoverSvgX.toFixed(1)} y2={T + CH}
              stroke={COL.cursor} strokeWidth={1.5} strokeDasharray="4 3"
              style={{ pointerEvents: "none" }}
            />
            <circle cx={hoverSvgX.toFixed(1)} cy={pyFn(hovered.closed).toFixed(1)} r={4} fill={closedLine} style={{ pointerEvents: "none" }} />
            <circle cx={hoverSvgX.toFixed(1)} cy={pyFn(hovered.opened).toFixed(1)} r={4} fill={openedLine} style={{ pointerEvents: "none" }} />
          </>
        )}

        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((c) => (
          <text key={c} x={L - 6} y={pyFn(c) + 4} textAnchor="end"
            fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {c}
          </text>
        ))}

        {xIndices.map((pi, li) => (
          <text key={pi} x={pxFn(pi)} y={T + CH + 20}
            textAnchor={li === 0 ? "start" : li === numX - 1 ? "end" : "middle"}
            fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(pts[pi]!.t).toISOString())}
          </text>
        ))}

      </svg>
    </Box>
  );
};

const CumulativeFlow = memo(CumulativeFlowInner);

export { CumulativeFlow };
