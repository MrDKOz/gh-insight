/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: number;

type UpdateStatus =
  | { status: "available";   version: string }
  | { status: "up-to-date" }
  | { status: "downloading"; percent: number }
  | { status: "ready";       version: string }
  | { status: "error";       message: string };

/** Injected by electron/preload.ts via contextBridge when running in Electron. */
interface ElectronAPI {
  readonly isElectron:  true;
  getGhToken:           () => Promise<string>;
  checkGhCli:           () => Promise<boolean>;
  checkForUpdates:      (token: string) => Promise<void>;
  downloadUpdate:       () => Promise<void>;
  installUpdate:        () => void;
  onUpdateStatus:       (cb: (payload: UpdateStatus) => void) => (() => void);
}

interface Window {
  electronAPI?: ElectronAPI;
}
