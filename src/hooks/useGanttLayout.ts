import type { TimelineItem } from "../types/GitHubTypes";
import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MS_PER_DAY, snapToHour } from "../utils/dateUtils";
import { itemEndDate } from "../utils/displayUtils";

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

const useGanttLayout = (filteredItems: TimelineItem[]): GanttLayout => {
  const [labelWidth, setLabelWidth] = useState(() => {
    const n = Number(localStorage.getItem("gantt_label_width"));
    return Number.isFinite(n) ? Math.max(200, Math.min(800, n)) : 400;
  });
  const userZoomRef = useRef(localStorage.getItem("gantt_zoom") !== null);
  const [pixelsPerDay, _setPixelsPerDay] = useState(() => {
    const raw = localStorage.getItem("gantt_zoom");
    if (raw === null) { return 30; }
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(4, Math.min(200, n)) : 30;
  });
  // Public setter — flags the change as user-initiated so it gets persisted and
  // suppresses auto-fit on future renders. Auto-fit calls `_setPixelsPerDay` directly.
  const setPixelsPerDay = useCallback((v: number) => {
    userZoomRef.current = true;
    _setPixelsPerDay(v);
  }, []);
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

  useEffect(() => { localStorage.setItem("gantt_label_width", String(labelWidth)); }, [labelWidth]);
  useEffect(() => {
    if (userZoomRef.current) { localStorage.setItem("gantt_zoom", String(pixelsPerDay)); }
  }, [pixelsPerDay]);

  const handleFitToScreen = useCallback(() => {
    if (!trackColRef.current) { return; }
    const { totalDays } = stateRef.current;
    setPixelsPerDay(Math.max(4, Math.min(200, trackColRef.current.clientWidth / totalDays)));
  }, [setPixelsPerDay]);

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
    // Skip auto-fit once the user has explicitly chosen a zoom.
    if (userZoomRef.current) { return; }
    if (!trackColRef.current || filteredItems.length === 0) { return; }
    const allTs = filteredItems.flatMap((item) => {
      const end = itemEndDate(item);
      return [new Date(item.createdAt).getTime(), ...(end ? [new Date(end).getTime()] : [])];
    });
    const rawMin = Math.min(...allTs);
    const min = new Date(new Date(rawMin).toISOString().slice(0, 10)).getTime();
    const hasOpen = filteredItems.some((item) => !itemEndDate(item));
    const max = hasOpen ? Math.max(...allTs, Date.now()) : Math.max(...allTs) + 3 * MS_PER_DAY;
    const days = Math.max(1, (max - min) / MS_PER_DAY);
    _setPixelsPerDay(Math.max(4, Math.min(200, trackColRef.current.clientWidth / days)));
  }, [filteredItems]);

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
  }, [setPixelsPerDay]);

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

export { useGanttLayout };
export type { GanttLayout };
