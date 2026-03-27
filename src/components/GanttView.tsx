import type { MilestoneMeta, TimelineItem } from "../types";
import type { FunctionComponent, MouseEvent, RefObject } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, COLORS_CB, FS, MS, MS_HOUR, assigneesOtherThanAuthor, durationDays, fmtDate, fmtDateTime, itemEndDate, pluralize, safeUrl, snapToHour } from "../utils/utils";
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
  snapMode: "day" | "hour";
  onSnapModeChange: (mode: "day" | "hour") => void;
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
  snapMode: "day" | "hour";
  onSnapModeChange: (mode: "day" | "hour") => void;
};

const GanttLegend: FunctionComponent<GanttLegendProps> = ({ hasOpenIssues, isMultiMilestone, milestones, colorblindMode, snapMode, onSnapModeChange }) => {
  const p = colorblindMode ? COLORS_CB : COLORS;
  // 0x73 hex ≈ 0.45 alpha — used for the open-issue dashed bar fill
  const issueClosed = `linear-gradient(135deg, ${p.issue} 0%, ${p.issueDark} 100%)`;
  const issueOpen   = `linear-gradient(135deg, ${p.issue}73 0%, ${p.issueDark}73 100%)`;
  const prMergedBg  = `linear-gradient(135deg, ${p.prMerged} 0%, ${p.prMergedDark} 100%)`;
  const prClosedBg  = `linear-gradient(135deg, ${p.prClosed} 0%, ${p.prClosedDark} 100%)`;
  return (
  <>
    <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap", flex: 1 }}>
        {[
          { bg: issueClosed, label: "Issues (closed)" },
          ...(hasOpenIssues
            ? [{ bg: issueOpen, label: "Issues (open)", dashed: true, borderColor: p.issue }]
            : []),
          { bg: prMergedBg, label: "PRs (merged)" },
          { bg: prClosedBg, label: "PRs (closed)" },
        ].map(({ bg, label, dashed, borderColor }) => (
          <Box key={label} sx={{ display: "flex", alignItems: "center", gap: "7px", fontSize: FS.md }}>
            <Box sx={{ width: 20, height: 14, borderRadius: "3px", flexShrink: 0, background: bg, ...(dashed ? { border: `1.5px dashed ${borderColor ?? COLORS.issue}` } : {}) }} />
            {label}
          </Box>
        ))}
      </Box>
      <ToggleButtonGroup
        value={snapMode}
        exclusive
        size="small"
        onChange={(_, val: "day" | "hour" | null) => { if (val) { onSnapModeChange(val); } }}
        aria-label="Bar snap granularity"
        sx={{ flexShrink: 0 }}
      >
        <ToggleButton value="day"  aria-label="Snap bars to day boundaries">Day</ToggleButton>
        <ToggleButton value="hour" aria-label="Snap bars to hour boundaries">Hour</ToggleButton>
      </ToggleButtonGroup>
    </Box>

    {isMultiMilestone && (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", pt: "6px", pb: "2px", borderTop: 1, borderColor: "divider", mt: "4px" }}>
        {milestones.map((m) => (
          <Box key={m.number} sx={{ display: "flex", alignItems: "center", gap: "6px", fontSize: FS.base, color: "text.secondary" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "2px", flexShrink: 0, bgcolor: m.color }} />
            {m.title}
          </Box>
        ))}
      </Box>
    )}
  </>
  );
};

const BarHoverCard: FunctionComponent<{ barHover: BarHover; snapMode: "day" | "hour" }> = ({ barHover, snapMode }) => {
  const fmt = snapMode === "hour" ? fmtDateTime : fmtDate;
  const { item } = barHover;
  const otherAssignees = assigneesOtherThanAuthor(item.assignees, item.author);
  return (
    <Paper elevation={2} sx={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 200, maxWidth: 280, px: 1.5, py: 1.25, pointerEvents: "none", ...barCardStyle(barHover.clientX, barHover.clientY) }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "6px", fontSize: FS.sm, fontWeight: 600, color: "text.secondary" }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: barHover.dotColor, flexShrink: 0, opacity: barHover.isOpen ? 0.55 : 1 }} />
        {item.type === "pr" ? "PR" : "Issue"} #{item.number}
        {item.type === "issue" && item.reopenedCount > 0 && (
          <Box component="span" title={`Reopened ${pluralize(item.reopenedCount, "time")}`} sx={{ color: COLORS.warning, ml: "2px" }}>
            ↺{item.reopenedCount}
          </Box>
        )}
        <Box component="span" sx={{ ml: "auto", fontWeight: 500 }}>{barHover.statusWord}</Box>
      </Box>
      <Typography sx={{ fontSize: FS.md, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.title}
      </Typography>
      <Box>
        <Typography sx={{ fontSize: FS.tiny, color: "text.disabled", fontWeight: 600, lineHeight: 1, mb: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Author</Typography>
        <AuthorTag login={item.author} prefix="@" />
      </Box>
      {otherAssignees.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: FS.tiny, color: "text.disabled", fontWeight: 600, lineHeight: 1, mb: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Assignees</Typography>
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
        <Box sx={{ fontSize: FS.sm, color: "text.secondary" }}>Closes #{item.linkedIssue}</Box>
      )}
      {item.type === "pr" && (item.reviewDecision || item.additions + item.deletions > 0) && (
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          {item.reviewDecision && (
            <Box component="span" sx={{
              fontSize: FS.sm, fontWeight: 600,
              color: item.reviewDecision === "APPROVED" ? "success.main"
                : item.reviewDecision === "CHANGES_REQUESTED" ? "error.main"
                : "warning.main",
            }}>
              {item.reviewDecision === "APPROVED" ? "✓ Approved"
                : item.reviewDecision === "CHANGES_REQUESTED" ? "Changes requested"
                : "Review required"}
            </Box>
          )}
          {item.additions + item.deletions > 0 && (
            <Box component="span" sx={{ fontSize: FS.sm, color: "text.secondary" }}>
              <Box component="span" sx={{ color: "success.main" }}>+{item.additions}</Box>
              {" / "}
              <Box component="span" sx={{ color: "error.main" }}>-{item.deletions}</Box>
            </Box>
          )}
        </Box>
      )}
      <Box sx={{ fontSize: FS.sm, color: "text.secondary" }}>
        {fmt(item.createdAt)} → {barHover.isOpen ? "ongoing" : fmt(barHover.endDate)}
      </Box>
      <Box sx={{ fontSize: FS.md, fontWeight: 600 }}>{barHover.durationText}</Box>
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
  snapMode,
  onSnapModeChange,
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
    // Start from the UTC midnight before minTime so bands always cover full
    // calendar days, even when minTime is mid-day (hour snap mode).
    const dayFloor = Math.floor(minTime / MS) * MS;
    for (let d = dayFloor; d < minTime + totalMs; d += MS) {
      if (new Date(d).getUTCDay() !== 6) { continue; } // Saturday midnight UTC
      const bandLeft  = Math.max(d, minTime);
      const bandRight = Math.min(d + 2 * MS, minTime + totalMs);
      if (bandRight > bandLeft) {
        bands.push({
          leftPct:  ((bandLeft  - minTime) / totalMs) * 100,
          widthPct: ((bandRight - bandLeft) / totalMs) * 100,
        });
      }
      d += MS; // skip Sunday
    }
    return bands;
  }, [highlightWeekends, minTime, totalMs]);

  const STALE_MS = 7 * MS;

  const todayLeftPct = ((todayMs - minTime) / totalMs) * 100;
  const showToday = todayMs >= minTime && todayMs <= minTime + totalMs;
  const numDateLabels = Math.max(4, Math.min(24, Math.floor(trackWidth / 110)));
  const dateLabels = Array.from({ length: numDateLabels }, (_, i) =>
    fmtDate(new Date(minTime + (totalMs * i) / (numDateLabels - 1)).toISOString()),
  );

  const dueMarkers = useMemo(() =>
    milestones.flatMap((ms) => {
      if (!ms.dueOn) { return []; }
      const dueMs = new Date(ms.dueOn).getTime();
      if (isNaN(dueMs)) { return []; }
      const leftPct = ((dueMs - minTime) / totalMs) * 100;
      if (leftPct < -2 || leftPct > 102) { return []; }
      return [{ key: ms.number, leftPct, label: `Due ${fmtDate(ms.dueOn)}`, color: milestones.length > 1 ? ms.color : "#8250df" }];
    }),
  [milestones, minTime, totalMs]);

  return (
    <>
      <GanttLegend hasOpenIssues={hasOpenIssues} isMultiMilestone={isMultiMilestone} milestones={milestones} colorblindMode={colorblindMode} snapMode={snapMode} onSnapModeChange={onSnapModeChange} />

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
            const isStale = isOpen && (Date.now() - new Date(item.updatedAt).getTime()) > STALE_MS;
            const staleDays = isStale ? Math.floor((Date.now() - new Date(item.updatedAt).getTime()) / MS) : 0;
            const isDraft = item.type === "pr" && item.isDraft;
            return (
              <Box
                key={`lbl-${item.type}-${item.number}`}
                className="tl-label"
                style={{
                  height: ROW_HEIGHT,
                  opacity: isOpen ? 0.75 : 1,
                  boxShadow: isMultiMilestone
                    ? `inset 3px 0 0 ${milestoneColorMap.get(item.milestoneNumber) ?? COLORS.chartAxis}`
                    : undefined,
                }}
              >
                <Box component="span" className={badgeClass}>{item.type.toUpperCase()}</Box>
                {isDraft && (
                  <Box component="span" sx={{ fontSize: FS.tiny, fontWeight: 700, color: "text.secondary", bgcolor: "action.selected", borderRadius: "3px", px: "3px", py: "1px", mr: "2px", flexShrink: 0 }}>DRAFT</Box>
                )}
                <a href={safeUrl(item.url)} target="_blank" rel="noreferrer" aria-label={`${item.type === "pr" ? "PR" : "Issue"} #${item.number}: ${item.title}`} className={`tl-num tl-num--${item.type}`}>
                  #{item.number}
                </a>
                <Box component="span" className="tl-title" title={item.title}>
                  {isStale && (
                    <Box component="span" title={`No activity for ${staleDays} days`} sx={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", bgcolor: COLORS.warning, mr: "4px", verticalAlign: "middle", flexShrink: 0 }} />
                  )}
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
                  aria-valuetext={`${labelWidth}px`}
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
            const snapUnit = snapMode === "hour" ? MS_HOUR : MS;
            const snappedMs = Math.round(rawMs / snapUnit) * snapUnit;
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
          {dueMarkers.map((dm) => (
            <Box
              key={dm.key}
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: `${dm.leftPct}%`,
                width: 2,
                height: `${sortedItems.length * ROW_HEIGHT}px`,
                background: dm.color,
                opacity: 0.65,
                pointerEvents: "none",
                zIndex: 3,
              }}
            >
              <Box
                component="span"
                style={{
                  position: "absolute",
                  top: 2,
                  left: 4,
                  fontSize: FS.tiny,
                  color: dm.color,
                  whiteSpace: "nowrap",
                  fontWeight: 700,
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                {dm.label}
              </Box>
            </Box>
          ))}
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
            const endDate = isOpen ? null : itemEndDate(item);
            const endMs   = isOpen ? todayMs : new Date(endDate!).getTime();

            // Day mode: snap to UTC midnight; hour mode: snap to local hour.
            const startMs = snapMode === "hour"
              ? snapToHour(new Date(item.createdAt).getTime())
              : new Date(new Date(item.createdAt).toISOString().slice(0, 10)).getTime();

            // Closed-bar end: day mode snaps to whole-day duration; hour mode snaps to the close hour.
            const snapEndMs = isOpen ? endMs
              : snapMode === "hour" ? snapToHour(endMs)
              : startMs + (durationDays(item.createdAt, endDate) ?? 0) * MS;

            const leftPct  = ((startMs  - minTime) / totalMs) * 100;
            const widthPct = Math.max(((snapEndMs - startMs) / totalMs) * 100, 0.3);

            // Duration text — hours when in hour mode, days otherwise.
            let durationText: string;
            if (isOpen) {
              durationText = "ongoing";
            } else if (snapMode === "hour" && endDate) {
              const hrs = Math.round((new Date(endDate).getTime() - new Date(item.createdAt).getTime()) / MS_HOUR);
              const d   = Math.floor(hrs / 24);
              const h   = hrs % 24;
              durationText = hrs === 0 ? "< 1h" : d === 0 ? `${hrs}h` : h === 0 ? `${d}d` : `${d}d ${h}h`;
            } else {
              const duration = durationDays(item.createdAt, endDate);
              durationText = duration === null ? "ongoing" : duration === 0 ? "Same day" : duration === 1 ? "1 day" : `${duration} days`;
            }

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
            const fmt = snapMode === "hour" ? fmtDateTime : fmtDate;
            const reopenPrefix = item.type === "issue" && item.reopenedCount > 0 ? "↺ " : "";
            const barLabel =
              barWidthPx < 40
                ? ""
                : isOpen
                  ? `${reopenPrefix}${fmt(item.createdAt)} → today (${durationText})`
                  : durationText === "Same day" || durationText.match(/^[0-9]+h$/)
                    ? `${reopenPrefix}${durationText}`
                    : `${reopenPrefix}${fmt(item.createdAt)} → ${fmt(endDate)} (${durationText})`;

            const statusWord = isOpen ? "Open" : item.type === "pr" ? (item.mergedAt ? "Merged" : "Closed") : "Closed";
            const palette = colorblindMode ? COLORS_CB : COLORS;
            const dotColor = isOpen
              ? item.type === "issue" ? palette.issue : palette.prMerged
              : item.type === "issue" ? palette.issue : isMergedPR ? palette.prMerged : palette.prClosed;

            const reviewBadge = item.type === "pr" && item.reviewDecision && barWidthPx >= 50
              ? item.reviewDecision === "APPROVED"
                ? { label: "✓", color: "#1a7f37" }
                : item.reviewDecision === "CHANGES_REQUESTED"
                  ? { label: "✕", color: "#cf222e" }
                  : { label: "…", color: COLORS.warning }
              : null;

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
                    {reviewBadge && (
                      <Box
                        component="span"
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          right: 4,
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: reviewBadge.color,
                          lineHeight: 1,
                          opacity: 0.9,
                          pointerEvents: "none",
                        }}
                      >
                        {reviewBadge.label}
                      </Box>
                    )}
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
          <Box sx={{ fontSize: FS.sm, fontWeight: 600, color: "text.secondary" }}>
            {snapMode === "hour"
              ? fmtDateTime(new Date(minTime + (cursorInfo.pct / 100) * totalMs).toISOString())
              : fmtDate(new Date(minTime + (cursorInfo.pct / 100) * totalMs).toISOString())}
          </Box>
        </Paper>
      )}

      {barHover && <BarHoverCard barHover={barHover} snapMode={snapMode} />}
    </>
  );
};

export { GanttView };
