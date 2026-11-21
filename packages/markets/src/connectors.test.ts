import { describe, expect, it } from "vitest";
import { connector, MARKET_CONNECTORS, ProviderRefused, quarterEnd, rocToIso, SchemaChanged, updatedOn } from "./connectors/index.ts";
import { c1Layout, c3Layout, fredLayout, o3Layout, s3Layout, s7Layout, treasuryLayout, twseLayout, worldBankLayout, x4Layout } from "./fixtures/layouts.ts";
import { FIXTURE_TICKERS, FIXTURE_TODAY } from "./fixtures/series.ts";
import type { FetchContext, MarketConnector, RawArtifact } from "./types.ts";
import { readZip, writeStoredZip, ZipError } from "./zip.ts";

const parseCtx = { now: `${FIXTURE_TODAY}T22:00:00Z`, windowStart: "2024-12-22" };
const get = (id: string): MarketConnector => {
  const c = connector(id);
  if (!c) throw new Error(id);
  return c;
};
const enc = (s: string) => new TextEncoder().encode(s);
const raw = (name: string, body: string): RawArtifact[] => [{ name, bytes: enc(body), fetchedAt: parseCtx.now }];

describe("market connectors: metadata (R14, R17)", () => {
  it("fetch only from their official hosts, and the licensed ones store only in connector-cache.db", () => {
    for (const c of MARKET_CONNECTORS) {
      for (const h of c.fetchHosts) expect(c.meta.officialHosts, c.meta.id).toContain(h);
      if (c.meta.licence.startsWith("provider-") && c.meta.licence !== "provider-display-o3") {
        expect(c.meta.storage, c.meta.id).toBe(c.meta.id === "crypto-o3-btc-height" ? "store" : "connector-cache");
      }
    }
    expect(get("us-fred-cited").meta.storage).toBe("connector-cache");
    expect(get("us-fred-open").meta.storage).toBe("store");
  });

  it("have a field map that fills every item they declare, and declare a purge scope", () => {
    for (const c of MARKET_CONNECTORS) {
      const mapped = new Set(c.fieldMap.map((e) => e.itemId).filter(Boolean));
      expect([...mapped].sort(), c.meta.id).toEqual([...c.meta.items].sort());
      expect(["window", "none"]).toContain(c.meta.purgeScope);
      expect(c.meta.purgeScope === "none" ? c.meta.maxPurgeShare : 0.02, c.meta.id).toBe(c.meta.maxPurgeShare);
    }
  });

  it("change the parser version when the item list changes (A1)", () => {
    const ids = new Set(MARKET_CONNECTORS.map((c) => c.parserVersion));
    expect(ids.size).toBe(MARKET_CONNECTORS.length);
  });
});

describe("official sources parse their measured layouts", () => {
  it("Treasury: every row, with the as-of from the latest record date", () => {
    const c = get("us-treasury-debt");
    const p = c.parse(treasuryLayout(), parseCtx);
    const obs = p.series[0]?.observations ?? [];
    expect(obs.at(-1)?.date).toBe(FIXTURE_TODAY);
    expect((obs[0]?.date ?? "") < (obs.at(-1)?.date ?? "")).toBe(true);
    expect(c.asOf(treasuryLayout())).toEqual({ max_date_in_data: FIXTURE_TODAY });
    expect(() => c.parse(raw("debt_to_penny.json", "{}"), parseCtx)).toThrow(SchemaChanged);
  });

  it("FRED: holidays dropped and counted, quarters stored by their end, Z.1 millions scaled to dollars", () => {
    const c = get("us-fred-open");
    const p = c.parse(fredLayout(["BOGZ1LM893064105Q", "DCOILBRENTEU", "DCOILWTICO"]), parseCtx);
    const brent = p.series.find((s) => s.series.seriesKey === "fred:DCOILBRENTEU");
    expect(brent?.observations?.length).toBeGreaterThan(400);
    expect(p.dropped.some((d) => d.reason === "market_missing_value" && d.field === "DCOILBRENTEU")).toBe(true);
    const z1 = p.series.find((s) => s.series.seriesKey === "fred:BOGZ1LM893064105Q")?.observations ?? [];
    expect(z1.every((o) => /-(03-31|06-30|09-30|12-31)$/.test(o.date))).toBe(true);
    expect(z1[0]?.value).toBeGreaterThan(1e12);
    expect(quarterEnd("2026-04-01")).toBe("2026-06-30");
    expect(() => c.parse(raw("DCOILBRENTEU.csv", "<html>"), parseCtx)).toThrow(SchemaChanged);
  });

  it("TWSE: ROC dates and thousands separators", () => {
    expect(rocToIso("1151118")).toBe("2026-11-18");
    expect(rocToIso("1151340")).toBeNull();
    const obs = get("tw-twse-index").parse(twseLayout(), parseCtx).series[0]?.observations ?? [];
    expect(obs.at(-1)?.date).toBe(FIXTURE_TODAY);
    expect(obs.every((o) => o.value > 1000)).toBe(true);
  });

  it("World Bank: the gold column by its name, the ellipsis as missing, and the as-of from A4", () => {
    const c = get("intl-worldbank-pinksheet");
    expect(updatedOn("Updated on November 03, 2026")).toBe("2026-11-03");
    expect(c.asOf(worldBankLayout())).toEqual({ in_file_field: "2026-11-03" });
    const p = c.parse(worldBankLayout(), parseCtx);
    expect(p.series[0]?.observations?.every((o) => o.date >= parseCtx.windowStart && /-\d{2}$/.test(o.date))).toBe(true);
    expect(p.dropped).toContainEqual({ reason: "market_missing_value", field: "Gold" });
    expect(() => c.parse(worldBankLayout(4, { goldHeader: "Silver" }), parseCtx)).toThrow(/no Gold column/);
    expect(() => c.parse(worldBankLayout(4, { goldUnit: "($/kg)" }), parseCtx)).toThrow(/troy oz/);
  });
});

describe("price connectors parse their documented or measured layouts", () => {
  it("S7: one series per filled slot, with its symbol, from adjusted closes", () => {
    const p = get("stocks-s7").parse(s7Layout(2), parseCtx);
    expect(p.series.map((s) => [s.series.seriesKey, s.series.symbol])).toEqual([
      ["s7:slot:M01.us_total", FIXTURE_TICKERS[0]],
      ["s7:slot:M01.us_large", FIXTURE_TICKERS[1]],
    ]);
  });

  it("S7: asks for nothing without a key, and never puts the key in an artifact name", async () => {
    const calls: string[] = [];
    const ctx: FetchContext = {
      fetch: async (url) => (calls.push(url), { status: 200, headers: {}, bytes: enc("[]") }),
      keys: {},
      now: parseCtx.now,
      windowStart: parseCtx.windowStart,
      slots: [{ slot: "M02.europe", symbol: "ZZFX04" }],
      mode: "daily",
    };
    expect(await get("stocks-s7").fetch(ctx)).toEqual([]);
    const fetched = await get("stocks-s7").fetch({ ...ctx, keys: { MARKETS_S7_API_KEY: "fixture-key-000" } });
    expect(calls).toHaveLength(1);
    expect(fetched.map((a) => a.name)).toEqual(["M02.europe|ZZFX04.json"]);
  });

  it("S3: reads the data array, and treats an Information body as a rate limit, not data", () => {
    const c = get("gold-s3");
    expect(c.parse(s3Layout(), parseCtx).series[0]?.observations?.at(-1)?.date).toBe(FIXTURE_TODAY);
    expect(() => c.parse(raw("gold.json", JSON.stringify({ Information: "limit" })), parseCtx)).toThrow(ProviderRefused);
  });

  it("X4: daily candles by UTC day, and the latest quote with its time", () => {
    const c = get("crypto-x4-ohlc");
    const daily = c.parse(x4Layout("daily"), parseCtx);
    expect(daily.series.map((s) => s.series.seriesKey)).toEqual(["x4:btcusd", "x4:ethusd"]);
    expect(daily.series[0]?.observations?.at(-1)?.date).toBe(FIXTURE_TODAY);
    const latest = c.parse(x4Layout("latest"), parseCtx);
    expect(latest.series[0]?.latest?.observedAt).toBe(`${FIXTURE_TODAY}T22:00:00.000Z`);
    expect(latest.series[0]?.observations).toBeUndefined();
  });

  it("X4: pages forward when the window is longer than 1,000 days", async () => {
    const urls: string[] = [];
    const ctx: FetchContext = {
      fetch: async (url) => (urls.push(url), { status: 200, headers: {}, bytes: enc('{"data":{"ohlc":[]}}') }),
      keys: {},
      now: "2026-11-18T00:00:00Z",
      windowStart: "2023-01-01",
      slots: [],
      mode: "daily",
    };
    await get("crypto-x4-ohlc").fetch(ctx);
    expect(urls.filter((u) => u.includes("btcusd"))).toHaveLength(2);
  });

  it("O3: supply from the header's height, the as-of from its block time; the fallback host on failure", async () => {
    const c = get("crypto-o3-btc-height");
    const p = c.parse(o3Layout(209_999), parseCtx);
    expect(p.series[0]?.latest?.value).toBe(10_500_000);
    expect(c.asOf(o3Layout())).toEqual({ in_file_field: `${FIXTURE_TODAY}T22:00:00.000Z` });
    const urls: string[] = [];
    const ctx: FetchContext = {
      fetch: async (url) => {
        urls.push(url);
        if (url.includes("publicnode")) throw new Error("down");
        if (url.endsWith("/tip/hash")) return { status: 200, headers: {}, bytes: enc("a".repeat(64)) };
        return { status: 200, headers: {}, bytes: enc(JSON.stringify({ height: 5, timestamp: 1_763_500_000 })) };
      },
      keys: {},
      now: parseCtx.now,
      windowStart: parseCtx.windowStart,
      slots: [],
      mode: "daily",
    };
    const fetched = await c.fetch(ctx);
    expect(urls.some((u) => u.startsWith("https://mempool.space/api/block/"))).toBe(true);
    expect(c.parse(fetched, parseCtx).series[0]?.latest?.value).toBe(300);
  });

  it("C1: the total cap and the ether supply; a keyless refusal is a provider error, not data", () => {
    const c = get("crypto-c1");
    const p = c.parse(c1Layout("daily"), parseCtx);
    expect(p.series.map((s) => s.series.seriesKey)).toEqual(["c1:total_cap", "c1:eth_supply"]);
    expect(p.series.every((s) => s.observations === undefined)).toBe(true);
    expect(() => c.parse(raw("global.json", JSON.stringify({ status: { error_code: 10005 } })), parseCtx)).toThrow(ProviderRefused);
  });

  it("C1: sends the optional demo key as a header, only when it is set", async () => {
    const headers: (Record<string, string> | undefined)[] = [];
    const ctx: FetchContext = {
      fetch: async (_url, init) => (headers.push(init?.headers), { status: 200, headers: {}, bytes: enc("{}") }),
      keys: {},
      now: parseCtx.now,
      windowStart: parseCtx.windowStart,
      slots: [],
      mode: "latest",
    };
    await get("crypto-c1").fetch(ctx);
    await get("crypto-c1").fetch({ ...ctx, keys: { MARKETS_C1_DEMO_KEY: "fixture-demo" } });
    expect(headers).toEqual([undefined, { "x-cg-demo-api-key": "fixture-demo" }]);
  });

  it("C3: the all-time high as the peak seed", () => {
    expect(get("crypto-c3-global").parse(c3Layout(), parseCtx).series[0]?.latest).toEqual({ value: 4e12, observedAt: "2025-10-06T00:00:00.000Z" });
  });
});

describe("the zip reader (World Bank workbook)", () => {
  it("round-trips stored entries and refuses what is not a zip", () => {
    const files = new Map([["a.txt", enc("hello")]]);
    expect(new TextDecoder().decode(readZip(writeStoredZip(files)).get("a.txt"))).toBe("hello");
    expect(() => readZip(enc("not a zip"))).toThrow(ZipError);
  });
});
