import { app, BrowserWindow, ipcMain, session } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Common install locations for the gh CLI.  We try them in order so that the
// app works even when Electron is launched outside of a shell (e.g. from the
// macOS Finder) and does not inherit the user's PATH.
const GH_CANDIDATES = [
  "gh",                       // on PATH — works in terminal launches
  "/usr/local/bin/gh",        // Homebrew Intel / Linux manual install
  "/opt/homebrew/bin/gh",     // Homebrew Apple Silicon
  "/usr/bin/gh",              // system package manager (apt, dnf, …)
  "C:\\Program Files\\GitHub CLI\\gh.exe", // Windows installer default
];

async function getGhToken(): Promise<string> {
  let lastErr: unknown;
  for (const candidate of GH_CANDIDATES) {
    try {
      const { stdout } = await execFileAsync(candidate, ["auth", "token"]);
      const token = stdout.trim();
      if (token) { return token; }
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    "GitHub CLI (gh) not found or not authenticated. " +
    "Install gh from https://cli.github.com and run `gh auth login`.",
    { cause: lastErr },
  );
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: true is intentionally omitted — it conflicts with ESM preloads
      // in some Electron versions.  contextIsolation: true already provides the
      // equivalent security boundary via contextBridge.
    },
  });

  // In dev mode vite-plugin-electron sets VITE_DEV_SERVER_URL; in production
  // we load the built renderer from the filesystem.
  const devUrl = process.env["VITE_DEV_SERVER_URL"];

  // Apply strict CSP via session response headers in production only.
  // In dev, Vite HMR requires 'unsafe-inline' scripts and WebSocket connections
  // that would be blocked by the production policy — the Vite dev server handles
  // its own headers instead.
  if (!devUrl) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' https://github.com https://avatars.githubusercontent.com data:; " +
            "connect-src https://api.github.com https://github.com " +
              "https://avatars.githubusercontent.com " +
              "https://www.gov.uk https://date.nager.at; " +
            "worker-src blob:; " +
            "object-src 'none'; " +
            "base-uri 'self';",
          ],
        },
      });
    });
  }
  if (devUrl) {
    void win.loadURL(devUrl);
    win.webContents.openDevTools();
  } else {
    void win.loadFile(join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("gh:get-token", async (): Promise<string> => {
  return getGhToken();
});

// Returns true if gh is installed and the user is authenticated (i.e. a token
// can be obtained).  Used by the splash screen to show the status indicator.
ipcMain.handle("gh:check", async (): Promise<boolean> => {
  try {
    await getGhToken();
    return true;
  } catch {
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) { createWindow(); }
  });
}).catch(console.error);

app.on("window-all-closed", () => {
  // On macOS apps conventionally stay open until the user quits explicitly.
  if (process.platform !== "darwin") { app.quit(); }
});
