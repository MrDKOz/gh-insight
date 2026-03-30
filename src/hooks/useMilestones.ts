import type { Action, AppState } from "../state/appReducer";
import type { Epic, Milestone, MilestoneMeta, Repo, TimelineItem } from "../types/GitHubTypes";
import type { Dispatch } from "react";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { fetchEpicItems, fetchEpics, fetchMilestoneItems, fetchMilestones } from "../api/github";
import { DEMO_DATA_BY_REPO } from "../data/demo";
import { appReducer, initialState } from "../state/appReducer";
import { COLORS } from "../utils/colorUtils";
import { readViewFiltersFromUrl } from "../utils/urlUtils";

const MILESTONE_COLORS = [
  COLORS.issue, COLORS.prMerged, COLORS.success,
  COLORS.warning, COLORS.prClosed, COLORS.issueDark,
];

// Distinct palette for epics so they are visually differentiated from milestones
const EPIC_COLORS = [
  "#8250df", "#cf222e", "#bf8700", "#1a7f37", "#0550ae", "#953800",
];

type LoadMilestonesOpts = {
  autoSelectNums?: number[];
  overrideToken?:  string;
};

type UseMilestonesOptions = {
  token: string;
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
};

const useMilestones = ({ token }: UseMilestonesOptions): UseMilestonesReturn => {
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
    (num: number) => MILESTONE_COLORS[num % MILESTONE_COLORS.length] ?? "#0969da",
    [],
  );

  const epicColorFor = useCallback(
    (num: number) => EPIC_COLORS[num % EPIC_COLORS.length] ?? "#8250df",
    [],
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
      fetchMilestones(repo.owner, repo.name, effectiveToken, ac.signal),
      fetchEpics(repo.owner, repo.name, effectiveToken, ac.signal),
    ]);

    if (milestonesResult.status === "fulfilled") {
      dispatch({ type: "FETCH_LIST_SUCCESS", milestones: milestonesResult.value });
      const autoNums = opts?.autoSelectNums ?? [];
      if (autoNums.length > 0) {
        const toSelect = milestonesResult.value.filter((m) => autoNums.includes(m.number));
        for (const milestone of toSelect) {
          dispatch({ type: "SELECT_MILESTONE", milestone });
          const ac2 = new AbortController();
          itemAbortRefs.current.set(milestone.number, ac2);
          dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: milestone.number });
          fetchMilestoneItems(repo.owner, repo.name, effectiveToken, milestone.number, ac2.signal)
            .then((items) => { dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: milestone.number, items }); })
            .catch((e) => {
              if (e instanceof DOMException && e.name === "AbortError") { return; }
              dispatch({ type: "FETCH_ITEMS_ERROR", milestoneNumber: milestone.number, error: e instanceof Error ? e.message : String(e) });
            })
            .finally(() => { itemAbortRefs.current.delete(milestone.number); });
        }
      }
    } else {
      if (milestonesResult.reason instanceof DOMException && milestonesResult.reason.name === "AbortError") { return; }
      dispatch({ type: "FETCH_LIST_ERROR", error: milestonesResult.reason instanceof Error ? milestonesResult.reason.message : String(milestonesResult.reason) });
    }

    if (epicsResult.status === "fulfilled") {
      dispatch({ type: "FETCH_EPIC_LIST_SUCCESS", epics: epicsResult.value });
    } else {
      if (epicsResult.reason instanceof DOMException && epicsResult.reason.name === "AbortError") { return; }
      // Epic list failure is non-fatal — just clear the loading state silently
      dispatch({ type: "FETCH_EPIC_LIST_SUCCESS", epics: [] });
    }
  }, [token]);

  const addMilestone = useCallback(async (milestone: Milestone) => {
    dispatch({ type: "SELECT_MILESTONE", milestone });
    if (!(milestone.number in state.itemsCache)) {
      if (!state.activeRepo) { return; }
      const ac = new AbortController();
      itemAbortRefs.current.set(milestone.number, ac);
      dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: milestone.number });
      try {
        const items = await fetchMilestoneItems(state.activeRepo.owner, state.activeRepo.name, token, milestone.number, ac.signal);
        dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: milestone.number, items });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") { return; }
        dispatch({ type: "FETCH_ITEMS_ERROR", milestoneNumber: milestone.number, error: e instanceof Error ? e.message : String(e) });
      } finally {
        itemAbortRefs.current.delete(milestone.number);
      }
    }
  }, [state.itemsCache, state.activeRepo, token]);

  const removeMilestone = useCallback((num: number) => {
    dispatch({ type: "REMOVE_MILESTONE", milestoneNumber: num });
  }, []);

  const addEpic = useCallback(async (epic: Epic) => {
    dispatch({ type: "SELECT_EPIC", epic });
    if (!(epic.number in state.epicItemsCache)) {
      if (!state.activeRepo) { return; }
      const ac = new AbortController();
      epicAbortRefs.current.set(epic.number, ac);
      dispatch({ type: "FETCH_EPIC_ITEMS_START", epicNumber: epic.number });
      try {
        const items = await fetchEpicItems(state.activeRepo.owner, state.activeRepo.name, token, epic.number, ac.signal);
        dispatch({ type: "FETCH_EPIC_ITEMS_SUCCESS", epicNumber: epic.number, items });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") { return; }
        dispatch({ type: "FETCH_EPIC_ITEMS_ERROR", epicNumber: epic.number, error: e instanceof Error ? e.message : String(e) });
      } finally {
        epicAbortRefs.current.delete(epic.number);
      }
    }
  }, [state.epicItemsCache, state.activeRepo, token]);

  const removeEpic = useCallback((epicNumber: number) => {
    dispatch({ type: "REMOVE_EPIC", epicNumber });
  }, []);

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
      })),
      ...state.selectedEpics.map((epic) => ({
        number: epic.number,
        title:  `Epic: ${epic.title}`,
        color:  epicColorFor(epic.number),
        dueOn:  null,
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
  };
};

export { useMilestones };
export type { UseMilestonesReturn };
