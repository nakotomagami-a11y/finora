import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CrashResponse } from "@finora/api-contract";
import { describe, expect, it } from "vitest";
import { asOfText, buildPageView, formatAsOfDate, formatDollars, formatDrawdown, formatMarketValue, formatMoneyAmount, rowLabelId, tickerValue } from "./model.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const fixture = (name: string) => buildPageView(CrashResponse.parse(JSON.parse(readFileSync(join(ROOT, "fixtures", "ui", "crash", `${name}.json`), "utf8"))));

describe("buildPageView", () => {
  it("puts the tiles in page order, each with its lead row", () => {
    const page = fixture("live");
    expect(page.tiles.map((t) => t.id)).toEqual(["M01", "M03", "M05", "M06", "M07"]);
    expect(page.tiles.map((t) => t.lead?.rowKey)).toEqual(["M01.X.01:us_equities", "M03.X.01:japan", "M05.X.01:gold_monthly", "M06.X.02:total_crypto", "M07.X.01:wti"]);
    expect(page.tiles[0]?.rows.map((r) => r.labelId)).toEqual(["us_large", "us_broad", "us_tech"]);
    expect(page.debt?.itemId).toBe("M08.X.01");
  });

  it("sorts the strip by drop, biggest first, and leaves the debt out", () => {
    const strip = fixture("live").strip;
    const drops = strip.flatMap((r) => (r.kind === "drop" ? [r.drawdownPct] : []));
    expect(drops).toEqual([...drops].sort((a, b) => a - b));
    expect(strip[0]?.labelId).toBe("ether");
    expect(strip.some((r) => r.labelId === "us_debt")).toBe(false);
  });

  it("never carries a number for a row that is not configured, errored, loading or without a known peak", () => {
    for (const name of ["not-configured", "error", "mixed", "peak-unknown"]) {
      const page = fixture(name);
      for (const row of page.tiles.flatMap((t) => t.all)) {
        if (row.state === "ok" || row.state === "stale") continue;
        expect(row.drawdownPct, `${name} ${row.rowKey}`).toBeUndefined();
        expect(row.valueLostUsd, `${name} ${row.rowKey}`).toBeUndefined();
      }
      for (const row of page.strip) if (row.kind === "peak_unknown") expect(Object.keys(row)).not.toContain("drawdownPct");
    }
  });

  it("never shows an index level: a cited index series is drawdown only", () => {
    const page = fixture("live");
    for (const row of page.tiles.flatMap((t) => t.all).filter((r) => r.unit === "index_points")) {
      expect(row.value, row.rowKey).toBeUndefined();
      expect(row.peak?.value, row.rowKey).toBeUndefined();
    }
  });

  it("lists the providers a tile still needs, as codes, once each", () => {
    const tiles = fixture("not-configured").tiles;
    expect(tiles.find((t) => t.id === "M06")?.missingProviders).toEqual(["C1", "X4"]);
    expect(tiles.find((t) => t.id === "M06")?.allNotConfigured).toBe(true);
    expect(tiles.find((t) => t.id === "M01")?.missingProviders).toEqual(["F1", "F2", "F3"]);
    expect(tiles.find((t) => t.id === "M01")?.allNotConfigured).toBe(false);
  });

  it("flags stale and failed pages, and says when everything is still loading", () => {
    expect(fixture("live").stale).toBe(false);
    expect(fixture("stale").stale).toBe(true);
    expect(fixture("error").failed).toBe(true);
    expect(fixture("mixed").stale).toBe(true);
  });

  it("shows the value-below-peaks summary over the rows it has, and names what was left out", () => {
    const live = fixture("live").wiped;
    expect(live?.counted.map((c) => c.labelId)).toEqual(["us_equities", "total_crypto"]);
    expect(live?.includesCrypto).toBe(true);
    expect(live?.excluded).toEqual([]);
    // A row left out for lack of a value is named as left out, never as counted.
    const error = fixture("error").wiped;
    expect(error?.counted.map((c) => c.labelId)).toEqual(["us_equities"]);
    expect(error?.includesCrypto).toBe(false);
    expect(error?.excluded).toEqual(["total_crypto"]);
    // Crypto is not configured, but the quarterly US row still allows a value: the total shows, over that one row.
    const notConfigured = fixture("not-configured").wiped;
    expect(notConfigured?.valueUsd).toBe(4_700_000_000_000);
    expect(notConfigured?.counted.map((c) => c.labelId)).toEqual(["us_equities"]);
  });

  it("finds the latest time any row was refreshed", () => {
    expect(fixture("live").updatedAt).toBeDefined();
  });

  it("collects each tile's attribution lines, once, as plain text", () => {
    const tile = fixture("live").tiles.find((t) => t.id === "M01");
    expect(tile?.attributions).toHaveLength(2); // the official row's line and the one personal-use line the three daily rows share
    expect(tile?.attributions.some((line) => line.startsWith("For personal use only."))).toBe(true);
  });
});

describe("rowLabelId", () => {
  it("strips the catalogue prefix", () => {
    expect(rowLabelId("crash.rows.us_large")).toBe("us_large");
    expect(rowLabelId("us_large")).toBe("us_large");
  });
});

describe("formatDrawdown", () => {
  it("uses a real minus sign, one decimal and the locale's decimal mark", () => {
    expect(formatDrawdown("en", -12.4).text).toBe("−12.4%");
    expect(formatDrawdown("lv", -12.4).text).toBe("−12,4%");
    expect(formatDrawdown("en", -3).text).toBe("−3.0%");
  });

  it("never reads 0%: a real drop too small for a decimal is flagged, and no drop is 'at peak'", () => {
    expect(formatDrawdown("en", -0.04)).toEqual({ text: "", tiny: true, atPeak: false });
    expect(formatDrawdown("en", 0)).toMatchObject({ atPeak: true, tiny: false });
    expect(formatDrawdown("en", -0.06).text).toBe("−0.1%");
  });
});

describe("money and values", () => {
  it("writes a market size as an amount and a scale, one decimal for trillions", () => {
    expect(formatMoneyAmount("en", 5.88e12)).toEqual({ scale: "trillion", amount: "5.9" });
    expect(formatMoneyAmount("lv", 1.2e12)).toEqual({ scale: "trillion", amount: "1,2" });
    expect(formatMoneyAmount("en", 660e9)).toEqual({ scale: "billion", amount: "660" });
    expect(formatMoneyAmount("en", 250e6)).toEqual({ scale: "million", amount: "250" });
  });

  it("writes whole dollars with grouping for the debt card", () => {
    expect(formatDollars("en", 38_610_227_451_903.4)).toBe("$38,610,227,451,903");
  });

  it("writes prices for the text alternative, and never an index level", () => {
    expect(formatMarketValue("en", "usd", 71_000)).toBe("$71,000");
    expect(formatMarketValue("en", "usd_per_bbl", 66)).toBe("$66/bbl");
    expect(formatMarketValue("en", "usd_per_oz", 2910)).toBe("$2,910/oz");
    expect(formatMarketValue("en", "index_points", 5000)).toBeUndefined();
    expect(formatMarketValue("en", "usd", undefined)).toBeUndefined();
  });
});

describe("asOfText", () => {
  const now = new Date("2026-11-20T12:00:00Z");

  it("writes a quarter, a month, a day or a time by the row's cadence", () => {
    expect(asOfText("en", "quarterly", "2026-06-30", now)).toEqual({ kind: "quarter", text: "Q2 2026" });
    expect(asOfText("en", "monthly", "2026-10-31", now)).toEqual({ kind: "month", text: "Oct 2026" });
    expect(asOfText("en", "daily_exchange", "2026-11-18", now)).toEqual({ kind: "day", text: "18 Nov 2026" });
    expect(asOfText("en", "live", "2026-11-19T09:55:00Z", now, "UTC").kind).toBe("day");
  });

  it("shows only the time for a live figure from today", () => {
    expect(asOfText("en", "live", "2026-11-20T09:55:00Z", now, "UTC").kind).toBe("time");
  });

  it("uses the user's local time for a live figure, in the same zone for the day test, the time and the date", () => {
    // 23:30 UTC on the 19th is 01:30 on the 20th in Riga (UTC+2): the same local day as now (14:00 on the 20th there).
    expect(asOfText("en", "live", "2026-11-19T23:30:00Z", now, "Europe/Riga")).toEqual({ kind: "time", text: "01:30" });
    // In UTC the same figure is from the day before, and its date is the 19th.
    expect(asOfText("en", "live", "2026-11-19T23:30:00Z", now, "UTC")).toEqual({ kind: "day", text: "19 Nov 2026" });
    // The date of a figure from the previous local day is that local day, not the UTC date: 23:30 on the 19th in New York is the 20th in UTC.
    expect(asOfText("en", "live", "2026-11-20T04:30:00Z", new Date("2026-11-21T20:00:00Z"), "America/New_York")).toEqual({ kind: "day", text: "19 Nov 2026" });
  });

  it("writes a date on its own as that calendar day, in any zone, and a moment in the given zone", () => {
    expect(formatAsOfDate("en", "2026-11-18", "America/New_York")).toBe("18 Nov 2026");
    expect(formatAsOfDate("en", "2026-11-20T04:30:00Z", "America/New_York")).toBe("19 Nov 2026");
    expect(formatAsOfDate("en", "nonsense")).toBe("—");
  });

  it("is empty for a missing or unreadable date, never a thrown error", () => {
    expect(asOfText("en", "daily_exchange", undefined, now)).toEqual({ kind: "none" });
    expect(asOfText("en", "daily_exchange", "not a date", now)).toEqual({ kind: "none" });
  });
});

describe("tickerValue", () => {
  it("adds the per-second drift to the official total, from its anchor, in whole dollars", () => {
    const ticker = { total: 1_000_000, anchor: "2026-11-18T21:00:00Z", perSecond: 76.4 };
    expect(tickerValue(ticker, new Date("2026-11-18T21:00:00Z"))).toBe(1_000_000);
    expect(tickerValue(ticker, new Date("2026-11-18T21:00:10Z"))).toBe(1_000_764);
  });

  it("never runs backwards before its anchor", () => {
    expect(tickerValue({ total: 5, anchor: "2026-11-18T21:00:00Z", perSecond: 100 }, new Date("2026-11-17T00:00:00Z"))).toBe(5);
  });
});

describe("the strip, at its edges", () => {
  const live = CrashResponse.parse(JSON.parse(readFileSync(join(ROOT, "fixtures", "ui", "crash", "live.json"), "utf8")));
  const withRow = (rowKey: string, change: Record<string, unknown>) => {
    const copy = structuredClone(live);
    for (const tile of copy.tiles) for (const row of tile.rows) if (row.rowKey.endsWith(rowKey)) Object.assign(row, change);
    return buildPageView(copy);
  };

  it("lists a market exactly at its peak as 'at peak', after the drops", () => {
    const page = withRow("us_tech", { drawdownPct: 0, valueLostUsd: undefined });
    const row = page.strip.find((r) => r.labelId === "us_tech");
    expect(row?.kind).toBe("at_peak");
    const kinds = page.strip.map((r) => r.kind);
    expect(kinds.lastIndexOf("drop")).toBeLessThan(kinds.indexOf("at_peak"));
    expect(page.strip).toHaveLength(live.tiles.flatMap((t) => t.rows).length - 1); // every row but the debt is listed
  });

  it("shows a drawdown above zero as a row that was not checked, never as a drop and never gone", () => {
    const page = withRow("brent", { drawdownPct: 3.2 });
    expect(page.strip.find((r) => r.labelId === "brent")?.kind).toBe("error");
    expect(page.tiles.flatMap((t) => t.all).find((r) => r.labelId === "brent")).toMatchObject({ state: "error", drawdownPct: undefined, valueLostUsd: undefined });
    expect(page.failed).toBe(true);
  });

  it("lists a row that failed to load as failed, last, and a provider not configured before it", () => {
    const kinds = fixture("error").strip.map((r) => r.kind);
    expect(kinds).toContain("error");
    expect(kinds.indexOf("error")).toBeGreaterThan(kinds.lastIndexOf("drop"));
    const mixed = fixture("not-configured").strip.map((r) => r.kind);
    expect(mixed.filter((k) => k === "not_configured")).toHaveLength(8); // three daily US rows, Japan, Taiwan, bitcoin, ether, total crypto
    expect(mixed.indexOf("not_configured")).toBeGreaterThan(mixed.lastIndexOf("drop"));
  });

  it("marks a drawdown above zero as failed because of a data check, not because the source did not answer", () => {
    const page = withRow("brent", { drawdownPct: 3.2 });
    expect(page.strip.find((r) => r.labelId === "brent")).toMatchObject({ kind: "error", invalid: true });
    expect(fixture("error").strip.find((r) => r.kind === "error")).toMatchObject({ invalid: false });
  });

  it("leaves out a market size that would read '0 million'", () => {
    const small = withRow("brent", { valueLostUsd: 400_000 });
    expect(small.tiles.flatMap((t) => t.all).find((r) => r.labelId === "brent")?.valueLostUsd).toBeUndefined();
    const copy = structuredClone(live);
    copy.totalWiped = { ...copy.totalWiped!, valueUsd: 300_000 };
    expect(buildPageView(copy).wiped).toBeUndefined();
    const fine = structuredClone(live);
    fine.totalWiped = { ...fine.totalWiped!, valueUsd: 500_000 };
    expect(buildPageView(fine).wiped?.valueUsd).toBe(500_000);
  });
});
