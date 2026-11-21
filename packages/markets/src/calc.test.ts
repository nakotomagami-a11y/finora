import { describe, expect, it } from "vitest";
import { computeRow, isStale, totalWiped, weekdaysBetween, type RowContext, type SeriesData } from "./calc.ts";
import { FIXTURE_DRAWDOWN, FIXTURE_PEAK_DATE, FIXTURE_TODAY, plantedSeries } from "./fixtures/series.ts";
import { TILE_ROWS, type TileRow } from "./tiles.ts";

const row = (key: string): TileRow => {
  const r = TILE_ROWS.find((t) => t.rowKey === key);
  if (!r) throw new Error(key);
  return r;
};
const ctx = (over: Partial<RowContext> = {}): RowContext => ({ peakSince: "2025-01-01", now: `${FIXTURE_TODAY}T23:00:00Z`, keyPresent: true, sourceFailed: false, seeds: [], ...over });
const data = (entries: [string, SeriesData][]) => new Map(entries);
const daily = (peak: number, seed = 1) => plantedSeries({ seed, calendar: "weekdays", from: "2024-12-22", peak }).map((o) => ({ ...o, syncId: 7 }));

describe("Crash monitor maths (loaders/markets.md §1.4)", () => {
  it("finds the planted peak and the exact drawdown", () => {
    const v = computeRow(row("M07.X.01:brent"), data([["fred:DCOILBRENTEU", { observations: daily(80), latest: null }]]), ctx());
    expect(v.state).toBe("ok");
    expect(v.peak).toEqual({ value: 80, date: FIXTURE_PEAK_DATE, basis: "since" });
    expect(v.value).toBeCloseTo(80 * (1 + FIXTURE_DRAWDOWN), 2);
    expect(v.drawdownPct).toBeCloseTo(FIXTURE_DRAWDOWN * 100, 1);
    expect(v.valueLostUsd).toBeUndefined();
    expect(v.dayChangePct).toBeTypeOf("number");
    expect(v.cadence).toBe("daily_exchange");
    expect(v.inputs[0]).toEqual({ seriesKey: "fred:DCOILBRENTEU", syncIds: [7] });
  });

  it("ignores closes before peakSince when it looks for the peak", () => {
    const obs = [{ date: "2024-12-23", value: 999 }, ...daily(80)];
    expect(computeRow(row("M07.X.01:brent"), data([["fred:DCOILBRENTEU", { observations: obs, latest: null }]]), ctx()).peak?.value).toBe(80);
  });

  it("never shows 0% when the peak is not known: Taiwan tracks from its first run", () => {
    const obs = plantedSeries({ seed: 3, calendar: "weekdays", from: "2026-11-02", peak: 25000 });
    const v = computeRow(row("M03.X.01:taiwan"), data([["twse:taiex", { observations: obs, latest: null }]]), ctx());
    expect(v.state).toBe("peak_unknown");
    expect(v.trackingSince).toBe("2026-11-02");
    expect(v.drawdownPct).toBeUndefined();
    expect(v.peak).toBeUndefined();
    expect(v.value).toBeTypeOf("number");
  });

  it("uses a cited seed as the peak and marks the basis as seeded", () => {
    const obs = plantedSeries({ seed: 3, calendar: "weekdays", from: "2026-11-02", peak: 25000 });
    const seeds = [{ seriesKey: "twse:taiex", date: "2025-06-30", value: 30000, citation: "fixture", licence: "ogdl-tw-1.0" }];
    const v = computeRow(row("M03.X.01:taiwan"), data([["twse:taiex", { observations: obs, latest: null }]]), ctx({ seeds }));
    expect(v.state).not.toBe("peak_unknown");
    expect(v.peak).toEqual({ value: 30000, date: "2025-06-30", basis: "seeded" });
  });

  it("computes value lost only where the tile allows it: a market-value series", () => {
    const obs = plantedSeries({ seed: 2, calendar: "quarter_end", from: "2024-12-22", peak: 100e12 }).map((o) => ({ ...o, syncId: 3 }));
    const v = computeRow(row("M01.X.01:us_equities"), data([["fred:BOGZ1LM893064105Q", { observations: obs, latest: null }]]), ctx());
    expect(v.valueLostUsd).toBeCloseTo(100e12 * -FIXTURE_DRAWDOWN, -6);
    expect(v.dayChangePct).toBeUndefined();
  });

  it("computes value lost from supply for bitcoin, citing the supply, and hides it when the supply is stale", () => {
    const obs = plantedSeries({ seed: 7, calendar: "all", from: "2024-12-22", peak: 100_000 }).map((o) => ({ ...o, syncId: 11 }));
    const supply = { observations: [], latest: { value: 20_000_000, observedAt: `${FIXTURE_TODAY}T22:00:00Z`, syncId: 12 } };
    const v = computeRow(row("M06.X.01b:bitcoin"), data([["x4:btcusd", { observations: obs, latest: null }], ["btc:supply", supply]]), ctx());
    expect(v.valueLostUsd).toBeCloseTo(100_000 * -FIXTURE_DRAWDOWN * 20_000_000, -6);
    expect(v.inputs.map((i) => i.seriesKey)).toEqual(["x4:btcusd", "btc:supply"]);
    const old = { observations: [], latest: { value: 20_000_000, observedAt: "2026-11-10T00:00:00Z" } };
    const hidden = computeRow(row("M06.X.01b:bitcoin"), data([["x4:btcusd", { observations: obs, latest: null }], ["btc:supply", old]]), ctx());
    expect(hidden.valueLostUsd).toBeUndefined();
    expect(hidden.drawdownPct).toBeTypeOf("number");
  });

  it("takes the total-crypto peak from the all-time high and the current total only (no C1 history)", () => {
    const now = { observations: [], latest: { value: 3e12, observedAt: `${FIXTURE_TODAY}T22:00:00Z`, syncId: 21 } };
    const ath = { observations: [], latest: { value: 4e12, observedAt: "2025-10-06T00:00:00Z", syncId: 22 } };
    const v = computeRow(row("M06.X.02:total_crypto"), data([["c1:total_cap", now], ["c3:total_cap_peak", ath]]), ctx());
    expect(v.peak).toEqual({ value: 4e12, date: "2025-10-06", basis: "all_time" });
    expect(v.valueLostUsd).toBe(1e12);
    expect(v.drawdownPct).toBeCloseTo(-25, 6);
    const above = computeRow(row("M06.X.02:total_crypto"), data([["c1:total_cap", { observations: [], latest: { value: 5e12, observedAt: now.latest.observedAt } }], ["c3:total_cap_peak", ath]]), ctx());
    expect(above.peak?.value).toBe(5e12);
    expect(above.drawdownPct).toBe(0);
  });

  it("uses a fresh live value over the last close, and falls back to the close when it is too old", () => {
    const obs = daily(80);
    const fresh = { value: 50, observedAt: `${FIXTURE_TODAY}T22:30:00Z`, syncId: 9 };
    const live = computeRow(row("M06.X.01b:bitcoin"), data([["x4:btcusd", { observations: obs, latest: fresh }]]), ctx());
    expect(live.value).toBe(50);
    expect(live.cadence).toBe("live");
    const stale = computeRow(row("M06.X.01b:bitcoin"), data([["x4:btcusd", { observations: obs, latest: { ...fresh, observedAt: `${FIXTURE_TODAY}T18:00:00Z` } }]]), ctx());
    expect(stale.value).not.toBe(50);
    expect(stale.cadence).toBe("daily_7d");
  });

  it("shows no number for a fund slot without a symbol, and asks for the key when the symbol is set", () => {
    const fund = row("M02.X.01:europe");
    expect(computeRow(fund, data([]), ctx())).toMatchObject({ state: "needs_symbol" });
    expect(computeRow(fund, data([]), ctx()).value).toBeUndefined();
    const keyless = computeRow(fund, data([]), ctx({ symbol: "ZZFX04", keyPresent: false }));
    expect(keyless).toMatchObject({ state: "needs_key", symbol: "ZZFX04" });
    expect(keyless.value).toBeUndefined();
  });

  it("reports loading before the first sync, and error when the source failed with nothing stored", () => {
    expect(computeRow(row("M07.X.01:wti"), data([]), ctx()).state).toBe("loading");
    expect(computeRow(row("M07.X.01:wti"), data([]), ctx({ sourceFailed: true })).state).toBe("error");
  });

  it("marks a row stale at twice its cadence", () => {
    const obs = daily(80).filter((o) => o.date <= "2026-11-10");
    expect(computeRow(row("M07.X.01:brent"), data([["fred:DCOILBRENTEU", { observations: obs, latest: null }]]), ctx()).state).toBe("stale");
  });
});

describe("stale thresholds (council clarification 1)", () => {
  it("does not mark a Friday close stale on Monday, and does by Thursday", () => {
    expect(weekdaysBetween("2026-11-13", "2026-11-16")).toBe(0);
    expect(isStale("daily_exchange", "2026-11-13", "2026-11-16T08:00:00Z")).toBe(false);
    expect(isStale("daily_exchange", "2026-11-13", "2026-11-18T08:00:00Z")).toBe(false);
    expect(isStale("daily_exchange", "2026-11-13", "2026-11-19T08:00:00Z")).toBe(true);
  });
  it("uses calendar days for 7-day markets, 62 for monthly and 184 for quarterly", () => {
    expect(isStale("daily_7d", "2026-11-16", "2026-11-18T08:00:00Z")).toBe(false);
    expect(isStale("daily_7d", "2026-11-15", "2026-11-18T08:00:00Z")).toBe(true);
    expect(isStale("monthly", "2026-09-30", "2026-11-30T00:00:00Z")).toBe(false);
    expect(isStale("monthly", "2026-09-30", "2026-12-02T00:00:00Z")).toBe(true);
    expect(isStale("quarterly", "2026-06-30", "2026-12-31T00:00:00Z")).toBe(false);
    expect(isStale("quarterly", "2026-06-30", "2027-01-01T00:00:00Z")).toBe(true);
  });
});

describe("totalWiped (designer 7029912590)", () => {
  const base = { tileId: "M01" as const, labelKey: "x", unit: "usd" as const, cadence: "quarterly" as const, delayed: true, inputs: [] };
  it("sums only countInTotal rows: bitcoin and ether are not added on top of the total crypto market", () => {
    const t = totalWiped([
      { ...base, rowKey: "a", itemId: "M01.X.01", state: "ok", valueLostUsd: 10e12, asOf: "2026-06-30", countInTotal: true },
      { ...base, rowKey: "b", itemId: "M06.X.02", state: "ok", valueLostUsd: 1e12, asOf: "2026-11-18T22:00:00Z", countInTotal: true },
      { ...base, rowKey: "c", itemId: "M06.X.01b", state: "ok", valueLostUsd: 0.5e12, asOf: "2026-11-18", countInTotal: false },
    ]);
    expect(t).toEqual({ valueUsd: 11e12, rowItemIds: ["M01.X.01", "M06.X.02"], excludedItemIds: [], oldestAsOf: "2026-06-30" });
  });
  it("names a counted row with no value as excluded, and never replaces it by its parts", () => {
    const t = totalWiped([
      { ...base, rowKey: "a", itemId: "M01.X.01", state: "ok", valueLostUsd: 10e12, asOf: "2026-06-30", countInTotal: true },
      { ...base, rowKey: "b", itemId: "M06.X.02", state: "error", countInTotal: true },
      { ...base, rowKey: "c", itemId: "M06.X.01b", state: "ok", valueLostUsd: 0.5e12, asOf: "2026-11-18", countInTotal: false },
    ]);
    expect(t).toEqual({ valueUsd: 10e12, rowItemIds: ["M01.X.01"], excludedItemIds: ["M06.X.02"], oldestAsOf: "2026-06-30" });
  });
});
