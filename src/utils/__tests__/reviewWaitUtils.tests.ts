import type { TimelineItem } from "../../types/GitHubTypes";
import { buildRows, sortRows } from "../reviewWaitUtils";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makePR = (
  overrides: Partial<Extract<TimelineItem, { type: "pr" }>> = {},
): TimelineItem => ({
  type: "pr",
  number: 1,
  title: "Test PR",
  url: "https://github.com/o/r/pull/1",
  author: "alice",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-05T00:00:00Z",
  mergedAt: "2025-01-05T00:00:00Z",
  closedAt: "2025-01-05T00:00:00Z",
  isDraft: false,
  reviewDecision: null,
  additions: 10,
  deletions: 2,
  linkedIssue: null,
  milestoneNumber: 1,
  labels: [],
  assignees: [],
  firstReviewAt: "2025-01-03T00:00:00Z",
  ...overrides,
});

const makeIssue = (): TimelineItem => ({
  type: "issue",
  number: 99,
  title: "An issue",
  url: "https://github.com/o/r/issues/99",
  author: "bob",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  closedAt: null,
  linkedPRs: [],
  milestoneNumber: 1,
  labels: [],
  assignees: [],
  reopenedCount: 0,
});

// ── buildRows ─────────────────────────────────────────────────────────────────

describe("buildRows", () => {
  it("filters out non-PR items", () => {
    const rows = buildRows([makePR(), makeIssue()]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.number).toBe(1);
  });

  it("computes reviewWaitDays from createdAt to firstReviewAt", () => {
    // created 2025-01-01, first review 2025-01-03 → 2 days
    const rows = buildRows([makePR()]);

    expect(rows[0]?.reviewWaitDays).toBe(2);
  });

  it("sets reviewWaitDays to null when there is no first review", () => {
    const rows = buildRows([makePR({ firstReviewAt: null })]);

    expect(rows[0]?.reviewWaitDays).toBeNull();
  });

  it("computes totalDays from createdAt to mergedAt", () => {
    // created 2025-01-01, merged 2025-01-05 → 4 days
    const rows = buildRows([makePR()]);

    expect(rows[0]?.totalDays).toBe(4);
  });

  it("uses closedAt when mergedAt is null", () => {
    const rows = buildRows([makePR({ mergedAt: null, closedAt: "2025-01-03T00:00:00Z" })]);

    expect(rows[0]?.totalDays).toBe(2);
  });

  it("sets totalDays to null for open PRs", () => {
    const rows = buildRows([makePR({ mergedAt: null, closedAt: null })]);

    expect(rows[0]?.totalDays).toBeNull();
  });

  it("clamps reviewWaitDays to 0 when review precedes creation (jitter edge case)", () => {
    const rows = buildRows([makePR({ firstReviewAt: "2024-12-31T00:00:00Z" })]);

    expect(rows[0]?.reviewWaitDays).toBe(0);
  });

  it("returns 'Merged' status for merged PRs", () => {
    expect(buildRows([makePR()])[0]?.status).toBe("Merged");
  });

  it("returns 'Closed' status for closed (non-merged) PRs", () => {
    expect(buildRows([makePR({ mergedAt: null })])[0]?.status).toBe("Closed");
  });

  it("returns 'Open' status for open PRs", () => {
    expect(buildRows([makePR({ mergedAt: null, closedAt: null })])[0]?.status).toBe("Open");
  });
});

// ── sortRows ──────────────────────────────────────────────────────────────────

describe("sortRows", () => {
  const rowA = buildRows([makePR({ number: 1, author: "alice", firstReviewAt: "2025-01-03T00:00:00Z" })])[0]!;
  const rowB = buildRows([makePR({ number: 2, author: "zara", firstReviewAt: null })])[0]!;

  it("sorts by number ascending", () => {
    const [first, second] = sortRows([rowB, rowA], "number", "asc");

    expect(first?.number).toBe(1);
    expect(second?.number).toBe(2);
  });

  it("sorts by number descending", () => {
    const [first] = sortRows([rowA, rowB], "number", "desc");

    expect(first?.number).toBe(2);
  });

  it("sorts by author ascending", () => {
    const [first] = sortRows([rowB, rowA], "author", "asc");

    expect(first?.author).toBe("alice");
  });

  it("places null firstReviewAt last regardless of direction", () => {
    const ascResult  = sortRows([rowB, rowA], "firstReview", "asc");
    const descResult = sortRows([rowA, rowB], "firstReview", "desc");

    expect(ascResult[ascResult.length - 1]?.firstReviewAt).toBeNull();
    expect(descResult[descResult.length - 1]?.firstReviewAt).toBeNull();
  });

  it("places null reviewWaitDays last regardless of direction", () => {
    const [, last] = sortRows([rowA, rowB], "wait", "asc");

    expect(last?.reviewWaitDays).toBeNull();
  });

  it("places null totalDays last regardless of direction", () => {
    const openRow = buildRows([makePR({ number: 3, mergedAt: null, closedAt: null })])[0]!;
    const result  = sortRows([openRow, rowA], "total", "asc");

    expect(result[result.length - 1]?.totalDays).toBeNull();
  });
});
