import { useMemo } from 'react';
import type { TimelineItem } from './types';
import { MS } from './utils';

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
    <div className="stats-bar">
      <div className="stat" title="Number of issues that have been closed">
        <span className="stat-value">{closedIssues.length}</span>
        <span className="stat-label">Issues closed</span>
      </div>
      {openIssues.length > 0 && (
        <div className="stat" title="Number of issues still open">
          <span className="stat-value stat-value--open">{openIssues.length}</span>
          <span className="stat-label">Issues open</span>
        </div>
      )}
      <div className="stat" title="Number of pull requests that have been merged">
        <span className="stat-value stat-value--pr">{mergedPRs.length}</span>
        <span className="stat-label">PRs merged</span>
      </div>
      {closedPRs.length > 0 && (
        <div className="stat" title="Number of pull requests closed without being merged">
          <span className="stat-value stat-value--closed">{closedPRs.length}</span>
          <span className="stat-label">PRs closed</span>
        </div>
      )}
      {avgCycle !== null && (
        <>
          <div className="stat-divider" />
          <div className="stat" title="Average days from issue creation to close, across all closed issues">
            <span className="stat-value">{avgCycle}d</span>
            <span className="stat-label">Avg cycle</span>
          </div>
          <div
            className="stat"
            title={`Fastest issue closed in ${fastestCycle} day${fastestCycle !== 1 ? 's' : ''} (creation to close)`}
          >
            <span className="stat-value stat-value--fast">{fastestCycle}d</span>
            <span className="stat-label">Fastest</span>
          </div>
          <div
            className="stat"
            title={`Slowest issue took ${slowestCycle} day${slowestCycle !== 1 ? 's' : ''} to close (creation to close)`}
          >
            <span className="stat-value stat-value--slow">{slowestCycle}d</span>
            <span className="stat-label">Slowest</span>
          </div>
        </>
      )}
    </div>
  );
}
