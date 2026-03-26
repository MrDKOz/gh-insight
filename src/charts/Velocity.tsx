import { useState, useRef, useMemo, useCallback } from "react";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { TimelineItem } from "../types";
import { fmtDate, itemEndDate, COLORS, hoverCardPos } from "../utils/utils";

type Props = {
  items: TimelineItem[];
};

function weekStart(ms: number): number {
  const d = new Date(ms);
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=Mon … 6=Sun
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime();
}

const L = 48, R = 16, T = 20, B = 44, W = 800, H = 280;
const CW = W - L - R;
const CH = H - T - B;

const COL = {
  issue:    COLORS.issue,
  prMerged: COLORS.prMerged,
  prClosed: COLORS.prClosed,
  axis:     COLORS.chartAxis,
  grid:     COLORS.chartGrid,
  label:    COLORS.chartAxis,
};

type Week = {
  startMs: number;
  endMs:   number;
  issues:  number;
  merged:  number;
  closed:  number;
};

type Hover = {
  x: number;
  y: number;
  week: Week;
};

const Velocity: FunctionComponent<Props> = ({ items }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const weeks = useMemo(() => {
    const buckets = new Map<number, Week>();
    for (const item of items) {
      const endDate = itemEndDate(item);
      if (!endDate) continue;
      const ws = weekStart(new Date(endDate).getTime());
      if (!buckets.has(ws)) {
        buckets.set(ws, { startMs: ws, endMs: ws + 6 * 86_400_000, issues: 0, merged: 0, closed: 0 });
      }
      const w = buckets.get(ws)!;
      if (item.type === "issue")      w.issues++;
      else if (item.mergedAt)         w.merged++;
      else                            w.closed++;
    }
    return [...buckets.values()].sort((a, b) => a.startMs - b.startMs);
  }, [items]);

  if (weeks.length === 0) {
    return <Typography sx={{ fontSize: "0.875rem", color: "text.secondary", py: 2.5 }}>No completed items to plot velocity for.</Typography>;
  }

  const maxTotal = Math.max(...weeks.map((w) => w.issues + w.merged + w.closed), 1);

  const pyFn = (count: number) => T + (1 - count / maxTotal) * CH;

  const slotW  = CW / weeks.length;
  const barW   = Math.min(Math.max(slotW * 0.72, 6), 80);
  const barX   = (i: number) => L + i * slotW + (slotW - barW) / 2;

  const yStep   = maxTotal <= 12 ? 1 : maxTotal <= 30 ? 2 : Math.ceil(maxTotal / 8);
  const yLabels = Array.from({ length: Math.floor(maxTotal / yStep) + 1 }, (_, i) => i * yStep);

  const numX     = Math.min(8, weeks.length);
  const xIndices = Array.from({ length: numX }, (_, i) =>
    Math.round((i / Math.max(numX - 1, 1)) * (weeks.length - 1)),
  );

  const onEnter = useCallback((e: React.MouseEvent, week: Week) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, week });
  }, []);

  const cardStyle = hover
    ? hoverCardPos(hover.x, hover.y, wrapRef.current?.offsetWidth ?? 800, 200, 94)
    : {};

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ position: "relative" }}>
      {hover && (
        <Paper elevation={2} sx={{ position: "absolute", display: "flex", flexDirection: "column", gap: "5px", minWidth: 148, px: 1.5, py: 1, pointerEvents: "none", zIndex: 50, ...cardStyle }}>
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
            {fmtDate(new Date(hover.week.startMs).toISOString())} – {fmtDate(new Date(hover.week.endMs).toISOString())}
          </Box>
          {hover.week.issues > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: COL.issue, flexShrink: 0 }} />
              {hover.week.issues} issue{hover.week.issues !== 1 ? "s" : ""} closed
            </Box>
          )}
          {hover.week.merged > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: COL.prMerged, flexShrink: 0 }} />
              {hover.week.merged} PR{hover.week.merged !== 1 ? "s" : ""} merged
            </Box>
          )}
          {hover.week.closed > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem", fontWeight: 600 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: COL.prClosed, flexShrink: 0 }} />
              {hover.week.closed} PR{hover.week.closed !== 1 ? "s" : ""} closed
            </Box>
          )}
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary", borderTop: 1, borderColor: "divider", pt: "4px", mt: "2px" }}>
            Total: {hover.week.issues + hover.week.merged + hover.week.closed}
          </Box>
        </Paper>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-label="Velocity bar chart"
        onMouseLeave={() => setHover(null)}
      >
        {yLabels.map((c) => (
          <line key={c}
            x1={L} y1={pyFn(c).toFixed(1)} x2={L + CW} y2={pyFn(c).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        {weeks.map((week, i) => {
          const bx      = barX(i);
          const bottom  = T + CH;
          const hIssue  = (week.issues / maxTotal) * CH;
          const hMerged = (week.merged / maxTotal) * CH;
          const hClosed = (week.closed / maxTotal) * CH;
          const yIssue  = bottom - hIssue;
          const yMerged = yIssue  - hMerged;
          const yClosed = yMerged - hClosed;

          return (
            <g key={week.startMs}>
              {week.issues > 0 && (
                <rect x={bx.toFixed(1)} y={yIssue.toFixed(1)}
                  width={barW.toFixed(1)} height={hIssue.toFixed(1)}
                  fill={COL.issue} opacity={0.88} rx={2} />
              )}
              {week.merged > 0 && (
                <rect x={bx.toFixed(1)} y={yMerged.toFixed(1)}
                  width={barW.toFixed(1)} height={hMerged.toFixed(1)}
                  fill={COL.prMerged} opacity={0.88} rx={2} />
              )}
              {week.closed > 0 && (
                <rect x={bx.toFixed(1)} y={yClosed.toFixed(1)}
                  width={barW.toFixed(1)} height={hClosed.toFixed(1)}
                  fill={COL.prClosed} opacity={0.88} rx={2} />
              )}
              <rect
                x={bx.toFixed(1)} y={T}
                width={barW.toFixed(1)} height={CH}
                fill="transparent"
                className="vel-hover-area"
                onMouseEnter={(e) => onEnter(e, week)}
              />
            </g>
          );
        })}

        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((c) => (
          <text key={c} x={L - 6} y={pyFn(c) + 4} textAnchor="end"
            fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {c}
          </text>
        ))}

        {xIndices.map((wi, li) => (
          <text key={wi}
            x={(barX(wi) + barW / 2).toFixed(1)}
            y={T + CH + 20}
            textAnchor={li === 0 ? "start" : li === numX - 1 ? "end" : "middle"}
            fill={COL.label} fontSize={11} fontFamily="inherit" className="chart-label">
            {fmtDate(new Date(weeks[wi].startMs).toISOString())}
          </text>
        ))}

        {[
          { col: COL.issue,    label: "Issues closed" },
          { col: COL.prMerged, label: "PRs merged" },
          { col: COL.prClosed, label: "PRs closed" },
        ].map(({ col, label }, i) => (
          <g key={label} transform={`translate(${L + CW - 160}, ${T + i * 15})`}>
            <rect x={0} y={-8} width={10} height={10} fill={col} rx={2} />
            <text x={14} y={0} fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">{label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export { Velocity };
