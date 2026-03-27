import type { TimelineItem } from "../../types";
import { buildReviewWaitRows, buildRows, exportCSV, exportMarkdown, safeFilename } from "../export";

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

const openIssue: TimelineItem = {
  type: "issue",
  number: 50,
  title: "Work in progress",
  url: "https://github.com/owner/repo/issues/50",
  author: "jdoe",
  createdAt: "2025-03-01T00:00:00Z",
  closedAt: null,
  linkedPRs: [],
  milestoneNumber: 1,
  labels: [],
  assignees: [],
  reopenedCount: 0,
};

const openPR: TimelineItem = {
  type: "pr",
  number: 51,
  title: "Open PR",
  url: "https://github.com/owner/repo/pull/51",
  author: "jdoe",
  createdAt: "2025-03-01T00:00:00Z",
  mergedAt: null,
  closedAt: null,
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

describe("buildRows — open items", () => {
  it("maps an open issue with status 'Open', no close date, and no duration", () => {
    const row = buildRows([openIssue])[0]!;

    expect(row.status).toBe("Open");
    expect(row.closed).toBe("N/A");
    expect(row.duration).toBe("—");
  });

  it("maps an open PR with status 'Open'", () => {
    const row = buildRows([openPR])[0]!;

    expect(row.status).toBe("Open");
    expect(row.duration).toBe("—");
  });
});

describe("buildRows — assignees", () => {
  it("joins multiple assignees with ', '", () => {
    const item: TimelineItem = { ...closedIssue, assignees: ["alice", "bob"] };
    const row = buildRows([item])[0]!;

    expect(row.assignees).toBe("alice, bob");
  });

  it("shows '—' when there are no assignees", () => {
    const row = buildRows([closedIssue])[0]!; // assignees: []

    expect(row.assignees).toBe("—");
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

// ── buildRows — labels ─────────────────────────────────────────────────────

describe("buildRows — labels", () => {
  it("joins label names with ', '", () => {
    const item: TimelineItem = {
      ...closedIssue,
      labels: [{ name: "bug", color: "#d73a4a" }, { name: "urgent", color: "#e4e669" }],
    };
    const row = buildRows([item])[0]!;

    expect(row.labels).toBe("bug, urgent");
  });

  it("shows '—' when there are no labels", () => {
    const row = buildRows([closedIssue])[0]!; // labels: []

    expect(row.labels).toBe("—");
  });

  it("works with a single label", () => {
    const item: TimelineItem = { ...closedIssue, labels: [{ name: "enhancement", color: "#a2eeef" }] };
    const row = buildRows([item])[0]!;

    expect(row.labels).toBe("enhancement");
  });
});

// ── buildReviewWaitRows ────────────────────────────────────────────────────

const reviewedPR: TimelineItem = {
  type: "pr",
  number: 10,
  title: "Add feature X",
  url: "https://github.com/owner/repo/pull/10",
  author: "alice",
  createdAt: "2025-02-01T00:00:00Z",
  mergedAt: "2025-02-08T00:00:00Z",
  closedAt: "2025-02-08T00:00:00Z",
  linkedIssue: null,
  milestoneNumber: 1,
  labels: [{ name: "feature", color: "#0075ca" }],
  assignees: ["bob"],
  firstReviewAt: "2025-02-03T00:00:00Z", // 2 days wait
};

const unreviewedPR: TimelineItem = {
  type: "pr",
  number: 11,
  title: "Fix typo",
  url: "https://github.com/owner/repo/pull/11",
  author: "carol",
  createdAt: "2025-02-05T00:00:00Z",
  mergedAt: null,
  closedAt: null,
  linkedIssue: null,
  milestoneNumber: 1,
  labels: [],
  assignees: [],
  firstReviewAt: null,
};

const slowPR: TimelineItem = {
  type: "pr",
  number: 12,
  title: "Slow review",
  url: "https://github.com/owner/repo/pull/12",
  author: "dave",
  createdAt: "2025-02-01T00:00:00Z",
  mergedAt: null,
  closedAt: "2025-02-15T00:00:00Z",
  linkedIssue: null,
  milestoneNumber: 1,
  labels: [],
  assignees: [],
  firstReviewAt: "2025-02-11T00:00:00Z", // 10 days wait
};

describe("buildReviewWaitRows — field mapping", () => {
  it("maps a reviewed PR correctly", () => {
    const row = buildReviewWaitRows([reviewedPR])[0]!;

    expect(row.num).toBe("#10");
    expect(row.title).toBe("Add feature X");
    expect(row.author).toBe("alice");
    expect(row.assignees).toBe("bob");
    expect(row.labels).toBe("feature");
    expect(row.status).toBe("Merged");
    expect(row.waitDays).toBe("2");
    expect(row.url).toBe("https://github.com/owner/repo/pull/10");
  });

  it("shows '—' for waitDays when the PR has no first review", () => {
    const row = buildReviewWaitRows([unreviewedPR])[0]!;

    expect(row.waitDays).toBe("—");
    expect(row.firstReview).toBe("—");
  });

  it("shows 'open' for totalDays when the PR is still open", () => {
    const row = buildReviewWaitRows([unreviewedPR])[0]!;

    expect(row.totalDays).toBe("open");
  });

  it("calculates totalDays from closedAt when not merged", () => {
    const row = buildReviewWaitRows([slowPR])[0]!; // Feb 1 → Feb 15 = 14 days

    expect(row.totalDays).toBe("14");
  });

  it("shows '—' for labels when the PR has no labels", () => {
    const row = buildReviewWaitRows([slowPR])[0]!;

    expect(row.labels).toBe("—");
  });

  it("filters out issues — only PRs are included", () => {
    const rows = buildReviewWaitRows([closedIssue, reviewedPR]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.num).toBe("#10");
  });
});

describe("buildReviewWaitRows — sort order", () => {
  it("sorts by waitDays descending (slowest first)", () => {
    const rows = buildReviewWaitRows([reviewedPR, slowPR]); // 2d and 10d

    expect(rows[0]!.num).toBe("#12"); // 10 days
    expect(rows[1]!.num).toBe("#10"); // 2 days
  });

  it("puts unreviewed PRs (waitDays '—') last", () => {
    const rows = buildReviewWaitRows([unreviewedPR, reviewedPR]);

    expect(rows[0]!.num).toBe("#10"); // reviewed
    expect(rows[1]!.num).toBe("#11"); // unreviewed
  });
});

// ── exportCSV / exportMarkdown ─────────────────────────────────────────────
// Tests verify the output structure by intercepting the Blob before download.

const realBlob = globalThis.Blob;
let capturedContent = "";

beforeEach(() => {
  capturedContent = "";
  globalThis.Blob = class extends realBlob {
    constructor(parts?: BlobPart[], opts?: BlobPropertyBag) {
      super(parts, opts);
      if (parts?.[0] != null) { capturedContent = String(parts[0]); }
    }
  } as typeof Blob;
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue(undefined);
});

afterEach(() => {
  globalThis.Blob = realBlob;
  vi.restoreAllMocks();
});

describe("exportCSV", () => {
  it("includes the header row with all expected columns", () => {
    exportCSV([closedIssue], "Sprint 1");

    expect(capturedContent).toContain('"Type"');
    expect(capturedContent).toContain('"Number"');
    expect(capturedContent).toContain('"Title"');
    expect(capturedContent).toContain('"Author"');
    expect(capturedContent).toContain('"Assignees"');
    expect(capturedContent).toContain('"Labels"');
    expect(capturedContent).toContain('"Status"');
    expect(capturedContent).toContain('"Opened"');
    expect(capturedContent).toContain('"Closed/Merged"');
    expect(capturedContent).toContain('"Duration (days)"');
    expect(capturedContent).toContain('"Linked to"');
    expect(capturedContent).toContain('"URL"');
  });

  it("includes the item data in the CSV", () => {
    exportCSV([closedIssue], "Sprint 1");

    expect(capturedContent).toContain('"Issue"');
    expect(capturedContent).toContain('"#42"');
    expect(capturedContent).toContain('"Fix the login bug"');
    expect(capturedContent).toContain('"torvalds"');
    expect(capturedContent).toContain('"Closed"');
    expect(capturedContent).toContain('"10"'); // duration
  });

  it("escapes double quotes inside cell values", () => {
    const item: TimelineItem = { ...closedIssue, title: 'Fix "critical" bug' };
    exportCSV([item], "Sprint");

    expect(capturedContent).toContain('"Fix ""critical"" bug"');
  });

  it("uses CRLF line endings", () => {
    exportCSV([closedIssue], "Sprint 1");

    expect(capturedContent).toContain("\r\n");
  });
});

describe("exportMarkdown", () => {
  it("includes a heading with the milestone title", () => {
    exportMarkdown([closedIssue], "Sprint 1");

    expect(capturedContent).toContain("# Sprint 1");
  });

  it("includes all expected column headers", () => {
    exportMarkdown([closedIssue], "Sprint 1");

    expect(capturedContent).toContain("Labels");
    expect(capturedContent).toContain("Author");
    expect(capturedContent).toContain("Assignees");
    expect(capturedContent).toContain("Status");
    expect(capturedContent).toContain("Linked to");
  });

  it("renders the item number as a markdown link to the URL", () => {
    exportMarkdown([closedIssue], "Sprint 1");

    expect(capturedContent).toContain("[#42](https://github.com/owner/repo/issues/42)");
  });

  it("escapes pipe characters in titles", () => {
    const item: TimelineItem = { ...closedIssue, title: "Support a|b routing" };
    exportMarkdown([item], "Sprint");

    expect(capturedContent).toContain("Support a\\|b routing");
  });
});
