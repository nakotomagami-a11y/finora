import { expect, test } from "@playwright/test";

const PAGES = ["/en/design/buttons", "/en/design/forms", "/en/design/overlays", "/en/design/data", "/en/terms"];

// WCAG 2.2, 2.4.11 (Focus Not Obscured): a focused control is never left under the sticky top bar or the fixed
// bottom bar. The page keeps `scroll-padding` for both, and `FocusClear` scrolls a covered control clear once the
// page has stopped moving. So the test looks at a stop after the scroll has been still for a while.
const MAX_STOPS = 150;

type Stop = { key: string; name: string; height: number; covered: number; covers: (string | null)[] };

/** Resolves when the page has not scrolled for `frames` frames in a row (or after a long wait). */
const settled = (frames: number) =>
  new Promise<void>((resolve) => {
    let last = Number.NaN;
    let still = 0;
    let waited = 0;
    const tick = () => {
      waited += 1;
      still = window.scrollY === last ? still + 1 : 0;
      last = window.scrollY;
      if (still >= frames || waited > 240) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

for (const width of [390, 1280]) {
  test(`a focused control is never covered by a fixed bar (${width} px)`, async ({ page }) => {
    test.setTimeout(180_000); // every tab stop of five pages
    await page.setViewportSize({ width, height: 844 });
    const covered: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const seen = new Set<string>();
      let wrapped = false;
      for (let i = 0; i < MAX_STOPS && !wrapped; i += 1) {
        await page.keyboard.press("Tab");
        // More frames than FocusClear waits for, so its scroll (if any) has happened.
        await page.evaluate(settled, 8);
        const result: Stop | null = await page.evaluate((): Stop | null => {
          const element = document.activeElement as HTMLElement | null;
          if (!element || element === document.body) return null;
          const key = `${element.tagName}#${element.id}|${element.getAttribute("aria-label") ?? ""}|${element.textContent?.trim().slice(0, 20) ?? ""}|${Math.round(element.getBoundingClientRect().left)}|${Math.round(element.getBoundingClientRect().top + window.scrollY)}`;
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return null;
          const x = box.left + box.width / 2;
          const points = [box.top + 2, box.top + box.height / 2, box.bottom - 2].map((y) => document.elementFromPoint(x, y));
          const visible = points.map((hit) => hit !== null && element.contains(hit));
          const name = element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 30) || `<${element.tagName.toLowerCase()}>`;
          return { key, name, height: box.height, covered: visible.filter((ok) => !ok).length, covers: points.map((hit) => hit?.closest("nav, header")?.tagName ?? null) };
        });
        if (!result) continue;
        // Chromium and WebKit come back to the first stop; Firefox resumes from the last one. Either way, a stop
        // seen before means the page has been walked.
        if (seen.has(result.key)) {
          wrapped = true;
          break;
        }
        seen.add(result.key);
        // A control of ordinary size must be fully clear; a tall region (a scrolling table) must show at least part of itself.
        const limit = result.height > 100 ? 2 : 0;
        if (result.covered > limit && result.covers.some((tag) => tag !== null)) covered.push(`${path}: ${result.name} under ${result.covers.find((t) => t)}`);
      }
      // Focus must have come round to a stop it had already visited: a page longer than the cap would be checked only in part.
      expect(wrapped, `${path}: the tab loop came round to a stop it had visited within ${MAX_STOPS} stops`).toBe(true);
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
