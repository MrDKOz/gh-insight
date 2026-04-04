import { defineConfig } from "@playwright/test";

// Electron e2e tests launch the built Electron app directly — no web server needed.
// The app must already be built with ELECTRON=true before running these tests.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "electron.spec.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // Electron tests share OS resources — run serially
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  // No projects/use block — _electron.launch() handles the browser context.
});
