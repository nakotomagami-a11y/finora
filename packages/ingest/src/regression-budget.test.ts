import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { companies, fakeSource } from "./testing/fake-source.ts";
import { memoryDb, sync } from "./test-helpers.ts";

// P10 in CI (qa #23): absolute times do not hold across machines, so each sync is timed against a
// fixed CPU workload run right beside it, and the ratio is compared with a stored baseline. The
// suite runs in parallel, so each ratio is the best of several rounds: load from other test files
// can only slow a round down. While the best is over budget, more rounds run (up to 12): contention
// slows some rounds, a real regression slows every one, so it still fails (qa NIT on S05). The absolute numbers are recorded per release in docs/plan/benchmarks.md.
const baseline = JSON.parse(readFileSync(new URL("./regression-budget.baseline.json", import.meta.url), "utf8")) as {
  records: number;
  firstLoadRatio: number;
  unchangedRatio: number;
  tolerance: number;
};

function calibrate(): number {
  const start = performance.now();
  let x = 0;
  for (let i = 0; i < 3_000_000; i++) x = (x * 31 + i) % 1_000_003;
  if (x < 0) throw new Error("unreachable");
  return performance.now() - start;
}

async function round(): Promise<{ firstLoad: number; unchanged: number }> {
  const db = memoryDb();
  const loader = fakeSource({}, { records: companies(1, baseline.records) });
  const before = calibrate();
  let start = performance.now();
  await sync(db, loader);
  const first = performance.now() - start;
  start = performance.now();
  await sync(db, loader);
  const again = performance.now() - start;
  const unit = Math.min(before, calibrate());
  return { firstLoad: first / unit, unchanged: again / unit };
}

describe("relative regression budgets on a synthetic source (P10)", () => {
  it(`a first load of ${baseline.records} records and an unchanged reload stay within the baseline`, async () => {
    const rounds: { firstLoad: number; unchanged: number }[] = [];
    const best = () => ({ firstLoad: Math.min(...rounds.map((r) => r.firstLoad)), unchanged: Math.min(...rounds.map((r) => r.unchanged)) });
    const within = () => best().firstLoad < baseline.firstLoadRatio * baseline.tolerance && best().unchanged < baseline.unchangedRatio * baseline.tolerance;
    while (rounds.length < 4 || (!within() && rounds.length < 12)) rounds.push(await round());
    const { firstLoad, unchanged } = best();
    expect(firstLoad, `first load ratio ${firstLoad.toFixed(1)}`).toBeLessThan(baseline.firstLoadRatio * baseline.tolerance);
    expect(unchanged, `unchanged ratio ${unchanged.toFixed(2)}`).toBeLessThan(baseline.unchangedRatio * baseline.tolerance);
  }, 300_000);
});
