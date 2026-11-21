// The Crash monitor tiles as configuration (loaders/markets.md §1.1, architecture §8). Every M item
// with a SHOW or CAVEAT call has its rows here; LATER items (the oracle route, macro tiles) have none.
import { FUND_SLOTS, type FundSlot } from "./settings.ts";
import type { MarketFrequency, MarketUnit } from "./types.ts";

export type TileId = "M01" | "M02" | "M03" | "M04" | "M05" | "M06" | "M07" | "M08";

export type TileRow = {
  rowKey: string;
  tileId: TileId;
  itemId: string;
  /** i18n key of the row label (`crash.rows.<id>`). */
  labelKey: string;
  sourceId: string;
  where: "main" | "cc";
  seriesKey: string;
  unit: MarketUnit;
  frequency: MarketFrequency;
  /** The source publishes at least a day after the observation date (frontend 7029664310). */
  delayed: boolean;
  /** How value lost is computed, where the source's terms allow it; null shows drawdown only. */
  valueLost: "series" | "supply" | null;
  /** Counted in totalWiped (US corporate equities, total crypto market only; designer 7029912590). */
  countInTotal: boolean;
  /** For `valueLost: "supply"`: the series holding the supply. */
  supplySeriesKey?: string;
  /** The peak comes from another series (the total-crypto all-time high), not from this series' history. */
  peakSeriesKey?: string;
  /** Fund slots: the setting that holds the symbol. */
  slot?: FundSlot;
  /** The row's value comes from the latest snapshot only (no history is kept, by the source's terms). */
  latestOnly?: boolean;
};

const fundTile: Record<FundSlot, { tileId: TileId; itemId: string }> = {
  "M01.us_total": { tileId: "M01", itemId: "M01.X.02" },
  "M01.us_large": { tileId: "M01", itemId: "M01.X.02" },
  "M01.us_tech": { tileId: "M01", itemId: "M01.X.02" },
  "M02.europe": { tileId: "M02", itemId: "M02.X.01" },
  "M03.japan": { tileId: "M03", itemId: "M03.X.02" },
  "M03.korea": { tileId: "M03", itemId: "M03.X.02" },
  "M03.taiwan": { tileId: "M03", itemId: "M03.X.02" },
  "M03.hong_kong": { tileId: "M03", itemId: "M03.X.02" },
  "M03.china": { tileId: "M03", itemId: "M03.X.02" },
  "M03.india": { tileId: "M03", itemId: "M03.X.02" },
  "M03.australia": { tileId: "M03", itemId: "M03.X.02" },
  "M04.canada": { tileId: "M04", itemId: "M04.X.01" },
  "M04.brazil": { tileId: "M04", itemId: "M04.X.01" },
};

export const fundSeriesKey = (slot: FundSlot) => `s7:slot:${slot}`;

const fundRows: TileRow[] = FUND_SLOTS.map((slot) => ({
  rowKey: `${fundTile[slot].itemId}:${slot.split(".")[1]}`,
  tileId: fundTile[slot].tileId,
  itemId: fundTile[slot].itemId,
  labelKey: `crash.rows.fund.${slot}`,
  sourceId: "stocks-s7",
  where: "cc",
  seriesKey: fundSeriesKey(slot),
  unit: "usd",
  frequency: "daily_exchange",
  delayed: true,
  valueLost: null,
  countInTotal: false,
  slot,
}));

const base = { valueLost: null, countInTotal: false } as const;

export const TILE_ROWS: readonly TileRow[] = [
  { ...base, rowKey: "M01.X.01:us_equities", tileId: "M01", itemId: "M01.X.01", labelKey: "crash.rows.us_equities", sourceId: "us-fred-open", where: "main", seriesKey: "fred:BOGZ1LM893064105Q", unit: "usd", frequency: "quarterly", delayed: true, valueLost: "series", countInTotal: true },
  ...fundRows.filter((r) => r.tileId === "M01" || r.tileId === "M02"),
  { ...base, rowKey: "M03.X.01:japan", tileId: "M03", itemId: "M03.X.01", labelKey: "crash.rows.japan_index", sourceId: "us-fred-cited", where: "cc", seriesKey: "fred:NIKKEI225", unit: "index_points", frequency: "daily_exchange", delayed: true },
  { ...base, rowKey: "M03.X.01:taiwan", tileId: "M03", itemId: "M03.X.01", labelKey: "crash.rows.taiwan_index", sourceId: "tw-twse-index", where: "main", seriesKey: "twse:taiex", unit: "index_points", frequency: "daily_exchange", delayed: true },
  ...fundRows.filter((r) => r.tileId === "M03" || r.tileId === "M04"),
  { ...base, rowKey: "M05.X.01:gold_monthly", tileId: "M05", itemId: "M05.X.01", labelKey: "crash.rows.gold_monthly", sourceId: "intl-worldbank-pinksheet", where: "main", seriesKey: "worldbank:gold", unit: "usd_per_oz", frequency: "monthly", delayed: true },
  { ...base, rowKey: "M05.X.02b:gold_daily", tileId: "M05", itemId: "M05.X.02b", labelKey: "crash.rows.gold_daily", sourceId: "gold-s3", where: "cc", seriesKey: "s3:gold", unit: "usd_per_oz", frequency: "daily_7d", delayed: true },
  { ...base, rowKey: "M06.X.01b:bitcoin", tileId: "M06", itemId: "M06.X.01b", labelKey: "crash.rows.bitcoin", sourceId: "crypto-x4-ohlc", where: "cc", seriesKey: "x4:btcusd", unit: "usd", frequency: "daily_7d", delayed: false, valueLost: "supply", supplySeriesKey: "btc:supply" },
  { ...base, rowKey: "M06.X.01b:ether", tileId: "M06", itemId: "M06.X.01b", labelKey: "crash.rows.ether", sourceId: "crypto-x4-ohlc", where: "cc", seriesKey: "x4:ethusd", unit: "usd", frequency: "daily_7d", delayed: false, valueLost: "supply", supplySeriesKey: "c1:eth_supply" },
  { ...base, rowKey: "M06.X.02:total_crypto", tileId: "M06", itemId: "M06.X.02", labelKey: "crash.rows.total_crypto", sourceId: "crypto-c1", where: "cc", seriesKey: "c1:total_cap", unit: "usd_cap", frequency: "daily_7d", delayed: false, valueLost: "series", countInTotal: true, peakSeriesKey: "c3:total_cap_peak", latestOnly: true },
  { ...base, rowKey: "M07.X.01:brent", tileId: "M07", itemId: "M07.X.01", labelKey: "crash.rows.brent", sourceId: "us-fred-open", where: "main", seriesKey: "fred:DCOILBRENTEU", unit: "usd_per_bbl", frequency: "daily_exchange", delayed: true },
  { ...base, rowKey: "M07.X.01:wti", tileId: "M07", itemId: "M07.X.01", labelKey: "crash.rows.wti", sourceId: "us-fred-open", where: "main", seriesKey: "fred:DCOILWTICO", unit: "usd_per_bbl", frequency: "daily_exchange", delayed: true },
  { ...base, rowKey: "M08.X.01:us_debt", tileId: "M08", itemId: "M08.X.01", labelKey: "crash.rows.us_debt", sourceId: "us-treasury-debt", where: "main", seriesKey: "treasury:debt_total", unit: "usd", frequency: "daily_exchange", delayed: true },
];

export const TILE_ORDER: readonly TileId[] = ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"];

/** The series a tile row needs beside its own (supply, peak). */
export function seriesKeysOf(row: TileRow): string[] {
  return [row.seriesKey, row.supplySeriesKey, row.peakSeriesKey].filter((k): k is string => k !== undefined);
}
