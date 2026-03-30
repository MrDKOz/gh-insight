import type { TimelineItem } from "../types/GitHubTypes";

/**
 * App-wide font-size scale. Use these named tokens everywhere instead of raw
 * rem strings — a single edit here updates every consumer at once.
 *
 *   tiny  0.5625rem  mini type/label badges
 *   xs    0.625rem   small inline badges and counts
 *   sm    0.6875rem  table headers, chip labels, card meta
 *   base  0.75rem    table cells, link numbers, dates
 *   md    0.8125rem  body text, card titles, form inputs
 *   lg    0.875rem   empty-state messages
 */
const FS = {
  tiny: "0.5625rem",
  xs:   "0.625rem",
  sm:   "0.6875rem",
  base: "0.75rem",
  md:   "0.8125rem",
  lg:   "0.875rem",
} as const;

const hoverCardPos = (
  x: number,
  y: number,
  wrapWidth: number,
  cardW: number,
  cardH: number,
): { top: number; left?: number; right?: number } => ({
  top: y < cardH + 14 ? y + 14 : y - cardH,
  ...(x > wrapWidth - cardW ? { right: wrapWidth - x + 14 } : { left: x + 14 }),
});

/**
 * Returns the URL only if it is a valid https GitHub URL.
 * Rejects javascript:, data:, http:, and any non-GitHub domain — so a
 * compromised API response cannot inject links to attacker-controlled sites.
 */
const safeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "github.com" || parsed.hostname.endsWith(".github.com"))
    ) {
      return url;
    }
  } catch {
    // malformed URL
  }
  return "#";
};

/** Assignees who are not also the author — used for author/assignee display logic. */
const assigneesOtherThanAuthor = (assignees: string[], author: string): string[] =>
  assignees.filter((a) => a !== author);

/**
 * Binary upper-bound search: returns the number of elements in a sorted array
 * that are ≤ t (i.e., the first index where arr[i] > t).
 */
const upperBound = (arr: number[], t: number): number => {
  let lo = 0, hi = arr.length;
  // arr[mid] is always within bounds: mid = (lo+hi)>>>1, and lo < hi throughout the loop
  while (lo < hi) { const mid = (lo + hi) >>> 1; (arr[mid] ?? Infinity) <= t ? (lo = mid + 1) : (hi = mid); }
  return lo;
};

/** Canonical open/closed/merged status for any timeline item. */
const itemStatus = (item: TimelineItem): "Open" | "Closed" | "Merged" => {
  if (item.type === "issue") { return item.closedAt ? "Closed" : "Open"; }
  if (item.mergedAt) { return "Merged"; }
  if (item.closedAt) { return "Closed"; }
  return "Open";
};

/** Returns `"${count} ${word}"` with an "s" suffix when count !== 1. */
const pluralize = (count: number, word: string): string =>
  `${count} ${word}${count !== 1 ? "s" : ""}`;

const itemEndDate = (item: TimelineItem): string | null =>
  item.type === "issue" ? item.closedAt : (item.mergedAt ?? item.closedAt);

export { FS, assigneesOtherThanAuthor, hoverCardPos, itemEndDate, itemStatus, pluralize, safeUrl, upperBound };
