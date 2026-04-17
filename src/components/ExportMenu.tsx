import type { ExportFormat, GanttHandle, View } from "../types/AppTypes";
import type { MilestoneMeta, TimelineItem } from "../types/GitHubTypes";
import type { FunctionComponent, RefObject } from "react";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import { useCallback, useMemo, useState } from "react";
import { exportCSV, exportChartPDF, exportGanttPDF, exportMarkdown, exportPDF, exportPNG, exportReviewWaitCSV, exportReviewWaitMarkdown, exportReviewWaitPDF, exportReviewWaitXLSX, exportSVG, exportXLSX } from "../utils/export";

// Only show export formats whose output visually matches what is on screen:
//   Gantt       — PNG (current + full) + PDF (full Gantt embedded as image in PDF)
//   Chart views — PNG (current) + PDF (chart image) + SVG (true vector; extracted directly
//                 from the <svg aria-hidden> element — editable in Illustrator/Inkscape)
//   Review Wait — CSV / XLSX / Markdown / PDF (data table) + PNG (captures table + wait bars)
//   List        — CSV / XLSX / Markdown / PDF (data table) + PNG (captures visible table)
const CHART_VIEWS = new Set<View>(["Burndown", "Cycle Time", "Velocity", "Cumulative Flow", "Contributors"]);

const formatsForView = (v: View): ExportFormat[] => {
  if (v === "Gantt")       { return ["PNG — Current view", "PNG — Full timeline", "PDF"]; }
  if (v === "List")        { return ["CSV", "XLSX", "Markdown", "PNG — Current view", "PDF"]; }
  if (v === "Review Wait") { return ["CSV", "XLSX", "Markdown", "PNG — Current view", "PDF"]; }
  // Chart views (Burndown, Cycle Time, Velocity, Cumulative Flow, Contributors)
  return ["PNG — Current view", "PDF", "SVG"];
};

type Props = {
  view: View;
  filteredItems: TimelineItem[];
  milestones: MilestoneMeta[];
  title: string;
  wrapperRef: RefObject<HTMLDivElement | null>;
  ganttRef: RefObject<GanttHandle | null>;
  colorblindMode: boolean;
};

const ExportMenu: FunctionComponent<Props> = ({ view, filteredItems, milestones, title, wrapperRef, ganttRef, colorblindMode }) => {
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const visibleFormats = useMemo(() => formatsForView(view), [view]);

  const handleExport = useCallback(
    async (fmt: ExportFormat) => {
      setExportAnchor(null);
      setExporting(fmt);
      const container = wrapperRef.current;
      if (!container) {
        setExportError("Export container not mounted");
        setExporting(null);
        return;
      }
      try {
        if (view === "Review Wait") {
          if      (fmt === "CSV")                { exportReviewWaitCSV(filteredItems, title, milestones); }
          else if (fmt === "Markdown")           { exportReviewWaitMarkdown(filteredItems, title, milestones); }
          else if (fmt === "XLSX")               { await exportReviewWaitXLSX(filteredItems, title, milestones, colorblindMode); }
          else if (fmt === "PDF")                { await exportReviewWaitPDF(filteredItems, title, milestones); }
          else if (fmt === "PNG — Current view") { await exportPNG(container, ganttRef.current?.trackColEl ?? null, title, "current"); }
        } else if (fmt === "SVG")                { exportSVG(container, title); }
        else if (fmt === "CSV")                  { exportCSV(filteredItems, title, milestones); }
        else if (fmt === "Markdown")             { exportMarkdown(filteredItems, title, milestones); }
        else if (fmt === "XLSX")                 { await exportXLSX(filteredItems, title, milestones, colorblindMode); }
        else if (fmt === "PNG — Current view")   { await exportPNG(container, ganttRef.current?.trackColEl ?? null, title, "current"); }
        else if (fmt === "PNG — Full timeline")  { await exportPNG(container, ganttRef.current?.trackColEl ?? null, title, "full"); }
        else if (fmt === "PDF") {
          if (view === "Gantt")           { await exportGanttPDF(container, ganttRef.current?.trackColEl ?? null, title); }
          else if (CHART_VIEWS.has(view)) { await exportChartPDF(container, title); }
          else                            { await exportPDF(filteredItems, title, milestones); }
        }
      } catch (e) {
        console.error(`Export ${fmt} failed:`, e);
        setExportError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setExporting(null);
      }
    },
    [filteredItems, milestones, title, view, wrapperRef, ganttRef, colorblindMode],
  );

  return (
    <>
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

export { ExportMenu };
