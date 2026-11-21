// Price connectors (loaders/markets.md Part 2). Fund slots and daily gold need the user's own key;
// crypto prices come from an exchange's public API, bitcoin's supply from block height over a
// public RPC, and the total crypto market from two aggregators. Licensed values are stored only in
// connector-cache.db (R17).
import { btcSupply } from "../btc-supply.ts";
import { fundSeriesKey, TILE_ROWS } from "../tiles.ts";
import { FUND_SLOTS, type FundSlot } from "../settings.ts";
import type { FetchContext, MarketConnector, MarketParse, Observation, ParsedSeries, RawArtifact } from "../types.ts";
import { artifact, concept, epochIso, epochSeconds, isoDay, isRecord, jsonOf, maxOf, notRead, num, parserVersion, ProviderRefused, SchemaChanged, textOf } from "./common.ts";

const tilesOf = (sourceId: string) => TILE_ROWS.filter((r) => r.sourceId === sourceId);
const art = (ctx: FetchContext, name: string, r: { bytes: Uint8Array; headers: Record<string, string> }): RawArtifact => ({ name, bytes: r.bytes, headers: r.headers, fetchedAt: ctx.now });

// ---------------------------------------------------------------- S7: fund closes with the user's key

export const S7_KEY = "MARKETS_S7_API_KEY";
const s7Items = ["M01.X.02", "M02.X.01", "M03.X.02", "M04.X.01"];
const slotItem = (slot: FundSlot) => tilesOf("stocks-s7").find((r) => r.slot === slot)?.itemId ?? "";
const s7Map = [concept("date", "market.date", "M01.X.02"), ...s7Items.map((i) => concept("adjClose", "market.value", i)), notRead("close"), notRead("volume")];

export const stocksS7: MarketConnector = {
  meta: {
    id: "stocks-s7",
    country: "intl",
    publisher: "Stock price provider S7 (your own key)",
    homepage: "https://www.tiingo.com/",
    officialHosts: ["api.tiingo.com", "www.tiingo.com"],
    licence: "provider-personal-s7",
    attribution: "Data sourced by Tiingo",
    storage: "connector-cache",
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["max_date_in_data"],
    maxPurgeShare: 0,
    purgeScope: "none",
    deepLink: null,
    orderUrl: null,
    requires: [S7_KEY],
    limits: { dailyRequests: 1000 },
    items: s7Items,
  },
  parserVersion: parserVersion("stocks-s7", 1, s7Map, s7Items, tilesOf("stocks-s7")),
  fieldMap: s7Map,
  fetchHosts: ["api.tiingo.com"],
  async fetch(ctx) {
    const key = ctx.keys[S7_KEY];
    if (!key) return [];
    const out: RawArtifact[] = [];
    for (const { slot, symbol } of ctx.slots) {
      const r = await ctx.fetch(`https://api.tiingo.com/tiingo/daily/${encodeURIComponent(symbol)}/prices?startDate=${ctx.windowStart}&format=json&token=${encodeURIComponent(key)}`);
      // The artifact is named by slot and symbol, never by URL: the key never reaches a file name or a log.
      out.push(art(ctx, `${slot}|${symbol}.json`, r));
    }
    return out;
  },
  asOf(raw) {
    return { max_date_in_data: maxOf(raw.flatMap((a) => s7Rows(a).map((r) => isoDay(r.date)))) };
  },
  parse(raw) {
    const dropped: MarketParse["dropped"] = [];
    const series: ParsedSeries[] = [];
    for (const a of raw) {
      const [slot, symbol] = a.name.replace(/\.json$/, "").split("|") as [FundSlot, string];
      if (!(FUND_SLOTS as readonly string[]).includes(slot)) continue;
      const observations: Observation[] = [];
      for (const r of s7Rows(a)) {
        const date = isoDay(r.date);
        const value = num(r.adjClose);
        if (!date || value === null || value <= 0) {
          dropped.push({ reason: "market_invalid_value", field: "adjClose" });
          continue;
        }
        observations.push({ date, value });
      }
      series.push({ series: { seriesKey: fundSeriesKey(slot), itemId: slotItem(slot), unit: "usd", frequency: "daily_exchange", symbol }, observations });
    }
    return { series, dropped };
  },
};

function s7Rows(a: RawArtifact): Record<string, unknown>[] {
  const body = jsonOf(a);
  if (!Array.isArray(body)) throw new SchemaChanged("s7 daily prices: not an array");
  return body.filter(isRecord);
}

// ---------------------------------------------------------------- S3: daily gold with the user's key

export const S3_KEY = "MARKETS_S3_API_KEY";
const s3Items = ["M05.X.02b"];
const s3Map = [concept("data[].date", "market.date", "M05.X.02b"), concept("data[].value", "market.value", "M05.X.02b")];

export const goldS3: MarketConnector = {
  meta: {
    id: "gold-s3",
    country: "intl",
    publisher: "Commodity price provider S3 (your own key)",
    homepage: "https://www.alphavantage.co/",
    officialHosts: ["www.alphavantage.co"],
    licence: "provider-personal-s3",
    attribution: null,
    storage: "connector-cache",
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["max_date_in_data"],
    maxPurgeShare: 0,
    purgeScope: "none",
    deepLink: null,
    orderUrl: null,
    requires: [S3_KEY],
    limits: { dailyRequests: 25 },
    items: s3Items,
  },
  parserVersion: parserVersion("gold-s3", 1, s3Map, s3Items, tilesOf("gold-s3")),
  fieldMap: s3Map,
  fetchHosts: ["www.alphavantage.co"],
  async fetch(ctx) {
    const key = ctx.keys[S3_KEY];
    if (!key) return [];
    const r = await ctx.fetch(`https://www.alphavantage.co/query?function=GOLD_SILVER_HISTORY&symbol=XAU&interval=daily&apikey=${encodeURIComponent(key)}`);
    return [art(ctx, "gold.json", r)];
  },
  asOf(raw) {
    return { max_date_in_data: maxOf(s3Rows(raw).map((r) => isoDay(r.date))) };
  },
  parse(raw, ctx) {
    const dropped: MarketParse["dropped"] = [];
    const observations: Observation[] = [];
    for (const r of s3Rows(raw)) {
      const date = isoDay(r.date);
      const value = num(r.value ?? r.price);
      if (!date || value === null || value <= 0) {
        dropped.push({ reason: "market_invalid_value", field: "value" });
        continue;
      }
      if (date >= ctx.windowStart) observations.push({ date, value });
    }
    observations.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { series: [{ series: { seriesKey: "s3:gold", itemId: "M05.X.02b", unit: "usd_per_oz", frequency: "daily_7d" }, observations }], dropped };
  },
};

/** The provider answers a rate limit with HTTP 200 and an `Information` or `Note` body, never data. */
function s3Rows(raw: readonly RawArtifact[]): Record<string, unknown>[] {
  const body = jsonOf(artifact(raw, "gold.json"));
  if (isRecord(body) && (typeof body.Information === "string" || typeof body.Note === "string")) throw new ProviderRefused("rate_limited", "gold-s3: the provider refused the request");
  if (!isRecord(body) || !Array.isArray(body.data)) throw new SchemaChanged("gold-s3: no data array");
  return body.data.filter(isRecord);
}

// ---------------------------------------------------------------- X4: bitcoin and ether candles

const PAIRS = [
  { pair: "btcusd", seriesKey: "x4:btcusd" },
  { pair: "ethusd", seriesKey: "x4:ethusd" },
] as const;
const x4Items = ["M06.X.01b"];
const x4Map = [concept("data.ohlc[].timestamp", "market.date", "M06.X.01b"), concept("data.ohlc[].close", "market.value", "M06.X.01b"), notRead("open"), notRead("high"), notRead("low"), notRead("volume")];
/** One call returns at most 1,000 candles; a longer window pages forward from its start. */
export const X4_PAGE = 1000;

export const cryptoX4: MarketConnector = {
  meta: {
    id: "crypto-x4-ohlc",
    country: "intl",
    publisher: "Crypto exchange X4 (public market data)",
    homepage: "https://www.bitstamp.net/api/",
    officialHosts: ["www.bitstamp.net"],
    licence: "provider-derived-x4",
    attribution: null,
    storage: "connector-cache",
    cadence: "daily",
    publishedAtUtc: "00:05",
    asOf: ["max_date_in_data"],
    maxPurgeShare: 0,
    purgeScope: "none",
    deepLink: null,
    orderUrl: null,
    requires: [],
    limits: { requestsPerSecond: 1 },
    items: x4Items,
  },
  parserVersion: parserVersion("crypto-x4-ohlc", 1, x4Map, x4Items, tilesOf("crypto-x4-ohlc")),
  fieldMap: x4Map,
  fetchHosts: ["www.bitstamp.net"],
  async fetch(ctx) {
    const out: RawArtifact[] = [];
    for (const { pair } of PAIRS) {
      if (ctx.mode === "latest") {
        out.push(art(ctx, `${pair}.latest.json`, await ctx.fetch(`https://www.bitstamp.net/api/v2/ohlc/${pair}/?step=300&limit=1`)));
        continue;
      }
      const end = epochSeconds(ctx.now);
      for (let start = epochSeconds(ctx.windowStart), page = 0; start <= end; start += X4_PAGE * 86_400, page++) {
        out.push(art(ctx, `${pair}.daily.${page}.json`, await ctx.fetch(`https://www.bitstamp.net/api/v2/ohlc/${pair}/?step=86400&limit=${X4_PAGE}&start=${start}`)));
      }
    }
    return out;
  },
  asOf(raw) {
    return { max_date_in_data: maxOf(raw.flatMap((a) => x4Rows(a).map((r) => r.at))) };
  },
  parse(raw) {
    const dropped: MarketParse["dropped"] = [];
    const series: ParsedSeries[] = [];
    for (const { pair, seriesKey } of PAIRS) {
      const def = { seriesKey, itemId: "M06.X.01b", unit: "usd" as const, frequency: "daily_7d" as const };
      const daily = new Map<string, number>();
      let latest: ParsedSeries["latest"];
      for (const a of raw.filter((r) => r.name.startsWith(`${pair}.`))) {
        for (const row of x4Rows(a)) {
          if (row.value === null) {
            dropped.push({ reason: "market_invalid_value", field: "close" });
            continue;
          }
          if (a.name.includes(".latest.")) latest = { value: row.value, observedAt: row.at };
          else daily.set(row.at.slice(0, 10), row.value);
        }
      }
      const observations = [...daily].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, value]) => ({ date, value }));
      series.push({ series: def, ...(daily.size ? { observations } : {}), ...(latest ? { latest } : {}) });
    }
    return { series, dropped };
  },
};

function x4Rows(a: RawArtifact): { at: string; value: number | null }[] {
  const body = jsonOf(a);
  const ohlc = isRecord(body) && isRecord(body.data) ? body.data.ohlc : undefined;
  if (!Array.isArray(ohlc)) throw new SchemaChanged("x4 ohlc: no data.ohlc array");
  return ohlc.filter(isRecord).flatMap((r) => {
    const t = num(r.timestamp);
    if (t === null) return [];
    const value = num(r.close);
    return [{ at: epochIso(t), value: value !== null && value > 0 ? value : null }];
  });
}

// ---------------------------------------------------------------- O3: bitcoin supply from block height

const O3_RPC = "https://bitcoin-rpc.publicnode.com";
const O1 = "https://mempool.space/api";
const o3Items = ["M06.X.01b"];
const o3Map = [concept("result.height", "market.btc_height", "M06.X.01b"), concept("result.time", "market.as_of", "M06.X.01b")];

export const btcHeight: MarketConnector = {
  meta: {
    id: "crypto-o3-btc-height",
    country: "intl",
    publisher: "Public bitcoin RPC O3 (block height)",
    homepage: "https://www.publicnode.com/",
    officialHosts: ["bitcoin-rpc.publicnode.com", "mempool.space"],
    licence: "rpc-display-o3",
    attribution: null,
    storage: "store",
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["in_file_field"],
    maxPurgeShare: 0,
    purgeScope: "none",
    deepLink: null,
    orderUrl: null,
    requires: [],
    limits: { requestsPerSecond: 1 },
    items: o3Items,
  },
  parserVersion: parserVersion("crypto-o3-btc-height", 1, o3Map, o3Items, tilesOf("crypto-o3-btc-height")),
  fieldMap: o3Map,
  fetchHosts: ["bitcoin-rpc.publicnode.com", "mempool.space"],
  async fetch(ctx) {
    const rpc = (method: string, params: unknown[]) => // A block-header read changes nothing upstream, so it may be retried.
      ctx.fetch(O3_RPC, { headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "1.0", id: 1, method, params }), idempotent: true });
    try {
      const best = jsonOf(art(ctx, "best", await rpc("getbestblockhash", [])));
      const hash = isRecord(best) && typeof best.result === "string" && /^[0-9a-f]{64}$/.test(best.result) ? best.result : null;
      if (!hash) throw new SchemaChanged("o3: no best block hash");
      return [art(ctx, "header.json", await rpc("getblockheader", [hash]))];
    } catch {
      // Fallback host O1 (GET only): the tip hash, then that block's height and timestamp.
      const hash = textOf(art(ctx, "tip", await ctx.fetch(`${O1}/blocks/tip/hash`))).trim();
      if (!/^[0-9a-f]{64}$/.test(hash)) throw new SchemaChanged("o1: no tip hash");
      return [art(ctx, "block.json", await ctx.fetch(`${O1}/block/${hash}`))];
    }
  },
  asOf(raw) {
    const h = heightOf(raw);
    return { in_file_field: h ? h.at : null };
  },
  parse(raw) {
    const h = heightOf(raw);
    if (!h) throw new SchemaChanged("o3: no block height");
    return { series: [{ series: { seriesKey: "btc:supply", itemId: "M06.X.01b", unit: "coins", frequency: "daily_7d" }, observations: [{ date: h.at.slice(0, 10), value: btcSupply(h.height) }], latest: { value: btcSupply(h.height), observedAt: h.at } }], dropped: [] };
  },
};

function heightOf(raw: readonly RawArtifact[]): { height: number; at: string } | null {
  const header = raw.find((r) => r.name === "header.json");
  const block = raw.find((r) => r.name === "block.json");
  const body = header ? jsonOf(header) : block ? jsonOf(block) : null;
  const src = isRecord(body) && header ? body.result : body;
  if (!isRecord(src)) return null;
  const height = num(src.height);
  const time = num(header ? src.time : src.timestamp);
  return height !== null && Number.isInteger(height) && height >= 0 && time !== null ? { height, at: epochIso(time) } : null;
}

// ---------------------------------------------------------------- C1: total crypto market and ether supply

export const C1_KEY = "MARKETS_C1_DEMO_KEY";
const C1 = "https://api.coingecko.com/api/v3";
const c1Items = ["M06.X.02", "M06.X.01b"];
const c1Map = [concept("data.total_market_cap.usd", "market.value", "M06.X.02"), concept("data.updated_at", "market.as_of", "M06.X.02"), concept("[0].circulating_supply", "market.supply", "M06.X.01b"), concept("[0].last_updated", "market.as_of", "M06.X.01b")];

export const cryptoC1: MarketConnector = {
  meta: {
    id: "crypto-c1",
    country: "intl",
    publisher: "Crypto data aggregator C1",
    homepage: "https://www.coingecko.com/en/api",
    officialHosts: ["api.coingecko.com", "www.coingecko.com"],
    licence: "provider-attribution-c1",
    attribution: "Powered by CoinGecko",
    storage: "connector-cache",
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["in_file_field"],
    maxPurgeShare: 0,
    purgeScope: "none",
    deepLink: null,
    orderUrl: null,
    requires: [],
    limits: { requestsPerSecond: 0.2 },
    items: c1Items,
  },
  parserVersion: parserVersion("crypto-c1", 1, c1Map, c1Items, tilesOf("crypto-c1")),
  fieldMap: c1Map,
  fetchHosts: ["api.coingecko.com"],
  async fetch(ctx) {
    const key = ctx.keys[C1_KEY];
    const init = key ? { headers: { "x-cg-demo-api-key": key } } : undefined;
    const out = [art(ctx, "global.json", await ctx.fetch(`${C1}/global`, init))];
    if (ctx.mode === "daily") out.push(art(ctx, "markets.json", await ctx.fetch(`${C1}/coins/markets?vs_currency=usd&ids=ethereum`, init)));
    return out;
  },
  asOf(raw) {
    const g = c1Global(raw);
    return { in_file_field: g?.at ?? null };
  },
  parse(raw) {
    const series: ParsedSeries[] = [];
    const g = c1Global(raw);
    if (g) series.push({ series: { seriesKey: "c1:total_cap", itemId: "M06.X.02", unit: "usd_cap", frequency: "daily_7d" }, latest: { value: g.value, observedAt: g.at } });
    const m = raw.find((r) => r.name === "markets.json");
    if (m) {
      const body = jsonOf(m);
      const eth = Array.isArray(body) ? body.find((e) => isRecord(e) && e.id === "ethereum") : undefined;
      const supply = isRecord(eth) ? num(eth.circulating_supply) : null;
      const at = isRecord(eth) && typeof eth.last_updated === "string" && !Number.isNaN(Date.parse(eth.last_updated)) ? new Date(eth.last_updated).toISOString() : null;
      if (supply !== null && supply > 0 && at) series.push({ series: { seriesKey: "c1:eth_supply", itemId: "M06.X.01b", unit: "coins", frequency: "daily_7d" }, latest: { value: supply, observedAt: at } });
    }
    return { series, dropped: [] };
  },
};

/** A keyless refusal arrives as HTTP 200 with an `error` or `status.error_code` body. */
function c1Global(raw: readonly RawArtifact[]): { value: number; at: string } | null {
  const body = jsonOf(artifact(raw, "global.json"));
  if (isRecord(body) && (body.error !== undefined || (isRecord(body.status) && body.status.error_code !== undefined))) throw new ProviderRefused("provider_error", "crypto-c1: the provider refused the request");
  const data = isRecord(body) && isRecord(body.data) ? body.data : null;
  if (!data) throw new SchemaChanged("crypto-c1: no data object");
  const value = isRecord(data.total_market_cap) ? num(data.total_market_cap.usd) : null;
  const t = num(data.updated_at);
  return value !== null && value > 0 && t !== null ? { value, at: epochIso(t) } : null;
}

// ---------------------------------------------------------------- C3: total crypto market all-time high

const c3Items = ["M06.X.02"];
const c3Map = [concept("market_cap_ath_value", "market.peak", "M06.X.02"), concept("market_cap_ath_date", "market.peak_date", "M06.X.02"), concept("last_updated", "market.as_of", "M06.X.02")];

export const cryptoC3: MarketConnector = {
  meta: {
    id: "crypto-c3-global",
    country: "intl",
    publisher: "Crypto data aggregator C3",
    homepage: "https://coinpaprika.com/api/",
    officialHosts: ["api.coinpaprika.com", "coinpaprika.com"],
    licence: "provider-personal-c3",
    attribution: "Powered by CoinPaprika",
    storage: "connector-cache",
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["in_file_field"],
    maxPurgeShare: 0,
    purgeScope: "none",
    deepLink: null,
    orderUrl: null,
    requires: [],
    limits: { requestsPerSecond: 1 },
    items: c3Items,
  },
  parserVersion: parserVersion("crypto-c3-global", 1, c3Map, c3Items, tilesOf("crypto-c3-global")),
  fieldMap: c3Map,
  fetchHosts: ["api.coinpaprika.com"],
  async fetch(ctx) {
    return [art(ctx, "global.json", await ctx.fetch("https://api.coinpaprika.com/v1/global"))];
  },
  asOf(raw) {
    const body = jsonOf(artifact(raw, "global.json"));
    const t = isRecord(body) ? num(body.last_updated) : null;
    return { in_file_field: t === null ? null : epochIso(t) };
  },
  parse(raw) {
    const body = jsonOf(artifact(raw, "global.json"));
    if (!isRecord(body)) throw new SchemaChanged("crypto-c3: not an object");
    const value = num(body.market_cap_ath_value);
    const date = typeof body.market_cap_ath_date === "string" && !Number.isNaN(Date.parse(body.market_cap_ath_date)) ? new Date(body.market_cap_ath_date).toISOString() : null;
    if (value === null || value <= 0 || !date) throw new SchemaChanged("crypto-c3: no all-time high");
    return { series: [{ series: { seriesKey: "c3:total_cap_peak", itemId: "M06.X.02", unit: "usd_cap", frequency: "daily_7d" }, latest: { value, observedAt: date } }], dropped: [] };
  },
};
