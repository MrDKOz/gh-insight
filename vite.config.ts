import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";
import { resolve } from "path";
import packageJson from "./package.json";

const isElectronBuild = !!process.env["ELECTRON"];

// Strips dev-only CSP directives from the built HTML so the production bundle
// ships without 'unsafe-eval' (needed only by Vite HMR) or the local WS
// connect-src (needed only by Vite dev server).
const stripDevCspPlugin: Plugin = {
  name: "strip-dev-csp",
  transformIndexHtml(html, ctx) {
    if (ctx.server) { return html; } // dev — leave untouched
    return html
      .replace(/'unsafe-eval'\s*/g, "")
      // Remove 'unsafe-inline' from script-src only — style-src keeps it for Emotion
      .replace(/(script-src\s[^;]*?)'unsafe-inline'\s*/g, "$1")
      .replace(/\s*ws:\/\/localhost:[^;]*;?/g, ";")
      // Prevent Cloudflare Rocket Loader from deferring the app's module script.
      // Rocket Loader changes type="module" to a non-standard type and relies on
      // an inline script (blocked by our script-src 'self') to re-execute it,
      // which breaks the app. data-cfasync="false" tells Rocket Loader to skip it.
      .replace(/(<script\s[^>]*type="module"[^>]*)>/g, '$1 data-cfasync="false">');
  },
};

// Writes dist/version.json at the end of each production build so the running
// app can poll it to detect when a new deployment has been pushed.
const BUILD_TIME = Date.now();

const writeVersionJsonPlugin: Plugin = {
  name: "write-version-json",
  closeBundle() {
    writeFileSync(
      resolve(__dirname, "dist/version.json"),
      JSON.stringify({ buildTime: BUILD_TIME }),
    );
  },
};

export default defineConfig(async () => {
  // Dynamically import the Electron plugin only when ELECTRON=true so that
  // the web build has no dependency on it and `npm run build` never fails if
  // vite-plugin-electron is somehow absent.
  const electronPlugins: Plugin[] = [];
  if (isElectronBuild) {
    const { default: electron } = await import("vite-plugin-electron/simple");
    electronPlugins.push(electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              // electron-updater is a CJS package that calls require() for Node
              // built-ins at runtime — it must not be bundled into the ESM output.
              external: ["electron-updater"],
            },
          },
        },
      },
      // Compile the preload as CJS (.cjs).  ESM preloads hit a Node module
      // resolution issue where `import "electron"` resolves to the npm launcher
      // package instead of Electron's runtime built-ins.  CJS avoids this
      // because Electron intercepts require("electron") itself.
      preload: {
        input: "electron/preload.ts",
        vite: {
          build: {
            rollupOptions: {
              output: { format: "cjs", entryFileNames: "[name].cjs" },
            },
          },
        },
      },
    }));
  }

  return {
  // Electron needs a relative base so it can load files from the filesystem.
  // GitHub Actions gets a sub-path for Pages; everything else uses root.
  base: isElectronBuild ? "./" : (process.env["DEPLOY_BASE"] ?? (process.env["GITHUB_ACTIONS"] ? "/gh-insight/" : "/")),
  define: {
    __APP_VERSION__:    JSON.stringify(packageJson.version),
    __APP_BUILD_TIME__: String(BUILD_TIME),
  },
  plugins: [
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
    ...(!isElectronBuild ? [stripDevCspPlugin] : []),
    ...(!isElectronBuild ? [writeVersionJsonPlugin] : []),
    ...electronPlugins,
  ],
  resolve: {
    alias: {
      // jsPDF's .html() plugin dynamically imports html2canvas; we never call
      // jsPDF.html(), so stub it out to eliminate the ≈200 KB dead chunk.
      html2canvas: fileURLToPath(new URL("src/utils/html2canvas-stub.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.tests.{ts,tsx}"],
  },
  };
});
