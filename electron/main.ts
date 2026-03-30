import { app, BrowserWindow, ipcMain, session } from "electron";
import { autoUpdater } from "electron-updater";
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

// Deduplicates concurrent IPC calls — if gh:check fires at the same time as
// gh:get-token (e.g. because SplashScreen re-mounted), they share one subprocess
// invocation instead of racing over the credential store.
let inflight: Promise<string> | null = null;

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function tryGhCandidates(): Promise<string | null> {
  let lastErr: unknown;
  for (const candidate of GH_CANDIDATES) {
    try {
      const { stdout, stderr } = await execFileAsync(candidate, ["auth", "token"], { timeout: 10_000 });
      const token = stdout.trim();
      if (token) { return token; }
      // Succeeded but empty stdout — gh may have written an error to stderr
      if (stderr.trim()) { console.warn("[gh-token] empty stdout, stderr:", stderr.trim()); }
    } catch (err) {
      lastErr = err;
      console.warn(`[gh-token] candidate "${candidate}" failed:`, err);
    }
  }
  if (lastErr) { console.error("[gh-token] all candidates failed, last error:", lastErr); }
  return null;
}

async function doGetGhToken(): Promise<string> {
  // First attempt
  const token = await tryGhCandidates();
  if (token) { return token; }

  // On Linux the credential store (gnome-keyring, pass, …) may need a moment
  // to unlock on first access — retry once after a short pause.
  console.warn("[gh-token] first attempt returned no token, retrying in 600 ms…");
  await delay(600);
  const retry = await tryGhCandidates();
  if (retry) { return retry; }

  throw new Error(
    "GitHub CLI (gh) not found or not authenticated. " +
    "Install gh from https://cli.github.com and run `gh auth login`.",
  );
}

async function getGhToken(): Promise<string> {
  if (!inflight) {
    inflight = doGetGhToken().finally(() => { inflight = null; });
  }
  return inflight;
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
              "https://objects.githubusercontent.com " +
              "https://github-releases.githubusercontent.com " +
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

// ---------------------------------------------------------------------------
// Auto-updater — manual trigger only; uses the user's existing GitHub token
// so the app works with private repositories without bundling credentials.
// ---------------------------------------------------------------------------

autoUpdater.autoDownload    = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.logger          = null; // silence internal logs in production

type UpdateStatus =
  | { status: "available";    version: string }
  | { status: "up-to-date" }
  | { status: "downloading";  percent: number }
  | { status: "ready";        version: string }
  | { status: "error";        message: string };

function sendUpdateStatus(payload: UpdateStatus): void {
  BrowserWindow.getAllWindows()[0]?.webContents.send("updater:status", payload);
}

autoUpdater.on("update-available",     (info)     => sendUpdateStatus({ status: "available",   version: info.version }));
autoUpdater.on("update-not-available", ()         => sendUpdateStatus({ status: "up-to-date" }));
autoUpdater.on("update-downloaded",    (info)     => sendUpdateStatus({ status: "ready",       version: info.version }));
autoUpdater.on("download-progress",    (progress) => sendUpdateStatus({ status: "downloading", percent: Math.round(progress.percent) }));
autoUpdater.on("error",                (err)      => sendUpdateStatus({ status: "error",       message: err.message }));

ipcMain.handle("updater:check", async (_event, token: string): Promise<void> => {
  autoUpdater.requestHeaders = { Authorization: `Bearer ${token}` };
  await autoUpdater.checkForUpdates();
});

ipcMain.handle("updater:download", async (): Promise<void> => {
  await autoUpdater.downloadUpdate();
});

ipcMain.handle("updater:install", (): void => {
  autoUpdater.quitAndInstall();
});

// ---------------------------------------------------------------------------

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
