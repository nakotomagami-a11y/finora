import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
];

/** True when the element at each of the four inner corners of `box` (16 px in) is inside the popover. */
async function cornersHit(page: Page, selector: string): Promise<boolean[]> {
  return page.evaluate((sel) => {
    const panel = document.querySelector(sel) as HTMLElement;
    const r = panel.getBoundingClientRect();
    const inset = 16;
    const points: [number, number][] = [
      [r.left + inset, r.top + inset],
      [r.right - inset, r.top + inset],
      [r.left + inset, r.bottom - inset],
      [r.right - inset, r.bottom - inset],
    ];
    return points.map(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && panel.contains(hit);
    });
  }, selector);
}

for (const viewport of VIEWPORTS) {
  test(`a popover is fully visible and not clipped (${viewport.width} px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/en/design/overlays");
    await page.getByRole("button", { name: "Register LV · 19 Nov" }).click();
    const panel = page.getByRole("dialog", { name: "Source details" });
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(await cornersHit(page, "[role='dialog'][aria-label='Source details']")).toEqual([true, true, true, true]);
  });
}

test("a popover inside a scrolling table is not clipped by the table", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/design/overlays");
  await expect(page.getByRole("region", { name: "Sources in a table" })).toBeVisible();
  await page.getByRole("region", { name: "Sources in a table" }).getByRole("button", { name: "Register EE · 19 Nov" }).first().click();
  await expect(page.getByRole("dialog", { name: "Source details" })).toBeVisible();
  expect(await cornersHit(page, "[role='dialog'][aria-label='Source details']")).toEqual([true, true, true, true]);
});

test("the popover closes with Esc and returns focus to its chip", async ({ page }) => {
  await page.goto("/en/design/overlays");
  const chip = page.getByRole("button", { name: "Register LV · 19 Nov" });
  await chip.click();
  await expect(page.getByRole("dialog", { name: "Source details" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Source details" })).toBeHidden();
  await expect(chip).toBeFocused();
  await expect(chip).toHaveAttribute("aria-expanded", "false");
});

test("the toast appears without taking focus", async ({ page }) => {
  await page.goto("/en/design/overlays");
  const button = page.getByRole("button", { name: "Show toast" });
  await button.focus();
  await button.press("Enter");
  await expect(page.getByText("Objection sent", { exact: true }).first()).toBeVisible();
  await expect(button).toBeFocused();
});
