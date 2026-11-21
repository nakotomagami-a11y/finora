// Official and open-licence sources (loaders/markets.md Part 2): US Treasury Fiscal Data, FRED's
// CSV downloads (public-domain series) and the World Bank's monthly prices. FRED's third-party (cited)
// series and the Taiwan exchange's open-data index are configured in the local provider file (configured.ts).
import type { DropReason } from "@finora/domain";
import { addDays } from "../settings.ts";
import { TILE_ROWS } from "../tiles.ts";
import type { FetchContext, MarketConnector, MarketMeta, MarketParse, Observation, RawArtifact, SeriesDef } from "../types.ts";
import { ArchiveError, readXlsxSheet } from "@finora/formats";
import { artifact, concept, isoDay, isRecord, jsonOf, maxOf, notRead, num, parserVersion, SchemaChanged, textOf } from "./common.ts";

const tilesOf = (sourceId: string) => TILE_ROWS.filter((r) => r.sourceId === sourceId);
const now = (ctx: { now: string }) => ctx.now;

async function get(ctx: FetchContext, name: string, url: string): Promise<RawArtifact> {
  const r = await ctx.fetch(url);
  return { name, bytes: r.bytes, headers: r.headers, fetchedAt: now(ctx) };
}

// ---------------------------------------------------------------- US Treasury, Debt to the Penny

/** The debt ticker needs a year before the latest figure, so this source keeps 400 days more history. */
export const DEBT_HISTORY_DAYS = 400;
const treasuryItems = ["M08.X.01"];
const treasuryMap = [concept("record_date", "market.date", "M08.X.01"), concept("tot_pub_debt_out_amt", "market.debt_total", "M08.X.01"), notRead("debt_held_public_amt"), notRead("intragov_hold_amt")];

export const treasuryDebt: MarketConnector = {
  meta: {
    id: "us-treasury-debt",
    country: "us",
    publisher: "U.S. Department of the Treasury, Bureau of the Fiscal Service",
    homepage: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/",
    officialHosts: ["api.fiscaldata.treasury.gov", "fiscaldata.treasury.gov"],
    licence: "us-gov-public-domain",
    attribution: "Source: U.S. Treasury, Fiscal Data (Debt to the Penny)",
    storage: "store",
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["max_date_in_data"],
    maxPurgeShare: 0.02,
    purgeScope: "window",
    deepLink: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/",
    orderUrl: null,
    requires: [],
    limits: { requestsPerSecond: 1 },
    items: treasuryItems,
  },
  parserVersion: parserVersion("us-treasury-debt", 1, treasuryMap, treasuryItems, tilesOf("us-treasury-debt")),
  fieldMap: treasuryMap,
  fetchHosts: ["api.fiscaldata.treasury.gov"],
  async fetch(ctx) {
    const from = addDays(ctx.windowStart, -DEBT_HISTORY_DAYS);
    const url = `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=10000&fields=record_date,tot_pub_debt_out_amt&filter=record_date:gte:${from}`;
    return [await get(ctx, "debt_to_penny.json", url)];
  },
  asOf(raw) {
    return { max_date_in_data: maxOf(rowsOf(raw).map((r) => isoDay(r.record_date))) };
  },
  parse(raw) {
    const dropped: MarketParse["dropped"] = [];
    const observations: Observation[] = [];
    for (const r of rowsOf(raw)) {
      const date = isoDay(r.record_date);
      const value = num(r.tot_pub_debt_out_amt);
      if (!date || value === null || value <= 0) {
        dropped.push({ reason: "market_invalid_value", field: "tot_pub_debt_out_amt" });
        continue;
      }
      observations.push({ date, value });
    }
    observations.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { series: [{ series: { seriesKey: "treasury:debt_total", itemId: "M08.X.01", unit: "usd", frequency: "daily_exchange" }, observations }], dropped };
  },
};

function rowsOf(raw: readonly RawArtifact[]): Record<string, unknown>[] {
  const body = jsonOf(artifact(raw, "debt_to_penny.json"));
  if (!isRecord(body) || !Array.isArray(body.data)) throw new SchemaChanged("debt_to_penny: no data array");
  return body.data.filter(isRecord);
}

// ---------------------------------------------------------------- FRED CSV downloads

type FredSeries = { id: string; itemId: string; unit: SeriesDef["unit"]; frequency: SeriesDef["frequency"]; scale: number };
const FRED_OPEN: FredSeries[] = [
  { id: "BOGZ1LM893064105Q", itemId: "M01.X.01", unit: "usd", frequency: "quarterly", scale: 1e6 },
  { id: "DCOILBRENTEU", itemId: "M07.X.01", unit: "usd_per_bbl", frequency: "daily_exchange", scale: 1 },
  { id: "DCOILWTICO", itemId: "M07.X.01", unit: "usd_per_bbl", frequency: "daily_exchange", scale: 1 },
];

/** FRED dates a quarter by its first day; the store keeps the period end (loaders/markets.md). */
export function quarterEnd(start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 3, 0);
  return d.toISOString().slice(0, 10);
}

function fredMeta(id: "us-fred-open", series: FredSeries[]): MarketMeta {
  return {
    id,
    country: "us",
    publisher: "Federal Reserve Bank of St. Louis (FRED)",
    homepage: "https://fred.stlouisfed.org/",
    officialHosts: ["fred.stlouisfed.org"],
    licence: "fred-public-domain",
    attribution: "Source: FRED, Federal Reserve Bank of St. Louis; original: Board of Governors of the Federal Reserve System (Z.1), U.S. Energy Information Administration (oil)",
    storage: "store",
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["max_date_in_data"],
    maxPurgeShare: 0.02,
    purgeScope: "window",
    deepLink: "https://fred.stlouisfed.org/series/{seriesId}",
    orderUrl: null,
    requires: [],
    limits: { requestsPerSecond: 1 },
    items: [...new Set(series.map((s) => s.itemId))],
  };
}

function fredConnector(id: "us-fred-open", series: FredSeries[]): MarketConnector {
  const meta = fredMeta(id, series);
  const map = [concept("observation_date", "market.date", series[0]?.itemId ?? ""), ...series.map((s) => concept(s.id, "market.value", s.itemId))];
  return {
    meta,
    parserVersion: parserVersion(id, 1, map, meta.items, tilesOf(id)),
    fieldMap: map,
    fetchHosts: ["fred.stlouisfed.org"],
    async fetch(ctx) {
      const out: RawArtifact[] = [];
      for (const s of series) out.push(await get(ctx, `${s.id}.csv`, `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${s.id}&cosd=${ctx.windowStart}`));
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
              dropped.push({ reason: row.missing ? "market_missing_value" : "market_invalid_value", field: s.id });
              continue;
            }
            observations.push({ date: s.frequency === "quarterly" ? quarterEnd(row.date) : row.date, value: row.value * s.scale });
          }
          return { series: { seriesKey: `fred:${s.id}`, itemId: s.itemId, unit: s.unit, frequency: s.frequency }, observations };
        }),
        dropped,
      };
    },
  };
}

export function fredRows(raw: readonly RawArtifact[], s: Pick<FredSeries, "id">): { date: string; value: number | null; missing: boolean }[] {
  const lines = textOf(artifact(raw, `${s.id}.csv`)).trim().split(/\r?\n/);
  if (lines[0] !== `observation_date,${s.id}`) throw new SchemaChanged(`${s.id}: not a FRED CSV`);
  return lines.slice(1).flatMap((line) => {
    const [date, value] = line.split(",");
    const d = isoDay(date);
    if (!d) return [];
    const missing = value === undefined || value === "" || value === ".";
    return [{ date: d, value: missing ? null : num(value), missing }];
  });
}

export const fredOpen = fredConnector("us-fred-open", FRED_OPEN);

// ---------------------------------------------------------------- World Bank, monthly prices

const WB_PAGE = "https://www.worldbank.org/en/research/commodity-markets";
const WB_LINK = /https:\/\/thedocs\.worldbank\.org\/[^"'\s<>]+CMO-Historical-Data-Monthly\.xlsx/;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const wbItems = ["M05.X.01"];
const wbMap = [concept("Monthly Prices!A (month)", "market.date", "M05.X.01"), concept("Monthly Prices!Gold", "market.value", "M05.X.01"), concept("Monthly Prices!A4", "market.as_of", "M05.X.01")];

/** "Updated on November 03, 2026" → 2026-11-03. */
export function updatedOn(cell: string): string | null {
  const m = /^Updated on ([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(cell.trim());
  if (!m) return null;
  const month = MONTHS.indexOf((m[1] ?? "").toLowerCase());
  if (month < 0) return null;
  return isoDay(`${m[3]}-${String(month + 1).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`);
}

function monthEnd(label: string): string | null {
  const m = /^(\d{4})M(\d{2})$/.exec(label);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0));
  return d.toISOString().slice(0, 10);
}

function goldSheet(raw: readonly RawArtifact[]): { asOf: string | null; rows: { label: string; value: string | undefined }[] } {
  let sheet: string[][];
  try {
    sheet = readXlsxSheet(artifact(raw, "CMO-Historical-Data-Monthly.xlsx").bytes, "Monthly Prices");
  } catch (error) {
    if (error instanceof ArchiveError) throw new SchemaChanged(`pink sheet: ${error.message}`);
    throw error;
  }
  // Row n of the sheet is at index n - 1: the as-of in A4, names in row 5, units in row 6, months from row 7.
  const header = sheet[4] ?? [];
  const goldCol = header.findIndex((v) => v.trim() === "Gold");
  if (goldCol < 0) throw new SchemaChanged("pink sheet: no Gold column in row 5");
  if (!(sheet[5]?.[goldCol] ?? "").includes("troy oz")) throw new SchemaChanged("pink sheet: gold unit is not troy oz");
  const rows = sheet.slice(6).map((cells) => ({ label: cells[0] ?? "", value: cells[goldCol] }));
  return { asOf: updatedOn(sheet[3]?.[0] ?? ""), rows };
}

export const worldBankGold: MarketConnector = {
  meta: {
    id: "intl-worldbank-pinksheet",
    country: "intl",
    publisher: "World Bank, Commodity Markets (Pink Sheet)",
    homepage: WB_PAGE,
    officialHosts: ["www.worldbank.org", "thedocs.worldbank.org"],
    licence: "cc-by-4.0",
    attribution: "World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0",
    storage: "store",
    cadence: "monthly",
    publishedAtUtc: null,
    asOf: ["in_file_field"],
    maxPurgeShare: 0.02,
    purgeScope: "window",
    deepLink: WB_PAGE,
    orderUrl: null,
    requires: [],
    limits: { requestsPerSecond: 1 },
    items: wbItems,
  },
  parserVersion: parserVersion("intl-worldbank-pinksheet", 1, wbMap, wbItems, tilesOf("intl-worldbank-pinksheet")),
  fieldMap: wbMap,
  fetchHosts: ["www.worldbank.org", "thedocs.worldbank.org"],
  async fetch(ctx) {
    const page = await get(ctx, "commodity-markets.html", WB_PAGE);
    const link = WB_LINK.exec(textOf(page))?.[0];
    if (!link) throw new SchemaChanged("pink sheet: link_not_found");
    return [await get(ctx, "CMO-Historical-Data-Monthly.xlsx", link)];
  },
  asOf(raw) {
    return { in_file_field: goldSheet(raw).asOf };
  },
  parse(raw, ctx) {
    const dropped: { reason: DropReason; field: string }[] = [];
    const observations: Observation[] = [];
    for (const row of goldSheet(raw).rows) {
      const date = monthEnd(row.label);
      if (!date) continue;
      if (date < ctx.windowStart) continue;
      const value = num(row.value);
      if (value === null) {
        dropped.push({ reason: "market_missing_value", field: "Gold" });
        continue;
      }
      observations.push({ date, value });
    }
    return { series: [{ series: { seriesKey: "worldbank:gold", itemId: "M05.X.01", unit: "usd_per_oz", frequency: "monthly" }, observations }], dropped };
  },
};
