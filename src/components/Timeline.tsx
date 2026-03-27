import type { MilestoneMeta, TimelineItem } from "../types";
import type { Filters } from "./FilterBar";
import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Burndown } from "../charts/Burndown";
import { Contributors } from "../charts/Contributors";
import { CumulativeFlow } from "../charts/CumulativeFlow";
import { CycleTime } from "../charts/CycleTime";
import { Velocity } from "../charts/Velocity";
import { exportCSV, exportChartPDF, exportMarkdown, exportPDF, exportPNG, exportXLSX } from "../utils/export";
import { MS, itemEndDate } from "../utils/utils";
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
};

type ExportFormat = "CSV" | "XLSX" | "Markdown" | "PNG — Current view" | "PNG — Full timeline" | "PDF";

// Only show export formats whose output visually matches what is on screen:
//   Gantt       — PNG only; a data table is not a Gantt chart
//   Chart views — PNG (current) + PDF (embeds the chart as an image)
//   List        — CSV / XLSX / Markdown / PDF; the list IS a data table so all four match
const CHART_VIEWS = new Set<View>(["Burndown", "Cycle Time", "Velocity", "Cumulative Flow", "Contributors", "Review Wait"]);

const formatsForView = (v: View): ExportFormat[] => {
  if (v === "Gantt") {return ["PNG — Current view", "PNG — Full timeline"];}
  if (v === "List")  {return ["CSV", "XLSX", "Markdown", "PDF"];}
  return ["PNG — Current view", "PDF"];
};

type View = "Gantt" | "Burndown" | "Cycle Time" | "Velocity" | "Cumulative Flow" | "Contributors" | "Review Wait" | "List";
const VIEWS: View[] = ["Gantt", "Burndown", "Cycle Time", "Velocity", "Cumulative Flow", "Contributors", "Review Wait", "List"];
const DEFAULT_VIEW: View = "Gantt";

// ---------------------------------------------------------------------------
// URL state — view + filters are serialised into search params so the full
// app state (owner/repo/milestones come from App) is captured in one URL.
// ---------------------------------------------------------------------------

const readViewFiltersFromUrl = (): { view: View; filters: Filters } => {
  const p = new URLSearchParams(window.location.search);
  const rawView = p.get("v") ?? "";
  const view: View = (VIEWS as readonly string[]).includes(rawView) ? (rawView as View) : DEFAULT_VIEW;

  const hide = new Set((p.get("hide") ?? "").split(",").filter(Boolean));
  const rawRole = p.get("pr");

  const filters: Filters = {
    createdStart:     p.get("cs") ?? "",
    createdEnd:       p.get("ce") ?? "",
    closedStart:      p.get("xs") ?? "",
    closedEnd:        p.get("xe") ?? "",
    showOpenIssues:   !hide.has("oi"),
    showClosedIssues: !hide.has("ci"),
    showOpenPRs:      !hide.has("op"),
    showMergedPRs:    !hide.has("mp"),
    showClosedPRs:    !hide.has("cp"),
    // Use "|" as separator so label names containing commas are safe
    activeLabels: p.get("lb") ? p.get("lb")!.split("|").filter(Boolean) : [],
    activePeople: p.get("pp") ? p.get("pp")!.split("|").filter(Boolean) : [],
    peopleRole:   rawRole === "a" ? "author" : rawRole === "s" ? "assignees" : "either",
  };
  return { view, filters };
};

const syncViewFiltersToUrl = (view: View, filters: Filters): void => {
  // Read the current params so App-owned keys (owner/repo/milestones/demo) are preserved
  const p = new URLSearchParams(window.location.search);

  if (view !== DEFAULT_VIEW) {p.set("v", view);} else {p.delete("v");}

  if (filters.createdStart) {p.set("cs", filters.createdStart);} else {p.delete("cs");}
  if (filters.createdEnd)   {p.set("ce", filters.createdEnd);}   else {p.delete("ce");}
  if (filters.closedStart)  {p.set("xs", filters.closedStart);}  else {p.delete("xs");}
  if (filters.closedEnd)    {p.set("xe", filters.closedEnd);}    else {p.delete("xe");}

  const hidden: string[] = [];
  if (!filters.showOpenIssues)   {hidden.push("oi");}
  if (!filters.showClosedIssues) {hidden.push("ci");}
  if (!filters.showOpenPRs)      {hidden.push("op");}
  if (!filters.showMergedPRs)    {hidden.push("mp");}
  if (!filters.showClosedPRs)    {hidden.push("cp");}
  if (hidden.length > 0) {p.set("hide", hidden.join(","));} else {p.delete("hide");}

  if (filters.activeLabels.length > 0) {p.set("lb", filters.activeLabels.join("|"));} else {p.delete("lb");}
  if (filters.activePeople.length > 0) {p.set("pp", filters.activePeople.join("|"));} else {p.delete("pp");}

  const roleAbbr = filters.peopleRole === "author" ? "a" : filters.peopleRole === "assignees" ? "s" : null;
  if (roleAbbr) {p.set("pr", roleAbbr);} else {p.delete("pr");}

  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
};

const Timeline: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, colorblindMode }) => {
  const [labelWidth, setLabelWidth] = useState(400);
  const [pixelsPerDay, setPixelsPerDay] = useState(30);
  const [axisHeight, setAxisHeight] = useState(36);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [view, setView] = useState<View>(() => readViewFiltersFromUrl().view);
  const [viewAnchor, setViewAnchor] = useState<HTMLElement | null>(null);
  const [filters, setFilters] = useState<Filters>(() => readViewFiltersFromUrl().filters);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyTooltip, setCopyTooltip] = useState<"idle" | "copied">("idle");

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

  const { issueItems, closedIssues, openIssues, prItems, mergedPRs } = useMemo(() => {
    const issueItems = items.filter((i) => i.type === "issue");
    const prItems = items.filter((i) => i.type === "pr");
    const closedIssues = issueItems.filter((i) => i.closedAt);
    const openIssues = issueItems.filter((i) => !i.closedAt);
    const mergedPRs = prItems.filter((i) => i.mergedAt);
    return { issueItems, prItems, closedIssues, openIssues, mergedPRs };
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

  const filteredCompletedItems = useMemo(
    () => filteredItems.filter((i) => (i.type === "issue" ? !!i.closedAt : !!(i.mergedAt || i.closedAt))),
    [filteredItems],
  );

  const sortedItems = useMemo(
    () => [...filteredItems].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [filteredItems],
  );

  // Keep URL in sync with view + filter state
  useEffect(() => {
    syncViewFiltersToUrl(view, filters);
  }, [view, filters]);

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
    setPixelsPerDay(30);
  }, [items]);

  // Non-passive wheel listener so we can call preventDefault for vertical scroll-zoom
  useEffect(() => {
    const el = trackColRef.current;
    if (!el) {return;}
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {return;}
      e.preventDefault();
      const { pixelsPerDay: ppd, totalDays: td, trackWidth: tw } = stateRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newPpd = Math.min(200, Math.max(3, ppd * factor));
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
        if (fmt === "CSV")                  {exportCSV(filteredCompletedItems, title);}
        else if (fmt === "Markdown")        {exportMarkdown(filteredCompletedItems, title);}
        else if (fmt === "XLSX")            {await exportXLSX(filteredCompletedItems, title);}
        else if (fmt === "PNG — Current view")
          {await exportPNG(wrapperRef.current!, trackColRef.current, title, "current");}
        else if (fmt === "PNG — Full timeline")
          {await exportPNG(wrapperRef.current!, trackColRef.current, title, "full");}
        else if (fmt === "PDF") {
          if (CHART_VIEWS.has(view)) {await exportChartPDF(wrapperRef.current!, title);}
          else                       {await exportPDF(filteredCompletedItems, title);}
        }
      } catch (e) {
        console.error(`Export ${fmt} failed:`, e);
        setExportError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setExporting(null);
      }
    },
    [filteredCompletedItems, title, view],
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
    const min = new Date(new Date(Math.min(...allTimestamps)).toISOString().slice(0, 10)).getTime();
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
      trackWidth: Math.max(500, Math.round(totalDays * pixelsPerDay)),
    };
  }, [allTimestamps, filteredItems, pixelsPerDay]);

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

  return (
    <>
    <Paper sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }} ref={wrapperRef}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {issueItems.length} issue{issueItems.length !== 1 ? "s" : ""} ({closedIssues.length} closed),{" "}
            {prItems.length} PR{prItems.length !== 1 ? "s" : ""} ({mergedPRs.length} merged)
          </Typography>
        </Box>

        <Stack direction="row" gap={1} alignItems="center" flexShrink={0} data-export-exclude>
          <Button variant="outlined" size="small" onClick={(e) => setViewAnchor(e.currentTarget)}>
            {view} ▾
          </Button>
          <Menu anchorEl={viewAnchor} open={Boolean(viewAnchor)} onClose={() => setViewAnchor(null)}>
            {VIEWS.map((v) => (
              <MenuItem
                key={v}
                selected={v === view}
                dense
                onClick={() => {
                  setView(v);
                  setViewAnchor(null);
                }}
              >
                {v}
              </MenuItem>
            ))}
          </Menu>

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
                void navigator.clipboard.writeText(window.location.href).then(() => {
                  setCopyTooltip("copied");
                });
              }}
            >
              Share
            </Button>
          </Tooltip>
        </Stack>
      </Stack>

      <StatsBar items={filteredItems} view={view} colorblindMode={colorblindMode} />

      <FilterBar items={items} filters={filters} counts={counts} onChange={setFilters} colorblindMode={colorblindMode} />

      {noFilteredItems && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No items match the current filters.
        </Typography>
      )}
      {!noFilteredItems && view === "Burndown" && <Burndown items={filteredItems} milestones={milestones} highlightWeekends={highlightWeekends} colorblindMode={colorblindMode} />}
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

export { Timeline };
