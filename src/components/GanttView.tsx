import { useState, useRef } from "react";
import type { FunctionComponent, MouseEvent, RefObject } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { TimelineItem, MilestoneMeta } from "../types";
import { fmtDate, itemEndDate, COLORS } from "../utils/utils";
import { AuthorTag, AuthorCard } from "./AuthorTag";

type Props = {
  sortedItems: TimelineItem[];
  milestones: MilestoneMeta[];
  isMultiMilestone: boolean;
  milestoneColorMap: Map<number, string>;
  hasOpenIssues: boolean;
  labelWidth: number;
  axisHeight: number;
  trackWidth: number;
  minTime: number;
  totalMs: number;
  todayMs: number;
  trackColRef: RefObject<HTMLDivElement>;
  axisRef: RefObject<HTMLDivElement>;
  onResizeStart: (e: MouseEvent<HTMLDivElement>) => void;
};

const ROW_HEIGHT = 31;

type CursorInfo = { pct: number; clientX: number; clientY: number };

type BarHover = {
  clientX: number;
  clientY: number;
  item: TimelineItem;
  endDate: string | null;
  isOpen: boolean;
  durationText: string;
  dotColor: string;
  statusWord: string;
};

function barCardStyle(clientX: number, clientY: number) {
  const cardW = 240;
  const cardH = 170;
  const left = clientX + 14 + cardW > window.innerWidth ? clientX - cardW - 14 : clientX + 14;
  const top = Math.max(8, Math.min(clientY - cardH / 2, window.innerHeight - cardH - 8));
  return { position: "fixed" as const, left, top, zIndex: 200 };
}

function durationDays(start: string, end: string | null): number | null {
  if (!end) return null;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);
}

const GanttView: FunctionComponent<Props> = ({
  sortedItems,
  milestones,
  isMultiMilestone,
  milestoneColorMap,
  hasOpenIssues,
  labelWidth,
  axisHeight,
  trackWidth,
  minTime,
  totalMs,
  todayMs,
  trackColRef,
  axisRef,
  onResizeStart,
}) => {
  const [hoverItem, setHoverItem] = useState<TimelineItem | null>(null);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barHover, setBarHover] = useState<BarHover | null>(null);
  const [cursorInfo, setCursorInfo] = useState<CursorInfo | null>(null);

  const showCard = (item: TimelineItem, e: MouseEvent<HTMLSpanElement>) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setCardPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    setHoverItem(item);
  };

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setHoverItem(null), 150);
  };

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  const todayLeftPct = ((todayMs - minTime) / totalMs) * 100;
  const showToday = todayMs >= minTime && todayMs <= minTime + totalMs;
  const numDateLabels = Math.max(4, Math.min(24, Math.floor(trackWidth / 110)));
  const dateLabels = Array.from({ length: numDateLabels }, (_, i) =>
    fmtDate(new Date(minTime + (totalMs * i) / (numDateLabels - 1)).toISOString()),
  );

  return (
    <>
      <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
        {[
          { bg: "linear-gradient(135deg, #0969da 0%, #0550ae 100%)", label: "Issues (closed)" },
          ...(hasOpenIssues
            ? [{ bg: "linear-gradient(135deg, rgba(9,105,218,0.45) 0%, rgba(5,80,174,0.45) 100%)", label: "Issues (open)", dashed: true }]
            : []),
          { bg: "linear-gradient(135deg, #8250df 0%, #6639ba 100%)", label: "PRs (merged)" },
          { bg: "linear-gradient(135deg, #dc3545 0%, #c82333 100%)", label: "PRs (closed)" },
        ].map(({ bg, label, dashed }) => (
          <Box key={label} sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem" }}>
            <Box sx={{ width: 20, height: 14, borderRadius: "3px", flexShrink: 0, background: bg, ...(dashed ? { border: "1.5px dashed #0969da" } : {}) }} />
            {label}
          </Box>
        ))}
      </Box>

      {isMultiMilestone && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", pt: "6px", pb: "2px", borderTop: 1, borderColor: "divider", mt: "4px" }}>
          {milestones.map((m) => (
            <Box key={m.number} sx={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "text.secondary" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "2px", flexShrink: 0, bgcolor: m.color }} />
              {m.title}
            </Box>
          ))}
        </Box>
      )}

      <Alert icon={false} severity="info" sx={{ fontSize: "0.75rem", py: "6px" }}>
        Click issue/PR numbers to open in GitHub &nbsp;·&nbsp; Drag handle to resize labels &nbsp;·&nbsp; Scroll wheel to zoom
      </Alert>

      <div className="tl-body">
        <div className="tl-label-col" style={{ width: labelWidth }}>
          <div style={{ height: axisHeight, flexShrink: 0 }} />
          {sortedItems.map((item) => {
            const isOpen = item.type === "issue" ? !item.closedAt : !(item.mergedAt || item.closedAt);
            const isClosedPR = item.type === "pr" && !item.mergedAt && !!item.closedAt;
            const badgeClass =
              item.type === "issue"
                ? "tl-badge tl-badge--issue"
                : isClosedPR
                  ? "tl-badge tl-badge--pr-closed"
                  : "tl-badge tl-badge--pr";
            return (
              <div
                key={`lbl-${item.type}-${item.number}`}
                className="tl-label"
                style={{
                  height: ROW_HEIGHT,
                  opacity: isOpen ? 0.75 : 1,
                  boxShadow: isMultiMilestone
                    ? `inset 3px 0 0 ${milestoneColorMap.get(item.milestoneNumber) ?? "#57606a"}`
                    : undefined,
                }}
              >
                <span className={badgeClass}>{item.type.toUpperCase()}</span>
                <a href={item.url} target="_blank" rel="noreferrer" className={`tl-num tl-num--${item.type}`}>
                  #{item.number}
                </a>
                <span className="tl-title" title={item.title}>
                  {item.title}
                </span>
                <AuthorTag
                  login={item.author}
                  showName={false}
                  onMouseEnter={(e) => showCard(item, e)}
                  onMouseLeave={scheduleHide}
                />
                <div className="tl-resize-handle" onMouseDown={onResizeStart} />
              </div>
            );
          })}
        </div>

        <div
          className="tl-track-col"
          ref={trackColRef}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
            setCursorInfo({
              pct: Math.max(0, Math.min(100, (x / trackWidth) * 100)),
              clientX: e.clientX,
              clientY: e.clientY,
            });
          }}
          onMouseLeave={() => setCursorInfo(null)}
        >
          <div className="tl-date-axis" ref={axisRef} style={{ width: trackWidth }}>
            {dateLabels.map((label, i) => (
              <span key={i} className="tl-date-label">
                {label}
              </span>
            ))}
          </div>
          {sortedItems.map((item) => {
            const isOpen = item.type === "issue" ? !item.closedAt : !(item.mergedAt || item.closedAt);
            // Snap to UTC midnight so items created on the same calendar day
            // share the same left edge regardless of their exact creation time.
            const startMs = new Date(new Date(item.createdAt).toISOString().slice(0, 10)).getTime();
            const endDate = isOpen ? null : itemEndDate(item);
            const endMs = isOpen ? todayMs : new Date(endDate!).getTime();

            const duration = durationDays(item.createdAt, isOpen ? null : (endDate ?? null));

            const leftPct = ((startMs - minTime) / totalMs) * 100;
            // Snap closed bar width to the rounded duration so same-label bars are
            // always the same width (raw timestamps vary within a rounding bucket).
            const snapEndMs = isOpen ? endMs : startMs + (duration ?? 0) * 86_400_000;
            const widthPct = Math.max(((snapEndMs - startMs) / totalMs) * 100, 0.3);
            const durationText =
              duration === null ? "ongoing" : duration === 0 ? "Same day" : duration === 1 ? "1 day" : `${duration} days`;

            const isMergedPR = item.type === "pr" && !!item.mergedAt;
            const barClass = [
              "tl-bar",
              isOpen
                ? item.type === "issue"
                  ? "tl-bar--issue-open"
                  : "tl-bar--pr-open"
                : item.type === "issue"
                  ? "tl-bar--issue"
                  : isMergedPR
                    ? "tl-bar--pr-merged"
                    : "tl-bar--pr-closed",
            ].join(" ");

            const barWidthPx = (widthPct / 100) * trackWidth;
            const barLabel =
              barWidthPx < 40
                ? ""
                : isOpen
                  ? `${fmtDate(item.createdAt)} → today (${durationText})`
                  : duration !== null && duration <= 2
                    ? durationText
                    : `${fmtDate(item.createdAt)} → ${fmtDate(endDate)} (${durationText})`;

            const statusWord = isOpen ? "Open" : item.type === "pr" ? (item.mergedAt ? "Merged" : "Closed") : "Closed";
            const dotColor = isOpen
              ? item.type === "issue" ? COLORS.issue : COLORS.prMerged
              : item.type === "issue" ? COLORS.issue : isMergedPR ? COLORS.prMerged : COLORS.prClosed;

            return (
              <div key={`trk-${item.type}-${item.number}`} className="tl-track-row" style={{ height: ROW_HEIGHT }}>
                <div className="tl-track" style={{ width: trackWidth }}>
                  {showToday && <div className="tl-today-marker" style={{ left: `${todayLeftPct}%` }} />}
                  {cursorInfo !== null && <div className="tl-cursor-line" style={{ left: `${cursorInfo.pct}%` }} />}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={barClass}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onMouseEnter={(e) => setBarHover({ clientX: e.clientX, clientY: e.clientY, item, endDate, isOpen, durationText, dotColor, statusWord })}
                    onMouseLeave={() => setBarHover(null)}
                  >
                    {barLabel}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hoverItem && (
        <AuthorCard
          login={hoverItem.author}
          style={{ top: cardPos.top, left: cardPos.left }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}

      {cursorInfo !== null && barHover === null && (
        <Box
          sx={{
            position: "fixed",
            top: cursorInfo.clientY - 30,
            left: cursorInfo.clientX + 10,
            bgcolor: "text.secondary",
            color: "background.paper",
            px: 0.75,
            py: 0.25,
            borderRadius: "4px",
            fontSize: "0.6875rem",
            fontWeight: 700,
            pointerEvents: "none",
            zIndex: 150,
            userSelect: "none",
          }}
        >
          {fmtDate(new Date(minTime + (cursorInfo.pct / 100) * totalMs).toISOString())}
        </Box>
      )}

      {barHover && (
        <Paper elevation={3} sx={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 200, maxWidth: 260, px: 1.5, py: 1.25, pointerEvents: "none", ...barCardStyle(barHover.clientX, barHover.clientY) }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: barHover.dotColor, flexShrink: 0, opacity: barHover.isOpen ? 0.55 : 1 }} />
            {barHover.item.type === "pr" ? "PR" : "Issue"} #{barHover.item.number}
            <Box component="span" sx={{ ml: "auto", fontWeight: 500 }}>{barHover.statusWord}</Box>
          </Box>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {barHover.item.title}
          </Typography>
          <AuthorTag login={barHover.item.author} prefix="@" />
          {barHover.item.type === "pr" && barHover.item.linkedIssue > 0 && (
            <Box sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>Closes #{barHover.item.linkedIssue}</Box>
          )}
          <Box sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
            {fmtDate(barHover.item.createdAt)} → {barHover.isOpen ? "ongoing" : fmtDate(barHover.endDate)}
          </Box>
          <Box sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{barHover.durationText}</Box>
        </Paper>
      )}
    </>
  );
};

export { GanttView };
