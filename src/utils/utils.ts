import type { TimelineItem } from "../types";

const MS = 86_400_000;

function fmtDate(iso: string | null | undefined, includeYear = false): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

function itemEndDate(item: TimelineItem): string | null {
  return item.type === "issue" ? item.closedAt : (item.mergedAt ?? item.closedAt);
}

const COLORS = {
  issue: "#0969da",
  prMerged: "#8250df",
  prClosed: "#dc3545",
  chartAxis: "#57606a",
  chartGrid: "#d0d7de",
} as const;

function hoverCardPos(
  x: number,
  y: number,
  wrapWidth: number,
  cardW: number,
  cardH: number,
): { top: number; left?: number; right?: number } {
  return {
    top: y < cardH + 14 ? y + 14 : y - cardH,
    ...(x > wrapWidth - cardW ? { right: wrapWidth - x + 14 } : { left: x + 14 }),
  };
}

export { MS, fmtDate, itemEndDate, COLORS, hoverCardPos };
