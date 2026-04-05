import type { ReactElement } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render } from "@testing-library/react";
import { ViewOptionsMenu } from "../ViewOptionsMenu";

const theme = createTheme();
const wrap = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const defaultIncludePRs = {
  burndown: false,
  cumulativeFlow: false,
  cycleTime: false,
  velocity: false,
};

describe("ViewOptionsMenu — visibility", () => {
  it("renders nothing for views with no options", () => {
    for (const view of ["Gantt", "List", "Review Wait", "Contributors"] as const) {
      const { container, unmount } = wrap(
        <ViewOptionsMenu
          view={view}
          includePRs={defaultIncludePRs}
          showPercentiles={false}
          onShowPercentilesChange={() => {}}
          dispatch={() => {}}
        />,
      );

      expect(container.firstChild).toBeNull();

      unmount();
    }
  });

  it("renders the View options button for chart views that have options", () => {
    for (const view of ["Burndown", "Cycle Time", "Velocity", "Cumulative Flow"] as const) {
      const { getByRole, unmount } = wrap(
        <ViewOptionsMenu
          view={view}
          includePRs={defaultIncludePRs}
          showPercentiles={false}
          onShowPercentilesChange={() => {}}
          dispatch={() => {}}
        />,
      );

      expect(getByRole("button", { name: /view options/i })).toBeInTheDocument();

      unmount();
    }
  });
});

describe("ViewOptionsMenu — menu items", () => {
  it("shows Include PRs option for Burndown", () => {
    const { getByRole, getByText } = wrap(
      <ViewOptionsMenu
        view="Burndown"
        includePRs={defaultIncludePRs}
        showPercentiles={false}
        onShowPercentilesChange={() => {}}
        dispatch={() => {}}
      />,
    );

    fireEvent.click(getByRole("button", { name: /view options/i }));

    expect(getByText("Include PRs")).toBeInTheDocument();
  });

  it("shows Include PRs and percentiles options for Cycle Time", () => {
    const { getByRole, getByText } = wrap(
      <ViewOptionsMenu
        view="Cycle Time"
        includePRs={defaultIncludePRs}
        showPercentiles={false}
        onShowPercentilesChange={() => {}}
        dispatch={() => {}}
      />,
    );

    fireEvent.click(getByRole("button", { name: /view options/i }));

    expect(getByText("Include PRs")).toBeInTheDocument();
    expect(getByText("Show percentiles (p75 / p90)")).toBeInTheDocument();
  });

  it("calls dispatch when Include PRs is toggled", () => {
    const dispatch = vi.fn();

    const { getByRole, getByText } = wrap(
      <ViewOptionsMenu
        view="Velocity"
        includePRs={defaultIncludePRs}
        showPercentiles={false}
        onShowPercentilesChange={() => {}}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: /view options/i }));
    fireEvent.click(getByText("Include PRs"));

    expect(dispatch).toHaveBeenCalledWith({ type: "SET_INCLUDE_PRS", chart: "velocity", value: true });
  });

  it("calls onShowPercentilesChange when percentiles option is toggled", () => {
    const onToggle = vi.fn();

    const { getByRole, getByText } = wrap(
      <ViewOptionsMenu
        view="Cycle Time"
        includePRs={defaultIncludePRs}
        showPercentiles={false}
        onShowPercentilesChange={onToggle}
        dispatch={() => {}}
      />,
    );

    fireEvent.click(getByRole("button", { name: /view options/i }));
    fireEvent.click(getByText("Show percentiles (p75 / p90)"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
