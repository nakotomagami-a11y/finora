import { expect, test } from "@playwright/test";

const DARK_BG = "rgb(15, 14, 13)";
const LIGHT_BG = "rgb(246, 244, 239)";

async function background(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test.describe("theme", () => {
  test("the first paint has the stored theme, with no inline script", async ({ request, baseURL }) => {
    for (const [cookie, expected] of [["finora-theme=light", "light"], ["finora-theme=dark", "dark"], ["", null]] as const) {
      const response = await request.get("/en", { headers: cookie ? { Cookie: cookie } : {} });
      const html = await response.text();
      const attribute = /<html[^>]*\sdata-theme="([^"]+)"/u.exec(html)?.[1] ?? null;
      expect(attribute, `cookie ${cookie || "(none)"} on ${baseURL}`).toBe(expected);
      const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([^<]*)<\/script>/gu)].map((m) => m[1] ?? "");
      expect(inline.filter((body) => /setAttribute\(["']data-theme|dataset\.theme/u.test(body))).toEqual([]);
    }
  });

  test("with no stored choice the page follows the operating system", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    expect(await background(page)).toBe(LIGHT_BG);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en");
    expect(await background(page)).toBe(DARK_BG);
  });

  test("the toggle switches at once, survives a reload and can return to the system choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en");
    const group = page.getByRole("radiogroup", { name: "Theme" });
    await group.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await background(page)).toBe(LIGHT_BG);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(group.getByRole("radio", { name: "Light" })).toBeChecked();

    await group.getByRole("radio", { name: "System" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/u);
    expect(await background(page)).toBe(DARK_BG);
    await page.reload();
    await expect(group.getByRole("radio", { name: "System" })).toBeChecked();
  });

  test("the toggle is named in each language", async ({ page }) => {
    for (const [locale, name] of [["lt", "Tema"], ["lv", "Tēma"], ["et", "Teema"]] as const) {
      await page.goto(`/${locale}`);
      await expect(page.getByRole("radiogroup", { name })).toBeVisible();
    }
  });
});
