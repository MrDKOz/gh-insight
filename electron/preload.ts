import { contextBridge, ipcRenderer } from "electron";

// Expose a narrow, typed bridge to the renderer.  Only the methods listed here
// are accessible from renderer code — no raw Node/IPC surface is exposed.
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron:      true as const,
  getGhToken:      (): Promise<string>  => ipcRenderer.invoke("gh:get-token"),
  checkGhCli:      (): Promise<boolean> => ipcRenderer.invoke("gh:check"),
  checkForUpdates: (token: string): Promise<void> => ipcRenderer.invoke("updater:check", token),
  downloadUpdate:  (): Promise<void>    => ipcRenderer.invoke("updater:download"),
  installUpdate:   (): void             => { void ipcRenderer.invoke("updater:install"); },
  onUpdateStatus:  (cb: (payload: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => cb(payload);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.removeListener("updater:status", listener);
  },
});
