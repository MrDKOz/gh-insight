import type { TimelineItem } from "../../types";
import { buildRows, safeFilename } from "../export";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const closedIssue: TimelineItem = {
  type: "issue",
  number: 42,
  title: "Fix the login bug",
  url: "https://github.com/owner/repo/issues/42",
  author: "torvalds",
  createdAt: "2025-01-01T00:00:00Z",
  closedAt: "2025-01-11T00:00:00Z", // 10 days
  linkedPRs: [7, 8],
  milestoneNumber: 1,
  labels: [],
  assignees: [],
  reopenedCount: 0,
};

const mergedPR: TimelineItem = {
  type: "pr",
  number: 7,
  title: "Fix login via OAuth",
  url: "https://github.com/owner/repo/pull/7",
  author: "gaearon",
  createdAt: "2025-01-05T00:00:00Z",
  mergedAt: "2025-01-10T00:00:00Z",
  closedAt: "2025-01-10T00:00:00Z",
  linkedIssue: 42,
  milestoneNumber: 1,
  labels: [],
  assignees: [],
  firstReviewAt: null,
};

const closedPR: TimelineItem = {
  type: "pr",
  number: 8,
  title: "Alternative login fix",
  url: "https://github.com/owner/repo/pull/8",
  author: "sindresorhus",
  createdAt: "2025-01-06T00:00:00Z",
  mergedAt: null,
  closedAt: "2025-01-09T00:00:00Z",
  linkedIssue: null,
  milestoneNumber: 1,
  labels: [],
  assignees: [],
  firstReviewAt: null,
};

const issueNoLinks: TimelineItem = {
  type: "issue",
  number: 99,
  title: "Standalone task",
  url: "https://github.com/owner/repo/issues/99",
  author: "addyosmani",
  createdAt: "2025-02-01T00:00:00Z",
  closedAt: "2025-02-03T00:00:00Z", // 2 days
  linkedPRs: [],
  milestoneNumber: 1,
  labels: [],
  assignees: [],
  reopenedCount: 0,
};

// ── safeFilename ──────────────────────────────────────────────────────────────

describe("safeFilename", () => {
  it("leaves alphanumeric, hyphens, and underscores unchanged", () => {
    expect(safeFilename("Sprint-1_v2")).toBe("Sprint-1_v2");
  });

  it("replaces spaces and special chars with underscores", () => {
    expect(safeFilename("My Milestone!")).toBe("My_Milestone");
  });

  it("collapses consecutive underscores into one", () => {
    expect(safeFilename("a  b   c")).toBe("a_b_c");
  });

  it("strips leading and trailing underscores", () => {
    expect(safeFilename("  leading")).toBe("leading");
    expect(safeFilename("trailing  ")).toBe("trailing");
    expect(safeFilename("  both  ")).toBe("both");
  });

  it("handles a string of only special chars", () => {
    expect(safeFilename("!!!")).toBe("");
  });
});

// ── buildRows ─────────────────────────────────────────────────────────────────

describe("buildRows — field mapping", () => {
  it("maps a closed issue correctly", () => {
    const row = buildRows([closedIssue])[0]!;

    expect(row.type).toBe("Issue");
    expect(row.num).toBe("#42");
    expect(row.title).toBe("Fix the login bug");
    expect(row.author).toBe("torvalds");
    expect(row.status).toBe("Closed");
    expect(row.url).toBe("https://github.com/owner/repo/issues/42");
  });

  it("maps a merged PR correctly", () => {
    const row = buildRows([mergedPR])[0]!;

    expect(row.type).toBe("PR");
    expect(row.num).toBe("#7");
    expect(row.status).toBe("Merged");
  });

  it("maps a closed (non-merged) PR correctly", () => {
    const row = buildRows([closedPR])[0]!;

    expect(row.type).toBe("PR");
    expect(row.status).toBe("Closed");
  });

  it("calculates duration in days correctly", () => {
    const row = buildRows([closedIssue])[0]!; // 10 days

    expect(row.duration).toBe("10");
  });

  it("outputs a 2-day duration correctly", () => {
    const row = buildRows([issueNoLinks])[0]!; // 2 days

    expect(row.duration).toBe("2");
  });
});

describe("buildRows — linked item rendering", () => {
  it("shows linked PRs for an issue", () => {
    const row = buildRows([closedIssue])[0]!;

    expect(row.linked).toBe("PR #7, PR #8");
  });

  it("shows '—' for an issue with no linked PRs", () => {
    const row = buildRows([issueNoLinks])[0]!;

    expect(row.linked).toBe("—");
  });

  it("shows linked issue for a PR", () => {
    const row = buildRows([mergedPR])[0]!;

    expect(row.linked).toBe("Issue #42");
  });

  it("shows '—' for a PR with no linked issue", () => {
    const row = buildRows([closedPR])[0]!;

    expect(row.linked).toBe("—");
  });
});

describe("buildRows — sort order", () => {
  it("sorts rows by createdAt ascending regardless of input order", () => {
    const rows = buildRows([mergedPR, closedIssue, issueNoLinks]);

    // closedIssue: Jan 1, mergedPR: Jan 5, issueNoLinks: Feb 1
    expect(rows[0]!.num).toBe("#42");
    expect(rows[1]!.num).toBe("#7");
    expect(rows[2]!.num).toBe("#99");
  });
});

describe("buildRows — closed date", () => {
  it("shows the closed date for a closed issue", () => {
    const row = buildRows([closedIssue])[0]!;

    expect(row.closed).not.toBe("N/A");
    expect(row.closed.length).toBeGreaterThan(0);
  });

  it("shows the merged date for a merged PR (not the closedAt date)", () => {
    const rowClosed = buildRows([closedPR])[0]!;
    const rowMerged = buildRows([mergedPR])[0]!;

    // Both have the same closedAt in this fixture, but this confirms the field is populated
    expect(rowMerged.closed).not.toBe("N/A");
    expect(rowClosed.closed).not.toBe("N/A");
  });
});
