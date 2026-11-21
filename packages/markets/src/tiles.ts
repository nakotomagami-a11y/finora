// The Crash monitor tiles as configuration (loaders/markets.md §1.1, architecture §8). Labels name
// the market, never an index or its owner (human ruling H4). Rows fed by a provider from the local
// provider file show "not configured" when the file doesn't configure it.
import type { MarketFrequency, MarketUnit } from "./types.ts";

export type TileId = "M01" | "M03" | "M05" | "M06" | "M07" | "M08";

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
  /** The row's value comes from the latest snapshot only (no history is kept, by the source's terms). */
  latestOnly?: boolean;
};

const base = { valueLost: null, countInTotal: false } as const;

export const TILE_ROWS: readonly TileRow[] = [
  { ...base, rowKey: "M01.X.01:us_equities", tileId: "M01", itemId: "M01.X.01", labelKey: "crash.rows.us_equities", sourceId: "us-fred-open", where: "main", seriesKey: "fred:BOGZ1LM893064105Q", unit: "usd", frequency: "quarterly", delayed: true, valueLost: "series", countInTotal: true },
  { ...base, rowKey: "M03.X.01:japan", tileId: "M03", itemId: "M03.X.01", labelKey: "crash.rows.japan_index", sourceId: "us-fred-cited", where: "cc", seriesKey: "fred-cited:japan", unit: "index_points", frequency: "daily_exchange", delayed: true },
  { ...base, rowKey: "M03.X.01:taiwan", tileId: "M03", itemId: "M03.X.01", labelKey: "crash.rows.taiwan_index", sourceId: "tw-broad-index", where: "main", seriesKey: "tw:broad_index", unit: "index_points", frequency: "daily_exchange", delayed: true },
  { ...base, rowKey: "M05.X.01:gold_monthly", tileId: "M05", itemId: "M05.X.01", labelKey: "crash.rows.gold_monthly", sourceId: "intl-worldbank-pinksheet", where: "main", seriesKey: "worldbank:gold", unit: "usd_per_oz", frequency: "monthly", delayed: true },
  { ...base, rowKey: "M06.X.01b:bitcoin", tileId: "M06", itemId: "M06.X.01b", labelKey: "crash.rows.bitcoin", sourceId: "crypto-x4-ohlc", where: "cc", seriesKey: "x4:btcusd", unit: "usd", frequency: "daily_7d", delayed: false, valueLost: "supply", supplySeriesKey: "btc:supply" },
  { ...base, rowKey: "M06.X.01b:ether", tileId: "M06", itemId: "M06.X.01b", labelKey: "crash.rows.ether", sourceId: "crypto-x4-ohlc", where: "cc", seriesKey: "x4:ethusd", unit: "usd", frequency: "daily_7d", delayed: false, valueLost: "supply", supplySeriesKey: "c1:eth_supply" },
  { ...base, rowKey: "M06.X.02:total_crypto", tileId: "M06", itemId: "M06.X.02", labelKey: "crash.rows.total_crypto", sourceId: "crypto-c1", where: "cc", seriesKey: "c1:total_cap", unit: "usd_cap", frequency: "daily_7d", delayed: false, valueLost: "series", countInTotal: true, peakSeriesKey: "c3:total_cap_peak", latestOnly: true },
  { ...base, rowKey: "M07.X.01:brent", tileId: "M07", itemId: "M07.X.01", labelKey: "crash.rows.brent", sourceId: "us-fred-open", where: "main", seriesKey: "fred:DCOILBRENTEU", unit: "usd_per_bbl", frequency: "daily_exchange", delayed: true },
  { ...base, rowKey: "M07.X.01:wti", tileId: "M07", itemId: "M07.X.01", labelKey: "crash.rows.wti", sourceId: "us-fred-open", where: "main", seriesKey: "fred:DCOILWTICO", unit: "usd_per_bbl", frequency: "daily_exchange", delayed: true },
  { ...base, rowKey: "M08.X.01:us_debt", tileId: "M08", itemId: "M08.X.01", labelKey: "crash.rows.us_debt", sourceId: "us-treasury-debt", where: "main", seriesKey: "treasury:debt_total", unit: "usd", frequency: "daily_exchange", delayed: true },
];

/** M02 (Europe) and M04 (Americas excluding the US) had only key-gated fund rows; under H5 they have none. */
export const TILE_ORDER: readonly TileId[] = ["M01", "M03", "M05", "M06", "M07", "M08"];

/** Part G items with a SHOW or CAVEAT call that the human's ruling H5 (no keys) switches off: no row, no connector. */
export const OFF_BY_H5: readonly string[] = ["M01.X.02", "M02.X.01", "M03.X.02", "M04.X.01", "M05.X.02b"];

/** The series a tile row needs beside its own (supply, peak). */
export function seriesKeysOf(row: TileRow): string[] {
  return [row.seriesKey, row.supplySeriesKey, row.peakSeriesKey].filter((k): k is string => k !== undefined);
}

/**
 * Snapshots a source's terms let us show only while fresh: C1 must be refreshed within 24 hours or
 * dropped. The view leaves older ones out even before the expiry job runs (S22 review S1).
 */
export const SNAPSHOT_MAX_AGE_HOURS: Readonly<Record<string, number>> = { "crypto-c1": 24 };
