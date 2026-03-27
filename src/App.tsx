import type { Milestone, Repo, UserProfile } from "./types";
import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CssBaseline from "@mui/material/CssBaseline";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { fetchMilestoneItems, fetchMilestones, fetchUserProfile, fetchUserRepos } from "./api/github";
import { AppHeader } from "./components/AppHeader";
import { ContextBar } from "./components/ContextBar";
import { SplashScreen } from "./components/SplashScreen";
import { DEFAULT_VIEW, Timeline, readViewFiltersFromUrl } from "./components/Timeline";
import type { View } from "./components/Timeline";
import { DEMO_DATA_BY_REPO, DEMO_REPOS, DEMO_USER } from "./data/demo";
import { useNewVersionAvailable } from "./hooks/useNewVersionAvailable";
import { useSettings } from "./hooks/useSettings";
import { initialState, milestoneReducer } from "./state/milestoneReducer";
import { muiDarkTheme, muiLightTheme } from "./theme";
import { EncryptionUnavailableError, decryptToken, encryptToken } from "./utils/tokenCrypto";

type AppPhase = "splash" | "authenticating" | "dashboard";

const LS_TOKEN = "gmt_token";
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

const syncUrlParams = (activeRepo: Repo | null, selectedNums: number[], isDemo: boolean): void => {
  const p = new URLSearchParams(window.location.search);
  p.delete("owner"); p.delete("repo"); p.delete("demo"); p.delete("milestones");
  if (isDemo) {
    p.set("demo", "1");
  } else if (activeRepo) {
    p.set("owner", activeRepo.owner);
    p.set("repo", activeRepo.name);
  }
  if (selectedNums.length > 0) { p.set("milestones", selectedNums.join(",")); }
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
};

const MILESTONE_COLORS = ["#0969da", "#8250df", "#1a7f37", "#d97706", "#cf222e", "#0550ae"];

const initDark = (): boolean => {
  const isDark = localStorage.getItem(LS_DARK) !== "false";
  document.body.classList.toggle("dark", isDark);
  return isDark;
};
const INITIAL_DARK = initDark();
const INITIAL_URL_PARAMS = readUrlParams();

const App: FunctionComponent = () => {
  const [phase, setPhase]           = useState<AppPhase>(() =>
    localStorage.getItem(LS_TOKEN) || INITIAL_URL_PARAMS.demo ? "authenticating" : "splash",
  );
  const [dark, setDark]             = useState(INITIAL_DARK);
  const [token, setToken]           = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [authError, setAuthError]   = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [repos, setRepos]           = useState<Repo[]>([]);
  const [activeRepo, setActiveRepo] = useState<Repo | null>(null);
  const [isDemo, setIsDemo]         = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const { settings, updateSetting } = useSettings();
  const newVersionAvailable = useNewVersionAvailable();

  const [view, setView] = useState<View>(() => readViewFiltersFromUrl().view);
  const [configError, setConfigError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, dispatch] = useReducer(milestoneReducer, initialState);

  const pendingUrlMilestones = useRef<number[]>(INITIAL_URL_PARAMS.milestoneNums);
  const loadAbortRef    = useRef<AbortController | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const itemAbortRefs   = useRef<Map<number, AbortController>>(new Map());

  const milestoneColorFor = useCallback(
    (num: number) => MILESTONE_COLORS[num % MILESTONE_COLORS.length] ?? "#0969da",
    [],
  );

  const saveToken = useCallback((raw: string) => {
    encryptToken(raw)
      .then((ct) => localStorage.setItem(LS_TOKEN, ct))
      .catch((err: unknown) => {
        if (err instanceof EncryptionUnavailableError) {
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
  }, []);

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

  const handleDemo = useCallback(() => {
    const firstRepo = DEMO_REPOS[0] ?? null;
    setUserProfile(DEMO_USER);
    setRepos(DEMO_REPOS);
    setIsDemo(true);
    setActiveRepo(firstRepo);
    if (firstRepo) { loadDemoForRepo(firstRepo, pendingUrlMilestones.current); }
    setPhase("dashboard");
  }, [loadDemoForRepo]);

  const transitionToDashboard = useCallback((
    rawToken: string, profile: UserProfile, repoList: Repo[],
  ) => {
    setToken(rawToken);
    setUserProfile(profile);
    setRepos(repoList);
    // Auto-select repo from URL params if present
    const { owner, repo } = INITIAL_URL_PARAMS;
    const autoRepo = owner && repo
      ? (repoList.find((r) =>
          r.owner.toLowerCase() === owner.toLowerCase() &&
          r.name.toLowerCase()  === repo.toLowerCase()
        ) ?? null)
      : null;
    setActiveRepo(autoRepo);
    setPhase("dashboard");
  }, []);

  // On mount: auto-login from stored token or load demo from URL
  useEffect(() => {
    if (INITIAL_URL_PARAMS.demo) {
      handleDemo();
      return;
    }
    const stored = localStorage.getItem(LS_TOKEN);
    if (!stored) { return; } // stays on splash
    decryptToken(stored)
      .then(async (decrypted) => {
        const [profile, repoList] = await Promise.all([
          fetchUserProfile(decrypted),
          fetchUserRepos(decrypted),
        ]);
        saveToken(decrypted);
        transitionToDashboard(decrypted, profile, repoList);
      })
      .catch(() => {
        localStorage.removeItem(LS_TOKEN);
        setPhase("splash");
      });

    const abortMap = itemAbortRefs.current;
    return () => {
      loadAbortRef.current?.abort();
      refreshAbortRef.current?.abort();
      abortMap.forEach((ac) => ac.abort());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: runs once on mount
  }, []);

  useEffect(() => {
    document.body.classList.toggle("colorblind", settings.colorblindMode);
  }, [settings.colorblindMode]);

  // Sync URL params whenever relevant state changes
  useEffect(() => {
    syncUrlParams(activeRepo, state.selected.map((m) => m.number), isDemo);
  }, [activeRepo, state.selected, isDemo]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (view !== DEFAULT_VIEW) { p.set("v", view); } else { p.delete("v"); }
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [view]);

  const handleConnect = useCallback(async (inputToken: string) => {
    setAuthError(null);
    setPhase("authenticating");
    try {
      const [profile, repoList] = await Promise.all([
        fetchUserProfile(inputToken),
        fetchUserRepos(inputToken),
      ]);
      saveToken(inputToken);
      transitionToDashboard(inputToken, profile, repoList);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
      setPhase("splash");
    }
  }, [saveToken, transitionToDashboard]);

  const handleDisconnect = useCallback(() => {
    localStorage.removeItem(LS_TOKEN);
    setToken("");
    setUserProfile(null);
    setRepos([]);
    setActiveRepo(null);
    setIsDemo(false);
    dispatch({ type: "RESET" });
    setSettingsAnchor(null);
    setPhase("splash");
  }, []);

  const toggleDark = useCallback(() => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(LS_DARK, String(next));
    document.body.classList.toggle("dark", next);
  }, [dark]);

  const loadMilestonesForRepo = useCallback(async (repo: Repo) => {
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    dispatch({ type: "FETCH_LIST_START" });
    try {
      const milestones = await fetchMilestones(repo.owner, repo.name, token, ac.signal);
      dispatch({ type: "FETCH_LIST_SUCCESS", milestones });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") { return; }
      dispatch({ type: "FETCH_LIST_ERROR", error: e instanceof Error ? e.message : String(e) });
    }
  }, [token]);

  const handleRepoSelect = useCallback((repo: Repo | null) => {
    setActiveRepo(repo);
    dispatch({ type: "RESET" });
    if (!repo) { return; }
    if (isDemo) {
      loadDemoForRepo(repo, []);
      return;
    }
    void loadMilestonesForRepo(repo);
  }, [isDemo, loadDemoForRepo, loadMilestonesForRepo]);

  // Auto-load milestones for auto-selected repo (from URL params) on dashboard entry
  const didAutoLoadRepo = useRef(false);
  useEffect(() => {
    if (didAutoLoadRepo.current || isDemo || !activeRepo || !token) { return; }
    didAutoLoadRepo.current = true;
    void loadMilestonesForRepo(activeRepo);
  }, [activeRepo, isDemo, token, loadMilestonesForRepo]);

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

  // Auto-select milestones from URL params once the milestone list is available
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    const pending = pendingUrlMilestones.current;
    if (autoLoadedRef.current || pending.length === 0 || state.milestones.length === 0) { return; }
    autoLoadedRef.current = true;
    for (const num of pending) {
      const ms = state.milestones.find((m) => m.number === num);
      if (ms) { void addMilestone(ms); }
    }
  }, [state.milestones, addMilestone]);

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

  const handleExportConfig = useCallback(() => {
    const config = { version: 1, owner: activeRepo?.owner ?? "", repo: activeRepo?.name ?? "", dark, token, settings };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url; a.download = "github-work-visualiser-config.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [activeRepo, dark, token, settings]);

  const handleImportConfig = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw: unknown = JSON.parse(ev.target?.result as string);
        if (typeof raw !== "object" || raw === null) { throw new Error("Not a valid config object"); }
        const c = raw as Record<string, unknown>;
        if (typeof c.dark === "boolean") {
          setDark(c.dark);
          localStorage.setItem(LS_DARK, String(c.dark));
          document.body.classList.toggle("dark", c.dark);
        }
        if (typeof c.token === "string" && c.token) {
          setToken(c.token);
          saveToken(c.token);
        }
        if (typeof c.settings === "object" && c.settings !== null) {
          const s = c.settings as Record<string, unknown>;
          if (typeof s.highlightWeekends === "boolean") { updateSetting("highlightWeekends", s.highlightWeekends); }
          if (typeof s.colorblindMode    === "boolean") { updateSetting("colorblindMode",    s.colorblindMode); }
        }
        setSettingsAnchor(null);
      } catch (err) {
        setConfigError(`Config import failed: ${err instanceof Error ? err.message : "invalid file"}`);
      }
    };
    reader.readAsText(file);
  }, [saveToken, updateSetting]);

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

  return (
    <ThemeProvider theme={dark ? muiDarkTheme : muiLightTheme}>
      <CssBaseline />

      {phase !== "dashboard" ? (
        <SplashScreen
          onConnect={handleConnect}
          onDemo={handleDemo}
          loading={phase === "authenticating"}
          error={authError}
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

          {newVersionAvailable && (
            <Alert
              severity="info"
              sx={{ borderRadius: 0 }}
              action={
                <Button size="small" color="inherit" onClick={() => window.location.reload()}>
                  Reload
                </Button>
              }
            >
              A new version is available.
            </Alert>
          )}

          <AppHeader
            userProfile={userProfile!}
            dark={dark}
            onToggleDark={toggleDark}
            onSettingsClick={(e) => setSettingsAnchor(e.currentTarget)}
          />

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
                  control={<Switch size="small" checked={settings.highlightWeekends} onChange={(e) => updateSetting("highlightWeekends", e.target.checked)} />}
                  label={<Typography variant="body2">Highlight weekends</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" checked={settings.colorblindMode} onChange={(e) => updateSetting("colorblindMode", e.target.checked)} />}
                  label={<Typography variant="body2">Colorblind-friendly palette</Typography>}
                />
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: "0.06em", display: "block", mb: 1 }}>
                Config
              </Typography>
              <ButtonGroup size="small" variant="outlined" fullWidth>
                <Button onClick={handleExportConfig}>Export</Button>
                <Button onClick={() => fileInputRef.current?.click()}>Import</Button>
              </ButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                Export includes your token in plain text.
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Button
                variant="outlined"
                color="error"
                size="small"
                fullWidth
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </Box>
          </Popover>

          <input type="file" accept=".json" hidden ref={fileInputRef} onChange={handleImportConfig} />

          <ContextBar
            repos={repos}
            activeRepo={activeRepo}
            onRepoChange={handleRepoSelect}
            isDemo={isDemo}
            milestones={state.milestones}
            selected={state.selected}
            loadingList={state.loadingList}
            loadingNums={state.loadingNums}
            colorFor={milestoneColorFor}
            onAdd={addMilestone}
            onRemove={removeMilestone}
            onRefresh={refreshMilestones}
            view={view}
            onViewChange={setView}
            hasItems={allItems.length > 0}
          />

          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Notification strip — only rendered when something needs attention */}
            {(tokenError || configError || state.error || state.emptyMilestoneNums.length > 0 || state.loadingNums.length > 0) && (
              <Box sx={{ px: 3, pt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {tokenError && (
                  <Alert severity="warning" onClose={() => setTokenError(null)}>{tokenError}</Alert>
                )}
                {configError && (
                  <Alert severity="error" onClose={() => setConfigError(null)}>{configError}</Alert>
                )}
                {state.error && <Alert severity="error">{state.error}</Alert>}
                {state.emptyMilestoneNums.length > 0 && (
                  <Alert severity="warning">
                    {state.emptyMilestoneNums.length === 1
                      ? `Milestone #${state.emptyMilestoneNums[0]!} has no items.`
                      : `${state.emptyMilestoneNums.length} milestones have no items.`}
                  </Alert>
                )}
                {state.loadingNums.length > 0 && (
                  <Alert severity="info" role="status" aria-live="polite">Loading milestone data…</Alert>
                )}
              </Box>
            )}

            {/* Empty state: no repo selected */}
            {!activeRepo && (
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <Box sx={{ color: "text.disabled" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h2.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                  </svg>
                </Box>
                <Typography variant="body1" fontWeight={500} color="text.secondary">Select a repository</Typography>
                <Typography variant="body2" color="text.disabled">Choose a repository from the dropdown above to load its milestones</Typography>
              </Box>
            )}

            {/* Empty state: repo has no milestones */}
            {activeRepo && state.milestones.length === 0 && !state.loadingList && !state.error && (
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <Box sx={{ color: "text.disabled" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </Box>
                <Typography variant="body1" fontWeight={500} color="text.secondary">No milestones found</Typography>
                <Typography variant="body2" color="text.disabled">This repository has no open or closed milestones</Typography>
              </Box>
            )}

            {/* Main content */}
            {allItems.length > 0 && milestonesMeta.length > 0 && (
              <Box sx={{ flex: 1, px: 2, pt: 1.5, pb: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <Timeline
                  items={allItems}
                  milestones={milestonesMeta}
                  highlightWeekends={settings.highlightWeekends}
                  colorblindMode={settings.colorblindMode}
                  view={view}
                  onViewChange={setView}
                />
              </Box>
            )}
          </Box>

        </Box>
      )}
    </ThemeProvider>
  );
};

export { App };
