import type { AppPhase } from "../types/AppTypes";
import type { Repo, UserProfile } from "../types/GitHubTypes";
import { useCallback, useState } from "react";
import { fetchUserProfile, fetchUserRepos } from "../api/github";
import { EncryptionUnavailableError, deleteKey, encryptToken } from "../utils/tokenCrypto";

const LS_TOKEN = "gmt_token";

type UseAuthReturn = {
  phase: AppPhase;
  setPhase: (phase: AppPhase) => void;
  token: string;
  setToken: (token: string) => void;
  tokenError: string | null;
  clearTokenError: () => void;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  userProfile: UserProfile | null;
  setUserProfile: (p: UserProfile | null) => void;
  repos: Repo[];
  setRepos: (repos: Repo[]) => void;
  saveToken: (raw: string) => void;
  handleConnect: (inputToken: string) => Promise<void>;
  connectWithGhCli: () => Promise<void>;
  checkGhCli: () => Promise<boolean>;
  disconnect: () => void;
};

const useAuth = (initialPhase: AppPhase): UseAuthReturn => {
  const [phase, setPhase]           = useState<AppPhase>(initialPhase);
  const [token, setToken]           = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [authError, setAuthError]   = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [repos, setRepos]           = useState<Repo[]>([]);

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

  const handleConnect = useCallback(async (inputToken: string) => {
    setAuthError(null);
    setPhase("authenticating");
    try {
      const [profile, repoList] = await Promise.all([
        fetchUserProfile(inputToken),
        fetchUserRepos(inputToken),
      ]);
      saveToken(inputToken);
      setToken(inputToken);
      setUserProfile(profile);
      setRepos(repoList);
      setPhase("dashboard");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
      setPhase("splash");
    }
  }, [saveToken]);

  // Stable ref — used by SplashScreen's useEffect so it doesn't re-fire on
  // every render and race with a concurrent sign-in attempt.
  const checkGhCli = useCallback(
    (): Promise<boolean> => window.electronAPI?.checkGhCli() ?? Promise.resolve(false),
    [],
  );

  // Authenticate using the token managed by the locally-installed gh CLI.
  // The token is held in React state only — gh handles its own persistence so
  // we do not store it in localStorage or IndexedDB.
  const connectWithGhCli = useCallback(async () => {
    if (!window.electronAPI) { return; }
    setAuthError(null);
    setPhase("authenticating");
    try {
      const cliToken = await window.electronAPI.getGhToken();
      const [profile, repoList] = await Promise.all([
        fetchUserProfile(cliToken),
        fetchUserRepos(cliToken),
      ]);
      setToken(cliToken);
      setUserProfile(profile);
      setRepos(repoList);
      setPhase("dashboard");
    } catch (e) {
      console.error("[connectWithGhCli] auth failed:", e);
      setAuthError(e instanceof Error ? e.message : String(e));
      setPhase("splash");
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(LS_TOKEN);
    void deleteKey();
    setToken("");
    setUserProfile(null);
    setRepos([]);
    setPhase("splash");
  }, []);

  return {
    phase, setPhase,
    token, setToken,
    tokenError, clearTokenError: () => setTokenError(null),
    authError, setAuthError,
    userProfile, setUserProfile,
    repos, setRepos,
    saveToken,
    handleConnect,
    connectWithGhCli,
    checkGhCli,
    disconnect,
  };
};

export { LS_TOKEN, useAuth };
