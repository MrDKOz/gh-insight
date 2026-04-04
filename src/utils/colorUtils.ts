/**
 * Canonical colour palette and palette-aware helpers.
 * All colour references in the app should route through these constants
 * so dark mode and colorblind mode are respected automatically.
 */

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
  /** Hover column highlight band behind the cursor line. */
  chartCursorBand: "rgba(87,96,106,0.12)",
  weekendBand:     "rgba(0,0,0,0.04)",
  /** Bank holiday band — red tint (SVG fill / Gantt band background, light mode). */
  bankHoliday:     "rgba(234,67,53,0.12)",
  /** Neutral fill for the "open" area in CumulativeFlow — same in both colour modes. */
  chartOpenFill:   "rgba(209,213,218,0.35)",
  /** Open-state tints — match the Gantt tl-bar--issue-open / tl-bar--pr-open CSS colours. */
  issueOpen: "rgba(9,105,218,0.50)",
  prOpen:    "rgba(130,80,223,0.50)",
  /** Cycle time percentile reference lines. */
  p75: "#0891b2",
  p90: "#be185d",
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
  /** Vermillion — Okabe-Ito safe alternative to red for the "today" marker. */
  chartToday:      "rgba(213,94,0,0.7)",
  chartTodayLabel: "rgba(213,94,0,0.9)",
  chartCursor:     "rgba(87,96,106,0.5)",
  chartCursorBand: "rgba(87,96,106,0.12)",
  weekendBand:     "rgba(0,0,0,0.04)",
  /** Bank holiday band — Okabe-Ito amber (distinguishable for red-green colorblindness). */
  bankHoliday:     "rgba(230,159,0,0.18)",
  /** Neutral fill for the "open" area in CumulativeFlow — same in both colour modes. */
  chartOpenFill:   "rgba(209,213,218,0.35)",
  /** Open-state tints — Okabe-Ito hues, match the Gantt colorblind CSS variants. */
  issueOpen: "rgba(0,114,178,0.50)",
  prOpen:    "rgba(0,158,115,0.50)",
  /** Cycle time percentile reference lines — Okabe-Ito safe alternatives. */
  p75: "#56B4E9",
  p90: "#CC79A7",
} as const;

/**
 * Shared chart colour factory. Returns a full token set for SVG charts.
 * Each chart destructures only the fields it uses — no local makeCOL/makeC needed.
 */
const makeChartColors = (colorblindMode: boolean) => {
  const palette = colorblindMode ? COLORS_CB : COLORS;
  return {
    issue:       palette.issue,
    prMerged:    palette.prMerged,
    prClosed:    palette.prClosed,
    axis:        palette.chartAxis,
    grid:        palette.chartGrid,
    label:       palette.chartAxis,
    cursor:      palette.chartCursor,
    cursorBand:  palette.chartCursorBand,
    openFill:    palette.chartOpenFill,
    median:      palette.success,
    mean:        palette.warning,
    today:       palette.chartToday,
    todayLabel:  palette.chartTodayLabel,
    weekendBand: palette.weekendBand,
    bankHoliday: palette.bankHoliday,
    issueOpen:   palette.issueOpen,
    prOpen:      palette.prOpen,
    p75:         palette.p75,
    p90:         palette.p90,
  };
};

/**
 * Returns MUI sx objects for status Chips, keyed by lowercase status string.
 * Respects colorblind mode. Background is a semi-transparent tint of the status colour.
 */
const makeStatusChipSx = (colorblindMode: boolean): Record<string, object> => {
  const palette = colorblindMode ? COLORS_CB : COLORS;
  return {
    // 0x26 ≈ 15% opacity, 0x1f ≈ 12% opacity — chosen to match the original design intent
    open:   { bgcolor: `${palette.warning}26`, color: palette.warning },
    closed: { bgcolor: `${palette.prClosed}1f`,     color: palette.prClosed },
    merged: { bgcolor: `${palette.prMerged}1f`,     color: palette.prMerged },
  };
};

/**
 * Returns "#000000" or "#ffffff" depending on which provides better contrast
 * against the given hex background color.
 */
const labelTextColor = (hex: string): "#000000" | "#ffffff" => {
  const redValue = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance per WCAG 2.1
  const toLinear = (c: number) => {
    const normalizedChannel = c / 255;
    return normalizedChannel <= 0.03928 ? normalizedChannel / 12.92 : Math.pow((normalizedChannel + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLinear(redValue) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#000000" : "#ffffff";
};

/**
 * Ordered palettes for milestone and epic colour assignment.
 * Blues/greens (cool) for milestones; purples/pinks (warm) for epics.
 * _CB variants use Okabe-Ito distinguishable hues.
 */
const MILESTONE_COLORS    = ["#0969da", "#1a7f37", "#0891b2", "#0d9488", "#059669", "#0550ae"];
const MILESTONE_COLORS_CB = ["#0072B2", "#009E73", "#56B4E9", "#005a8e", "#007a58", "#44a0c8"];
const EPIC_COLORS    = ["#8250df", "#db2777", "#c026d3", "#9333ea", "#be185d", "#7c3aed"];
const EPIC_COLORS_CB = ["#E69F00", "#D55E00", "#CC79A7", "#b87e00", "#a44b00", "#a85b88"];

export { COLORS, COLORS_CB, EPIC_COLORS, EPIC_COLORS_CB, MILESTONE_COLORS, MILESTONE_COLORS_CB, labelTextColor, makeChartColors, makeStatusChipSx };
