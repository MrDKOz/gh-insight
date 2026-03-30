import type { TimelineItem } from "../types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MS, itemEndDate, snapToHour } from "../utils/utils";

type GanttLayout = {
  // State
  labelWidth: number;
  pixelsPerDay: number;
  axisHeight: number;
  snapMode: "day" | "hour";
  // Refs
  trackColRef: React.RefObject<HTMLDivElement | null>;
  axisRef: React.RefObject<HTMLDivElement | null>;
  // Computed timeline geometry
  todayMs: number;
  minTime: number;
  totalMs: number;
  totalDays: number;
  trackWidth: number;
  sortedItems: TimelineItem[];
  // Callbacks
  handleFitToScreen: () => void;
  handleResizeStart: (e: React.MouseEvent) => void;
  handleResizeKeyDown: (e: React.KeyboardEvent) => void;
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

  const handleFitToScreen = useCallback(() => {
    const el = trackColRef.current;
    if (!el) { return; }
    const { totalDays } = stateRef.current;
    setPixelsPerDay(Math.max(4, Math.min(200, el.clientWidth / totalDays)));
  }, []);

  const handleSnapModeChange = useCallback((mode: "day" | "hour") => {
    setSnapMode(mode);
    const p = new URLSearchParams(window.location.search);
    if (mode === "hour") { p.set("snap", "hour"); } else { p.delete("snap"); }
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, []);

  const handleResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setLabelWidth((w) => Math.min(800, w + 10)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setLabelWidth((w) => Math.max(200, w - 10)); }
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = labelWidth;
      const onMove = (ev: MouseEvent) => setLabelWidth(Math.max(200, startWidth + (ev.clientX - startX)));
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
    },
    [labelWidth],
  );

  // Drag cleanup on unmount
  useEffect(() => () => {
    dragCleanupRef.current?.();
  }, []);

  // Axis height via ResizeObserver
  useEffect(() => {
    const el = axisRef.current;
    if (!el) { return; }
    const measure = () => {
      const { height } = el.getBoundingClientRect();
      const marginBottom = parseFloat(getComputedStyle(el).marginBottom) || 0;
      setAxisHeight(height + marginBottom);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initial zoom to fit all items
  useEffect(() => {
    const el = trackColRef.current;
    if (!el || items.length === 0) { setPixelsPerDay(30); return; }
    const allTs = items.flatMap((item) => {
      const end = itemEndDate(item);
      return [new Date(item.createdAt).getTime(), ...(end ? [new Date(end).getTime()] : [])];
    });
    const rawMin = Math.min(...allTs);
    const min = new Date(new Date(rawMin).toISOString().slice(0, 10)).getTime();
    const hasOpen = items.some((item) => !itemEndDate(item));
    const max = hasOpen ? Math.max(...allTs, Date.now()) : Math.max(...allTs) + 3 * MS;
    const days = Math.max(1, (max - min) / MS);
    setPixelsPerDay(Math.max(4, Math.min(200, el.clientWidth / days)));
  }, [items]);

  // Non-passive wheel listener for scroll-zoom
  useEffect(() => {
    const el = trackColRef.current;
    if (!el) { return; }
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { return; }
      e.preventDefault();
      const { pixelsPerDay: ppd, totalDays: td, trackWidth: tw } = stateRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newPpd = Math.min(200, Math.max(4, ppd * factor));
      const newTrackWidth = Math.max(500, Math.round(td * newPpd));
      const cursorX = e.clientX - el.getBoundingClientRect().left;
      const fraction = tw > 0 ? (cursorX + el.scrollLeft) / tw : 0;
      pendingScrollRef.current = Math.max(0, fraction * newTrackWidth - cursorX);
      setPixelsPerDay(newPpd);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Apply pending scroll after zoom
  useEffect(() => {
    if (pendingScrollRef.current !== null && trackColRef.current) {
      trackColRef.current.scrollLeft = pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [pixelsPerDay]);

  const allTimestamps = useMemo(
    () =>
      filteredItems.flatMap((item) => {
        const end = itemEndDate(item);
        const ts = [new Date(item.createdAt).getTime()];
        if (end) { ts.push(new Date(end).getTime()); }
        return ts;
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
      : Math.max(...allTimestamps) + 3 * MS;
    const tms = max - min || 1;
    const tdays = tms / MS;
    return {
      todayMs: now,
      minTime: min,
      totalMs: tms,
      totalDays: tdays,
      trackWidth: Math.max(500, Math.floor(tdays * pixelsPerDay)),
    };
  }, [allTimestamps, filteredItems, pixelsPerDay, snapMode]);

  // Keep ref current for wheel-zoom handler without adding to its deps
  useLayoutEffect(() => {
    stateRef.current = { pixelsPerDay, totalDays, trackWidth };
  }, [pixelsPerDay, totalDays, trackWidth]);

  const sortedItems = useMemo(
    () => [...filteredItems].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [filteredItems],
  );

  return {
    labelWidth,
    pixelsPerDay,
    axisHeight,
    snapMode,
    trackColRef,
    axisRef,
    todayMs,
    minTime,
    totalMs,
    totalDays,
    trackWidth,
    sortedItems,
    handleFitToScreen,
    handleResizeStart,
    handleResizeKeyDown,
    handleSnapModeChange,
  };
}

export { useGanttLayout };
