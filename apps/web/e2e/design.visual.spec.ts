import { expect, test } from "@playwright/test";

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

for (const viewport of VIEWPORTS) {
  for (const { name, path } of PAGES) {
    test(`@visual ${name} at ${viewport.name} px, dark`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${path}${path.includes("design") ? "?theme=dark" : ""}`);
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${name}-${viewport.name}-dark.png`, { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.002 });
    });
  }
}

for (const name of ["buttons", "data"]) {
  test(`@visual ${name} at 1280 px, light`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/en/design/${name}?theme=light`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`${name}-1280-light.png`, { fullPage: true, animations: "disabled", maxDiffPixelRatio: 0.002 });
  });
}
