import { expect, test, type Page } from "@playwright/test";

function watchViolations(page: Page): string[] {
  const found: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/content security policy|refused to (apply|load|execute)/iu.test(text)) found.push(text);
  });
  page.on("pageerror", (error) => found.push(error.message));
  return found;
}

test.describe("the content security policy holds in the browser", () => {
  test("no page of the gallery or the shell breaks it", async ({ page }) => {
    const found = watchViolations(page);
    for (const path of ["/en", "/lv/terms", "/en/design/buttons", "/en/design/forms", "/en/design/data", "/en/design/typography", "/en/design/overlays"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(found).toEqual([]);
  });

  test("an open dialog locks the page scroll without breaking the policy", async ({ page }) => {
    const found = watchViolations(page);
    await page.goto("/en/design/overlays?open=dialog");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-scroll-locked", /.+/u);
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflow).toBe("hidden");
    expect(found).toEqual([]);
  });
});
