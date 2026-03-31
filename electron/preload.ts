import { contextBridge, ipcRenderer } from "electron";

// Expose a narrow, typed bridge to the renderer.  Only the methods listed here
// are accessible from renderer code — no raw Node/IPC surface is exposed.
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron:      true as const,
  getGhToken:      (): Promise<string>  => ipcRenderer.invoke("gh:get-token"),
  checkGhCli:      (): Promise<boolean> => ipcRenderer.invoke("gh:check"),
});
