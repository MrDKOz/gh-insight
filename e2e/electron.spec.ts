import { _electron as electron, expect, test } from "@playwright/test";
import { join } from "path";

// Resolve path to the compiled Electron main process.
// vite-plugin-electron outputs to dist-electron/main.js.
const MAIN_JS = join(__dirname, "../dist-electron/main.js");

// URL params that skip the splash screen and load demo data immediately.
const DEMO_PARAMS = "?demo=1&milestones=1";

test.describe("Electron app", () => {
  test("window opens and renders the splash screen", async () => {
    const app = await electron.launch({ args: [MAIN_JS] });
    try {
      const win = await app.firstWindow();
      await win.waitForLoadState("domcontentloaded");

      await expect(win).toHaveTitle("GH Insight");
      await expect(win.getByRole("button", { name: /Explore with demo data/i })).toBeVisible();
    } finally {
      await app.close();
    }
  });

  test("demo mode loads all view tabs", async () => {
    const app = await electron.launch({
      args: [MAIN_JS],
      env: { ...process.env, VITE_DEV_SERVER_URL: undefined },
    });
    try {
      const win = await app.firstWindow();
      await win.waitForLoadState("domcontentloaded");

      // Navigate to demo mode via URL hash
      await win.evaluate((params: string) => {
        window.history.replaceState({}, "", params);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, DEMO_PARAMS);

      // Click the demo button as the normal entry point
      const demoBtn = win.getByRole("button", { name: /Explore with demo data/i });
      if (await demoBtn.isVisible()) {
        await demoBtn.click();
      }

      await expect(win.getByRole("tab", { name: "Gantt" })).toBeVisible({ timeout: 10_000 });

      for (const view of ["Gantt", "Burndown", "Cycle Time", "Velocity", "List"]) {
        await expect(win.getByRole("tab", { name: view })).toBeVisible();
      }
    } finally {
      await app.close();
    }
  });

  test("view tabs are navigable", async () => {
    const app = await electron.launch({ args: [MAIN_JS] });
    try {
      const win = await app.firstWindow();
      await win.waitForLoadState("domcontentloaded");

      const demoBtn = win.getByRole("button", { name: /Explore with demo data/i });
      await demoBtn.click();

      await expect(win.getByRole("tab", { name: "Gantt" })).toBeVisible({ timeout: 10_000 });

      await win.getByRole("tab", { name: "Burndown" }).click();
      await expect(win.getByRole("tab", { name: "Burndown" })).toHaveAttribute("aria-selected", "true");
      await expect(win.locator("svg").first()).toBeVisible();
    } finally {
      await app.close();
    }
  });
});
