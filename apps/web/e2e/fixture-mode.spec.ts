import type { ChildProcess } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { startPlainServer } from "./support/plain-server.mjs";

const FIXTURES = "/en/design/fixtures";

test.describe("fixture states (FINORA_DEMO=1)", () => {
  test("a finished investigation shows its status, usage share, lanes and verdict, from the real reducer", async ({ page }) => {
    await page.goto(`${FIXTURES}?screen=investigation&state=report`);
    const fixture = page.getByTestId("fixture");
    await expect(fixture.getByText("investigation / report")).toBeVisible();
    await expect(fixture.getByText("done", { exact: true }).first()).toBeVisible();
    await expect(fixture.getByText(/38% of the cap/u)).toBeVisible(); // 190k of 500k, settled
    await expect(fixture.getByRole("progressbar", { name: "Usage of this investigation's cap" })).toHaveAttribute("aria-valuetext", "38% of the cap: 190k used, cap 500k standard tokens");
    await expect(fixture.getByRole("row")).toHaveCount(7); // the header and six lanes
    await expect(fixture.getByText("Verdict: points to check, 9 of 11 checks ran")).toBeVisible();
  });

  test("a running investigation counts what is held, and draws it as a band", async ({ page }) => {
    await page.goto(`${FIXTURES}?screen=investigation&state=streaming`);
    // used 120k + held 80k of 500k = 40%
    await expect(page.getByText(/40% of the cap · 120k used, 80k held, cap 500k standard tokens/u)).toBeVisible();
    await expect(page.locator("[data-band]")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Usage of this investigation's cap" })).toHaveAttribute("aria-valuetext", "40% of the cap: 120k used, 80k held for running work, cap 500k standard tokens");
  });

  test("a plan limit pauses the whole investigation and says when it resumes", async ({ page }) => {
    await page.goto(`${FIXTURES}?screen=investigation&state=limit`);
    await expect(page.getByTestId("fixture").getByText("paused", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("fixture").getByText("plan_limit", { exact: true })).toBeVisible();
    await expect(page.getByText("resumes after 14:00 UTC")).toBeVisible();
  });

  test("a paid extra usage pause carries its own code", async ({ page }) => {
    await page.goto(`${FIXTURES}?screen=investigation&state=overage`);
    await expect(page.getByTestId("fixture").getByText("overage", { exact: true })).toBeVisible();
  });

  test("a waiting question is listed by its kind", async ({ page }) => {
    await page.goto(`${FIXTURES}?screen=investigation&state=question-cap`);
    await expect(page.getByText("Waiting for you: cap_reached")).toBeVisible();
    await page.goto(`${FIXTURES}?screen=investigation&state=question-entity`);
    await expect(page.getByText("Waiting for you: entity_choice")).toBeVisible();
  });

  test("a market whose provider is not configured shows no number and never 0%", async ({ page }) => {
    await page.goto(`${FIXTURES}?screen=crash&state=not-configured`);
    await expect(page.getByText("Not configured: add this provider to your local provider file")).toBeVisible();
    await expect(page.getByTestId("fixture").getByText("none", { exact: true })).toBeVisible();
    await expect(page.getByTestId("fixture").getByText("0%")).toHaveCount(0);
  });

  test("the list links every fixture and opens it", async ({ page }) => {
    await page.goto(FIXTURES);
    await page.getByRole("link", { name: "peak-unknown" }).click();
    await expect(page).toHaveURL(/screen=crash&state=peak-unknown/u);
    await expect(page.getByTestId("fixture").getByText("crash / peak-unknown")).toBeVisible();
  });

  test("/design?state=report opens the investigation fixture", async ({ page }) => {
    await page.goto("/en/design?state=report");
    await expect(page).toHaveURL(/design\/fixtures\?screen=investigation&state=report/u);
    await expect(page.getByTestId("fixture")).toBeVisible();
  });

  test("an unknown fixture, and a name that tries to leave the folder, answer 404", async ({ request }) => {
    for (const query of ["screen=investigation&state=nothing-here", "screen=..&state=report", "screen=investigation&state=..%2F..%2Fpackage", "screen=nothing&state=x"]) {
      expect((await request.get(`${FIXTURES}?${query}`)).status(), query).toBe(404);
    }
  });

  test("axe: no serious or critical violation on a fixture page, in both themes", async ({ page }) => {
    for (const theme of ["dark", "light"]) {
      await page.goto(`${FIXTURES}?screen=investigation&state=streaming&theme=${theme}`);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${theme})`)).toEqual([]);
    }
  });
});

test.describe("a normal run (no FINORA_DEMO)", () => {
  let server: ChildProcess | undefined;
  const PORT = 3101;

  test.afterEach(() => {
    server?.kill();
  });

  test("the gallery and every fixture are 404, and ?state= changes nothing on a real page", async ({ request }) => {
    test.setTimeout(90_000);
    server = startPlainServer(PORT);
    const base = `http://127.0.0.1:${PORT}`;
    await expect.poll(async () => (await request.get(`${base}/api/v1/health`).catch(() => null))?.status() ?? 0, { timeout: 60_000 }).toBe(200);

    for (const path of ["/en/design", "/en/design/buttons", `${FIXTURES}`, `${FIXTURES}?screen=investigation&state=report`, "/en/design?state=report"]) {
      expect((await request.get(`${base}${path}`)).status(), path).toBe(404);
    }
    // `?state=` and its friends change nothing a person can see on a real page.
    const heading = async (url: string) => {
      const html = await (await request.get(url)).text();
      return { title: /<title>([^<]*)<\/title>/u.exec(html)?.[1], h1: /<h1[^>]*>([^<]*)<\/h1>/u.exec(html)?.[1], fixture: html.includes("fixture") };
    };
    const plain = await heading(`${base}/en`);
    const asked = await heading(`${base}/en?state=streaming&country=lt&markets=stale`);
    expect(asked).toEqual(plain);
    expect(plain.fixture).toBe(false);
  });
});
