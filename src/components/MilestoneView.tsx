import type { BankHoliday } from "../api/bankHolidayApi";
import type { Action } from "../state/appReducer";
import type { ExportFormat, GanttHandle, View  } from "../types/AppTypes";
import type { Filters } from "../types/FilterTypes";

import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { Dispatch, FunctionComponent } from "react";
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
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Burndown } from "../charts/Burndown";
import { Contributors } from "../charts/Contributors";
import { CumulativeFlow } from "../charts/CumulativeFlow";
import { CycleTime } from "../charts/CycleTime";
import { GanttView } from "../charts/GanttView";
import { Velocity } from "../charts/Velocity";

import { applyFilters } from "../types/FilterTypes";
import { exportCSV, exportChartPDF, exportGanttPDF, exportMarkdown, exportPDF, exportPNG, exportReviewWaitCSV, exportReviewWaitMarkdown, exportReviewWaitPDF, exportReviewWaitXLSX, exportSVG, exportXLSX } from "../utils/export";
import { FilterBar } from "./FilterBar";
import { ItemList } from "./ItemList";
import { ReviewWaitList } from "./ReviewWaitList";
import { StatsBar } from "./StatsBar";

type Props = {
  items: TimelineItem[];
  milestones: MilestoneMeta[];
  highlightWeekends: boolean;
  bankHolidays: BankHoliday[];
  colorblindMode: boolean;
  view: View;
  filters: Filters;
  includePRs: { burndown: boolean; cumulativeFlow: boolean; cycleTime: boolean; velocity: boolean };
  dispatch: Dispatch<Action>;
};

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

const MilestoneView: FunctionComponent<Props> = ({ items, milestones, highlightWeekends, bankHolidays, colorblindMode, view, filters, includePRs, dispatch }) => {
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyTooltip, setCopyTooltip] = useState<"idle" | "copied">("idle");

  const [toolbarSlot, setToolbarSlot] = useState<Element | null>(null);
  const [filterSlot, setFilterSlot] = useState<Element | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const ganttRef = useRef<GanttHandle>(null);

  const title =
    milestones.length === 0
      ? "Milestone"
      : milestones.length === 1
        ? (milestones[0]?.title ?? "Milestone")
        : milestones.length === 2
          ? `${milestones[0]?.title ?? ""} + ${milestones[1]?.title ?? ""}`
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

  const handleFiltersChange = useCallback((newFilters: Filters) => {
    dispatch({ type: "SET_FILTERS", filters: newFilters });
  }, [dispatch]);

  const toggleBurndownPRs     = useCallback(() => dispatch({ type: "SET_INCLUDE_PRS", chart: "burndown",       value: !includePRs.burndown       }), [dispatch, includePRs.burndown]);
  const toggleCycleTimePRs    = useCallback(() => dispatch({ type: "SET_INCLUDE_PRS", chart: "cycleTime",      value: !includePRs.cycleTime      }), [dispatch, includePRs.cycleTime]);
  const toggleVelocityPRs     = useCallback(() => dispatch({ type: "SET_INCLUDE_PRS", chart: "velocity",       value: !includePRs.velocity       }), [dispatch, includePRs.velocity]);
  const toggleCumulativeFlowPRs = useCallback(() => dispatch({ type: "SET_INCLUDE_PRS", chart: "cumulativeFlow", value: !includePRs.cumulativeFlow }), [dispatch, includePRs.cumulativeFlow]);

  // Read portal target nodes after mount — querying the DOM inline during
  // render returns null on first paint because sibling components haven't
  // been committed yet. useLayoutEffect runs synchronously after commit, so
  // the elements are guaranteed to exist by the time the second paint fires.
  useLayoutEffect(() => {
    setToolbarSlot(document.getElementById("timeline-toolbar"));
    setFilterSlot(document.getElementById("filter-bar-slot"));
  }, []);

  const visibleFormats = useMemo(() => formatsForView(view), [view]);

  const handleExport = useCallback(
    async (fmt: ExportFormat) => {
      setExportAnchor(null);
      setExporting(fmt);
      try {
        const container = wrapperRef.current;
        if (!container) { throw new Error("Export container not mounted"); }
        if (view === "Review Wait") {
          if      (fmt === "CSV")                {exportReviewWaitCSV(filteredItems, title, milestones);}
          else if (fmt === "Markdown")           {exportReviewWaitMarkdown(filteredItems, title, milestones);}
          else if (fmt === "XLSX")               {await exportReviewWaitXLSX(filteredItems, title, milestones);}
          else if (fmt === "PDF")                {await exportReviewWaitPDF(filteredItems, title, milestones);}
          else if (fmt === "PNG — Current view") {await exportPNG(container, ganttRef.current?.trackColEl ?? null, title, "current");}
        } else if (fmt === "SVG")                {exportSVG(container, title);}
        else if (fmt === "CSV")                  {exportCSV(filteredItems, title);}
        else if (fmt === "Markdown")             {exportMarkdown(filteredItems, title);}
        else if (fmt === "XLSX")                 {await exportXLSX(filteredItems, title);}
        else if (fmt === "PNG — Current view")   {await exportPNG(container, ganttRef.current?.trackColEl ?? null, title, "current");}
        else if (fmt === "PNG — Full timeline")  {await exportPNG(container, ganttRef.current?.trackColEl ?? null, title, "full");}
        else if (fmt === "PDF") {
          if (view === "Gantt")          {await exportGanttPDF(container, ganttRef.current?.trackColEl ?? null, title);}
          else if (CHART_VIEWS.has(view)){await exportChartPDF(container, title);}
          else                           {await exportPDF(filteredItems, title);}
        }
      } catch (e) {
        console.error(`Export ${fmt} failed:`, e);
        setExportError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setExporting(null);
      }
    },
    [filteredItems, milestones, title, view],
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
        onChange={handleFiltersChange}
        colorblindMode={colorblindMode}
      />,
      filterSlot,
    )}
    <Paper sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }} ref={wrapperRef}>
      <StatsBar items={filteredItems} milestones={milestones} view={view} colorblindMode={colorblindMode} />

      {noFilteredItems && (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No items match the current filters.
        </Typography>
      )}
      {!noFilteredItems && view === "Burndown" && (
        <>
          <FormControlLabel control={<Checkbox size="small" checked={includePRs.burndown} onChange={toggleBurndownPRs} />} label="Include PRs" sx={{ alignSelf: "flex-start", ml: 0 }} />
          <Burndown items={filteredItems} milestones={milestones} highlightWeekends={highlightWeekends} bankHolidays={bankHolidays} colorblindMode={colorblindMode} includePRs={includePRs.burndown} />
        </>
      )}
      {!noFilteredItems && view === "Cycle Time" && (
        <>
          <FormControlLabel control={<Checkbox size="small" checked={includePRs.cycleTime} onChange={toggleCycleTimePRs} />} label="Include PRs" sx={{ alignSelf: "flex-start", ml: 0 }} />
          <CycleTime items={filteredItems} milestones={milestones} highlightWeekends={highlightWeekends} bankHolidays={bankHolidays} colorblindMode={colorblindMode} includePRs={includePRs.cycleTime} />
        </>
      )}
      {!noFilteredItems && view === "Velocity" && (
        <>
          <FormControlLabel control={<Checkbox size="small" checked={includePRs.velocity} onChange={toggleVelocityPRs} />} label="Include PRs" sx={{ alignSelf: "flex-start", ml: 0 }} />
          <Velocity items={filteredItems} milestones={milestones} colorblindMode={colorblindMode} includePRs={includePRs.velocity} />
        </>
      )}
      {!noFilteredItems && view === "Cumulative Flow" && (
        <>
          <FormControlLabel control={<Checkbox size="small" checked={includePRs.cumulativeFlow} onChange={toggleCumulativeFlowPRs} />} label="Include PRs" sx={{ alignSelf: "flex-start", ml: 0 }} />
          <CumulativeFlow items={filteredItems} highlightWeekends={highlightWeekends} bankHolidays={bankHolidays} colorblindMode={colorblindMode} includePRs={includePRs.cumulativeFlow} />
        </>
      )}
      {!noFilteredItems && view === "Contributors" && <Contributors items={filteredItems} colorblindMode={colorblindMode} />}
      {!noFilteredItems && view === "Review Wait" && <ReviewWaitList items={filteredItems} milestones={milestones} colorblindMode={colorblindMode} />}
      {!noFilteredItems && view === "List" && <ItemList items={filteredItems} milestones={milestones} colorblindMode={colorblindMode} />}

      {!noFilteredItems && view === "Gantt" && (
        <GanttView
          ref={ganttRef}
          items={items}
          filteredItems={filteredItems}
          milestones={milestones}
          highlightWeekends={highlightWeekends}
          bankHolidays={bankHolidays}
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

export { MilestoneView };
