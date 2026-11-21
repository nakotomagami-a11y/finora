import { describe, expect, it } from "vitest";
import { connector, marketConnectors, ProviderRefused, quarterEnd, rocToIso, SchemaChanged, updatedOn } from "./connectors/index.ts";
import { fixtureProviders } from "./fixtures/fake-fetch.ts";
import { c1Layout, c3Layout, fredLayout, o3Layout, treasuryLayout, twLayout, worldBankLayout, x4Layout } from "./fixtures/layouts.ts";
import { FIXTURE_TODAY } from "./fixtures/series.ts";
import type { FetchContext, MarketConnector, RawArtifact } from "./types.ts";

const parseCtx = { now: `${FIXTURE_TODAY}T22:00:00Z`, windowStart: "2024-12-22" };
const PROVIDERS = fixtureProviders();
const MARKET_CONNECTORS = marketConnectors(PROVIDERS);
const get = (id: string): MarketConnector => {
  const c = connector(id, PROVIDERS);
  if (!c) throw new Error(id);
  return c;
};
const enc = (s: string) => new TextEncoder().encode(s);
const raw = (name: string, body: string): RawArtifact[] => [{ name, bytes: enc(body), fetchedAt: parseCtx.now }];

describe("market connectors: metadata (R14, R17)", () => {
  it("fetch only from their official hosts, and the licensed ones store only in connector-cache.db", () => {
    for (const c of MARKET_CONNECTORS) for (const h of c.fetchHosts) expect(c.meta.officialHosts, c.meta.id).toContain(h);
    for (const id of ["crypto-x4-ohlc", "crypto-c1", "crypto-c3-global", "us-fred-cited"]) expect(get(id).meta.storage, id).toBe("connector-cache");
    expect(get("us-fred-open").meta.storage).toBe("store");
    expect(get("crypto-o3-btc-height").meta.storage).toBe("store");
  });

  it("builds no provider connector without the local provider file (H4)", () => {
    expect(marketConnectors({}).map((c) => c.meta.id).sort()).toEqual(["intl-worldbank-pinksheet", "us-fred-open", "us-treasury-debt"]);
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

  it("tw: ROC dates and thousands separators", () => {
    expect(rocToIso("1151118")).toBe("2026-11-18");
    expect(rocToIso("1151340")).toBeNull();
    const obs = get("tw-broad-index").parse(twLayout(), parseCtx).series[0]?.observations ?? [];
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

describe("provider connectors parse their measured layouts", () => {
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
      now: "2026-11-18T00:00:00Z",
      windowStart: "2023-01-01",
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
        if (url.endsWith("/rpc")) throw new Error("down");
        if (url.endsWith("/tip/hash")) return { status: 200, headers: {}, bytes: enc("a".repeat(64)) };
        return { status: 200, headers: {}, bytes: enc(JSON.stringify({ height: 5, timestamp: 1_763_500_000 })) };
      },
      now: parseCtx.now,
      windowStart: parseCtx.windowStart,
      mode: "daily",
    };
    const fetched = await c.fetch(ctx);
    expect(urls.some((u) => u.includes("/block/"))).toBe(true);
    expect(c.parse(fetched, parseCtx).series[0]?.latest?.value).toBe(300);
  });

  it("C1: the total cap and the ether supply; a keyless refusal is a provider error, not data", () => {
    const c = get("crypto-c1");
    const p = c.parse(c1Layout("daily"), parseCtx);
    expect(p.series.map((s) => s.series.seriesKey)).toEqual(["c1:total_cap", "c1:eth_supply"]);
    expect(p.series.every((s) => s.observations === undefined)).toBe(true);
    expect(() => c.parse(raw("global.json", JSON.stringify({ status: { error_code: 10005 } })), parseCtx)).toThrow(ProviderRefused);
  });

  it("C3: the all-time high as the peak seed", () => {
    expect(get("crypto-c3-global").parse(c3Layout(), parseCtx).series[0]?.latest).toEqual({ value: 4e12, observedAt: "2025-10-06T00:00:00.000Z" });
  });
});
