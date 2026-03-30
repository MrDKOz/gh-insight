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
  weekendBand:     "rgba(0,0,0,0.04)",
  /** Bank holiday band — red tint (SVG fill / Gantt band background, light mode). */
  bankHoliday:     "rgba(234,67,53,0.12)",
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
  /** Bank holiday band — Okabe-Ito amber (distinguishable for red-green colorblindness). */
  bankHoliday:     "rgba(230,159,0,0.18)",
} as const;

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
    bankHoliday: p.bankHoliday,
  };
};

/**
 * Returns MUI sx objects for status Chips, keyed by lowercase status string.
 * Respects colorblind mode. Background is a semi-transparent tint of the status colour.
 */
const makeStatusChipSx = (colorblindMode: boolean): Record<string, object> => {
  const p = colorblindMode ? COLORS_CB : COLORS;
  return {
    // 0x26 ≈ 15% opacity, 0x1f ≈ 12% opacity — chosen to match the original design intent
    open:   { bgcolor: `${p.warning}26`, color: p.warning },
    closed: { bgcolor: `${p.prClosed}1f`,     color: p.prClosed },
    merged: { bgcolor: `${p.prMerged}1f`,     color: p.prMerged },
  };
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

export { COLORS, COLORS_CB, labelTextColor, makeChartColors, makeStatusChipSx };
