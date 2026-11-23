import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

/** The moment the crash fixtures are read at: the newest crypto figure is ten minutes old, the daily series a few days. */
export const NOW = new Date("2026-11-20T10:05:00Z");

export const STATES = ["live", "delayed", "stale", "error", "not-configured", "peak-unknown", "mixed"] as const;
export type CrashState = (typeof STATES)[number];

/** A crash fixture as the API would answer it: the committed JSON the demo page also reads. */
export function crashFixture(state: CrashState): Record<string, unknown> {
  const path = fileURLToPath(new URL(`../../../../fixtures/ui/crash/${state}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

/** Pin the browser's clock, so the "Updated ... ago" and "as of" words do not depend on the day the test runs. */
export async function pinClock(page: Page): Promise<void> {
  await page.clock.install({ time: NOW });
}

/** Serve the crash endpoint from a function, and count the requests. */
export async function serveCrash(page: Page, body: () => Record<string, unknown>): Promise<{ calls: () => number }> {
  let calls = 0;
  await page.route("**/api/v1/markets/crash", async (route) => {
    calls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body()) });
  });
  return { calls: () => calls };
}
