import { expect, test } from "@playwright/test";

const GROUPS = ["buttons", "forms", "overlays", "data"];
const PAGES = ["/en", "/lv/terms", "/en/crash", "/en/design", ...GROUPS.map((group) => `/en/design/${group}`), "/en/design/typography"];

// WCAG 2.2 AA (2.5.8) asks for 24 by 24 CSS pixels. Below 768 px DESIGN.md sets 36 to 40 px for buttons and 28 px
// for chips; this test holds every control to the 24 px floor and the sized controls to their own sizes.
test("every control on the gallery is at least 24 by 24 px at 390 px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const tooSmall: string[] = [];
  for (const group of GROUPS) {
    await page.goto(`/en/design/${group}`);
    const found = await page.evaluate(() => {
      const selector =
        "main button, main input:not([type=hidden]), main select, main textarea, main [role=switch], main [role=checkbox], main [role=radio], main [role=tab], main [role=combobox], main a[data-button-link]";
      return [...document.querySelectorAll<HTMLElement>(selector)]
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const box = element.getBoundingClientRect();
          const name = element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 30) || "";
          return { name: `<${element.tagName.toLowerCase()}${element.getAttribute("type") ? ` type=${element.getAttribute("type")}` : ""}> ${name}`, width: box.width, height: box.height };
        });
    });
    expect(found.length, `controls found on ${group}`).toBeGreaterThan(0);
    for (const control of found) {
      if (control.width < 24 || control.height < 24) tooSmall.push(`${group}: ${control.name} ${control.width.toFixed(0)}x${control.height.toFixed(0)}`);
    }
  }
  await context.close();
  expect(tooSmall).toEqual([]);
});

test("buttons are 40 px high and small buttons 36 px below 768 px, and 36 and 28 px above", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/design/buttons");
  const height = async (name: string) => (await page.getByRole("button", { name }).first().boundingBox())!.height;
  expect(await height("Investigate")).toBeGreaterThanOrEqual(40);
  expect(await height("Small")).toBeGreaterThanOrEqual(36);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await height("Investigate")).toBeGreaterThanOrEqual(36);
  expect(await height("Small")).toBeGreaterThanOrEqual(28);
});

test("footer links are at least 32 px tall at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/en", "/lv/terms", "/en/design"]) {
    await page.goto(path);
    const heights = await page.locator("footer a").evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().height)));
    expect(heights.length).toBeGreaterThan(3);
    for (const height of heights) expect(height, `a footer link on ${path}`).toBeGreaterThanOrEqual(32);
  }
});

// A link in running text is exempt (WCAG 2.5.8, inline exception). Every other link (a list, a breadcrumb, the
// footer, the index) is at least 32 px tall, from padding (DESIGN.md §14).
for (const width of [390, 1280]) {
  test(`every standalone link is at least 32 px tall (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const tooSmall: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      const found = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>("main a[href], nav a[href], footer a[href]")]
          .filter((link) => link.getClientRects().length > 0)
          // A link drawn as a button is a button: it has the button sizes, held by the test above.
          .filter((link) => !link.hasAttribute("data-button-link"))
          .filter((link) => {
            // Inline: the text around the link, in its own block, is more than the link itself.
            const block = link.closest("p, li, dd, td");
            const around = (block?.textContent ?? "").replace(link.textContent ?? "", "").trim();
            return !(block && around.length > 0);
          })
          .map((link) => ({ name: link.getAttribute("aria-label") || link.textContent?.trim().slice(0, 30) || link.getAttribute("href") || "", height: link.getBoundingClientRect().height })),
      );
      expect(found.length, `links found on ${path}`).toBeGreaterThan(0);
      for (const link of found) if (link.height < 32) tooSmall.push(`${path}: ${link.name} ${link.height.toFixed(0)}px`);
    }
    expect(tooSmall).toEqual([]);
  });
}
