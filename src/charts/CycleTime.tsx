import type { MilestoneMeta, TimelineItem } from "../types";
import type { BankHoliday } from "../api/bankHolidayApi";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { AuthorWithAssignees } from "../components/AuthorWithAssignees";
import { CHART_EMPTY_STATE_SX, MS, fmtDate, fmtDateTime, hoverCardPos, itemEndDate, makeChartColors, pluralize } from "../utils/utils";
import { ChartLegend } from "./ChartLegend";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  bankHolidays: BankHoliday[];
  colorblindMode: boolean;
  includePRs: boolean;
};

const L = 56, R = 20, T = 32, B = 48, W = 1200, H = 320;
const CW = W - L - R;
const CH = H - T - B;

type Pt = {
  item: TimelineItem;
  endDate: string;
  endMs: number;
  days: number;
  col: string;
  typeLabel: string;
  firstReviewAt: string | null;
};

type Hover = {
  x: number;
  y: number;
  pt: Pt;
  url: string;
};

const CycleTimeInner: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, bankHolidays, colorblindMode, includePRs }) => {
  const filteredItems = includePRs ? items : items.filter((i) => i.type === "issue");
  const COL = makeChartColors(colorblindMode);
  const isMulti = milestones.length > 1;
  const milestoneColorMap = useMemo(
    () => new Map(milestones.map((m) => [m.number, m.color])),
    [milestones],
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const pts: Pt[] = useMemo(() => filteredItems.flatMap((item) => {
    const endDate = itemEndDate(item);
    if (!endDate) {return [];}
    const days = Math.round(
      (new Date(endDate).getTime() - new Date(item.createdAt).getTime()) / MS,
    );
    // In multi-milestone mode, color by milestone; in single mode, by item type
    const col = isMulti
      ? (milestoneColorMap.get(item.milestoneNumber) ?? COL.issue)
      : item.type === "issue" ? COL.issue
        : item.mergedAt        ? COL.prMerged
                               : COL.prClosed;
    const typeLabel =
      item.type === "issue"  ? "Issue"
        : item.mergedAt      ? "PR (merged)"
                             : "PR (closed)";
    const firstReviewAt = item.type === "pr" ? item.firstReviewAt : null;
    return [{ item, endDate, endMs: new Date(endDate).getTime(), days, col, typeLabel, firstReviewAt }];
  }), [filteredItems, isMulti, milestoneColorMap, COL.issue, COL.prMerged, COL.prClosed]);

  const onEnter = useCallback((e: React.MouseEvent, p: Pt, idx: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) {return;}
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, pt: p, url: p.item.url });
    setHoveredIdx(idx);
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

  const pxFn = (ms: number)   => L + ((ms - minTime) / totalMs) * CW;
  const pyFn = (days: number) => T + (1 - days / maxDays) * CH;

  const sorted = [...pts.map((p) => p.days)].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  // sorted is non-empty (pts.length > 0 guarded above); mid and mid-1 are always valid indices
  const median = sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
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
    // hoveredIdx is always a valid pts index (set by onEnter which receives the loop index)
    const { x: hx, y: hy } = svgPts[hoveredIdx]!;
    const cluster = pts
      .map((_, i) => i)
      .filter((i) => {
        const dx = svgPts[i]!.x - hx, dy = svgPts[i]!.y - hy;
        return Math.sqrt(dx * dx + dy * dy) < CLUSTER_R;
      });
    if (cluster.length > 1) {
      cluster.sort((a, b) => svgPts[a]!.y - svgPts[b]!.y);
      cluster.forEach((idx, rank) => {
        // idx comes from pts.map((_, i) => i), guaranteed within spreadOffsets bounds
        spreadOffsets[idx]! = { dy: (rank - (cluster.length - 1) / 2) * SPREAD_STEP };
      });
    }
  }

  const cardStyle = hover
    ? hoverCardPos(hover.x, hover.y, wrapRef.current?.offsetWidth ?? 800, 230, 140)
    : {};

  // Review wait time in days (PR only)
  const reviewWaitDays = hover?.pt.firstReviewAt
    ? Math.round(
        (new Date(hover.pt.firstReviewAt).getTime() - new Date(hover.pt.item.createdAt).getTime()) / MS,
      )
    : null;

  return (
    <Box className="chart-wrap" ref={wrapRef} role="presentation" style={{ position: "relative" }}>
      {hover && (
        <Paper
          component="a"
          elevation={2}
          href={hover.url}
          target="_blank"
          rel="noreferrer"
          sx={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            minWidth: 148,
            px: 1.5,
            py: 1,
            zIndex: 50,
            cursor: "pointer",
            textDecoration: "none",
            color: "inherit",
            "&:hover": { borderColor: "primary.main", boxShadow: "0 4px 20px rgba(0,0,0,0.22)" },
            ...cardStyle,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
            <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: hover.pt.col, mr: "5px", verticalAlign: "middle", flexShrink: 0 }} />
            {hover.pt.typeLabel} #{hover.pt.item.number}
          </Box>
          <Typography sx={{ fontSize: "0.75rem", color: "text.primary", maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hover.pt.item.title}
          </Typography>
          <AuthorWithAssignees author={hover.pt.item.author} assignees={hover.pt.item.assignees} />
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
            {pluralize(hover.pt.days, "day")} cycle time
          </Box>
          {reviewWaitDays !== null && (
            <Box sx={{ fontSize: "0.6875rem", fontWeight: 500, color: "text.secondary" }}>
              ⏱ {reviewWaitDays}d to first review
            </Box>
          )}
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
            {DAY_NAMES[new Date(hover.pt.item.createdAt).getUTCDay()]} {fmtDateTime(hover.pt.item.createdAt)} → {DAY_NAMES[new Date(hover.pt.endDate).getUTCDay()]} {fmtDateTime(hover.pt.endDate)}
          </Box>
        </Paper>
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
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-hidden="true"
        onMouseLeave={() => { setHover(null); setHoveredIdx(null); }}
      >
        {highlightWeekends && Array.from({ length: Math.ceil(totalMs / MS) + 1 }, (_, i) => {
          const day = new Date(minTime + i * MS);
          if (day.getUTCDay() !== 6) {return null;}
          const x = L + (i * MS / totalMs) * CW;
          const w = Math.min((2 * MS / totalMs) * CW, CW - (x - L));
          return <rect key={i} x={x.toFixed(1)} y={T} width={w.toFixed(1)} height={CH} fill={COL.weekendBand} className="chart-weekend" />;
        })}
        {bankHolidays.flatMap(({ date }, i) => {
          const t = new Date(date).getTime();
          if (t < minTime || t > minTime + totalMs) {return [];}
          const x = L + ((t - minTime) / totalMs) * CW;
          const w = Math.min((MS / totalMs) * CW, CW - (x - L));
          return [<rect key={i} x={x.toFixed(1)} y={T} width={w.toFixed(1)} height={CH} fill="rgba(234,67,53,0.12)" className="chart-bank-holiday" />];
        })}

        {yLabels.map((d) => (
          <line key={d}
            x1={L} y1={pyFn(d).toFixed(1)} x2={L + CW} y2={pyFn(d).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        <line
          x1={L} y1={pyFn(median).toFixed(1)} x2={L + CW} y2={pyFn(median).toFixed(1)}
          stroke={COL.median} strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={L + 4} y={pyFn(median) - 4} textAnchor="start"
          fill={COL.median} fontSize={9} fontFamily="inherit">
          median {median}d
        </text>

        {showMean && (
          <>
            <line
              x1={L} y1={pyFn(mean).toFixed(1)} x2={L + CW} y2={pyFn(mean).toFixed(1)}
              stroke={COL.mean} strokeWidth={1.5} strokeDasharray="6 4" />
            <text x={L + 4} y={pyFn(mean) - 4} textAnchor="start"
              fill={COL.mean} fontSize={9} fontFamily="inherit">
              mean {mean}d
            </text>
          </>
        )}

        {pts.map((p, i) => (
          <g key={`${p.item.type}-${p.item.number}`}
            style={{ transition: "transform 0.15s ease" }}
            transform={`translate(0, ${spreadOffsets[i]!.dy})`}
            role="button"
            tabIndex={0}
            aria-label={`${p.typeLabel} #${p.item.number}: ${p.item.title} — ${pluralize(p.days, "day")} cycle time`}
            onClick={() => window.open(p.item.url, "_blank", "noreferrer")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.open(p.item.url, "_blank", "noreferrer"); } }}
          >
            <circle
              cx={svgPts[i]!.x.toFixed(1)} cy={svgPts[i]!.y.toFixed(1)}
              r={5} fill={p.col} opacity={0.82}
              className="ct-dot"
              onMouseEnter={(e) => onEnter(e, p, i)} />
          </g>
        ))}

        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((d) => (
          <text key={d} x={L - 6} y={pyFn(d) + 4} textAnchor="end"
            fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {d}d
          </text>
        ))}

        {xTimes.map((t, i) => (
          <text key={t} x={pxFn(t)} y={T + CH + 20}
            textAnchor={i === 0 ? "start" : i === numX - 1 ? "end" : "middle"}
            fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(t).toISOString())}
          </text>
        ))}

        <text x={12} y={T + CH / 2} textAnchor="middle"
          fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label"
          transform={`rotate(-90 12 ${T + CH / 2})`}>
          Days to close
        </text>

        <ChartLegend
          items={isMulti
            ? milestones.map((ms) => ({ color: ms.color, label: ms.title }))
            : [
                { color: COL.issue,    label: "Issues" },
                ...(includePRs ? [
                  { color: COL.prMerged, label: "PRs merged" },
                  { color: COL.prClosed, label: "PRs closed" },
                ] : []),
              ]
          }
          cx={L + CW / 2}
          y={T - 8}
          fill={COL.label}
        />

      </svg>
    </Box>
  );
};

const CycleTime = memo(CycleTimeInner);

export { CycleTime };
