import { describe, expect, it } from "vitest";
import {
  countMarketObservations,
  deleteMarketSource,
  expireMarketLatest,
  marketCheckedAt,
  marketSyncInfo,
  missingMarketDates,
  putMarketLatest,
  putMarketObservations,
  readMarketSeries,
  trimMarketWindow,
  upsertMarketSeries,
} from "./markets.ts";
import { contentSync, memoryStore, tempDir } from "./test-helpers.ts";
import { openStore } from "./open.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";

const series = { seriesKey: "fixture:index", sourceId: "mk-fixture", itemId: "M07.X.01", unit: "usd_per_bbl", frequency: "daily_exchange" } as const;

describe("market series (loaders/markets.md §1.2)", () => {
  it("opens connector-cache.db beside the other store files", () => {
    const dir = tempDir();
    try {
      openStore({ dataDir: dir.path }).close();
      expect(existsSync(join(dir.path, "connector-cache.db"))).toBe(true);
    } finally {
      dir.remove();
    }
  });

  it("writes observations with the sync that wrote them, and keeps an unchanged value's first sync", () => {
    const { db } = memoryStore();
    const s1 = contentSync(db, "mk-fixture", "2026-11-18T01:00:00Z", { upstreamAsOf: "2026-11-17", licenceId: "us-gov-public-domain" });
    const id = upsertMarketSeries(db, "main", series);
    expect(putMarketObservations(db, "main", id, [{ date: "2026-11-16", value: 70.1 }, { date: "2026-11-17", value: 71.2 }], s1)).toEqual({ written: 2, unchanged: 0 });
    const s2 = contentSync(db, "mk-fixture", "2026-11-19T01:00:00Z", { licenceId: "us-gov-public-domain" });
    expect(putMarketObservations(db, "main", id, [{ date: "2026-11-16", value: 70.1 }, { date: "2026-11-17", value: 71.5 }], s2)).toEqual({ written: 1, unchanged: 1 });
    const [stored] = readMarketSeries(db);
    expect(stored?.observations).toEqual([
      { date: "2026-11-16", value: 70.1, syncId: s1 },
      { date: "2026-11-17", value: 71.5, syncId: s2 },
    ]);
    const info = marketSyncInfo(db, [s1, s2]);
    expect(info.get(s1)).toMatchObject({ licenceId: "us-gov-public-domain", asOf: "2026-11-17" });
    expect(marketCheckedAt(db, "mk-fixture")).toBe("2026-11-19T01:00:00Z");
  });

  it("refuses a non-finite value", () => {
    const { db } = memoryStore();
    const s = contentSync(db, "mk-fixture", "2026-11-18T01:00:00Z");
    const id = upsertMarketSeries(db, "main", series);
    expect(() => putMarketObservations(db, "main", id, [{ date: "2026-11-17", value: Number.NaN }], s)).toThrow(RangeError);
  });

  it("refuses a sync id that does not exist in the main store (provenance)", () => {
    const { db } = memoryStore();
    const id = upsertMarketSeries(db, "main", series);
    expect(() => putMarketObservations(db, "main", id, [{ date: "2026-11-17", value: 1 }], 999)).toThrow();
  });

  it("finds the dates a window purge would delete, and nothing outside the window", () => {
    const { db } = memoryStore();
    const s = contentSync(db, "mk-fixture", "2026-11-18T01:00:00Z");
    const id = upsertMarketSeries(db, "main", series);
    putMarketObservations(db, "main", id, ["2026-11-10", "2026-11-11", "2026-11-12"].map((date) => ({ date, value: 1 })), s);
    expect(missingMarketDates(db, "main", id, "2026-11-11", "2026-11-30", new Set(["2026-11-12"]))).toEqual(["2026-11-11"]);
    expect(countMarketObservations(db, "main", id)).toBe(3);
  });

  it("drops a fund slot's values when its symbol changes", () => {
    const { db } = memoryStore();
    const s = contentSync(db, "stocks-s7", "2026-11-18T01:00:00Z");
    const slot = { seriesKey: "s7:slot:M02.europe", sourceId: "stocks-s7", itemId: "M02.X.01", unit: "usd", frequency: "daily_exchange", symbol: "ZZFX04" } as const;
    const first = upsertMarketSeries(db, "cc", slot);
    putMarketObservations(db, "cc", first, [{ date: "2026-11-17", value: 10 }], s);
    const second = upsertMarketSeries(db, "cc", { ...slot, symbol: "ZZFX05" });
    expect(countMarketObservations(db, "cc", second)).toBe(0);
    expect(upsertMarketSeries(db, "cc", { ...slot, symbol: "ZZFX05" })).toBe(second);
  });

  it("keeps licensed series in connector-cache.db only, and removing the key deletes them", () => {
    const { db } = memoryStore();
    const s = contentSync(db, "stocks-s7", "2026-11-18T01:00:00Z");
    const id = upsertMarketSeries(db, "cc", { ...series, seriesKey: "s7:slot:M01.us_total", sourceId: "stocks-s7", itemId: "M01.X.02", unit: "usd", symbol: "ZZFX01" });
    putMarketObservations(db, "cc", id, [{ date: "2026-11-17", value: 10 }], s);
    expect((db.prepare("SELECT count(*) AS n FROM main.market_obs").get() as { n: number }).n).toBe(0);
    expect(readMarketSeries(db).map((r) => r.where)).toEqual(["cc"]);
    expect(deleteMarketSource(db, "cc", "stocks-s7")).toBe(1);
    expect((db.prepare("SELECT count(*) AS n FROM cc.market_obs").get() as { n: number }).n).toBe(0);
  });

  it("expires latest snapshots older than the cut-off (C1: refresh within 24 h)", () => {
    const { db } = memoryStore();
    const s = contentSync(db, "crypto-c1", "2026-11-18T01:00:00Z");
    const id = upsertMarketSeries(db, "cc", { seriesKey: "c1:total_cap", sourceId: "crypto-c1", itemId: "M06.X.02", unit: "usd_cap", frequency: "daily_7d" });
    putMarketLatest(db, "cc", id, { value: 3e12, observedAt: "2026-11-18T00:55:00Z" }, s);
    expect(expireMarketLatest(db, "cc", "crypto-c1", "2026-11-18T00:00:00Z")).toBe(0);
    expect(expireMarketLatest(db, "cc", "crypto-c1", "2026-11-19T01:00:00Z")).toBe(1);
    expect(readMarketSeries(db)[0]?.latest).toBeNull();
  });

  it("trims observations before a later window start in both files", () => {
    const { db } = memoryStore();
    const s = contentSync(db, "mk-fixture", "2026-11-18T01:00:00Z");
    const a = upsertMarketSeries(db, "main", series);
    const b = upsertMarketSeries(db, "cc", { ...series, seriesKey: "fixture:cited" });
    putMarketObservations(db, "main", a, [{ date: "2024-12-20", value: 1 }, { date: "2025-01-02", value: 2 }], s);
    putMarketObservations(db, "cc", b, [{ date: "2024-12-20", value: 1 }], s);
    expect(trimMarketWindow(db, "2024-12-22")).toBe(2);
  });
});
