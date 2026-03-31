import type { BankHoliday } from "../api/bankHolidayApi";
import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent, MouseEvent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useMemo, useRef, useState } from "react";

import { calcBankHolidayBands, calcWeekendBands } from "../utils/chartUtils";
import { makeChartColors } from "../utils/colorUtils";
import { DAY_NAMES, MS_PER_DAY, buildBankHolidayMap, fmtDate } from "../utils/dateUtils";
import { FS, hoverCardPos, pluralize, upperBound } from "../utils/displayUtils";
import { CARD_LABEL_SX, CHART_EMPTY_STATE_SX, DOT_SX, HOVER_CARD_BASE_SX, STAT_ROW_SX } from "../utils/sxTokens";
import { ChartLegend } from "./ChartLegend";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  bankHolidays: BankHoliday[];
  colorblindMode: boolean;
  includePRs: boolean;
};

const PADDING_LEFT   = 52; // left padding (y-axis labels)
const PADDING_RIGHT  = 20;
const PADDING_TOP    = 28;
const PADDING_BOTTOM = 40;
const SVG_WIDTH      = 1200;
const SVG_HEIGHT     = 320;
const CHART_WIDTH    = SVG_WIDTH  - PADDING_LEFT  - PADDING_RIGHT;
const CHART_HEIGHT   = SVG_HEIGHT - PADDING_TOP   - PADDING_BOTTOM;

type HoverInfo = {
  x: number;
  y: number;
  svgX: number;
  date: string;
  holidayName?: string | undefined;
  // single mode
  count?: number;
  // multi mode — all milestones at this date
  series?: Array<{ color: string; title: string; count: number }>;
};

const BurndownInner: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, bankHolidays, colorblindMode, includePRs }) => {
  const chartColors = makeChartColors(colorblindMode);
  const isMulti = milestones.length > 1;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const issues = useMemo(
    () => includePRs ? items : items.filter((i) => i.type === "issue"),
    [items, includePRs],
  );

  const todayMs = Date.now();
  const hasOpenIssues = issues.some((i) => !i.closedAt);

  // ── Time range ────────────────────────────────────────────────────────────────
  const { minTime, maxTime, totalDays } = useMemo(() => {
    const allCreatedTs = issues.map((i) => new Date(i.createdAt).getTime());
    const allClosedTs  = issues.flatMap((i) => i.closedAt ? [new Date(i.closedAt).getTime()] : []);
    const min = issues.length > 0 ? Math.min(...allCreatedTs) : 0;
    const max = issues.length > 0
      ? (hasOpenIssues ? Math.max(...allCreatedTs, ...allClosedTs, todayMs) : Math.max(...allCreatedTs, ...allClosedTs))
      : 0;
    return { minTime: min, maxTime: max, totalDays: Math.max(Math.ceil((max - min) / MS_PER_DAY), 1) };
  }, [issues, hasOpenIssues, todayMs]);

  // ── Per-milestone series (for both single and multi mode) ─────────────────────
  const milestoneSeries = useMemo(() => {
    if (issues.length === 0) {return [];}
    return milestones.map((milestone) => {
      const milestoneIssues = issues.filter((i) => i.milestoneNumber === milestone.number);
      if (milestoneIssues.length === 0) {return { milestone, points: [] };}
      const sortedCreatedTs = milestoneIssues.map((i) => new Date(i.createdAt).getTime()).sort((a, b) => a - b);
      const sortedClosedTs  = milestoneIssues.flatMap((i) => i.closedAt ? [new Date(i.closedAt).getTime()] : []).sort((a, b) => a - b);
      const points = Array.from({ length: totalDays + 1 }, (_, index) => {
        const t = minTime + index * MS_PER_DAY;
        return { t, count: upperBound(sortedCreatedTs, t) - upperBound(sortedClosedTs, t) };
      });
      return { milestone, points };
    }).filter((series) => series.points.length > 0);
  }, [issues, milestones, totalDays, minTime]);

  // Single-milestone path (first series)
  const singleSeries = milestoneSeries[0];

  // ── Axis scales ───────────────────────────────────────────────────────────────
  const maxCount = useMemo(() => {
    if (issues.length === 0) {return 1;}
    if (isMulti) {
      return Math.max(...milestoneSeries.flatMap((s) => s.points.map((p) => p.count)), 1);
    }
    return Math.max(...(singleSeries?.points.map((p) => p.count) ?? [1]), 1);
  }, [issues.length, isMulti, milestoneSeries, singleSeries]);

  const toSvgX = (i: number, numPts: number) => PADDING_LEFT + (numPts > 1 ? (i / (numPts - 1)) * CHART_WIDTH : CHART_WIDTH / 2);
  const toSvgY = (count: number) => PADDING_TOP + (1 - count / maxCount) * CHART_HEIGHT;

  const yStep   = maxCount <= 15 ? 1 : maxCount <= 40 ? 2 : Math.ceil(maxCount / 15);
  const yLabels = Array.from({ length: Math.floor(maxCount / yStep) + 1 }, (_, i) => i * yStep);

  const showToday = todayMs >= minTime && todayMs <= maxTime;
  const todayFrac = (todayMs - minTime) / (maxTime - minTime || 1);
  const todayXNum = PADDING_LEFT + todayFrac * CHART_WIDTH;
  const todayX    = todayXNum.toFixed(1);
  const todayFlipLeft = todayFrac > 0.85;

  // ── Due date markers ──────────────────────────────────────────────────────────
  type DueMarker = { xNum: number; label: string; color: string; flipLeft: boolean };
  type DueMarkerPlaced = DueMarker & { labelY: number; lineX: number };
  const dueMarkers = useMemo((): DueMarker[] => {
    if (issues.length === 0) {return [];}
    const markers: DueMarker[] = [];
    for (const milestone of milestones) {
      if (!milestone.dueOn) {continue;}
      const dueMs = new Date(milestone.dueOn).getTime();
      if (isNaN(dueMs)) {continue;}
      // Only render if dueMs is within the visible range (with a 30-day slack on the right)
      if (dueMs < minTime - MS_PER_DAY || dueMs > maxTime + 30 * MS_PER_DAY) {continue;}
      const frac  = (dueMs - minTime) / (maxTime - minTime);
      const xNum  = PADDING_LEFT + Math.min(frac, 1) * CHART_WIDTH;
      const color = milestone.color;
      const label = `Due ${fmtDate(milestone.dueOn)}`;
      markers.push({ xNum, label, color, flipLeft: frac > 0.85 });
    }
    return markers;
  }, [issues.length, milestones, minTime, maxTime]);

  // Assign vertical label rows and horizontal line offsets so markers don't overlap
  const placedMarkers = useMemo((): DueMarkerPlaced[] => {
    const placed: DueMarkerPlaced[] = [];
    for (const dm of [...dueMarkers].sort((a, b) => a.xNum - b.xNum)) {
      const usedRows = new Set<number>();
      if (showToday && Math.abs(dm.xNum - todayXNum) < 60) {usedRows.add(0);}
      for (const p of placed) {
        if (Math.abs(dm.xNum - p.xNum) < 60) {usedRows.add(Math.round((p.labelY - (PADDING_TOP + 11)) / 11));}
      }
      let row = 0;
      while (usedRows.has(row)) {row++;}
      const sameX = placed.filter((p) => Math.abs(p.xNum - dm.xNum) < 2).length;
      placed.push({ ...dm, labelY: PADDING_TOP + 11 + row * 11, lineX: dm.xNum + sameX * 3 });
    }
    return placed;
  }, [dueMarkers, showToday, todayXNum]);

  // X-axis labels (from full time range, not per-series)
  const numXLabels  = Math.min(8, totalDays + 1);
  const xLabelTimes = Array.from({ length: numXLabels }, (_, i) =>
    minTime + Math.round((i / Math.max(numXLabels - 1, 1)) * totalDays) * MS_PER_DAY,
  );

  // ── Weekend bands ─────────────────────────────────────────────────────────────
  const weekendBands = useMemo(() => {
    if (!highlightWeekends || issues.length === 0) {return [];}
    return calcWeekendBands(minTime, totalDays, PADDING_LEFT, CHART_WIDTH);
  }, [highlightWeekends, totalDays, minTime, issues.length]);

  // ── Bank holiday bands ────────────────────────────────────────────────────────
  const bankHolidayMap = useMemo(() => buildBankHolidayMap(bankHolidays), [bankHolidays]);

  const bankHolidayBands = useMemo(() => {
    if (bankHolidays.length === 0 || issues.length === 0) {return [];}
    return calcBankHolidayBands(bankHolidays, minTime, totalDays, PADDING_LEFT, CHART_WIDTH);
  }, [bankHolidays, totalDays, minTime, issues.length]);

  if (issues.length === 0) {
    return <Typography sx={CHART_EMPTY_STATE_SX}>No {includePRs ? "items" : "issues"} to plot a burndown for.</Typography>;
  }

  // ── Hover handler ─────────────────────────────────────────────────────────────
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wrapX = e.clientX - rect.left;
    const svgX  = (wrapX / rect.width) * SVG_WIDTH;
    if (svgX < PADDING_LEFT || svgX > PADDING_LEFT + CHART_WIDTH) { setHover(null); return; }

    const frac  = (svgX - PADDING_LEFT) / CHART_WIDTH;
    const ptIdx = Math.max(0, Math.min(totalDays - 1, Math.floor(frac * totalDays)));
    const ptMs  = minTime + ptIdx * MS_PER_DAY;
    const ptIso = new Date(ptMs).toISOString();
    const ptDate = `${DAY_NAMES[new Date(ptMs).getUTCDay()]} · ${fmtDate(ptIso)}`;
    const holidayName = bankHolidayMap.get(ptIso.slice(0, 10));

    if (isMulti) {
      if (milestoneSeries.length === 0) { setHover(null); return; }
      setHover({
        x: wrapX, y: e.clientY - rect.top,
        svgX: toSvgX(ptIdx, totalDays + 1),
        date: ptDate, holidayName,
        series: milestoneSeries.map((s) => ({
          color: s.milestone.color,
          title: s.milestone.title,
          count: s.points[ptIdx]?.count ?? 0,
        })),
      });
    } else if (singleSeries) {
      const point = singleSeries.points[ptIdx];
      if (!point) { return; }
      const { count } = point;
      setHover({
        x: wrapX, y: e.clientY - rect.top,
        svgX: toSvgX(ptIdx, singleSeries.points.length),
        date: ptDate, holidayName,
        series: [{ color: singleSeries.milestone.color, title: singleSeries.milestone.title, count }],
      });
    }
  };

  const hoverCardH = hover?.series ? 36 + hover.series.length * 24 : 68;
  const hoverCardStyle = hover ? hoverCardPos(hover.x, hover.y, containerRef.current?.offsetWidth ?? 800, hoverCardH + 40, hoverCardH) : {};

  return (
    <Box role="presentation" className="chart-wrap" ref={containerRef} style={{ position: "relative" }} onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}>
      {hover && (
        <Paper elevation={2} sx={{ ...HOVER_CARD_BASE_SX, ...hoverCardStyle }}>
          <Box sx={CARD_LABEL_SX}>{hover.date}</Box>
          {hover.holidayName && <Box sx={{ ...CARD_LABEL_SX, color: "error.main" }}>{hover.holidayName}</Box>}
          {hover.series
            ? hover.series.map((s) => (
                <Box key={s.title} sx={STAT_ROW_SX}>
                  <Box sx={{ ...DOT_SX, bgcolor: s.color }} />
                  <Box component="span" sx={{ fontSize: FS.sm, color: "text.secondary", mr: "2px" }}>{s.title}:</Box>
                  <Box component="span" sx={{ fontWeight: 600 }}>{pluralize(s.count, includePRs ? "open item" : "open issue")}</Box>
                </Box>
              ))
            : (
                <Box sx={STAT_ROW_SX}>
                  <Box sx={{ ...DOT_SX, bgcolor: chartColors.issue }} />
                  {pluralize(hover.count ?? 0, includePRs ? "open item" : "open issue")}
                </Box>
              )
          }
        </Paper>
      )}

      <table className="sr-only" aria-label="Burndown chart data">
        <caption>Open {includePRs ? "item" : "issue"} count over time{isMulti ? " by milestone" : ""}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {isMulti
              ? milestoneSeries.map(({ milestone }) => <th key={milestone.number} scope="col">{milestone.title} (open)</th>)
              : <th scope="col">Open issues</th>}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: totalDays + 1 }, (_, i) => {
            const t = minTime + i * MS_PER_DAY;
            return (
              <tr key={t}>
                <td>{fmtDate(new Date(t).toISOString())}</td>
                {isMulti
                  ? milestoneSeries.map(({ milestone, points }) => <td key={milestone.number}>{points[i]?.count ?? 0}</td>)
                  : <td>{singleSeries?.points[i]?.count ?? 0}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>

      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-hidden="true"
      >
        {weekendBands.map((b, i) => (
          <rect key={i} x={b.x} y={PADDING_TOP} width={b.w} height={CHART_HEIGHT} fill={chartColors.weekendBand} className="chart-weekend" />
        ))}
        {bankHolidayBands.map((b, i) => (
          <rect key={i} x={b.x} y={PADDING_TOP} width={b.w} height={CHART_HEIGHT} fill={chartColors.bankHoliday} className="chart-bank-holiday" />
        ))}

        {yLabels.map((count) => (
          <line key={count}
            x1={PADDING_LEFT} y1={toSvgY(count).toFixed(1)} x2={PADDING_LEFT + CHART_WIDTH} y2={toSvgY(count).toFixed(1)}
            stroke={chartColors.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        {/* Chart lines + fill area — same treatment for both single and multi */}
        {milestoneSeries.map(({ milestone, points }) => {
          const linePath = points
            .map(({ count }, i) => `${i === 0 ? "M" : "L"}${toSvgX(i, points.length).toFixed(1)},${toSvgY(count).toFixed(1)}`)
            .join(" ");
          const areaPath = `${linePath} L${(PADDING_LEFT + CHART_WIDTH).toFixed(1)},${(PADDING_TOP + CHART_HEIGHT).toFixed(1)} L${PADDING_LEFT.toFixed(1)},${(PADDING_TOP + CHART_HEIGHT).toFixed(1)} Z`;
          return (
            <g key={milestone.number}>
              <path d={areaPath} fill={`${milestone.color}22`} />
              <path d={linePath} fill="none" stroke={milestone.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
            </g>
          );
        })}

        {hover && (
          <>
            <rect
              x={hover.svgX.toFixed(1)} y={PADDING_TOP}
              width={(CHART_WIDTH / totalDays).toFixed(1)} height={CHART_HEIGHT}
              fill="rgba(87,96,106,0.12)" className="chart-cursor-band"
              style={{ pointerEvents: "none" }}
            />
            {hover.series
              ? hover.series.map((s) => (
                  <circle key={s.title}
                    cx={hover.svgX.toFixed(1)} cy={toSvgY(s.count).toFixed(1)}
                    r={4} fill={s.color} style={{ pointerEvents: "none" }}
                  />
                ))
              : (
                  <circle
                    cx={hover.svgX.toFixed(1)} cy={toSvgY(hover.count ?? 0).toFixed(1)}
                    r={4} fill={chartColors.issue} style={{ pointerEvents: "none" }}
                  />
                )
            }
          </>
        )}

        {showToday && (
          <g>
            <line x1={todayX} y1={PADDING_TOP} x2={todayX} y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.today} strokeWidth={2} strokeDasharray="5 3" />
            <text
              x={todayFlipLeft ? todayXNum - 4 : todayXNum + 4}
              y={PADDING_TOP + 11}
              textAnchor={todayFlipLeft ? "end" : "start"}
              fill={chartColors.todayLabel} fontSize={10} fontFamily="inherit"
            >
              Today
            </text>
          </g>
        )}

        <line x1={PADDING_LEFT} y1={PADDING_TOP + CHART_HEIGHT} x2={PADDING_LEFT + CHART_WIDTH} y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />
        <line x1={PADDING_LEFT} y1={PADDING_TOP}      x2={PADDING_LEFT}       y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((count) => (
          <text key={count} x={PADDING_LEFT - 6} y={toSvgY(count) + 4} textAnchor="end"
            fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {count}
          </text>
        ))}

        {xLabelTimes.map((t, li) => (
          <text key={t}
            x={(PADDING_LEFT + ((t - minTime) / (maxTime - minTime)) * CHART_WIDTH).toFixed(1)}
            y={PADDING_TOP + CHART_HEIGHT + 22}
            textAnchor={li === 0 ? "start" : li === numXLabels - 1 ? "end" : "middle"}
            fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(t).toISOString())}
          </text>
        ))}

        <ChartLegend
          items={milestoneSeries.map(({ milestone }) => ({ color: milestone.color, label: milestone.title }))}
          cx={PADDING_LEFT + CHART_WIDTH / 2}
          y={PADDING_TOP - 8}
          fill={chartColors.label}
        />

        {/* Due date markers */}
        {placedMarkers.map((dm, i) => (
          <g key={i}>
            <line
              x1={dm.lineX.toFixed(1)} y1={PADDING_TOP}
              x2={dm.lineX.toFixed(1)} y2={PADDING_TOP + CHART_HEIGHT}
              stroke={dm.color} strokeWidth={2} strokeDasharray="5 3" opacity={0.8}
            />
            <text
              x={dm.flipLeft ? dm.lineX - 4 : dm.lineX + 4}
              y={dm.labelY}
              textAnchor={dm.flipLeft ? "end" : "start"}
              fill={dm.color} fontSize={10} fontFamily="inherit" opacity={0.9}
            >
              {dm.label}
            </text>
          </g>
        ))}

      </svg>
    </Box>
  );
};

const Burndown = memo(BurndownInner);

export { Burndown };
