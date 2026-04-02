import type { View } from "../types/AppTypes";
import type { Filters } from "../types/FilterTypes";
import type { Epic, Milestone, Repo, TimelineItem } from "../types/GitHubTypes";
import { DEFAULT_VIEW } from "../types/AppTypes";
import { DEFAULT_FILTERS } from "../types/FilterTypes";

type AppState = {
  // ── Milestone slice ───────────────────────────────────────────────────────
  milestones: Milestone[];
  selected: Milestone[];
  itemsCache: Record<number, TimelineItem[]>;
  loadingNums: number[];
  loadingList: boolean;
  loadingMoreMilestones: boolean;
  milestonesHasMore: boolean;
  milestonesNextPage: number;
  emptyMilestoneNums: number[];
  // ── Epic slice ────────────────────────────────────────────────────────────
  epics: Epic[];
  selectedEpics: Epic[];
  epicItemsCache: Record<number, TimelineItem[]>;
  loadingEpicNums: number[];
  loadingEpicList: boolean;
  loadingMoreEpics: boolean;
  epicsHasMore: boolean;
  emptyEpicNums: number[];
  // ── Shared ────────────────────────────────────────────────────────────────
  isDemo: boolean;
  error: string | null;
  activeRepo: Repo | null;
  view: View;
  filters: Filters;
  includePRs: { burndown: boolean; cumulativeFlow: boolean; cycleTime: boolean; velocity: boolean };
};

type Action =
  // Milestone actions
  | { type: "FETCH_LIST_START" }
  | { type: "FETCH_LIST_SUCCESS"; milestones: Milestone[]; hasMore: boolean; nextPage: number }
  | { type: "FETCH_LIST_ERROR"; error: string }
  | { type: "FETCH_MORE_MILESTONES_START" }
  | { type: "FETCH_MORE_MILESTONES_SUCCESS"; milestones: Milestone[] }
  | { type: "FETCH_MORE_MILESTONES_ERROR"; error: string }
  | { type: "SELECT_MILESTONE"; milestone: Milestone }
  | { type: "FETCH_ITEMS_START"; milestoneNumber: number }
  | { type: "FETCH_ITEMS_SUCCESS"; milestoneNumber: number; items: TimelineItem[] }
  | { type: "FETCH_ITEMS_ERROR"; milestoneNumber: number; error: string }
  | { type: "REMOVE_MILESTONE"; milestoneNumber: number }
  | { type: "REFRESH_ITEMS_ERROR"; milestoneNumber: number; error: string }
  // Epic actions
  | { type: "FETCH_EPIC_LIST_START" }
  | { type: "FETCH_EPIC_LIST_SUCCESS"; epics: Epic[]; hasMore: boolean }
  | { type: "FETCH_EPIC_LIST_ERROR"; error: string }
  | { type: "FETCH_MORE_EPICS_START" }
  | { type: "FETCH_MORE_EPICS_SUCCESS"; epics: Epic[] }
  | { type: "FETCH_MORE_EPICS_ERROR"; error: string }
  | { type: "SELECT_EPIC"; epic: Epic }
  | { type: "FETCH_EPIC_ITEMS_START"; epicNumber: number }
  | { type: "FETCH_EPIC_ITEMS_SUCCESS"; epicNumber: number; items: TimelineItem[] }
  | { type: "FETCH_EPIC_ITEMS_ERROR"; epicNumber: number; error: string }
  | { type: "REMOVE_EPIC"; epicNumber: number }
  | { type: "REFRESH_EPIC_ITEMS_ERROR"; epicNumber: number; error: string }
  // Shared actions
  | { type: "LOAD_DEMO"; milestones: Milestone[]; selected: Milestone[]; itemsCache: Record<number, TimelineItem[]>; epics: Epic[]; selectedEpics: Epic[]; epicItemsCache: Record<number, TimelineItem[]> }
  | { type: "RESET" }
  | { type: "SET_REPO"; repo: Repo | null }
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_FILTERS"; filters: Filters }
  | { type: "PATCH_FILTERS"; patch: Partial<Filters> }
  | { type: "SET_INCLUDE_PRS"; chart: "burndown" | "cumulativeFlow" | "cycleTime" | "velocity"; value: boolean };

const initialState: AppState = {
  milestones: [],
  selected: [],
  itemsCache: {},
  loadingNums: [],
  loadingList: false,
  loadingMoreMilestones: false,
  milestonesHasMore: false,
  milestonesNextPage: 1,
  emptyMilestoneNums: [],
  epics: [],
  selectedEpics: [],
  epicItemsCache: {},
  loadingEpicNums: [],
  loadingEpicList: false,
  loadingMoreEpics: false,
  epicsHasMore: false,
  emptyEpicNums: [],
  isDemo: false,
  error: null,
  activeRepo: null,
  view: DEFAULT_VIEW,
  filters: DEFAULT_FILTERS,
  includePRs: { burndown: false, cumulativeFlow: false, cycleTime: false, velocity: false },
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case "FETCH_LIST_START":
      return { ...state, milestones: [], loadingList: true, error: null };

    case "FETCH_LIST_SUCCESS":
      return {
        ...state,
        milestones: action.milestones,
        loadingList: false,
        milestonesHasMore: action.hasMore,
        milestonesNextPage: action.nextPage,
        error: null,
      };

    case "FETCH_MORE_MILESTONES_START":
      return { ...state, loadingMoreMilestones: true };

    case "FETCH_MORE_MILESTONES_SUCCESS":
      return {
        ...state,
        loadingMoreMilestones: false,
        milestonesHasMore: false,
        milestones: [...state.milestones, ...action.milestones].sort((a, b) => a.title.localeCompare(b.title)),
      };

    case "FETCH_MORE_MILESTONES_ERROR":
      return { ...state, loadingMoreMilestones: false, error: action.error };

    case "FETCH_LIST_ERROR":
      return { ...state, loadingList: false, error: action.error };

    case "SELECT_MILESTONE":
      if (state.selected.some((m) => m.number === action.milestone.number)) {
        return state;
      }
      return { ...state, selected: [...state.selected, action.milestone], error: null };

    case "FETCH_ITEMS_START":
      return { ...state, loadingNums: [...state.loadingNums, action.milestoneNumber] };

    case "FETCH_ITEMS_SUCCESS": {
      const isEmpty = action.items.length === 0;
      return {
        ...state,
        itemsCache: { ...state.itemsCache, [action.milestoneNumber]: action.items },
        loadingNums: state.loadingNums.filter((n) => n !== action.milestoneNumber),
        emptyMilestoneNums: isEmpty
          ? [...state.emptyMilestoneNums.filter((n) => n !== action.milestoneNumber), action.milestoneNumber]
          : state.emptyMilestoneNums.filter((n) => n !== action.milestoneNumber),
      };
    }

    case "FETCH_ITEMS_ERROR":
      return {
        ...state,
        selected: state.selected.filter((m) => m.number !== action.milestoneNumber),
        loadingNums: state.loadingNums.filter((n) => n !== action.milestoneNumber),
        error: action.error,
      };

    case "REMOVE_MILESTONE":
      return {
        ...state,
        selected: state.selected.filter((m) => m.number !== action.milestoneNumber),
        emptyMilestoneNums: state.emptyMilestoneNums.filter((n) => n !== action.milestoneNumber),
      };

    case "REFRESH_ITEMS_ERROR":
      return {
        ...state,
        loadingNums: state.loadingNums.filter((n) => n !== action.milestoneNumber),
        error: action.error,
      };

    case "FETCH_EPIC_LIST_START":
      return { ...state, epics: [], loadingEpicList: true };

    case "FETCH_EPIC_LIST_SUCCESS":
      return { ...state, epics: action.epics, loadingEpicList: false, epicsHasMore: action.hasMore };

    case "FETCH_MORE_EPICS_START":
      return { ...state, loadingMoreEpics: true };

    case "FETCH_MORE_EPICS_SUCCESS":
      return {
        ...state,
        loadingMoreEpics: false,
        epicsHasMore: false,
        epics: [...state.epics, ...action.epics].sort((a, b) => b.number - a.number),
      };

    case "FETCH_MORE_EPICS_ERROR":
      return { ...state, loadingMoreEpics: false, error: action.error };

    case "FETCH_EPIC_LIST_ERROR":
      return { ...state, loadingEpicList: false, error: action.error };

    case "SELECT_EPIC":
      if (state.selectedEpics.some((e) => e.number === action.epic.number)) {
        return state;
      }
      return { ...state, selectedEpics: [...state.selectedEpics, action.epic], error: null };

    case "FETCH_EPIC_ITEMS_START":
      return { ...state, loadingEpicNums: [...state.loadingEpicNums, action.epicNumber] };

    case "FETCH_EPIC_ITEMS_SUCCESS": {
      const isEmpty = action.items.length === 0;
      return {
        ...state,
        epicItemsCache: { ...state.epicItemsCache, [action.epicNumber]: action.items },
        loadingEpicNums: state.loadingEpicNums.filter((n) => n !== action.epicNumber),
        emptyEpicNums: isEmpty
          ? [...state.emptyEpicNums.filter((n) => n !== action.epicNumber), action.epicNumber]
          : state.emptyEpicNums.filter((n) => n !== action.epicNumber),
      };
    }

    case "FETCH_EPIC_ITEMS_ERROR":
      return {
        ...state,
        selectedEpics: state.selectedEpics.filter((e) => e.number !== action.epicNumber),
        loadingEpicNums: state.loadingEpicNums.filter((n) => n !== action.epicNumber),
        error: action.error,
      };

    case "REMOVE_EPIC":
      return {
        ...state,
        selectedEpics: state.selectedEpics.filter((e) => e.number !== action.epicNumber),
        emptyEpicNums: state.emptyEpicNums.filter((n) => n !== action.epicNumber),
      };

    case "REFRESH_EPIC_ITEMS_ERROR":
      return {
        ...state,
        loadingEpicNums: state.loadingEpicNums.filter((n) => n !== action.epicNumber),
        error: action.error,
      };

    case "LOAD_DEMO":
      return {
        milestones: action.milestones,
        selected: action.selected,
        itemsCache: action.itemsCache,
        loadingNums: [],
        loadingList: false,
        loadingMoreMilestones: false,
        milestonesHasMore: false,
        milestonesNextPage: 1,
        emptyMilestoneNums: [],
        epics: action.epics,
        selectedEpics: action.selectedEpics,
        epicItemsCache: action.epicItemsCache,
        loadingEpicNums: [],
        loadingEpicList: false,
        loadingMoreEpics: false,
        epicsHasMore: false,
        emptyEpicNums: [],
        isDemo: true,
        error: null,
        activeRepo: state.activeRepo,
        view: state.view,
        filters: state.filters,
        includePRs: state.includePRs,
      };

    case "RESET":
      return initialState;

    case "SET_REPO":
      return {
        activeRepo:             action.repo,
        // milestone slice — reset
        milestones:             [],
        selected:               [],
        itemsCache:             {},
        loadingNums:            [],
        loadingList:            false,
        loadingMoreMilestones:  false,
        milestonesHasMore:      false,
        milestonesNextPage:     1,
        emptyMilestoneNums:     [],
        // epic slice — reset
        epics:                  [],
        selectedEpics:          [],
        epicItemsCache:         {},
        loadingEpicNums:        [],
        loadingEpicList:        false,
        loadingMoreEpics:       false,
        epicsHasMore:           false,
        emptyEpicNums:          [],
        // shared
        isDemo:                 state.isDemo,
        error:                  null,
        // display state — preserved across repo change
        view:                   state.view,
        filters:                state.filters,
        includePRs:             state.includePRs,
      };

    case "SET_VIEW":
      return { ...state, view: action.view };

    case "SET_FILTERS":
      return { ...state, filters: action.filters };

    case "PATCH_FILTERS":
      return { ...state, filters: { ...state.filters, ...action.patch } };

    case "SET_INCLUDE_PRS":
      return { ...state, includePRs: { ...state.includePRs, [action.chart]: action.value } };

    default: {
      // noinspection JSUnusedLocalSymbols,UnnecessaryLocalVariableJS — intentional: causes a compile error if a new Action type is added without a case
      const _exhaustiveCheck: never = action;
      return _exhaustiveCheck;
    }
  }
};

export { appReducer, initialState };
export type { Action, AppState };
