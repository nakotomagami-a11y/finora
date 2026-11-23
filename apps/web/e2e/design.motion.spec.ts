import { expect, test, type Page } from "@playwright/test";

/** Every element on the page that has a running animation or a transition, with its duration in seconds. */
async function motion(page: Page): Promise<{ animations: number[]; transitions: number[] }> {
  return page.evaluate(() => {
    const seconds = (value: string) => Math.max(...value.split(",").map((part) => Number.parseFloat(part)));
    const animations: number[] = [];
    const transitions: number[] = [];
    for (const element of document.querySelectorAll("*")) {
      const css = getComputedStyle(element);
      if (css.animationName !== "none") animations.push(seconds(css.animationDuration));
      if (seconds(css.transitionDuration) > 0) transitions.push(seconds(css.transitionDuration));
    }
    return { animations, transitions };
  });
}

test.describe("motion", () => {
  test("by default the running dot pulses and controls transition", async ({ page }) => {
    await page.goto("/en/design/data");
    const found = await motion(page);
    expect(found.animations.some((duration) => duration >= 1)).toBe(true);
    const buttons = await (async () => {
      await page.goto("/en/design/buttons");
      return motion(page);
    })();
    expect(buttons.transitions.length).toBeGreaterThan(0);
  });

  test("with reduced motion no animation or transition has a duration", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const group of ["buttons", "forms", "data", "overlays"]) {
      await page.goto(`/en/design/${group}`);
      const found = await motion(page);
      expect(found.animations.filter((duration) => duration > 0), `animations on ${group}`).toEqual([]);
      expect(found.transitions, `transitions on ${group}`).toEqual([]);
    }
  });

  test("with reduced motion an opened dialog and sheet appear without animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const open of ["dialog", "sheet"]) {
      await page.goto(`/en/design/overlays?open=${open}`);
      await expect(page.getByRole("dialog")).toBeVisible();
      const found = await motion(page);
      expect(found.animations.filter((duration) => duration > 0)).toEqual([]);
    }
  });
});
