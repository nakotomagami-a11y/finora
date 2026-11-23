import { expect, test } from "@playwright/test";
import { pinClock } from "./support/crash.ts";

// Linux only, like the gallery baselines (CI job `visual`). Every figure comes from the fictional crash fixtures.
test.skip(process.platform !== "linux", "visual baselines are Linux-only");
test.use({ reducedMotion: "reduce", timezoneId: "UTC" });

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1920", width: 1920, height: 1080 },
];
const STATES = ["live", "stale", "error", "not-configured", "peak-unknown", "mixed", "loading"];

for (const viewport of VIEWPORTS) {
  for (const state of STATES) {
    for (const theme of state === "live" || state === "mixed" ? (["dark", "light"] as const) : (["dark"] as const)) {
      test(`@visual crash ${state} at ${viewport.name} px, ${theme}`, async ({ page }) => {
        await pinClock(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto(`/en/crash?state=${state}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.waitForLoadState("networkidle");
        // The window as tall as the page, so the fixed rail and bottom bar sit where a person sees them.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width: viewport.width, height });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        // A tight tolerance (0.03%): a changed line of text on a tall page must change the baseline, so no baseline is left showing an older screen.
        // The debt estimate ticks once a second from the real time: its digits are masked, its place and size are not.
        await expect(page).toHaveScreenshot(`crash-${state}-${viewport.name}-${theme}.png`, { animations: "disabled", maxDiffPixelRatio: 0.0003, mask: [page.locator("[data-ticker]")] });
      });
    }
  }
}
