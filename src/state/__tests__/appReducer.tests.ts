import type { Epic, Milestone, Repo, TimelineItem } from "../../types/GitHubTypes";
import type { AppState } from "../appReducer";
import { DEFAULT_FILTERS } from "../../types/FilterTypes";
import { appReducer, initialState } from "../appReducer";

const ms1: Milestone = { number: 1, title: "Sprint 1", state: "open", openIssues: 2, closedIssues: 8, dueOn: null };
const ms2: Milestone = { number: 2, title: "Sprint 2", state: "open", openIssues: 0, closedIssues: 5, dueOn: null };

const epic1: Epic = { number: 100, title: "Auth epic", state: "open", subIssueCount: 3, url: "https://github.com/o/r/issues/100" };

const repo: Repo = { id: 1, owner: "acme", name: "widget", fullName: "acme/widget", private: false, description: null };

const item: TimelineItem = {
  type: "issue", number: 42, title: "Fix bug",
  url: "https://github.com/o/r/issues/42", author: "jsmith",
  createdAt: "2025-01-10T00:00:00Z", updatedAt: "2025-01-20T00:00:00Z", closedAt: "2025-01-20T00:00:00Z",
  linkedPRs: [], milestoneNumber: 1,
  labels: [], assignees: [], reopenedCount: 0,
};

describe("initialState", () => {
  it("has empty collections and no loading/error state", () => {
    expect(initialState.milestones).toEqual([]);
    expect(initialState.selected).toEqual([]);
    expect(initialState.itemsCache).toEqual({});
    expect(initialState.loadingNums).toEqual([]);
    expect(initialState.loadingList).toBe(false);
    expect(initialState.epics).toEqual([]);
    expect(initialState.selectedEpics).toEqual([]);
    expect(initialState.epicItemsCache).toEqual({});
    expect(initialState.loadingEpicNums).toEqual([]);
    expect(initialState.loadingEpicList).toBe(false);
    expect(initialState.emptyEpicNums).toEqual([]);
    expect(initialState.isDemo).toBe(false);
    expect(initialState.error).toBeNull();
    expect(initialState.emptyMilestoneNums).toEqual([]);
    expect(initialState.activeRepo).toBeNull();
    expect(initialState.view).toBe("Gantt");
    expect(initialState.filters).toEqual(DEFAULT_FILTERS);
    expect(initialState.includePRs).toEqual({ burndown: false, cumulativeFlow: false, cycleTime: false, velocity: false });
  });
});

describe("FETCH_LIST_START", () => {
  it("sets loadingList and clears milestones/error but preserves selected and cache", () => {
    const state = { ...initialState, milestones: [ms1], selected: [ms1], itemsCache: { 1: [item] }, error: "prev error" };
    const next = appReducer(state, { type: "FETCH_LIST_START" });

    expect(next.loadingList).toBe(true);
    expect(next.milestones).toEqual([]);
    expect(next.selected).toEqual([ms1]);
    expect(next.itemsCache).toEqual({ 1: [item] });
    expect(next.error).toBeNull();
  });
});

describe("FETCH_LIST_SUCCESS", () => {
  it("stores milestones and clears loadingList", () => {
    const state = { ...initialState, loadingList: true };
    const next = appReducer(state, { type: "FETCH_LIST_SUCCESS", milestones: [ms1, ms2] });

    expect(next.milestones).toEqual([ms1, ms2]);
    expect(next.loadingList).toBe(false);
    expect(next.error).toBeNull();
  });

  it("sets an error when the milestone list is empty", () => {
    const state = { ...initialState, loadingList: true };
    const next = appReducer(state, { type: "FETCH_LIST_SUCCESS", milestones: [] });

    expect(next.error).toMatch(/no milestones/i);
  });
});

describe("FETCH_LIST_ERROR", () => {
  it("clears loadingList and surfaces the error", () => {
    const state = { ...initialState, loadingList: true };
    const next = appReducer(state, { type: "FETCH_LIST_ERROR", error: "network error" });

    expect(next.loadingList).toBe(false);
    expect(next.error).toBe("network error");
  });
});

describe("SELECT_MILESTONE", () => {
  it("appends the milestone to selected and clears error", () => {
    const state = { ...initialState, error: "stale error" };
    const next = appReducer(state, { type: "SELECT_MILESTONE", milestone: ms1 });

    expect(next.selected).toEqual([ms1]);
    expect(next.error).toBeNull();
  });

  it("can select multiple milestones independently", () => {
    const s1 = appReducer(initialState, { type: "SELECT_MILESTONE", milestone: ms1 });
    const s2 = appReducer(s1, { type: "SELECT_MILESTONE", milestone: ms2 });

    expect(s2.selected).toEqual([ms1, ms2]);
  });

  it("returns the same state reference when the milestone is already selected (duplicate guard)", () => {
    const s1 = appReducer(initialState, { type: "SELECT_MILESTONE", milestone: ms1 });
    const s2 = appReducer(s1, { type: "SELECT_MILESTONE", milestone: ms1 });

    expect(s2).toBe(s1);
    expect(s2.selected).toHaveLength(1);
  });
});

describe("FETCH_ITEMS_START", () => {
  it("adds the milestone number to loadingNums", () => {
    const next = appReducer(initialState, { type: "FETCH_ITEMS_START", milestoneNumber: 1 });

    expect(next.loadingNums).toContain(1);
  });

  it("tracks multiple milestones loading concurrently", () => {
    const s1 = appReducer(initialState, { type: "FETCH_ITEMS_START", milestoneNumber: 1 });
    const s2 = appReducer(s1, { type: "FETCH_ITEMS_START", milestoneNumber: 2 });

    expect(s2.loadingNums).toEqual([1, 2]);
  });
});

describe("FETCH_ITEMS_SUCCESS", () => {
  it("stores items in cache and removes number from loadingNums", () => {
    const state = { ...initialState, milestones: [ms1], loadingNums: [1] };
    const next = appReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 1, items: [item] });

    expect(next.itemsCache[1]).toEqual([item]);
    expect(next.loadingNums).not.toContain(1);
  });

  it("adds milestone number to emptyMilestoneNums when items array is empty", () => {
    const state = { ...initialState, milestones: [ms1], loadingNums: [1] };
    const next = appReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 1, items: [] });

    expect(next.emptyMilestoneNums).toContain(1);
    expect(next.error).toBeNull();
  });

  it("adds milestone number to emptyMilestoneNums even when not in milestone list", () => {
    const state = { ...initialState, milestones: [], loadingNums: [99] };
    const next = appReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 99, items: [] });

    expect(next.emptyMilestoneNums).toContain(99);
    expect(next.error).toBeNull();
  });

  it("does not duplicate milestone number in emptyMilestoneNums when already listed", () => {
    const state = { ...initialState, loadingNums: [1], emptyMilestoneNums: [1] };
    const next = appReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 1, items: [] });

    expect(next.emptyMilestoneNums.filter((n) => n === 1)).toHaveLength(1);
  });

  it("removes milestone from emptyMilestoneNums when it now has items", () => {
    const state = { ...initialState, loadingNums: [1], emptyMilestoneNums: [1] };
    const next = appReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 1, items: [item] });

    expect(next.emptyMilestoneNums).not.toContain(1);
  });
});

describe("FETCH_ITEMS_ERROR", () => {
  it("removes the milestone from selected and loadingNums, surfaces the error", () => {
    const state = { ...initialState, selected: [ms1], loadingNums: [1] };
    const next = appReducer(state, { type: "FETCH_ITEMS_ERROR", milestoneNumber: 1, error: "fetch failed" });

    expect(next.selected).toEqual([]);
    expect(next.loadingNums).not.toContain(1);
    expect(next.error).toBe("fetch failed");
  });
});

describe("REMOVE_MILESTONE", () => {
  it("removes the specified milestone from selected", () => {
    const state = { ...initialState, selected: [ms1, ms2] };
    const next = appReducer(state, { type: "REMOVE_MILESTONE", milestoneNumber: 1 });

    expect(next.selected).toEqual([ms2]);
  });

  it("is a no-op when the milestone is not selected", () => {
    const state = { ...initialState, selected: [ms2] };
    const next = appReducer(state, { type: "REMOVE_MILESTONE", milestoneNumber: 1 });

    expect(next.selected).toEqual([ms2]);
  });

  it("also removes the milestone from emptyMilestoneNums", () => {
    const state = { ...initialState, selected: [ms1], emptyMilestoneNums: [1, 2] };
    const next = appReducer(state, { type: "REMOVE_MILESTONE", milestoneNumber: 1 });

    expect(next.emptyMilestoneNums).toEqual([2]);
  });
});

describe("appReducer — exhaustiveness check", () => {
  it("TypeScript exhaustiveness: the never-typed default branch is unreachable for all known action types", () => {
    // This test documents the intent of the exhaustive switch. All known action types must
    // be handled; the default branch exists only as a compile-time guard (never type).
    // We verify the well-known actions are handled without throwing.
    expect(() => appReducer(initialState, { type: "RESET" })).not.toThrow();
    expect(() => appReducer(initialState, { type: "FETCH_LIST_START" })).not.toThrow();
  });
});

describe("REFRESH_ITEMS_ERROR", () => {
  it("keeps the milestone in selected and surfaces the error", () => {
    const state = { ...initialState, selected: [ms1], loadingNums: [1] };
    const next = appReducer(state, { type: "REFRESH_ITEMS_ERROR", milestoneNumber: 1, error: "timeout" });

    expect(next.selected).toEqual([ms1]);
    expect(next.loadingNums).not.toContain(1);
    expect(next.error).toBe("timeout");
  });
});

describe("RESET", () => {
  it("returns initialState regardless of prior state", () => {
    const state: AppState = {
      ...initialState,
      milestones: [ms1],
      selected: [ms1],
      itemsCache: { 1: [item] },
      error: "some error",
      loadingList: true,
      activeRepo: repo,
      view: "Burndown",
      filters: { ...DEFAULT_FILTERS, showOpenIssues: false },
      includePRs: { burndown: true, cumulativeFlow: false, cycleTime: true, velocity: false },
    };

    expect(appReducer(state, { type: "RESET" })).toEqual(initialState);
  });

  it("is idempotent — resetting initialState returns initialState", () => {
    expect(appReducer(initialState, { type: "RESET" })).toEqual(initialState);
  });
});

describe("LOAD_DEMO", () => {
  it("replaces milestone data with demo data and sets isDemo flag, preserving view/filters/includePRs", () => {
    const cache = { [ms1.number]: [item] };
    const priorView = "Burndown" as const;
    const priorFilters = { ...DEFAULT_FILTERS, showOpenIssues: false };
    const priorIncludePRs = { burndown: true, cumulativeFlow: false, cycleTime: false, velocity: false };
    const state: AppState = {
      ...initialState,
      view: priorView,
      filters: priorFilters,
      includePRs: priorIncludePRs,
    };
    const next = appReducer(state, {
      type: "LOAD_DEMO",
      milestones: [ms1, ms2],
      selected: [ms1],
      itemsCache: cache,
      epics: [],
      selectedEpics: [],
      epicItemsCache: {},
    });

    expect(next.milestones).toEqual([ms1, ms2]);
    expect(next.selected).toEqual([ms1]);
    expect(next.itemsCache).toEqual(cache);
    expect(next.isDemo).toBe(true);
    expect(next.loadingList).toBe(false);
    expect(next.loadingNums).toEqual([]);
    expect(next.error).toBeNull();
    // preserved fields
    expect(next.view).toBe(priorView);
    expect(next.filters).toEqual(priorFilters);
    expect(next.includePRs).toEqual(priorIncludePRs);
  });
});

describe("LOAD_DEMO — activeRepo preservation", () => {
  it("preserves activeRepo from prior state", () => {
    const stateWithRepo = { ...initialState, activeRepo: repo };
    const next = appReducer(stateWithRepo, {
      type: "LOAD_DEMO",
      milestones: [],
      selected: [],
      itemsCache: {},
      epics: [],
      selectedEpics: [],
      epicItemsCache: {},
    });

    expect(next.activeRepo).toEqual(repo);
  });
});

describe("SET_REPO", () => {
  it("sets activeRepo and resets all milestone-related state", () => {
    const state: AppState = {
      ...initialState,
      milestones: [ms1],
      selected: [ms1],
      itemsCache: { 1: [item] },
      loadingNums: [1],
      loadingList: true,
      isDemo: true,
      error: "old error",
      emptyMilestoneNums: [1],
      view: "Burndown",
      filters: { ...DEFAULT_FILTERS, showOpenIssues: false },
      includePRs: { burndown: true, cumulativeFlow: false, cycleTime: false, velocity: false },
    };
    const next = appReducer(state, { type: "SET_REPO", repo });

    expect(next.activeRepo).toBe(repo);
    expect(next.milestones).toEqual([]);
    expect(next.selected).toEqual([]);
    expect(next.itemsCache).toEqual({});
    expect(next.loadingNums).toEqual([]);
    expect(next.loadingList).toBe(false);
    expect(next.isDemo).toBe(false);
    expect(next.error).toBeNull();
    expect(next.emptyMilestoneNums).toEqual([]);
    // view, filters, includePRs should be preserved
    expect(next.view).toBe("Burndown");
    expect(next.filters).toEqual({ ...DEFAULT_FILTERS, showOpenIssues: false });
    expect(next.includePRs).toEqual({ burndown: true, cumulativeFlow: false, cycleTime: false, velocity: false });
  });

  it("can clear the repo by passing null", () => {
    const state = { ...initialState, activeRepo: repo };
    const next = appReducer(state, { type: "SET_REPO", repo: null });

    expect(next.activeRepo).toBeNull();
  });
});

describe("SET_VIEW", () => {
  it("updates only the view field", () => {
    const state = { ...initialState, activeRepo: repo, view: "Gantt" as const };
    const next = appReducer(state, { type: "SET_VIEW", view: "Burndown" });

    expect(next.view).toBe("Burndown");
    expect(next.activeRepo).toBe(repo);
    expect(next.filters).toEqual(DEFAULT_FILTERS);
  });
});

describe("SET_FILTERS", () => {
  it("replaces the entire filters object", () => {
    const newFilters = { ...DEFAULT_FILTERS, showOpenIssues: false };
    const next = appReducer(initialState, { type: "SET_FILTERS", filters: newFilters });

    expect(next.filters).toEqual(newFilters);
    expect(next.view).toBe("Gantt");
  });
});

describe("PATCH_FILTERS", () => {
  it("merges the patch into the existing filters", () => {
    const state = { ...initialState, filters: { ...DEFAULT_FILTERS, showOpenIssues: true, showClosedIssues: true } };
    const next = appReducer(state, { type: "PATCH_FILTERS", patch: { showOpenIssues: false } });

    expect(next.filters.showOpenIssues).toBe(false);
    expect(next.filters.showClosedIssues).toBe(true);
  });
});

describe("SET_INCLUDE_PRS", () => {
  it("updates only the addressed chart key", () => {
    const state = { ...initialState, includePRs: { burndown: false, cumulativeFlow: false, cycleTime: false, velocity: false } };
    const next = appReducer(state, { type: "SET_INCLUDE_PRS", chart: "burndown", value: true });

    expect(next.includePRs.burndown).toBe(true);
    expect(next.includePRs.cumulativeFlow).toBe(false);
    expect(next.includePRs.cycleTime).toBe(false);
    expect(next.includePRs.velocity).toBe(false);
  });

  it("can toggle each chart independently", () => {
    let state = initialState;
    state = appReducer(state, { type: "SET_INCLUDE_PRS", chart: "cycleTime", value: true });
    state = appReducer(state, { type: "SET_INCLUDE_PRS", chart: "velocity", value: true });

    expect(state.includePRs.burndown).toBe(false);
    expect(state.includePRs.cumulativeFlow).toBe(false);
    expect(state.includePRs.cycleTime).toBe(true);
    expect(state.includePRs.velocity).toBe(true);
  });
});

describe("SELECT_EPIC", () => {
  it("appends the epic to selectedEpics", () => {
    const next = appReducer(initialState, { type: "SELECT_EPIC", epic: epic1 });

    expect(next.selectedEpics).toEqual([epic1]);
    expect(next.error).toBeNull();
  });

  it("returns the same state reference for a duplicate (already selected)", () => {
    const s1 = appReducer(initialState, { type: "SELECT_EPIC", epic: epic1 });
    const s2 = appReducer(s1, { type: "SELECT_EPIC", epic: epic1 });

    expect(s2).toBe(s1);
    expect(s2.selectedEpics).toHaveLength(1);
  });
});

describe("REMOVE_EPIC", () => {
  it("removes the specified epic from selectedEpics", () => {
    const state = { ...initialState, selectedEpics: [epic1], emptyEpicNums: [100] };
    const next = appReducer(state, { type: "REMOVE_EPIC", epicNumber: 100 });

    expect(next.selectedEpics).toEqual([]);
    expect(next.emptyEpicNums).toEqual([]);
  });

  it("is a no-op when the epic is not selected", () => {
    const state = { ...initialState, selectedEpics: [] };
    const next = appReducer(state, { type: "REMOVE_EPIC", epicNumber: 100 });

    expect(next.selectedEpics).toEqual([]);
  });
});

describe("FETCH_EPIC_ITEMS_SUCCESS", () => {
  it("stores items in epicItemsCache and removes number from loadingEpicNums", () => {
    const epicItem: TimelineItem = { ...item, milestoneNumber: 100 };
    const state = { ...initialState, loadingEpicNums: [100] };
    const next = appReducer(state, { type: "FETCH_EPIC_ITEMS_SUCCESS", epicNumber: 100, items: [epicItem] });

    expect(next.epicItemsCache[100]).toEqual([epicItem]);
    expect(next.loadingEpicNums).not.toContain(100);
    expect(next.emptyEpicNums).not.toContain(100);
  });

  it("adds epicNumber to emptyEpicNums when items array is empty", () => {
    const state = { ...initialState, loadingEpicNums: [100] };
    const next = appReducer(state, { type: "FETCH_EPIC_ITEMS_SUCCESS", epicNumber: 100, items: [] });

    expect(next.emptyEpicNums).toContain(100);
    expect(next.loadingEpicNums).not.toContain(100);
  });
});
