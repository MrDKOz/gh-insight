import type { TimelineItem } from "../../types/GitHubTypes";
import type { Filters } from "../FilterBar";
import { DEFAULT_FILTERS, applyFilters } from "../FilterBar";

const issue = (overrides: Partial<{ createdAt: string; closedAt: string | null; number: number }> = {}): TimelineItem => ({
  type: "issue", number: 1, title: "Bug",
  url: "https://github.com/o/r/issues/1", author: "jsmith",
  createdAt: "2025-01-10T00:00:00Z", updatedAt: "2025-01-10T00:00:00Z", closedAt: null,
  linkedPRs: [], milestoneNumber: 1,
  labels: [], assignees: [], reopenedCount: 0,
  ...overrides,
});

const pr = (overrides: Partial<{ createdAt: string; mergedAt: string | null; closedAt: string | null; number: number }> = {}): TimelineItem => ({
  type: "pr", number: 2, title: "Feature",
  url: "https://github.com/o/r/pull/2", author: "a-jones",
  createdAt: "2025-01-10T00:00:00Z", updatedAt: "2025-01-10T00:00:00Z", mergedAt: null, closedAt: null,
  isDraft: false, reviewDecision: null, additions: 20, deletions: 5,
  linkedIssue: null, milestoneNumber: 1,
  labels: [], assignees: [], firstReviewAt: null,
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

  it("includes items created exactly on createdStart (inclusive lower bound)", () => {
    const boundary = issue({ number: 13, createdAt: "2025-01-10T00:00:00Z" });
    const f: Filters = { ...DEFAULT_FILTERS, createdStart: "2025-01-10" };

    expect(applyFilters([boundary], f)).toEqual([boundary]);
  });

  it("includes items created exactly on createdEnd (inclusive upper bound)", () => {
    const boundary = issue({ number: 14, createdAt: "2025-01-10T23:59:59Z" });
    const f: Filters = { ...DEFAULT_FILTERS, createdEnd: "2025-01-10" };

    expect(applyFilters([boundary], f)).toEqual([boundary]);
  });
});

describe("applyFilters — label filter", () => {
  it("shows all items when no labels are selected", () => {
    expect(applyFilters(all, DEFAULT_FILTERS)).toHaveLength(all.length);
  });

  it("keeps only items that carry a matching label", () => {
    const withBug: TimelineItem  = { ...closedIssue, number: 50, labels: [{ name: "bug", color: "#d73a4a" }] };
    const withNone: TimelineItem = { ...closedIssue, number: 51, labels: [] };
    const f: Filters = { ...DEFAULT_FILTERS, activeLabels: ["bug"] };

    expect(applyFilters([withBug, withNone], f)).toEqual([withBug]);
  });

  it("passes an item that has any one of the selected labels (OR logic)", () => {
    const bugItem: TimelineItem = { ...closedIssue, number: 52, labels: [{ name: "bug",         color: "#d73a4a" }] };
    const enhItem: TimelineItem = { ...closedIssue, number: 53, labels: [{ name: "enhancement", color: "#a2eeef" }] };
    const f: Filters = { ...DEFAULT_FILTERS, activeLabels: ["bug", "enhancement"] };

    expect(applyFilters([bugItem, enhItem], f)).toEqual([bugItem, enhItem]);
  });
});

describe("applyFilters — people — author role", () => {
  const aliceIssue: TimelineItem = { ...closedIssue, number: 60, author: "alice", assignees: ["bob"] };
  const bobIssue: TimelineItem   = { ...closedIssue, number: 61, author: "bob",   assignees: []      };

  it("matches items authored by the selected person", () => {
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["alice"], peopleRole: "author" };
    const result = applyFilters([aliceIssue, bobIssue], f);

    expect(result).toContainEqual(aliceIssue);
    expect(result).not.toContainEqual(bobIssue);
  });

  it("does not match items where the person is only an assignee, not the author", () => {
    // bob is an assignee on aliceIssue but alice is the author
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["bob"], peopleRole: "author" };
    const result = applyFilters([aliceIssue, bobIssue], f);

    expect(result).not.toContainEqual(aliceIssue);
    expect(result).toContainEqual(bobIssue); // bob IS the author here
  });
});

describe("applyFilters — people — assignees role", () => {
  const aliceIssue: TimelineItem  = { ...closedIssue, number: 70, author: "alice", assignees: ["bob", "carol"] };
  const selfAssigned: TimelineItem = { ...closedIssue, number: 71, author: "dave",  assignees: ["dave"]         };
  const unassigned: TimelineItem   = { ...closedIssue, number: 72, author: "eve",   assignees: []               };

  it("matches items where the person is an assignee", () => {
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["bob"], peopleRole: "assignees" };

    expect(applyFilters([aliceIssue, selfAssigned, unassigned], f)).toContainEqual(aliceIssue);
  });

  it("matches self-assigned items (author is also in assignees)", () => {
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["dave"], peopleRole: "assignees" };

    expect(applyFilters([aliceIssue, selfAssigned, unassigned], f)).toContainEqual(selfAssigned);
  });

  it("does not match items where the person is only the author and not in assignees", () => {
    // alice authored aliceIssue but is not in its assignees array
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["alice"], peopleRole: "assignees" };

    expect(applyFilters([aliceIssue, selfAssigned, unassigned], f)).not.toContainEqual(aliceIssue);
  });

  it("excludes items with no matching assignee", () => {
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["bob"], peopleRole: "assignees" };

    expect(applyFilters([aliceIssue, selfAssigned, unassigned], f)).not.toContainEqual(unassigned);
  });
});

describe("applyFilters — people — either role (default)", () => {
  const authorOnly: TimelineItem   = { ...closedIssue, number: 80, author: "alice", assignees: []        };
  const assigneeOnly: TimelineItem = { ...closedIssue, number: 81, author: "bob",   assignees: ["alice"] };
  const neitherItem: TimelineItem  = { ...closedIssue, number: 82, author: "carol", assignees: ["dave"]  };

  it("matches items where the person is the author", () => {
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["alice"], peopleRole: "either" };

    expect(applyFilters([authorOnly, assigneeOnly, neitherItem], f)).toContainEqual(authorOnly);
  });

  it("matches items where the person is an assignee", () => {
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["alice"], peopleRole: "either" };

    expect(applyFilters([authorOnly, assigneeOnly, neitherItem], f)).toContainEqual(assigneeOnly);
  });

  it("excludes items where the person is neither author nor assignee", () => {
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["alice"], peopleRole: "either" };

    expect(applyFilters([authorOnly, assigneeOnly, neitherItem], f)).not.toContainEqual(neitherItem);
  });
});

describe("applyFilters — people — multiple people selected", () => {
  const aliceItem: TimelineItem = { ...closedIssue, number: 90, author: "alice", assignees: [] };
  const bobItem: TimelineItem   = { ...closedIssue, number: 91, author: "bob",   assignees: [] };
  const carolItem: TimelineItem = { ...closedIssue, number: 92, author: "carol", assignees: [] };

  it("passes items authored by any one of the selected people (OR logic)", () => {
    const f: Filters = { ...DEFAULT_FILTERS, activePeople: ["alice", "bob"], peopleRole: "author" };
    const result = applyFilters([aliceItem, bobItem, carolItem], f);

    expect(result).toContainEqual(aliceItem);
    expect(result).toContainEqual(bobItem);
    expect(result).not.toContainEqual(carolItem);
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

  it("includes items closed exactly on closedStart (inclusive lower bound)", () => {
    const boundary = issue({ number: 13, closedAt: "2025-01-25T00:00:00Z" });
    const f: Filters = { ...DEFAULT_FILTERS, closedStart: "2025-01-25" };

    expect(applyFilters([boundary], f)).toEqual([boundary]);
  });

  it("includes items closed exactly on closedEnd (inclusive upper bound)", () => {
    const boundary = issue({ number: 14, closedAt: "2025-01-25T23:59:59Z" });
    const f: Filters = { ...DEFAULT_FILTERS, closedEnd: "2025-01-25" };

    expect(applyFilters([boundary], f)).toEqual([boundary]);
  });
});
