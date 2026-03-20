import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import type { TimelineItem } from './types';
import { MS } from './utils';

interface StatProps {
  value: string;
  label: string;
  title?: string;
  lightColor?: string;
  darkColor?: string;
}

const Stat = ({ value, label, title, lightColor, darkColor }: StatProps) => (
  <Box title={title} sx={{ textAlign: 'center' }}>
    <Typography
      variant="h6"
      fontWeight={700}
      lineHeight={1}
      sx={lightColor ? (theme) => ({ color: theme.palette.mode === 'dark' ? (darkColor ?? lightColor) : lightColor }) : undefined}
    >
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ whiteSpace: 'nowrap', mt: 0.25 }}>
      {label}
    </Typography>
  </Box>
);

interface Props {
  items: TimelineItem[];
}

export default function StatsBar({ items }: Props) {
  const { closedIssues, openIssues, mergedPRs, closedPRs, avgCycle, fastestCycle, slowestCycle } =
    useMemo(() => {
      const issueItems   = items.filter(i => i.type === 'issue');
      const prItems      = items.filter(i => i.type === 'pr');
      const closedIssues = issueItems.filter(i => i.closedAt);
      const openIssues   = issueItems.filter(i => !i.closedAt);
      const mergedPRs    = prItems.filter(i => i.mergedAt);
      const closedPRs    = prItems.filter(i => !i.mergedAt && i.closedAt);

      const cycleTimes = closedIssues.map(i =>
        Math.round((new Date(i.closedAt!).getTime() - new Date(i.createdAt).getTime()) / MS),
      );
      const avgCycle     = cycleTimes.length > 0
        ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
        : null;
      const fastestCycle = cycleTimes.length > 0 ? Math.min(...cycleTimes) : null;
      const slowestCycle = cycleTimes.length > 0 ? Math.max(...cycleTimes) : null;

      return { closedIssues, openIssues, mergedPRs, closedPRs, avgCycle, fastestCycle, slowestCycle };
    }, [items]);

  return (
    <Stack direction="row" alignItems="center" gap={2.5} flexWrap="wrap" sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Stat value={String(closedIssues.length)} label="Issues closed" title="Number of issues that have been closed" />
      {openIssues.length > 0 && (
        <Stat value={String(openIssues.length)} lightColor="#d97706" darkColor="#f59e0b" label="Issues open" title="Number of issues still open" />
      )}
      <Stat value={String(mergedPRs.length)} lightColor="#8250df" label="PRs merged" title="Number of pull requests that have been merged" />
      {closedPRs.length > 0 && (
        <Stat value={String(closedPRs.length)} lightColor="#dc3545" label="PRs closed" title="Number of pull requests closed without being merged" />
      )}
      {avgCycle !== null && (
        <>
          <Divider orientation="vertical" flexItem />
          <Stat value={`${avgCycle}d`} label="Avg cycle" title="Average days from issue creation to close, across all closed issues" />
          <Stat
            value={`${fastestCycle}d`}
            lightColor="#1a7f37"
            darkColor="#3fb950"
            label="Fastest"
            title={`Fastest issue closed in ${fastestCycle} day${fastestCycle !== 1 ? 's' : ''} (creation to close)`}
          />
          <Stat
            value={`${slowestCycle}d`}
            lightColor="#d97706"
            darkColor="#f59e0b"
            label="Slowest"
            title={`Slowest issue took ${slowestCycle} day${slowestCycle !== 1 ? 's' : ''} to close (creation to close)`}
          />
        </>
      )}
    </Stack>
  );
}
