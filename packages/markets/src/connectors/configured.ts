// Connectors whose provider is configured in the user's local provider file (providers.ts, human ruling
// H4): crypto prices from an exchange (x4), the total crypto market from two aggregators (c1, c3),
// bitcoin's block height from a public RPC (o3), FRED's third-party index series (fred-cited: Japan and,
// for personal use only, the daily US rows) and the Taiwan exchange's open data (e1).
// The parsers live here under codes; hosts, URLs, attribution and terms come from the file. Every
// value is licensed for the user's own display only, so these sources store in connector-cache.db (R17),
// except the block height, which is public chain data.
import { btcSupply } from "../btc-supply.ts";
import { fillUrl, type ProviderCode, type ProviderEntry, type Providers } from "../providers.ts";
import { TILE_ROWS } from "../tiles.ts";
import type { FetchContext, MarketConnector, MarketMeta, MarketParse, Observation, ParsedSeries, RawArtifact } from "../types.ts";
import { artifact, concept, epochIso, epochSeconds, isoDay, isRecord, jsonOf, maxOf, notRead, num, parserVersion, ProviderRefused, SchemaChanged, textOf } from "./common.ts";
import { fredRows } from "./official.ts";

const tilesOf = (sourceId: string) => TILE_ROWS.filter((r) => r.sourceId === sourceId);
const art = (ctx: FetchContext, name: string, r: { bytes: Uint8Array; headers: Record<string, string> }): RawArtifact => ({ name, bytes: r.bytes, headers: r.headers, fetchedAt: ctx.now });

/** The source id each coded provider fills. */
export const PROVIDER_SOURCE: Record<ProviderCode, string> = {
  x4: "crypto-x4-ohlc",
  c1: "crypto-c1",
  c3: "crypto-c3-global",
  o3: "crypto-o3-btc-height",
  "fred-cited": "us-fred-cited",
  e1: "e1-taiwan",
};

function meta(id: string, e: ProviderEntry, over: Pick<MarketMeta, "storage" | "asOf" | "items"> & Partial<MarketMeta>): MarketMeta {
  return {
    id,
    country: "intl",
    publisher: e.publisher,
    homepage: e.homepage,
    officialHosts: e.hosts,
    licence: e.licence.id,
    attribution: e.attribution,
    cadence: "daily",
    publishedAtUtc: null,
    maxPurgeShare: 0,
    purgeScope: "none",
    deepLink: null,
    orderUrl: null,
    requires: [],
    limits: { requestsPerSecond: 1 },
    ...over,
  };
}

// ---------------------------------------------------------------- x4: bitcoin and ether candles

const PAIRS = [
  { pair: "btcusd", seriesKey: "x4:btcusd" },
  { pair: "ethusd", seriesKey: "x4:ethusd" },
] as const;
const x4Items = ["M06.X.01b"];
const x4Map = [concept("data.ohlc[].timestamp", "market.date", "M06.X.01b"), concept("data.ohlc[].close", "market.value", "M06.X.01b"), notRead("open"), notRead("high"), notRead("low"), notRead("volume")];
/** One call returns at most 1,000 candles; a longer window pages forward from its start. */
export const X4_PAGE = 1000;

function x4(e: ProviderEntry): MarketConnector {
  return {
    meta: meta("crypto-x4-ohlc", e, { storage: "connector-cache", asOf: ["max_date_in_data"], items: x4Items, publishedAtUtc: "00:05" }),
    parserVersion: parserVersion("crypto-x4-ohlc", 2, x4Map, x4Items, tilesOf("crypto-x4-ohlc")),
    fieldMap: x4Map,
    fetchHosts: e.hosts,
    async fetch(ctx) {
      const out: RawArtifact[] = [];
      for (const { pair } of PAIRS) {
        if (ctx.mode === "latest") {
          out.push(art(ctx, `${pair}.latest.json`, await ctx.fetch(fillUrl(e.urls.latest as string, { pair }))));
          continue;
        }
        const end = epochSeconds(ctx.now);
        for (let start = epochSeconds(ctx.windowStart), page = 0; start <= end; start += X4_PAGE * 86_400, page++) {
          out.push(art(ctx, `${pair}.daily.${page}.json`, await ctx.fetch(fillUrl(e.urls.daily as string, { pair, limit: X4_PAGE, start }))));
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
        series.push({ series: { seriesKey, itemId: "M06.X.01b", unit: "usd", frequency: "daily_7d" }, ...(daily.size ? { observations } : {}), ...(latest ? { latest } : {}) });
      }
      return { series, dropped };
    },
  };
}

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

// ---------------------------------------------------------------- o3: bitcoin supply from block height

const o3Items = ["M06.X.01b"];
const o3Map = [concept("result.height", "market.btc_height", "M06.X.01b"), concept("result.time", "market.as_of", "M06.X.01b")];
const HASH = /^[0-9a-f]{64}$/;

function o3(e: ProviderEntry): MarketConnector {
  return {
    meta: meta("crypto-o3-btc-height", e, { storage: "store", asOf: ["in_file_field"], items: o3Items }),
    parserVersion: parserVersion("crypto-o3-btc-height", 2, o3Map, o3Items, tilesOf("crypto-o3-btc-height")),
    fieldMap: o3Map,
    fetchHosts: e.hosts,
    async fetch(ctx) {
      // A block-header read changes nothing upstream, so it may be retried.
      const rpc = (method: string, params: unknown[]) => ctx.fetch(e.urls.rpc as string, { headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "1.0", id: 1, method, params }), idempotent: true });
      try {
        const best = jsonOf(art(ctx, "best", await rpc("getbestblockhash", [])));
        const hash = isRecord(best) && typeof best.result === "string" && HASH.test(best.result) ? best.result : null;
        if (!hash) throw new SchemaChanged("o3: no best block hash");
        return [art(ctx, "header.json", await rpc("getblockheader", [hash]))];
      } catch {
        // The fallback (GET only): the tip hash, then that block's height and timestamp.
        const hash = textOf(art(ctx, "tip", await ctx.fetch(e.urls.tip as string))).trim();
        if (!HASH.test(hash)) throw new SchemaChanged("o3 fallback: no tip hash");
        return [art(ctx, "block.json", await ctx.fetch(fillUrl(e.urls.block as string, { hash })))];
      }
    },
    asOf(raw) {
      const h = heightOf(raw);
      return { in_file_field: h ? h.at : null };
    },
    parse(raw) {
      const h = heightOf(raw);
      if (!h) throw new SchemaChanged("o3: no block height");
      const supply = btcSupply(h.height);
      return { series: [{ series: { seriesKey: "btc:supply", itemId: "M06.X.01b", unit: "coins", frequency: "daily_7d" }, observations: [{ date: h.at.slice(0, 10), value: supply }], latest: { value: supply, observedAt: h.at } }], dropped: [] };
    },
  };
}

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

// ---------------------------------------------------------------- c1: total crypto market and ether supply

const c1Items = ["M06.X.02", "M06.X.01b"];
const c1Map = [concept("data.total_market_cap.usd", "market.value", "M06.X.02"), concept("data.updated_at", "market.as_of", "M06.X.02"), concept("[0].circulating_supply", "market.supply", "M06.X.01b"), concept("[0].last_updated", "market.as_of", "M06.X.01b")];

function c1(e: ProviderEntry): MarketConnector {
  return {
    meta: meta("crypto-c1", e, { storage: "connector-cache", asOf: ["in_file_field"], items: c1Items, limits: { requestsPerSecond: 0.2 } }),
    parserVersion: parserVersion("crypto-c1", 2, c1Map, c1Items, tilesOf("crypto-c1")),
    fieldMap: c1Map,
    fetchHosts: e.hosts,
    async fetch(ctx) {
      const out = [art(ctx, "global.json", await ctx.fetch(e.urls.global as string))];
      if (ctx.mode === "daily") out.push(art(ctx, "markets.json", await ctx.fetch(e.urls.ethereum as string)));
      return out;
    },
    asOf(raw) {
      return { in_file_field: c1Global(raw)?.at ?? null };
    },
    parse(raw) {
      const series: ParsedSeries[] = [];
      const g = c1Global(raw);
      if (g) series.push({ series: { seriesKey: "c1:total_cap", itemId: "M06.X.02", unit: "usd_cap", frequency: "daily_7d" }, latest: { value: g.value, observedAt: g.at } });
      const m = raw.find((r) => r.name === "markets.json");
      if (m) {
        const body = jsonOf(m);
        const eth = Array.isArray(body) ? body.find((x) => isRecord(x) && x.id === "ethereum") : undefined;
        const supply = isRecord(eth) ? num(eth.circulating_supply) : null;
        const at = isRecord(eth) && typeof eth.last_updated === "string" && !Number.isNaN(Date.parse(eth.last_updated)) ? new Date(eth.last_updated).toISOString() : null;
        if (supply !== null && supply > 0 && at) series.push({ series: { seriesKey: "c1:eth_supply", itemId: "M06.X.01b", unit: "coins", frequency: "daily_7d" }, latest: { value: supply, observedAt: at } });
      }
      return { series, dropped: [] };
    },
  };
}

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

// ---------------------------------------------------------------- c3: total crypto market all-time high

const c3Items = ["M06.X.02"];
const c3Map = [concept("market_cap_ath_value", "market.peak", "M06.X.02"), concept("market_cap_ath_date", "market.peak_date", "M06.X.02"), concept("last_updated", "market.as_of", "M06.X.02")];

function c3(e: ProviderEntry): MarketConnector {
  return {
    meta: meta("crypto-c3-global", e, { storage: "connector-cache", asOf: ["in_file_field"], items: c3Items }),
    parserVersion: parserVersion("crypto-c3-global", 2, c3Map, c3Items, tilesOf("crypto-c3-global")),
    fieldMap: c3Map,
    fetchHosts: e.hosts,
    async fetch(ctx) {
      return [art(ctx, "global.json", await ctx.fetch(e.urls.global as string))];
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
}

// ---------------------------------------------------------------- fred-cited: FRED's third-party index series

/** The cited series land under their row, never under an id that names the owner. */
export const citedSeriesKey = (rowKey: string) => `fred-cited:${rowKey.split(":")[1] ?? rowKey}`;

function fredCited(e: ProviderEntry): MarketConnector {
  const series = e.series ?? [];
  const itemOf = (rowKey: string) => rowKey.split(":")[0] as string;
  const items = [...new Set(series.map((s) => itemOf(s.rowKey)))].sort();
  const map = items.flatMap((item) => [concept("observation_date", "market.date", item), concept("<series id>", "market.value", item)]);
  return {
    meta: meta("us-fred-cited", e, { storage: "connector-cache", asOf: ["max_date_in_data"], items, country: "us", maxPurgeShare: 0.02, purgeScope: "window" }),
    parserVersion: parserVersion("us-fred-cited", 2, map, items, { tiles: tilesOf("us-fred-cited"), series: series.map((s) => s.rowKey) }),
    fieldMap: map,
    fetchHosts: e.hosts,
    async fetch(ctx) {
      const out: RawArtifact[] = [];
      for (const s of series) out.push(art(ctx, `${s.id}.csv`, await ctx.fetch(fillUrl(e.urls.series as string, { id: s.id, from: ctx.windowStart }))));
      return out;
    },
    asOf(raw) {
      return { max_date_in_data: maxOf(series.map((s) => fredRows(raw, s).at(-1)?.date ?? null)) };
    },
    parse(raw) {
      const dropped: MarketParse["dropped"] = [];
      return {
        series: series.map((s) => {
          const observations: Observation[] = [];
          for (const row of fredRows(raw, s)) {
            if (row.value === null) {
              dropped.push({ reason: row.missing ? "market_missing_value" : "market_invalid_value", field: "cited series" });
              continue;
            }
            observations.push({ date: row.date, value: row.value });
          }
          return { series: { seriesKey: citedSeriesKey(s.rowKey), itemId: itemOf(s.rowKey), unit: "index_points", frequency: "daily_exchange" }, observations };
        }),
        dropped,
      };
    },
  };
}


// ---------------------------------------------------------------- e1: the Taiwan exchange's open-data broad index

/** The exchange's dates are ROC calendar, 7 digits YYYMMDD; the Gregorian year is YYY + 1911. */
export function rocToIso(roc: string): string | null {
  if (!/^\d{7}$/.test(roc)) return null;
  const y = Number(roc.slice(0, 3)) + 1911;
  const iso = `${y}-${roc.slice(3, 5)}-${roc.slice(5, 7)}`;
  return isoDay(iso) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}

const e1Items = ["M03.X.01"];
const e1Map = [concept("Date", "market.date", "M03.X.01"), concept("ClosingIndex", "market.value", "M03.X.01"), notRead("OpeningIndex"), notRead("HighestIndex"), notRead("LowestIndex")];

function e1Rows(raw: readonly RawArtifact[]): Record<string, unknown>[] {
  const body = jsonOf(artifact(raw, "month.json"));
  if (!Array.isArray(body)) throw new SchemaChanged("e1: not an array");
  return body.filter(isRecord);
}

/** The month's daily closes (the open-data API has no backfill; history accumulates from the first run). */
function e1(e: ProviderEntry): MarketConnector {
  return {
    // Open government data: the entry's licence allows the main store only when it allows redistribution.
    meta: meta("e1-taiwan", e, { storage: e.licence.redistribution && !e.licence.nonCommercial ? "store" : "connector-cache", asOf: ["max_date_in_data"], items: e1Items, publishedAtUtc: "22:00" }),
    parserVersion: parserVersion("e1-taiwan", 2, e1Map, e1Items, tilesOf("e1-taiwan")),
    fieldMap: e1Map,
    fetchHosts: e.hosts,
    async fetch(ctx) {
      return [art(ctx, "month.json", await ctx.fetch(e.urls.month as string))];
    },
    asOf(raw) {
      return { max_date_in_data: maxOf(e1Rows(raw).map((r) => rocToIso(String(r.Date ?? "")))) };
    },
    parse(raw) {
      const dropped: MarketParse["dropped"] = [];
      const observations: Observation[] = [];
      for (const r of e1Rows(raw)) {
        const date = rocToIso(String(r.Date ?? ""));
        const value = num(r.ClosingIndex);
        if (!date || value === null || value <= 0) {
          dropped.push({ reason: "market_invalid_value", field: "ClosingIndex" });
          continue;
        }
        observations.push({ date, value });
      }
      return { series: [{ series: { seriesKey: "e1:taiwan", itemId: "M03.X.01", unit: "index_points", frequency: "daily_exchange" }, observations }], dropped };
    },
  };
}

const MAKERS: Record<ProviderCode, (e: ProviderEntry) => MarketConnector> = { x4, c1, c3, o3, "fred-cited": fredCited, e1 };

/** The connectors the provider file configures; a provider missing from the file has none. */
export function configuredConnectors(providers: Providers): MarketConnector[] {
  return (Object.keys(MAKERS) as ProviderCode[]).flatMap((code) => {
    const entry = providers[code];
    return entry ? [MAKERS[code](entry)] : [];
  });
}

/** The licence of each configured provider, as the server registers it for checkSource. */
export function providerLicences(providers: Providers): { id: string; name: string; url: string; attributionRequired: boolean; shareAlike: false; nonCommercial: boolean; redistribution: boolean; verifiedOn: { date: string; url: string } }[] {
  return Object.values(providers).map((e) => ({
    id: e.licence.id,
    name: e.licence.name,
    url: e.termsUrl,
    attributionRequired: e.licence.attributionRequired,
    shareAlike: false,
    nonCommercial: e.licence.nonCommercial,
    redistribution: e.licence.redistribution,
    verifiedOn: { date: e.licence.verifiedOn, url: e.termsUrl },
  }));
}
