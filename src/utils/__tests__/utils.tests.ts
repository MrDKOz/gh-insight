import type { TimelineItem } from "../../types/GitHubTypes";
import { DEFAULT_FILTERS, applyFilters } from "../../types/FilterTypes";
import { COLORS, COLORS_CB, EPIC_COLORS, EPIC_COLORS_CB, MILESTONE_COLORS, MILESTONE_COLORS_CB, labelTextColor, makeChartColors, makeStatusChipSx } from "../colorUtils";
import { MS_PER_DAY, MS_PER_HOUR, durationDays, fmtDate, fmtDateTime, forecastCompletion, snapToHour } from "../dateUtils";
import { assigneesOtherThanAuthor, hoverCardPos, itemEndDate, itemStatus, pluralize, safeUrl, upperBound } from "../displayUtils";
import { readViewFiltersFromUrl, setViewParam, syncFiltersToUrl } from "../urlUtils";

const issue = (overrides: Partial<{ closedAt: string | null }> = {}): TimelineItem => ({
  type: "issue", number: 1, title: "Test issue",
  url: "https://github.com/o/r/issues/1", author: "jsmith",
  createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z", closedAt: null,
  linkedPRs: [], milestoneNumber: 1,
  labels: [], assignees: [], reopenedCount: 0,
  ...overrides,
});

const pr = (overrides: Partial<{ mergedAt: string | null; closedAt: string | null }> = {}): TimelineItem => ({
  type: "pr", number: 2, title: "Test PR",
  url: "https://github.com/o/r/pull/2", author: "a-jones",
  createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z", mergedAt: null, closedAt: null,
  isDraft: false, reviewDecision: null, additions: 20, deletions: 5,
  linkedIssue: null, milestoneNumber: 1,
  labels: [], assignees: [], firstReviewAt: null,
  ...overrides,
});

describe("MS_PER_DAY", () => {
  it("equals the number of milliseconds in one day", () => {
    expect(MS_PER_DAY).toBe(24 * 60 * 60 * 1000);
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

describe("MS_PER_HOUR", () => {
  it("equals the number of milliseconds in one hour", () => {
    expect(MS_PER_HOUR).toBe(60 * 60 * 1000);
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
    const expectedKeys = ["issue", "prMerged", "prClosed", "axis", "grid", "label", "cursor", "openFill", "median", "mean", "today", "todayLabel", "weekendBand"];
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

// ---------------------------------------------------------------------------
// forecastCompletion
// ---------------------------------------------------------------------------

// Use a fixed "today" far from epoch to avoid edge cases
const TODAY_DAY = 500; // day 500 from epoch as the fixed "now"
const TODAY_MS  = TODAY_DAY * MS_PER_DAY;

const mkForecastIssue = (
  num: number,
  createdDay: number,
  closedDay: number | null,
  milestoneNumber = 1,
): TimelineItem => ({
  type: "issue",
  number: num,
  title: `Issue ${num}`,
  url: `https://github.com/o/r/issues/${num}`,
  author: "alice",
  createdAt: new Date(createdDay * MS_PER_DAY).toISOString(),
  updatedAt: new Date((closedDay ?? createdDay) * MS_PER_DAY).toISOString(),
  closedAt: closedDay !== null ? new Date(closedDay * MS_PER_DAY).toISOString() : null,
  linkedPRs: [],
  milestoneNumber,
  labels: [],
  assignees: [],
  reopenedCount: 0,
});

describe("forecastCompletion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY_MS);
  });

  afterEach(() => vi.useRealTimers());

  it("returns null for an empty items array", () => {
    expect(forecastCompletion([])).toBeNull();
  });

  it("returns null when all issues are closed", () => {
    const items = [mkForecastIssue(1, 490, 495), mkForecastIssue(2, 490, 498)];

    expect(forecastCompletion(items)).toBeNull();
  });

  it("returns null when there are no closed issues (velocity impossible)", () => {
    const items = [mkForecastIssue(1, 499, null), mkForecastIssue(2, 499, null)];

    expect(forecastCompletion(items)).toBeNull();
  });

  it("returns null when projection exceeds 365 days", () => {
    // 1 closed issue, 500 open — average rate gives ~5000 days
    const items = [
      mkForecastIssue(1, 470, 490),
      ...Array.from({ length: 500 }, (_, i) => mkForecastIssue(i + 2, 470, null)),
    ];

    expect(forecastCompletion(items)).toBeNull();
  });

  it("returns a result when there is a reasonable velocity", () => {
    // 5 closed over 10 days, 2 open → daysPerClose = 10/5 = 2 → candidate = today + 4 days
    const items = [
      mkForecastIssue(1, 490, 492),
      mkForecastIssue(2, 490, 494),
      mkForecastIssue(3, 490, 496),
      mkForecastIssue(4, 490, 498),
      mkForecastIssue(5, 490, 500),
      mkForecastIssue(6, 490, null),
      mkForecastIssue(7, 490, null),
    ];
    const result = forecastCompletion(items);

    expect(result).not.toBeNull();
    expect(result?.projectedDate.getTime()).toBeGreaterThan(TODAY_MS);
    expect(result?.projectedDate.getTime()).toBeLessThanOrEqual(TODAY_MS + 365 * MS_PER_DAY);
  });

  it("reports correct openCount and closedCount", () => {
    const items = [
      mkForecastIssue(1, 490, 495),
      mkForecastIssue(2, 490, 497),
      mkForecastIssue(3, 490, null),
    ];
    const result = forecastCompletion(items);

    expect(result?.openCount).toBe(1);
    expect(result?.closedCount).toBe(2);
  });

  it("filters by milestoneNumber when provided", () => {
    const items = [
      mkForecastIssue(1, 490, 495, 1),  // ms 1, closed
      mkForecastIssue(2, 490, null, 1), // ms 1, open
      mkForecastIssue(3, 490, null, 2), // ms 2, open — should be ignored
      mkForecastIssue(4, 490, null, 2), // ms 2, open — should be ignored
    ];
    const result = forecastCompletion(items, 1);

    expect(result?.openCount).toBe(1);
    expect(result?.closedCount).toBe(1);
  });

  it("ignores non-issue items (PRs) regardless of milestone", () => {
    const prItem: TimelineItem = {
      type: "pr", number: 99, title: "A PR",
      url: "https://github.com/o/r/pull/99", author: "bob",
      createdAt: new Date(490 * MS_PER_DAY).toISOString(),
      updatedAt: new Date(495 * MS_PER_DAY).toISOString(),
      mergedAt: new Date(495 * MS_PER_DAY).toISOString(),
      closedAt: new Date(495 * MS_PER_DAY).toISOString(),
      isDraft: false, reviewDecision: null, additions: 5, deletions: 2,
      linkedIssue: null, milestoneNumber: 1,
      labels: [], assignees: [], firstReviewAt: null,
    };
    const items = [prItem, mkForecastIssue(1, 490, null)];

    // Only 1 open issue, 0 closed → no forecast possible
    expect(forecastCompletion(items)).toBeNull();
  });

  it("method is either 'regression' or 'velocity'", () => {
    const items = [
      mkForecastIssue(1, 470, 480),
      mkForecastIssue(2, 470, 485),
      mkForecastIssue(3, 470, 490),
      mkForecastIssue(4, 470, null),
    ];
    const result = forecastCompletion(items);
    if (result !== null) {
      expect(["regression", "velocity"]).toContain(result.method);
    }
  });

  it("totalDays reflects the span from first creation to today", () => {
    const items = [
      mkForecastIssue(1, 490, 495), // created day 490
      mkForecastIssue(2, 490, null),
    ];
    const result = forecastCompletion(items);

    // totalDays = ceil((today - day490) / MS) = 10
    expect(result?.totalDays).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// readViewFiltersFromUrl / syncFiltersToUrl round-trip tests
// ---------------------------------------------------------------------------

describe("syncFiltersToUrl / readViewFiltersFromUrl", () => {
  beforeEach(() => {
    // Reset to a clean URL before each test using jsdom's real history API
    window.history.pushState(null, "", "/");
  });

  it("round-trips filters with labels, people, and status toggles", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      showOpenIssues: false,
      showMergedPRs: false,
      activeLabels: ["bug", "enhancement"],
      activePeople: ["alice", "bob"],
      peopleRole: "author" as const,
    };
    syncFiltersToUrl(filters);
    const { filters: result } = readViewFiltersFromUrl();

    expect(result.showOpenIssues).toBe(false);
    expect(result.showMergedPRs).toBe(false);
    expect(result.activeLabels).toEqual(["bug", "enhancement"]);
    expect(result.activePeople).toEqual(["alice", "bob"]);
    expect(result.peopleRole).toBe("author");
  });

  it("round-trips a non-default view via setViewParam", () => {
    setViewParam("Burndown");
    const { view } = readViewFiltersFromUrl();

    expect(view).toBe("Burndown");
  });

  it("round-trips the default view without leaving a 'view' param in the URL", () => {
    setViewParam("Gantt");
    const { view } = readViewFiltersFromUrl();

    // DEFAULT_VIEW is "Gantt" — the param should be omitted and the result defaults back
    expect(view).toBe("Gantt");
  });

  it("empty labels and people arrays round-trip without producing stray params", () => {
    syncFiltersToUrl({ ...DEFAULT_FILTERS, activeLabels: [], activePeople: [] });
    const { filters } = readViewFiltersFromUrl();

    expect(filters.activeLabels).toEqual([]);
    expect(filters.activePeople).toEqual([]);
    // The search string should not contain labels= or people= with empty value
    expect(window.location.search).not.toMatch(/labels=/);
    expect(window.location.search).not.toMatch(/people=/);
  });

  it("survives a round-trip when a label contains special characters", () => {
    const label = "bug|feature";
    syncFiltersToUrl({ ...DEFAULT_FILTERS, activeLabels: [label] });
    const { filters } = readViewFiltersFromUrl();

    expect(filters.activeLabels).toEqual([label]);
  });
});

// ---------------------------------------------------------------------------
// applyFilters
// ---------------------------------------------------------------------------

describe("applyFilters", () => {
  const closedIssue = (): TimelineItem => ({
    type: "issue", number: 1, title: "Closed",
    url: "https://github.com/o/r/issues/1", author: "alice",
    createdAt: "2025-03-01T00:00:00Z", updatedAt: "2025-03-10T00:00:00Z",
    closedAt: "2025-03-10T00:00:00Z",
    linkedPRs: [], milestoneNumber: 1, labels: [], assignees: [], reopenedCount: 0,
  });
  const openIssue = (): TimelineItem => ({
    type: "issue", number: 2, title: "Open",
    url: "https://github.com/o/r/issues/2", author: "bob",
    createdAt: "2025-04-01T00:00:00Z", updatedAt: "2025-04-01T00:00:00Z",
    closedAt: null,
    linkedPRs: [], milestoneNumber: 1, labels: [{ name: "bug", color: "#d73a4a" }], assignees: ["carol"], reopenedCount: 0,
  });
  const mergedPR = (): TimelineItem => ({
    type: "pr", number: 3, title: "Merged PR",
    url: "https://github.com/o/r/pull/3", author: "carol",
    createdAt: "2025-03-05T00:00:00Z", updatedAt: "2025-03-08T00:00:00Z",
    mergedAt: "2025-03-08T00:00:00Z", closedAt: "2025-03-08T00:00:00Z",
    isDraft: false, reviewDecision: null, additions: 10, deletions: 2,
    linkedIssue: null, milestoneNumber: 1, labels: [], assignees: [], firstReviewAt: null,
  });

  it("returns all items when no filters are active", () => {
    const items = [closedIssue(), openIssue(), mergedPR()];

    expect(applyFilters(items, DEFAULT_FILTERS)).toHaveLength(3);
  });

  it("hides open issues when showOpenIssues is false", () => {
    const result = applyFilters([closedIssue(), openIssue()], { ...DEFAULT_FILTERS, showOpenIssues: false });

    expect(result.map((i) => i.number)).toEqual([1]);
  });

  it("hides closed issues when showClosedIssues is false", () => {
    const result = applyFilters([closedIssue(), openIssue()], { ...DEFAULT_FILTERS, showClosedIssues: false });

    expect(result.map((i) => i.number)).toEqual([2]);
  });

  it("hides merged PRs when showMergedPRs is false", () => {
    const result = applyFilters([closedIssue(), mergedPR()], { ...DEFAULT_FILTERS, showMergedPRs: false });

    expect(result.map((i) => i.number)).toEqual([1]);
  });

  it("filters by createdStart — excludes items created before the start date", () => {
    const result = applyFilters([closedIssue(), openIssue()], { ...DEFAULT_FILTERS, createdStart: "2025-04-01" });

    expect(result.map((i) => i.number)).toEqual([2]);
  });

  it("filters by createdEnd — excludes items created after the end date", () => {
    const result = applyFilters([closedIssue(), openIssue()], { ...DEFAULT_FILTERS, createdEnd: "2025-03-31" });

    expect(result.map((i) => i.number)).toEqual([1]);
  });

  it("filters by closedStart — excludes open items and items closed before the start", () => {
    // closedIssue closed on 2025-03-10, openIssue has no close date
    const result = applyFilters([closedIssue(), openIssue()], { ...DEFAULT_FILTERS, closedStart: "2025-03-10" });

    expect(result.map((i) => i.number)).toEqual([1]);
  });

  it("excludes open items when a closedEnd filter is set (open items have no end date)", () => {
    const result = applyFilters([closedIssue(), openIssue()], { ...DEFAULT_FILTERS, closedEnd: "2025-12-31" });

    expect(result.map((i) => i.number)).toEqual([1]);
  });

  it("filters by activeLabels — only items with at least one matching label pass", () => {
    const result = applyFilters([closedIssue(), openIssue()], { ...DEFAULT_FILTERS, activeLabels: ["bug"] });

    // only openIssue has the "bug" label
    expect(result.map((i) => i.number)).toEqual([2]);
  });

  it("filters by activePeople with role 'author'", () => {
    const result = applyFilters(
      [closedIssue(), openIssue()],
      { ...DEFAULT_FILTERS, activePeople: ["alice"], peopleRole: "author" },
    );

    expect(result.map((i) => i.number)).toEqual([1]);
  });

  it("filters by activePeople with role 'assignees'", () => {
    const result = applyFilters(
      [closedIssue(), openIssue()],
      { ...DEFAULT_FILTERS, activePeople: ["carol"], peopleRole: "assignees" },
    );

    // closedIssue has no assignees; openIssue assigns carol
    expect(result.map((i) => i.number)).toEqual([2]);
  });

  it("filters by activePeople with role 'either' — matches author or assignee", () => {
    const result = applyFilters(
      [closedIssue(), openIssue()],
      { ...DEFAULT_FILTERS, activePeople: ["alice", "carol"], peopleRole: "either" },
    );

    expect(result.map((i) => i.number)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// MILESTONE_COLORS / EPIC_COLORS palette arrays
// ---------------------------------------------------------------------------

describe("MILESTONE_COLORS", () => {
  it("contains six hex colour strings", () => {
    expect(MILESTONE_COLORS).toHaveLength(6);

    for (const c of MILESTONE_COLORS) { expect(c).toMatch(/^#[0-9a-f]{6}$/i); }
  });
});

describe("MILESTONE_COLORS_CB", () => {
  it("contains six hex colour strings", () => {
    expect(MILESTONE_COLORS_CB).toHaveLength(6);

    for (const c of MILESTONE_COLORS_CB) { expect(c).toMatch(/^#[0-9a-f]{6}$/i); }
  });

  it("differs from the default palette (colorblind variants are distinct)", () => {
    expect(MILESTONE_COLORS_CB).not.toEqual(MILESTONE_COLORS);
  });
});

describe("EPIC_COLORS", () => {
  it("contains six hex colour strings", () => {
    expect(EPIC_COLORS).toHaveLength(6);

    for (const c of EPIC_COLORS) { expect(c).toMatch(/^#[0-9a-f]{6}$/i); }
  });

  it("differs from MILESTONE_COLORS (warm vs cool hues)", () => {
    expect(EPIC_COLORS[0]).not.toBe(MILESTONE_COLORS[0]);
  });
});

describe("EPIC_COLORS_CB", () => {
  it("contains six hex colour strings", () => {
    expect(EPIC_COLORS_CB).toHaveLength(6);

    for (const c of EPIC_COLORS_CB) { expect(c).toMatch(/^#[0-9a-f]{6}$/i); }
  });
});
