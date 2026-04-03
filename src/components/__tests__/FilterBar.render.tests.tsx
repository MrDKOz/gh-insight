import type { Filters } from "../../types/FilterTypes";
import type { TimelineItem } from "../../types/GitHubTypes";
import type { ReactElement } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { DEFAULT_FILTERS } from "../../types/FilterTypes";
import { FilterBar } from "../FilterBar";

const theme = createTheme();
const wrap = (ui: ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const closedIssue: TimelineItem = {
  type: "issue", number: 1, title: "Fix bug",
  url: "https://github.com/o/r/issues/1", author: "alice",
  createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-10T00:00:00Z", closedAt: "2025-01-10T00:00:00Z",
  linkedPRs: [], milestoneNumber: 1,
  labels: [{ name: "bug", color: "#d73a4a" }], assignees: [], reopenedCount: 0,
};

const mergedPR: TimelineItem = {
  type: "pr", number: 2, title: "Fix",
  url: "https://github.com/o/r/pull/2", author: "bob",
  createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-10T00:00:00Z", mergedAt: "2025-01-10T00:00:00Z",
  closedAt: "2025-01-10T00:00:00Z", isDraft: false, reviewDecision: "APPROVED", additions: 50, deletions: 10,
  linkedIssue: null, milestoneNumber: 1,
  labels: [], assignees: [], firstReviewAt: null,
};

const counts = { openIssues: 0, closedIssues: 1, openPRs: 0, mergedPRs: 1, closedPRs: 0 };

// Controlled wrapper so we can test state changes
const Controlled = ({ items }: { items: TimelineItem[] }) => {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  return (
    <ThemeProvider theme={theme}>
      <FilterBar
        items={items}
        filters={filters}
        counts={counts}
        onChange={setFilters}
        colorblindMode={false}
      />
    </ThemeProvider>
  );
};

describe("FilterBar — render smoke", () => {
  it("renders date range filters without crashing", () => {
    const { getAllByRole } = wrap(
      <FilterBar
        items={[closedIssue, mergedPR]}
        filters={DEFAULT_FILTERS}
        counts={counts}
        onChange={() => {}}
        colorblindMode={false}
      />,
    );

    const buttons = getAllByRole("button");

    expect(buttons.some((b) => b.textContent?.startsWith("Created"))).toBe(true);
    expect(buttons.some((b) => b.textContent?.startsWith("Closed") && !b.textContent.includes("issues"))).toBe(true);
  });

  it("renders item-type toggle chips for non-zero counts", () => {
    const { getByText } = wrap(
      <FilterBar
        items={[closedIssue, mergedPR]}
        filters={DEFAULT_FILTERS}
        counts={counts}
        onChange={() => {}}
        colorblindMode={false}
      />,
    );

    expect(getByText("Closed issues")).toBeInTheDocument();
    expect(getByText("Merged PRs")).toBeInTheDocument();
  });

  it("does not render a toggle chip for item types with count 0", () => {
    const { queryByText } = wrap(
      <FilterBar
        items={[closedIssue, mergedPR]}
        filters={DEFAULT_FILTERS}
        counts={counts}
        onChange={() => {}}
        colorblindMode={false}
      />,
    );

    expect(queryByText("Open issues")).not.toBeInTheDocument();
    expect(queryByText("Open PRs")).not.toBeInTheDocument();
  });

  it("calls onChange when a toggle chip is clicked", () => {
    const onChange = vi.fn();
    const { getByText } = wrap(
      <FilterBar
        items={[closedIssue, mergedPR]}
        filters={DEFAULT_FILTERS}
        counts={counts}
        onChange={onChange}
        colorblindMode={false}
      />,
    );

    fireEvent.click(getByText("Closed issues"));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showClosedIssues: false }));
  });

  it("reset button is absent when no filters are active", () => {
    const { queryByRole } = wrap(
      <FilterBar
        items={[closedIssue, mergedPR]}
        filters={DEFAULT_FILTERS}
        counts={counts}
        onChange={() => {}}
        colorblindMode={false}
      />,
    );

    expect(queryByRole("button", { name: "Reset all filters" })).not.toBeInTheDocument();
  });

  it("reset button appears when a filter is active and resets to defaults on click", () => {
    const onChange = vi.fn();
    const { getByRole } = wrap(
      <FilterBar
        items={[closedIssue, mergedPR]}
        filters={{ ...DEFAULT_FILTERS, showClosedIssues: false }}
        counts={counts}
        onChange={onChange}
        colorblindMode={false}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Reset all filters" }));

    expect(onChange).toHaveBeenCalledWith(DEFAULT_FILTERS);
  });
});
