import type { AppPhase, View } from "./types/AppTypes";

import type { Epic, Milestone, Repo, TimelineItem, UserProfile } from "./types/GitHubTypes";
import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import LinearProgress from "@mui/material/LinearProgress";
import { ThemeProvider } from "@mui/material/styles";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchUserProfile, fetchUserRepos } from "./api/githubApi";
import { AppHeader } from "./components/AppHeader";
import { ContextBar } from "./components/ContextBar";
import { EmptyState } from "./components/EmptyState";
import { FetchingOverlay } from "./components/FetchingOverlay";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { MilestoneView } from "./components/MilestoneView";
import { SettingsPopover } from "./components/SettingsPopover";
import { SplashScreen } from "./components/SplashScreen";
import { UpdateBar } from "./components/UpdateBar";
import { DEMO_REPOS, DEMO_USER } from "./data/demo";
import { LS_TOKEN, useAuth } from "./hooks/useAuth";
import { useBankHolidays } from "./hooks/useBankHolidays";
import { useConfigImportExport } from "./hooks/useConfigImportExport";
import { useDarkMode } from "./hooks/useDarkMode";
import { useMilestones } from "./hooks/useMilestones";
import { useSettings } from "./hooks/useSettings";
import { muiDarkTheme, muiLightTheme } from "./theme";
import { VIEWS } from "./types/AppTypes";
import { isElectron } from "./utils/platform";
import { decryptToken } from "./utils/tokenCrypto";
import { decodeShareCode, readUrlParams, readViewFiltersFromUrl } from "./utils/urlUtils";

// Evaluated once at module load — stable across the lifetime of the page
const INITIAL_URL_PARAMS = readUrlParams();

type FetchingProgressProps = {
  loadingNums:     number[];
  loadingEpicNums: number[];
  selected:        Milestone[];
  selectedEpics:   Epic[];
  itemsCache:      Record<number, TimelineItem[]>;
  epicItemsCache:  Record<number, TimelineItem[]>;
  hasItems:        boolean;
};

/** Slim progress indicator shown while milestone/epic items are loading. */
const FetchingProgress: FunctionComponent<FetchingProgressProps> = ({
  loadingNums, loadingEpicNums, selected, selectedEpics,
  itemsCache, epicItemsCache, hasItems,
}) => {
  const isFetching = loadingNums.length > 0 || loadingEpicNums.length > 0;
  if (!isFetching) { return null; }

  const fetchItems = [
    ...selected.map((m) => ({ name: m.title, done: itemsCache[m.number] !== undefined })),
    ...selectedEpics.map((e) => ({ name: e.title, done: epicItemsCache[e.number] !== undefined })),
  ];
  const totalSelected = fetchItems.length;
  const loadedCount   = fetchItems.filter((i) => i.done).length;

  if (!hasItems) {
    return <FetchingOverlay items={fetchItems} />;
  }

  return (
    <LinearProgress
      variant={totalSelected > 1 ? "determinate" : "indeterminate"}
      value={totalSelected > 1 ? (loadedCount / totalSelected) * 100 : undefined}
      aria-label={totalSelected > 1 ? `Loading ${loadedCount} of ${totalSelected} items` : "Loading items"}
      sx={{ flexShrink: 0 }}
    />
  );
};

const App: FunctionComponent = () => {
  const { dark, toggleDark, applyDark } = useDarkMode();
  const { settings, updateSetting }     = useSettings();

  const initialPhase: AppPhase = localStorage.getItem(LS_TOKEN) || INITIAL_URL_PARAMS.demo || INITIAL_URL_PARAMS.previewNoRepos
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

  const { minTime, maxTime } = useMemo(() => {
    if (milestones.allItems.length === 0) { return { minTime: null, maxTime: null }; }
    const timestamps = milestones.allItems.map((i) => new Date(i.createdAt).getTime());
    return { minTime: Math.min(...timestamps), maxTime: Math.max(...timestamps, Date.now()) };
  }, [milestones.allItems]);

  const bankHolidays = useBankHolidays({
    enabled: settings.highlightBankHolidays,
    regions: settings.bankHolidayRegions,
    minTime,
    maxTime,
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

  const handlePreviewNoRepos = useCallback(() => {
    setUserProfile(DEMO_USER);
    setRepos([]);
    setPhase("dashboard");
  }, [setUserProfile, setRepos, setPhase]);

  // Auto-login from stored token, or auto-start demo from URL param.
  // The ref guard ensures this runs exactly once — dependency changes caused
  // by token state updating (e.g. after gh CLI auth) must not re-fire it.
  useEffect(() => {
    if (autoLoginRan.current) { return; }
    autoLoginRan.current = true;
    if (INITIAL_URL_PARAMS.previewNoRepos) {
      handlePreviewNoRepos();
      return;
    }
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
  }, [handleDemo, handlePreviewNoRepos, saveToken, setPhase, setTokenError, transitionToDashboard]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    resetMilestones();
    setSettingsAnchor(null);
  }, [disconnect, resetMilestones]);

  const handleRefreshRepos = useCallback(async () => {
    if (!auth.token) { return; }
    try {
      const repoList = await fetchUserRepos(auth.token);
      setRepos(repoList);
    } catch {
      // leave existing state — the existing tokenError alert will surface the issue
    }
  }, [auth.token, setRepos]);

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

  // ── Document title — derived from state, set synchronously ───────────────

  const { activeRepo, selected } = milestones.state;
  const BASE_TITLE = "GH Insight";
  document.title = !activeRepo
    ? BASE_TITLE
    : selected.length === 0
    ? `${activeRepo.owner}/${activeRepo.name} — ${BASE_TITLE}`
    : `${selected.length === 1 && selected[0] ? selected[0].title : `${selected.length} milestones`} — ${activeRepo.owner}/${activeRepo.name} — ${BASE_TITLE}`;

  // ── View navigation ───────────────────────────────────────────────────────

  const handleViewChange = useCallback((v: View) => {
    milestones.dispatch({ type: "SET_VIEW", view: v });
  }, [milestones]);

  // Keyboard shortcut: 1–8 switches views (dashboard only, not when typing in an input)
  useEffect(() => {
    if (auth.phase !== "dashboard") { return; }
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) { return; }
      if (e.ctrlKey || e.metaKey || e.altKey) { return; }
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < VIEWS.length) { handleViewChange(VIEWS[idx] as View); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [auth.phase, handleViewChange]);

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

      {/* Skip link — visible only on keyboard focus (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* SettingsPopover is shared across splash and dashboard phases */}
      <SettingsPopover
        anchor={settingsAnchor}
        onClose={() => setSettingsAnchor(null)}
        settings={settings}
        updateSetting={updateSetting}
        dark={dark}
        onToggleDark={toggleDark}
        onExportConfig={handleExportConfig}
        fileInputRef={fileInputRef}
        onImportConfig={handleImportConfig}
        splashMode={auth.phase !== "dashboard"}
      />

      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      <UpdateBar />

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
          onSettingsClick={(e) => setSettingsAnchor(e.currentTarget)}
          loading={auth.phase === "authenticating"}
          error={auth.authError}
          colorblindMode={settings.colorblindMode}
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1 }}>

          <AppHeader
            userProfile={auth.userProfile ?? DEMO_USER}
            onSettingsClick={(e) => setSettingsAnchor(e.currentTarget)}
            onSignOut={handleDisconnect}
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

          <Box id="main-content" component="main" sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

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

            <FetchingProgress
              loadingNums={milestones.state.loadingNums}
              loadingEpicNums={milestones.state.loadingEpicNums}
              selected={milestones.state.selected}
              selectedEpics={milestones.state.selectedEpics}
              itemsCache={milestones.state.itemsCache}
              epicItemsCache={milestones.state.epicItemsCache}
              hasItems={milestones.allItems.length > 0}
            />

            {auth.repos.length === 0 && !milestones.state.isDemo && (
              <EmptyState
                icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
                title="No repositories accessible"
                message="Your token doesn't have permission to list repositories. Check your token scopes, or sign out and try a different token."
                actions={
                  <>
                    <Button variant="outlined" size="small" onClick={() => { void handleRefreshRepos(); }}>Refresh</Button>
                    <Button variant="outlined" size="small" color="error" onClick={handleDisconnect}>Sign out</Button>
                  </>
                }
              />
            )}

            {auth.repos.length > 0 && !milestones.state.activeRepo && (
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
      </Box>
      <KeyboardShortcuts />
    </ThemeProvider>
  );
};

export { App };
