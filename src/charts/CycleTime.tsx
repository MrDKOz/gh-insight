import type { MilestoneMeta, TimelineItem } from "../types";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { AuthorTag } from "../components/AuthorTag";
import { COLORS, COLORS_CB, MS, fmtDate, hoverCardPos, itemEndDate } from "../utils/utils";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  colorblindMode: boolean;
};

const L = 52, R = 16, T = 28, B = 44, W = 800, H = 280;
const CW = W - L - R;
const CH = H - T - B;

const makeCOL = (cb: boolean) => {
  const p = cb ? COLORS_CB : COLORS;
  return {
    issue:    p.issue,
    prMerged: p.prMerged,
    prClosed: p.prClosed,
    axis:     p.chartAxis,
    grid:     p.chartGrid,
    label:    p.chartAxis,
    median:   "#1a7f37",
    mean:     "#d97706",
  };
};

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

const CycleTimeInner: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, colorblindMode }) => {
  const COL = makeCOL(colorblindMode);
  const isMulti = milestones.length > 1;
  const milestoneColorMap = useMemo(
    () => new Map(milestones.map((m) => [m.number, m.color])),
    [milestones],
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const pts: Pt[] = useMemo(() => items.flatMap((item) => {
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
  }), [items, isMulti, milestoneColorMap, COL.issue, COL.prMerged, COL.prClosed]);

  const onEnter = useCallback((e: React.MouseEvent, p: Pt, idx: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) {return;}
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, pt: p, url: p.item.url });
    setHoveredIdx(idx);
  }, []);

  if (pts.length === 0) {
    return <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", py: 2.5 }}>No completed items to plot cycle times for.</Typography>;
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
    <Box className="chart-wrap" ref={wrapRef} style={{ position: "relative" }}>
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
          <AuthorTag login={hover.pt.item.author} prefix="@" />
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
            {hover.pt.days} day{hover.pt.days !== 1 ? "s" : ""} cycle time
          </Box>
          {reviewWaitDays !== null && (
            <Box sx={{ fontSize: "0.6875rem", fontWeight: 500, color: "text.secondary" }}>
              ⏱ {reviewWaitDays}d to first review
            </Box>
          )}
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
            {fmtDate(hover.pt.item.createdAt)} → {fmtDate(hover.pt.endDate)}
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
          return <rect key={i} x={x.toFixed(1)} y={T} width={w.toFixed(1)} height={CH} fill="rgba(0,0,0,0.04)" className="chart-weekend" />;
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
          <g key={`${p.item.type}-${p.item.number}`}
            style={{ transition: "transform 0.15s ease" }}
            transform={`translate(0, ${spreadOffsets[i]!.dy})`}
            role="button"
            tabIndex={0}
            aria-label={`${p.typeLabel} #${p.item.number}: ${p.item.title} — ${p.days} day${p.days !== 1 ? "s" : ""} cycle time`}
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
            fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {d}d
          </text>
        ))}

        {xTimes.map((t, i) => (
          <text key={t} x={pxFn(t)} y={T + CH + 20}
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

        {/* Legend: milestone colors in multi mode, item types in single mode */}
        {isMulti
          ? milestones.map((ms, i) => (
              <g key={ms.number} transform={`translate(${L + CW - 160}, ${T + i * 15})`}>
                <circle cx={5} cy={-3} r={4} fill={ms.color} opacity={0.82} />
                <text x={14} y={0} fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">{ms.title}</text>
              </g>
            ))
          : ([
              { col: COL.issue,    label: "Issues" },
              { col: COL.prMerged, label: "PRs merged" },
              { col: COL.prClosed, label: "PRs closed" },
            ]).map(({ col, label }, i) => (
              <g key={label} transform={`translate(${L + CW - 160}, ${T + i * 15})`}>
                <circle cx={5} cy={-3} r={4} fill={col} opacity={0.82} />
                <text x={14} y={0} fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">{label}</text>
              </g>
            ))
        }
      </svg>
    </Box>
  );
};

const CycleTime = memo(CycleTimeInner);

export { CycleTime };
