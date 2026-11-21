import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/en", "/lt", "/lv", "/et", "/en/crash", "/en/terms", "/en/nothing-here"];

for (const theme of ["dark", "light"] as const) {
  for (const width of [390, 1280]) {
    test(`axe finds no serious or critical violation (${theme}, ${width} px)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 800 });
      for (const path of PAGES) {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(blocking.map((v) => `${v.id} on ${path}`)).toEqual([]);
      }
    });
  }
}
