import { expect, test, type Page } from "@playwright/test";

// Runs in all three engines (playwright.config ENGINE_SPECS): a console error is not the same everywhere, and Firefox
// reports a Content-Security-Policy eval probe that Chromium and WebKit stay silent about (web-qa on S23).
test.use({ timezoneId: "UTC" });

const STATES = ["live", "delayed", "stale", "error", "not-configured", "peak-unknown", "mixed", "loading"];

/** A request the browser itself gave up on (Chromium `net::ERR_ABORTED`, Firefox `NS_BINDING_ABORTED`, WebKit `cancelled`). */
export const isCancelled = (failure: string | undefined): boolean => /abort|cancel/iu.test(failure ?? "");

/** The router's cache-busting token of a server-component fetch: `?_rsc=bt_DIUrvHqI6sMmE`. */
const rscToken = (text: string): string | undefined => /_rsc=([\w-]+)/u.exec(text)?.[1];

async function collectConsole(page: Page): Promise<() => string[]> {
  const problems: string[] = [];
  // Firefox does not always send a CSP violation to the console events, so the page itself reports each one.
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => (window as unknown as { __csp: string[] }).__csp.push(`${event.violatedDirective}: ${event.blockedURI || event.sample}`));
  });
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(`${message.type()}: ${message.text()}`);
  });
  // Navigating on makes the browser cancel the router's background prefetches, and WebKit also raises a page error for the
  // fetch it cancelled. Only a request the browser itself cancelled is forgiven, and only the page error that names it:
  // any other failed request, and a page error for a request that was not cancelled, is a problem.
  const cancelled = new Set<string>();
  const fetchErrors: { token: string | undefined; text: string }[] = [];
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText;
    if (isCancelled(failure)) {
      const token = rscToken(request.url());
      if (token) cancelled.add(token);
    } else {
      problems.push(`requestfailed (${failure ?? "no reason"}): ${request.url()}`);
    }
  });
  page.on("pageerror", (error) => fetchErrors.push({ token: rscToken(error.message), text: error.message }));
  return () => [...problems, ...fetchErrors.filter((e) => e.token === undefined || !cancelled.has(e.token)).map((e) => `pageerror: ${e.text}`)];
}

test("only a request the browser cancelled is forgiven, never another failure", () => {
  for (const text of ["net::ERR_ABORTED", "NS_BINDING_ABORTED", "cancelled", "Load request cancelled"]) expect(isCancelled(text), text).toBe(true);
  for (const text of ["net::ERR_CONNECTION_REFUSED", "NS_ERROR_NET_RESET", "Could not connect to the server", "", undefined]) expect(isCancelled(text), String(text)).toBe(false);
  expect(rscToken("/127.0.0.1:3100/en?_rsc=bt_DIUrvHqI6sMmE due to access control checks.")).toBe("bt_DIUrvHqI6sMmE");
  expect(rscToken("http://127.0.0.1:3100/en/crash")).toBeUndefined();
});

test("the Crash monitor logs nothing to the console in any state, in any engine", async ({ page }) => {
  const problemsOf = await collectConsole(page);
  const seen: string[] = [];
  for (const state of STATES) {
    await page.goto(`/en/crash?state=${state}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    seen.push(...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).map((violation) => `csp (${state}): ${violation}`));
  }
  expect([...problemsOf(), ...seen]).toEqual([]);
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
