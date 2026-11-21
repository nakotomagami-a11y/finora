import "server-only";
// Builds the Crash monitor rows from the stored series (loaders/markets.md §1.4, architecture §8).
// Every value carries the SourceRef of the sync that wrote it; computed values are flagged derived.
import type { SourceRef } from "@finora/domain";
import { computeRow, connector, debtTicker, marketConnectors, SEEDS, SNAPSHOT_MAX_AGE_HOURS, TILE_ORDER, TILE_ROWS, totalWiped, type MarketSettings, type Providers, type RowView, type SeriesData, type TileId } from "@finora/markets";
import { lastMarketSync, marketCheckedAt, marketSyncInfo, readMarketSeries, type Store } from "@finora/store";

export type MarketRowOut = Omit<RowView, "inputs" | "tileId" | "labelKey"> & { label: string; sources: SourceRef[] };
export type CrashView = {
  tiles: { tileId: TileId; rows: MarketRowOut[] }[];
  totalWiped?: { valueUsd: number; rowItemIds: string[]; excludedItemIds: string[]; oldestAsOf: string };
};

const DERIVED_SERIES = new Set(["btc:supply"]);

export function buildCrashView(store: Store, opts: { settings: MarketSettings; providers: Providers; now: string }): CrashView {
  const { db } = store;
  const stored = readMarketSeries(db);
  const data = new Map<string, SeriesData>();
  const sourceOf = new Map<string, string>();
  for (const s of stored) {
    const maxAge = SNAPSHOT_MAX_AGE_HOURS[s.sourceId];
    const expired = maxAge !== undefined && s.latest !== null && Date.parse(opts.now) - Date.parse(s.latest.observedAt) > maxAge * 3_600_000;
    data.set(s.seriesKey, { observations: s.observations, latest: expired ? null : s.latest });
    sourceOf.set(s.seriesKey, s.sourceId);
  }
  const info = marketSyncInfo(db, stored.flatMap((s) => [...s.observations.map((o) => o.syncId), ...(s.latest ? [s.latest.syncId] : [])]));
  const checked = new Map(marketConnectors(opts.providers).map((c) => [c.meta.id, marketCheckedAt(db, c.meta.id)]));

  const ref = (sourceId: string, syncId: number, derived: boolean): SourceRef | null => {
    const sync = info.get(syncId);
    return sync ? { sourceId, licenceId: sync.licenceId, retrievedAt: sync.retrievedAt, asOf: sync.asOf, asOfBasis: sync.asOfBasis, checkedAt: checked.get(sourceId) ?? null, accessTier: "open", derived } : null;
  };

  const views: (RowView & { countInTotal: boolean })[] = [];
  const out = new Map<TileId, MarketRowOut[]>(TILE_ORDER.map((t) => [t, []]));
  for (const row of TILE_ROWS) {
    const own = stored.find((s) => s.seriesKey === row.seriesKey);
    const last = lastMarketSync(db, row.sourceId);
    const view = computeRow(row, data, {
      peakSince: opts.settings.peakSince,
      now: opts.now,
      // A row whose provider the local file doesn't configure shows "not configured", whatever is stored (H4).
      configured: connector(row.sourceId, opts.providers) !== undefined,
      sourceFailed: last?.kind === "failed",
      seeds: SEEDS,
    });
    if (row.itemId === "M08.X.01") {
      const ticker = debtTicker(own?.observations ?? []);
      if (ticker) view.ticker = { total: ticker.total, anchor: ticker.anchor, perSecond: ticker.perSecond };
    }
    views.push({ ...view, countInTotal: row.countInTotal });
    // Bitcoin supply is computed by Finora from block height, so its reference is derived (architecture §8).
    const sources = view.inputs.flatMap((input) => input.syncIds.map((id) => ref(sourceOf.get(input.seriesKey) ?? row.sourceId, id, DERIVED_SERIES.has(input.seriesKey))).filter((r): r is SourceRef => r !== null));
    const { inputs: _inputs, tileId: _tile, labelKey, ...rest } = view;
    out.get(row.tileId)?.push({ ...rest, label: labelKey, sources });
  }
  const total = totalWiped(views);
  return { tiles: TILE_ORDER.map((tileId) => ({ tileId, rows: out.get(tileId) ?? [] })), ...(total ? { totalWiped: total } : {}) };
}
