import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";
import { resolve } from "path";
import packageJson from "./package.json";

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
      .replace(/\s*ws:\/\/localhost:[^;]*;?/g, ";");
  },
};

// Writes dist/version.json at the end of each production build so the running
// app can poll it to detect when a new deployment has been pushed.
const writeVersionJsonPlugin: Plugin = {
  name: "write-version-json",
  closeBundle() {
    writeFileSync(
      resolve(__dirname, "dist/version.json"),
      JSON.stringify({ buildTime: Date.now() }),
    );
  },
};

const BUILD_TIME = Date.now();

export default defineConfig({
  // GitHub Actions sets GITHUB_ACTIONS=true automatically; use it to set the
  // correct sub-path for Pages without affecting the local dev server.
  base: process.env["GITHUB_ACTIONS"] ? "/GitHubWorkVisualiser/" : "/",
  define: {
    __APP_VERSION__:    JSON.stringify(packageJson.version),
    __APP_BUILD_TIME__: String(BUILD_TIME),
  },
  plugins: [
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
    stripDevCspPlugin,
    writeVersionJsonPlugin,
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
})
