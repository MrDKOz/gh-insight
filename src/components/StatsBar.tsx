import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import { COLORS, COLORS_CB } from "../utils/colorUtils";
import { MS_PER_DAY, STALE_MS, fmtDate, forecastCompletion } from "../utils/dateUtils";
import { partitionItems, pluralize } from "../utils/displayUtils";
import { TABLE_HEADER_LABEL_SX } from "../utils/sxTokens";
import { Stat } from "./Stat";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  view: string;
  colorblindMode: boolean;
};

const isOpen = (i: TimelineItem): boolean =>
  i.type === "issue" ? i.closedAt === null : (i.mergedAt === null && i.closedAt === null);

const forecastTooltip = (f: NonNullable<ReturnType<typeof forecastCompletion>>): string =>
  f.method === "regression"
    ? `Estimated by linear regression over recent issue close rate (${f.closedCount} closed over ${f.totalDays} days). The trend line projects when open issues reach zero.`
    : `Estimated by average close rate: ${f.closedCount} issue${f.closedCount !== 1 ? "s" : ""} closed over ${f.totalDays} day${f.totalDays !== 1 ? "s" : ""} → ~${(f.totalDays / f.closedCount).toFixed(1)} days per issue. ${f.openCount} issue${f.openCount !== 1 ? "s" : ""} remaining.`;

const StatsBar: FunctionComponent<Props> = ({ items, milestones, view, colorblindMode }) => {
  const palette = colorblindMode ? COLORS_CB : COLORS;

  const general = useMemo(() => {
    const now = Date.now();
    const { closedIssues, openIssues, mergedPRs, closedPRs } = partitionItems(items);

    const staleCount = items.filter(
      (i) => isOpen(i) && (now - new Date(i.updatedAt).getTime()) > STALE_MS,
    ).length;

    const cycleTimes = closedIssues.flatMap((i) =>
      i.closedAt !== null
        ? [Math.round((new Date(i.closedAt).getTime() - new Date(i.createdAt).getTime()) / MS_PER_DAY)]
        : [],
    );
    const cycleStats = cycleTimes.length > 0 ? {
      avg:     Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length),
      fastest: Math.min(...cycleTimes),
      slowest: Math.max(...cycleTimes),
    } : null;

    return { closedIssues, openIssues, mergedPRs, closedPRs, cycleStats, staleCount };
  }, [items]);

  const reviewWait = useMemo(() => {
    if (view !== "Review Wait") {return null;}
    const prs = items.filter((i): i is Extract<TimelineItem, { type: "pr" }> => i.type === "pr");
    const reviewed   = prs.filter((p): p is typeof p & { firstReviewAt: string } => p.firstReviewAt !== null);
    const unreviewed = prs.filter((p) => p.firstReviewAt === null);
    const waitDays   = reviewed.map((p) =>
      Math.round((new Date(p.firstReviewAt).getTime() - new Date(p.createdAt).getTime()) / MS_PER_DAY),
    );
    const waitDetails = waitDays.length > 0 ? {
      avg:     Math.round(waitDays.reduce((a, b) => a + b, 0) / waitDays.length),
      fastest: Math.min(...waitDays),
      slowest: Math.max(...waitDays),
    } : null;
    return { total: prs.length, reviewed: reviewed.length, unreviewed: unreviewed.length, waitDetails };
  }, [items, view]);

  const { closedIssues, openIssues, mergedPRs, closedPRs, cycleStats, staleCount } = general;

  const milestoneComparison = useMemo(() => {
    if (milestones.length === 0) { return null; }
    const now = Date.now();
    return milestones.map((milestone) => {
      const milestoneItems = items.filter((i) => i.milestoneNumber === milestone.number);
      const milestoneIssues = milestoneItems.filter((i) => i.type === "issue");
      const openCount = milestoneItems.filter(isOpen).length;
      const closedMergedCount = milestoneItems.length - openCount;
      const closedIssuesCycle = milestoneIssues
        .filter((i): i is Extract<TimelineItem, { type: "issue" }> & { closedAt: string } =>
          i.type === "issue" && i.closedAt !== null,
        )
        .map((i) => Math.round((new Date(i.closedAt).getTime() - new Date(i.createdAt).getTime()) / MS_PER_DAY));
      const avgCycle = closedIssuesCycle.length > 0
        ? Math.round(closedIssuesCycle.reduce((a, b) => a + b, 0) / closedIssuesCycle.length)
        : null;
      const milestoneStale = milestoneItems.filter((i) =>
        isOpen(i) && (now - new Date(i.updatedAt).getTime()) > STALE_MS,
      ).length;
      const forecast = forecastCompletion(items, milestone.number);
      return { milestone, openCount, closedMergedCount, avgCycle, stale: milestoneStale, forecast };
    });
  }, [milestones, items]);

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", pb: 0.25 }}>
      <Stack
        direction="row"
        alignItems="center"
        gap={2.5}
        flexWrap="wrap"
        sx={{ py: 0.75 }}
      >
        {reviewWait ? (
          <>
            <Stat value={String(reviewWait.total)}    label="PRs total"    title="Total pull requests shown" />
            <Stat value={String(reviewWait.reviewed)} label="Reviewed"     title="PRs that received at least one review" lightColor={palette.prMerged} />
            {reviewWait.unreviewed > 0 && (
              <Stat value={String(reviewWait.unreviewed)} label="Not reviewed" title="PRs with no review recorded" lightColor={palette.warning} darkColor={palette.warningDark} />
            )}
            {reviewWait.waitDetails !== null && (
              <>
                <Divider orientation="vertical" flexItem />
                <Stat
                  value={reviewWait.waitDetails.avg === 0 ? "same day" : `${reviewWait.waitDetails.avg}d`}
                  label="Avg wait"
                  title="Average days from PR creation to first review"
                />
                <Stat
                  value={reviewWait.waitDetails.fastest === 0 ? "same day" : `${reviewWait.waitDetails.fastest}d`}
                  lightColor={palette.success}
                  darkColor={palette.successDark}
                  label="Fastest"
                  title={`Shortest review wait: ${pluralize(reviewWait.waitDetails.fastest, "day")}`}
                />
                <Stat
                  value={`${reviewWait.waitDetails.slowest}d`}
                  lightColor={palette.warning}
                  darkColor={palette.warningDark}
                  label="Slowest"
                  title={`Longest review wait: ${pluralize(reviewWait.waitDetails.slowest, "day")}`}
                />
              </>
            )}
          </>
        ) : (
          <>
            <Stat value={String(closedIssues.length)} label="Issues closed" title="Number of issues that have been closed" />
            {openIssues.length > 0 && (
              <Stat value={String(openIssues.length)} lightColor={palette.warning} darkColor={palette.warningDark} label="Issues open" title="Number of issues still open" />
            )}
            <Stat value={String(mergedPRs.length)} lightColor={palette.prMerged} label="PRs merged" title="Number of pull requests that have been merged" />
            {closedPRs.length > 0 && (
              <Stat value={String(closedPRs.length)} lightColor={palette.prClosed} label="PRs closed" title="Number of pull requests closed without being merged" />
            )}
            {cycleStats !== null && (
              <>
                <Divider orientation="vertical" flexItem />
                <Stat value={`${cycleStats.avg}d`}     label="Avg cycle" title="Average days from issue creation to close, across all closed issues" />
                <Stat value={`${cycleStats.fastest}d`} lightColor={palette.success} darkColor={palette.successDark} label="Fastest" title={`Fastest issue closed in ${pluralize(cycleStats.fastest, "day")} (creation to close)`} />
                <Stat value={`${cycleStats.slowest}d`} lightColor={palette.warning} darkColor={palette.warningDark} label="Slowest" title={`Slowest issue took ${pluralize(cycleStats.slowest, "day")} to close (creation to close)`} />
              </>
            )}
            {staleCount > 0 && (
              <>
                <Divider orientation="vertical" flexItem />
                <Stat
                  value={String(staleCount)}
                  label="Stale"
                  lightColor={palette.warning}
                  darkColor={palette.warningDark}
                  title={`${pluralize(staleCount, "open item")} with no activity for more than 7 days`}
                />
              </>
            )}
          </>
        )}
      </Stack>

      {milestoneComparison !== null && (
        <Box sx={{ pb: 1.5 }}>
          <Table size="small" sx={{ "& .MuiTableCell-root": { py: 0.5, px: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={TABLE_HEADER_LABEL_SX}>Item</TableCell>
                <TableCell align="right" sx={TABLE_HEADER_LABEL_SX}>Open</TableCell>
                <TableCell align="right" sx={TABLE_HEADER_LABEL_SX}>Closed/Merged</TableCell>
                <TableCell align="right" sx={TABLE_HEADER_LABEL_SX}>Avg cycle</TableCell>
                <TableCell align="right" sx={TABLE_HEADER_LABEL_SX}>Est. completion</TableCell>
                <TableCell align="right" sx={TABLE_HEADER_LABEL_SX}>Stale</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {milestoneComparison.map(({ milestone, openCount, closedMergedCount, avgCycle, stale, forecast }) => (
                <TableRow key={milestone.number} sx={{ "&:last-child td": { border: 0 } }}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <Box sx={{
                        width: 8, height: 8, flexShrink: 0, bgcolor: milestone.color,
                        borderRadius: milestone.kind === "epic" ? "1px" : "50%",
                        transform: milestone.kind === "epic" ? "rotate(45deg)" : "none",
                      }} />
                      <Typography variant="caption" fontWeight={500} sx={{ lineHeight: 1.3 }}>{milestone.title}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="caption"
                      fontWeight={600}
                      sx={(theme) => ({ color: openCount > 0 ? (theme.palette.mode === "dark" ? palette.warningDark : palette.warning) : "text.secondary" })}
                    >
                      {openCount}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" fontWeight={600}>{closedMergedCount}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="text.secondary">{avgCycle !== null ? `${avgCycle}d` : "—"}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    {forecast !== null ? (
                      <Tooltip title={forecastTooltip(forecast)} placement="left" arrow>
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          sx={(theme) => ({ color: theme.palette.mode === "dark" ? palette.successDark : palette.success, cursor: "help" })}
                        >
                          ~{fmtDate(forecast.projectedDate.toISOString())}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="caption"
                      fontWeight={stale > 0 ? 600 : 400}
                      sx={(theme) => ({ color: stale > 0 ? (theme.palette.mode === "dark" ? palette.warningDark : palette.warning) : "text.secondary" })}
                    >
                      {stale > 0 ? stale : "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
};

export { StatsBar };
