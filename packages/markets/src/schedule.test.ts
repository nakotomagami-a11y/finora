import { describe, expect, it } from "vitest";
import { dueJobs, FREE_LIMITS, JOBS, newYorkToUtc, requestsPerRun, type JobId } from "./schedule.ts";

/** Runs the scheduler minute by minute over a simulated day and counts requests per source. */
function simulate(from: string, minutes: number, clientUntilMinute: number) {
  const last = new Map<JobId, string>();
  const perSource = new Map<string, number>();
  const perHour = new Map<string, number>();
  const start = Date.parse(from);
  for (let m = 0; m < minutes; m++) {
    const now = new Date(start + m * 60_000).toISOString();
    const poll = m <= clientUntilMinute ? now : new Date(start + clientUntilMinute * 60_000).toISOString();
    for (const id of dueJobs(now, last, poll)) {
      last.set(id, now);
      for (const run of JOBS.find((j) => j.id === id)?.runs ?? []) {
        const n = requestsPerRun(run.sourceId, run.mode);
        perSource.set(run.sourceId, (perSource.get(run.sourceId) ?? 0) + n);
        const hour = `${run.sourceId}@${now.slice(0, 13)}`;
        perHour.set(hour, (perHour.get(hour) ?? 0) + n);
      }
    }
  }
  return { perSource, perHour, last };
}

describe("the Crash monitor schedule (loaders/markets.md §1.6)", () => {
  const day = simulate("2026-11-18T00:00:00Z", 24 * 60, 24 * 60);

  it("never exceeds a free limit over a simulated day with a client connected all day", () => {
    for (const [source, limit] of Object.entries(FREE_LIMITS)) {
      const total = day.perSource.get(source) ?? 0;
      if (limit.perDay) expect(total, source).toBeLessThanOrEqual(limit.perDay);
      if (limit.perMonth) expect(total * 31, source).toBeLessThanOrEqual(limit.perMonth);
      if (limit.perHour) for (const [key, n] of day.perHour) if (key.startsWith(`${source}@`)) expect(n, key).toBeLessThanOrEqual(limit.perHour);
    }
  });

  it("polls crypto quotes every 5 min while connected, the total-crypto aggregator every 15", () => {
    expect(day.perSource.get("crypto-x4-ohlc")).toBe((24 * 60) / 5 * 2 + 24 * 2);
    expect(day.perSource.get("crypto-c1")).toBe((24 * 60) / 15 + 24 * 2);
  });

  it("drops to hourly 30 min after the last client poll", () => {
    // Last poll at minute 30, so connected until minute 60: quotes at 0, 5, ..., 60 (13 runs), then hourly
    // at 120, 180, 240 and 300 (4 runs). The hourly daily-candle job adds 6 runs. Each run is 2 requests.
    const idle = simulate("2026-11-18T00:00:00Z", 6 * 60, 30);
    expect(idle.perSource.get("crypto-x4-ohlc")).toBe((13 + 4) * 2 + 6 * 2);
  });

  it("runs every job once at boot (catch-up), then official series 4 times a day", () => {
    expect(dueJobs("2026-11-18T10:00:00Z", new Map(), null).sort()).toEqual(JOBS.map((j) => j.id).sort());
    expect(day.perSource.get("us-treasury-debt")).toBe(1 + 4);
  });

  it("converts New York wall-clock times across daylight saving", () => {
    expect(new Date(newYorkToUtc("2026-07-15", "16:30")).toISOString()).toBe("2026-07-15T20:30:00.000Z");
    expect(new Date(newYorkToUtc("2026-11-18", "16:30")).toISOString()).toBe("2026-11-18T21:30:00.000Z");
  });
});
