import { expect, test, type Page } from "@playwright/test";
import { crashFixture, pinClock, serveCrash } from "./support/crash.ts";

test.use({ timezoneId: "UTC" });

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The live fixture with the bitcoin row moved: a refresh that changes a value in a tile. */
function withBitcoin(value: number, drawdownPct: number): Json {
  const body = structuredClone(crashFixture("live")) as Json;
  const row = body.tiles.find((t: Json) => t.tileId === "M06").rows.find((r: Json) => r.rowKey.endsWith("bitcoin"));
  row.value = value;
  row.drawdownPct = drawdownPct;
  return body;
}

async function watchLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

const cls = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

test.describe("crash monitor, the 60 second poll", () => {
  test("a refresh changes a crypto value in place and moves nothing", async ({ page }) => {
    await watchLayoutShift(page);
    await pinClock(page);
    let current = withBitcoin(71_000, -24.5);
    const api = await serveCrash(page, () => current);
    await page.goto("/en/crash");
    await expect(page.getByText("−24.5%").first()).toBeVisible();
    await expect.poll(api.calls).toBe(1);
    await page.waitForTimeout(600); // the page-load shifts (web fonts, the shell) are reported by now

    const tile = page.getByRole("heading", { level: 2, name: "Crypto" });
    const before = await tile.boundingBox();
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const shiftBefore = await cls(page);

    current = withBitcoin(72_600, -22.8);
    await page.clock.runFor(60_000);
    await expect(page.getByText("−22.8%").first()).toBeVisible();
    await expect(page.getByText("−24.5%")).toHaveCount(0);
    expect(api.calls()).toBe(2);

    expect(await tile.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(pageHeight);
    expect(await cls(page)).toBe(shiftBefore);
  });

  test("it polls once a minute, not faster", async ({ page }) => {
    await pinClock(page);
    const api = await serveCrash(page, () => crashFixture("live"));
    await page.goto("/en/crash");
    await expect.poll(api.calls).toBe(1);
    await page.clock.runFor(59_000);
    expect(api.calls()).toBe(1);
    await page.clock.runFor(2_000);
    await expect.poll(api.calls).toBe(2);
  });

  test("it does not poll while the tab is hidden, and refreshes when it is shown again", async ({ page }) => {
    await pinClock(page);
    const api = await serveCrash(page, () => crashFixture("live"));
    await page.goto("/en/crash");
    await expect.poll(api.calls).toBe(1);

    const setVisibility = (state: "hidden" | "visible") =>
      page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => value === "hidden" });
        document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
      }, state);

    await setVisibility("hidden");
    await page.clock.runFor(180_000);
    expect(api.calls()).toBe(1);
    await setVisibility("visible");
    await expect.poll(api.calls).toBeGreaterThanOrEqual(2);
  });

  test("a failed refresh keeps the last figures on the page", async ({ page }) => {
    await pinClock(page);
    let fail = false;
    await page.route("**/api/v1/markets/crash", async (route) => {
      if (fail) await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "x" } }) });
      else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(crashFixture("live")) });
    });
    await page.goto("/en/crash");
    await expect(page.getByText("−8.4%").first()).toBeVisible();
    fail = true;
    await page.clock.runFor(60_000);
    await expect(page.getByText("−8.4%").first()).toBeVisible();
  });
});
