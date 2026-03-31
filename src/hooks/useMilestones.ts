import type { Action, AppState } from "../state/appReducer";
import type { Epic, Milestone, MilestoneMeta, Repo, TimelineItem } from "../types/GitHubTypes";
import type { Dispatch } from "react";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { fetchAllRemainingMilestones, fetchEpicItems, fetchEpics, fetchMilestoneItems, fetchMilestonesInitial } from "../api/github";
import { DEMO_DATA_BY_REPO } from "../data/demo";
import { appReducer, initialState } from "../state/appReducer";
import { EPIC_COLORS, EPIC_COLORS_CB, MILESTONE_COLORS, MILESTONE_COLORS_CB } from "../utils/colorUtils";
import { readViewFiltersFromUrl } from "../utils/urlUtils";

/**
 * Shared helper for add-milestone and add-epic: manages the AbortController
 * entry, dispatches lifecycle callbacks, and cleans up on any outcome.
 */
const runItemFetch = async (
  number: number,
  abortRefs: { readonly current: Map<number, AbortController> },
  fetchFn: (signal: AbortSignal) => Promise<TimelineItem[]>,
  onStart: () => void,
  onSuccess: (items: TimelineItem[]) => void,
  onError: (error: string) => void,
): Promise<void> => {
  const ac = new AbortController();
  abortRefs.current.set(number, ac);
  onStart();
  try {
    onSuccess(await fetchFn(ac.signal));
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") { return; }
    onError(e instanceof Error ? e.message : String(e));
  } finally {
    abortRefs.current.delete(number);
  }
};

type LoadMilestonesOpts = {
  autoSelectNums?:     number[];
  autoSelectEpicNums?: number[];
  overrideToken?:      string;
};

type UseMilestonesOptions = {
  token: string;
  colorblindMode?: boolean;
};

type UseMilestonesReturn = {
  state: AppState;
  dispatch: Dispatch<Action>;
  allItems: TimelineItem[];
  milestonesMeta: MilestoneMeta[];
  milestoneColorFor: (num: number) => string;
  epicColorFor: (num: number) => string;
  loadMilestonesForRepo: (repo: Repo, opts?: LoadMilestonesOpts) => Promise<void>;
  loadDemoForRepo: (repo: Repo, urlMilestoneNums: number[]) => void;
  addMilestone: (milestone: Milestone) => Promise<void>;
  removeMilestone: (num: number) => void;
  refreshMilestones: () => Promise<void>;
  resetMilestones: () => void;
  addEpic: (epic: Epic) => Promise<void>;
  removeEpic: (epicNumber: number) => void;
  loadMoreMilestones: () => Promise<void>;
  loadMoreEpics: () => Promise<void>;
};

const useMilestones = ({ token, colorblindMode = false }: UseMilestonesOptions): UseMilestonesReturn => {
  const urlState = readViewFiltersFromUrl();
  const [state, dispatch] = useReducer(appReducer, {
    ...initialState,
    view:    urlState.view,
    filters: urlState.filters,
  });

  const loadAbortRef     = useRef<AbortController | null>(null);
  const refreshAbortRef  = useRef<AbortController | null>(null);
  const itemAbortRefs    = useRef<Map<number, AbortController>>(new Map());
  const epicAbortRefs    = useRef<Map<number, AbortController>>(new Map());

  // Abort all in-flight requests on unmount
  useEffect(() => {
    const abortMap     = itemAbortRefs.current;
    const epicAbortMap = epicAbortRefs.current;
    return () => {
      loadAbortRef.current?.abort();
      refreshAbortRef.current?.abort();
      abortMap.forEach((ac) => ac.abort());
      epicAbortMap.forEach((ac) => ac.abort());
    };
  }, []);

  const milestoneColorFor = useCallback(
    (num: number) => {
      const palette = colorblindMode ? MILESTONE_COLORS_CB : MILESTONE_COLORS;
      const index = state.milestones.findIndex((m) => m.number === num);
      return palette[(index >= 0 ? index : num) % palette.length] ?? "#0072B2";
    },
    [colorblindMode, state.milestones],
  );

  const epicColorFor = useCallback(
    (num: number) => {
      const palette = colorblindMode ? EPIC_COLORS_CB : EPIC_COLORS;
      const index = state.epics.findIndex((e) => e.number === num);
      return palette[(index >= 0 ? index : num) % palette.length] ?? "#E69F00";
    },
    [colorblindMode, state.epics],
  );

  const loadDemoForRepo = useCallback((repo: Repo, urlMilestoneNums: number[]) => {
    const data = DEMO_DATA_BY_REPO[repo.fullName];
    if (!data) { return; }
    const preSelected = urlMilestoneNums.length > 0
      ? data.milestones.filter((m) => urlMilestoneNums.includes(m.number))
      : [];
    dispatch({
      type:            "LOAD_DEMO",
      milestones:      data.milestones,
      selected:        preSelected.length > 0 ? preSelected : data.milestones.slice(0, 1),
      itemsCache:      data.items,
      epics:           data.epics ?? [],
      selectedEpics:   [],
      epicItemsCache:  data.epicItems ?? {},
    });
  }, []);

  const loadMilestonesForRepo = useCallback(async (repo: Repo, opts?: LoadMilestonesOpts) => {
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    const effectiveToken = opts?.overrideToken ?? token;

    // Fetch milestones and epics in parallel
    dispatch({ type: "FETCH_LIST_START" });
    dispatch({ type: "FETCH_EPIC_LIST_START" });

    const [milestonesResult, epicsResult] = await Promise.allSettled([
      fetchMilestonesInitial(repo.owner, repo.name, effectiveToken, ac.signal),
      fetchEpics(repo.owner, repo.name, effectiveToken, ac.signal, ["OPEN"]),
    ]);

    if (milestonesResult.status === "fulfilled") {
      const { items, hasMore, nextPage } = milestonesResult.value;
      dispatch({ type: "FETCH_LIST_SUCCESS", milestones: items, hasMore, nextPage });
      const autoNums = opts?.autoSelectNums ?? [];
      if (autoNums.length > 0) {
        const toSelect = items.filter((m) => autoNums.includes(m.number));
        for (const milestone of toSelect) {
          dispatch({ type: "SELECT_MILESTONE", milestone });
          void runItemFetch(
            milestone.number, itemAbortRefs,
            (signal) => fetchMilestoneItems(repo.owner, repo.name, effectiveToken, milestone.number, signal),
            () => dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: milestone.number }),
            (fetchedItems) => dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: milestone.number, items: fetchedItems }),
            (error) => dispatch({ type: "FETCH_ITEMS_ERROR", milestoneNumber: milestone.number, error }),
          );
        }
      }
    } else {
      if (milestonesResult.reason instanceof DOMException && milestonesResult.reason.name === "AbortError") { return; }
      dispatch({ type: "FETCH_LIST_ERROR", error: milestonesResult.reason instanceof Error ? milestonesResult.reason.message : String(milestonesResult.reason) });
    }

    if (epicsResult.status === "fulfilled") {
      const { items: epicItems, hasMore: epicsHasMore } = epicsResult.value;
      dispatch({ type: "FETCH_EPIC_LIST_SUCCESS", epics: epicItems, hasMore: epicsHasMore });
      // If no open epics found but closed ones may exist, auto-fetch closed so the picker populates
      if (epicItems.length === 0 && epicsHasMore && !ac.signal.aborted) {
        dispatch({ type: "FETCH_MORE_EPICS_START" });
        fetchEpics(repo.owner, repo.name, effectiveToken, ac.signal, ["CLOSED"])
          .then(({ items }) => { dispatch({ type: "FETCH_MORE_EPICS_SUCCESS", epics: items }); })
          .catch((e) => {
            if (e instanceof DOMException && e.name === "AbortError") { return; }
            dispatch({ type: "FETCH_MORE_EPICS_ERROR", error: e instanceof Error ? e.message : String(e) });
          });
      }
      const autoEpicNums = opts?.autoSelectEpicNums ?? [];
      if (autoEpicNums.length > 0) {
        const toSelectEpics = epicItems.filter((e) => autoEpicNums.includes(e.number));
        for (const epic of toSelectEpics) {
          dispatch({ type: "SELECT_EPIC", epic });
          void runItemFetch(
            epic.number, epicAbortRefs,
            (signal) => fetchEpicItems(repo.owner, repo.name, effectiveToken, epic.number, signal),
            () => dispatch({ type: "FETCH_EPIC_ITEMS_START", epicNumber: epic.number }),
            (fetchedItems) => dispatch({ type: "FETCH_EPIC_ITEMS_SUCCESS", epicNumber: epic.number, items: fetchedItems }),
            (error) => dispatch({ type: "FETCH_EPIC_ITEMS_ERROR", epicNumber: epic.number, error }),
          );
        }
      }
    } else {
      if (epicsResult.reason instanceof DOMException && epicsResult.reason.name === "AbortError") { return; }
      // Epic list failure is non-fatal — clear the loading state without blocking the UI
      dispatch({ type: "FETCH_EPIC_LIST_ERROR", error: epicsResult.reason instanceof Error ? epicsResult.reason.message : String(epicsResult.reason) });
    }
  }, [token]);

  const addMilestone = useCallback(async (milestone: Milestone) => {
    dispatch({ type: "SELECT_MILESTONE", milestone });
    if (milestone.number in state.itemsCache || !state.activeRepo) { return; }
    const repo = state.activeRepo;
    await runItemFetch(
      milestone.number, itemAbortRefs,
      (signal) => fetchMilestoneItems(repo.owner, repo.name, token, milestone.number, signal),
      () => dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: milestone.number }),
      (items) => dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: milestone.number, items }),
      (error) => dispatch({ type: "FETCH_ITEMS_ERROR", milestoneNumber: milestone.number, error }),
    );
  }, [state.itemsCache, state.activeRepo, token]);

  const removeMilestone = useCallback((num: number) => {
    dispatch({ type: "REMOVE_MILESTONE", milestoneNumber: num });
  }, []);

  const addEpic = useCallback(async (epic: Epic) => {
    dispatch({ type: "SELECT_EPIC", epic });
    if (epic.number in state.epicItemsCache || !state.activeRepo) { return; }
    const repo = state.activeRepo;
    await runItemFetch(
      epic.number, epicAbortRefs,
      (signal) => fetchEpicItems(repo.owner, repo.name, token, epic.number, signal),
      () => dispatch({ type: "FETCH_EPIC_ITEMS_START", epicNumber: epic.number }),
      (items) => dispatch({ type: "FETCH_EPIC_ITEMS_SUCCESS", epicNumber: epic.number, items }),
      (error) => dispatch({ type: "FETCH_EPIC_ITEMS_ERROR", epicNumber: epic.number, error }),
    );
  }, [state.epicItemsCache, state.activeRepo, token]);

  const removeEpic = useCallback((epicNumber: number) => {
    dispatch({ type: "REMOVE_EPIC", epicNumber });
  }, []);

  const loadMoreMilestones = useCallback(async () => {
    if (!state.activeRepo || state.loadingMoreMilestones || !state.milestonesHasMore) { return; }
    dispatch({ type: "FETCH_MORE_MILESTONES_START" });
    try {
      const remaining = await fetchAllRemainingMilestones(
        state.activeRepo.owner, state.activeRepo.name, token, state.milestonesNextPage,
      );
      dispatch({ type: "FETCH_MORE_MILESTONES_SUCCESS", milestones: remaining });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") { return; }
      dispatch({ type: "FETCH_MORE_MILESTONES_ERROR", error: e instanceof Error ? e.message : String(e) });
    }
  }, [state.activeRepo, state.loadingMoreMilestones, state.milestonesHasMore, state.milestonesNextPage, token]);

  const loadMoreEpics = useCallback(async () => {
    if (!state.activeRepo || state.loadingMoreEpics || !state.epicsHasMore) { return; }
    dispatch({ type: "FETCH_MORE_EPICS_START" });
    try {
      const { items } = await fetchEpics(state.activeRepo.owner, state.activeRepo.name, token, undefined, ["CLOSED"]);
      dispatch({ type: "FETCH_MORE_EPICS_SUCCESS", epics: items });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") { return; }
      dispatch({ type: "FETCH_MORE_EPICS_ERROR", error: e instanceof Error ? e.message : String(e) });
    }
  }, [state.activeRepo, state.loadingMoreEpics, state.epicsHasMore, token]);

  const refreshMilestones = useCallback(async () => {
    if (state.selected.length === 0 || !state.activeRepo) { return; }
    refreshAbortRef.current?.abort();
    const ac = new AbortController();
    refreshAbortRef.current = ac;
    state.selected.forEach((milestone) => dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: milestone.number }));
    await Promise.all(state.selected.map(async (milestone) => {
      try {
        const items = await fetchMilestoneItems(state.activeRepo!.owner, state.activeRepo!.name, token, milestone.number, ac.signal);
        dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: milestone.number, items });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") { return; }
        dispatch({ type: "REFRESH_ITEMS_ERROR", milestoneNumber: milestone.number, error: e instanceof Error ? e.message : String(e) });
      }
    }));
  }, [state.selected, state.activeRepo, token]);

  const resetMilestones = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const allItems = useMemo(
    () => [
      ...state.selected.flatMap((m) => state.itemsCache[m.number] ?? []),
      ...state.selectedEpics.flatMap((e) => state.epicItemsCache[e.number] ?? []),
    ],
    [state.selected, state.itemsCache, state.selectedEpics, state.epicItemsCache],
  );

  const milestonesMeta = useMemo(
    () => [
      ...state.selected.map((milestone) => ({
        number: milestone.number,
        title:  milestone.title,
        color:  milestoneColorFor(milestone.number),
        dueOn:  milestone.dueOn,
        kind:   "milestone" as const,
      })),
      ...state.selectedEpics.map((epic) => ({
        number: epic.number,
        title:  epic.title,
        color:  epicColorFor(epic.number),
        dueOn:  null,
        kind:   "epic" as const,
      })),
    ],
    [state.selected, milestoneColorFor, state.selectedEpics, epicColorFor],
  );

  return {
    state,
    dispatch,
    allItems,
    milestonesMeta,
    milestoneColorFor,
    epicColorFor,
    loadMilestonesForRepo,
    loadDemoForRepo,
    addMilestone,
    removeMilestone,
    refreshMilestones,
    resetMilestones,
    addEpic,
    removeEpic,
    loadMoreMilestones,
    loadMoreEpics,
  };
};

export { useMilestones };
export type { UseMilestonesReturn };
