import type { SxProps } from "@mui/material/styles";
import { FS } from "./displayUtils";

/**
 * Shared MUI sx design tokens — reusable style objects for charts and cards.
 * Import these instead of inlining duplicate sx shapes across components.
 */

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
 * Sortable table header cell — used by ItemList and ReviewWaitList <Th> components.
 */
export const TABLE_HEADER_CELL_SX = {
  fontWeight: 600,
  fontSize: FS.sm,
  py: 1,
  whiteSpace: "nowrap",
  position: "relative",
  overflow: "hidden",
  userSelect: "none",
} as const satisfies SxProps;

/**
 * Compact uppercase label with letter-spacing — used in table column headers and section labels.
 */
export const TABLE_HEADER_LABEL_SX = {
  fontWeight: 700,
  color: "text.secondary",
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  border: 0,
} as const satisfies SxProps;

/**
 * Single tabular-nums token — use on any numeric column to prevent layout jitter.
 */
export const TABULAR_NUMS_SX = {
  fontVariantNumeric: "tabular-nums",
} as const satisfies SxProps;


export { CARD_LABEL_SX, CHART_EMPTY_STATE_SX, DOT_SX, HOVER_CARD_BASE_SX, RESIZE_HANDLE_SX, STAT_ROW_SX };
