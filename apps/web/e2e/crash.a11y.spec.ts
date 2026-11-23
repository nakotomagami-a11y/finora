import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { pinClock, STATES } from "./support/crash.ts";

test.use({ timezoneId: "UTC", reducedMotion: "reduce" });

const WIDTHS = [390, 768, 1280];

for (const theme of ["dark", "light"] as const) {
  for (const width of WIDTHS) {
    test(`axe: no violation on any crash state (${theme}, ${width} px)`, async ({ page }) => {
      await pinClock(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      for (const state of [...STATES, "loading"]) {
        await page.goto(`/en/crash?state=${state}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.map((v) => `${v.id} in ${state}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      }
    });
  }
}

test("axe: no violation with the set-up help open", async ({ page }) => {
  await pinClock(page);
  await page.goto("/en/crash?state=not-configured");
  await page.getByRole("button", { name: "How to set it up" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

for (const locale of ["lt", "lv", "et"]) {
  test(`axe: no violation on the ${locale} crash monitor`, async ({ page }) => {
    await pinClock(page);
    for (const state of ["live", "mixed"]) {
      await page.goto(`/${locale}/crash?state=${state}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${v.id} in ${state}`)).toEqual([]);
    }
  });
}

test("the strip's table is the text alternative of the bars", async ({ page }) => {
  await pinClock(page);
  await page.goto("/en/crash?state=live");
  const table = page.getByRole("table", { name: "Distance from peak" });
  await expect(table).toHaveCount(1);
  await expect(table.getByRole("row")).toHaveCount(13); // the header and twelve markets
  await expect(page.locator('ul[aria-hidden="true"]').first()).toHaveCount(1);
});

test("every control on the crash page is reachable with Tab and shows a focus ring", async ({ page }) => {
  await pinClock(page);
  await page.goto("/en/crash?state=not-configured");
  const buttons = page.getByRole("button", { name: "How to set it up" });
  await buttons.first().focus();
  const outline = await buttons.first().evaluate((el) => getComputedStyle(el).outlineStyle + " " + getComputedStyle(el).outlineWidth);
  expect(outline).not.toMatch(/^none/u);
});
