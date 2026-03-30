import type { BankHoliday } from "../api/bankHolidayApi";
import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useMemo, useRef, useState } from "react";
import { CARD_LABEL_SX, CHART_EMPTY_STATE_SX, DOT_SX, FS, HOVER_CARD_BASE_SX, MS, STAT_ROW_SX, fmtDate, hoverCardPos, makeChartColors, pluralize, upperBound } from "../utils/utils";
import { ChartLegend } from "./ChartLegend";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  bankHolidays: BankHoliday[];
  colorblindMode: boolean;
  includePRs: boolean;
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
  svgX: number;
  date: string;
  holidayName?: string | undefined;
  // single mode
  count?: number;
  // multi mode — all milestones at this date
  series?: Array<{ color: string; title: string; count: number }>;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BurndownInner: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, bankHolidays, colorblindMode, includePRs }) => {
  const COL = makeChartColors(colorblindMode);
  const isMulti = milestones.length > 1;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const issues = includePRs ? items : items.filter((i) => i.type === "issue");

  const todayMs = Date.now();
  const hasOpenIssues = issues.some((i) => !i.closedAt);

  // ── Time range ────────────────────────────────────────────────────────────────
  const allCreatedTs = issues.map((i) => new Date(i.createdAt).getTime());
  const allClosedTs  = issues.flatMap((i) => i.closedAt ? [new Date(i.closedAt).getTime()] : []);
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
      const sortedClosedTs  = msIssues.flatMap((i) => i.closedAt ? [new Date(i.closedAt).getTime()] : []).sort((a, b) => a - b);
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
  const todayFrac = (todayMs - minTime) / (maxTime - minTime || 1);
  const todayXNum = L + todayFrac * CW;
  const todayX    = todayXNum.toFixed(1);
  const todayFlipLeft = todayFrac > 0.85;

  // ── Due date markers ──────────────────────────────────────────────────────────
  type DueMarker = { xNum: number; label: string; color: string; flipLeft: boolean };
  type DueMarkerPlaced = DueMarker & { labelY: number; lineX: number };
  const dueMarkers = useMemo((): DueMarker[] => {
    if (issues.length === 0) {return [];}
    const markers: DueMarker[] = [];
    for (const ms of milestones) {
      if (!ms.dueOn) {continue;}
      const dueMs = new Date(ms.dueOn).getTime();
      if (isNaN(dueMs)) {continue;}
      // Only render if dueMs is within the visible range (with a 30-day slack on the right)
      if (dueMs < minTime - MS || dueMs > maxTime + 30 * MS) {continue;}
      const frac  = (dueMs - minTime) / (maxTime - minTime);
      const xNum  = L + Math.min(frac, 1) * CW;
      const color = ms.color;
      const label = `Due ${fmtDate(ms.dueOn)}`;
      markers.push({ xNum, label, color, flipLeft: frac > 0.85 });
    }
    return markers;
  }, [issues.length, milestones, minTime, maxTime]);

  // Assign vertical label rows and horizontal line offsets so markers don't overlap
  const placedMarkers: DueMarkerPlaced[] = [];
  for (const dm of [...dueMarkers].sort((a, b) => a.xNum - b.xNum)) {
    const usedRows = new Set<number>();
    if (showToday && Math.abs(dm.xNum - todayXNum) < 60) {usedRows.add(0);}
    for (const p of placedMarkers) {
      if (Math.abs(dm.xNum - p.xNum) < 60) {usedRows.add(Math.round((p.labelY - (T + 11)) / 11));}
    }
    let row = 0;
    while (usedRows.has(row)) {row++;}
    const sameX = placedMarkers.filter((p) => Math.abs(p.xNum - dm.xNum) < 2).length;
    placedMarkers.push({ ...dm, labelY: T + 11 + row * 11, lineX: dm.xNum + sameX * 3 });
  }

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

  // ── Bank holiday bands ────────────────────────────────────────────────────────
  const bankHolidayMap = useMemo(() => new Map(bankHolidays.map((h) => [h.date, h.name])), [bankHolidays]);

  const bankHolidayBands = useMemo(() => {
    if (bankHolidays.length === 0 || issues.length === 0) {return [];}
    const dayWidth = (1 / totalDays) * CW;
    return bankHolidays.flatMap(({ date }) => {
      const t = new Date(date).getTime();
      if (t < minTime || t > minTime + totalDays * MS) {return [];}
      const i = (t - minTime) / MS;
      const x = L + (i / totalDays) * CW;
      return [{ x: x.toFixed(1), w: Math.min(dayWidth, CW - (x - L)).toFixed(1) }];
    });
  }, [bankHolidays, totalDays, minTime, issues.length]);

  if (issues.length === 0) {
    return <Typography sx={CHART_EMPTY_STATE_SX}>No {includePRs ? "items" : "issues"} to plot a burndown for.</Typography>;
  }

  // ── Hover handler ─────────────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wrapX = e.clientX - rect.left;
    const svgX  = (wrapX / rect.width) * W;
    if (svgX < L || svgX > L + CW) { setHover(null); return; }

    const frac  = (svgX - L) / CW;
    const ptIdx = Math.max(0, Math.min(totalDays - 1, Math.floor(frac * totalDays)));
    const ptMs  = minTime + ptIdx * MS;
    const ptIso = new Date(ptMs).toISOString();
    const ptDate = `${DAY_NAMES[new Date(ptMs).getUTCDay()]} · ${fmtDate(ptIso)}`;
    const holidayName = bankHolidayMap.get(ptIso.slice(0, 10));

    if (isMulti) {
      if (msSeries.length === 0) { setHover(null); return; }
      setHover({
        x: wrapX, y: e.clientY - rect.top,
        svgX: pxFn(ptIdx, totalDays + 1),
        date: ptDate, holidayName,
        series: msSeries.map((s) => ({
          color: s.ms.color,
          title: s.ms.title,
          count: s.points[ptIdx]?.count ?? 0,
        })),
      });
    } else if (singleSeries) {
      const point = singleSeries.points[ptIdx];
      if (!point) { return; }
      const { count } = point;
      setHover({
        x: wrapX, y: e.clientY - rect.top,
        svgX: pxFn(ptIdx, singleSeries.points.length),
        date: ptDate, holidayName,
        series: [{ color: singleSeries.ms.color, title: singleSeries.ms.title, count }],
      });
    }
  };

  const hoverCardH = hover?.series ? 36 + hover.series.length * 24 : 68;
  const hoverCardStyle = hover ? hoverCardPos(hover.x, hover.y, wrapRef.current?.offsetWidth ?? 800, hoverCardH + 40, hoverCardH) : {};

  return (
    <Box role="presentation" className="burndown-wrap" ref={wrapRef} style={{ position: "relative" }} onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}>
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
                  <Box sx={{ ...DOT_SX, bgcolor: COL.issue }} />
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
        {bankHolidayBands.map((b, idx) => (
          <rect key={idx} x={b.x} y={T} width={b.w} height={CH} fill={COL.bankHoliday} className="chart-bank-holiday" />
        ))}

        {yLabels.map((count) => (
          <line key={count}
            x1={L} y1={pyFn(count).toFixed(1)} x2={L + CW} y2={pyFn(count).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        {/* Chart lines + fill area — same treatment for both single and multi */}
        {msSeries.map(({ ms, points }) => {
          const linePath = points
            .map(({ count }, i) => `${i === 0 ? "M" : "L"}${pxFn(i, points.length).toFixed(1)},${pyFn(count).toFixed(1)}`)
            .join(" ");
          const areaPath = `${linePath} L${(L + CW).toFixed(1)},${(T + CH).toFixed(1)} L${L.toFixed(1)},${(T + CH).toFixed(1)} Z`;
          return (
            <g key={ms.number}>
              <path d={areaPath} fill={`${ms.color}22`} />
              <path d={linePath} fill="none" stroke={ms.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
            </g>
          );
        })}

        {hover && (
          <>
            <rect
              x={hover.svgX.toFixed(1)} y={T}
              width={(CW / totalDays).toFixed(1)} height={CH}
              fill="rgba(87,96,106,0.12)" className="chart-cursor-band"
              style={{ pointerEvents: "none" }}
            />
            {hover.series
              ? hover.series.map((s) => (
                  <circle key={s.title}
                    cx={hover.svgX.toFixed(1)} cy={pyFn(s.count).toFixed(1)}
                    r={4} fill={s.color} style={{ pointerEvents: "none" }}
                  />
                ))
              : (
                  <circle
                    cx={hover.svgX.toFixed(1)} cy={pyFn(hover.count ?? 0).toFixed(1)}
                    r={4} fill={COL.issue} style={{ pointerEvents: "none" }}
                  />
                )
            }
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

        <ChartLegend
          items={msSeries.map(({ ms }) => ({ color: ms.color, label: ms.title }))}
          cx={L + CW / 2}
          y={T - 8}
          fill={COL.label}
        />

        {/* Due date markers */}
        {placedMarkers.map((dm, idx) => (
          <g key={idx}>
            <line
              x1={dm.lineX.toFixed(1)} y1={T}
              x2={dm.lineX.toFixed(1)} y2={T + CH}
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
