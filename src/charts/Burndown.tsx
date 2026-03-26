import { useState, useRef } from "react";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { TimelineItem } from "../types";
import { MS, fmtDate, COLORS, hoverCardPos } from "../utils/utils";

type Props = {
  items: TimelineItem[];
};

const L = 48; // left padding (y-axis labels)
const R = 16;
const T = 24;
const B = 36;
const W = 800;
const H = 280;
const CW = W - L - R;
const CH = H - T - B;

// Hardcoded fallback colours used as SVG presentation attributes so
// html-to-image captures them correctly (CSS custom properties don't
// resolve inside the cloned document it creates).
const C = {
  area: "rgba(9,105,218,0.12)",
  line: COLORS.issue,
  grid: COLORS.chartGrid,
  axis: COLORS.chartAxis,
  today: "rgba(248,81,73,0.7)",
  todayLabel: "rgba(248,81,73,0.9)",
  label: COLORS.chartAxis,
  callout: "#24292f",
  cursor: "rgba(87, 96, 106, 0.5)",
};

type HoverInfo = {
  x: number;
  y: number;
  date: string;
  count: number;
  svgX: number;
};

const Burndown: FunctionComponent<Props> = ({ items }) => {
  const issues = items.filter((i) => i.type === "issue");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  if (issues.length === 0) {
    return <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", py: 2.5 }}>No issues to plot a burndown for.</Typography>;
  }

  const todayMs = Date.now();
  const hasOpenIssues = issues.some((i) => !i.closedAt);

  // X-axis range: end at the last close date for fully-closed milestones.
  // Only extend to today when issues are still open, otherwise all closed
  // data gets squashed to the left when today is months/years later.
  const createdTs = issues.map((i) => new Date(i.createdAt).getTime());
  const closedTs = issues.filter((i) => i.closedAt).map((i) => new Date(i.closedAt!).getTime());
  const minTime = Math.min(...createdTs);
  const maxTime = hasOpenIssues
    ? Math.max(...[...createdTs, ...closedTs], todayMs)
    : Math.max(...[...createdTs, ...closedTs]);
  const totalDays = Math.max(Math.ceil((maxTime - minTime) / MS), 1);

  const points = Array.from({ length: totalDays + 1 }, (_, i) => {
    const t = minTime + i * MS;
    const count = issues.filter((issue) => {
      const created = new Date(issue.createdAt).getTime();
      const closed = issue.closedAt ? new Date(issue.closedAt).getTime() : Infinity;
      return created <= t && closed > t;
    }).length;
    return { t, count };
  });

  const maxCount = Math.max(...points.map((p) => p.count), 1);

  const pxFn = (i: number) => L + (points.length > 1 ? (i / (points.length - 1)) * CW : CW / 2);
  const pyFn = (count: number) => T + (1 - count / maxCount) * CH;

  const linePath = points
    .map(({ count }, i) => `${i === 0 ? "M" : "L"}${pxFn(i).toFixed(1)},${pyFn(count).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${(L + CW).toFixed(1)},${(T + CH).toFixed(1)} L${L.toFixed(1)},${(T + CH).toFixed(1)} Z`;

  const numXLabels = Math.min(8, points.length);
  const xLabelIndices = Array.from({ length: numXLabels }, (_, i) =>
    Math.round((i / Math.max(numXLabels - 1, 1)) * (points.length - 1)),
  );

  const yStep = maxCount <= 15 ? 1 : maxCount <= 40 ? 2 : Math.ceil(maxCount / 15);
  const yLabels = Array.from({ length: Math.floor(maxCount / yStep) + 1 }, (_, i) => i * yStep);

  const showToday = todayMs >= minTime && todayMs <= maxTime;
  const todayFrac = (todayMs - minTime) / (maxTime - minTime);
  const todayXNum = L + todayFrac * CW;
  const todayX = todayXNum.toFixed(1);
  const todayFlipLeft = todayFrac > 0.85;

  const currentOpen = points[points.length - 1].count;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wrapX = e.clientX - rect.left;
    const svgX = (wrapX / rect.width) * W;
    if (svgX >= L && svgX <= L + CW) {
      const frac = (svgX - L) / CW;
      const ptIdx = Math.max(0, Math.min(points.length - 1, Math.round(frac * (points.length - 1))));
      const { t, count } = points[ptIdx];
      setHover({ x: wrapX, y: e.clientY - rect.top, date: fmtDate(new Date(t).toISOString()), count, svgX: pxFn(ptIdx) });
    } else {
      setHover(null);
    }
  };

  const hoverCardStyle = hover ? hoverCardPos(hover.x, hover.y, wrapRef.current?.offsetWidth ?? 800, 180, 52) : {};

  return (
    <div className="burndown-wrap" ref={wrapRef} style={{ position: "relative" }} onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}>
      {hover && (
        <Paper elevation={2} sx={{ position: "absolute", display: "flex", flexDirection: "column", gap: "5px", minWidth: 148, px: 1.5, py: 1, pointerEvents: "none", zIndex: 50, ...hoverCardStyle }}>
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>{hover.date}</Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#0969da", flexShrink: 0 }} />
            {hover.count} open issue{hover.count !== 1 ? "s" : ""}
          </Box>
        </Paper>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-label="Burndown chart"
      >
        {yLabels.map((count) => (
          <line
            key={count}
            x1={L}
            y1={pyFn(count).toFixed(1)}
            x2={L + CW}
            y2={pyFn(count).toFixed(1)}
            stroke={C.grid}
            strokeWidth={1}
            strokeDasharray="4 3"
            className="chart-grid"
          />
        ))}

        <path d={areaPath} fill={C.area} />

        <path d={linePath} fill="none" stroke={C.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hover && (
          <>
            <line
              x1={hover.svgX.toFixed(1)} y1={T}
              x2={hover.svgX.toFixed(1)} y2={T + CH}
              stroke={C.cursor} strokeWidth={1.5} strokeDasharray="4 3"
              style={{ pointerEvents: "none" }}
            />
            <circle
              cx={hover.svgX.toFixed(1)} cy={pyFn(hover.count).toFixed(1)}
              r={4} fill={C.line} style={{ pointerEvents: "none" }}
            />
          </>
        )}

        {showToday && (
          <g>
            <line x1={todayX} y1={T} x2={todayX} y2={T + CH} stroke={C.today} strokeWidth={2} strokeDasharray="5 3" />
            <text
              x={todayFlipLeft ? todayXNum - 4 : todayXNum + 4}
              y={T + 11}
              textAnchor={todayFlipLeft ? "end" : "start"}
              fill={C.todayLabel}
              fontSize={11}
              fontFamily="inherit"
            >
              Today
            </text>
          </g>
        )}

        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={C.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T} x2={L} y2={T + CH} stroke={C.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((count) => (
          <text
            key={count}
            x={L - 6}
            y={pyFn(count) + 4}
            textAnchor="end"
            fill={C.label}
            fontSize={11}
            fontFamily="inherit"
            className="chart-label"
          >
            {count}
          </text>
        ))}

        {xLabelIndices.map((ptIdx, labelIdx) => (
          <text
            key={ptIdx}
            x={pxFn(ptIdx)}
            y={T + CH + 22}
            textAnchor={labelIdx === 0 ? "start" : labelIdx === numXLabels - 1 ? "end" : "middle"}
            fill={C.label}
            fontSize={11}
            fontFamily="inherit"
            className="chart-label"
          >
            {fmtDate(new Date(points[ptIdx].t).toISOString())}
          </text>
        ))}

        <text
          x={L + CW - 4}
          y={T - 6}
          textAnchor="end"
          fill={C.callout}
          fontSize={12}
          fontWeight="bold"
          fontFamily="inherit"
          className="bd-callout-text"
        >
          {currentOpen} open
        </text>
      </svg>
    </div>
  );
};

export { Burndown };
