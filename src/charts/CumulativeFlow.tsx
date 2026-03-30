import type { BankHoliday } from "../api/bankHolidayApi";
import type { TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent, MouseEvent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo, useRef, useState } from "react";

import { calcBankHolidayBands, calcWeekendBands, calcXAxisIndices, calcYAxisStep } from "../utils/chartUtils";
import { makeChartColors } from "../utils/colorUtils";
import { DAY_NAMES, MS_PER_DAY, buildBankHolidayMap, fmtDate } from "../utils/dateUtils";
import { hoverCardPos, itemEndDate, upperBound } from "../utils/displayUtils";
import { CARD_LABEL_SX, CHART_EMPTY_STATE_SX, DOT_SX, HOVER_CARD_BASE_SX, STAT_ROW_SX } from "../utils/sxTokens";
import { ChartLegend } from "./ChartLegend";

type Props = {
  items: TimelineItem[];
  highlightWeekends: boolean;
  bankHolidays: BankHoliday[];
  colorblindMode: boolean;
  includePRs: boolean;
};

const PADDING_LEFT   = 52;
const PADDING_RIGHT  = 20;
const PADDING_TOP    = 24;
const PADDING_BOTTOM = 48;
const SVG_WIDTH      = 1200;
const SVG_HEIGHT     = 320;
const CHART_WIDTH    = SVG_WIDTH  - PADDING_LEFT  - PADDING_RIGHT;
const CHART_HEIGHT   = SVG_HEIGHT - PADDING_TOP   - PADDING_BOTTOM;

type DayPt = {
  t:      number;
  opened: number;
  closed: number;
};

type HoverState = {
  wrapX: number;
  wrapY: number;
  dayIdx: number;
  date: string;
  holidayName?: string | undefined;
};

const CumulativeFlowInner: FunctionComponent<Props> = ({ items, highlightWeekends, bankHolidays, colorblindMode, includePRs }) => {
  const chartColors = makeChartColors(colorblindMode);
  // chart-specific derived colours not in the shared factory
  const closedFill  = colorblindMode ? "rgba(0,114,178,0.22)" : "rgba(9,105,218,0.22)";
  const openFill    = "rgba(209,213,218,0.35)";
  const closedLine  = chartColors.issue;
  const openedLine  = chartColors.axis;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const bankHolidayMap = useMemo(() => buildBankHolidayMap(bankHolidays), [bankHolidays]);

  const filteredItems = useMemo(
    () => includePRs ? items : items.filter((i) => i.type === "issue"),
    [items, includePRs],
  );

  const chartData = useMemo(() => {
    if (filteredItems.length === 0) { return null; }

    const allTs = filteredItems.flatMap((item) => {
      const end = itemEndDate(item);
      return [new Date(item.createdAt).getTime(), ...(end ? [new Date(end).getTime()] : [])];
    });
    const minTime   = Math.min(...allTs);
    const maxTime   = Math.max(...allTs);
    const totalDays = Math.max(Math.ceil((maxTime - minTime) / MS_PER_DAY), 1);

    const sortedOpenedTs = filteredItems.map((item) => new Date(item.createdAt).getTime()).sort((a, b) => a - b);
    const sortedClosedTs = filteredItems
      .flatMap((item) => { const e = itemEndDate(item); return e ? [new Date(e).getTime()] : []; })
      .sort((a, b) => a - b);

    const pts: DayPt[] = Array.from({ length: totalDays + 1 }, (_, i) => {
      const t = minTime + i * MS_PER_DAY;
      return { t, opened: upperBound(sortedOpenedTs, t), closed: upperBound(sortedClosedTs, t) };
    });

    const maxOpened = Math.max(...pts.map((p) => p.opened), 1);

    const toSvgX = (i: number)     => PADDING_LEFT + (pts.length > 1 ? (i / (pts.length - 1)) * CHART_WIDTH : CHART_WIDTH / 2);
    const toSvgY = (count: number) => PADDING_TOP + (1 - count / maxOpened) * CHART_HEIGHT;

    // Closed area: trace closed line right → drop to x-axis → back left
    const closedLinePts = pts
      .map(({ closed }, i) => `${i === 0 ? "M" : "L"}${toSvgX(i).toFixed(1)},${toSvgY(closed).toFixed(1)}`)
      .join(" ");
    const closedAreaPath = `${closedLinePts} L${(PADDING_LEFT + CHART_WIDTH).toFixed(1)},${(PADDING_TOP + CHART_HEIGHT).toFixed(1)} L${PADDING_LEFT.toFixed(1)},${(PADDING_TOP + CHART_HEIGHT).toFixed(1)} Z`;

    // Open band: trace opened line right → trace closed line reversed back left
    const openedLinePts = pts
      .map(({ opened }, i) => `${i === 0 ? "M" : "L"}${toSvgX(i).toFixed(1)},${toSvgY(opened).toFixed(1)}`)
      .join(" ");
    const closedReversed = [...pts].reverse()
      .map(({ closed }, ri) => `L${toSvgX(pts.length - 1 - ri).toFixed(1)},${toSvgY(closed).toFixed(1)}`)
      .join(" ");
    const openBandPath = `${openedLinePts} ${closedReversed} Z`;

    const yStep   = calcYAxisStep(maxOpened);
    const yLabels = Array.from({ length: Math.floor(maxOpened / yStep) + 1 }, (_, i) => i * yStep);

    const numXLabels = Math.min(8, pts.length);
    const xIndices = calcXAxisIndices(pts.length, numXLabels);

    return { minTime, totalDays, pts, maxOpened, toSvgX, toSvgY, closedLinePts, closedAreaPath, openedLinePts, openBandPath, yStep, yLabels, numXLabels, xIndices };
  }, [filteredItems]);

  const weekendBands = useMemo(() => {
    if (!highlightWeekends || !chartData) { return []; }
    return calcWeekendBands(chartData.minTime, chartData.totalDays, PADDING_LEFT, CHART_WIDTH);
  }, [highlightWeekends, chartData]);

  const bankHolidayBands = useMemo(() => {
    if (!chartData || bankHolidays.length === 0) { return []; }
    return calcBankHolidayBands(bankHolidays, chartData.minTime, chartData.totalDays, PADDING_LEFT, CHART_WIDTH);
  }, [chartData, bankHolidays]);

  const onMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!chartData) { return; }
    const { minTime, totalDays } = chartData;
    const rect = e.currentTarget.getBoundingClientRect();
    const wrapX = e.clientX - rect.left;
    const svgX  = (wrapX / rect.width) * SVG_WIDTH;
    if (svgX >= PADDING_LEFT && svgX <= PADDING_LEFT + CHART_WIDTH) {
      const frac     = (svgX - PADDING_LEFT) / CHART_WIDTH;
      const dayIdx   = Math.max(0, Math.min(totalDays - 1, Math.floor(frac * totalDays)));
      const ptMs     = minTime + dayIdx * MS_PER_DAY;
      const ptIso    = new Date(ptMs).toISOString();
      const date     = `${DAY_NAMES[new Date(ptMs).getUTCDay()]} · ${fmtDate(ptIso)}`;
      const holidayName = bankHolidayMap.get(ptIso.slice(0, 10));
      setHover({ wrapX, wrapY: e.clientY - rect.top, dayIdx, date, holidayName });
    } else {
      setHover(null);
    }
  }, [chartData, bankHolidayMap]);

  if (!chartData) {
    return <Typography sx={CHART_EMPTY_STATE_SX}>No items to plot cumulative flow for.</Typography>;
  }

  const { totalDays, pts, toSvgX, toSvgY, closedLinePts, closedAreaPath, openedLinePts, openBandPath, yLabels, numXLabels, xIndices } = chartData;

  // hover.dayIdx is clamped to [0, pts.length-1] in onMouseMove
  const hovered = hover !== null ? pts[hover.dayIdx]! : null;
  const hoverSvgX = hover !== null ? toSvgX(hover.dayIdx) : 0;

  const cardStyle = hover
    ? hoverCardPos(hover.wrapX, hover.wrapY, containerRef.current?.offsetWidth ?? 800, 200, 90)
    : {};

  return (
    <Box
      role="presentation"
      className="chart-wrap"
      ref={containerRef}
      style={{ position: "relative" }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      {hovered && hover && (
        <Paper elevation={2} sx={{ ...HOVER_CARD_BASE_SX, ...cardStyle }}>
          <Box sx={CARD_LABEL_SX}>{hover.date}</Box>
          {hover.holidayName && <Box sx={{ ...CARD_LABEL_SX, color: "error.main" }}>{hover.holidayName}</Box>}
          <Box sx={STAT_ROW_SX}>
            <Box sx={{ ...DOT_SX, bgcolor: openedLine }} />
            {hovered.opened} created
          </Box>
          <Box sx={STAT_ROW_SX}>
            <Box sx={{ ...DOT_SX, bgcolor: closedLine }} />
            {hovered.closed} completed
          </Box>
          <Box sx={{ ...STAT_ROW_SX, color: "text.secondary" }}>
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
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
        aria-hidden="true"
      >
        {weekendBands.map((b, i) => (
          <rect key={i} x={b.x} y={PADDING_TOP} width={b.w} height={CHART_HEIGHT} fill={chartColors.weekendBand} className="chart-weekend" />
        ))}
        {bankHolidayBands.map((b, i) => (
          <rect key={i} x={b.x} y={PADDING_TOP} width={b.w} height={CHART_HEIGHT} fill={chartColors.bankHoliday} className="chart-bank-holiday" />
        ))}

        {yLabels.map((c) => (
          <line key={c}
            x1={PADDING_LEFT} y1={toSvgY(c).toFixed(1)} x2={PADDING_LEFT + CHART_WIDTH} y2={toSvgY(c).toFixed(1)}
            stroke={chartColors.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        <path d={openBandPath} fill={openFill} />
        <path d={closedAreaPath} fill={closedFill} />

        <path d={openedLinePts} fill="none" stroke={openedLine} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={closedLinePts} fill="none" stroke={closedLine} strokeWidth={2}   strokeLinejoin="round" />

        {hover !== null && hovered !== null && (
          <>
            <rect
              x={hoverSvgX.toFixed(1)} y={PADDING_TOP}
              width={(CHART_WIDTH / totalDays).toFixed(1)} height={CHART_HEIGHT}
              fill="rgba(87,96,106,0.12)" className="chart-cursor-band"
              style={{ pointerEvents: "none" }}
            />
            <circle cx={hoverSvgX.toFixed(1)} cy={toSvgY(hovered.closed).toFixed(1)} r={4} fill={closedLine} style={{ pointerEvents: "none" }} />
            <circle cx={hoverSvgX.toFixed(1)} cy={toSvgY(hovered.opened).toFixed(1)} r={4} fill={openedLine} style={{ pointerEvents: "none" }} />
          </>
        )}

        <line x1={PADDING_LEFT} y1={PADDING_TOP + CHART_HEIGHT} x2={PADDING_LEFT + CHART_WIDTH} y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />
        <line x1={PADDING_LEFT} y1={PADDING_TOP}      x2={PADDING_LEFT}       y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((c) => (
          <text key={c} x={PADDING_LEFT - 6} y={toSvgY(c) + 4} textAnchor="end"
            fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {c}
          </text>
        ))}

        {xIndices.map((pi, li) => (
          <text key={pi} x={toSvgX(pi)} y={PADDING_TOP + CHART_HEIGHT + 20}
            textAnchor={li === 0 ? "start" : li === numXLabels - 1 ? "end" : "middle"}
            fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(pts[pi]?.t ?? 0).toISOString())}
          </text>
        ))}

        <ChartLegend
          items={[
            { color: closedLine, label: "Completed (cumulative)" },
            { color: openedLine, label: "Created (cumulative)" },
          ]}
          cx={PADDING_LEFT + CHART_WIDTH / 2}
          y={PADDING_TOP - 8}
          fill={chartColors.label}
        />

      </svg>
    </Box>
  );
};

const CumulativeFlow = memo(CumulativeFlowInner);

export { CumulativeFlow };
