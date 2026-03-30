import type { BankHoliday } from "../api/bankHolidayApi";
import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { GanttHandle } from "../types/AppTypes";
import type { FunctionComponent, MouseEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useGanttLayout } from "../hooks/useGanttLayout";
import { COLORS, COLORS_CB, FS, MS, MS_HOUR, STALE_MS, durationDays, fmtDate, fmtDateTime, itemEndDate, pluralize, safeUrl, snapToHour } from "../utils/utils";
import { AuthorCard, AuthorTag } from "./AuthorTag";
import { LabelBadge } from "./LabelBadge";

type Props = {
  items: TimelineItem[];
  filteredItems: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  bankHolidays: BankHoliday[];
  colorblindMode: boolean;
};

const ROW_HEIGHT = 31;
const DAY_NAMES  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CursorInfo = { snappedMs: number; clientX: number; clientY: number };

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
  const cardW = 300; // slightly over maxWidth:280 so flip triggers before clipping
  const cardH = 380; // generous upper bound — author + assignees + labels + review + dates
  const rawLeft = clientX + 14 + cardW > window.innerWidth ? clientX - cardW - 14 : clientX + 14;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - cardW - 8));
  const top  = Math.max(8, Math.min(clientY - cardH / 2, window.innerHeight - cardH - 8));
  return { position: "fixed" as const, left, top, zIndex: 200 };
};

type GanttLegendProps = {
  hasOpenIssues: boolean;
  colorblindMode: boolean;
  snapMode: "day" | "hour";
  onSnapModeChange: (mode: "day" | "hour") => void;
  onFitToScreen: () => void;
};

const GanttLegend: FunctionComponent<GanttLegendProps> = ({ hasOpenIssues, colorblindMode, snapMode, onSnapModeChange, onFitToScreen }) => {
  const p = colorblindMode ? COLORS_CB : COLORS;
  // 0x73 hex ≈ 0.45 alpha — used for the open-issue dashed bar fill
  const issueClosed = `linear-gradient(135deg, ${p.issue} 0%, ${p.issueDark} 100%)`;
  const issueOpen   = `linear-gradient(135deg, ${p.issue}73 0%, ${p.issueDark}73 100%)`;
  const prMergedBg  = `linear-gradient(135deg, ${p.prMerged} 0%, ${p.prMergedDark} 100%)`;
  const prClosedBg  = `linear-gradient(135deg, ${p.prClosed} 0%, ${p.prClosedDark} 100%)`;
  return (
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <Button size="small" variant="outlined" onClick={onFitToScreen} aria-label="Fit timeline to screen width">
          Fit to screen
        </Button>
        <ToggleButtonGroup
          value={snapMode}
          exclusive
          size="small"
          onChange={(_, val: "day" | "hour" | null) => { if (val) { onSnapModeChange(val); } }}
          aria-label="Bar snap granularity"
        >
          <ToggleButton value="day"  aria-label="Snap bars to day boundaries">Day</ToggleButton>
          <ToggleButton value="hour" aria-label="Snap bars to hour boundaries">Hour</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
};

const BarHoverCard: FunctionComponent<{ barHover: BarHover; snapMode: "day" | "hour" }> = ({ barHover, snapMode }) => {
  const fmt = snapMode === "hour" ? fmtDateTime : fmtDate;
  const { item } = barHover;
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
      {item.assignees.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: FS.tiny, color: "text.disabled", fontWeight: 600, lineHeight: 1, mb: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Assignees</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {item.assignees.map((a) => (
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

const GanttView = forwardRef<GanttHandle, Props>(({
  items,
  filteredItems,
  milestones,
  highlightWeekends,
  bankHolidays,
  colorblindMode,
}, ref) => {
  const {
    labelWidth, axisHeight, trackWidth, minTime, totalMs, todayMs, snapMode,
    trackColRef, axisRef, sortedItems,
    handleFitToScreen: onFitToScreen,
    handleResizeStart: onResizeStart,
    handleResizeKeyDown: onResizeKeyDown,
    handleSnapModeChange: onSnapModeChange,
  } = useGanttLayout(items, filteredItems);

  const isMultiMilestone = milestones.length > 1;
  const milestoneColorMap = useMemo(() => new Map(milestones.map((m) => [m.number, m.color])), [milestones]);
  const hasOpenIssues = useMemo(() => items.some((i) => i.type === "issue" && !i.closedAt), [items]);

  useImperativeHandle(ref, () => ({ trackColEl: trackColRef.current }), [trackColRef]);
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
    const cardW = 160;
    const left = rect.right + 8 + cardW > window.innerWidth
      ? Math.max(8, rect.left - cardW - 8)
      : rect.right + 8;
    setCardPos({ top: rect.top + rect.height / 2, left });
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

  const bankHolidayMap = useMemo(
    () => new Map(bankHolidays.map((h) => [h.date, h.name])),
    [bankHolidays],
  );

  const bankHolidayBands = useMemo(() => {
    if (bankHolidays.length === 0) {return [];}
    return bankHolidays.flatMap(({ date }) => {
      const t = new Date(date).getTime();
      if (t < minTime || t >= minTime + totalMs) {return [];}
      const leftPct  = ((t - minTime) / totalMs) * 100;
      const widthPct = (MS / totalMs) * 100;
      return [{ leftPct, widthPct }];
    });
  }, [bankHolidays, minTime, totalMs]);



  const todayLeftPct = ((todayMs - minTime) / totalMs) * 100;
  const showToday = todayMs >= minTime && todayMs <= minTime + totalMs;

  // Calendar-aware date labels: snap to day / week / month / quarter / year boundaries
  // so labels always fall on meaningful calendar dates at every zoom level.
  const dateLabels = useMemo(() => {
    if (trackWidth === 0 || totalMs === 0) { return []; }
    const maxTime = minTime + totalMs;
    const dayWidthPx = (MS / totalMs) * trackWidth;
    // Include year in label text when the range spans more than one year
    const withYear = totalMs > 365 * MS;
    const labels: { label: string; centerPct: number }[] = [];

    // Center label text in the middle of its representative day (noon = t + MS/2)
    const add = (t: number, label: string) => {
      const centerPct = ((t + MS / 2 - minTime) / totalMs) * 100;
      if (centerPct > -10 && centerPct < 110) {
        labels.push({ label, centerPct });
      }
    };

    const dayLabel = (t: number) => fmtDate(new Date(t).toISOString(), withYear);

    if (dayWidthPx >= 90) {
      // Every day
      for (let t = Math.ceil(minTime / MS) * MS; t < maxTime; t += MS) {
        add(t, dayLabel(t));
      }
    } else if (dayWidthPx >= 13) {
      // Every Monday (7 days × 13 px ≈ 91 px between labels)
      const firstMidnight = Math.ceil(minTime / MS) * MS;
      const dow = new Date(firstMidnight).getUTCDay(); // 0=Sun
      const daysToMon = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
      for (let t = firstMidnight + daysToMon * MS; t < maxTime; t += 7 * MS) {
        add(t, dayLabel(t));
      }
    } else if (dayWidthPx >= 7) {
      // Every other Monday (14 days × 7 px ≈ 98 px)
      const firstMidnight = Math.ceil(minTime / MS) * MS;
      const dow = new Date(firstMidnight).getUTCDay();
      const daysToMon = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
      for (let t = firstMidnight + daysToMon * MS; t < maxTime; t += 14 * MS) {
        add(t, dayLabel(t));
      }
    } else if (dayWidthPx >= 3) {
      // 1st of each month (≈30 days × 3 px ≈ 90 px)
      const d = new Date(minTime);
      let y = d.getUTCFullYear(), m = d.getUTCMonth();
      while (true) {
        const t = Date.UTC(y, m, 1);
        if (t >= maxTime) { break; }
        add(t, new Date(t).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }));
        if (++m > 11) { m = 0; y++; }
      }
    } else if (dayWidthPx >= 1) {
      // 1st of each quarter (≈91 days × 1 px ≈ 91 px)
      const d = new Date(minTime);
      let y = d.getUTCFullYear(), m = Math.floor(d.getUTCMonth() / 3) * 3;
      while (true) {
        const t = Date.UTC(y, m, 1);
        if (t >= maxTime) { break; }
        add(t, new Date(t).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }));
        m += 3;
        if (m > 11) { m = 0; y++; }
      }
    } else {
      // 1 Jan of each year
      for (let y = new Date(minTime).getUTCFullYear(); Date.UTC(y, 0, 1) < maxTime; y++) {
        add(Date.UTC(y, 0, 1), String(y));
      }
    }
    return labels;
  }, [minTime, totalMs, trackWidth]);

  const todayDateStr = new Date(todayMs).toISOString().slice(0, 10);

  const dueMarkers = useMemo(() =>
    milestones.flatMap((ms) => {
      if (!ms.dueOn) { return []; }
      const dueMs = new Date(ms.dueOn).getTime();
      if (isNaN(dueMs)) { return []; }
      const leftPct = ((dueMs - minTime) / totalMs) * 100;
      if (leftPct < -2 || leftPct > 102) { return []; }
      const coincidesToday = ms.dueOn.slice(0, 10) === todayDateStr;
      return [{ key: ms.number, leftPct, label: `Due ${fmtDate(ms.dueOn)}`, color: milestones.length > 1 ? ms.color : "#8250df", coincidesToday }];
    }),
  [milestones, minTime, totalMs, todayDateStr]);

  return (
    <>
      <GanttLegend hasOpenIssues={hasOpenIssues} colorblindMode={colorblindMode} snapMode={snapMode} onSnapModeChange={onSnapModeChange} onFitToScreen={onFitToScreen} />

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
            // Floor (not round) so we always highlight the column the cursor is IN
            const snappedMs = Math.floor(rawMs / snapUnit) * snapUnit;
            setCursorInfo({ snappedMs, clientX: e.clientX, clientY: e.clientY });
          }}
          onMouseLeave={() => setCursorInfo(null)}
        >
          <Box className="tl-date-axis" ref={axisRef} style={{ width: trackWidth }}>
            {dateLabels.map(({ label, centerPct }, i) => (
              <Box
                component="span"
                key={i}
                className="tl-date-label"
                style={{ left: `${centerPct}%`, transform: "translateX(-50%)" }}
              >
                {label}
              </Box>
            ))}
          </Box>
          <Box style={{ position: "relative", width: trackWidth }}>
          {dueMarkers.filter((dm) => !dm.coincidesToday).map((dm) => (
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
          {showToday && dueMarkers.filter((dm) => dm.coincidesToday).map((dm) => (
            <Box
              key={`due-today-lbl-${dm.key}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 2,
                left: `calc(${todayLeftPct}% + 5px)`,
                fontSize: FS.tiny,
                color: dm.color,
                whiteSpace: "nowrap",
                fontWeight: 700,
                lineHeight: 1,
                userSelect: "none",
                pointerEvents: "none",
                zIndex: 6,
              }}
            >
              Today · Due
            </Box>
          ))}
          {/* Day separator lines — one per calendar day */}
          {trackWidth > 0 && (() => {
            const dayWidthPx = (MS / totalMs) * trackWidth;
            if (dayWidthPx < 4) { return null; } // too dense to be useful
            const firstMidnight = Math.ceil(minTime / MS) * MS;
            const offsetPx = firstMidnight === minTime ? 0 : ((firstMidnight - minTime) / totalMs) * trackWidth;
            const totalH = sortedItems.length * ROW_HEIGHT;
            return (
              <Box
                aria-hidden="true"
                style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: totalH,
                  pointerEvents: "none", zIndex: 1,
                  backgroundImage: `repeating-linear-gradient(to right, transparent 0px, transparent calc(${dayWidthPx}px - 1px), var(--tl-day-sep) calc(${dayWidthPx}px - 1px), var(--tl-day-sep) ${dayWidthPx}px)`,
                  backgroundPosition: `${offsetPx}px 0`,
                }}
              />
            );
          })()}
          {bankHolidayBands.length > 0 && (
            <Box
              aria-hidden="true"
              style={{
                position: "absolute", inset: 0, pointerEvents: "none",
              }}
            >
              {bankHolidayBands.map((b) => (
                <Box key={b.leftPct} className="tl-bank-holiday-band" style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }} />
              ))}
            </Box>
          )}
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
          {cursorInfo !== null && (() => {
            const snapUnit = snapMode === "hour" ? MS_HOUR : MS;
            const leftPct  = ((cursorInfo.snappedMs - minTime) / totalMs) * 100;
            const widthPct = (snapUnit / totalMs) * 100;
            return (
              <Box
                aria-hidden="true"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: `${sortedItems.length * ROW_HEIGHT}px`, pointerEvents: "none" }}
              >
                <Box className="tl-cursor-band" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
              </Box>
            );
          })()}
          {sortedItems.map((item) => {
            const isOpen = item.type === "issue" ? !item.closedAt : !(item.mergedAt || item.closedAt);
            const endDate = isOpen ? null : itemEndDate(item);
            const endMs   = endDate ? new Date(endDate).getTime() : todayMs;

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
            const isShortDuration = durationText === "Same day" || durationText.match(/^[0-9]+h$/);
            // Effective width available for text (subtract review badge space if present)
            const effectiveBarPx = barWidthPx - (barWidthPx >= 60 && item.type === "pr" && item.reviewDecision ? 26 : 0) - (reopenPrefix ? 12 : 0);
            const barLabel =
              effectiveBarPx < 40
                ? ""
                : effectiveBarPx < 130 || isShortDuration
                  ? `${reopenPrefix}${durationText}`
                  : isOpen
                    ? effectiveBarPx < 200
                      ? `${reopenPrefix}${fmt(item.createdAt)} → today`
                      : `${reopenPrefix}${fmt(item.createdAt)} → today (${durationText})`
                    : effectiveBarPx < 200
                      ? `${reopenPrefix}${fmt(item.createdAt)} → ${fmt(endDate)}`
                      : `${reopenPrefix}${fmt(item.createdAt)} → ${fmt(endDate)} (${durationText})`;

            const statusWord = isOpen ? "Open" : item.type === "pr" ? (item.mergedAt ? "Merged" : "Closed") : "Closed";
            const palette = colorblindMode ? COLORS_CB : COLORS;
            const dotColor = isOpen
              ? item.type === "issue" ? palette.issue : palette.prMerged
              : item.type === "issue" ? palette.issue : isMergedPR ? palette.prMerged : palette.prClosed;

            const reviewBadge = item.type === "pr" && item.reviewDecision && barWidthPx >= 60
              ? item.reviewDecision === "APPROVED"
                ? { label: "✓", bg: palette.success }
                : item.reviewDecision === "CHANGES_REQUESTED"
                  ? { label: "✕", bg: palette.prClosed }
                  : { label: "?", bg: palette.warning }
              : null;

            return (
              <Box key={`trk-${item.type}-${item.number}`} className="tl-track-row" style={{ height: ROW_HEIGHT }}>
                <Box className="tl-track" style={{ width: trackWidth }}>
                  {showToday && <Box className="tl-today-marker" style={{ left: `${todayLeftPct}%` }} />}
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
                          background: reviewBadge.bg,
                          color: "#ffffff",
                          fontSize: 9,
                          fontWeight: 700,
                          lineHeight: 1,
                          padding: "2px 4px",
                          borderRadius: 3,
                          pointerEvents: "none",
                          userSelect: "none",
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

      {cursorInfo !== null && barHover === null && (() => {
        const d = new Date(cursorInfo.snappedMs);
        const dayName = DAY_NAMES[d.getUTCDay()];
        const dateStr = snapMode === "hour"
          ? fmtDateTime(d.toISOString())
          : fmtDate(d.toISOString());
        const holidayName = bankHolidayMap.get(d.toISOString().slice(0, 10));
        return (
          <Paper elevation={2} sx={{ position: "fixed", bottom: `${window.innerHeight - cursorInfo.clientY + 10}px`, left: cursorInfo.clientX, transform: "translateX(-50%)", px: 1, py: 0.5, pointerEvents: "none", zIndex: 150, userSelect: "none", whiteSpace: "nowrap" }}>
            <Box sx={{ fontSize: FS.sm, fontWeight: 600, color: "text.secondary" }}>
              {snapMode === "hour" ? dateStr : `${dayName} · ${dateStr}`}
            </Box>
            {holidayName && (
              <Box sx={{ fontSize: FS.tiny, fontWeight: 600, color: "error.main", mt: 0.25 }}>
                {holidayName}
              </Box>
            )}
          </Paper>
        );
      })()}

      {barHover && <BarHoverCard barHover={barHover} snapMode={snapMode} />}
    </>
  );
});

GanttView.displayName = "GanttView";

export { GanttView };
