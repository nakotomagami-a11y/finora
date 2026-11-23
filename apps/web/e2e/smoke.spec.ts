import { expect, test } from "@playwright/test";

const LOCALES = ["en", "lt", "lv", "et"] as const;

test.describe("locales", () => {
  for (const locale of LOCALES) {
    test(`/${locale} renders one h1 and sets the page language`, async ({ page }) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(message.text());
      });
      page.on("pageerror", (error) => problems.push(error.message));

      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(problems).toEqual([]);
    });
  }

  test("/ redirects by Accept-Language", async ({ browser }) => {
    for (const [header, expected] of [
      ["lv-LV", "/lv"],
      ["et-EE", "/et"],
      ["lt-LT", "/lt"],
      ["de-DE", "/en"],
    ] as const) {
      const context = await browser.newContext({ locale: header });
      const page = await context.newPage();
      await page.goto("/");
      expect(new URL(page.url()).pathname, header).toBe(expected);
      await context.close();
    }
  });

  test("the locale switcher keeps the path and the query", async ({ page }) => {
    await page.goto("/en/crash?view=all");
    await page.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "Lietuvių" }).click();
    await expect(page).toHaveURL(/\/lt\/crash\?view=all$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "lt");
  });

  test("an unknown path shows the localised not-found page", async ({ page }) => {
    const response = await page.goto("/lv/nothing-here");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lapa nav atrasta");
  });
});

test.describe("shell", () => {
  test("the tool rail comes from the manifests and marks the active tool", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");
    const rail = page.getByRole("navigation", { name: "Tools" }).first();
    await expect(rail.getByRole("link", { name: "Explorer" })).toHaveAttribute("aria-current", "page");
    await expect(rail.getByRole("link", { name: "Library" })).toHaveCount(0);
    await rail.getByRole("link", { name: "Crash monitor" }).click();
    await expect(page).toHaveURL(/\/en\/crash$/u);
    await expect(rail.getByRole("link", { name: "Crash monitor" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How far markets are from their peaks");
  });

  test("below 768 px the bottom bar replaces the rail, with no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    const [rail, bar] = [page.locator('nav[aria-label="Tools"]').nth(0), page.locator('nav[aria-label="Tools"]').nth(1)];
    await expect(bar).toBeVisible();
    await expect(rail).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the skip link is the first tab stop and moves focus to the main region", async ({ page, browserName }) => {
    // Safari's default is not to Tab onto links (a system setting turns it on), so this path is checked in the other engines.
    test.skip(browserName === "webkit", "WebKit does not Tab to links by default");
    await page.goto("/en");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });
});
