import type { AppPhase, View } from "./types/AppTypes";
import type { Repo, UserProfile } from "./types/GitHubTypes";
import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import LinearProgress from "@mui/material/LinearProgress";
import { ThemeProvider } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUserProfile, fetchUserRepos } from "./api/github";
import { AppHeader } from "./components/AppHeader";
import { ContextBar } from "./components/ContextBar";
import { EmptyState } from "./components/EmptyState";
import { FetchingOverlay } from "./components/FetchingOverlay";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { MilestoneView } from "./components/MilestoneView";
import { SettingsPopover } from "./components/SettingsPopover";
import { SplashScreen } from "./components/SplashScreen";
import { DEMO_REPOS, DEMO_USER } from "./data/demo";
import { LS_TOKEN, useAuth } from "./hooks/useAuth";
import { useBankHolidays } from "./hooks/useBankHolidays";
import { useConfigImportExport } from "./hooks/useConfigImportExport";
import { useDarkMode } from "./hooks/useDarkMode";
import { useMilestones } from "./hooks/useMilestones";
import { useNewVersionAvailable } from "./hooks/useNewVersionAvailable";
import { useSettings } from "./hooks/useSettings";
import { muiDarkTheme, muiLightTheme } from "./theme";
import { isElectron } from "./utils/platform";
import { decryptToken } from "./utils/tokenCrypto";
import { decodeShareCode, readUrlParams, readViewFiltersFromUrl, setViewParam, syncFiltersToUrl, syncUrlParams } from "./utils/urlUtils";

// Evaluated once at module load — stable across the lifetime of the page
const INITIAL_URL_PARAMS = readUrlParams();

const App: FunctionComponent = () => {
  const { dark, toggleDark, applyDark } = useDarkMode();
  const { settings, updateSetting }     = useSettings();
  const newVersionAvailable = useNewVersionAvailable();

  const initialPhase: AppPhase = localStorage.getItem(LS_TOKEN) || INITIAL_URL_PARAMS.demo
    ? "authenticating"
    : "splash";

  const auth = useAuth(initialPhase);

  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  // Ensures the auto-login effect runs exactly once on mount. Without this,
  // changes to transitionToDashboard's reference (caused by token state
  // updating after gh CLI auth) re-trigger the effect, which finds nothing in
  // localStorage and immediately kicks the user back to the splash screen.
  const autoLoginRan = useRef(false);

  const milestones = useMilestones({
    token:          auth.token,
    colorblindMode: settings.colorblindMode,
  });

  const bankHolidays = useBankHolidays({
    enabled: settings.highlightBankHolidays,
    regions: settings.bankHolidayRegions,
    allItems: milestones.allItems,
  });

  // ── Auth orchestration ────────────────────────────────────────────────────

  const { setToken, setUserProfile, setRepos, setPhase, saveToken, disconnect, setTokenError } = auth;
  const { dispatch: milestoneDispatch, loadDemoForRepo, loadMilestonesForRepo, resetMilestones } = milestones;

  const transitionToDashboard = useCallback((
    rawToken: string, profile: UserProfile, repoList: Repo[],
  ) => {
    setToken(rawToken);
    setUserProfile(profile);
    setRepos(repoList);
    const { owner, repo } = INITIAL_URL_PARAMS;
    const autoRepo = owner && repo
      ? (repoList.find((r) =>
          r.owner.toLowerCase() === owner.toLowerCase() &&
          r.name.toLowerCase()  === repo.toLowerCase()
        ) ?? null)
      : null;
    if (autoRepo) {
      milestoneDispatch({ type: "SET_REPO", repo: autoRepo });
    }
    setPhase("dashboard");
    if (autoRepo) {
      void loadMilestonesForRepo(autoRepo, {
        autoSelectNums:     INITIAL_URL_PARAMS.milestoneNums,
        autoSelectEpicNums: INITIAL_URL_PARAMS.epicNums,
        overrideToken:      rawToken,
      });
    }
  }, [setToken, setUserProfile, setRepos, setPhase, loadMilestonesForRepo, milestoneDispatch]);

  const handleDemo = useCallback(() => {
    const firstRepo = DEMO_REPOS[0] ?? null;
    setUserProfile(DEMO_USER);
    setRepos(DEMO_REPOS);
    setPhase("dashboard");
    if (firstRepo) {
      milestoneDispatch({ type: "SET_REPO", repo: firstRepo });
      loadDemoForRepo(firstRepo, INITIAL_URL_PARAMS.milestoneNums);
    }
  }, [setUserProfile, setRepos, setPhase, loadDemoForRepo, milestoneDispatch]);

  // Auto-login from stored token, or auto-start demo from URL param.
  // The ref guard ensures this runs exactly once — dependency changes caused
  // by token state updating (e.g. after gh CLI auth) must not re-fire it.
  useEffect(() => {
    if (autoLoginRan.current) { return; }
    autoLoginRan.current = true;
    if (INITIAL_URL_PARAMS.demo) {
      handleDemo();
      return;
    }
    const stored = localStorage.getItem(LS_TOKEN);
    if (!stored) { setPhase("splash"); return; }
    decryptToken(stored)
      .then(async (decrypted) => {
        const [profileResult, reposResult] = await Promise.allSettled([
          fetchUserProfile(decrypted),
          fetchUserRepos(decrypted),
        ]);
        if (profileResult.status === "rejected") {
          throw profileResult.reason;
        }
        const repoList = reposResult.status === "fulfilled" ? reposResult.value : [];
        if (reposResult.status === "rejected") {
          setTokenError("Your token couldn't list repositories — you can still type an owner/repo below to load milestones.");
        }
        saveToken(decrypted);
        transitionToDashboard(decrypted, profileResult.value, repoList);
      })
      .catch((err: unknown) => {
        console.error("Failed to decrypt stored token; session cleared.", err);
        localStorage.removeItem(LS_TOKEN);
        setPhase("splash");
      });
  }, [handleDemo, saveToken, setPhase, setTokenError, transitionToDashboard]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    resetMilestones();
    setSettingsAnchor(null);
  }, [disconnect, resetMilestones]);

  // ── Repo / milestone orchestration ───────────────────────────────────────

  const handleRepoSelect = useCallback((repo: Repo | null) => {
    milestones.dispatch({ type: "SET_REPO", repo });
    if (!repo) { return; }
    if (milestones.state.isDemo) {
      milestones.loadDemoForRepo(repo, []);
    } else {
      void milestones.loadMilestonesForRepo(repo);
    }
  }, [milestones]);

  const applySharedCode = useCallback(async (code: string) => {
    const search = decodeShareCode(code);
    if (search === null) { throw new Error("Invalid share code"); }

    // Update the URL so the read utilities reflect the shared state
    window.history.replaceState(null, "", search || window.location.pathname);

    const { owner, repo: repoName, milestoneNums, epicNums } = readUrlParams();
    const { view, filters } = readViewFiltersFromUrl();

    const foundRepo = owner && repoName
      ? (auth.repos.find(
          (r) => r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === repoName.toLowerCase(),
        ) ?? { id: -1, owner, name: repoName, fullName: `${owner}/${repoName}`, private: false, description: null })
      : null;

    if (foundRepo) { milestoneDispatch({ type: "SET_REPO", repo: foundRepo }); }
    milestoneDispatch({ type: "SET_VIEW", view });
    milestoneDispatch({ type: "SET_FILTERS", filters });

    if (foundRepo) {
      await loadMilestonesForRepo(foundRepo, { autoSelectNums: milestoneNums, autoSelectEpicNums: epicNums });
    }
  }, [auth.repos, milestoneDispatch, loadMilestonesForRepo]);

  // ── URL synchronisation ───────────────────────────────────────────────────

  useEffect(() => {
    syncUrlParams(
      milestones.state.activeRepo,
      milestones.state.selected.map((m) => m.number),
      milestones.state.isDemo,
      milestones.state.selectedEpics.map((e) => e.number),
    );
    setViewParam(milestones.state.view);
    syncFiltersToUrl(milestones.state.filters);
  }, [milestones.state.activeRepo, milestones.state.selected, milestones.state.isDemo, milestones.state.view, milestones.state.filters, milestones.state.selectedEpics]);

  useEffect(() => {
    document.body.classList.toggle("colorblind", settings.colorblindMode);
  }, [settings.colorblindMode]);

  useEffect(() => {
    const activeRepo = milestones.state.activeRepo;
    const selected   = milestones.state.selected;
    const base = "GH Insight";
    if (!activeRepo) { document.title = base; return; }
    const repo = `${activeRepo.owner}/${activeRepo.name}`;
    if (selected.length === 0) { document.title = `${repo} — ${base}`; return; }
    const label = selected.length === 1 && selected[0] ? selected[0].title : `${selected.length} milestones`;
    document.title = `${label} — ${repo} — ${base}`;
  }, [milestones.state.activeRepo, milestones.state.selected]);

  // ── View navigation ───────────────────────────────────────────────────────

  const handleViewChange = useCallback((v: View) => {
    milestones.dispatch({ type: "SET_VIEW", view: v });
  }, [milestones]);

  // ── Config import / export ────────────────────────────────────────────────

  const { configError, clearConfigError, fileInputRef, handleExportConfig, handleImportConfig } = useConfigImportExport({
    activeRepo: milestones.state.activeRepo,
    dark,
    settings,
    applyDark,
    setToken,
    saveToken,
    updateSetting,
    onImportSuccess: useCallback(() => setSettingsAnchor(null), []),
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ThemeProvider theme={dark ? muiDarkTheme : muiLightTheme}>
      <CssBaseline />

      {auth.phase !== "dashboard" ? (
        <SplashScreen
          onConnect={auth.handleConnect}
          {...(isElectron() ? {
            onConnectWithGhCli: auth.connectWithGhCli,
            // useCallback equivalent — stable ref so SplashScreen's useEffect
            // doesn't re-fire on every render and race with sign-in clicks
            onCheckGhCli: auth.checkGhCli,
          } : {})}
          onDemo={handleDemo}
          loading={auth.phase === "authenticating"}
          error={auth.authError}
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
            userProfile={auth.userProfile ?? DEMO_USER}
            dark={dark}
            onToggleDark={toggleDark}
            onSettingsClick={(e) => setSettingsAnchor(e.currentTarget)}
          />

          <SettingsPopover
            anchor={settingsAnchor}
            onClose={() => setSettingsAnchor(null)}
            settings={settings}
            updateSetting={updateSetting}
            onExportConfig={handleExportConfig}
            fileInputRef={fileInputRef}
            onImportConfig={handleImportConfig}
            onDisconnect={handleDisconnect}
          />

          <ContextBar
            repos={auth.repos}
            activeRepo={milestones.state.activeRepo}
            onRepoChange={handleRepoSelect}
            isDemo={milestones.state.isDemo}
            milestones={milestones.state.milestones}
            selected={milestones.state.selected}
            loadingList={milestones.state.loadingList}
            loadingNums={milestones.state.loadingNums}
            milestonesHasMore={milestones.state.milestonesHasMore}
            loadingMoreMilestones={milestones.state.loadingMoreMilestones}
            colorFor={milestones.milestoneColorFor}
            onAdd={milestones.addMilestone}
            onRemove={milestones.removeMilestone}
            onRefresh={milestones.refreshMilestones}
            onLoadMoreMilestones={milestones.loadMoreMilestones}
            epics={milestones.state.epics}
            selectedEpics={milestones.state.selectedEpics}
            loadingEpicList={milestones.state.loadingEpicList}
            loadingEpicNums={milestones.state.loadingEpicNums}
            epicsHasMore={milestones.state.epicsHasMore}
            loadingMoreEpics={milestones.state.loadingMoreEpics}
            epicColorFor={milestones.epicColorFor}
            onAddEpic={milestones.addEpic}
            onRemoveEpic={milestones.removeEpic}
            onLoadMoreEpics={milestones.loadMoreEpics}
            view={milestones.state.view}
            onViewChange={handleViewChange}
            hasItems={milestones.allItems.length > 0}
            onImportCode={applySharedCode}
          />

          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {(auth.tokenError || configError || milestones.state.error || milestones.state.emptyMilestoneNums.length > 0 || milestones.state.emptyEpicNums.length > 0) && (
              <Box sx={{ px: 3, pt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {auth.tokenError && (
                  <Alert severity="warning" onClose={auth.clearTokenError}>{auth.tokenError}</Alert>
                )}
                {configError && (
                  <Alert severity="error" onClose={clearConfigError}>{configError}</Alert>
                )}
                {milestones.state.error && (
                  <Alert
                    severity="error"
                    action={milestones.state.error.includes("(401)") ? (
                      <Button size="small" color="inherit" onClick={handleDisconnect}>Reconnect</Button>
                    ) : undefined}
                  >
                    {milestones.state.error}
                  </Alert>
                )}
                {milestones.state.emptyMilestoneNums.length > 0 && (
                  <Alert severity="warning">
                    {milestones.state.emptyMilestoneNums.length === 1
                      ? `Milestone #${milestones.state.emptyMilestoneNums[0] ?? "?"} has no items.`
                      : `${milestones.state.emptyMilestoneNums.length} milestones have no items.`}
                  </Alert>
                )}
                {milestones.state.emptyEpicNums.length > 0 && (
                  <Alert severity="warning">
                    {milestones.state.emptyEpicNums.length === 1
                      ? `Epic #${milestones.state.emptyEpicNums[0] ?? "?"} has no sub-issues.`
                      : `${milestones.state.emptyEpicNums.length} epics have no sub-issues.`}
                  </Alert>
                )}
              </Box>
            )}

            {(() => {
              const isFetching =
                milestones.state.loadingNums.length > 0 ||
                milestones.state.loadingEpicNums.length > 0;
              if (!isFetching) { return null; }

              const fetchItems = [
                ...milestones.state.selected.map((m) => ({
                  name: m.title,
                  done: milestones.state.itemsCache[m.number] !== undefined,
                })),
                ...milestones.state.selectedEpics.map((e) => ({
                  name: e.title,
                  done: milestones.state.epicItemsCache[e.number] !== undefined,
                })),
              ];
              const totalSelected = fetchItems.length;
              const loadedCount   = fetchItems.filter((i) => i.done).length;

              // No data yet — show full centered overlay
              if (milestones.allItems.length === 0) {
                return (
                  <FetchingOverlay items={fetchItems} />
                );
              }

              // Already have some data — show slim progress bar at top so existing content stays visible
              return (
                <LinearProgress
                  variant={totalSelected > 1 ? "determinate" : "indeterminate"}
                  value={totalSelected > 1 ? (loadedCount / totalSelected) * 100 : undefined}
                  sx={{ flexShrink: 0 }}
                />
              );
            })()}

            {!milestones.state.activeRepo && (
              <EmptyState
                icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h2.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>}
                title="Select a repository"
                message="Choose a repository from the dropdown above"
              />
            )}

            {milestones.state.activeRepo && milestones.state.milestones.length === 0 && !milestones.state.loadingList && !milestones.state.error && (
              <EmptyState
                icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>}
                title="No milestones found"
                message="This repository has no open or closed milestones"
              />
            )}

            {milestones.allItems.length > 0 && milestones.milestonesMeta.length > 0 && (
              <Box sx={{ flex: 1, px: 2, pt: 1.5, pb: 2, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <MilestoneView
                  items={milestones.allItems}
                  milestones={milestones.milestonesMeta}
                  highlightWeekends={settings.highlightWeekends}
                  bankHolidays={bankHolidays}
                  colorblindMode={settings.colorblindMode}
                  view={milestones.state.view}
                  filters={milestones.state.filters}
                  includePRs={milestones.state.includePRs}
                  dispatch={milestones.dispatch}
                />
              </Box>
            )}
          </Box>

        </Box>
      )}
      <KeyboardShortcuts />
    </ThemeProvider>
  );
};

export { App };
