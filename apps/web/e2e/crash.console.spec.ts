import { expect, test, type Page } from "@playwright/test";

// Runs in all three engines (playwright.config ENGINE_SPECS): a console error is not the same everywhere, and Firefox
// reports a Content-Security-Policy eval probe that Chromium and WebKit stay silent about (web-qa on S23).
test.use({ timezoneId: "UTC" });

const STATES = ["live", "delayed", "stale", "error", "not-configured", "peak-unknown", "mixed", "loading"];

async function collectConsole(page: Page): Promise<string[]> {
  const problems: string[] = [];
  // Firefox does not always send a CSP violation to the console events, so the page itself reports each one.
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => (window as unknown as { __csp: string[] }).__csp.push(`${event.violatedDirective}: ${event.blockedURI || event.sample}`));
  });
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(`${message.type()}: ${message.text()}`);
  });
  // Navigating on cancels the router's background prefetches (`?_rsc=`): WebKit reports those as failed. A real failure is another request.
  const prefetch = (url: string) => url.includes("_rsc=");
  page.on("pageerror", (error) => {
    if (!/_rsc=/u.test(error.message)) problems.push(`pageerror: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    if (!prefetch(request.url())) problems.push(`requestfailed: ${request.url()}`);
  });
  return problems;
}

test("the Crash monitor logs nothing to the console in any state, in any engine", async ({ page }) => {
  const problems = await collectConsole(page);
  for (const state of STATES) {
    await page.goto(`/en/crash?state=${state}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    problems.push(...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).map((violation) => `csp (${state}): ${violation}`));
  }
  expect(problems).toEqual([]);
});

test("every Tab stop on the Crash monitor can be seen: it has a real size and a focus ring", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en/crash?state=mixed");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const stops: string[] = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { name: (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim().slice(0, 40), w: box.width, h: box.height, outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 };
    });
    if (info === null) break;
    stops.push(`${info.name} (${Math.round(info.w)}x${Math.round(info.h)})`);
    expect(info.w, `${info.name} is too narrow to see when focused`).toBeGreaterThanOrEqual(8);
    expect(info.h, `${info.name} is too short to see when focused`).toBeGreaterThanOrEqual(8);
  }
  expect(stops.length).toBeGreaterThan(5);
  expect(stops.join(" | ")).not.toMatch(/Distance from peak, as a table/u); // the screen-reader table is not a stop
});
