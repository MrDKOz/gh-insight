import type { Milestone, TimelineItem } from "../types";

type MilestoneState = {
  milestones: Milestone[];
  selected: Milestone[];
  itemsCache: Record<number, TimelineItem[]>;
  loadingNums: number[];
  loadingList: boolean;
  isDemo: boolean;
  error: string | null;
  emptyMilestoneNums: number[];
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
  | { type: "LOAD_DEMO"; milestones: Milestone[]; selected: Milestone[]; itemsCache: Record<number, TimelineItem[]> };

const initialState: MilestoneState = {
  milestones: [],
  selected: [],
  itemsCache: {},
  loadingNums: [],
  loadingList: false,
  isDemo: false,
  error: null,
  emptyMilestoneNums: [],
};

function milestoneReducer(state: MilestoneState, action: Action): MilestoneState {
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
      };

    default:
      return state;
  }
}

export { initialState, milestoneReducer };
export type { MilestoneState, Action };
