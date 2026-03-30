/** Returns true when the app is running inside an Electron renderer process. */
export const isElectron = (): boolean =>
  typeof window !== "undefined" && !!window.electronAPI?.isElectron;
