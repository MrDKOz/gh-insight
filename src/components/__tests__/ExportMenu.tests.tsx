import type { GanttHandle } from "../../types/AppTypes";
import type { ReactElement } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { ExportMenu } from "../ExportMenu";

const theme = createTheme();
const wrap = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const noItems = [] as Parameters<typeof ExportMenu>[0]["filteredItems"];
const noMilestones = [] as Parameters<typeof ExportMenu>[0]["milestones"];

const defaultProps = {
  filteredItems: noItems,
  milestones: noMilestones,
  title: "Sprint 1",
  wrapperRef: createRef<HTMLDivElement>(),
  ganttRef: createRef<GanttHandle>(),
} as const;

describe("ExportMenu — format options per view", () => {
  it("shows PNG and PDF options for Gantt view", () => {
    const { getByRole, getByText } = wrap(
      <ExportMenu {...defaultProps} view="Gantt" />,
    );

    fireEvent.click(getByRole("button", { name: /export/i }));

    expect(getByText("PNG — Current view")).toBeInTheDocument();
    expect(getByText("PNG — Full timeline")).toBeInTheDocument();
    expect(getByText("PDF")).toBeInTheDocument();
  });

  it("shows CSV, XLSX, Markdown, PNG and PDF options for List view", () => {
    const { getByRole, getByText } = wrap(
      <ExportMenu {...defaultProps} view="List" />,
    );

    fireEvent.click(getByRole("button", { name: /export/i }));

    expect(getByText("CSV")).toBeInTheDocument();
    expect(getByText("XLSX")).toBeInTheDocument();
    expect(getByText("Markdown")).toBeInTheDocument();
    expect(getByText("PNG — Current view")).toBeInTheDocument();
    expect(getByText("PDF")).toBeInTheDocument();
  });

  it("shows PNG, PDF, and SVG options for chart views", () => {
    for (const view of ["Burndown", "Cycle Time", "Velocity", "Cumulative Flow", "Contributors"] as const) {
      const { getByRole, getByText, unmount } = wrap(
        <ExportMenu {...defaultProps} view={view} />,
      );

      fireEvent.click(getByRole("button", { name: /export/i }));

      expect(getByText("PNG — Current view")).toBeInTheDocument();
      expect(getByText("PDF")).toBeInTheDocument();
      expect(getByText("SVG")).toBeInTheDocument();

      unmount();
    }
  });

  it("does not show SVG for Gantt view", () => {
    const { getByRole, queryByText } = wrap(
      <ExportMenu {...defaultProps} view="Gantt" />,
    );

    fireEvent.click(getByRole("button", { name: /export/i }));

    expect(queryByText("SVG")).not.toBeInTheDocument();
  });

  it("does not show PNG Full timeline for non-Gantt views", () => {
    const { getByRole, queryByText } = wrap(
      <ExportMenu {...defaultProps} view="Burndown" />,
    );

    fireEvent.click(getByRole("button", { name: /export/i }));

    expect(queryByText("PNG — Full timeline")).not.toBeInTheDocument();
  });
});

describe("ExportMenu — smoke", () => {
  it("renders Export button without crashing", () => {
    const { getByRole } = wrap(
      <ExportMenu {...defaultProps} view="Gantt" />,
    );

    expect(getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("shows an error snackbar when the export container is not mounted", () => {
    const { getByRole, getByText } = wrap(
      <ExportMenu {...defaultProps} view="List" />,
    );

    fireEvent.click(getByRole("button", { name: /export/i }));
    fireEvent.click(getByText("CSV"));

    expect(getByText("Export container not mounted")).toBeInTheDocument();
  });
});
