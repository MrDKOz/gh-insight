import { useReducer, useState, useRef, useMemo, useCallback, useEffect } from "react";
import type { FunctionComponent } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import { fetchMilestones, fetchMilestoneItems } from "./api/github";
import type { Milestone } from "./types";
import { milestoneReducer, initialState } from "./state/milestoneReducer";
import { Timeline } from "./components/Timeline";
import { SettingsPanel } from "./components/SettingsPanel";
import { muiLightTheme, muiDarkTheme } from "./theme";
import { encryptToken, decryptToken } from "./utils/tokenCrypto";
import {
  DEMO_MILESTONE,   DEMO_ITEMS,
  DEMO_MILESTONE_2, DEMO_ITEMS_2,
  DEMO_MILESTONE_3, DEMO_ITEMS_3,
} from "./data/demo";

const LS_TOKEN = "gmt_token";
const LS_OWNER = "gmt_owner";
const LS_REPO  = "gmt_repo";
const LS_DARK  = "gmt_dark";

const MILESTONE_COLORS = ["#0969da", "#8250df", "#1a7f37", "#d97706", "#cf222e", "#0550ae"];

// Runs once at module load — applies saved theme before first paint, no FOUC.
function initDark(): boolean {
  const isDark = localStorage.getItem(LS_DARK) !== "false";
  document.body.classList.toggle("dark", isDark);
  return isDark;
}
const INITIAL_DARK = initDark();

const App: FunctionComponent = () => {
  const [dark, setDark]   = useState(INITIAL_DARK);
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState(() => localStorage.getItem(LS_OWNER) ?? "");
  const [repo, setRepo]   = useState(() => localStorage.getItem(LS_REPO)  ?? "");

  const [state, dispatch] = useReducer(milestoneReducer, initialState);

  const loadAbortRef = useRef<AbortController | null>(null);
  const itemAbortRefs = useRef<Map<number, AbortController>>(new Map());

  useEffect(() => {
    const stored = localStorage.getItem(LS_TOKEN);
    if (stored) {
      decryptToken(stored).then(setToken).catch(() => localStorage.removeItem(LS_TOKEN));
    }
    return () => {
      loadAbortRef.current?.abort();
      itemAbortRefs.current.forEach((ac) => ac.abort());
    };
  }, []);

  const toggleDark = useCallback(() => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(LS_DARK, String(next));
    document.body.classList.toggle("dark", next);
  }, [dark]);

  // Color is derived from the milestone number so it is stable across re-loads
  // and repo changes — the same milestone always gets the same colour.
  const milestoneColorFor = useCallback((num: number) => {
    return MILESTONE_COLORS[num % MILESTONE_COLORS.length];
  }, []);

  const loadMilestones = useCallback(async () => {
    if (!token || !owner || !repo) return;
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    dispatch({ type: "FETCH_LIST_START" });
    try {
      const milestones = await fetchMilestones(owner, repo, token, ac.signal);
      dispatch({ type: "FETCH_LIST_SUCCESS", milestones });
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
      dispatch({ type: "FETCH_LIST_ERROR", error: e instanceof Error ? e.message : String(e) });
    }
  }, [token, owner, repo]);

  const addMilestone = useCallback(async (ms: Milestone) => {
    if (state.selected.some((m) => m.number === ms.number)) return;
    dispatch({ type: "SELECT_MILESTONE", milestone: ms });
    if (!(ms.number in state.itemsCache)) {
      const ac = new AbortController();
      itemAbortRefs.current.set(ms.number, ac);
      dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: ms.number });
      try {
        const items = await fetchMilestoneItems(owner, repo, token, ms.number, ac.signal);
        dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: ms.number, items });
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
        dispatch({ type: "FETCH_ITEMS_ERROR", milestoneNumber: ms.number, error: e instanceof Error ? e.message : String(e) });
      } finally {
        itemAbortRefs.current.delete(ms.number);
      }
    }
  }, [state.selected, state.itemsCache, owner, repo, token]);

  const removeMilestone = useCallback((num: number) => {
    dispatch({ type: "REMOVE_MILESTONE", milestoneNumber: num });
  }, []);

  const refreshMilestones = useCallback(async () => {
    if (state.selected.length === 0) return;
    state.selected.forEach((ms) =>
      dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: ms.number }),
    );
    await Promise.all(state.selected.map(async (ms) => {
      try {
        const items = await fetchMilestoneItems(owner, repo, token, ms.number);
        dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: ms.number, items });
      } catch (e) {
        dispatch({ type: "REFRESH_ITEMS_ERROR", milestoneNumber: ms.number, error: e instanceof Error ? e.message : String(e) });
      }
    }));
  }, [state.selected, owner, repo, token]);

  const loadDemo = useCallback(() => dispatch({
    type:       "LOAD_DEMO",
    milestones: [DEMO_MILESTONE, DEMO_MILESTONE_2, DEMO_MILESTONE_3],
    selected:   [DEMO_MILESTONE],
    itemsCache: {
      [DEMO_MILESTONE.number]:   DEMO_ITEMS,
      [DEMO_MILESTONE_2.number]: DEMO_ITEMS_2,
      [DEMO_MILESTONE_3.number]: DEMO_ITEMS_3,
    },
  }), []);

  const canLoad = !!token && !!owner && !!repo;

  const allItems = useMemo(
    () => state.selected.flatMap((ms) => state.itemsCache[ms.number] ?? []),
    [state.selected, state.itemsCache],
  );

  const milestonesMeta = useMemo(
    () => state.selected.map((ms) => ({
      number: ms.number,
      title:  ms.title,
      color:  milestoneColorFor(ms.number),
    })),
    [state.selected, milestoneColorFor],
  );

  const handleTokenChange = useCallback((v: string) => {
    setToken(v);
  }, []);

  const handleTokenBlur = useCallback((v: string) => {
    if (v) encryptToken(v).then((ct) => localStorage.setItem(LS_TOKEN, ct)).catch(console.error);
    else   localStorage.removeItem(LS_TOKEN);
  }, []);

  const handleOwnerChange = useCallback((v: string) => {
    setOwner(v);
    localStorage.setItem(LS_OWNER, v);
  }, []);

  const handleRepoChange = useCallback((v: string) => {
    setRepo(v);
    localStorage.setItem(LS_REPO, v);
  }, []);

  return (
    <ThemeProvider theme={dark ? muiDarkTheme : muiLightTheme}>
      <CssBaseline />
      <Box sx={{ maxWidth: 1400, mx: "auto", px: 3, py: 3, display: "flex", flexDirection: "column", gap: 2 }}>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={700}>GitHub Work Visualiser</Typography>
          <IconButton onClick={toggleDark} title={dark ? "Switch to light mode" : "Switch to dark mode"} size="small">
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2"  x2="12" y2="5"  />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34"  />
                <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
                <line x1="2"  y1="12" x2="5"  y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
                <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
                <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </IconButton>
        </Stack>

        <SettingsPanel
          token={token}
          onTokenChange={handleTokenChange}
          onTokenBlur={handleTokenBlur}
          owner={owner}
          onOwnerChange={handleOwnerChange}
          repo={repo}
          onRepoChange={handleRepoChange}
          canLoad={canLoad}
          loadingList={state.loadingList}
          onLoad={loadMilestones}
          onDemo={loadDemo}
          milestones={state.milestones}
          selected={state.selected}
          loadingNums={state.loadingNums}
          isDemo={state.isDemo}
          colorFor={milestoneColorFor}
          onAdd={addMilestone}
          onRemove={removeMilestone}
          onRefresh={refreshMilestones}
        />

        {state.error && <Alert severity="error">{state.error}</Alert>}
        {state.loadingNums.length > 0 && <Alert severity="info">Loading milestone data…</Alert>}

        {allItems.length > 0 && milestonesMeta.length > 0 && (
          <Timeline items={allItems} milestones={milestonesMeta} />
        )}

      </Box>
    </ThemeProvider>
  );
};

export { App };
