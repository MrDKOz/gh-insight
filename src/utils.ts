import type { TimelineItem } from './types';

/** Milliseconds in one day. */
export const MS = 86_400_000;

/** Format an ISO date string as "D Mon" (e.g. "3 Jan"). Returns 'N/A' for falsy input. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Returns the effective end date for any timeline item (close date for issues, merge/close for PRs). */
export function itemEndDate(item: TimelineItem): string | null {
  return item.type === 'issue' ? item.closedAt : (item.mergedAt ?? item.closedAt);
}

/** Shared colours for issue/PR status and chart axes — used across UI and chart components. */
export const COLORS = {
  issue:     '#0969da',
  prMerged:  '#8250df',
  prClosed:  '#dc3545',
  chartAxis: '#57606a',
  chartGrid: '#d0d7de',
} as const;

/**
 * Compute hover card position relative to a wrapper element.
 * Flips right when near the right edge, flips up when near the top.
 */
export function hoverCardPos(
  x: number, y: number, wrapWidth: number,
  cardW: number, cardH: number,
): { top: number; left?: number; right?: number } {
  return {
    top: y < cardH + 14 ? y + 14 : y - cardH,
    ...(x > wrapWidth - cardW ? { right: wrapWidth - x + 14 } : { left: x + 14 }),
  };
}
