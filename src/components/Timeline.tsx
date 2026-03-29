import type { MilestoneMeta, TimelineItem } from "../types";
import type { Filters } from "./FilterBar";
import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Burndown } from "../charts/Burndown";
import { Contributors } from "../charts/Contributors";
import { CumulativeFlow } from "../charts/CumulativeFlow";
import { CycleTime } from "../charts/CycleTime";
import { Velocity } from "../charts/Velocity";
import { exportCSV, exportChartPDF, exportGanttPDF, exportMarkdown, exportPDF, exportPNG, exportReviewWaitCSV, exportReviewWaitMarkdown, exportReviewWaitPDF, exportReviewWaitXLSX, exportSVG, exportXLSX } from "../utils/export";
import { MS, itemEndDate, snapToHour } from "../utils/utils";
import { FilterBar, applyFilters } from "./FilterBar";
import { GanttView } from "./GanttView";
import { ItemList } from "./ItemList";
import { ReviewWaitList } from "./ReviewWaitList";
import { StatsBar } from "./StatsBar";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  colorblindMode: boolean;
  view: View;
  onViewChange: (v: View) => void;
};

type ExportFormat = "CSV" | "XLSX" | "Markdown" | "PNG — Current view" | "PNG — Full timeline" | "PDF" | "SVG";

// Only show export formats whose output visually matches what is on screen:
//   Gantt       — PNG (current + full) + PDF (full Gantt embedded as image in PDF)
//   Chart views — PNG (current) + PDF (chart image) + SVG (true vector; extracted directly
//                 from the <svg aria-hidden> element — editable in Illustrator/Inkscape)
//   Review Wait — CSV / XLSX / Markdown / PDF (data table) + PNG (captures table + wait bars)
//   List        — CSV / XLSX / Markdown / PDF (data table) + PNG (captures visible table)
const CHART_VIEWS = new Set<View>(["Burndown", "Cycle Time", "Velocity", "Cumulative Flow", "Contributors"]);

const formatsForView = (v: View): ExportFormat[] => {
  if (v === "Gantt")       {return ["PNG — Current view", "PNG — Full timeline", "PDF"];}
  if (v === "List")        {return ["CSV", "XLSX", "Markdown", "PNG — Current view", "PDF"];}
  if (v === "Review Wait") {return ["CSV", "XLSX", "Markdown", "PNG — Current view", "PDF"];}
  // Chart views (Burndown, Cycle Time, Velocity, Cumulative Flow, Contributors)
  return ["PNG — Current view", "PDF", "SVG"];
};

type View = "Gantt" | "Burndown" | "Cycle Time" | "Velocity" | "Cumulative Flow" | "Contributors" | "Review Wait" | "List";
const VIEWS: View[] = ["Gantt", "Burndown", "Cycle Time", "Velocity", "Cumulative Flow", "Contributors", "Review Wait", "List"];
const DEFAULT_VIEW: View = "Gantt";

// ---------------------------------------------------------------------------
// URL state — view is managed by App; filters are managed here.
// Both write to the same URLSearchParams so they don't clobber each other.
// ---------------------------------------------------------------------------

const readViewFiltersFromUrl = (): { view: View; filters: Filters } => {
  const p = new URLSearchParams(window.location.search);
  const rawView = p.get("view") ?? "";
  const view: View = (VIEWS as readonly string[]).includes(rawView) ? (rawView as View) : DEFAULT_VIEW;

  const hide = new Set((p.get("hide") ?? "").split(",").filter(Boolean));
  const rawRole = p.get("role");

  const filters: Filters = {
    createdStart:     p.get("created_from") ?? "",
    createdEnd:       p.get("created_to") ?? "",
    closedStart:      p.get("closed_from") ?? "",
    closedEnd:        p.get("closed_to") ?? "",
    showOpenIssues:   !hide.has("oi"),
    showClosedIssues: !hide.has("ci"),
    showOpenPRs:      !hide.has("op"),
    showMergedPRs:    !hide.has("mp"),
    showClosedPRs:    !hide.has("cp"),
    // "|" separator; each value is URI-encoded so "|" inside a label/name is safe
    activeLabels: p.get("labels") ? p.get("labels")!.split("|").filter(Boolean).map(decodeURIComponent) : [],
    activePeople: p.get("people") ? p.get("people")!.split("|").filter(Boolean).map(decodeURIComponent) : [],
    peopleRole:   rawRole === "author" ? "author" : rawRole === "assignees" ? "assignees" : "either",
  };
  return { view, filters };
};

const syncFiltersToUrl = (filters: Filters): void => {
  // Read the current params so App-owned keys (owner/repo/milestones/demo/view) are preserved
  const p = new URLSearchParams(window.location.search);

  if (filters.createdStart) {p.set("created_from", filters.createdStart);} else {p.delete("created_from");}
  if (filters.createdEnd)   {p.set("created_to",   filters.createdEnd);}   else {p.delete("created_to");}
  if (filters.closedStart)  {p.set("closed_from",  filters.closedStart);}  else {p.delete("closed_from");}
  if (filters.closedEnd)    {p.set("closed_to",    filters.closedEnd);}    else {p.delete("closed_to");}

  const hidden: string[] = [];
  if (!filters.showOpenIssues)   {hidden.push("oi");}
  if (!filters.showClosedIssues) {hidden.push("ci");}
  if (!filters.showOpenPRs)      {hidden.push("op");}
  if (!filters.showMergedPRs)    {hidden.push("mp");}
  if (!filters.showClosedPRs)    {hidden.push("cp");}
  if (hidden.length > 0) {p.set("hide", hidden.join(","));} else {p.delete("hide");}

  if (filters.activeLabels.length > 0) {p.set("labels", filters.activeLabels.map(encodeURIComponent).join("|"));} else {p.delete("labels");}
  if (filters.activePeople.length > 0) {p.set("people", filters.activePeople.map(encodeURIComponent).join("|"));} else {p.delete("people");}

  if (filters.peopleRole !== "either") {p.set("role", filters.peopleRole);} else {p.delete("role");}

  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
};

const Timeline: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, colorblindMode, view }) => {
  const [labelWidth, setLabelWidth] = useState(400);
  const [pixelsPerDay, setPixelsPerDay] = useState(30);
  const [axisHeight, setAxisHeight] = useState(36);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [filters, setFilters] = useState<Filters>(() => readViewFiltersFromUrl().filters);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyTooltip, setCopyTooltip] = useState<"idle" | "copied">("idle");
  const [snapMode, setSnapMode] = useState<"day" | "hour">(() =>
    new URLSearchParams(window.location.search).get("snap") === "hour" ? "hour" : "day",
  );

  const [toolbarSlot, setToolbarSlot] = useState<Element | null>(null);
  const [filterSlot, setFilterSlot] = useState<Element | null>(null);
  const [burndownIncludePRs, setBurndownIncludePRs] = useState(false);

  const handleFitToScreen = useCallback(() => {
    const el = trackColRef.current;
    if (!el) { return; }
    const { totalDays } = stateRef.current;
    setPixelsPerDay(Math.max(4, Math.min(200, el.clientWidth / totalDays)));
  }, []);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackColRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ pixelsPerDay, totalDays: 0, trackWidth: 0 });
  const pendingScrollRef = useRef<number | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const milestoneColorMap = useMemo(() => new Map(milestones.map((m) => [m.number, m.color])), [milestones]);
  const isMultiMilestone = milestones.length > 1;
  const title =
    milestones.length === 0
      ? "Milestone"
      : milestones.length === 1
        ? milestones[0]!.title
        : milestones.length === 2
          ? `${milestones[0]!.title} + ${milestones[1]!.title}`
          : `${milestones.length} milestones`;

  const { closedIssues, openIssues, prItems, mergedPRs } = useMemo(() => {
    const issueItems = items.filter((i) => i.type === "issue");
    const prItems = items.filter((i) => i.type === "pr");
    const closedIssues = issueItems.filter((i) => i.closedAt);
    const openIssues = issueItems.filter((i) => !i.closedAt);
    const mergedPRs = prItems.filter((i) => i.mergedAt);
    return { prItems, closedIssues, openIssues, mergedPRs };
  }, [items]);

  const filteredItems = useMemo(() => applyFilters(items, filters), [items, filters]);

  const counts = useMemo(
    () => ({
      openIssues: openIssues.length,
      closedIssues: closedIssues.length,
      openPRs: prItems.filter((i) => !i.mergedAt && !i.closedAt).length,
      mergedPRs: mergedPRs.length,
      closedPRs: prItems.filter((i) => !i.mergedAt && !!i.closedAt).length,
    }),
    [openIssues, closedIssues, prItems, mergedPRs],
  );

  const sortedItems = useMemo(
    () => [...filteredItems].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [filteredItems],
  );

  // Keep filter params in URL in sync (view param is owned by App)
  useEffect(() => {
    syncFiltersToUrl(filters);
  }, [filters]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (snapMode === "hour") { p.set("snap", "hour"); } else { p.delete("snap"); }
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [snapMode]);

  // Read portal target nodes after mount — querying the DOM inline during
  // render returns null on first paint because sibling components haven't
  // been committed yet. useLayoutEffect runs synchronously after commit, so
  // the elements are guaranteed to exist by the time the second paint fires.
  useLayoutEffect(() => {
    setToolbarSlot(document.getElementById("timeline-toolbar"));
    setFilterSlot(document.getElementById("filter-bar-slot"));
  }, []);

  useEffect(() => () => {
    dragCleanupRef.current?.();
  }, []);

  useEffect(() => {
    const el = axisRef.current;
    if (!el) {return;}
    const measure = () => {
      const { height } = el.getBoundingClientRect();
      const marginBottom = parseFloat(getComputedStyle(el).marginBottom) || 0;
      setAxisHeight(height + marginBottom);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  useEffect(() => {
    if (view !== "Gantt") { return; }
    const el = trackColRef.current;
    if (!el || items.length === 0) { setPixelsPerDay(30); return; }
    const allTs = items.flatMap((item) => {
      const end = itemEndDate(item);
      return [new Date(item.createdAt).getTime(), ...(end ? [new Date(end).getTime()] : [])];
    });
    // Mirror the trackWidth useMemo exactly so the initial zoom fills the column:
    // midnight-snap min, and only extend to today when there are open items.
    const rawMin = Math.min(...allTs);
    const min = new Date(new Date(rawMin).toISOString().slice(0, 10)).getTime();
    const hasOpen = items.some((item) => !itemEndDate(item));
    const max = hasOpen ? Math.max(...allTs, Date.now()) : Math.max(...allTs) + 3 * MS;
    const days = Math.max(1, (max - min) / MS);
    setPixelsPerDay(Math.max(4,Math.min(200, el.clientWidth / days)));
  }, [items, view]);

  // Non-passive wheel listener so we can call preventDefault for vertical scroll-zoom
  useEffect(() => {
    const el = trackColRef.current;
    if (!el) {return;}
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {return;}
      e.preventDefault();
      const { pixelsPerDay: ppd, totalDays: td, trackWidth: tw } = stateRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newPpd = Math.min(200, Math.max(4,ppd * factor));
      const newTrackWidth = Math.max(500, Math.round(td * newPpd));
      const cursorX = e.clientX - el.getBoundingClientRect().left;
      const fraction = tw > 0 ? (cursorX + el.scrollLeft) / tw : 0;
      pendingScrollRef.current = Math.max(0, fraction * newTrackWidth - cursorX);
      setPixelsPerDay(newPpd);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view]);

  useEffect(() => {
    if (pendingScrollRef.current !== null && trackColRef.current) {
      trackColRef.current.scrollLeft = pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [pixelsPerDay]);

  const visibleFormats = useMemo(() => formatsForView(view), [view]);

  const handleExport = useCallback(
    async (fmt: ExportFormat) => {
      setExportAnchor(null);
      setExporting(fmt);
      try {
        if (view === "Review Wait") {
          if      (fmt === "CSV")                {exportReviewWaitCSV(filteredItems, title, milestones);}
          else if (fmt === "Markdown")           {exportReviewWaitMarkdown(filteredItems, title, milestones);}
          else if (fmt === "XLSX")               {await exportReviewWaitXLSX(filteredItems, title, milestones);}
          else if (fmt === "PDF")                {await exportReviewWaitPDF(filteredItems, title, milestones);}
          else if (fmt === "PNG — Current view") {await exportPNG(wrapperRef.current!, trackColRef.current, title, "current");}
        } else if (fmt === "SVG")                {exportSVG(wrapperRef.current!, title);}
        else if (fmt === "CSV")                  {exportCSV(filteredItems, title);}
        else if (fmt === "Markdown")             {exportMarkdown(filteredItems, title);}
        else if (fmt === "XLSX")                 {await exportXLSX(filteredItems, title);}
        else if (fmt === "PNG — Current view")   {await exportPNG(wrapperRef.current!, trackColRef.current, title, "current");}
        else if (fmt === "PNG — Full timeline")  {await exportPNG(wrapperRef.current!, trackColRef.current, title, "full");}
        else if (fmt === "PDF") {
          if (view === "Gantt")          {await exportGanttPDF(wrapperRef.current!, trackColRef.current, title);}
          else if (CHART_VIEWS.has(view)){await exportChartPDF(wrapperRef.current!, title);}
          else                           {await exportPDF(filteredItems, title);}
        }
      } catch (e) {
        console.error(`Export ${fmt} failed:`, e);
        setExportError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setExporting(null);
      }
    },
    [filteredItems, title, view],
  );

  const allTimestamps = useMemo(
    () =>
      filteredItems.flatMap((item) => {
        const end = itemEndDate(item);
        const ts = [new Date(item.createdAt).getTime()];
        if (end) {ts.push(new Date(end).getTime());}
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
    const totalMs = max - min || 1;
    const totalDays = totalMs / MS;
    return {
      todayMs: now,
      minTime: min,
      totalMs,
      totalDays,
      trackWidth: Math.max(500, Math.floor(totalDays * pixelsPerDay)),
    };
  }, [allTimestamps, filteredItems, pixelsPerDay, snapMode]);

  // Keep ref values current for the wheel-zoom handler without adding them to its deps
  useLayoutEffect(() => {
    stateRef.current = { pixelsPerDay, totalDays, trackWidth };
  }, [pixelsPerDay, totalDays, trackWidth]);

  const handleResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setLabelWidth((w) => Math.min(800, w + 10)); }
    else if (e.key === "ArrowLeft")  { e.preventDefault(); setLabelWidth((w) => Math.max(200, w - 10)); }
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

  if (items.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          No items found in this milestone.
        </Typography>
      </Paper>
    );
  }

  const noFilteredItems = filteredItems.length === 0;

  const toolbar = (
    <Stack direction="row" gap={1} alignItems="center" data-export-exclude>
      <Button
        variant="outlined"
        size="small"
        onClick={(e) => setExportAnchor(e.currentTarget)}
        disabled={exporting !== null}
      >
        {exporting ? `Exporting ${exporting}…` : "Export ▾"}
      </Button>
      <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
        {visibleFormats.map((fmt) => (
          <MenuItem key={fmt} dense onClick={() => handleExport(fmt)}>
            {fmt}
          </MenuItem>
        ))}
      </Menu>

      <Tooltip
        title={copyTooltip === "copied" ? "Copied!" : "Copy shareable link"}
        placement="bottom"
        onClose={() => setCopyTooltip("idle")}
      >
        <Button
          variant="outlined"
          size="small"
          aria-label="Copy shareable link to clipboard"
          onClick={() => {
            void navigator.clipboard
              .writeText(window.location.href)
              .then(() => { setCopyTooltip("copied"); })
              .catch(() => { setExportError("Could not copy link — please copy it from the address bar."); });
          }}
        >
          Share
        </Button>
      </Tooltip>
    </Stack>
  );

  return (
    <>
    {toolbarSlot && createPortal(toolbar, toolbarSlot)}
    {filterSlot && createPortal(
      <FilterBar
        variant="toolbar"
        items={items}
        filters={filters}
        counts={counts}
        onChange={setFilters}
        colorblindMode={colorblindMode}
      />,
      filterSlot,
    )}
    <Paper sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }} ref={wrapperRef}>
      <StatsBar items={filteredItems} milestones={milestones} view={view} colorblindMode={colorblindMode} title={title} />

      {noFilteredItems && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No items match the current filters.
        </Typography>
      )}
      {!noFilteredItems && view === "Burndown" && (
        <>
          <FormControlLabel
            control={<Checkbox size="small" checked={burndownIncludePRs} onChange={(e) => setBurndownIncludePRs(e.target.checked)} />}
            label="Include PRs"
            sx={{ alignSelf: "flex-start", ml: 0 }}
          />
          <Burndown items={filteredItems} milestones={milestones} highlightWeekends={highlightWeekends} colorblindMode={colorblindMode} includePRs={burndownIncludePRs} />
        </>
      )}
      {!noFilteredItems && view === "Cycle Time" && <CycleTime items={filteredItems} milestones={milestones} highlightWeekends={highlightWeekends} colorblindMode={colorblindMode} />}
      {!noFilteredItems && view === "Velocity" && <Velocity items={filteredItems} milestones={milestones} colorblindMode={colorblindMode} />}
      {!noFilteredItems && view === "Cumulative Flow" && <CumulativeFlow items={filteredItems} highlightWeekends={highlightWeekends} colorblindMode={colorblindMode} />}
      {!noFilteredItems && view === "Contributors" && <Contributors items={filteredItems} colorblindMode={colorblindMode} />}
      {!noFilteredItems && view === "Review Wait" && <ReviewWaitList items={filteredItems} milestones={milestones} colorblindMode={colorblindMode} />}
      {!noFilteredItems && view === "List" && <ItemList items={filteredItems} milestones={milestones} colorblindMode={colorblindMode} />}

      {!noFilteredItems && view === "Gantt" && (
        <GanttView
          sortedItems={sortedItems}
          milestones={milestones}
          isMultiMilestone={isMultiMilestone}
          milestoneColorMap={milestoneColorMap}
          hasOpenIssues={openIssues.length > 0}
          labelWidth={labelWidth}
          axisHeight={axisHeight}
          trackWidth={trackWidth}
          minTime={minTime}
          totalMs={totalMs}
          todayMs={todayMs}
          trackColRef={trackColRef}
          axisRef={axisRef}
          onResizeStart={handleResizeStart}
          onResizeKeyDown={handleResizeKeyDown}
          highlightWeekends={highlightWeekends}
          colorblindMode={colorblindMode}
          snapMode={snapMode}
          onSnapModeChange={setSnapMode}
          onFitToScreen={handleFitToScreen}
        />
      )}
    </Paper>

      <Snackbar
        open={exportError !== null}
        autoHideDuration={6000}
        onClose={() => setExportError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setExportError(null)} sx={{ width: "100%" }}>
          {exportError}
        </Alert>
      </Snackbar>
    </>
  );
};

export { Timeline, VIEWS, DEFAULT_VIEW, readViewFiltersFromUrl };
export type { View };
