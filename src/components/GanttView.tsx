import type { MilestoneMeta, TimelineItem } from "../types";
import type { FunctionComponent, MouseEvent, RefObject } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, COLORS_CB, MS, assigneesOtherThanAuthor, durationDays, fmtDate, itemEndDate, pluralize, safeUrl } from "../utils/utils";
import { AuthorCard, AuthorTag } from "./AuthorTag";
import { LabelBadge } from "./LabelBadge";

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
  trackColRef: RefObject<HTMLDivElement | null>;
  axisRef: RefObject<HTMLDivElement | null>;
  onResizeStart: (e: MouseEvent<HTMLDivElement>) => void;
  onResizeKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  highlightWeekends: boolean;
  colorblindMode: boolean;
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

const barCardStyle = (clientX: number, clientY: number) => {
  const cardW = 240;
  const cardH = 170;
  const left = clientX + 14 + cardW > window.innerWidth ? clientX - cardW - 14 : clientX + 14;
  const top = Math.max(8, Math.min(clientY - cardH / 2, window.innerHeight - cardH - 8));
  return { position: "fixed" as const, left, top, zIndex: 200 };
};

type GanttLegendProps = {
  hasOpenIssues: boolean;
  isMultiMilestone: boolean;
  milestones: MilestoneMeta[];
  colorblindMode: boolean;
};

const GanttLegend: FunctionComponent<GanttLegendProps> = ({ hasOpenIssues, isMultiMilestone, milestones, colorblindMode }) => {
  const issueClosed  = colorblindMode ? "linear-gradient(135deg, #0072B2 0%, #005a8e 100%)" : "linear-gradient(135deg, #0969da 0%, #0550ae 100%)";
  const issueOpen    = colorblindMode ? "linear-gradient(135deg, rgba(0,114,178,0.45) 0%, rgba(0,90,142,0.45) 100%)" : "linear-gradient(135deg, rgba(9,105,218,0.45) 0%, rgba(5,80,174,0.45) 100%)";
  const prMergedBg   = colorblindMode ? "linear-gradient(135deg, #009E73 0%, #007a58 100%)" : "linear-gradient(135deg, #8250df 0%, #6639ba 100%)";
  const prClosedBg   = colorblindMode ? "linear-gradient(135deg, #E69F00 0%, #b87e00 100%)" : "linear-gradient(135deg, #dc3545 0%, #c82333 100%)";
  return (
  <>
    <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
      {[
        { bg: issueClosed, label: "Issues (closed)" },
        ...(hasOpenIssues
          ? [{ bg: issueOpen, label: "Issues (open)", dashed: true, borderColor: colorblindMode ? "#0072B2" : "#0969da" }]
          : []),
        { bg: prMergedBg, label: "PRs (merged)" },
        { bg: prClosedBg, label: "PRs (closed)" },
      ].map(({ bg, label, dashed, borderColor }) => (
        <Box key={label} sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8125rem" }}>
          <Box sx={{ width: 20, height: 14, borderRadius: "3px", flexShrink: 0, background: bg, ...(dashed ? { border: `1.5px dashed ${borderColor ?? "#0969da"}` } : {}) }} />
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
  </>
  );
};

const BarHoverCard: FunctionComponent<{ barHover: BarHover }> = ({ barHover }) => {
  const { item } = barHover;
  const otherAssignees = assigneesOtherThanAuthor(item.assignees, item.author);
  return (
    <Paper elevation={2} sx={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 200, maxWidth: 280, px: 1.5, py: 1.25, pointerEvents: "none", ...barCardStyle(barHover.clientX, barHover.clientY) }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: barHover.dotColor, flexShrink: 0, opacity: barHover.isOpen ? 0.55 : 1 }} />
        {item.type === "pr" ? "PR" : "Issue"} #{item.number}
        {item.type === "issue" && item.reopenedCount > 0 && (
          <Box component="span" title={`Reopened ${pluralize(item.reopenedCount, "time")}`} sx={{ color: "#d97706", ml: "2px" }}>
            ↺{item.reopenedCount}
          </Box>
        )}
        <Box component="span" sx={{ ml: "auto", fontWeight: 500 }}>{barHover.statusWord}</Box>
      </Box>
      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.title}
      </Typography>
      <Box>
        <Typography sx={{ fontSize: "0.5625rem", color: "text.disabled", fontWeight: 600, lineHeight: 1, mb: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Author</Typography>
        <AuthorTag login={item.author} prefix="@" />
      </Box>
      {otherAssignees.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: "0.5625rem", color: "text.disabled", fontWeight: 600, lineHeight: 1, mb: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Assignees</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {otherAssignees.map((a) => (
              <AuthorTag key={a} login={a} prefix="@" />
            ))}
          </Box>
        </Box>
      )}
      {item.labels.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
          {item.labels.map((l) => (
            <LabelBadge key={l.name} name={l.name} color={l.color} />
          ))}
        </Box>
      )}
      {item.type === "pr" && item.linkedIssue != null && (
        <Box sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>Closes #{item.linkedIssue}</Box>
      )}
      <Box sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
        {fmtDate(item.createdAt)} → {barHover.isOpen ? "ongoing" : fmtDate(barHover.endDate)}
      </Box>
      <Box sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{barHover.durationText}</Box>
    </Paper>
  );
};

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
  onResizeKeyDown,
  highlightWeekends,
  colorblindMode,
}) => {
  const [hoverItem, setHoverItem] = useState<TimelineItem | null>(null);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barHover, setBarHover] = useState<BarHover | null>(null);
  const [cursorInfo, setCursorInfo] = useState<CursorInfo | null>(null);

  useEffect(() => () => {
    if (hideTimer.current) {clearTimeout(hideTimer.current);}
  }, []);

  const showCard = (item: TimelineItem, e: MouseEvent<HTMLSpanElement>) => {
    if (hideTimer.current) {clearTimeout(hideTimer.current);}
    const rect = e.currentTarget.getBoundingClientRect();
    setCardPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    setHoverItem(item);
  };

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => setHoverItem(null), 150);
  };

  const cancelHide = () => {
    if (hideTimer.current) {clearTimeout(hideTimer.current);}
  };

  const weekendBands = useMemo(() => {
    if (!highlightWeekends) {return [];}
    const bands: { leftPct: number; widthPct: number }[] = [];
    for (let d = minTime; d < minTime + totalMs; d += MS) {
      if (new Date(d).getUTCDay() === 6) { // Saturday
        const leftPct = ((d - minTime) / totalMs) * 100;
        const widthPct = (MS * 2) / totalMs * 100;
        bands.push({ leftPct, widthPct });
        d += MS; // skip Sunday
      }
    }
    return bands;
  }, [highlightWeekends, minTime, totalMs]);

  const todayLeftPct = ((todayMs - minTime) / totalMs) * 100;
  const showToday = todayMs >= minTime && todayMs <= minTime + totalMs;
  const numDateLabels = Math.max(4, Math.min(24, Math.floor(trackWidth / 110)));
  const dateLabels = Array.from({ length: numDateLabels }, (_, i) =>
    fmtDate(new Date(minTime + (totalMs * i) / (numDateLabels - 1)).toISOString()),
  );

  return (
    <>
      <GanttLegend hasOpenIssues={hasOpenIssues} isMultiMilestone={isMultiMilestone} milestones={milestones} colorblindMode={colorblindMode} />

      <Box className="tl-body">
        <Box className="tl-label-col" style={{ width: labelWidth }}>
          <Box style={{ height: axisHeight, flexShrink: 0 }} />
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
              <Box
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
                <Box component="span" className={badgeClass}>{item.type.toUpperCase()}</Box>
                <a href={safeUrl(item.url)} target="_blank" rel="noreferrer" aria-label={`${item.type === "pr" ? "PR" : "Issue"} #${item.number}: ${item.title}`} className={`tl-num tl-num--${item.type}`}>
                  #{item.number}
                </a>
                <Box component="span" className="tl-title" title={item.title}>
                  {item.title}
                </Box>
                <AuthorTag
                  login={item.author}
                  showName={false}
                  onMouseEnter={(e) => showCard(item, e)}
                  onMouseLeave={scheduleHide}
                />
                <Box
                  className="tl-resize-handle"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize label column"
                  aria-valuenow={labelWidth}
                  aria-valuemin={200}
                  aria-valuemax={800}
                  tabIndex={0}
                  onMouseDown={onResizeStart}
                  onKeyDown={onResizeKeyDown}
                />
              </Box>
            );
          })}
        </Box>

        <Box
          className="tl-track-col"
          ref={trackColRef}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
            const rawMs = minTime + (x / trackWidth) * totalMs;
            const snappedMs = Math.round(rawMs / MS) * MS;
            const pct = Math.max(0, Math.min(100, ((snappedMs - minTime) / totalMs) * 100));
            setCursorInfo({ pct, clientX: e.clientX, clientY: e.clientY });
          }}
          onMouseLeave={() => setCursorInfo(null)}
        >
          <Box className="tl-date-axis" ref={axisRef} style={{ width: trackWidth }}>
            {dateLabels.map((label, i) => (
              <Box component="span" key={i} className="tl-date-label">
                {label}
              </Box>
            ))}
          </Box>
          <Box style={{ position: "relative", width: trackWidth }}>
          {weekendBands.length > 0 && (
            <Box
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${sortedItems.length * ROW_HEIGHT}px`,
                pointerEvents: "none",
              }}
            >
              {weekendBands.map((b) => (
                <Box key={b.leftPct} className="tl-weekend-band" style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }} />
              ))}
            </Box>
          )}
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
            const snapEndMs = isOpen ? endMs : startMs + (duration ?? 0) * MS;
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
            const reopenPrefix = item.type === "issue" && item.reopenedCount > 0 ? "↺ " : "";
            const barLabel =
              barWidthPx < 40
                ? ""
                : isOpen
                  ? `${reopenPrefix}${fmtDate(item.createdAt)} → today (${durationText})`
                  : duration !== null && duration <= 2
                    ? `${reopenPrefix}${durationText}`
                    : `${reopenPrefix}${fmtDate(item.createdAt)} → ${fmtDate(endDate)} (${durationText})`;

            const statusWord = isOpen ? "Open" : item.type === "pr" ? (item.mergedAt ? "Merged" : "Closed") : "Closed";
            const palette = colorblindMode ? COLORS_CB : COLORS;
            const dotColor = isOpen
              ? item.type === "issue" ? palette.issue : palette.prMerged
              : item.type === "issue" ? palette.issue : isMergedPR ? palette.prMerged : palette.prClosed;

            return (
              <Box key={`trk-${item.type}-${item.number}`} className="tl-track-row" style={{ height: ROW_HEIGHT }}>
                <Box className="tl-track" style={{ width: trackWidth }}>
                  {showToday && <Box className="tl-today-marker" style={{ left: `${todayLeftPct}%` }} />}
                  {cursorInfo !== null && <Box className="tl-cursor-line" style={{ left: `${cursorInfo.pct}%` }} />}
                  <a
                    href={safeUrl(item.url)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${item.type === "pr" ? "PR" : "Issue"} #${item.number}: ${item.title} — ${statusWord}, ${durationText}`}
                    className={barClass}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    onMouseEnter={(e) => setBarHover({ clientX: e.clientX, clientY: e.clientY, item, endDate, isOpen, durationText, dotColor, statusWord })}
                    onMouseLeave={() => setBarHover(null)}
                  >
                    {barLabel}
                  </a>
                </Box>
              </Box>
            );
          })}
          </Box>
        </Box>
      </Box>

      {hoverItem && (
        <AuthorCard
          login={hoverItem.author}
          style={{ top: cardPos.top, left: cardPos.left }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}

      {cursorInfo !== null && barHover === null && (
        <Paper elevation={2} sx={{ position: "fixed", top: cursorInfo.clientY - 34, left: cursorInfo.clientX, transform: "translateX(-50%)", px: 1, py: 0.5, pointerEvents: "none", zIndex: 150, userSelect: "none", whiteSpace: "nowrap" }}>
          <Box sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary" }}>
            {fmtDate(new Date(minTime + (cursorInfo.pct / 100) * totalMs).toISOString())}
          </Box>
        </Paper>
      )}

      {barHover && <BarHoverCard barHover={barHover} />}
    </>
  );
};

export { GanttView };
