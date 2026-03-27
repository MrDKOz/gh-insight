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

/**
 * Canonical colour palette. Always reference these instead of hardcoding hex values.
 * issueDark / prMergedDark / prClosedDark are the gradient-end shades used in
 * the Gantt legend; keep them in sync if the primary colours ever change.
 */
const COLORS = {
  issue:        "#0969da",
  issueDark:    "#0550ae",
  prMerged:     "#8250df",
  prMergedDark: "#6639ba",
  prClosed:     "#dc3545",
  prClosedDark: "#c82333",
  chartAxis:    "#57606a",
  chartGrid:    "#d0d7de",
  /** Amber — used for open items, slow metrics, "not reviewed" warnings. */
  warning:      "#d97706",
  warningDark:  "#f59e0b",  // slightly lighter for dark-mode surfaces
  /** Green — used for fast metrics, "fastest" stats, chart median line. */
  success:      "#1a7f37",
  successDark:  "#3fb950",  // slightly lighter for dark-mode surfaces
  /** Neutral segment in review-wait bar (post-review time). */
  chartBarDone: "#6b7280",
  /** SVG-only chart tokens — not for MUI sx use. */
  chartToday:      "rgba(248,81,73,0.7)",
  chartTodayLabel: "rgba(248,81,73,0.9)",
  chartCursor:     "rgba(87,96,106,0.5)",
  weekendBand:     "rgba(0,0,0,0.04)",
} as const;

// Okabe-Ito palette — distinguishable for deuteranopia, protanopia and tritanopia.
const COLORS_CB = {
  issue:        "#0072B2",
  issueDark:    "#005a8e",
  prMerged:     "#009E73",
  prMergedDark: "#007a58",
  prClosed:     "#E69F00",
  prClosedDark: "#b87e00",
  chartAxis:    "#57606a",
  chartGrid:    "#d0d7de",
  warning:      "#d97706",   // warning is semantic, not categorical — same in both modes
  warningDark:  "#f59e0b",
  success:      "#1a7f37",
  successDark:  "#3fb950",
  /** Sky blue — Okabe-Ito post-review segment in review-wait bar. */
  chartBarDone: "#56B4E9",
  chartToday:      "rgba(248,81,73,0.7)",
  chartTodayLabel: "rgba(248,81,73,0.9)",
  chartCursor:     "rgba(87,96,106,0.5)",
  weekendBand:     "rgba(0,0,0,0.04)",
} as const;

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

/**
 * Binary upper-bound search: returns the number of elements in a sorted array
 * that are ≤ t (i.e., the first index where arr[i] > t).
 */
const upperBound = (arr: number[], t: number): number => {
  let lo = 0, hi = arr.length;
  // arr[mid] is always within bounds: mid = (lo+hi)>>>1, and lo < hi throughout the loop
  while (lo < hi) { const mid = (lo + hi) >>> 1; arr[mid]! <= t ? (lo = mid + 1) : (hi = mid); }
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

/**
 * Shared chart colour factory. Returns a full token set for SVG charts.
 * Each chart destructures only the fields it uses — no local makeCOL/makeC needed.
 */
const makeChartColors = (colorblindMode: boolean) => {
  const p = colorblindMode ? COLORS_CB : COLORS;
  return {
    issue:       p.issue,
    prMerged:    p.prMerged,
    prClosed:    p.prClosed,
    axis:        p.chartAxis,
    grid:        p.chartGrid,
    label:       p.chartAxis,
    cursor:      p.chartCursor,
    median:      p.success,
    mean:        p.warning,
    today:       p.chartToday,
    todayLabel:  p.chartTodayLabel,
    weekendBand: p.weekendBand,
  };
};

/**
 * sx prop for chart empty-state Typography elements.
 * All five SVG charts use exactly this shape — import instead of inlining.
 */
const CHART_EMPTY_STATE_SX = { fontSize: FS.lg, color: "text.secondary", py: 2.5 } as const;

/**
 * Base sx spread for passive chart hover-card Paper elements (pointer-events: none).
 * Usage: <Paper elevation={2} sx={{ ...HOVER_CARD_BASE_SX, ...cardStyle }}>
 * For clickable cards (e.g. CycleTime link cards) define sx inline as they
 * have different pointer-event and decoration requirements.
 */
const HOVER_CARD_BASE_SX = {
  position:      "absolute"  as const,
  display:       "flex",
  flexDirection: "column"    as const,
  gap:           "5px",
  minWidth:      148,
  px:            1.5,
  py:            1,
  pointerEvents: "none"      as const,
  zIndex:        50,
};

/** sx for the small coloured dot indicator inside hover cards. Add `bgcolor` at the call site. */
const DOT_SX = { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 };

/** sx for a stat row (dot + value text) inside hover cards. */
const STAT_ROW_SX = { display: "flex", alignItems: "center", gap: "7px", fontSize: FS.md, fontWeight: 600 };

/** sx for the subdued label/meta text inside hover cards (dates, milestone names, totals). */
const CARD_LABEL_SX = { fontSize: FS.sm, fontWeight: 600, color: "text.secondary" };

/**
 * sx for the drag handle positioned at the right edge of a resizable table
 * header cell. The cell itself must have `position: "relative"` and
 * `overflow: "hidden"`. A 1px hairline appears on hover; turns primary on drag.
 */
const RESIZE_HANDLE_SX = {
  position: "absolute" as const,
  right: 0, top: 0, bottom: 0,
  width: 8,
  cursor: "col-resize",
  zIndex: 1,
  "&::after": {
    content: '""',
    position: "absolute",
    right: "3px", top: "20%", bottom: "20%",
    width: "1px",
    bgcolor: "divider",
    transition: "background-color 0.15s",
  },
  "&:hover::after": { bgcolor: "primary.main" },
} as const;

/**
 * Returns MUI sx objects for status Chips, keyed by lowercase status string.
 * Respects colorblind mode. Background is a semi-transparent tint of the status colour.
 */
const makeStatusChipSx = (colorblindMode: boolean): Record<string, object> => {
  const p = colorblindMode ? COLORS_CB : COLORS;
  return {
    // 0x26 ≈ 15% opacity, 0x1f ≈ 12% opacity — chosen to match the original design intent
    open:   { bgcolor: `${COLORS.warning}26`, color: COLORS.warning },
    closed: { bgcolor: `${p.prClosed}1f`,     color: p.prClosed },
    merged: { bgcolor: `${p.prMerged}1f`,     color: p.prMerged },
  };
};

export {
  CARD_LABEL_SX,
  CHART_EMPTY_STATE_SX,
  COLORS,
  COLORS_CB,
  DOT_SX,
  FS,
  HOVER_CARD_BASE_SX,
  MS,
  RESIZE_HANDLE_SX,
  STAT_ROW_SX,
  assigneesOtherThanAuthor,
  durationDays,
  fmtDate,
  hoverCardPos,
  itemEndDate,
  itemStatus,
  labelTextColor,
  makeChartColors,
  makeStatusChipSx,
  pluralize,
  safeUrl,
  upperBound,
};
