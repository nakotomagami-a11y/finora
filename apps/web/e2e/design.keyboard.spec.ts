import { expect, test, type Page } from "@playwright/test";

const GROUPS = ["buttons", "forms", "overlays", "data"];

async function focusRing(page: Page): Promise<{ style: string; width: number }> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const css = getComputedStyle(element);
    return { style: css.outlineStyle, width: Number.parseFloat(css.outlineWidth) };
  });
}

test.describe("keyboard", () => {
  for (const group of GROUPS) {
    test(`every tab stop on ${group} shows a visible focus ring`, async ({ page }) => {
      await page.goto(`/en/design/${group}`);
      const stops = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled]), main [role='switch'], main [role='checkbox'], main [role='tab'], main [role='radio'], main [tabindex='0']")].length,
      );
      expect(stops).toBeGreaterThan(0);
      await page.locator("main").first().focus();
      let visited = 0;
      for (let i = 0; i < stops + 12 && visited < stops; i += 1) {
        await page.keyboard.press("Tab");
        const inMain = await page.evaluate(() => Boolean(document.activeElement?.closest("main")));
        if (!inMain) continue;
        visited += 1;
        const ring = await focusRing(page);
        expect(ring.style, `a tab stop on ${group} has no outline`).not.toBe("none");
        expect(ring.width).toBeGreaterThanOrEqual(2);
      }
      expect(visited).toBeGreaterThan(0);
    });
  }

  test("the focus ring is an outline, so forced-colours mode keeps it", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/en/design/buttons");
    await page.getByRole("button", { name: "Investigate" }).first().focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const ring = await focusRing(page);
    expect(ring.style).not.toBe("none");
    expect(ring.width).toBeGreaterThanOrEqual(2);
  });

  test("the combobox is operated by the keyboard alone", async ({ page }) => {
    await page.goto("/en/design/forms");
    const input = page.getByRole("combobox", { name: "Search companies" });
    await input.focus();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox", { name: "Companies" }).getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("combobox-picked")).toHaveText("Chosen: Example Company B SIA");
    await expect(input).toBeFocused();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(input).toHaveValue("");
  });

  test("a dialog traps Tab, closes with Esc and returns focus to its opener", async ({ page }) => {
    await page.goto("/en/design/overlays");
    const opener = page.getByRole("button", { name: "Open dialog" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Start investigation" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Start investigation" })).toBeFocused();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']")));
      expect(inside).toBe(true);
    }
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Shift+Tab");
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']")));
      expect(inside).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("a sheet traps Tab and closes with Esc", async ({ page }) => {
    await page.goto("/en/design/overlays");
    const opener = page.getByRole("button", { name: "Open sheet" });
    await opener.click();
    const sheet = page.getByRole("dialog", { name: "Ask about this report" });
    await expect(sheet).toBeVisible();
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']")));
      expect(inside).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("the menu opens with the keyboard and Esc returns focus to its button", async ({ page }) => {
    await page.goto("/en/design/overlays");
    const trigger = page.getByRole("button", { name: "Finding actions" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu", { name: "Finding actions" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the segmented control moves with the arrow keys", async ({ page }) => {
    await page.goto("/en/design/forms");
    await page.waitForLoadState("networkidle");
    const graph = page.getByRole("radio", { name: "Graph" });
    await graph.focus();
    await page.keyboard.press("ArrowRight");
    // Radix moves the roving focus on the next tick; wait for it, as a person would, before choosing.
    const list = page.getByRole("radio", { name: "List" });
    await expect(list).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(list).toBeChecked();
  });
});
