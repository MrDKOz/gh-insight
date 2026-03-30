import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { AuthorTag } from "../components/AuthorTag";
import { makeChartColors } from "../utils/colorUtils";
import { fmtDate } from "../utils/dateUtils";
import { FS, hoverCardPos, itemEndDate, pluralize } from "../utils/displayUtils";
import { CARD_LABEL_SX, CHART_EMPTY_STATE_SX, DOT_SX, HOVER_CARD_BASE_SX, STAT_ROW_SX } from "../utils/sxTokens";
import { ChartLegend } from "./ChartLegend";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  colorblindMode: boolean;
  includePRs: boolean;
};

const DAY_MS = 86_400_000;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const weekStart = (ms: number): number => {
  const d = new Date(ms);
  const dow = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1; // Mon=0 … Sun=6 (UTC)
  // Date.UTC keeps everything in UTC — no local-timezone mixing
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
};

const L = 52, R = 20, T = 24, B = 48, W = 1200, H = 320;
const CW = W - L - R;
const CH = H - T - B;


type Week = {
  startMs: number;
  endMs:   number;
  issues:  number;
  merged:  number;
  closed:  number;
  authors: string[];
};

// Multi-milestone: one count per milestone per week
type MilestoneWeek = {
  startMs: number;
  endMs:   number;
  total: number;
};

type Hover = {
  x: number;
  y: number;
  week: Week;
};

type MilestoneHover = {
  x: number;
  y: number;
  msNum: number;
  msTitle: string;
  msColor: string;
  week: MilestoneWeek;
};

const VelocityInner: FunctionComponent<Props> = ({ items, milestones, colorblindMode, includePRs }) => {
  const filteredItems = includePRs ? items : items.filter((i) => i.type === "issue");
  const COL = makeChartColors(colorblindMode);
  const isMulti = milestones.length > 1;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [msHover, setMsHover] = useState<MilestoneHover | null>(null);

  // ── Single-milestone mode (stacked issues/merged/closed) ─────────────────────
  const weeks = useMemo(() => {
    if (isMulti) {return [];}
    const buckets = new Map<number, Week>();
    for (const item of filteredItems) {
      const endDate = itemEndDate(item);
      if (!endDate) {continue;}
      const ws = weekStart(new Date(endDate).getTime());
      let w = buckets.get(ws);
      if (!w) {
        w = { startMs: ws, endMs: ws + 6 * DAY_MS, issues: 0, merged: 0, closed: 0, authors: [] };
        buckets.set(ws, w);
      }
      if (item.type === "issue")      {w.issues++;}
      else if (item.mergedAt)         {w.merged++;}
      else                            {w.closed++;}
      if (!w.authors.includes(item.author)) {w.authors.push(item.author);}
    }
    return [...buckets.values()].sort((a, b) => a.startMs - b.startMs);
  }, [filteredItems, isMulti]);

  // ── Multi-milestone mode (one color per milestone) ───────────────────────────
  const { allWeekStarts, msWeekMap } = useMemo(() => {
    if (!isMulti) {return { allWeekStarts: [], msWeekMap: new Map<number, Map<number, MilestoneWeek>>() };}
    const weekSet = new Set<number>();
    const msWeekMap = new Map<number, Map<number, MilestoneWeek>>();
    for (const ms of milestones) {msWeekMap.set(ms.number, new Map());}

    for (const item of filteredItems) {
      const endDate = itemEndDate(item);
      if (!endDate) {continue;}
      const ws = weekStart(new Date(endDate).getTime());
      weekSet.add(ws);
      const bucket = msWeekMap.get(item.milestoneNumber);
      if (!bucket) {continue;}
      let entry = bucket.get(ws);
      if (!entry) {
        entry = { startMs: ws, endMs: ws + 6 * DAY_MS, total: 0 };
        bucket.set(ws, entry);
      }
      entry.total++;
    }
    return { allWeekStarts: [...weekSet].sort((a, b) => a - b), msWeekMap };
  }, [filteredItems, milestones, isMulti]);

  const onEnter = useCallback((e: React.MouseEvent, week: Week) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) { return; }
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, week });
  }, []);

  const onMsEnter = useCallback((e: React.MouseEvent, ms: MilestoneMeta, week: MilestoneWeek) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) {return;}
    setMsHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, msNum: ms.number, msTitle: ms.title, msColor: ms.color, week });
  }, []);

  // Pre-compute axis scales for each mode (two memos so TypeScript can infer distinct field shapes)
  const singleAxis = useMemo(() => {
    if (isMulti || weeks.length === 0) { return null; }
    const maxTotal = Math.max(...weeks.map((w) => w.issues + w.merged + w.closed), 1);
    const slotW  = CW / weeks.length;
    const barW   = Math.min(Math.max(slotW * 0.72, 6), 80);
    const barX   = (i: number) => L + i * slotW + (slotW - barW) / 2;
    const yStep   = maxTotal <= 12 ? 1 : maxTotal <= 30 ? 2 : Math.ceil(maxTotal / 8);
    const yLabels = Array.from({ length: Math.floor(maxTotal / yStep) + 1 }, (_, i) => i * yStep);
    const numX    = Math.min(8, weeks.length);
    const xIndices = Array.from({ length: numX }, (_, i) => Math.round((i / Math.max(numX - 1, 1)) * (weeks.length - 1)));
    const pyFn = (count: number) => T + (1 - count / maxTotal) * CH;
    return { maxTotal, slotW, barW, barX, yLabels, numX, xIndices, pyFn };
  }, [isMulti, weeks]);

  const multiAxis = useMemo(() => {
    if (!isMulti || allWeekStarts.length === 0) { return null; }
    const maxTotal = Math.max(
      ...milestones.flatMap((ms) => [...(msWeekMap.get(ms.number)?.values() ?? [])].map((w) => w.total)),
      1,
    );
    const slotW  = CW / allWeekStarts.length;
    const msBarW = Math.max(Math.min((slotW * 0.8) / milestones.length, 40), 4);
    const msBarX = (wi: number, mi: number) => L + wi * slotW + (slotW - msBarW * milestones.length) / 2 + mi * msBarW;
    const yStep   = maxTotal <= 12 ? 1 : maxTotal <= 30 ? 2 : Math.ceil(maxTotal / 8);
    const yLabels = Array.from({ length: Math.floor(maxTotal / yStep) + 1 }, (_, i) => i * yStep);
    const numX    = Math.min(8, allWeekStarts.length);
    const xIndices = Array.from({ length: numX }, (_, i) => Math.round((i / Math.max(numX - 1, 1)) * (allWeekStarts.length - 1)));
    const pyFn = (count: number) => T + (1 - count / maxTotal) * CH;
    return { maxTotal, slotW, msBarW, msBarX, yLabels, numX, xIndices, pyFn };
  }, [isMulti, allWeekStarts, milestones, msWeekMap]);

  if ((isMulti ? allWeekStarts.length : weeks.length) === 0) {
    return <Typography sx={CHART_EMPTY_STATE_SX}>No completed {includePRs ? "items" : "issues"} to plot velocity for.</Typography>;
  }

  // ── Single-milestone rendering ───────────────────────────────────────────────
  if (!isMulti) {
    const { maxTotal, barW, barX, pyFn, yLabels, numX, xIndices } = singleAxis!;

    const cardStyle = hover
      ? hoverCardPos(hover.x, hover.y, wrapRef.current?.offsetWidth ?? 800, 200, 94)
      : {};

    return (
      <Box className="chart-wrap" ref={wrapRef} role="presentation" style={{ position: "relative" }}>
        {hover && (
          <Paper elevation={2} sx={{ ...HOVER_CARD_BASE_SX, ...cardStyle }}>
            <Box sx={CARD_LABEL_SX}>
              {DAY_NAMES[new Date(hover.week.startMs).getUTCDay()]} {fmtDate(new Date(hover.week.startMs).toISOString())} – {DAY_NAMES[new Date(hover.week.endMs).getUTCDay()]} {fmtDate(new Date(hover.week.endMs).toISOString())}
            </Box>
            {hover.week.issues > 0 && (
              <Box sx={STAT_ROW_SX}>
                <Box sx={{ ...DOT_SX, bgcolor: COL.issue }} />
                {pluralize(hover.week.issues, "issue")} closed
              </Box>
            )}
            {hover.week.merged > 0 && (
              <Box sx={STAT_ROW_SX}>
                <Box sx={{ ...DOT_SX, bgcolor: COL.prMerged }} />
                {pluralize(hover.week.merged, "PR")} merged
              </Box>
            )}
            {hover.week.closed > 0 && (
              <Box sx={STAT_ROW_SX}>
                <Box sx={{ ...DOT_SX, bgcolor: COL.prClosed }} />
                {pluralize(hover.week.closed, "PR")} closed
              </Box>
            )}
            <Box sx={{ ...CARD_LABEL_SX, borderTop: 1, borderColor: "divider", pt: "4px", mt: "2px" }}>
              Total: {hover.week.issues + hover.week.merged + hover.week.closed}
            </Box>
            {hover.week.authors.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "3px", pt: "2px" }}>
                {hover.week.authors.slice(0, 6).map((a) => <AuthorTag key={a} login={a} showName={false} size={16} />)}
                {hover.week.authors.length > 6 && (
                  <Box sx={{ fontSize: FS.sm, color: "text.secondary", alignSelf: "center" }}>+{hover.week.authors.length - 6}</Box>
                )}
              </Box>
            )}
          </Paper>
        )}

        <table className="sr-only" aria-label="Velocity data">
          <caption>Items completed per week</caption>
          <thead>
            <tr>
              <th scope="col">Week starting</th>
              <th scope="col">Issues closed</th>
              <th scope="col">PRs merged</th>
              <th scope="col">PRs closed</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.startMs}>
                <td>{fmtDate(new Date(w.startMs).toISOString())}</td>
                <td>{w.issues}</td>
                <td>{w.merged}</td>
                <td>{w.closed}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true" onMouseLeave={() => setHover(null)}>
          {yLabels.map((c) => (
            <line key={c} x1={L} y1={pyFn(c).toFixed(1)} x2={L + CW} y2={pyFn(c).toFixed(1)}
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
                {week.issues > 0 && <rect x={bx.toFixed(1)} y={yIssue.toFixed(1)} width={barW.toFixed(1)} height={hIssue.toFixed(1)} fill={COL.issue} opacity={0.88} rx={2} />}
                {includePRs && week.merged > 0 && <rect x={bx.toFixed(1)} y={yMerged.toFixed(1)} width={barW.toFixed(1)} height={hMerged.toFixed(1)} fill={COL.prMerged} opacity={0.88} rx={2} />}
                {includePRs && week.closed > 0 && <rect x={bx.toFixed(1)} y={yClosed.toFixed(1)} width={barW.toFixed(1)} height={hClosed.toFixed(1)} fill={COL.prClosed} opacity={0.88} rx={2} />}
                <rect x={bx.toFixed(1)} y={T} width={barW.toFixed(1)} height={CH} fill="transparent" className="vel-hover-area" onMouseEnter={(e) => onEnter(e, week)} />
              </g>
            );
          })}

          <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
          <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

          {yLabels.map((c) => (
            <text key={c} x={L - 6} y={pyFn(c) + 4} textAnchor="end" fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">{c}</text>
          ))}
          {xIndices.map((wi, li) => (
            <text key={wi} x={(barX(wi) + barW / 2).toFixed(1)} y={T + CH + 20}
              textAnchor={li === 0 ? "start" : li === numX - 1 ? "end" : "middle"}
              fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">
              {fmtDate(new Date(weeks[wi]?.startMs ?? 0).toISOString())}
            </text>
          ))}

          <ChartLegend
            items={[
              { color: COL.issue,    label: "Issues closed" },
              ...(includePRs ? [
                { color: COL.prMerged, label: "PRs merged" },
                { color: COL.prClosed, label: "PRs closed" },
              ] : []),
            ]}
            cx={L + CW / 2}
            y={T - 8}
            fill={COL.label}
          />
        </svg>
      </Box>
    );
  }

  // ── Multi-milestone rendering (one bar per milestone per week) ───────────────
  const { maxTotal, slotW, msBarW, msBarX, pyFn, yLabels, numX, xIndices } = multiAxis!;

  const msCardStyle = msHover
    ? hoverCardPos(msHover.x, msHover.y, wrapRef.current?.offsetWidth ?? 800, 210, 80)
    : {};

  return (
    <Box className="chart-wrap" ref={wrapRef} style={{ position: "relative" }}>
      {msHover && (
        <Paper elevation={2} sx={{ ...HOVER_CARD_BASE_SX, ...msCardStyle }}>
          <Box sx={{ ...STAT_ROW_SX, fontSize: FS.sm, color: "text.secondary" }}>
            <Box sx={{ ...DOT_SX, bgcolor: msHover.msColor }} />
            {msHover.msTitle}
          </Box>
          <Box sx={CARD_LABEL_SX}>
            {DAY_NAMES[new Date(msHover.week.startMs).getUTCDay()]} {fmtDate(new Date(msHover.week.startMs).toISOString())} – {DAY_NAMES[new Date(msHover.week.endMs).getUTCDay()]} {fmtDate(new Date(msHover.week.endMs).toISOString())}
          </Box>
          <Box sx={{ fontSize: FS.md, fontWeight: 600 }}>
            {pluralize(msHover.week.total, "item")} completed
          </Box>
        </Paper>
      )}

      <table className="sr-only" aria-label="Velocity data by milestone">
        <caption>Items completed per week per milestone</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            {milestones.map((ms) => <th key={ms.number} scope="col">{ms.title}</th>)}
          </tr>
        </thead>
        <tbody>
          {allWeekStarts.map((ws) => (
            <tr key={ws}>
              <td>{fmtDate(new Date(ws).toISOString())}</td>
              {milestones.map((ms) => (
                <td key={ms.number}>{msWeekMap.get(ms.number)?.get(ws)?.total ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true" onMouseLeave={() => setMsHover(null)}>
        {yLabels.map((c) => (
          <line key={c} x1={L} y1={pyFn(c).toFixed(1)} x2={L + CW} y2={pyFn(c).toFixed(1)}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        {allWeekStarts.map((ws, wi) => (
          <g key={ws}>
            {milestones.map((ms, mi) => {
              const week = msWeekMap.get(ms.number)?.get(ws);
              if (!week || week.total === 0) {return null;}
              const bx = msBarX(wi, mi);
              const h  = (week.total / maxTotal) * CH;
              const by = T + CH - h;
              return (
                <rect
                  key={ms.number}
                  x={bx.toFixed(1)} y={by.toFixed(1)}
                  width={msBarW.toFixed(1)} height={h.toFixed(1)}
                  fill={ms.color} opacity={0.88} rx={2}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => onMsEnter(e, ms, week)}
                />
              );
            })}
          </g>
        ))}

        <line x1={L} y1={T + CH} x2={L + CW} y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T}      x2={L}       y2={T + CH} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((c) => (
          <text key={c} x={L - 6} y={pyFn(c) + 4} textAnchor="end" fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">{c}</text>
        ))}
        {xIndices.map((wi, li) => {
          const xs = allWeekStarts[wi];
          if (xs === undefined) { return null; }
          const cx = L + wi * slotW + slotW / 2;
          return (
            <text key={wi} x={cx.toFixed(1)} y={T + CH + 20}
              textAnchor={li === 0 ? "start" : li === numX - 1 ? "end" : "middle"}
              fill={COL.label} fontSize={10} fontFamily="inherit" className="chart-label">
              {fmtDate(new Date(xs).toISOString())}
            </text>
          );
        })}

        <ChartLegend
          items={milestones.map((ms) => ({ color: ms.color, label: ms.title }))}
          cx={L + CW / 2}
          y={T - 8}
          fill={COL.label}
        />

      </svg>
    </Box>
  );
};

const Velocity = memo(VelocityInner);

export { Velocity };
