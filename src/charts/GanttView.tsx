import type { BankHoliday } from "../api/bankHolidayApi";
import type { GanttHandle } from "../types/AppTypes";
import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AuthorCard, AuthorTag } from "../components/AuthorTag";
import { ItemHoverCard, fixedItemCardPos } from "../components/ItemHoverCard";
import { COLORS, COLORS_CB } from "../utils/colorUtils";
import { DAY_NAMES, MS_PER_DAY, MS_PER_HOUR, STALE_MS, buildBankHolidayMap, durationDays, fmtDate, fmtDateTime, snapToHour } from "../utils/dateUtils";
import { FS, itemEndDate, safeUrl } from "../utils/displayUtils";
import { GanttLegend } from "./GanttLegend";

// ── Gantt layout hook ─────────────────────────────────────────────────────

type GanttLayout = {
  labelWidth: number;
  pixelsPerDay: number;
  axisHeight: number;
  snapMode: "day" | "hour";
  trackColRef: RefObject<HTMLDivElement | null>;
  axisRef: RefObject<HTMLDivElement | null>;
  todayMs: number;
  minTime: number;
  totalMs: number;
  totalDays: number;
  trackWidth: number;
  sortedItems: TimelineItem[];
  handleFitToScreen: () => void;
  handleResizeStart: (e: MouseEvent) => void;
  handleResizeKeyDown: (e: KeyboardEvent) => void;
  handleSnapModeChange: (mode: "day" | "hour") => void;
};

const useGanttLayout = (items: TimelineItem[], filteredItems: TimelineItem[]): GanttLayout => {
  const [labelWidth, setLabelWidth] = useState(400);
  const [pixelsPerDay, setPixelsPerDay] = useState(30);
  const [axisHeight, setAxisHeight] = useState(36);
  const [snapMode, setSnapMode] = useState<"day" | "hour">(() =>
    new URLSearchParams(window.location.search).get("snap") === "hour" ? "hour" : "day",
  );

  const trackColRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ pixelsPerDay, totalDays: 0, trackWidth: 0 });
  const pendingScrollRef = useRef<number | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const labelWidthRef = useRef(labelWidth);

  useLayoutEffect(() => { labelWidthRef.current = labelWidth; }, [labelWidth]);

  const handleFitToScreen = useCallback(() => {
    if (!trackColRef.current) { return; }
    const { totalDays } = stateRef.current;
    setPixelsPerDay(Math.max(4, Math.min(200, trackColRef.current.clientWidth / totalDays)));
  }, []);

  const handleSnapModeChange = useCallback((mode: "day" | "hour") => {
    setSnapMode(mode);
    const p = new URLSearchParams(window.location.search);
    if (mode === "hour") { p.set("snap", "hour"); } else { p.delete("snap"); }
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, []);

  const handleResizeKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setLabelWidth((w) => Math.min(800, w + 10)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setLabelWidth((w) => Math.max(200, w - 10)); }
  }, []);

  // Uses a ref for startWidth so this callback is stable across labelWidth changes
  const handleResizeStart = useCallback((e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = labelWidthRef.current;
    const onMove = (ev: globalThis.MouseEvent) => setLabelWidth(Math.max(200, startWidth + (ev.clientX - startX)));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      dragCleanupRef.current = null;
    };
    dragCleanupRef.current = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  useEffect(() => () => { dragCleanupRef.current?.(); }, []);

  useEffect(() => {
    const axisElement = axisRef.current;
    if (!axisElement) { return; }
    const measure = () => {
      const { height } = axisElement.getBoundingClientRect();
      const marginBottom = parseFloat(getComputedStyle(axisElement).marginBottom) || 0;
      setAxisHeight(height + marginBottom);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(axisElement);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!trackColRef.current || items.length === 0) { setPixelsPerDay(30); return; }
    const allTs = items.flatMap((item) => {
      const end = itemEndDate(item);
      return [new Date(item.createdAt).getTime(), ...(end ? [new Date(end).getTime()] : [])];
    });
    const rawMin = Math.min(...allTs);
    const min = new Date(new Date(rawMin).toISOString().slice(0, 10)).getTime();
    const hasOpen = items.some((item) => !itemEndDate(item));
    const max = hasOpen ? Math.max(...allTs, Date.now()) : Math.max(...allTs) + 3 * MS_PER_DAY;
    const days = Math.max(1, (max - min) / MS_PER_DAY);
    setPixelsPerDay(Math.max(4, Math.min(200, trackColRef.current.clientWidth / days)));
  }, [items]);

  useEffect(() => {
    const trackColElement = trackColRef.current;
    if (!trackColElement) { return; }
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { return; }
      e.preventDefault();
      const { pixelsPerDay, totalDays, trackWidth } = stateRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newPixelsPerDay = Math.min(200, Math.max(4, pixelsPerDay * factor));
      const newTrackWidth = Math.max(500, Math.round(totalDays * newPixelsPerDay));
      const cursorX = e.clientX - trackColElement.getBoundingClientRect().left;
      const fraction = trackWidth > 0 ? (cursorX + trackColElement.scrollLeft) / trackWidth : 0;
      pendingScrollRef.current = Math.max(0, fraction * newTrackWidth - cursorX);
      setPixelsPerDay(newPixelsPerDay);
    };
    trackColElement.addEventListener("wheel", onWheel, { passive: false });
    return () => trackColElement.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (pendingScrollRef.current !== null && trackColRef.current) {
      trackColRef.current.scrollLeft = pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [pixelsPerDay]);

  const allTimestamps = useMemo(
    () => filteredItems.flatMap((item) => {
      const end = itemEndDate(item);
      const timestamps = [new Date(item.createdAt).getTime()];
      if (end) { timestamps.push(new Date(end).getTime()); }
      return timestamps;
    }),
    [filteredItems],
  );

  const { todayMs, minTime, totalMs, totalDays, trackWidth } = useMemo(() => {
    const now = Date.now();
    if (allTimestamps.length === 0) {
      return { todayMs: now, minTime: now, totalMs: 1, totalDays: 1, trackWidth: 500 };
    }
    const rawMin = Math.min(...allTimestamps);
    const min = snapMode === "hour"
      ? snapToHour(rawMin)
      : new Date(new Date(rawMin).toISOString().slice(0, 10)).getTime();
    const hasOpenItems = filteredItems.some((item) => !itemEndDate(item));
    const max = hasOpenItems
      ? Math.max(...allTimestamps, now)
      : Math.max(...allTimestamps) + 3 * MS_PER_DAY;
    const tms = max - min || 1;
    const tdays = tms / MS_PER_DAY;
    return {
      todayMs: now,
      minTime: min,
      totalMs: tms,
      totalDays: tdays,
      trackWidth: Math.max(500, Math.floor(tdays * pixelsPerDay)),
    };
  }, [allTimestamps, filteredItems, pixelsPerDay, snapMode]);

  useLayoutEffect(() => {
    stateRef.current = { pixelsPerDay, totalDays, trackWidth };
  }, [pixelsPerDay, totalDays, trackWidth]);

  const sortedItems = useMemo(
    () => [...filteredItems].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [filteredItems],
  );

  return {
    labelWidth, pixelsPerDay, axisHeight, snapMode,
    trackColRef, axisRef,
    todayMs, minTime, totalMs, totalDays, trackWidth,
    sortedItems,
    handleFitToScreen, handleResizeStart, handleResizeKeyDown, handleSnapModeChange,
  };
};

// ── GanttView ─────────────────────────────────────────────────────────────

type Props = {
  items: TimelineItem[];
  filteredItems: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  bankHolidays: BankHoliday[];
  colorblindMode: boolean;
};

const ROW_HEIGHT = 31;

type CursorInfo = { snappedMs: number; clientX: number; clientY: number };
type BarHover   = { clientX: number; clientY: number; item: TimelineItem; endDate: string | null; isOpen: boolean; durationText: string; dotColor: string; statusWord: string };

type BarItemData = {
  item:         TimelineItem;
  isOpen:       boolean;
  badgeClass:   string;
  isStale:      boolean;
  staleDays:    number;
  isDraft:      boolean;
  endDate:      string | null;
  leftPct:      number;
  widthPct:     number;
  barWidthPx:   number;
  durationText: string;
  barClass:     string;
  barLabel:     string;
  statusWord:   string;
  dotColor:     string;
  reviewBadge:  { label: string; bg: string } | null;
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
    if (hideTimer.current) { clearTimeout(hideTimer.current); }
  }, []);

  const showCard = (item: TimelineItem, e: MouseEvent<HTMLSpanElement>) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); }
    const rect = e.currentTarget.getBoundingClientRect();
    const cardW = 160;
    const left = rect.right + 8 + cardW > window.innerWidth
      ? Math.max(8, rect.left - cardW - 8)
      : rect.right + 8;
    setCardPos({ top: rect.top + rect.height / 2, left });
    setHoverItem(item);
  };

  const scheduleHide = () => { hideTimer.current = setTimeout(() => setHoverItem(null), 150); };
  const cancelHide  = () => { if (hideTimer.current) { clearTimeout(hideTimer.current); } };

  const fmt = snapMode === "hour" ? fmtDateTime : fmtDate;

  // Pre-compute all per-item render data so both label and track columns share one pass.
  const barItems = useMemo<BarItemData[]>(() => {
    const palette = colorblindMode ? COLORS_CB : COLORS;
    const fmtFn   = snapMode === "hour" ? fmtDateTime : fmtDate;

    return sortedItems.map((item) => {
      const isOpen     = item.type === "issue" ? !item.closedAt : !(item.mergedAt || item.closedAt);
      const isClosedPR = item.type === "pr" && !item.mergedAt && !!item.closedAt;
      const badgeClass = item.type === "issue"
        ? "tl-badge tl-badge--issue"
        : isClosedPR ? "tl-badge tl-badge--pr-closed" : "tl-badge tl-badge--pr";
      const isStale  = isOpen && (todayMs - new Date(item.updatedAt).getTime()) > STALE_MS;
      const staleDays = isStale ? Math.floor((todayMs - new Date(item.updatedAt).getTime()) / MS_PER_DAY) : 0;
      const isDraft  = item.type === "pr" && item.isDraft;

      const endDate  = isOpen ? null : itemEndDate(item);
      const endMs    = endDate ? new Date(endDate).getTime() : todayMs;
      const startMs  = snapMode === "hour"
        ? snapToHour(new Date(item.createdAt).getTime())
        : new Date(new Date(item.createdAt).toISOString().slice(0, 10)).getTime();
      const snapEndMs = isOpen ? endMs
        : snapMode === "hour" ? snapToHour(endMs)
        : startMs + (durationDays(item.createdAt, endDate) ?? 0) * MS_PER_DAY;

      const leftPct  = ((startMs - minTime) / totalMs) * 100;
      const widthPct = Math.max(((snapEndMs - startMs) / totalMs) * 100, 0.3);
      const barWidthPx = (widthPct / 100) * trackWidth;

      let durationText: string;
      if (isOpen) {
        durationText = "ongoing";
      } else if (snapMode === "hour" && endDate) {
        const hrs = Math.round((new Date(endDate).getTime() - new Date(item.createdAt).getTime()) / MS_PER_HOUR);
        const dayCount        = Math.floor(hrs / 24);
        const remainingHours  = hrs % 24;
        durationText = hrs === 0 ? "< 1h" : dayCount === 0 ? `${hrs}h` : remainingHours === 0 ? `${dayCount}d` : `${dayCount}d ${remainingHours}h`;
      } else {
        const duration = durationDays(item.createdAt, endDate);
        durationText = duration === null ? "ongoing" : duration === 0 ? "Same day" : duration === 1 ? "1 day" : `${duration} days`;
      }

      const isMergedPR = item.type === "pr" && !!item.mergedAt;
      const barClass = [
        "tl-bar",
        isOpen
          ? item.type === "issue" ? "tl-bar--issue-open" : "tl-bar--pr-open"
          : item.type === "issue" ? "tl-bar--issue" : isMergedPR ? "tl-bar--pr-merged" : "tl-bar--pr-closed",
      ].join(" ");

      const reopenPrefix    = item.type === "issue" && item.reopenedCount > 0 ? "↺ " : "";
      const isShortDuration = durationText === "Same day" || /^[0-9]+h$/.test(durationText);
      const effectiveBarPx  = barWidthPx - (barWidthPx >= 60 && item.type === "pr" && item.reviewDecision ? 26 : 0) - (reopenPrefix ? 12 : 0);
      const barLabel =
        effectiveBarPx < 40                        ? ""
        : effectiveBarPx < 130 || isShortDuration  ? `${reopenPrefix}${durationText}`
        : isOpen
          ? effectiveBarPx < 200 ? `${reopenPrefix}${fmtFn(item.createdAt)} → today`
                                 : `${reopenPrefix}${fmtFn(item.createdAt)} → today (${durationText})`
          : effectiveBarPx < 200 ? `${reopenPrefix}${fmtFn(item.createdAt)} → ${fmtFn(endDate)}`
                                 : `${reopenPrefix}${fmtFn(item.createdAt)} → ${fmtFn(endDate)} (${durationText})`;

      const statusWord  = isOpen ? "Open" : item.type === "pr" ? (item.mergedAt ? "Merged" : "Closed") : "Closed";
      const dotColor    = isOpen
        ? item.type === "issue" ? palette.issue    : palette.prMerged
        : item.type === "issue" ? palette.issue    : isMergedPR ? palette.prMerged : palette.prClosed;
      const reviewBadge = item.type === "pr" && item.reviewDecision && barWidthPx >= 60
        ? item.reviewDecision === "APPROVED"          ? { label: "✓", bg: palette.success }
        : item.reviewDecision === "CHANGES_REQUESTED" ? { label: "✕", bg: palette.prClosed }
        : { label: "?", bg: palette.warning }
        : null;

      return { item, isOpen, badgeClass, isStale, staleDays, isDraft, endDate, leftPct, widthPct, barWidthPx, durationText, barClass, barLabel, statusWord, dotColor, reviewBadge };
    });
  }, [sortedItems, minTime, totalMs, trackWidth, snapMode, colorblindMode, todayMs]);

  const weekendBands = useMemo(() => {
    if (!highlightWeekends) { return []; }
    const bands: { leftPct: number; widthPct: number }[] = [];
    // Start from UTC midnight before minTime so bands always cover full calendar days.
    const dayFloor = Math.floor(minTime / MS_PER_DAY) * MS_PER_DAY;
    for (let d = dayFloor; d < minTime + totalMs; d += MS_PER_DAY) {
      if (new Date(d).getUTCDay() !== 6) { continue; } // Saturday midnight UTC
      const bandLeft  = Math.max(d, minTime);
      const bandRight = Math.min(d + 2 * MS_PER_DAY, minTime + totalMs);
      if (bandRight > bandLeft) {
        bands.push({
          leftPct:  ((bandLeft  - minTime) / totalMs) * 100,
          widthPct: ((bandRight - bandLeft) / totalMs) * 100,
        });
      }
      d += MS_PER_DAY; // skip Sunday
    }
    return bands;
  }, [highlightWeekends, minTime, totalMs]);

  const bankHolidayMap = useMemo(() => buildBankHolidayMap(bankHolidays), [bankHolidays]);

  const bankHolidayBands = useMemo(() => {
    if (bankHolidays.length === 0) { return []; }
    return bankHolidays.flatMap(({ date }) => {
      const t = new Date(date).getTime();
      if (t < minTime || t >= minTime + totalMs) { return []; }
      return [{ leftPct: ((t - minTime) / totalMs) * 100, widthPct: (MS_PER_DAY / totalMs) * 100 }];
    });
  }, [bankHolidays, minTime, totalMs]);

  const todayLeftPct = ((todayMs - minTime) / totalMs) * 100;
  const showToday    = todayMs >= minTime && todayMs <= minTime + totalMs;

  // Calendar-aware date labels: snap to day / week / month / quarter / year boundaries
  // so labels always fall on meaningful calendar dates at every zoom level.
  const dateLabels = useMemo(() => {
    if (trackWidth === 0 || totalMs === 0) { return []; }
    const maxTime    = minTime + totalMs;
    const dayWidthPx = (MS_PER_DAY / totalMs) * trackWidth;
    const withYear   = totalMs > 365 * MS_PER_DAY;
    const labels: { label: string; centerPct: number }[] = [];

    // Center label text in the middle of its representative day (noon = t + MS_PER_DAY/2)
    const add = (t: number, label: string) => {
      const centerPct = ((t + MS_PER_DAY / 2 - minTime) / totalMs) * 100;
      if (centerPct > -10 && centerPct < 110) { labels.push({ label, centerPct }); }
    };

    const dayLabel = (t: number) => fmtDate(new Date(t).toISOString(), withYear);

    if (dayWidthPx >= 90) {
      // Every day
      for (let t = Math.ceil(minTime / MS_PER_DAY) * MS_PER_DAY; t < maxTime; t += MS_PER_DAY) { add(t, dayLabel(t)); }
    } else if (dayWidthPx >= 13) {
      // Every Monday (7 days × 13 px ≈ 91 px between labels)
      const firstMidnight = Math.ceil(minTime / MS_PER_DAY) * MS_PER_DAY;
      const dow = new Date(firstMidnight).getUTCDay();
      const daysToMon = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
      for (let t = firstMidnight + daysToMon * MS_PER_DAY; t < maxTime; t += 7 * MS_PER_DAY) { add(t, dayLabel(t)); }
    } else if (dayWidthPx >= 7) {
      // Every other Monday (14 days × 7 px ≈ 98 px)
      const firstMidnight = Math.ceil(minTime / MS_PER_DAY) * MS_PER_DAY;
      const dow = new Date(firstMidnight).getUTCDay();
      const daysToMon = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow;
      for (let t = firstMidnight + daysToMon * MS_PER_DAY; t < maxTime; t += 14 * MS_PER_DAY) { add(t, dayLabel(t)); }
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
    milestones.flatMap((milestone) => {
      if (!milestone.dueOn) { return []; }
      const dueMs = new Date(milestone.dueOn).getTime();
      if (isNaN(dueMs)) { return []; }
      const leftPct = ((dueMs - minTime) / totalMs) * 100;
      if (leftPct < -2 || leftPct > 102) { return []; }
      const coincidesToday = milestone.dueOn.slice(0, 10) === todayDateStr;
      return [{ key: milestone.number, leftPct, label: `Due ${fmtDate(milestone.dueOn)}`, color: milestones.length > 1 ? milestone.color : "#8250df", coincidesToday }];
    }),
  [milestones, minTime, totalMs, todayDateStr]);

  // Pre-compute day separator props (null when grid lines would be too dense to be useful)
  const daySepProps = useMemo(() => {
    if (trackWidth === 0) { return null; }
    const dayWidthPx = (MS_PER_DAY / totalMs) * trackWidth;
    if (dayWidthPx < 4) { return null; }
    const firstMidnight = Math.ceil(minTime / MS_PER_DAY) * MS_PER_DAY;
    const offsetPx = firstMidnight === minTime ? 0 : ((firstMidnight - minTime) / totalMs) * trackWidth;
    return { dayWidthPx, offsetPx };
  }, [trackWidth, totalMs, minTime]);

  // Pre-compute cursor highlight band position
  const cursorBand = cursorInfo ? {
    leftPct:  ((cursorInfo.snappedMs - minTime) / totalMs) * 100,
    widthPct: ((snapMode === "hour" ? MS_PER_HOUR : MS_PER_DAY) / totalMs) * 100,
  } : null;

  // Pre-compute cursor tooltip values to avoid repeated Date construction in JSX
  const cursorDate        = cursorInfo ? new Date(cursorInfo.snappedMs) : null;
  const cursorHolidayName = cursorDate ? bankHolidayMap.get(cursorDate.toISOString().slice(0, 10)) : null;

  const rowCount = barItems.length;

  return (
    <>
      <GanttLegend hasOpenIssues={hasOpenIssues} colorblindMode={colorblindMode} snapMode={snapMode} onSnapModeChange={onSnapModeChange} onFitToScreen={onFitToScreen} />

      <Box className="tl-body">
        <Box className="tl-label-col" style={{ width: labelWidth }}>
          <Box style={{ height: axisHeight, flexShrink: 0 }} />
          {barItems.map((bi) => (
            <Box
              key={`lbl-${bi.item.type}-${bi.item.number}`}
              className="tl-label"
              style={{
                height: ROW_HEIGHT,
                opacity: bi.isOpen ? 0.75 : 1,
                boxShadow: isMultiMilestone
                  ? `inset 3px 0 0 ${milestoneColorMap.get(bi.item.milestoneNumber) ?? COLORS.chartAxis}`
                  : undefined,
              }}
            >
              <Box component="span" className={bi.badgeClass}>{bi.item.type.toUpperCase()}</Box>
              {bi.isDraft && (
                <Box component="span" sx={{ fontSize: FS.tiny, fontWeight: 700, color: "text.secondary", bgcolor: "action.selected", borderRadius: "3px", px: "3px", py: "1px", mr: "2px", flexShrink: 0 }}>DRAFT</Box>
              )}
              <a
                href={safeUrl(bi.item.url)}
                target="_blank"
                rel="noreferrer"
                aria-label={`${bi.item.type === "pr" ? "PR" : "Issue"} #${bi.item.number}: ${bi.item.title}`}
                className={`tl-num tl-num--${bi.item.type}`}
              >
                #{bi.item.number}
              </a>
              <Box component="span" className="tl-title" title={bi.item.title}>
                {bi.isStale && (
                  <Box component="span" title={`No activity for ${bi.staleDays} days`} sx={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", bgcolor: COLORS.warning, mr: "4px", verticalAlign: "middle", flexShrink: 0 }} />
                )}
                {bi.item.title}
              </Box>
              <AuthorTag
                login={bi.item.author}
                showName={false}
                onMouseEnter={(e) => showCard(bi.item, e)}
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
          ))}
        </Box>

        <Box
          className="tl-track-col"
          ref={trackColRef}
          onMouseMove={(e) => {
            const rect     = e.currentTarget.getBoundingClientRect();
            const x        = e.clientX - rect.left + e.currentTarget.scrollLeft;
            const rawMs    = minTime + (x / trackWidth) * totalMs;
            const snapUnit = snapMode === "hour" ? MS_PER_HOUR : MS_PER_DAY;
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
                style={{ position: "absolute", top: 0, left: `${dm.leftPct}%`, width: 2, height: `${rowCount * ROW_HEIGHT}px`, background: dm.color, opacity: 0.65, pointerEvents: "none", zIndex: 3 }}
              >
                <Box component="span" style={{ position: "absolute", top: 2, left: 4, fontSize: FS.tiny, color: dm.color, whiteSpace: "nowrap", fontWeight: 700, lineHeight: 1, userSelect: "none" }}>
                  {dm.label}
                </Box>
              </Box>
            ))}
            {showToday && dueMarkers.filter((dm) => dm.coincidesToday).map((dm) => (
              <Box
                key={`due-today-lbl-${dm.key}`}
                aria-hidden="true"
                style={{ position: "absolute", top: 2, left: `calc(${todayLeftPct}% + 5px)`, fontSize: FS.tiny, color: dm.color, whiteSpace: "nowrap", fontWeight: 700, lineHeight: 1, userSelect: "none", pointerEvents: "none", zIndex: 6 }}
              >
                Today · Due
              </Box>
            ))}
            {daySepProps && (
              <Box
                aria-hidden="true"
                style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: `${rowCount * ROW_HEIGHT}px`,
                  pointerEvents: "none", zIndex: 1,
                  backgroundImage: `repeating-linear-gradient(to right, transparent 0px, transparent calc(${daySepProps.dayWidthPx}px - 1px), var(--tl-day-sep) calc(${daySepProps.dayWidthPx}px - 1px), var(--tl-day-sep) ${daySepProps.dayWidthPx}px)`,
                  backgroundPosition: `${daySepProps.offsetPx}px 0`,
                }}
              />
            )}
            {bankHolidayBands.length > 0 && (
              <Box aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {bankHolidayBands.map((b) => (
                  <Box key={b.leftPct} className="tl-bank-holiday-band" style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }} />
                ))}
              </Box>
            )}
            {weekendBands.length > 0 && (
              <Box aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: `${rowCount * ROW_HEIGHT}px`, pointerEvents: "none" }}>
                {weekendBands.map((b) => (
                  <Box key={b.leftPct} className="tl-weekend-band" style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }} />
                ))}
              </Box>
            )}
            {cursorBand && (
              <Box aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: `${rowCount * ROW_HEIGHT}px`, pointerEvents: "none" }}>
                <Box className="tl-cursor-band" style={{ left: `${cursorBand.leftPct}%`, width: `${cursorBand.widthPct}%` }} />
              </Box>
            )}
            {barItems.map((bi) => (
              <Box key={`trk-${bi.item.type}-${bi.item.number}`} className="tl-track-row" style={{ height: ROW_HEIGHT }}>
                <Box className="tl-track" style={{ width: trackWidth }}>
                  {showToday && <Box className="tl-today-marker" style={{ left: `${todayLeftPct}%` }} />}
                  <a
                    href={safeUrl(bi.item.url)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${bi.item.type === "pr" ? "PR" : "Issue"} #${bi.item.number}: ${bi.item.title} — ${bi.statusWord}, ${bi.durationText}`}
                    className={bi.barClass}
                    style={{ left: `${bi.leftPct}%`, width: `${bi.widthPct}%` }}
                    onMouseEnter={(e) => setBarHover({ clientX: e.clientX, clientY: e.clientY, item: bi.item, endDate: bi.endDate, isOpen: bi.isOpen, durationText: bi.durationText, dotColor: bi.dotColor, statusWord: bi.statusWord })}
                    onMouseLeave={() => setBarHover(null)}
                  >
                    {bi.reviewBadge && (
                      <Box
                        component="span"
                        aria-hidden="true"
                        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", background: bi.reviewBadge.bg, color: "#ffffff", fontSize: 9, fontWeight: 700, lineHeight: 1, padding: "2px 4px", borderRadius: 3, pointerEvents: "none", userSelect: "none" }}
                      >
                        {bi.reviewBadge.label}
                      </Box>
                    )}
                    {bi.barLabel}
                  </a>
                </Box>
              </Box>
            ))}
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

      {cursorInfo && cursorDate && barHover === null && (
        <Paper elevation={2} sx={{ position: "fixed", bottom: `${window.innerHeight - cursorInfo.clientY + 10}px`, left: cursorInfo.clientX, transform: "translateX(-50%)", px: 1, py: 0.5, pointerEvents: "none", zIndex: 150, userSelect: "none", whiteSpace: "nowrap" }}>
          <Box sx={{ fontSize: FS.sm, fontWeight: 600, color: "text.secondary" }}>
            {snapMode === "hour" ? fmt(cursorDate.toISOString()) : `${DAY_NAMES[cursorDate.getUTCDay()]} · ${fmt(cursorDate.toISOString())}`}
          </Box>
          {cursorHolidayName && (
            <Box sx={{ fontSize: FS.tiny, fontWeight: 600, color: "error.main", mt: 0.25 }}>
              {cursorHolidayName}
            </Box>
          )}
        </Paper>
      )}

      {barHover && (
        <ItemHoverCard
          item={barHover.item}
          dotColor={barHover.dotColor}
          isOpen={barHover.isOpen}
          statusWord={barHover.statusWord}
          dateRange={`${fmt(barHover.item.createdAt)} → ${barHover.isOpen ? "ongoing" : fmt(barHover.endDate)}`}
          metric={barHover.durationText}
          positionSx={fixedItemCardPos(barHover.clientX, barHover.clientY)}
        />
      )}
    </>
  );
});

GanttView.displayName = "GanttView";

export { GanttView };
