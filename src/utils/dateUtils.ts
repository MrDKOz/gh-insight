import type { ForecastResult } from "../types/AppTypes";
import type { TimelineItem } from "../types/GitHubTypes";
import { upperBound } from "./displayUtils";

/** Short day-of-week names, indexed by `Date.getUTCDay()` (0 = Sun). */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Milliseconds in one day. */
const MS_PER_DAY = 86_400_000;
/** Milliseconds in one hour. */
const MS_PER_HOUR = 3_600_000;
/** Threshold for "stale" open items — 7 days. */
const STALE_MS = 7 * MS_PER_DAY;

/** "1 Jan" or "1 Jan 2024" — local date, safe for null/invalid ISO strings. */
const fmtDate = (iso: string | null | undefined, includeYear = false): string => {
  if (!iso) {return "N/A";}
  const d = new Date(iso);
  if (isNaN(d.getTime())) {return "N/A";}
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  });
};

/** "1 Jan 14:00" — local time, hour precision. Safe for null/invalid ISO strings. */
const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) {return "N/A";}
  const d = new Date(iso);
  if (isNaN(d.getTime())) {return "N/A";}
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${date} ${String(d.getHours()).padStart(2, "0")}:00`;
};

/** Floor a timestamp to the start of its local hour. */
const snapToHour = (ms: number): number => {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  return d.getTime();
};

/** Days between two ISO date strings (rounded, clamped to 0). Returns null when end is null (open items). */
const durationDays = (start: string, end: string | null): number | null => {
  if (!end) {return null;}
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / MS_PER_DAY));
};

/**
 * Projects the completion date for a milestone's open issues.
 *
 * Strategy (in priority order):
 * 1. Linear regression over the last 30 daily data points — captures recent velocity.
 * 2. Average close-rate over the full milestone lifetime — fallback when recent data is flat.
 *
 * Returns null when there are no open issues, no history to extrapolate from,
 * or the projection would be in the past / more than 365 days out.
 */
const forecastCompletion = (
  allItems: TimelineItem[],
  milestoneNumber?: number,
): ForecastResult | null => {
  const todayMs = Date.now();
  const issues = allItems.filter(
    (i) => i.type === "issue" && (milestoneNumber === undefined || i.milestoneNumber === milestoneNumber),
  );
  if (issues.length === 0) {return null;}

  const hasOpenIssues = issues.some((i) => i.closedAt === null);
  if (!hasOpenIssues) {return null;}

  const openCount    = issues.filter((i) => i.closedAt === null).length;
  const closedIssues = issues.filter((i) => i.closedAt !== null);
  const closedCount  = closedIssues.length;

  const allCreatedTs  = issues.map((i) => new Date(i.createdAt).getTime());
  const allClosedTs   = closedIssues.flatMap((i) => i.closedAt ? [new Date(i.closedAt).getTime()] : []);
  const minTime       = Math.min(...allCreatedTs);
  const maxTime       = Math.max(...allCreatedTs, ...allClosedTs, todayMs);
  const totalDays     = Math.max(Math.ceil((maxTime - minTime) / MS_PER_DAY), 1);

  // Build daily open-issue counts
  const sortedCreatedTs = [...allCreatedTs].sort((a, b) => a - b);
  const sortedClosedTs  = [...allClosedTs].sort((a, b) => a - b);
  const pts = Array.from({ length: totalDays + 1 }, (_, idx) => {
    const t = minTime + idx * MS_PER_DAY;
    return upperBound(sortedCreatedTs, t) - upperBound(sortedClosedTs, t);
  });

  // ── Primary: linear regression over last 30 points ───────────────────────────
  const win = pts.slice(-30);
  const windowLength = win.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < windowLength; i++) {
    const y = win[i] ?? 0;
    sumX += i; sumY += y; sumXY += i * y; sumX2 += i * i;
  }
  const denom = windowLength * sumX2 - sumX * sumX;
  let projectedT: number | null = null;
  let method: "regression" | "velocity" = "regression";
  if (denom !== 0) {
    const slope     = (windowLength * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / windowLength;
    if (slope < 0) {
      const zeroDayIdx    = -intercept / slope;
      const windowStartT  = minTime + (totalDays - windowLength + 1) * MS_PER_DAY;
      const candidate     = windowStartT + zeroDayIdx * MS_PER_DAY;
      if (candidate > todayMs && candidate <= todayMs + 365 * MS_PER_DAY) {
        projectedT = candidate;
      }
    }
  }

  // ── Fallback: average close-rate ─────────────────────────────────────────────
  if (projectedT === null && closedCount > 0) {
    const daysPerClose = totalDays / closedCount;
    const candidate    = todayMs + openCount * daysPerClose * MS_PER_DAY;
    if (candidate > todayMs && candidate <= todayMs + 365 * MS_PER_DAY) {
      projectedT = candidate;
      method     = "velocity";
    }
  }

  if (projectedT === null) {return null;}
  return { projectedDate: new Date(projectedT), method, openCount, closedCount, totalDays };
};

/** Builds a Map from ISO date string (YYYY-MM-DD) to holiday name. */
const buildBankHolidayMap = (bankHolidays: ReadonlyArray<{ date: string; name: string }>): Map<string, string> =>
  new Map(bankHolidays.map((h) => [h.date, h.name]));

export { DAY_NAMES, MS_PER_DAY, MS_PER_HOUR, STALE_MS, buildBankHolidayMap, durationDays, fmtDate, fmtDateTime, forecastCompletion, snapToHour };
