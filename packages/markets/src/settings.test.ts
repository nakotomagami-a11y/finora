import { describe, expect, it } from "vitest";
import { btcSupply } from "./btc-supply.ts";
import { debtTicker, tickerValue } from "./debt.ts";
import { PEAK_SINCE_DEFAULT, readMarketSettings, settingKey, windowStart } from "./settings.ts";

describe("market settings", () => {
  it("defaults the peak date, and ignores an invalid one rather than guessing", () => {
    expect(readMarketSettings(new Map())).toEqual({ peakSince: PEAK_SINCE_DEFAULT });
    expect(readMarketSettings(new Map([[settingKey.peakSince, "2025-02-30"]]))).toEqual({ peakSince: PEAK_SINCE_DEFAULT });
    expect(readMarketSettings(new Map([[settingKey.peakSince, "2024-06-01"]]))).toEqual({ peakSince: "2024-06-01" });
  });

  it("keeps observations from 10 days before the peak date", () => {
    expect(windowStart("2025-01-01")).toBe("2024-12-22");
  });
});

describe("the debt ticker (M08, 'Ticker is an estimate')", () => {
  it("runs forward from the latest figure at last year's average rate", () => {
    const t = debtTicker([
      { date: "2025-11-17", value: 30e12 },
      { date: "2026-11-17", value: 30e12 + 365 * 86_400 * 100 },
      { date: "2026-06-01", value: 1 },
    ]);
    expect(t).toMatchObject({ total: 30e12 + 365 * 86_400 * 100, anchor: "2026-11-17T21:00:00Z", yearAgoDate: "2025-11-17" });
    expect(t?.perSecond).toBeCloseTo(100, 6);
    expect(tickerValue(t!, "2026-11-17T21:00:10Z") - (t?.total ?? 0)).toBeCloseTo(1000, 3);
  });
  it("needs a year of history", () => {
    expect(debtTicker([{ date: "2026-11-17", value: 1 }])).toBeNull();
  });
});

describe("bitcoin supply from block height", () => {
  it("follows the halving schedule and never passes 21 million", () => {
    expect(btcSupply(0)).toBe(50);
    expect(btcSupply(209_999)).toBe(10_500_000);
    expect(btcSupply(210_000)).toBe(10_500_025);
    expect(btcSupply(976_627)).toBeGreaterThan(20_100_000);
    expect(btcSupply(10_000_000)).toBeLessThan(21_000_000);
    expect(btcSupply(500_001)).toBeGreaterThan(btcSupply(500_000));
    expect(() => btcSupply(-1)).toThrow(RangeError);
  });
});
