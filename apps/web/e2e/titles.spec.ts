import { expect, test } from "@playwright/test";

const TITLES: [string, string][] = [
  ["/en", "Explorer · Finora"],
  ["/en/crash", "Crash monitor · Finora"],
  ["/en/terms", "Terms of use · Finora"],
  ["/en/nothing-here", "Page not found · Finora"],
  ["/en/design", "Design system · Finora"],
  ["/en/design/buttons", "Buttons, labels and status · Finora"],
  ["/en/design/forms", "Forms and combobox · Finora"],
  ["/lv/terms", "Lietošanas noteikumi · Finora"],
  ["/et/crash", "Turulangused · Finora"],
  ["/lt/nothing-here", "Puslapis nerastas · Finora"],
];

test("every page has its own title", async ({ page }) => {
  for (const [path, title] of TITLES) {
    await page.goto(path);
    await expect(page, path).toHaveTitle(title);
  }
});
