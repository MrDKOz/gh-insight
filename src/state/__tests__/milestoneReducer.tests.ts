import type { Milestone, TimelineItem } from "../../types";
import { initialState, milestoneReducer } from "../milestoneReducer";

const ms1: Milestone = { number: 1, title: "Sprint 1", state: "open", openIssues: 2, closedIssues: 8, dueOn: null };
const ms2: Milestone = { number: 2, title: "Sprint 2", state: "open", openIssues: 0, closedIssues: 5, dueOn: null };

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
    expect(initialState.isDemo).toBe(false);
    expect(initialState.error).toBeNull();
    expect(initialState.emptyMilestoneNums).toEqual([]);
  });
});

describe("FETCH_LIST_START", () => {
  it("sets loadingList and clears milestones/error but preserves selected and cache", () => {
    const state = { ...initialState, milestones: [ms1], selected: [ms1], itemsCache: { 1: [item] }, error: "prev error" };
    const next = milestoneReducer(state, { type: "FETCH_LIST_START" });

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
    const next = milestoneReducer(state, { type: "FETCH_LIST_SUCCESS", milestones: [ms1, ms2] });

    expect(next.milestones).toEqual([ms1, ms2]);
    expect(next.loadingList).toBe(false);
    expect(next.error).toBeNull();
  });

  it("sets an error when the milestone list is empty", () => {
    const state = { ...initialState, loadingList: true };
    const next = milestoneReducer(state, { type: "FETCH_LIST_SUCCESS", milestones: [] });

    expect(next.error).toMatch(/no milestones/i);
  });
});

describe("FETCH_LIST_ERROR", () => {
  it("clears loadingList and surfaces the error", () => {
    const state = { ...initialState, loadingList: true };
    const next = milestoneReducer(state, { type: "FETCH_LIST_ERROR", error: "network error" });

    expect(next.loadingList).toBe(false);
    expect(next.error).toBe("network error");
  });
});

describe("SELECT_MILESTONE", () => {
  it("appends the milestone to selected and clears error", () => {
    const state = { ...initialState, error: "stale error" };
    const next = milestoneReducer(state, { type: "SELECT_MILESTONE", milestone: ms1 });

    expect(next.selected).toEqual([ms1]);
    expect(next.error).toBeNull();
  });

  it("can select multiple milestones independently", () => {
    const s1 = milestoneReducer(initialState, { type: "SELECT_MILESTONE", milestone: ms1 });
    const s2 = milestoneReducer(s1, { type: "SELECT_MILESTONE", milestone: ms2 });

    expect(s2.selected).toEqual([ms1, ms2]);
  });
});

describe("FETCH_ITEMS_START", () => {
  it("adds the milestone number to loadingNums", () => {
    const next = milestoneReducer(initialState, { type: "FETCH_ITEMS_START", milestoneNumber: 1 });

    expect(next.loadingNums).toContain(1);
  });

  it("tracks multiple milestones loading concurrently", () => {
    const s1 = milestoneReducer(initialState, { type: "FETCH_ITEMS_START", milestoneNumber: 1 });
    const s2 = milestoneReducer(s1, { type: "FETCH_ITEMS_START", milestoneNumber: 2 });

    expect(s2.loadingNums).toEqual([1, 2]);
  });
});

describe("FETCH_ITEMS_SUCCESS", () => {
  it("stores items in cache and removes number from loadingNums", () => {
    const state = { ...initialState, milestones: [ms1], loadingNums: [1] };
    const next = milestoneReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 1, items: [item] });

    expect(next.itemsCache[1]).toEqual([item]);
    expect(next.loadingNums).not.toContain(1);
  });

  it("adds milestone number to emptyMilestoneNums when items array is empty", () => {
    const state = { ...initialState, milestones: [ms1], loadingNums: [1] };
    const next = milestoneReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 1, items: [] });

    expect(next.emptyMilestoneNums).toContain(1);
    expect(next.error).toBeNull();
  });

  it("adds milestone number to emptyMilestoneNums even when not in milestone list", () => {
    const state = { ...initialState, milestones: [], loadingNums: [99] };
    const next = milestoneReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 99, items: [] });

    expect(next.emptyMilestoneNums).toContain(99);
    expect(next.error).toBeNull();
  });

  it("does not duplicate milestone number in emptyMilestoneNums when already listed", () => {
    const state = { ...initialState, loadingNums: [1], emptyMilestoneNums: [1] };
    const next = milestoneReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 1, items: [] });

    expect(next.emptyMilestoneNums.filter((n) => n === 1)).toHaveLength(1);
  });

  it("removes milestone from emptyMilestoneNums when it now has items", () => {
    const state = { ...initialState, loadingNums: [1], emptyMilestoneNums: [1] };
    const next = milestoneReducer(state, { type: "FETCH_ITEMS_SUCCESS", milestoneNumber: 1, items: [item] });

    expect(next.emptyMilestoneNums).not.toContain(1);
  });
});

describe("FETCH_ITEMS_ERROR", () => {
  it("removes the milestone from selected and loadingNums, surfaces the error", () => {
    const state = { ...initialState, selected: [ms1], loadingNums: [1] };
    const next = milestoneReducer(state, { type: "FETCH_ITEMS_ERROR", milestoneNumber: 1, error: "fetch failed" });

    expect(next.selected).toEqual([]);
    expect(next.loadingNums).not.toContain(1);
    expect(next.error).toBe("fetch failed");
  });
});

describe("REMOVE_MILESTONE", () => {
  it("removes the specified milestone from selected", () => {
    const state = { ...initialState, selected: [ms1, ms2] };
    const next = milestoneReducer(state, { type: "REMOVE_MILESTONE", milestoneNumber: 1 });

    expect(next.selected).toEqual([ms2]);
  });

  it("is a no-op when the milestone is not selected", () => {
    const state = { ...initialState, selected: [ms2] };
    const next = milestoneReducer(state, { type: "REMOVE_MILESTONE", milestoneNumber: 1 });

    expect(next.selected).toEqual([ms2]);
  });

  it("also removes the milestone from emptyMilestoneNums", () => {
    const state = { ...initialState, selected: [ms1], emptyMilestoneNums: [1, 2] };
    const next = milestoneReducer(state, { type: "REMOVE_MILESTONE", milestoneNumber: 1 });

    expect(next.emptyMilestoneNums).toEqual([2]);
  });
});

describe("milestoneReducer — default case", () => {
  it("returns state unchanged for an unknown action type", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = milestoneReducer(initialState, { type: "UNKNOWN_ACTION" } as any);

    expect(next).toBe(initialState);
  });
});

describe("REFRESH_ITEMS_ERROR", () => {
  it("keeps the milestone in selected and surfaces the error", () => {
    const state = { ...initialState, selected: [ms1], loadingNums: [1] };
    const next = milestoneReducer(state, { type: "REFRESH_ITEMS_ERROR", milestoneNumber: 1, error: "timeout" });

    expect(next.selected).toEqual([ms1]);
    expect(next.loadingNums).not.toContain(1);
    expect(next.error).toBe("timeout");
  });
});

describe("RESET", () => {
  it("returns initialState regardless of prior state", () => {
    const state = {
      ...initialState,
      milestones: [ms1],
      selected: [ms1],
      itemsCache: { 1: [item] },
      error: "some error",
      loadingList: true,
    };

    expect(milestoneReducer(state, { type: "RESET" })).toEqual(initialState);
  });

  it("is idempotent — resetting initialState returns initialState", () => {
    expect(milestoneReducer(initialState, { type: "RESET" })).toEqual(initialState);
  });
});

describe("LOAD_DEMO", () => {
  it("replaces state with demo data and sets isDemo flag", () => {
    const cache = { [ms1.number]: [item] };
    const next = milestoneReducer(initialState, {
      type: "LOAD_DEMO",
      milestones: [ms1, ms2],
      selected: [ms1],
      itemsCache: cache,
    });

    expect(next.milestones).toEqual([ms1, ms2]);
    expect(next.selected).toEqual([ms1]);
    expect(next.itemsCache).toEqual(cache);
    expect(next.isDemo).toBe(true);
    expect(next.loadingList).toBe(false);
    expect(next.loadingNums).toEqual([]);
    expect(next.error).toBeNull();
  });
});
