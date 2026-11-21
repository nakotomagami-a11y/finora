import { expect, test, type Page } from "@playwright/test";

// Screenshots depend on the operating system's font rendering, so baselines are made and compared on Linux only,
// in the pinned Playwright image (CI job `visual`). Every baseline is generated from the fictional gallery data.
test.skip(process.platform !== "linux", "visual baselines are Linux-only");
test.use({ reducedMotion: "reduce" });

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1920", width: 1920, height: 1080 },
];

const PAGES = [
  { name: "shell", path: "/en" },
  { name: "buttons", path: "/en/design/buttons" },
  { name: "forms", path: "/en/design/forms" },
  { name: "overlays", path: "/en/design/overlays" },
  { name: "data", path: "/en/design/data" },
  { name: "typography", path: "/en/design/typography" },
];

const THEMES = ["dark", "light"] as const;

// Four widths, both themes, every page: 48 baselines.
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    for (const { name, path } of PAGES) {
      test(`@visual ${name} at ${viewport.name} px, ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(`${path}${path.includes("design") ? `?theme=${theme}` : ""}`);
        await page.waitForLoadState("networkidle");
        // A full-page capture would draw the fixed rail and bottom bar over the middle of the page. A window as tall
        // as the page shows the bars where a person sees them: the rail along the whole height, the bar at the foot.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width: viewport.width, height });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await expect(page).toHaveScreenshot(`${name}-${viewport.name}-${theme}.png`, { animations: "disabled", maxDiffPixelRatio: 0.002 });
      });
    }
  }
}

// The open states of the overlays, which a closed page never shows: a later slice that breaks one fails here.
// The window is the screen of a phone or a laptop, not the page, because an overlay belongs to the screen.
const OVERLAYS = [
  { name: "dialog", path: "/en/design/overlays?open=dialog" },
  { name: "sheet", path: "/en/design/overlays?open=sheet" },
  { name: "menu", path: "/en/design/overlays", open: async (page: Page) => page.getByRole("button", { name: "Finding actions" }).click() },
  { name: "popover", path: "/en/design/overlays", open: async (page: Page) => page.getByRole("button", { name: /Register LV/u }).first().click() },
  { name: "combobox", path: "/en/design/forms", open: async (page: Page) => page.getByRole("combobox", { name: "Search companies" }).focus() },
];

for (const theme of THEMES) {
  for (const viewport of [VIEWPORTS[0]!, VIEWPORTS[2]!]) {
    for (const overlay of OVERLAYS) {
      test(`@visual open ${overlay.name} at ${viewport.name} px, ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        const separator = overlay.path.includes("?") ? "&" : "?";
        await page.goto(`${overlay.path}${separator}theme=${theme}`);
        await page.waitForLoadState("networkidle");
        await overlay.open?.(page);
        await page.waitForTimeout(400); // the overlay, its focus and its scroll have settled
        await expect(page).toHaveScreenshot(`open-${overlay.name}-${viewport.name}-${theme}.png`, { animations: "disabled", maxDiffPixelRatio: 0.002 });
      });
    }
  }
}
