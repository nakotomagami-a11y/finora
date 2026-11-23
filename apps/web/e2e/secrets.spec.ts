import { expect, test } from "@playwright/test";
import { SECRET_NAMES, sentinelFor } from "../../../scripts/check-bundle-secrets.mjs";

// The server runs with a sentinel in every secret variable (playwright.config.mjs). None of them may appear in
// anything it sends: a page, its RSC payload, an API answer, an error page, or a script the page loads.
const PATHS = ["/en", "/lv/terms", "/et/crash", "/en/design/forms", "/en/nothing-here", "/en/terms.rsc", "/en?_rsc=1", "/api/v1/health", "/api/v1/about", "/api/v1/nothing"];

test("no secret value is in any page, payload, answer or script the server sends", async ({ request, page }) => {
  const sentinels = SECRET_NAMES.map((name) => ({ name, value: sentinelFor(name) }));
  const scripts = new Set<string>();
  for (const path of PATHS) {
    const rsc = path.includes("_rsc") || path.endsWith(".rsc");
    const response = await request.get(path, rsc ? { headers: { RSC: "1" } } : {});
    const body = await response.text();
    const headers = JSON.stringify(response.headers());
    for (const { name, value } of sentinels) {
      expect(body, `${path} holds ${name}`).not.toContain(value);
      expect(headers, `${path} headers hold ${name}`).not.toContain(value);
    }
    for (const match of body.matchAll(/<script[^>]*\ssrc="([^"]+)"/gu)) scripts.add(match[1] as string);
  }

  // The scripts the first page loads, fetched as the browser does.
  await page.goto("/en");
  for (const src of await page.evaluate(() => [...document.scripts].map((script) => script.src).filter(Boolean))) scripts.add(new URL(src).pathname);
  expect(scripts.size).toBeGreaterThan(0);
  for (const src of scripts) {
    const body = await (await request.get(src)).text();
    for (const { name, value } of sentinels) expect(body, `${src} holds ${name}`).not.toContain(value);
  }
});
