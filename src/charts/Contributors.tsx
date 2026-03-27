import type { TimelineItem } from "../types";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { AuthorTag } from "../components/AuthorTag";
import { CHART_EMPTY_STATE_SX, FS, HOVER_CARD_BASE_SX, fmtDate, hoverCardPos, itemEndDate, makeChartColors, safeUrl } from "../utils/utils";
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
  total: number;
};

type Hover = {
  x: number;
  y: number;
  row: ContribRow;
  segment: "issues" | "merged" | "closed";
  count: number;
  earliestDate: string | null;
  latestDate: string | null;
};

// L is the left margin reserved for avatar + username label.
const L = 170, R = 48, T = 20, B = 36, W = 1200;
const ROW_H = 36;
const BAR_H = 22;
const AVATAR_SIZE = 18;
const AVATAR_R_GAP = 6;   // px between avatar right edge and y-axis line
const AVATAR_T_GAP = 5;   // px between text right edge and avatar left edge

const ContributorsInner: FunctionComponent<Props> = ({ items, colorblindMode }) => {
  const COL = makeChartColors(colorblindMode);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // Map login → contribution counts; fall back to author when no assignees
  const rows: ContribRow[] = useMemo(() => {
    const map = new Map<string, ContribRow>();
    const ensure = (login: string) => {
      if (!map.has(login)) {map.set(login, { login, issues: 0, merged: 0, closed: 0, total: 0 });}
      return map.get(login)!;
    };
    for (const item of items) {
      const logins = item.assignees.length > 0 ? item.assignees : [item.author];
      const endDate = itemEndDate(item);
      if (!endDate) {continue;} // only count completed items
      for (const login of logins) {
        const r = ensure(login);
        if (item.type === "issue") {r.issues++;}
        else if (item.mergedAt) {r.merged++;}
        else {r.closed++;}
        r.total++;
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [items]);

  // For hover card: earliest/latest completion date per (login, segment)
  const dateIndex = useMemo(() => {
    const idx = new Map<string, { earliest: string; latest: string }>();
    for (const item of items) {
      const endDate = itemEndDate(item);
      if (!endDate) {continue;}
      const logins = item.assignees.length > 0 ? item.assignees : [item.author];
      const seg: "issues" | "merged" | "closed" =
        item.type === "issue" ? "issues" : item.mergedAt ? "merged" : "closed";
      for (const login of logins) {
        const key = `${login}:${seg}`;
        const existing = idx.get(key);
        if (!existing) {
          idx.set(key, { earliest: endDate, latest: endDate });
        } else {
          if (endDate < existing.earliest) {existing.earliest = endDate;}
          if (endDate > existing.latest)   {existing.latest   = endDate;}
        }
      }
    }
    return idx;
  }, [items]);

  const onEnter = useCallback(
    (e: React.MouseEvent, row: ContribRow, segment: "issues" | "merged" | "closed", count: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
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

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);
  const CW = W - L - R;
  const H  = T + rows.length * ROW_H + B;

  const barX = (offset: number) => L + (offset / maxTotal) * CW;
  const barW = (count: number)   => (count / maxTotal) * CW;

  const cardStyle = hover
    ? hoverCardPos(hover.x, hover.y, wrapRef.current?.offsetWidth ?? 800, 210, 110)
    : {};

  const segLabel = (s: "issues" | "merged" | "closed") =>
    s === "issues" ? "issues closed" : s === "merged" ? "PRs merged" : "PRs closed";

  const segColor = (s: "issues" | "merged" | "closed") =>
    s === "issues" ? COL.issue : s === "merged" ? COL.prMerged : COL.prClosed;

  // Tick marks on x-axis
  const xStep  = maxTotal <= 10 ? 1 : maxTotal <= 30 ? 5 : Math.ceil(maxTotal / 6);
  const xTicks = Array.from({ length: Math.floor(maxTotal / xStep) + 1 }, (_, i) => i * xStep);

  // Avatar positions
  const avatarX = L - AVATAR_R_GAP - AVATAR_SIZE;
  const textX   = avatarX - AVATAR_T_GAP;

  const LEGEND_ITEMS = [
    { seg: "issues" as const, label: "Issues closed" },
    { seg: "merged" as const, label: "PRs merged" },
    { seg: "closed" as const, label: "PRs closed" },
  ];

  return (
    <Box className="chart-wrap" ref={wrapRef} style={{ position: "relative" }}>
      {hover && (
        <Paper
          elevation={2}
          sx={{ ...HOVER_CARD_BASE_SX, minWidth: 160, ...cardStyle }}
        >
          <AuthorTag login={hover.row.login} />
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: FS.md, fontWeight: 600 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: segColor(hover.segment), flexShrink: 0 }} />
            {hover.count} {segLabel(hover.segment)}
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
              <td>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-hidden="true"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {/* Shared circular clip for all contributor avatars */}
          <clipPath id="contrib-avatar-clip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {xTicks.map((v) => (
          <line key={v}
            x1={barX(v).toFixed(1)} y1={T}
            x2={barX(v).toFixed(1)} y2={T + rows.length * ROW_H}
            stroke={COL.grid} strokeWidth={1} strokeDasharray="4 3" className="chart-grid" />
        ))}

        {rows.map((row, ri) => {
          const cy = T + ri * ROW_H + ROW_H / 2 - BAR_H / 2;
          let offset = 0;

          const segments: Array<{ seg: "issues" | "merged" | "closed"; count: number }> = [
            { seg: "issues", count: row.issues },
            { seg: "merged", count: row.merged },
            { seg: "closed", count: row.closed },
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
                  clipPath="url(#contrib-avatar-clip)"
                />
                <text
                  x={textX.toFixed(1)}
                  y={cy + BAR_H / 2 + 4}
                  textAnchor="end"
                  fill={COL.label}
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
                const x = barX(offset);
                const w = barW(count);
                offset += count;
                return (
                  <rect
                    key={seg}
                    x={x.toFixed(1)}
                    y={cy.toFixed(1)}
                    width={w.toFixed(1)}
                    height={BAR_H}
                    fill={segColor(seg)}
                    opacity={0.88}
                    rx={2}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => onEnter(e, row, seg, count)}
                  />
                );
              })}

              {/* Total label (right of bar) */}
              <text
                x={(barX(row.total) + 5).toFixed(1)}
                y={cy + BAR_H / 2 + 4}
                fill={COL.label}
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
        <line x1={L} y1={T} x2={L} y2={T + rows.length * ROW_H} stroke={COL.axis} strokeWidth={1} className="chart-axis" />
        <line x1={L} y1={T + rows.length * ROW_H} x2={L + CW} y2={T + rows.length * ROW_H} stroke={COL.axis} strokeWidth={1} className="chart-axis" />

        {/* X-axis labels */}
        {xTicks.map((v) => (
          <text key={v}
            x={barX(v).toFixed(1)}
            y={T + rows.length * ROW_H + 18}
            textAnchor="middle"
            fill={COL.label}
            fontSize={9}
            fontFamily="inherit"
            className="chart-label"
          >
            {v}
          </text>
        ))}

        <ChartLegend
          items={LEGEND_ITEMS.map(({ seg, label }) => ({ color: segColor(seg), label }))}
          cx={L + CW / 2}
          y={T - 4}
          fill={COL.label}
        />
      </svg>
    </Box>
  );
};

const Contributors = memo(ContributorsInner);

export { Contributors };
