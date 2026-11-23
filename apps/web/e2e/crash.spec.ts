import { expect, test } from "@playwright/test";
import { pinClock } from "./support/crash.ts";

test.use({ timezoneId: "UTC" });

const TILES = ["US stocks", "Asia and Pacific", "Gold", "Crypto", "Oil"];

test.describe("crash monitor, every state (FINORA_DEMO=1)", () => {
  test.beforeEach(async ({ page }) => pinClock(page));

  test("live: five tiles, the total above the grid, a drop with arrow and real minus", async ({ page }) => {
    await page.goto("/en/crash?state=live");
    await expect(page.getByRole("heading", { level: 1, name: "How far markets are from their peaks" })).toBeVisible();
    for (const name of TILES) await expect(page.getByRole("heading", { level: 2, name }).first()).toBeVisible();
    await expect(page.getByText("≈ $5.9 trillion").first()).toBeVisible();
    // The total is above the grid of tiles.
    const total = await page.getByText("Value below peaks").first().boundingBox();
    const grid = await page.getByRole("heading", { level: 2, name: "US stocks" }).boundingBox();
    expect(total!.y).toBeLessThan(grid!.y);
    await expect(page.getByText("−8.4%").first()).toBeVisible(); // U+2212, not a hyphen
    await expect(page.getByText("-8.4%")).toHaveCount(0);
  });

  test("labels: cadence, delay and the basis of the peak", async ({ page }) => {
    await page.goto("/en/crash?state=live");
    await expect(page.getByText("Quarterly · as of Q2 2026")).toBeVisible();
    await expect(page.getByText("Monthly · as of Oct 2026")).toBeVisible();
    await expect(page.getByText("All-time high, 6 Oct 2025")).toBeVisible();
    await expect(page.getByText("Published with a lag").first()).toBeVisible();
    await page.goto("/en/crash?state=delayed");
    await expect(page.getByText("15 min delayed").first()).toBeVisible();
  });

  test("a peak that is not known yet says so and shows no percentage for that row", async ({ page }) => {
    await page.goto("/en/crash?state=peak-unknown");
    await expect(page.getByText(/Peak not known yet: tracking since 16 Nov 2026/u).first()).toBeVisible();
  });

  test("not configured: the words and the help, never 0%, no number", async ({ page }) => {
    await page.goto("/en/crash?state=not-configured");
    await expect(page.getByText(/Not configured: add provider/u).first()).toBeVisible();
    await expect(page.getByText("No number is shown until then, never 0%.").first()).toBeVisible();
    const main = page.locator("main");
    await expect(main.getByText(/(^|[^\d.])0(\.0)?%/u).filter({ hasNotText: "never 0%" })).toHaveCount(0);
    await page.getByRole("button", { name: "How to set it up" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Set up a provider" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "How to set it up" }).first()).toBeFocused(); // focus returns to the opener
  });

  test("stale rows say they are older than their usual refresh, in words and colour", async ({ page }) => {
    await page.goto("/en/crash?state=stale");
    await expect(page.getByText(/older than its usual refresh/u).first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Some values are older than their usual refresh" })).toBeVisible();
  });

  test("error: the failed row shows no number and a retry", async ({ page }) => {
    await page.goto("/en/crash?state=error");
    await expect(page.getByRole("alert").filter({ hasText: "One source failed" })).toBeVisible();
    await expect(page.getByText("Not checked: the source did not answer.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    // The strip does not drop a market that failed: it is listed, as not checked, after the drops.
    await expect(page.getByRole("table", { name: "Distance from peak" }).getByRole("cell", { name: "not checked" })).toHaveCount(3);
  });

  test("mixed: a row of each state in one grid", async ({ page }) => {
    await page.goto("/en/crash?state=mixed");
    for (const name of TILES) await expect(page.getByRole("heading", { level: 2, name }).first()).toBeVisible();
    await expect(page.getByText(/Not configured: add/u).first()).toBeVisible();
    await expect(page.getByText(/older than its usual refresh/u).first()).toBeVisible();
  });

  test("loading: a skeleton, busy, and no figure", async ({ page }) => {
    await page.goto("/en/crash?state=loading");
    await expect(page.getByLabel("Loading the markets")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText("Waiting for the first figures")).toBeVisible();
    await expect(page.locator("main").getByText("%")).toHaveCount(0);
  });

  test("attribution is plain text: no link, no logo, no image in a tile", async ({ page }) => {
    await page.goto("/en/crash?state=live");
    await expect(page.getByText("Citation required. Kept on this machine.").first()).toBeVisible();
    await expect(page.locator("main section a")).toHaveCount(0);
    await expect(page.locator("main section img, main section svg image")).toHaveCount(0);
  });

  test("the debt estimate is shown with the official figure and its date, never alone", async ({ page }) => {
    await page.goto("/en/crash?state=live");
    const card = page.getByRole("region", { name: "US national debt" });
    await expect(card.getByText("estimate", { exact: true })).toBeVisible();
    await expect(card.getByText("Official, 18 Nov 2026")).toBeVisible();
    await expect(card.getByText("$38,610,227,451,903").last()).toBeVisible();
    // The ticking digits are hidden from assistive technology; one static line carries the figures.
    await expect(card.locator(".sr-only")).toContainText("Official figure $38,610,227,451,903, as of 18 Nov 2026");
  });

  test("the demo parameter reaches no fixture outside a known name", async ({ page }) => {
    const response = await page.goto("/en/crash?state=../../package");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("crash monitor, localised", () => {
  test.beforeEach(async ({ page }) => pinClock(page));

  for (const [locale, heading, firstTile] of [
    ["lt", "Kiek rinkos nutolusios nuo savo viršūnių", "JAV akcijos"],
    ["lv", "Cik tālu tirgi ir no saviem virsotnēm", "ASV akcijas"],
    ["et", "Kui kaugel turud oma tippudest on", "USA aktsiad"],
  ] as const) {
    test(`${locale}: the heading, the tiles and no catalogue key on the page`, async ({ page }) => {
      await page.goto(`/${locale}/crash?state=mixed`);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: firstTile })).toBeVisible();
      const text = (await page.locator("main").innerText()).replace(/\s+/gu, " ");
      expect(text).not.toMatch(/\bcrash\.[a-z]+/u);
      expect(text).not.toMatch(/\{[a-z]+\}/u); // an unfilled placeholder
    });
  }
});
