import type { TimelineItem } from "../types";

const MS = 86_400_000;

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

const itemEndDate = (item: TimelineItem): string | null =>
  item.type === "issue" ? item.closedAt : (item.mergedAt ?? item.closedAt);

const COLORS = {
  issue: "#0969da",
  prMerged: "#8250df",
  prClosed: "#dc3545",
  chartAxis: "#57606a",
  chartGrid: "#d0d7de",
} as const;

// Okabe-Ito palette — distinguishable for deuteranopia, protanopia and tritanopia.
const COLORS_CB = {
  issue: "#0072B2",      // blue
  prMerged: "#009E73",   // bluish green
  prClosed: "#E69F00",   // amber
  chartAxis: "#57606a",
  chartGrid: "#d0d7de",
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

/**
 * Returns "#000000" or "#ffffff" depending on which provides better contrast
 * against the given hex background color.
 */
const labelTextColor = (hex: string): "#000000" | "#ffffff" => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance per WCAG 2.1
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#000000" : "#ffffff";
};

/** Days between two ISO date strings (rounded, clamped to 0). Returns null when end is null (open items). */
const durationDays = (start: string, end: string | null): number | null => {
  if (!end) {return null;}
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / MS));
};

/** Assignees who are not also the author — used for author/assignee display logic. */
const assigneesOtherThanAuthor = (assignees: string[], author: string): string[] =>
  assignees.filter((a) => a !== author);

export { COLORS, COLORS_CB, MS, assigneesOtherThanAuthor, durationDays, fmtDate, hoverCardPos, itemEndDate, labelTextColor, safeUrl };
