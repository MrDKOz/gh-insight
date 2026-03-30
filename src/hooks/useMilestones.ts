import type { MilestoneState } from "../state/milestoneReducer";
import type { Milestone, MilestoneMeta, Repo, TimelineItem } from "../types/GitHubTypes";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { fetchMilestoneItems, fetchMilestones } from "../api/github";
import { DEMO_DATA_BY_REPO } from "../data/demo";
import { initialState, milestoneReducer } from "../state/milestoneReducer";
import { COLORS } from "../utils/colorUtils";

const MILESTONE_COLORS = [
  COLORS.issue, COLORS.prMerged, COLORS.success,
  COLORS.warning, COLORS.prClosed, COLORS.issueDark,
];

type LoadMilestonesOpts = {
  autoSelectNums?: number[];
  overrideToken?:  string;
};

type UseMilestonesOptions = {
  activeRepo: Repo | null;
  token: string;
};

type UseMilestonesReturn = {
  state: MilestoneState;
  allItems: TimelineItem[];
  milestonesMeta: MilestoneMeta[];
  milestoneColorFor: (num: number) => string;
  loadMilestonesForRepo: (repo: Repo, opts?: LoadMilestonesOpts) => Promise<void>;
  loadDemoForRepo: (repo: Repo, urlMilestoneNums: number[]) => void;
  addMilestone: (ms: Milestone) => Promise<void>;
  removeMilestone: (num: number) => void;
  refreshMilestones: () => Promise<void>;
  resetMilestones: () => void;
};

const useMilestones = ({ activeRepo, token }: UseMilestonesOptions): UseMilestonesReturn => {
  const [state, dispatch] = useReducer(milestoneReducer, initialState);

  const loadAbortRef    = useRef<AbortController | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const itemAbortRefs   = useRef<Map<number, AbortController>>(new Map());

  // Abort all in-flight requests on unmount
  useEffect(() => {
    const abortMap = itemAbortRefs.current;
    return () => {
      loadAbortRef.current?.abort();
      refreshAbortRef.current?.abort();
      abortMap.forEach((ac) => ac.abort());
    };
  }, []);

  const milestoneColorFor = useCallback(
    (num: number) => MILESTONE_COLORS[num % MILESTONE_COLORS.length] ?? "#0969da",
    [],
  );

  const loadDemoForRepo = useCallback((repo: Repo, urlMilestoneNums: number[]) => {
    const data = DEMO_DATA_BY_REPO[repo.fullName];
    if (!data) { return; }
    const preSelected = urlMilestoneNums.length > 0
      ? data.milestones.filter((m) => urlMilestoneNums.includes(m.number))
      : [];
    dispatch({
      type:       "LOAD_DEMO",
      milestones: data.milestones,
      selected:   preSelected.length > 0 ? preSelected : data.milestones.slice(0, 1),
      itemsCache: data.items,
    });
  }, []);

  const loadMilestonesForRepo = useCallback(async (repo: Repo, opts?: LoadMilestonesOpts) => {
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    const effectiveToken = opts?.overrideToken ?? token;
    dispatch({ type: "FETCH_LIST_START" });
    try {
      const milestones = await fetchMilestones(repo.owner, repo.name, effectiveToken, ac.signal);
      dispatch({ type: "FETCH_LIST_SUCCESS", milestones });

      // Auto-select milestones from URL params (first load only, passed by caller)
      const autoNums = opts?.autoSelectNums ?? [];
      if (autoNums.length > 0) {
        const toSelect = milestones.filter((m) => autoNums.includes(m.number));
        for (const ms of toSelect) {
          dispatch({ type: "SELECT_MILESTONE", milestone: ms });
          const ac2 = new AbortController();
          itemAbortRefs.current.set(ms.number, ac2);
          dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: ms.number });
          fetchMilestoneItems(repo.owner, repo.name, effectiveToken, ms.number, ac2.signal)
            .then((items) => { dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: ms.number, items }); })
            .catch((e) => {
              if (e instanceof DOMException && e.name === "AbortError") { return; }
              dispatch({ type: "FETCH_ITEMS_ERROR", milestoneNumber: ms.number, error: e instanceof Error ? e.message : String(e) });
            })
            .finally(() => { itemAbortRefs.current.delete(ms.number); });
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") { return; }
      dispatch({ type: "FETCH_LIST_ERROR", error: e instanceof Error ? e.message : String(e) });
    }
  }, [token]);

  const addMilestone = useCallback(async (ms: Milestone) => {
    if (state.selected.some((m) => m.number === ms.number)) { return; }
    dispatch({ type: "SELECT_MILESTONE", milestone: ms });
    if (!(ms.number in state.itemsCache)) {
      if (!activeRepo) { return; }
      const ac = new AbortController();
      itemAbortRefs.current.set(ms.number, ac);
      dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: ms.number });
      try {
        const items = await fetchMilestoneItems(activeRepo.owner, activeRepo.name, token, ms.number, ac.signal);
        dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: ms.number, items });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") { return; }
        dispatch({ type: "FETCH_ITEMS_ERROR", milestoneNumber: ms.number, error: e instanceof Error ? e.message : String(e) });
      } finally {
        itemAbortRefs.current.delete(ms.number);
      }
    }
  }, [state.selected, state.itemsCache, activeRepo, token]);

  const removeMilestone = useCallback((num: number) => {
    dispatch({ type: "REMOVE_MILESTONE", milestoneNumber: num });
  }, []);

  const refreshMilestones = useCallback(async () => {
    if (state.selected.length === 0 || !activeRepo) { return; }
    refreshAbortRef.current?.abort();
    const ac = new AbortController();
    refreshAbortRef.current = ac;
    state.selected.forEach((ms) => dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: ms.number }));
    await Promise.all(state.selected.map(async (ms) => {
      try {
        const items = await fetchMilestoneItems(activeRepo.owner, activeRepo.name, token, ms.number, ac.signal);
        dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: ms.number, items });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") { return; }
        dispatch({ type: "REFRESH_ITEMS_ERROR", milestoneNumber: ms.number, error: e instanceof Error ? e.message : String(e) });
      }
    }));
  }, [state.selected, activeRepo, token]);

  const resetMilestones = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const allItems = useMemo(
    () => state.selected.flatMap((ms) => state.itemsCache[ms.number] ?? []),
    [state.selected, state.itemsCache],
  );

  const milestonesMeta = useMemo(
    () => state.selected.map((ms) => ({
      number: ms.number,
      title:  ms.title,
      color:  milestoneColorFor(ms.number),
      dueOn:  ms.dueOn,
    })),
    [state.selected, milestoneColorFor],
  );

  return {
    state,
    allItems,
    milestonesMeta,
    milestoneColorFor,
    loadMilestonesForRepo,
    loadDemoForRepo,
    addMilestone,
    removeMilestone,
    refreshMilestones,
    resetMilestones,
  };
};

export { useMilestones };
export type { UseMilestonesReturn };
