import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { AuthorTag } from "../components/AuthorTag";
import { calcXAxisIndices, calcYAxisStep } from "../utils/chartUtils";
import { makeChartColors } from "../utils/colorUtils";
import { DAY_NAMES, MS_PER_DAY, fmtDate } from "../utils/dateUtils";
import { FS, hoverCardPos, itemEndDate, pluralize } from "../utils/displayUtils";
import { CARD_LABEL_SX, CHART_EMPTY_STATE_SX, DOT_SX, HOVER_CARD_BASE_SX, STAT_ROW_SX } from "../utils/sxTokens";
import { ChartLegend } from "./ChartLegend";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  colorblindMode: boolean;
  includePRs: boolean;
};

const weekStart = (ms: number): number => {
  const d = new Date(ms);
  const dow = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1; // Mon=0 … Sun=6 (UTC)
  // Date.UTC keeps everything in UTC — no local-timezone mixing
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
};

const PADDING_LEFT   = 52;
const PADDING_RIGHT  = 20;
const PADDING_TOP    = 24;
const PADDING_BOTTOM = 48;
const SVG_WIDTH      = 1200;
const SVG_HEIGHT     = 320;
const CHART_WIDTH    = SVG_WIDTH  - PADDING_LEFT  - PADDING_RIGHT;
const CHART_HEIGHT   = SVG_HEIGHT - PADDING_TOP   - PADDING_BOTTOM;


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
  const filteredItems = useMemo(
    () => includePRs ? items : items.filter((i) => i.type === "issue"),
    [items, includePRs],
  );
  const chartColors = makeChartColors(colorblindMode);
  const isMulti = milestones.length > 1;
  const containerRef = useRef<HTMLDivElement>(null);
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
        w = { startMs: ws, endMs: ws + 6 * MS_PER_DAY, issues: 0, merged: 0, closed: 0, authors: [] };
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
    for (const milestone of milestones) {msWeekMap.set(milestone.number, new Map());}

    for (const item of filteredItems) {
      const endDate = itemEndDate(item);
      if (!endDate) {continue;}
      const ws = weekStart(new Date(endDate).getTime());
      weekSet.add(ws);
      const bucket = msWeekMap.get(item.milestoneNumber);
      if (!bucket) {continue;}
      let entry = bucket.get(ws);
      if (!entry) {
        entry = { startMs: ws, endMs: ws + 6 * MS_PER_DAY, total: 0 };
        bucket.set(ws, entry);
      }
      entry.total++;
    }
    return { allWeekStarts: [...weekSet].sort((a, b) => a - b), msWeekMap };
  }, [filteredItems, milestones, isMulti]);

  const onEnter = useCallback((e: React.MouseEvent, week: Week) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) { return; }
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, week });
  }, []);

  const onMsEnter = useCallback((e: React.MouseEvent, milestone: MilestoneMeta, week: MilestoneWeek) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {return;}
    setMsHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, msNum: milestone.number, msTitle: milestone.title, msColor: milestone.color, week });
  }, []);

  // Pre-compute axis scales for each mode (two memos so TypeScript can infer distinct field shapes)
  const singleAxis = useMemo(() => {
    if (isMulti || weeks.length === 0) { return null; }
    const maxTotal = Math.max(...weeks.map((w) => w.issues + w.merged + w.closed), 1);
    const slotWidth  = CHART_WIDTH / weeks.length;
    const barWidth   = Math.min(Math.max(slotWidth * 0.72, 6), 80);
    const getBarX   = (i: number) => PADDING_LEFT + i * slotWidth + (slotWidth - barWidth) / 2;
    const yStep   = calcYAxisStep(maxTotal);
    const yLabels = Array.from({ length: Math.floor(maxTotal / yStep) + 1 }, (_, i) => i * yStep);
    const numXLabels = Math.min(8, weeks.length);
    const xIndices = calcXAxisIndices(weeks.length, numXLabels);
    const toSvgY = (count: number) => PADDING_TOP + (1 - count / maxTotal) * CHART_HEIGHT;
    return { maxTotal, slotWidth, barWidth, getBarX, yLabels, numXLabels, xIndices, toSvgY };
  }, [isMulti, weeks]);

  const multiAxis = useMemo(() => {
    if (!isMulti || allWeekStarts.length === 0) { return null; }
    const maxTotal = Math.max(
      ...milestones.flatMap((milestone) => [...(msWeekMap.get(milestone.number)?.values() ?? [])].map((w) => w.total)),
      1,
    );
    const slotWidth  = CHART_WIDTH / allWeekStarts.length;
    const milestoneBarWidth = Math.max(Math.min((slotWidth * 0.8) / milestones.length, 40), 4);
    const getMilestoneBarX = (wi: number, mi: number) => PADDING_LEFT + wi * slotWidth + (slotWidth - milestoneBarWidth * milestones.length) / 2 + mi * milestoneBarWidth;
    const yStep   = calcYAxisStep(maxTotal);
    const yLabels = Array.from({ length: Math.floor(maxTotal / yStep) + 1 }, (_, i) => i * yStep);
    const numXLabels = Math.min(8, allWeekStarts.length);
    const xIndices = calcXAxisIndices(allWeekStarts.length, numXLabels);
    const toSvgY = (count: number) => PADDING_TOP + (1 - count / maxTotal) * CHART_HEIGHT;
    return { maxTotal, slotWidth, milestoneBarWidth, getMilestoneBarX, yLabels, numXLabels, xIndices, toSvgY };
  }, [isMulti, allWeekStarts, milestones, msWeekMap]);

  if ((isMulti ? allWeekStarts.length : weeks.length) === 0) {
    return <Typography sx={CHART_EMPTY_STATE_SX}>No completed {includePRs ? "items" : "issues"} to plot velocity for.</Typography>;
  }

  // ── Single-milestone rendering ───────────────────────────────────────────────
  if (!isMulti) {
    const { maxTotal, barWidth, getBarX, toSvgY, yLabels, numXLabels, xIndices } = singleAxis!;

    const cardStyle = hover
      ? hoverCardPos(hover.x, hover.y, containerRef.current?.offsetWidth ?? 800, 200, 94)
      : {};

    return (
      <Box className="chart-wrap" ref={containerRef} role="presentation" style={{ position: "relative" }}>
        {hover && (
          <Paper elevation={2} sx={{ ...HOVER_CARD_BASE_SX, ...cardStyle }}>
            <Box sx={CARD_LABEL_SX}>
              {DAY_NAMES[new Date(hover.week.startMs).getUTCDay()]} {fmtDate(new Date(hover.week.startMs).toISOString())} – {DAY_NAMES[new Date(hover.week.endMs).getUTCDay()]} {fmtDate(new Date(hover.week.endMs).toISOString())}
            </Box>
            {hover.week.issues > 0 && (
              <Box sx={STAT_ROW_SX}>
                <Box sx={{ ...DOT_SX, bgcolor: chartColors.issue }} />
                {pluralize(hover.week.issues, "issue")} closed
              </Box>
            )}
            {hover.week.merged > 0 && (
              <Box sx={STAT_ROW_SX}>
                <Box sx={{ ...DOT_SX, bgcolor: chartColors.prMerged }} />
                {pluralize(hover.week.merged, "PR")} merged
              </Box>
            )}
            {hover.week.closed > 0 && (
              <Box sx={STAT_ROW_SX}>
                <Box sx={{ ...DOT_SX, bgcolor: chartColors.prClosed }} />
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

        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true" onMouseLeave={() => setHover(null)}>
          {yLabels.map((c) => (
            <line key={c} x1={PADDING_LEFT} y1={toSvgY(c).toFixed(1)} x2={PADDING_LEFT + CHART_WIDTH} y2={toSvgY(c).toFixed(1)}
              stroke={chartColors.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
          ))}

          {weeks.map((week, i) => {
            const bx      = getBarX(i);
            const bottom  = PADDING_TOP + CHART_HEIGHT;
            const hIssue  = (week.issues / maxTotal) * CHART_HEIGHT;
            const hMerged = (week.merged / maxTotal) * CHART_HEIGHT;
            const hClosed = (week.closed / maxTotal) * CHART_HEIGHT;
            const yIssue  = bottom - hIssue;
            const yMerged = yIssue  - hMerged;
            const yClosed = yMerged - hClosed;

            return (
              <g key={week.startMs}>
                {week.issues > 0 && <rect x={bx.toFixed(1)} y={yIssue.toFixed(1)} width={barWidth.toFixed(1)} height={hIssue.toFixed(1)} fill={chartColors.issue} opacity={0.88} rx={2} />}
                {includePRs && week.merged > 0 && <rect x={bx.toFixed(1)} y={yMerged.toFixed(1)} width={barWidth.toFixed(1)} height={hMerged.toFixed(1)} fill={chartColors.prMerged} opacity={0.88} rx={2} />}
                {includePRs && week.closed > 0 && <rect x={bx.toFixed(1)} y={yClosed.toFixed(1)} width={barWidth.toFixed(1)} height={hClosed.toFixed(1)} fill={chartColors.prClosed} opacity={0.88} rx={2} />}
                <rect x={bx.toFixed(1)} y={PADDING_TOP} width={barWidth.toFixed(1)} height={CHART_HEIGHT} fill="transparent" className="vel-hover-area" onMouseEnter={(e) => onEnter(e, week)} />
              </g>
            );
          })}

          <line x1={PADDING_LEFT} y1={PADDING_TOP + CHART_HEIGHT} x2={PADDING_LEFT + CHART_WIDTH} y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />
          <line x1={PADDING_LEFT} y1={PADDING_TOP}      x2={PADDING_LEFT}       y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />

          {yLabels.map((c) => (
            <text key={c} x={PADDING_LEFT - 6} y={toSvgY(c) + 4} textAnchor="end" fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">{c}</text>
          ))}
          {xIndices.map((wi, li) => (
            <text key={wi} x={(getBarX(wi) + barWidth / 2).toFixed(1)} y={PADDING_TOP + CHART_HEIGHT + 20}
              textAnchor={li === 0 ? "start" : li === numXLabels - 1 ? "end" : "middle"}
              fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">
              {fmtDate(new Date(weeks[wi]?.startMs ?? 0).toISOString())}
            </text>
          ))}

          <ChartLegend
            items={[
              { color: chartColors.issue,    label: "Issues closed" },
              ...(includePRs ? [
                { color: chartColors.prMerged, label: "PRs merged" },
                { color: chartColors.prClosed, label: "PRs closed" },
              ] : []),
            ]}
            cx={PADDING_LEFT + CHART_WIDTH / 2}
            y={PADDING_TOP - 8}
            fill={chartColors.label}
          />
        </svg>
      </Box>
    );
  }

  // ── Multi-milestone rendering (one bar per milestone per week) ───────────────
  const { maxTotal, slotWidth, milestoneBarWidth, getMilestoneBarX, toSvgY, yLabels, numXLabels, xIndices } = multiAxis!;

  const msCardStyle = msHover
    ? hoverCardPos(msHover.x, msHover.y, containerRef.current?.offsetWidth ?? 800, 210, 80)
    : {};

  return (
    <Box className="chart-wrap" ref={containerRef} style={{ position: "relative" }}>
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
            {milestones.map((milestone) => <th key={milestone.number} scope="col">{milestone.title}</th>)}
          </tr>
        </thead>
        <tbody>
          {allWeekStarts.map((ws) => (
            <tr key={ws}>
              <td>{fmtDate(new Date(ws).toISOString())}</td>
              {milestones.map((milestone) => (
                <td key={milestone.number}>{msWeekMap.get(milestone.number)?.get(ws)?.total ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true" onMouseLeave={() => setMsHover(null)}>
        {yLabels.map((c) => (
          <line key={c} x1={PADDING_LEFT} y1={toSvgY(c).toFixed(1)} x2={PADDING_LEFT + CHART_WIDTH} y2={toSvgY(c).toFixed(1)}
            stroke={chartColors.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        {allWeekStarts.map((ws, wi) => (
          <g key={ws}>
            {milestones.map((milestone, mi) => {
              const week = msWeekMap.get(milestone.number)?.get(ws);
              if (!week || week.total === 0) {return null;}
              const bx = getMilestoneBarX(wi, mi);
              const barHeight = (week.total / maxTotal) * CHART_HEIGHT;
              const by = PADDING_TOP + CHART_HEIGHT - barHeight;
              return (
                <rect
                  key={milestone.number}
                  x={bx.toFixed(1)} y={by.toFixed(1)}
                  width={milestoneBarWidth.toFixed(1)} height={barHeight.toFixed(1)}
                  fill={milestone.color} opacity={0.88} rx={2}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => onMsEnter(e, milestone, week)}
                />
              );
            })}
          </g>
        ))}

        <line x1={PADDING_LEFT} y1={PADDING_TOP + CHART_HEIGHT} x2={PADDING_LEFT + CHART_WIDTH} y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />
        <line x1={PADDING_LEFT} y1={PADDING_TOP}      x2={PADDING_LEFT}       y2={PADDING_TOP + CHART_HEIGHT} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />

        {yLabels.map((c) => (
          <text key={c} x={PADDING_LEFT - 6} y={toSvgY(c) + 4} textAnchor="end" fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">{c}</text>
        ))}
        {xIndices.map((wi, li) => {
          const xs = allWeekStarts[wi];
          if (xs === undefined) { return null; }
          const cx = PADDING_LEFT + wi * slotWidth + slotWidth / 2;
          return (
            <text key={wi} x={cx.toFixed(1)} y={PADDING_TOP + CHART_HEIGHT + 20}
              textAnchor={li === 0 ? "start" : li === numXLabels - 1 ? "end" : "middle"}
              fill={chartColors.label} fontSize={10} fontFamily="inherit" className="chart-label">
              {fmtDate(new Date(xs).toISOString())}
            </text>
          );
        })}

        <ChartLegend
          items={milestones.map((milestone) => ({ color: milestone.color, label: milestone.title }))}
          cx={PADDING_LEFT + CHART_WIDTH / 2}
          y={PADDING_TOP - 8}
          fill={chartColors.label}
        />

      </svg>
    </Box>
  );
};

const Velocity = memo(VelocityInner);

export { Velocity };
