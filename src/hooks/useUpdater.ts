import { useCallback, useEffect, useRef, useState } from "react";

type UseUpdaterReturn = {
  updateStatus: UpdateStatus | null;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
};

/**
 * Manages the auto-update lifecycle for the Electron app.
 * Passes the user's GitHub token to the main process so it can access
 * release assets on private repositories.
 *
 * No-ops silently when running in a browser (no electronAPI).
 */
const useUpdater = (token: string): UseUpdaterReturn => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const hasChecked = useRef(false);

  // Subscribe to status push events from the main process
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) { return; }
    return api.onUpdateStatus(setUpdateStatus);
  }, []);

  // Auto-check once when a token becomes available
  useEffect(() => {
    const api = window.electronAPI;
    if (!api || !token || hasChecked.current) { return; }
    hasChecked.current = true;
    void api.checkForUpdates(token);
  }, [token]);

  const checkForUpdates = useCallback(() => {
    const api = window.electronAPI;
    if (!api || !token) { return; }
    void api.checkForUpdates(token);
  }, [token]);

  const downloadUpdate = useCallback(() => {
    const api = window.electronAPI;
    if (!api) { return; }
    void api.downloadUpdate();
  }, []);

  const installUpdate = useCallback(() => {
    window.electronAPI?.installUpdate();
  }, []);

  return { updateStatus, checkForUpdates, downloadUpdate, installUpdate };
};

export { useUpdater };
