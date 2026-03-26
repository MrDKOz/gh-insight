import { describe, it, expect } from "vitest";
import { MS, fmtDate, itemEndDate, hoverCardPos, COLORS } from "../utils";
import type { TimelineItem } from "../../types";

const issue = (overrides: Partial<{ closedAt: string | null }> = {}): TimelineItem => ({
  type: "issue", number: 1, title: "Test issue",
  url: "https://github.com/o/r/issues/1", author: "jsmith",
  createdAt: "2025-01-01T00:00:00Z", closedAt: null,
  linkedPRs: [], milestoneNumber: 1,
  ...overrides,
});

const pr = (overrides: Partial<{ mergedAt: string | null; closedAt: string | null }> = {}): TimelineItem => ({
  type: "pr", number: 2, title: "Test PR",
  url: "https://github.com/o/r/pull/2", author: "a-jones",
  createdAt: "2025-01-01T00:00:00Z", mergedAt: null, closedAt: null,
  linkedIssue: null, milestoneNumber: 1,
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
