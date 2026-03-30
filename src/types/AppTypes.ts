/**
 * Application-layer discriminator types — view names, export formats,
 * app lifecycle phases, and shared component handle types.
 */

const VIEWS = [
  "Gantt",
  "Burndown",
  "Cycle Time",
  "Velocity",
  "Cumulative Flow",
  "Contributors",
  "Review Wait",
  "List",
] as const;
type View = typeof VIEWS[number];

const DEFAULT_VIEW: View = "Gantt";

const EXPORT_FORMATS = [
  "CSV",
  "XLSX",
  "Markdown",
  "PNG — Current view",
  "PNG — Full timeline",
  "PDF",
  "SVG",
] as const;
type ExportFormat = typeof EXPORT_FORMATS[number];

type AppPhase = "splash" | "authenticating" | "dashboard";

/** Ref handle exposed by GanttView for export coordination. */
type GanttHandle = { trackColEl: HTMLDivElement | null };

type ForecastResult = {
  projectedDate: Date;
  /** "regression" = recent trend; "velocity" = overall average close rate */
  method: "regression" | "velocity";
  openCount: number;
  closedCount: number;
  totalDays: number;
};

export { DEFAULT_VIEW, EXPORT_FORMATS, VIEWS };
export type { AppPhase, ExportFormat, ForecastResult, GanttHandle, View };
