import type { MilestoneMeta, TimelineItem } from "../types";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useMemo, useRef, useState } from "react";
import { CHART_EMPTY_STATE_SX, HOVER_CARD_BASE_SX, MS, fmtDate, hoverCardPos, makeChartColors, pluralize, upperBound } from "../utils/utils";
import { ChartLegend } from "./ChartLegend";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  colorblindMode: boolean;
};

const L = 52; // left padding (y-axis labels)
const R = 20;
const T = 28;
const B = 40;
const W = 1200;
const H = 320;
const CW = W - L - R;
const CH = H - T - B;

type HoverInfo = {
  x: number;
  y: number;
  date: string;
  count: number;
  svgX: number;
  msColor?: string;
  msTitle?: string;
};

const BurndownInner: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, colorblindMode }) => {
  const COL = makeChartColors(colorblindMode);
  // chart-specific colours not covered by the shared factory
  const areaFill   = colorblindMode ? "rgba(0,114,178,0.12)" : "rgba(9,105,218,0.12)";
  const calloutColor = "#24292f"; // bd-callout-text CSS class overrides this in dark mode
  const isMulti = milestones.length > 1;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const issues = items.filter((i) => i.type === "issue");

  const todayMs = Date.now();
  const hasOpenIssues = issues.some((i) => !i.closedAt);

  // ── Time range ────────────────────────────────────────────────────────────────
  const allCreatedTs = issues.map((i) => new Date(i.createdAt).getTime());
  const allClosedTs  = issues.filter((i) => i.closedAt).map((i) => new Date(i.closedAt!).getTime());
  const minTime = issues.length > 0 ? Math.min(...allCreatedTs) : 0;
  const maxTime = issues.length > 0
    ? (hasOpenIssues
        ? Math.max(...allCreatedTs, ...allClosedTs, todayMs)
        : Math.max(...allCreatedTs, ...allClosedTs))
    : 0;
  const totalDays = Math.max(Math.ceil((maxTime - minTime) / MS), 1);

  // ── Per-milestone series (for both single and multi mode) ─────────────────────
  const msSeries = useMemo(() => {
    if (issues.length === 0) {return [];}
    return milestones.map((ms) => {
      const msIssues = issues.filter((i) => i.milestoneNumber === ms.number);
      if (msIssues.length === 0) {return { ms, points: [] };}
      const sortedCreatedTs = msIssues.map((i) => new Date(i.createdAt).getTime()).sort((a, b) => a - b);
      const sortedClosedTs  = msIssues.filter((i) => i.closedAt).map((i) => new Date(i.closedAt!).getTime()).sort((a, b) => a - b);
      const points = Array.from({ length: totalDays + 1 }, (_, idx) => {
        const t = minTime + idx * MS;
        return { t, count: upperBound(sortedCreatedTs, t) - upperBound(sortedClosedTs, t) };
      });
      return { ms, points };
    }).filter((s) => s.points.length > 0);
  }, [issues, milestones, totalDays, minTime]);

  // Single-milestone path (first series)
  const singleSeries = msSeries[0];

  // ── Axis scales ───────────────────────────────────────────────────────────────
  const maxCount = useMemo(() => {
    if (issues.length === 0) {return 1;}
    if (isMulti) {
      return Math.max(...msSeries.flatMap((s) => s.points.map((p) => p.count)), 1);
    }
    return Math.max(...(singleSeries?.points.map((p) => p.count) ?? [1]), 1);
  }, [issues.length, isMulti, msSeries, singleSeries]);

  const pxFn = (i: number, numPts: number) => L + (numPts > 1 ? (i / (numPts - 1)) * CW : CW / 2);
  const pyFn = (count: number) => T + (1 - count / maxCount) * CH;

  const yStep   = maxCount <= 15 ? 1 : maxCount <= 40 ? 2 : Math.ceil(maxCount / 15);
  const yLabels = Array.from({ length: Math.floor(maxCount / yStep) + 1 }, (_, i) => i * yStep);

  const showToday = todayMs >= minTime && todayMs <= maxTime;
  const todayFrac = (todayMs - minTime) / (maxTime - minTime);
  const todayXNum = L + todayFrac * CW;
  const todayX    = todayXNum.toFixed(1);
  const todayFlipLeft = todayFrac > 0.85;

  // X-axis labels (from full time range, not per-series)
  const numXLabels  = Math.min(8, totalDays + 1);
  const xLabelTimes = Array.from({ length: numXLabels }, (_, i) =>
    minTime + Math.round((i / Math.max(numXLabels - 1, 1)) * totalDays) * MS,
  );

  // ── Weekend bands ─────────────────────────────────────────────────────────────
  const weekendBands = useMemo(() => {
    if (!highlightWeekends || issues.length === 0) {return [];}
    const bands: Array<{ x: string; w: string }> = [];
    for (let i = 0; i <= totalDays; i++) {
      const day = new Date(minTime + i * MS);
      if (day.getUTCDay() !== 6) {continue;}
      const x = L + (i / totalDays) * CW;
      const w = Math.min((2 / totalDays) * CW, CW - (x - L));
      bands.push({ x: x.toFixed(1), w: w.toFixed(1) });
    }
    return bands;
  }, [highlightWeekends, totalDays, minTime, issues.length]);

  if (issues.length === 0) {
    return <Typography sx={CHART_EMPTY_STATE_SX}>No issues to plot a burndown for.</Typography>;
  }

  // ── Hover handler ─────────────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wrapX = e.clientX - rect.left;
    const svgX  = (wrapX / rect.width) * W;
    if (svgX < L || svgX > L + CW) { setHover(null); return; }

    const frac  = (svgX - L) / CW;
    const ptIdx = Math.max(0, Math.min(totalDays, Math.round(frac * totalDays)));

    if (isMulti) {
      // Show the milestone with the most open issues at this point in time
      let best: { count: number; series: typeof msSeries[0] } | null = null;
      for (const s of msSeries) {
        const count = s.points[ptIdx]?.count ?? 0;
        if (!best || count > best.count) {best = { count, series: s };}
      }
      if (!best) { setHover(null); return; }
      const svgXPx = pxFn(ptIdx, totalDays + 1);
      setHover({
        x: wrapX, y: e.clientY - rect.top,
        date: fmtDate(new Date(minTime + ptIdx * MS).toISOString()),
        count: best.count,
        svgX: svgXPx,
        msColor: best.series.ms.color,
        msTitle: best.series.ms.title,
      });
    } else if (singleSeries) {
      // ptIdx is clamped to [0, totalDays] and points has totalDays+1 elements
      const { t, count } = singleSeries.points[ptIdx]!;
      setHover({ x: wrapX, y: e.clientY - rect.top, date: fmtDate(new Date(t).toISOString()), count, svgX: pxFn(ptIdx, singleSeries.points.length) });
    }
  };

  const hoverCardStyle = hover ? hoverCardPos(hover.x, hover.y, wrapRef.current?.offsetWidth ?? 800, 200, 68) : {};

  return (
    <Box role="presentation" className="burndown-wrap" ref={wrapRef} style={{ position: "relative" }} onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}>
      {hover && (
        <Paper elevation={2} sx={{ ...HOVER_CARD_BASE_SX, ...hoverCardStyle }}>
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>{hover.date}</Box>
          {hover.msColor && (
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: hover.msColor, flexShrink: 0 }} />
              {hover.msTitle}
            </Box>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: hover.msColor ?? COL.issue, flexShrink: 0 }} />
            {pluralize(hover.count, "open issue")}
          </Box>
        </Paper>
      )}

      <table className="sr-only" aria-label="Burndown chart data">
        <caption>Open issue count over time{isMulti ? " by milestone" : ""}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {isMulti
              ? msSeries.map(({ ms }) => <th key={ms.number} scope="col">{ms.title} (open)</th>)
              : <th scope="col">Open issues</th>}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: totalDays + 1 }, (_, i) => {
            const t = minTime + i * MS;
            return (
              <tr key={t}>
                <td>{fmtDate(new Date(t).toISOString())}</td>
                {isMulti
                  ? msSeries.map(({ ms, points }) => <td key={ms.number}>{points[i]?.count ?? 0}</td>)
                  : <td>{singleSeries?.points[i]?.count ?? 0}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-hidden="true"
      >
        {weekendBands.map((b, idx) => (
          <rect key={idx} x={b.x} y={T} width={b.w} height={CH} fill={COL.weekendBand} className="chart-weekend" />
        ))}

        {yLabels.map((count) => (
          <line key={count}
            x1={L} y1={pyFn(count).toFixed(1)} x2={L + CW} y2={pyFn(count).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        {/* Chart lines (and fill area for single-milestone mode) */}
        {isMulti
          ? msSeries.map(({ ms, points }) => {
              const linePath = points
                .map(({ count }, i) => `${i === 0 ? "M" : "L"}${pxFn(i, points.length).toFixed(1)},${pyFn(count).toFixed(1)}`)
                .join(" ");
              return (
                <path key={ms.number} d={linePath} fill="none" stroke={ms.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
              );
            })
          : singleSeries && (() => {
              const { points } = singleSeries;
              const linePath = points
                .map(({ count }, i) => `${i === 0 ? "M" : "L"}${pxFn(i, points.length).toFixed(1)},${pyFn(count).toFixed(1)}`)
                .join(" ");
              const areaPath = `${linePath} L${(L + CW).toFixed(1)},${(T + CH).toFixed(1)} L${L.toFixed(1)},${(T + CH).toFixed(1)} Z`;
              return (
                <>
                  <path d={areaPath} fill={areaFill} />
                  <path d={linePath} fill="none" stroke={COL.issue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </>
              );
            })()
        }

        {hover && (
          <>
            <line
              x1={hover.svgX.toFixed(1)} y1={T}
              x2={hover.svgX.toFixed(1)} y2={T + CH}
              stroke={COL.cursor} strokeWidth={1.5} strokeDasharray="4 3"
              style={{ pointerEvents: "none" }}
            />
            <circle
              cx={hover.svgX.toFixed(1)} cy={pyFn(hover.count).toFixed(1)}
              r={4} fill={hover.msColor ?? COL.issue} style={{ pointerEvents: "none" }}
            />
          </>
        )}

        {showToday && (
          <g>
            <line x1={todayX} y1={T} x2={todayX} y2={T + CH} stroke={COL.today} strokeWidth={2} strokeDasharray="5 3" />
            <text
              x={todayFlipLeft ? todayXNum - 4 : todayXNum + 4}
              y={T + 11}
              textAnchor={todayFlipLeft ? "end" : "start"}
              fill={COL.todayLabel} fontSize={10} fontFamily="inherit"
            >
              Today
            </text>
          </g>
        )}

        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((count) => (
          <text key={count} x={L - 6} y={pyFn(count) + 4} textAnchor="end"
            fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {count}
          </text>
        ))}

        {xLabelTimes.map((t, li) => (
          <text key={t}
            x={(L + ((t - minTime) / (maxTime - minTime)) * CW).toFixed(1)}
            y={T + CH + 22}
            textAnchor={li === 0 ? "start" : li === numXLabels - 1 ? "end" : "middle"}
            fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(t).toISOString())}
          </text>
        ))}

        {isMulti && (
          <ChartLegend
            items={milestones.map((ms) => ({ color: ms.color, label: ms.title }))}
            cx={L + CW / 2}
            y={T - 8}
            fill={COL.label}
          />
        )}

        {/* Single milestone: "N open" callout */}
        {!isMulti && singleSeries && (
          <text
            x={L + CW - 4}
            y={T - 6}
            textAnchor="end"
            fill={calloutColor}
            fontSize={11}
            fontWeight="bold"
            fontFamily="inherit"
            className="bd-callout-text"
          >
            {singleSeries.points[singleSeries.points.length - 1]!.count} open
          </text>
        )}
      </svg>
    </Box>
  );
};

const Burndown = memo(BurndownInner);

export { Burndown };
