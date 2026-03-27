import type { TimelineItem } from "../types";
import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import { COLORS, COLORS_CB, MS, pluralize } from "../utils/utils";

type StatProps = {
  value: string;
  label: string;
  title?: string;
  lightColor?: string;
  darkColor?: string;
};

const Stat: FunctionComponent<StatProps> = ({ value, label, title, lightColor, darkColor }) => (
  <Box title={title} sx={{ textAlign: "center" }}>
    <Typography
      variant="h6"
      fontWeight={700}
      lineHeight={1}
      sx={
        lightColor
          ? (theme) => ({ color: theme.palette.mode === "dark" ? (darkColor ?? lightColor) : lightColor })
          : undefined
      }
    >
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ whiteSpace: "nowrap", mt: 0.25 }}>
      {label}
    </Typography>
  </Box>
);

type Props = {
  items: TimelineItem[];
  view: string;
  colorblindMode: boolean;
};

const StatsBar: FunctionComponent<Props> = ({ items, view, colorblindMode }) => {
  const palette = colorblindMode ? COLORS_CB : COLORS;

  const general = useMemo(() => {
    const issueItems = items.filter((i) => i.type === "issue");
    const prItems    = items.filter((i) => i.type === "pr");
    const closedIssues = issueItems.filter((i) => i.closedAt);
    const openIssues   = issueItems.filter((i) => !i.closedAt);
    const mergedPRs    = prItems.filter((i) => i.mergedAt);
    const closedPRs    = prItems.filter((i) => !i.mergedAt && i.closedAt);

    const cycleTimes = closedIssues.map((i) =>
      Math.round((new Date(i.closedAt!).getTime() - new Date(i.createdAt).getTime()) / MS),
    );
    const cycleStats = cycleTimes.length > 0 ? {
      avg:     Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length),
      fastest: Math.min(...cycleTimes),
      slowest: Math.max(...cycleTimes),
    } : null;

    return { closedIssues, openIssues, mergedPRs, closedPRs, cycleStats };
  }, [items]);

  const reviewWait = useMemo(() => {
    if (view !== "Review Wait") {return null;}
    const prs = items.filter((i): i is Extract<TimelineItem, { type: "pr" }> => i.type === "pr");
    const reviewed   = prs.filter((p) => p.firstReviewAt !== null);
    const unreviewed = prs.filter((p) => p.firstReviewAt === null);
    const waitDays   = reviewed.map((p) =>
      Math.round((new Date(p.firstReviewAt!).getTime() - new Date(p.createdAt).getTime()) / MS),
    );
    const waitDetails = waitDays.length > 0 ? {
      avg:     Math.round(waitDays.reduce((a, b) => a + b, 0) / waitDays.length),
      fastest: Math.min(...waitDays),
      slowest: Math.max(...waitDays),
    } : null;
    return { total: prs.length, reviewed: reviewed.length, unreviewed: unreviewed.length, waitDetails };
  }, [items, view]);

  const { closedIssues, openIssues, mergedPRs, closedPRs, cycleStats } = general;

  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={2.5}
      flexWrap="wrap"
      sx={{ py: 1.5, borderBottom: 1, borderColor: "divider" }}
    >
      {reviewWait ? (
        <>
          <Stat value={String(reviewWait.total)}    label="PRs total"    title="Total pull requests shown" />
          <Stat value={String(reviewWait.reviewed)} label="Reviewed"     title="PRs that received at least one review" lightColor={palette.prMerged} />
          {reviewWait.unreviewed > 0 && (
            <Stat value={String(reviewWait.unreviewed)} label="Not reviewed" title="PRs with no review recorded" lightColor="#d97706" darkColor="#f59e0b" />
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
                lightColor="#1a7f37"
                darkColor="#3fb950"
                label="Fastest"
                title={`Shortest review wait: ${pluralize(reviewWait.waitDetails.fastest, "day")}`}
              />
              <Stat
                value={`${reviewWait.waitDetails.slowest}d`}
                lightColor="#d97706"
                darkColor="#f59e0b"
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
            <Stat value={String(openIssues.length)} lightColor="#d97706" darkColor="#f59e0b" label="Issues open" title="Number of issues still open" />
          )}
          <Stat value={String(mergedPRs.length)} lightColor={palette.prMerged} label="PRs merged" title="Number of pull requests that have been merged" />
          {closedPRs.length > 0 && (
            <Stat value={String(closedPRs.length)} lightColor={palette.prClosed} label="PRs closed" title="Number of pull requests closed without being merged" />
          )}
          {cycleStats !== null && (
            <>
              <Divider orientation="vertical" flexItem />
              <Stat value={`${cycleStats.avg}d`}     label="Avg cycle" title="Average days from issue creation to close, across all closed issues" />
              <Stat value={`${cycleStats.fastest}d`} lightColor="#1a7f37" darkColor="#3fb950" label="Fastest" title={`Fastest issue closed in ${pluralize(cycleStats.fastest, "day")} (creation to close)`} />
              <Stat value={`${cycleStats.slowest}d`} lightColor="#d97706" darkColor="#f59e0b" label="Slowest" title={`Slowest issue took ${pluralize(cycleStats.slowest, "day")} to close (creation to close)`} />
            </>
          )}
        </>
      )}
    </Stack>
  );
};

export { StatsBar };
