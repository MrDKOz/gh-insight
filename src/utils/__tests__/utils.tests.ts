import type { TimelineItem } from "../../types";
import { COLORS, COLORS_CB, MS, MS_HOUR, assigneesOtherThanAuthor, durationDays, fmtDate, fmtDateTime, hoverCardPos, itemEndDate, itemStatus, labelTextColor, makeChartColors, makeStatusChipSx, pluralize, safeUrl, snapToHour, upperBound } from "../utils";

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

describe("upperBound", () => {
  it("returns the count of elements ≤ t", () => {
    expect(upperBound([1, 2, 3, 4, 5], 3)).toBe(3);
  });

  it("returns 0 when t is less than all elements", () => {
    expect(upperBound([10, 20, 30], 5)).toBe(0);
  });

  it("returns arr.length when t is >= all elements", () => {
    expect(upperBound([10, 20, 30], 30)).toBe(3);
  });

  it("returns 0 for an empty array", () => {
    expect(upperBound([], 99)).toBe(0);
  });
});

describe("itemStatus", () => {
  it("returns 'Closed' for a closed issue", () => {
    expect(itemStatus(issue({ closedAt: "2025-02-01T00:00:00Z" }))).toBe("Closed");
  });

  it("returns 'Open' for an open issue", () => {
    expect(itemStatus(issue())).toBe("Open");
  });

  it("returns 'Merged' for a merged PR", () => {
    expect(itemStatus(pr({ mergedAt: "2025-02-01T00:00:00Z" }))).toBe("Merged");
  });

  it("returns 'Closed' for a closed (non-merged) PR", () => {
    expect(itemStatus(pr({ closedAt: "2025-02-01T00:00:00Z" }))).toBe("Closed");
  });

  it("returns 'Open' for an open PR", () => {
    expect(itemStatus(pr())).toBe("Open");
  });
});

describe("pluralize", () => {
  it("appends 's' when count is 0", () => {
    expect(pluralize(0, "item")).toBe("0 items");
  });

  it("does not append 's' when count is 1", () => {
    expect(pluralize(1, "item")).toBe("1 item");
  });

  it("appends 's' when count is 2", () => {
    expect(pluralize(2, "item")).toBe("2 items");
  });

  it("works with words that already contain spaces (e.g. 'open issue')", () => {
    expect(pluralize(3, "open issue")).toBe("3 open issues");
  });
});

describe("MS_HOUR", () => {
  it("equals the number of milliseconds in one hour", () => {
    expect(MS_HOUR).toBe(60 * 60 * 1000);
  });
});

describe("fmtDateTime", () => {
  it("returns N/A for null", () => {
    expect(fmtDateTime(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(fmtDateTime(undefined)).toBe("N/A");
  });

  it("returns N/A for an invalid date string", () => {
    expect(fmtDateTime("not-a-date")).toBe("N/A");
  });

  it("produces a string ending in HH:00 hour format", () => {
    // Use a fixed local Date so the test is not timezone-sensitive
    const d = new Date(2025, 0, 3, 14, 30, 0); // 3 Jan 2025 14:30 local
    const result = fmtDateTime(d.toISOString());
    expect(result).not.toBe("N/A");
    expect(result).toMatch(/\d{2}:00$/);
  });

  it("does not include minutes or seconds in the output", () => {
    const d = new Date(2025, 5, 15, 9, 45, 30); // 15 Jun 2025 09:45:30 local
    const result = fmtDateTime(d.toISOString());
    expect(result).toMatch(/09:00$/);
  });
});

describe("snapToHour", () => {
  it("floors to the local hour boundary", () => {
    const d = new Date(2025, 0, 3, 14, 30, 45, 123); // 14:30:45.123 local
    const snapped = new Date(snapToHour(d.getTime()));
    expect(snapped.getHours()).toBe(14);
    expect(snapped.getMinutes()).toBe(0);
    expect(snapped.getSeconds()).toBe(0);
    expect(snapped.getMilliseconds()).toBe(0);
  });

  it("is a no-op when already at an exact hour boundary", () => {
    const d = new Date(2025, 0, 3, 10, 0, 0, 0);
    expect(snapToHour(d.getTime())).toBe(d.getTime());
  });

  it("does not change the date or hour, only sub-hour components", () => {
    const d = new Date(2025, 2, 15, 23, 59, 59, 999); // 23:59:59.999 local
    const snapped = new Date(snapToHour(d.getTime()));
    expect(snapped.getDate()).toBe(15);
    expect(snapped.getHours()).toBe(23);
    expect(snapped.getMinutes()).toBe(0);
  });
});

describe("makeChartColors", () => {
  it("returns the default palette when colorblind mode is off", () => {
    const c = makeChartColors(false);
    expect(c.issue).toBe(COLORS.issue);
    expect(c.prMerged).toBe(COLORS.prMerged);
    expect(c.prClosed).toBe(COLORS.prClosed);
    expect(c.axis).toBe(COLORS.chartAxis);
    expect(c.grid).toBe(COLORS.chartGrid);
    expect(c.median).toBe(COLORS.success);
    expect(c.mean).toBe(COLORS.warning);
  });

  it("returns the colorblind palette when colorblind mode is on", () => {
    const c = makeChartColors(true);
    expect(c.issue).toBe(COLORS_CB.issue);
    expect(c.prMerged).toBe(COLORS_CB.prMerged);
    expect(c.prClosed).toBe(COLORS_CB.prClosed);
  });

  it("exposes all expected keys", () => {
    const c = makeChartColors(false);
    const expectedKeys = ["issue", "prMerged", "prClosed", "axis", "grid", "label", "cursor", "median", "mean", "today", "todayLabel", "weekendBand"];
    for (const key of expectedKeys) {
      expect(c).toHaveProperty(key);
    }
  });
});

describe("makeStatusChipSx", () => {
  it("returns sx for open, closed, and merged statuses", () => {
    const sx = makeStatusChipSx(false);
    expect(sx).toHaveProperty("open");
    expect(sx).toHaveProperty("closed");
    expect(sx).toHaveProperty("merged");
  });

  it("applies different colors in colorblind mode", () => {
    const normal = makeStatusChipSx(false);
    const cb = makeStatusChipSx(true);
    // merged and closed colors come from the palette, so they should differ between modes
    expect(JSON.stringify(normal.merged)).not.toBe(JSON.stringify(cb.merged));
    expect(JSON.stringify(normal.closed)).not.toBe(JSON.stringify(cb.closed));
  });

  it("each status sx has bgcolor and color properties", () => {
    const sx = makeStatusChipSx(false);
    for (const key of ["open", "closed", "merged"] as const) {
      expect(sx[key]).toHaveProperty("bgcolor");
      expect(sx[key]).toHaveProperty("color");
    }
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
