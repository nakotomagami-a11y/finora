import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const GROUPS = ["buttons", "forms", "overlays", "data", "typography"];
const WIDTHS = [390, 768, 1024, 1280];

for (const theme of ["dark", "light"] as const) {
  for (const width of WIDTHS) {
    test(`axe: no serious or critical violation on the gallery (${theme}, ${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const group of GROUPS) {
        await page.goto(`/en/design/${group}?theme=${theme}`);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const results = await new AxeBuilder({ page }).analyze();
        const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(blocking.map((v) => `${v.id} on ${group}`)).toEqual([]);
      }
    });
  }
}

test("axe: no violation with a dialog or a sheet open", async ({ page }) => {
  for (const open of ["dialog", "sheet"]) {
    await page.goto(`/en/design/overlays?open=${open}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id} in the ${open}`)).toEqual([]);
  }
});

test("axe: no violation in the Lithuanian, Latvian and Estonian gallery", async ({ page }) => {
  for (const locale of ["lt", "lv", "et"]) {
    await page.goto(`/${locale}/design/forms`);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id} in ${locale}`)).toEqual([]);
  }
});
