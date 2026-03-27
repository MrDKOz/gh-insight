import type { TimelineItem } from "../../types";
import { COLORS, MS, assigneesOtherThanAuthor, durationDays, fmtDate, hoverCardPos, itemEndDate, labelTextColor, safeUrl } from "../utils";

const issue = (overrides: Partial<{ closedAt: string | null }> = {}): TimelineItem => ({
  type: "issue", number: 1, title: "Test issue",
  url: "https://github.com/o/r/issues/1", author: "jsmith",
  createdAt: "2025-01-01T00:00:00Z", closedAt: null,
  linkedPRs: [], milestoneNumber: 1,
  labels: [], assignees: [], reopenedCount: 0,
  ...overrides,
});

const pr = (overrides: Partial<{ mergedAt: string | null; closedAt: string | null }> = {}): TimelineItem => ({
  type: "pr", number: 2, title: "Test PR",
  url: "https://github.com/o/r/pull/2", author: "a-jones",
  createdAt: "2025-01-01T00:00:00Z", mergedAt: null, closedAt: null,
  linkedIssue: null, milestoneNumber: 1,
  labels: [], assignees: [], firstReviewAt: null,
  ...overrides,
});

describe("MS", () => {
  it("equals the number of milliseconds in one day", () => {
    expect(MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("COLORS", () => {
  it("exposes the expected keys", () => {
    expect(COLORS).toHaveProperty("issue");
    expect(COLORS).toHaveProperty("prMerged");
    expect(COLORS).toHaveProperty("prClosed");
    expect(COLORS).toHaveProperty("chartAxis");
    expect(COLORS).toHaveProperty("chartGrid");
  });
});

describe("fmtDate", () => {
  it("formats an ISO string as \"D Mon\"", () => {
    expect(fmtDate("2025-01-03T00:00:00Z")).toBe("3 Jan");
  });

  it("returns N/A for null", () => {
    expect(fmtDate(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(fmtDate(undefined)).toBe("N/A");
  });

  it("returns N/A for empty string", () => {
    expect(fmtDate("")).toBe("N/A");
  });

  it("returns N/A for an invalid ISO string", () => {
    expect(fmtDate("not-a-date")).toBe("N/A");
  });
});

describe("itemEndDate", () => {
  it("returns closedAt for closed issues", () => {
    expect(itemEndDate(issue({ closedAt: "2025-02-01T00:00:00Z" }))).toBe("2025-02-01T00:00:00Z");
  });

  it("returns null for open issues", () => {
    expect(itemEndDate(issue())).toBeNull();
  });

  it("returns mergedAt for merged PRs (preferred over closedAt)", () => {
    expect(itemEndDate(pr({ mergedAt: "2025-02-10T00:00:00Z", closedAt: "2025-02-10T00:00:00Z" }))).toBe("2025-02-10T00:00:00Z");
  });

  it("falls back to closedAt when PR is closed but not merged", () => {
    expect(itemEndDate(pr({ mergedAt: null, closedAt: "2025-02-15T00:00:00Z" }))).toBe("2025-02-15T00:00:00Z");
  });

  it("returns null for open PRs", () => {
    expect(itemEndDate(pr())).toBeNull();
  });

  it("handles same-day close (createdAt === closedAt)", () => {
    const ts = "2025-03-01T12:00:00Z";

    expect(itemEndDate(issue({ closedAt: ts }))).toBe(ts);
  });
});

describe("safeUrl", () => {
  it("passes through a valid https URL unchanged", () => {
    expect(safeUrl("https://github.com/owner/repo/issues/1")).toBe("https://github.com/owner/repo/issues/1");
  });

  it("returns '#' for javascript: scheme", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
  });

  it("returns '#' for data: URIs", () => {
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("returns '#' for http: (not https)", () => {
    expect(safeUrl("http://example.com")).toBe("#");
  });

  it("returns '#' for a malformed URL", () => {
    expect(safeUrl("not a url at all")).toBe("#");
  });

  it("returns '#' for an empty string", () => {
    expect(safeUrl("")).toBe("#");
  });

  it("returns '#' for a non-GitHub https URL", () => {
    expect(safeUrl("https://evil.com/inject")).toBe("#");
  });

  it("passes through a github.com subdomain URL (e.g. gist.github.com)", () => {
    expect(safeUrl("https://gist.github.com/user/abc123")).toBe("https://gist.github.com/user/abc123");
  });
});

describe("labelTextColor", () => {
  it("returns black text on a light background", () => {
    expect(labelTextColor("#ffffff")).toBe("#000000");
    expect(labelTextColor("#bfd4f2")).toBe("#000000"); // GitHub light-blue label
  });

  it("returns white text on a dark background", () => {
    expect(labelTextColor("#000000")).toBe("#ffffff");
    expect(labelTextColor("#6f42c1")).toBe("#ffffff"); // GitHub purple label
  });
});

describe("durationDays", () => {
  it("returns the number of days between two dates (rounded)", () => {
    expect(durationDays("2025-01-01T00:00:00Z", "2025-01-11T00:00:00Z")).toBe(10);
  });

  it("returns null when end is null (open item)", () => {
    expect(durationDays("2025-01-01T00:00:00Z", null)).toBeNull();
  });

  it("returns 0 for same-day open and close", () => {
    expect(durationDays("2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z")).toBe(0);
  });

  it("clamps to 0 rather than returning a negative value", () => {
    // End before start can happen due to timezone jitter on same-day items
    expect(durationDays("2025-01-01T23:59:59Z", "2025-01-01T00:00:00Z")).toBe(0);
  });
});

describe("assigneesOtherThanAuthor", () => {
  it("removes the author from the assignees list", () => {
    expect(assigneesOtherThanAuthor(["alice", "bob"], "alice")).toEqual(["bob"]);
  });

  it("returns all assignees when the author is not among them", () => {
    expect(assigneesOtherThanAuthor(["bob", "carol"], "alice")).toEqual(["bob", "carol"]);
  });

  it("returns an empty array when the only assignee is the author", () => {
    expect(assigneesOtherThanAuthor(["alice"], "alice")).toEqual([]);
  });

  it("returns an empty array when there are no assignees", () => {
    expect(assigneesOtherThanAuthor([], "alice")).toEqual([]);
  });
});

describe("hoverCardPos", () => {
  const cardW = 200;
  const cardH = 100;

  it("positions to the right when there is enough horizontal space", () => {
    const pos = hoverCardPos(300, 200, 800, cardW, cardH);

    expect(pos.left).toBe(314);       // x + 14
    expect(pos.right).toBeUndefined();
  });

  it("flips to the left when near the right edge", () => {
    const pos = hoverCardPos(700, 200, 800, cardW, cardH);

    expect(pos.right).toBeDefined();  // wrapWidth - x + 14
    expect(pos.left).toBeUndefined();
  });

  it("positions below the cursor when near the top (y < cardH + 14)", () => {
    const pos = hoverCardPos(300, 50, 800, cardW, cardH);

    expect(pos.top).toBe(64);         // 50 + 14
  });

  it("positions above the cursor when there is enough room above", () => {
    const pos = hoverCardPos(300, 200, 800, cardW, cardH);

    expect(pos.top).toBe(100);        // 200 - 100
  });
});
