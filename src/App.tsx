import type { Milestone } from "./types";
import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { fetchMilestoneItems, fetchMilestones } from "./api/github";
import { GearIcon } from "./components/GearIcon";
import { SettingsPanel } from "./components/SettingsPanel";
import { Timeline } from "./components/Timeline";
import {   DEMO_ITEMS, DEMO_ITEMS_2, DEMO_ITEMS_3,
  DEMO_MILESTONE,
  DEMO_MILESTONE_2,
  DEMO_MILESTONE_3,
} from "./data/demo";
import { useSettings } from "./hooks/useSettings";
import { initialState, milestoneReducer } from "./state/milestoneReducer";
import { muiDarkTheme, muiLightTheme } from "./theme";
import { EncryptionUnavailableError, decryptToken, encryptToken } from "./utils/tokenCrypto";

const LS_TOKEN = "gmt_token";
const LS_OWNER = "gmt_owner";
const LS_REPO  = "gmt_repo";
const LS_DARK  = "gmt_dark";

const readUrlParams = (): { owner: string; repo: string; milestoneNums: number[]; demo: boolean } => {
  const p = new URLSearchParams(window.location.search);
  const demo = p.get("demo") === "1";
  const owner = demo ? "" : (p.get("owner") ?? "");
  const repo  = demo ? "" : (p.get("repo")  ?? "");
  const raw   = p.get("milestones") ?? "";
  const milestoneNums = raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return { owner, repo, milestoneNums, demo };
};

const syncUrlParams = (owner: string, repo: string, selectedNums: number[], isDemo: boolean): void => {
  // Preserve view/filter params managed by Timeline — only update our own keys
  const p = new URLSearchParams(window.location.search);
  p.delete("owner"); p.delete("repo"); p.delete("demo"); p.delete("milestones");
  if (isDemo) {
    p.set("demo", "1");
  } else {
    if (owner) {p.set("owner", owner);}
    if (repo)  {p.set("repo",  repo);}
  }
  if (selectedNums.length > 0) {p.set("milestones", selectedNums.join(","));}
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
};

const MILESTONE_COLORS = ["#0969da", "#8250df", "#1a7f37", "#d97706", "#cf222e", "#0550ae"];

// Runs once at module load — applies saved theme before first paint, no FOUC.
const initDark = (): boolean => {
  const isDark = localStorage.getItem(LS_DARK) !== "false";
  document.body.classList.toggle("dark", isDark);
  return isDark;
};
const INITIAL_DARK = initDark();
// Computed once at module load — avoids re-parsing the URL on every useState/useRef initializer
const INITIAL_URL_PARAMS = readUrlParams();

const App: FunctionComponent = () => {
  const [dark, setDark]         = useState(INITIAL_DARK);
  const [token, setToken]       = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [owner, setOwner] = useState(() =>
    INITIAL_URL_PARAMS.demo ? "" : (INITIAL_URL_PARAMS.owner || (localStorage.getItem(LS_OWNER) ?? "")),
  );
  const [repo, setRepo] = useState(() =>
    INITIAL_URL_PARAMS.demo ? "" : (INITIAL_URL_PARAMS.repo || (localStorage.getItem(LS_REPO) ?? "")),
  );
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const { settings, updateSetting } = useSettings();

  const [state, dispatch] = useReducer(milestoneReducer, initialState);

  // Pending milestone numbers to auto-load from URL (resolved after milestone list loads)
  const pendingUrlMilestones = useRef<number[]>(INITIAL_URL_PARAMS.milestoneNums);
  const urlHasDemo = useRef(INITIAL_URL_PARAMS.demo);

  const loadAbortRef    = useRef<AbortController | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const itemAbortRefs = useRef<Map<number, AbortController>>(new Map());

  useEffect(() => {
    const stored = localStorage.getItem(LS_TOKEN);
    if (stored) {
      decryptToken(stored).then(setToken).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("IndexedDB unavailable")) {
          // Key store inaccessible (private browsing / policy) — token may still be readable
          // as a base64 fallback; try decoding it directly so the session still works.
          setTokenError(
            "Your browser's IndexedDB is unavailable (private browsing or enterprise policy). " +
            "The token could not be decrypted — please re-enter it.",
          );
        } else {
          // Corrupted or unreadable entry — remove it so the user gets a clean state
          localStorage.removeItem(LS_TOKEN);
          setTokenError(
            "Your saved token could not be decrypted and has been cleared. Please re-enter it.",
          );
        }
        console.error("Failed to decrypt stored token:", err);
      });
    }
    // Capture the Map reference (not .current) so the cleanup iterates the same Map
    // object that accumulates controllers during the component's lifetime.
    const abortMap = itemAbortRefs.current;
    return () => {
      loadAbortRef.current?.abort();
      refreshAbortRef.current?.abort();
      abortMap.forEach((ac) => ac.abort());
    };
  }, []);

  // Sync selected milestone numbers + owner/repo (or demo flag) to URL
  useEffect(() => {
    syncUrlParams(owner, repo, state.selected.map((m) => m.number), state.isDemo);
  }, [owner, repo, state.selected, state.isDemo]);

  useEffect(() => {
    document.body.classList.toggle("colorblind", settings.colorblindMode);
  }, [settings.colorblindMode]);

  const toggleDark = useCallback(() => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(LS_DARK, String(next));
    document.body.classList.toggle("dark", next);
  }, [dark]);

  // Color is derived from the milestone number so it is stable across re-loads
  // and repo changes — the same milestone always gets the same colour.
  // num % MILESTONE_COLORS.length is always a valid index; fallback is a safety net for noUncheckedIndexedAccess
  const milestoneColorFor = useCallback((num: number) => MILESTONE_COLORS[num % MILESTONE_COLORS.length] ?? "#0969da", []);

  const loadMilestones = useCallback(async () => {
    if (!token || !owner || !repo) {return;}
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    dispatch({ type: "FETCH_LIST_START" });
    try {
      const milestones = await fetchMilestones(owner, repo, token, ac.signal);
      dispatch({ type: "FETCH_LIST_SUCCESS", milestones });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {return;}
      dispatch({ type: "FETCH_LIST_ERROR", error: e instanceof Error ? e.message : String(e) });
    }
  }, [token, owner, repo]);

  // Auto-trigger milestone load when URL has owner/repo/milestones and token is now available
  const didAutoTriggerLoad = useRef(false);
  useEffect(() => {
    if (didAutoTriggerLoad.current) {return;}
    const pending = pendingUrlMilestones.current;
    if (token && owner && repo && pending.length > 0 && state.milestones.length === 0 && !state.loadingList) {
      didAutoTriggerLoad.current = true;
      void loadMilestones();
    }
  }, [token, owner, repo, state.milestones.length, state.loadingList, loadMilestones]);

  const addMilestone = useCallback(async (ms: Milestone) => {
    if (state.selected.some((m) => m.number === ms.number)) {return;}
    dispatch({ type: "SELECT_MILESTONE", milestone: ms });
    if (!(ms.number in state.itemsCache)) {
      const ac = new AbortController();
      itemAbortRefs.current.set(ms.number, ac);
      dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: ms.number });
      try {
        const items = await fetchMilestoneItems(owner, repo, token, ms.number, ac.signal);
        dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: ms.number, items });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {return;}
        dispatch({ type: "FETCH_ITEMS_ERROR", milestoneNumber: ms.number, error: e instanceof Error ? e.message : String(e) });
      } finally {
        itemAbortRefs.current.delete(ms.number);
      }
    }
  }, [state.selected, state.itemsCache, owner, repo, token]);

  const removeMilestone = useCallback((num: number) => {
    dispatch({ type: "REMOVE_MILESTONE", milestoneNumber: num });
  }, []);

  // Auto-select milestones from URL params once the milestone list is available
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    const pending = pendingUrlMilestones.current;
    if (autoLoadedRef.current || pending.length === 0 || state.milestones.length === 0) {return;}
    autoLoadedRef.current = true;
    for (const num of pending) {
      const ms = state.milestones.find((m) => m.number === num);
      if (ms) {void addMilestone(ms);}
    }
  }, [state.milestones, addMilestone]);

  const refreshMilestones = useCallback(async () => {
    if (state.selected.length === 0) {return;}
    refreshAbortRef.current?.abort();
    const ac = new AbortController();
    refreshAbortRef.current = ac;
    state.selected.forEach((ms) =>
      dispatch({ type: "FETCH_ITEMS_START", milestoneNumber: ms.number }),
    );
    await Promise.all(state.selected.map(async (ms) => {
      try {
        const items = await fetchMilestoneItems(owner, repo, token, ms.number, ac.signal);
        dispatch({ type: "FETCH_ITEMS_SUCCESS", milestoneNumber: ms.number, items });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {return;}
        dispatch({ type: "REFRESH_ITEMS_ERROR", milestoneNumber: ms.number, error: e instanceof Error ? e.message : String(e) });
      }
    }));
  }, [state.selected, owner, repo, token]);

  const loadDemo = useCallback(() => {
    const demoMilestones = [DEMO_MILESTONE, DEMO_MILESTONE_2, DEMO_MILESTONE_3];
    const allCache = {
      [DEMO_MILESTONE.number]:   DEMO_ITEMS,
      [DEMO_MILESTONE_2.number]: DEMO_ITEMS_2,
      [DEMO_MILESTONE_3.number]: DEMO_ITEMS_3,
    };
    const urlNums = pendingUrlMilestones.current;
    const preSelected = urlNums.length > 0
      ? demoMilestones.filter((m) => urlNums.includes(m.number))
      : [DEMO_MILESTONE];
    dispatch({
      type:       "LOAD_DEMO",
      milestones: demoMilestones,
      selected:   preSelected.length > 0 ? preSelected : [DEMO_MILESTONE],
      itemsCache: allCache,
    });
  }, []);

  // Auto-load demo when URL contains ?demo=1
  useEffect(() => {
    if (urlHasDemo.current) {loadDemo();}
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: runs once on mount; loadDemo has stable [] deps
  }, []);

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
    if (v) {
      encryptToken(v)
        .then((ct) => localStorage.setItem(LS_TOKEN, ct))
        .catch((err: unknown) => {
          if (err instanceof EncryptionUnavailableError) {
            // Store the unencrypted fallback so the session persists, but warn clearly.
            localStorage.setItem(LS_TOKEN, err.fallbackPayload);
            setTokenError(
              "Your browser's IndexedDB is unavailable (private browsing or enterprise policy). " +
              "Your token is stored without encryption — avoid using this on shared devices.",
            );
          } else {
            console.error("Failed to encrypt token:", err);
            setTokenError(
              "Your token could not be saved to storage — it will work for this session but will not persist after reload.",
            );
          }
        });
    } else {
      localStorage.removeItem(LS_TOKEN);
    }
  }, []);

  const handleOwnerChange = useCallback((v: string) => {
    setOwner(v);
    try { localStorage.setItem(LS_OWNER, v); } catch { /* quota exceeded — value persists in state for this session */ }
  }, []);

  const handleRepoChange = useCallback((v: string) => {
    setRepo(v);
    try { localStorage.setItem(LS_REPO, v); } catch { /* quota exceeded — value persists in state for this session */ }
  }, []);

  return (
    <ThemeProvider theme={dark ? muiDarkTheme : muiLightTheme}>
      <CssBaseline />
      <Box sx={{ maxWidth: settings.fullWidth ? "none" : 1400, mx: "auto", px: 3, py: 3, display: "flex", flexDirection: "column", gap: 2 }}>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={700}>GitHub Work Visualiser</Typography>
          <Stack direction="row" gap={0.5} alignItems="center">
          <IconButton onClick={(e) => setSettingsAnchor(e.currentTarget)} title="Settings" aria-label="Settings" size="small">
            <GearIcon />
          </IconButton>
          <Popover
            open={Boolean(settingsAnchor)}
            anchorEl={settingsAnchor}
            onClose={() => setSettingsAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Box sx={{ p: 2, minWidth: 220 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Settings</Typography>
              <Divider sx={{ mb: 1.5 }} />
              <Stack direction="column">
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={settings.highlightWeekends}
                      onChange={(e) => updateSetting("highlightWeekends", e.target.checked)}
                    />
                  }
                  label={<Typography variant="body2">Highlight weekends</Typography>}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={settings.colorblindMode}
                      onChange={(e) => updateSetting("colorblindMode", e.target.checked)}
                    />
                  }
                  label={<Typography variant="body2">Colorblind-friendly palette</Typography>}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={settings.fullWidth}
                      onChange={(e) => updateSetting("fullWidth", e.target.checked)}
                    />
                  }
                  label={<Typography variant="body2">Full width layout</Typography>}
                />
              </Stack>
            </Box>
          </Popover>
          <IconButton onClick={toggleDark} title={dark ? "Switch to light mode" : "Switch to dark mode"} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} size="small">
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

        {tokenError && (
          <Alert severity="warning" onClose={() => setTokenError(null)}>{tokenError}</Alert>
        )}
        {state.error && <Alert severity="error">{state.error}</Alert>}
        {state.emptyMilestoneNums.length > 0 && (
          <Alert severity="warning">
            {state.emptyMilestoneNums.length === 1
              ? `Milestone #${state.emptyMilestoneNums[0]!} has no items.`
              : `${state.emptyMilestoneNums.length} milestones have no items.`}
          </Alert>
        )}
        {state.loadingNums.length > 0 && <Alert severity="info" role="status" aria-live="polite">Loading milestone data…</Alert>}

        {allItems.length > 0 && milestonesMeta.length > 0 && (
          <Timeline items={allItems} milestones={milestonesMeta} highlightWeekends={settings.highlightWeekends} colorblindMode={settings.colorblindMode} />
        )}

      </Box>
    </ThemeProvider>
  );
};

export { App };
