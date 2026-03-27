import type { TimelineItem } from "../../types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render } from "@testing-library/react";
import { StatsBar } from "../StatsBar";

const theme = createTheme();
const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const openIssue: TimelineItem = {
  type: "issue", number: 1, title: "Open issue",
  url: "https://github.com/o/r/issues/1", author: "alice",
  createdAt: "2025-01-01T00:00:00Z", closedAt: null,
  linkedPRs: [], milestoneNumber: 1,
  labels: [], assignees: [], reopenedCount: 0,
};

const closedIssue: TimelineItem = {
  ...openIssue, number: 2, title: "Closed issue",
  closedAt: "2025-01-11T00:00:00Z", // 10 days
};

const mergedPR: TimelineItem = {
  type: "pr", number: 3, title: "Merged PR",
  url: "https://github.com/o/r/pull/3", author: "bob",
  createdAt: "2025-01-01T00:00:00Z", mergedAt: "2025-01-05T00:00:00Z",
  closedAt: "2025-01-05T00:00:00Z", linkedIssue: null, milestoneNumber: 1,
  labels: [], assignees: [], firstReviewAt: null,
};

describe("StatsBar — smoke", () => {
  it("renders issue and PR counts without crashing", () => {
    const { getByText } = wrap(
      <StatsBar items={[openIssue, closedIssue, mergedPR]} view="Gantt" colorblindMode={false} title="Sprint 42" />,
    );

    expect(getByText("Issues closed")).toBeInTheDocument();
    expect(getByText("PRs merged")).toBeInTheDocument();
  });

  it("shows cycle time stats when closed issues exist", () => {
    const { getByText } = wrap(
      <StatsBar items={[closedIssue]} view="Gantt" colorblindMode={false} title="Sprint 42" />,
    );

    expect(getByText("Avg cycle")).toBeInTheDocument();
    expect(getByText("Fastest")).toBeInTheDocument();
    expect(getByText("Slowest")).toBeInTheDocument();
  });

  it("does not show cycle time stats when no issues are closed", () => {
    const { queryByText } = wrap(
      <StatsBar items={[openIssue]} view="Gantt" colorblindMode={false} title="Sprint 42" />,
    );

    expect(queryByText("Avg cycle")).not.toBeInTheDocument();
  });

  it("shows open issues count when open issues exist", () => {
    const { getByText } = wrap(
      <StatsBar items={[openIssue, closedIssue]} view="Gantt" colorblindMode={false} title="Sprint 42" />,
    );

    expect(getByText("Issues open")).toBeInTheDocument();
  });
});
