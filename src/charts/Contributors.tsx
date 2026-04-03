import type { TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent, MouseEvent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useId, useMemo, useRef, useState } from "react";

import { AuthorTag } from "../components/AuthorTag";
import { makeChartColors } from "../utils/colorUtils";
import { fmtDate } from "../utils/dateUtils";
import { FS, hoverCardPos, itemEndDate, safeUrl } from "../utils/displayUtils";
import { CHART_EMPTY_STATE_SX, DOT_SX, HOVER_CARD_BASE_SX } from "../utils/sxTokens";
import { ChartLegend } from "./ChartLegend";

type Props = {
  items: TimelineItem[];
  colorblindMode: boolean;
};

type ContribRow = {
  login: string;
  issues: number;
  merged: number;
  closed: number;
  openIssue: number;
  openPR: number;
  total: number;
};

type Segment = "issues" | "merged" | "closed" | "openIssue" | "openPR";

type Hover = {
  x: number;
  y: number;
  row: ContribRow;
  segment: Segment;
  count: number;
  earliestDate: string | null;
  latestDate: string | null;
};

const SEG_LABELS: Record<Segment, string> = {
  issues:    "issues closed",
  merged:    "PRs merged",
  closed:    "PRs closed",
  openIssue: "open issues",
  openPR:    "open PRs",
};

// PADDING_LEFT is the left margin reserved for avatar + username label.
const PADDING_LEFT   = 170;
const PADDING_RIGHT  = 48;
const PADDING_TOP    = 20;
const PADDING_BOTTOM = 36;
const SVG_WIDTH      = 1200;
const ROW_H = 36;
const BAR_H = 22;
const AVATAR_SIZE = 18;
const AVATAR_R_GAP = 6;   // px between avatar right edge and y-axis line
const AVATAR_T_GAP = 5;   // px between text right edge and avatar left edge

const ContributorsInner: FunctionComponent<Props> = ({ items, colorblindMode }) => {
  const chartColors = makeChartColors(colorblindMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const clipId = `contrib-avatar-clip-${useId().replace(/:/g, "")}`;

  // Single pass over items builds both contribution rows and the date-range index
  // used by hover cards — avoids iterating items twice.
  const { rows, dateIndex } = useMemo(() => {
    const rowMap = new Map<string, ContribRow>();
    const ensure = (login: string): ContribRow => {
      let entry = rowMap.get(login);
      if (!entry) {
        entry = { login, issues: 0, merged: 0, closed: 0, openIssue: 0, openPR: 0, total: 0 };
        rowMap.set(login, entry);
      }
      return entry;
    };
    const dateIndex = new Map<string, { earliest: string; latest: string }>();

    for (const item of items) {
      const logins  = item.assignees.length > 0 ? item.assignees : [item.author];
      const endDate = itemEndDate(item);
      const seg: Segment =
        !endDate
          ? (item.type === "issue" ? "openIssue" : "openPR")
          : item.type === "issue"
            ? "issues"
            : item.mergedAt ? "merged" : "closed";

      for (const login of logins) {
        const row = ensure(login);
        row[seg]++;
        row.total++;

        if (endDate) {
          const key = `${login}:${seg}`;
          const existing = dateIndex.get(key);
          if (!existing) {
            dateIndex.set(key, { earliest: endDate, latest: endDate });
          } else {
            if (endDate < existing.earliest) { existing.earliest = endDate; }
            if (endDate > existing.latest)   { existing.latest   = endDate; }
          }
        }
      }
    }
    return { rows: [...rowMap.values()].sort((a, b) => b.total - a.total), dateIndex };
  }, [items]);

  const onEnter = useCallback(
    (e: MouseEvent, row: ContribRow, segment: Segment, count: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {return;}
      const dates = dateIndex.get(`${row.login}:${segment}`);
      setHover({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        row,
        segment,
        count,
        earliestDate: dates?.earliest ?? null,
        latestDate:   dates?.latest   ?? null,
      });
    },
    [dateIndex],
  );

  if (rows.length === 0) {
    return (
      <Typography sx={CHART_EMPTY_STATE_SX}>
        No completed items to show contributor breakdown for.
      </Typography>
    );
  }

  const segColors: Record<Segment, string> = {
    issues:    chartColors.issue,
    merged:    chartColors.prMerged,
    closed:    chartColors.prClosed,
    openIssue: chartColors.issueOpen,
    openPR:    chartColors.prOpen,
  };

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);
  const chartWidth = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const svgHeight  = PADDING_TOP + rows.length * ROW_H + PADDING_BOTTOM;

  const getBarX = (offset: number) => PADDING_LEFT + (offset / maxTotal) * chartWidth;
  const getBarWidth = (count: number)  => (count / maxTotal) * chartWidth;

  const cardStyle = hover
    ? hoverCardPos(hover.x, hover.y, containerRef.current?.offsetWidth ?? 800, 210, 110)
    : {};

  // Tick marks on x-axis
  const xStep  = maxTotal <= 10 ? 1 : maxTotal <= 30 ? 5 : Math.ceil(maxTotal / 6);
  const xTicks = Array.from({ length: Math.floor(maxTotal / xStep) + 1 }, (_, i) => i * xStep);

  // Avatar positions
  const avatarX = PADDING_LEFT - AVATAR_R_GAP - AVATAR_SIZE;
  const textX   = avatarX - AVATAR_T_GAP;

  // Only show legend entries for segments that actually appear in the data.
  const ALL_LEGEND_ITEMS: { seg: Segment; label: string }[] = [
    { seg: "issues",    label: "Issues closed" },
    { seg: "merged",    label: "PRs merged" },
    { seg: "closed",    label: "PRs closed" },
    { seg: "openIssue", label: "Open issues" },
    { seg: "openPR",    label: "Open PRs" },
  ];
  const usedSegs = new Set(rows.flatMap((r) =>
    (["issues", "merged", "closed", "openIssue", "openPR"] as Segment[]).filter((s) => r[s] > 0),
  ));
  const legendItems = ALL_LEGEND_ITEMS.filter(({ seg }) => usedSegs.has(seg));

  return (
    <Box className="chart-wrap" ref={containerRef} role="presentation" style={{ position: "relative" }}>
      {hover && (
        <Paper
          elevation={2}
          sx={{ ...HOVER_CARD_BASE_SX, minWidth: 160, ...cardStyle }}
        >
          <AuthorTag login={hover.row.login} />
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: FS.md, fontWeight: 600 }}>
            <Box sx={{ ...DOT_SX, bgcolor: segColors[hover.segment] }} />
            {hover.count} {SEG_LABELS[hover.segment]}
          </Box>
          {hover.earliestDate && hover.latestDate && hover.earliestDate !== hover.latestDate && (
            <Box sx={{ fontSize: FS.sm, color: "text.secondary", fontWeight: 500 }}>
              {fmtDate(hover.earliestDate)} – {fmtDate(hover.latestDate)}
            </Box>
          )}
          <Box sx={{ fontSize: FS.sm, color: "text.secondary", borderTop: 1, borderColor: "divider", pt: "4px", mt: "2px", fontWeight: 600 }}>
            Total: {hover.row.total}
          </Box>
        </Paper>
      )}

      <table className="sr-only" aria-label="Contributor breakdown data">
        <caption>Completed items per contributor</caption>
        <thead>
          <tr>
            <th scope="col">Contributor</th>
            <th scope="col">Issues closed</th>
            <th scope="col">PRs merged</th>
            <th scope="col">PRs closed</th>
            <th scope="col">Open issues</th>
            <th scope="col">Open PRs</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.login}>
              <td>{row.login}</td>
              <td>{row.issues}</td>
              <td>{row.merged}</td>
              <td>{row.closed}</td>
              <td>{row.openIssue}</td>
              <td>{row.openPR}</td>
              <td>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-hidden="true"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {/* Shared circular clip for all contributor avatars */}
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {xTicks.map((v) => (
          <line key={v}
            x1={getBarX(v).toFixed(1)} y1={PADDING_TOP}
            x2={getBarX(v).toFixed(1)} y2={PADDING_TOP + rows.length * ROW_H}
            stroke={chartColors.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        {rows.map((row, ri) => {
          const cy = PADDING_TOP + ri * ROW_H + ROW_H / 2 - BAR_H / 2;
          let offset = 0;

          const segments: Array<{ seg: Segment; count: number }> = [
            { seg: "issues",    count: row.issues },
            { seg: "merged",    count: row.merged },
            { seg: "closed",    count: row.closed },
            { seg: "openIssue", count: row.openIssue },
            { seg: "openPR",    count: row.openPR },
          ];

          const profileUrl = safeUrl(`https://github.com/${row.login}`);
          const avatarUrl  = safeUrl(`https://github.com/${row.login}.png?size=40`);

          return (
            <g key={row.login}>
              {/* Avatar + username — both wrapped in a link to the GitHub profile */}
              <a href={profileUrl} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }}>
                <image
                  href={avatarUrl}
                  x={avatarX.toFixed(1)}
                  y={(cy + (BAR_H - AVATAR_SIZE) / 2).toFixed(1)}
                  width={AVATAR_SIZE}
                  height={AVATAR_SIZE}
                  clipPath={`url(#${clipId})`}
                />
                <text
                  x={textX.toFixed(1)}
                  y={cy + BAR_H / 2 + 4}
                  textAnchor="end"
                  fill={chartColors.label}
                  fontSize={10}
                  fontFamily="inherit"
                  className="chart-label"
                >
                  {row.login}
                </text>
              </a>

              {/* Stacked segments */}
              {segments.map(({ seg, count }) => {
                if (count === 0) {return null;}
                const x = getBarX(offset);
                const barWidth = getBarWidth(count);
                offset += count;
                return (
                  <rect
                    key={seg}
                    x={x.toFixed(1)}
                    y={cy.toFixed(1)}
                    width={barWidth.toFixed(1)}
                    height={BAR_H}
                    fill={segColors[seg]}
                    opacity={0.88}
                    rx={2}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => onEnter(e, row, seg, count)}
                  />
                );
              })}

              {/* Total label (right of bar) */}
              <text
                x={(getBarX(row.total) + 5).toFixed(1)}
                y={cy + BAR_H / 2 + 4}
                fill={chartColors.label}
                fontSize={9}
                fontFamily="inherit"
                className="chart-label"
              >
                {row.total}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={PADDING_LEFT} y1={PADDING_TOP} x2={PADDING_LEFT} y2={PADDING_TOP + rows.length * ROW_H} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />
        <line x1={PADDING_LEFT} y1={PADDING_TOP + rows.length * ROW_H} x2={PADDING_LEFT + chartWidth} y2={PADDING_TOP + rows.length * ROW_H} stroke={chartColors.axis} strokeWidth={1} className="chart-axis" />

        {/* X-axis labels */}
        {xTicks.map((v) => (
          <text key={v}
            x={getBarX(v).toFixed(1)}
            y={PADDING_TOP + rows.length * ROW_H + 18}
            textAnchor="middle"
            fill={chartColors.label}
            fontSize={9}
            fontFamily="inherit"
            className="chart-label"
          >
            {v}
          </text>
        ))}

        <ChartLegend
          items={legendItems.map(({ seg, label }) => ({ color: segColors[seg], label }))}
          cx={PADDING_LEFT + chartWidth / 2}
          y={PADDING_TOP - 4}
          fill={chartColors.label}
        />
      </svg>
    </Box>
  );
};

const Contributors = memo(ContributorsInner);

export { Contributors };
