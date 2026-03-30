/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_BUILD_TIME__: number;

/** Injected by electron/preload.ts via contextBridge when running in Electron. */
interface ElectronAPI {
  readonly isElectron: true;
  getGhToken: () => Promise<string>;
  checkGhCli: () => Promise<boolean>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
