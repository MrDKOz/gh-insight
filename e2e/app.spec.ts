import { test, expect } from "@playwright/test";

// URL that starts demo mode with milestone 1 pre-selected so all views are
// immediately available without requiring a milestone picker click.
const DEMO_URL = "/?demo=1&milestones=1";

test("page has correct title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("GH Insight");
});

test("demo button replaces splash screen with the app", async ({ page }) => {
  await page.goto("/");
  // Splash screen is visible initially
  await expect(page.getByRole("button", { name: /Explore with demo data/i })).toBeVisible();

  await page.getByRole("button", { name: /Explore with demo data/i }).click();

  // Splash screen is gone
  await expect(page.getByRole("button", { name: /Explore with demo data/i })).not.toBeVisible();
});

test.describe("demo mode with data loaded", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_URL);
    // Wait for the view tabs to confirm milestone data is loaded
    await expect(page.getByRole("tab", { name: "Gantt" })).toBeVisible();
  });

  test("all view tabs are visible", async ({ page }) => {
    for (const view of ["Gantt", "Burndown", "Cycle Time", "Velocity", "Cumulative Flow", "Contributors", "Review Wait", "List"]) {
      await expect(page.getByRole("tab", { name: view })).toBeVisible();
    }
  });

  test("switching views changes the active tab", async ({ page }) => {
    await page.getByRole("tab", { name: "Burndown" }).click();
    await expect(page.getByRole("tab", { name: "Burndown" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Gantt" })).toHaveAttribute("aria-selected", "false");
  });

  test("share button shows Copied! after click", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-write", "clipboard-read"]);
    await page.getByRole("button", { name: "Copy share code to clipboard" }).click();
    await expect(page.getByText("Copied!")).toBeVisible();
  });

  test("about button opens the help dialog from the app header", async ({ page }) => {
    await page.getByRole("button", { name: "About this app" }).click();
    await expect(page.getByText("How it works")).toBeVisible();
    await expect(page.getByText("Everything stays local")).toBeVisible();
  });

  test("filter reset button resets active filters", async ({ page }) => {
    // Activate a filter by clicking a type chip — reset button should then appear
    const chip = page.getByText("Closed issues").first();
    await chip.click();

    const resetBtn = page.getByRole("button", { name: "Reset all filters" });
    await expect(resetBtn).toBeVisible();

    await resetBtn.click();
    await expect(resetBtn).not.toBeVisible();
  });

  test("List view renders a table with data rows", async ({ page }) => {
    await page.getByRole("tab", { name: "List" }).click();

    // The table should have at least one body row
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("export menu in List view shows data format options", async ({ page }) => {
    await page.getByRole("tab", { name: "List" }).click();

    await page.getByRole("button", { name: /Export/i }).click();

    await expect(page.getByRole("menuitem", { name: "CSV" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Markdown" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "XLSX" })).toBeVisible();
  });

  test("Burndown view renders a chart", async ({ page }) => {
    await page.getByRole("tab", { name: "Burndown" }).click();

    // The burndown chart renders an SVG
    await expect(page.locator("svg").first()).toBeVisible();
  });
});
