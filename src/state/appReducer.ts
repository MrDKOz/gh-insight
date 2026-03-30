import type { View } from "../types/AppTypes";
import type { Filters } from "../types/FilterTypes";
import type { Milestone, Repo, TimelineItem } from "../types/GitHubTypes";
import { DEFAULT_VIEW } from "../types/AppTypes";
import { DEFAULT_FILTERS } from "../types/FilterTypes";

type AppState = {
  milestones: Milestone[];
  selected: Milestone[];
  itemsCache: Record<number, TimelineItem[]>;
  loadingNums: number[];
  loadingList: boolean;
  isDemo: boolean;
  error: string | null;
  emptyMilestoneNums: number[];
  activeRepo: Repo | null;
  view: View;
  filters: Filters;
  includePRs: { burndown: boolean; cumulativeFlow: boolean; cycleTime: boolean; velocity: boolean };
};

type Action =
  | { type: "FETCH_LIST_START" }
  | { type: "FETCH_LIST_SUCCESS"; milestones: Milestone[] }
  | { type: "FETCH_LIST_ERROR"; error: string }
  | { type: "SELECT_MILESTONE"; milestone: Milestone }
  | { type: "FETCH_ITEMS_START"; milestoneNumber: number }
  | { type: "FETCH_ITEMS_SUCCESS"; milestoneNumber: number; items: TimelineItem[] }
  | { type: "FETCH_ITEMS_ERROR"; milestoneNumber: number; error: string }
  | { type: "REMOVE_MILESTONE"; milestoneNumber: number }
  | { type: "REFRESH_ITEMS_ERROR"; milestoneNumber: number; error: string }
  | { type: "LOAD_DEMO"; milestones: Milestone[]; selected: Milestone[]; itemsCache: Record<number, TimelineItem[]> }
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
  isDemo: false,
  error: null,
  emptyMilestoneNums: [],
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
        error: action.milestones.length === 0 ? "No milestones found for this repository." : null,
      };

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

    case "LOAD_DEMO":
      return {
        milestones: action.milestones,
        selected: action.selected,
        itemsCache: action.itemsCache,
        loadingNums: [],
        loadingList: false,
        isDemo: true,
        error: null,
        emptyMilestoneNums: [],
        activeRepo: state.activeRepo,
        view: state.view,
        filters: state.filters,
        includePRs: state.includePRs,
      };

    case "RESET":
      return initialState;

    case "SET_REPO":
      return {
        activeRepo:         action.repo,
        // milestone slice — reset
        milestones:         [],
        selected:           [],
        itemsCache:         {},
        loadingNums:        [],
        loadingList:        false,
        isDemo:             false,
        error:              null,
        emptyMilestoneNums: [],
        // display state — preserved across repo change
        view:               state.view,
        filters:            state.filters,
        includePRs:         state.includePRs,
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
      const _exhaustiveCheck: never = action;
      return _exhaustiveCheck;
    }
  }
};

export { appReducer, initialState };
export type { Action, AppState };
