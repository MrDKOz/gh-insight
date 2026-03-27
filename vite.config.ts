import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

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

export default defineConfig({
  plugins: [
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
    stripDevCspPlugin,
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.tests.{ts,tsx}"],
  },
})
