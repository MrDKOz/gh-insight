import { describe, it, expect } from "vitest";
import { applyFilters, DEFAULT_FILTERS } from "../FilterBar";
import type { Filters } from "../FilterBar";
import type { TimelineItem } from "../../types";

const issue = (overrides: Partial<{ createdAt: string; closedAt: string | null; number: number }> = {}): TimelineItem => ({
  type: "issue", number: 1, title: "Bug",
  url: "https://github.com/o/r/issues/1", author: "jsmith",
  createdAt: "2025-01-10T00:00:00Z", closedAt: null,
  linkedPRs: [], milestoneNumber: 1,
  ...overrides,
});

const pr = (overrides: Partial<{ createdAt: string; mergedAt: string | null; closedAt: string | null; number: number }> = {}): TimelineItem => ({
  type: "pr", number: 2, title: "Feature",
  url: "https://github.com/o/r/pull/2", author: "a-jones",
  createdAt: "2025-01-10T00:00:00Z", mergedAt: null, closedAt: null,
  linkedIssue: null, milestoneNumber: 1,
  ...overrides,
});

const openIssue   = issue();
const closedIssue = issue({ number: 10, closedAt: "2025-01-20T00:00:00Z" });
const openPR      = pr();
const mergedPR    = pr({ number: 20, mergedAt: "2025-01-20T00:00:00Z", closedAt: "2025-01-20T00:00:00Z" });
const closedPR    = pr({ number: 30, mergedAt: null, closedAt: "2025-01-20T00:00:00Z" });

const all = [openIssue, closedIssue, openPR, mergedPR, closedPR];

describe("DEFAULT_FILTERS", () => {
  it("shows all item types by default", () => {
    expect(DEFAULT_FILTERS.showOpenIssues).toBe(true);
    expect(DEFAULT_FILTERS.showClosedIssues).toBe(true);
    expect(DEFAULT_FILTERS.showOpenPRs).toBe(true);
    expect(DEFAULT_FILTERS.showMergedPRs).toBe(true);
    expect(DEFAULT_FILTERS.showClosedPRs).toBe(true);
  });

  it("has empty date ranges by default", () => {
    expect(DEFAULT_FILTERS.createdStart).toBe("");
    expect(DEFAULT_FILTERS.createdEnd).toBe("");
    expect(DEFAULT_FILTERS.closedStart).toBe("");
    expect(DEFAULT_FILTERS.closedEnd).toBe("");
  });
});

describe("applyFilters — show/hide toggles", () => {
  it("passes all items through with default filters", () => {
    expect(applyFilters(all, DEFAULT_FILTERS)).toEqual(all);
  });

  it("hides open issues when showOpenIssues is false", () => {
    const f: Filters = { ...DEFAULT_FILTERS, showOpenIssues: false };
    const result = applyFilters(all, f);
    expect(result).not.toContainEqual(openIssue);
    expect(result).toContainEqual(closedIssue);
  });

  it("hides closed issues when showClosedIssues is false", () => {
    const f: Filters = { ...DEFAULT_FILTERS, showClosedIssues: false };
    const result = applyFilters(all, f);
    expect(result).not.toContainEqual(closedIssue);
    expect(result).toContainEqual(openIssue);
  });

  it("hides open PRs when showOpenPRs is false", () => {
    const f: Filters = { ...DEFAULT_FILTERS, showOpenPRs: false };
    const result = applyFilters(all, f);
    expect(result).not.toContainEqual(openPR);
    expect(result).toContainEqual(mergedPR);
    expect(result).toContainEqual(closedPR);
  });

  it("hides merged PRs when showMergedPRs is false", () => {
    const f: Filters = { ...DEFAULT_FILTERS, showMergedPRs: false };
    const result = applyFilters(all, f);
    expect(result).not.toContainEqual(mergedPR);
    expect(result).toContainEqual(openPR);
  });

  it("hides closed (non-merged) PRs when showClosedPRs is false", () => {
    const f: Filters = { ...DEFAULT_FILTERS, showClosedPRs: false };
    const result = applyFilters(all, f);
    expect(result).not.toContainEqual(closedPR);
    expect(result).toContainEqual(mergedPR);
  });
});

describe("applyFilters — createdAt range", () => {
  it("excludes items created before createdStart", () => {
    const early = issue({ number: 11, createdAt: "2025-01-05T00:00:00Z" });
    const late  = issue({ number: 12, createdAt: "2025-01-15T00:00:00Z" });
    const f: Filters = { ...DEFAULT_FILTERS, createdStart: "2025-01-10" };
    expect(applyFilters([early, late], f)).toEqual([late]);
  });

  it("excludes items created after createdEnd", () => {
    const early = issue({ number: 11, createdAt: "2025-01-05T00:00:00Z" });
    const late  = issue({ number: 12, createdAt: "2025-01-15T00:00:00Z" });
    const f: Filters = { ...DEFAULT_FILTERS, createdEnd: "2025-01-10" };
    expect(applyFilters([early, late], f)).toEqual([early]);
  });
});

describe("applyFilters — closedAt range", () => {
  it("excludes open items when a closed-date filter is active", () => {
    const f: Filters = { ...DEFAULT_FILTERS, closedStart: "2025-01-01" };
    const result = applyFilters([openIssue, closedIssue], f);
    expect(result).not.toContainEqual(openIssue);
    expect(result).toContainEqual(closedIssue);
  });

  it("excludes items closed before closedStart", () => {
    const early = issue({ number: 11, closedAt: "2025-01-20T00:00:00Z" });
    const late  = issue({ number: 12, closedAt: "2025-02-01T00:00:00Z" });
    const f: Filters = { ...DEFAULT_FILTERS, closedStart: "2025-01-25" };
    expect(applyFilters([early, late], f)).toEqual([late]);
  });

  it("excludes items closed after closedEnd", () => {
    const early = issue({ number: 11, closedAt: "2025-01-20T00:00:00Z" });
    const late  = issue({ number: 12, closedAt: "2025-02-01T00:00:00Z" });
    const f: Filters = { ...DEFAULT_FILTERS, closedEnd: "2025-01-25" };
    expect(applyFilters([early, late], f)).toEqual([early]);
  });
});
