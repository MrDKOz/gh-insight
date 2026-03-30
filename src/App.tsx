import type { AppPhase, View } from "./types/AppTypes";
import type { Repo, UserProfile } from "./types/GitHubTypes";
import type { FunctionComponent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUserProfile, fetchUserRepos } from "./api/github";
import { AppHeader } from "./components/AppHeader";
import { ContextBar } from "./components/ContextBar";
import { EmptyState } from "./components/EmptyState";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { MilestoneView, readViewFiltersFromUrl } from "./components/MilestoneView";
import { SettingsPopover } from "./components/SettingsPopover";
import { SplashScreen } from "./components/SplashScreen";
import { DEMO_REPOS, DEMO_USER } from "./data/demo";
import { LS_TOKEN, useAuth } from "./hooks/useAuth";
import { useBankHolidays } from "./hooks/useBankHolidays";
import { useDarkMode } from "./hooks/useDarkMode";
import { useMilestones } from "./hooks/useMilestones";
import { useNewVersionAvailable } from "./hooks/useNewVersionAvailable";
import { useSettings } from "./hooks/useSettings";
import { muiDarkTheme, muiLightTheme } from "./theme";
import { decryptToken } from "./utils/tokenCrypto";
import { readUrlParams, setViewParam, syncUrlParams } from "./utils/urlUtils";

// Evaluated once at module load — stable across the lifetime of the page
const INITIAL_URL_PARAMS = readUrlParams();

const App: FunctionComponent = () => {
  const { dark, toggleDark, applyDark } = useDarkMode();
  const { settings, updateSetting }     = useSettings();
  const newVersionAvailable             = useNewVersionAvailable();

  const initialPhase: AppPhase = localStorage.getItem(LS_TOKEN) || INITIAL_URL_PARAMS.demo
    ? "authenticating"
    : "splash";

  const auth = useAuth(initialPhase);

  const [activeRepo, setActiveRepo] = useState<Repo | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [configError, setConfigError]       = useState<string | null>(null);
  const [view, setView]                     = useState<View>(() => readViewFiltersFromUrl().view);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const milestones = useMilestones({
    activeRepo,
    token: auth.token,
    initialMilestoneNums: INITIAL_URL_PARAMS.milestoneNums,
  });

  const bankHolidays = useBankHolidays({
    enabled: settings.highlightBankHolidays,
    regions: settings.bankHolidayRegions,
    allItems: milestones.allItems,
  });

  // ── Auth orchestration ────────────────────────────────────────────────────

  // Auto-login from stored token, or auto-start demo from URL param
  useEffect(() => {
    if (INITIAL_URL_PARAMS.demo) {
      handleDemo();
      return;
    }
    const stored = localStorage.getItem(LS_TOKEN);
    if (!stored) { auth.setPhase("splash"); return; }
    decryptToken(stored)
      .then(async (decrypted) => {
        const [profile, repoList] = await Promise.all([
          fetchUserProfile(decrypted),
          fetchUserRepos(decrypted),
        ]);
        auth.saveToken(decrypted);
        transitionToDashboard(decrypted, profile, repoList);
      })
      .catch((err: unknown) => {
        console.error("Failed to decrypt stored token; session cleared.", err);
        localStorage.removeItem(LS_TOKEN);
        auth.setPhase("splash");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: runs once on mount
  }, []);

  const transitionToDashboard = useCallback((
    rawToken: string, profile: UserProfile, repoList: Repo[],
  ) => {
    auth.setToken(rawToken);
    auth.setUserProfile(profile);
    auth.setRepos(repoList);
    const { owner, repo } = INITIAL_URL_PARAMS;
    const autoRepo = owner && repo
      ? (repoList.find((r) =>
          r.owner.toLowerCase() === owner.toLowerCase() &&
          r.name.toLowerCase()  === repo.toLowerCase()
        ) ?? null)
      : null;
    setActiveRepo(autoRepo);
    auth.setPhase("dashboard");
  }, [auth]);

  const { setUserProfile, setRepos, setPhase, disconnect } = auth;
  const { loadDemoForRepo, resetMilestones } = milestones;

  const handleDemo = useCallback(() => {
    const firstRepo = DEMO_REPOS[0] ?? null;
    setUserProfile(DEMO_USER);
    setRepos(DEMO_REPOS);
    setPhase("dashboard");
    setActiveRepo(firstRepo);
    if (firstRepo) { loadDemoForRepo(firstRepo, INITIAL_URL_PARAMS.milestoneNums); }
  }, [setUserProfile, setRepos, setPhase, loadDemoForRepo]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    resetMilestones();
    setActiveRepo(null);
    setSettingsAnchor(null);
  }, [disconnect, resetMilestones]);

  // ── Repo / milestone orchestration ───────────────────────────────────────

  const handleRepoSelect = useCallback((repo: Repo | null) => {
    setActiveRepo(repo);
    milestones.resetMilestones();
    if (!repo) { return; }
    if (milestones.state.isDemo) {
      milestones.loadDemoForRepo(repo, []);
    } else {
      void milestones.loadMilestonesForRepo(repo);
    }
  }, [milestones]);

  // ── URL synchronisation ───────────────────────────────────────────────────

  useEffect(() => {
    syncUrlParams(activeRepo, milestones.state.selected.map((m) => m.number), milestones.state.isDemo);
  }, [activeRepo, milestones.state.selected, milestones.state.isDemo]);

  useEffect(() => {
    document.body.classList.toggle("colorblind", settings.colorblindMode);
  }, [settings.colorblindMode]);

  // ── View navigation ───────────────────────────────────────────────────────

  const handleViewChange = useCallback((v: View) => {
    setView(v);
    setViewParam(v);
  }, []);

  // ── Config import / export ────────────────────────────────────────────────

  const handleExportConfig = useCallback(() => {
    const config = { version: 1, owner: activeRepo?.owner ?? "", repo: activeRepo?.name ?? "", dark, settings };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url; a.download = "github-work-visualiser-config.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [activeRepo, dark, settings]);

  const handleImportConfig = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        if (typeof ev.target?.result !== "string") { throw new Error("File could not be read as text"); }
        const raw: unknown = JSON.parse(ev.target.result);
        if (typeof raw !== "object" || raw === null) { throw new Error("Not a valid config object"); }
        const c = raw as Record<string, unknown>;
        if (typeof c.version !== "number" || c.version !== 1) { throw new Error("Unsupported config version"); }
        if (typeof c.dark === "boolean") { applyDark(c.dark); }
        if (typeof c.token === "string" && c.token) {
          auth.setToken(c.token);
          auth.saveToken(c.token);
        }
        if (typeof c.settings === "object" && c.settings !== null) {
          const s = c.settings as Record<string, unknown>;
          if (typeof s.highlightWeekends     === "boolean") { updateSetting("highlightWeekends",     s.highlightWeekends); }
          if (typeof s.colorblindMode        === "boolean") { updateSetting("colorblindMode",        s.colorblindMode); }
          if (typeof s.highlightBankHolidays === "boolean") { updateSetting("highlightBankHolidays", s.highlightBankHolidays); }
          if (Array.isArray(s.bankHolidayRegions)) {
            const isRegion = (v: unknown): v is "england-and-wales" | "scotland" | "northern-ireland" | "US" =>
              ["england-and-wales", "scotland", "northern-ireland", "US"].includes(v as string);
            updateSetting("bankHolidayRegions", (s.bankHolidayRegions as unknown[]).filter(isRegion));
          }
        }
        setSettingsAnchor(null);
      } catch (err) {
        setConfigError(`Config import failed: ${err instanceof Error ? err.message : "invalid file"}`);
      }
    };
    reader.readAsText(file);
  }, [applyDark, auth, updateSetting]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ThemeProvider theme={dark ? muiDarkTheme : muiLightTheme}>
      <CssBaseline />

      {auth.phase !== "dashboard" ? (
        <SplashScreen
          onConnect={auth.handleConnect}
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
            activeRepo={activeRepo}
            onRepoChange={handleRepoSelect}
            isDemo={milestones.state.isDemo}
            milestones={milestones.state.milestones}
            selected={milestones.state.selected}
            loadingList={milestones.state.loadingList}
            loadingNums={milestones.state.loadingNums}
            colorFor={milestones.milestoneColorFor}
            onAdd={milestones.addMilestone}
            onRemove={milestones.removeMilestone}
            onRefresh={milestones.refreshMilestones}
            view={view}
            onViewChange={handleViewChange}
            hasItems={milestones.allItems.length > 0}
          />

          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {(auth.tokenError || configError || milestones.state.error || milestones.state.emptyMilestoneNums.length > 0 || milestones.state.loadingNums.length > 0) && (
              <Box sx={{ px: 3, pt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {auth.tokenError && (
                  <Alert severity="warning" onClose={auth.clearTokenError}>{auth.tokenError}</Alert>
                )}
                {configError && (
                  <Alert severity="error" onClose={() => setConfigError(null)}>{configError}</Alert>
                )}
                {milestones.state.error && <Alert severity="error">{milestones.state.error}</Alert>}
                {milestones.state.emptyMilestoneNums.length > 0 && (
                  <Alert severity="warning">
                    {milestones.state.emptyMilestoneNums.length === 1
                      ? `Milestone #${milestones.state.emptyMilestoneNums[0] ?? "?"} has no items.`
                      : `${milestones.state.emptyMilestoneNums.length} milestones have no items.`}
                  </Alert>
                )}
                {milestones.state.loadingNums.length > 0 && (
                  <Alert severity="info" role="status" aria-live="polite">Loading milestone data…</Alert>
                )}
              </Box>
            )}

            {!activeRepo && (
              <EmptyState
                icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h2.5l2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>}
                title="Select a repository"
                message="Choose a repository from the dropdown above to load its milestones"
              />
            )}

            {activeRepo && milestones.state.milestones.length === 0 && !milestones.state.loadingList && !milestones.state.error && (
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
                  view={view}
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
