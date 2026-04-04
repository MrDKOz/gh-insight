import type { BankHoliday } from "../api/bankHolidayApi";
import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent, MouseEvent } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo, useRef, useState } from "react";

import { ItemHoverCard } from "../components/ItemHoverCard";
import { makeChartColors } from "../utils/colorUtils";
import { DAY_NAMES, MS_PER_DAY, fmtDate, fmtDateTime } from "../utils/dateUtils";
import { hoverCardPos, itemEndDate, pluralize } from "../utils/displayUtils";
import { CHART_EMPTY_STATE_SX } from "../utils/sxTokens";
import { ChartLegend } from "./ChartLegend";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  bankHolidays: BankHoliday[];
  colorblindMode: boolean;
  includePRs: boolean;
  showPercentiles: boolean;
};

const PADDING_LEFT   = 56;
const PADDING_RIGHT  = 20;
const PADDING_TOP    = 32;
const PADDING_BOTTOM = 48;
const SVG_WIDTH      = 1200;
const SVG_HEIGHT     = 320;
const CHART_WIDTH    = SVG_WIDTH  - PADDING_LEFT  - PADDING_RIGHT;
const CHART_HEIGHT   = SVG_HEIGHT - PADDING_TOP   - PADDING_BOTTOM;

type Pt = {
  item: TimelineItem;
  endDate: string;
  endMs: number;
  days: number;
  color: string;
  typeLabel: string;
  firstReviewAt: string | null;
};

type Hover = {
  x: number;
  y: number;
  pt: Pt;
  url: string;
};

const CycleTimeInner: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, bankHolidays, colorblindMode, includePRs, showPercentiles }) => {
  const filteredItems = useMemo(
    () => includePRs ? items : items.filter((i) => i.type === "issue"),
    [items, includePRs],
  );
  const chartColors = makeChartColors(colorblindMode);
  const isMulti = milestones.length > 1;
  const milestoneColorMap = useMemo(
    () => new Map(milestones.map((m) => [m.number, m.color])),
    [milestones],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const pts: Pt[] = useMemo(() => filteredItems.flatMap((item) => {
    const endDate = itemEndDate(item);
    if (!endDate) {return [];}
    const days = Math.round(
      (new Date(endDate).getTime() - new Date(item.createdAt).getTime()) / MS_PER_DAY,
    );
    // In multi-milestone mode, color by milestone; in single mode, by item type
    const color = isMulti
      ? (milestoneColorMap.get(item.milestoneNumber) ?? chartColors.issue)
      : item.type === "issue" ? chartColors.issue
        : item.mergedAt        ? chartColors.prMerged
                               : chartColors.prClosed;
    const typeLabel =
      item.type === "issue"  ? "Issue"
        : item.mergedAt      ? "PR (merged)"
                             : "PR (closed)";
    const firstReviewAt = item.type === "pr" ? item.firstReviewAt : null;
    return [{ item, endDate, endMs: new Date(endDate).getTime(), days, color, typeLabel, firstReviewAt }];
  }), [filteredItems, isMulti, milestoneColorMap, chartColors.issue, chartColors.prMerged, chartColors.prClosed]);

  const onEnter = useCallback((e: MouseEvent, p: Pt, pointIndex: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {return;}
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, pt: p, url: p.item.url });
    setHoveredIdx(pointIndex);
  }, []);

  // Show the hover card when a dot receives keyboard focus so keyboard users
  // get the same detail as mouse users. The card is anchored to the centre of
  // the SVG container rather than a mouse position.
  const onFocusDot = useCallback((p: Pt, pointIndex: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {return;}
    setHover({ x: rect.width / 2, y: rect.height / 2, pt: p, url: p.item.url });
    setHoveredIdx(pointIndex);
  }, []);

  if (pts.length === 0) {
    return <Typography sx={CHART_EMPTY_STATE_SX}>No completed {includePRs ? "items" : "issues"} to plot cycle times for.</Typography>;
  }

  const endTimes = pts.map((p) => p.endMs);
  const minTime  = Math.min(...endTimes);
  const maxTime  = Math.max(...endTimes);
  const totalMs  = maxTime - minTime || 1;
  const maxDays  = Math.max(...pts.map((p) => p.days), 1);

  const yStep   = maxDays <= 14 ? 1 : maxDays <= 56 ? 7 : Math.ceil(maxDays / 8) * (maxDays > 100 ? 10 : 7);
  const yLabels = Array.from({ length: Math.floor(maxDays / yStep) + 1 }, (_, i) => i * yStep);

  const toSvgX = (ms: number)   => PADDING_LEFT + ((ms - minTime) / totalMs) * CHART_WIDTH;
  const toSvgY = (days: number) => PADDING_TOP + (1 - days / maxDays) * CHART_HEIGHT;

  const sorted = [...pts.map((p) => p.days)].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  const mean   = Math.round(sorted.reduce((s, d) => s + d, 0) / sorted.length);
  const showMean = mean !== median && Math.abs(toSvgY(mean) - toSvgY(median)) > 16;

  const pct = (p: number) => sorted[Math.floor(p * (sorted.length - 1))] ?? 0;
  const p75 = pct(0.75);
  const p90 = pct(0.90);

  const numXLabels = Math.min(8, pts.length);
  const xTimes = Array.from({ length: numXLabels }, (_, i) =>
    minTime + (totalMs * i) / Math.max(numXLabels - 1, 1),
  );

  const svgPts = pts.map((p) => ({ x: toSvgX(p.endMs), y: toSvgY(p.days) }));

  const CLUSTER_R = 14;
  const SPREAD_STEP = 13;
  const spreadOffsets: { dy: number }[] = pts.map(() => ({ dy: 0 }));
  const hoveredPt = hoveredIdx !== null ? svgPts[hoveredIdx] : undefined;
  if (hoveredPt) {
    const { x: hoveredX, y: hoveredY } = hoveredPt;
    const cluster = pts
      .map((_, i) => i)
      .filter((i) => {
        const pt = svgPts[i];
        if (!pt) { return false; }
        const dx = pt.x - hoveredX, dy = pt.y - hoveredY;
        return Math.sqrt(dx * dx + dy * dy) < CLUSTER_R;
      });
    if (cluster.length > 1) {
      cluster.sort((a, b) => (svgPts[a]?.y ?? 0) - (svgPts[b]?.y ?? 0));
      cluster.forEach((pointIndex, rank) => {
        if (spreadOffsets[pointIndex] !== undefined) {
          spreadOffsets[pointIndex] = { dy: (rank - (cluster.length - 1) / 2) * SPREAD_STEP };
        }
      });
    }
  }

  const reviewWaitDays = hover?.pt.firstReviewAt
    ? Math.round(
        (new Date(hover.pt.firstReviewAt).getTime() - new Date(hover.pt.item.createdAt).getTime()) / MS_PER_DAY,
      )
    : null;

  return (
    <Box className="chart-wrap" ref={containerRef} role="presentation" style={{ position: "relative" }}>
      {hover && (
        <ItemHoverCard
          item={hover.pt.item}
          dotColor={hover.pt.color}
          typeLabel={hover.pt.typeLabel}
          dateRange={`${DAY_NAMES[new Date(hover.pt.item.createdAt).getUTCDay()]} ${fmtDateTime(hover.pt.item.createdAt)} → ${DAY_NAMES[new Date(hover.pt.endDate).getUTCDay()]} ${fmtDateTime(hover.pt.endDate)}`}
          metric={`${pluralize(hover.pt.days, "day")} cycle time`}
          reviewWaitDays={reviewWaitDays}
          href={hover.url}
          colorblindMode={colorblindMode}
          positionSx={{ position: "absolute", ...hoverCardPos(hover.x, hover.y, containerRef.current?.offsetWidth ?? 800, 280, 320) }}
        />
      )}

      <table className="sr-only" aria-label="Cycle time data">
        <caption>Cycle time in days for each completed item</caption>
        <thead>
          <tr>
            <th scope="col">Number</th>
            <th scope="col">Title</th>
            <th scope="col">Type</th>
            <th scope="col">Closed</th>
            <th scope="col">Cycle time (days)</th>
          </tr>
        </thead>
        <tbody>
          {pts.map((p) => (
            <tr key={`${p.item.type}-${p.item.number}`}>
              <td>#{p.item.number}</td>
              <td>{p.item.title}</td>
              <td>{p.typeLabel}</td>
              <td>{fmtDate(p.endDate)}</td>
              <td>{p.days}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-hidden="true"
        onMouseLeave={() => { setHover(null); setHoveredIdx(null); }}
      >
        {highlightWeekends && Array.from({ length: Math.ceil(totalMs / MS_PER_DAY) + 1 }, (_, i) => {
          const day = new Date(minTime + i * MS_PER_DAY);
          if (day.getUTCDay() !== 6) {return null;}
          const x = PADDING_LEFT + (i * MS_PER_DAY / totalMs) * CHART_WIDTH;
          const bandWidth = Math.min((2 * MS_PER_DAY / totalMs) * CHART_WIDTH, CHART_WIDTH - (x - PADDING_LEFT));
          return <rect key={i} x={x.toFixed(1)} y={PADDING_TOP} width={bandWidth.toFixed(1)} height={CHART_HEIGHT} fill={chartColors.weekendBand} className="chart-weekend" />;
        })}
        {bankHolidays.flatMap(({ date }, i) => {
          const t = new Date(date).getTime();
          if (t < minTime || t > minTime + totalMs) {return [];}
          const x = PADDING_LEFT + ((t - minTime) / totalMs) * CHART_WIDTH;
          const bandWidth = Math.min((MS_PER_DAY / totalMs) * CHART_WIDTH, CHART_WIDTH - (x - PADDING_LEFT));
          return [<rect key={i} x={x.toFixed(1)} y={PADDING_TOP} width={bandWidth.toFixed(1)} height={CHART_HEIGHT} fill={chartColors.bankHoliday} className="chart-bank-holiday" />];
        })}

        {yLabels.map((d) => (
          <line key={d}
            x1={PADDING_LEFT} y1={toSvgY(d).toFixed(1)} x2={PADDING_LEFT + CHART_WIDTH} y2={toSvgY(d).toFixed(1)}
            stroke={chartColors.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        <line
          x1={PADDING_LEFT} y1={toSvgY(median).toFixed(1)} x2={PADDING_LEFT + CHART_WIDTH} y2={toSvgY(median).toFixed(1)}
          stroke={chartColors.median} strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={PADDING_LEFT + 4} y={toSvgY(median) - 4} textAnchor="start"
          fill={chartColors.median} fontSize={9} fontFamily="inherit">
          median {median}d
        </text>

        {showMean && (
          <>
            <line
              x1={PADDING_LEFT} y1={toSvgY(mean).toFixed(1)} x2={PADDING_LEFT + CHART_WIDTH} y2={toSvgY(mean).toFixed(1)}
              stroke={chartColors.mean} strokeWidth={1.5} strokeDasharray="6 4" />
            <text x={PADDING_LEFT + 4} y={toSvgY(mean) - 4} textAnchor="start"
              fill={chartColors.mean} fontSize={9} fontFamily="inherit">
              mean {mean}d
            </text>
          </>
        )}

        {showPercentiles && (
          <>
            <line
              x1={PADDING_LEFT} y1={toSvgY(p75).toFixed(1)} x2={PADDING_LEFT + CHART_WIDTH} y2={toSvgY(p75).toFixed(1)}
              stroke={chartColors.p75} strokeWidth={1.5} strokeDasharray="6 4" />
            <text x={PADDING_LEFT + 4} y={toSvgY(p75) - 4} textAnchor="start"
              fill={chartColors.p75} fontSize={9} fontFamily="inherit">
              p75 {p75}d
            </text>
            <line
              x1={PADDING_LEFT} y1={toSvgY(p90).toFixed(1)} x2={PADDING_LEFT + CHART_WIDTH} y2={toSvgY(p90).toFixed(1)}
              stroke={chartColors.p90} strokeWidth={1.5} strokeDasharray="6 4" />
            <text x={PADDING_LEFT + 4} y={toSvgY(p90) - 4} textAnchor="start"
              fill={chartColors.p90} fontSize={9} fontFamily="inherit">
              p90 {p90}d
            </text>
          </>
        )}

        {pts.map((p, i) => {
          const svgPt = svgPts[i];
          const offset = spreadOffsets[i];
          if (!svgPt || !offset) { return null; }
          return (
            <g key={`${p.item.type}-${p.item.number}`}
              style={{ transition: "transform 0.15s ease" }}
              transform={`translate(0, ${offset.dy})`}
              role="button"
              tabIndex={0}
              aria-label={`${p.typeLabel} #${p.item.number}: ${p.item.title} — ${pluralize(p.days, "day")} cycle time`}
              onClick={() => window.open(p.item.url, "_blank", "noreferrer")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.open(p.item.url, "_blank", "noreferrer"); } }}
              onFocus={() => onFocusDot(p, i)}
              onBlur={() => { setHover(null); setHoveredIdx(null); }}
            >
              <circle
                cx={svgPt.x.toFixed(1)} cy={svgPt.y.toFixed(1)}
                r={5} fill={p.color} opacity={0.82}
                className="ct-dot"
                onMouseEnter={(e) => onEnter(e, p, i)} />
            </g>
          );
        })}

        <line x1={PADDING_LEFT} y1={PADDING_TOP + CHART_HEIGHT} x2={PADDING_LEFT + CHART_WIDTH} y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />
        <line x1={PADDING_LEFT} y1={PADDING_TOP}      x2={PADDING_LEFT}       y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((d) => (
          <text key={d} x={PADDING_LEFT - 6} y={toSvgY(d) + 4} textAnchor="end"
            fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {d}d
          </text>
        ))}

        {xTimes.map((t, i) => (
          <text key={t} x={toSvgX(t)} y={PADDING_TOP + CHART_HEIGHT + 20}
            textAnchor={i === 0 ? "start" : i === numXLabels - 1 ? "end" : "middle"}
            fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(t).toISOString())}
          </text>
        ))}

        <text x={12} y={PADDING_TOP + CHART_HEIGHT / 2} textAnchor="middle"
          fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label"
          transform={`rotate(-90 12 ${PADDING_TOP + CHART_HEIGHT / 2})`}>
          Days to close
        </text>

        <ChartLegend
          items={isMulti
            ? milestones.map((milestone) => ({ color: milestone.color, label: milestone.title }))
            : [
                { color: chartColors.issue,    label: "Issues" },
                ...(includePRs ? [
                  { color: chartColors.prMerged, label: "PRs merged" },
                  { color: chartColors.prClosed, label: "PRs closed" },
                ] : []),
              ]
          }
          cx={PADDING_LEFT + CHART_WIDTH / 2}
          y={PADDING_TOP - 8}
          fill={chartColors.label}
        />

      </svg>
    </Box>
  );
};

const CycleTime = memo(CycleTimeInner);

export { CycleTime };
