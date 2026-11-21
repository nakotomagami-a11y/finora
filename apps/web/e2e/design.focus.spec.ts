import { expect, test } from "@playwright/test";

const PAGES = ["/en/design/buttons", "/en/design/forms", "/en/design/overlays", "/en/design/data", "/en/terms"];

// WCAG 2.2, 2.4.11 (Focus Not Obscured): a focused control is never left under the sticky top bar or the fixed
// bottom bar. The page keeps `scroll-padding` for both, so a tab stop scrolls clear of them.
for (const width of [390, 1280]) {
  test(`a focused control is never covered by a fixed bar (${width} px)`, async ({ page }) => {
    test.setTimeout(150_000); // every tab stop of five pages, with a short wait after each
    await page.setViewportSize({ width, height: 844 });
    const covered: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      for (let i = 0; i < 60; i += 1) {
        await page.keyboard.press("Tab");
        // The page clears a covered control once the scroll has settled; wait out that settling, as a person's eye would.
        await page.waitForTimeout(100);
        const result = await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null;
          if (!element || element === document.body) return null;
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return null;
          const x = box.left + box.width / 2;
          const points = [box.top + 2, box.top + box.height / 2, box.bottom - 2].map((y) => document.elementFromPoint(x, y));
          const visible = points.map((hit) => hit !== null && element.contains(hit));
          const name = element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 30) || `<${element.tagName.toLowerCase()}>`;
          return { name, height: box.height, covered: visible.filter((ok) => !ok).length, covers: points.map((hit) => hit?.closest("nav, header")?.tagName ?? null) };
        });
        // A control of ordinary size must be fully clear; a tall region (a scrolling table) must show at least part of itself.
        const limit = result && result.height > 100 ? 2 : 0;
        if (result && result.covered > limit && result.covers.some((tag) => tag !== null)) covered.push(`${path}: ${result.name} under ${result.covers.find((t) => t)}`);
      }
    }
    expect(covered).toEqual([]);
  });
}

test("scroll-padding keeps room for the bars", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  const padding = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return { top: Number.parseFloat(css.scrollPaddingTop), bottom: Number.parseFloat(css.scrollPaddingBottom) };
  });
  expect(padding.top).toBeGreaterThanOrEqual(68);
  expect(padding.bottom).toBeGreaterThanOrEqual(64);
  await page.setViewportSize({ width: 1280, height: 800 });
  const desktop = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom));
  expect(Number.isNaN(desktop) || desktop === 0).toBe(true);
});
