// Crash monitor series (loaders/markets.md §1.2, architecture §8). Open-licence series live in
// `main`, licensed ones in `cc` (connector-cache.db, R17). A value's provenance is the sync that
// wrote it: licence, retrieval time and upstream as-of come from `main.syncs`.
import type { DatabaseSync } from "node:sqlite";

export type MarketDb = "main" | "cc";
export type MarketUnit = "index_points" | "usd" | "usd_per_oz" | "usd_per_bbl" | "usd_cap" | "coins";
export type MarketFrequency = "daily_exchange" | "daily_7d" | "monthly" | "quarterly";

export type MarketSeriesInput = {
  seriesKey: string;
  sourceId: string;
  itemId: string;
  unit: MarketUnit;
  frequency: MarketFrequency;
  symbol?: string | null;
};
export type MarketObservation = { date: string; value: number };

/** Creates or updates a series row; a changed symbol (a fund slot moved to another fund) first drops its values. */
export function upsertMarketSeries(db: DatabaseSync, where: MarketDb, series: MarketSeriesInput): number {
  const symbol = series.symbol ?? null;
  const existing = db.prepare(`SELECT id, symbol FROM ${where}.market_series WHERE series_key = ?`).get(series.seriesKey) as
    | { id: number; symbol: string | null }
    | undefined;
  if (existing && existing.symbol !== symbol) {
    db.prepare(`DELETE FROM ${where}.market_series WHERE id = ?`).run(existing.id);
  } else if (existing) {
    db.prepare(`UPDATE ${where}.market_series SET source_id = ?, item_id = ?, unit = ?, frequency = ? WHERE id = ?`).run(
      series.sourceId,
      series.itemId,
      series.unit,
      series.frequency,
      existing.id,
    );
    return existing.id;
  }
  const result = db
    .prepare(`INSERT INTO ${where}.market_series (series_key, source_id, item_id, unit, frequency, symbol) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(series.seriesKey, series.sourceId, series.itemId, series.unit, series.frequency, symbol);
  return Number(result.lastInsertRowid);
}

/**
 * Upserts observations by date. A value that did not change keeps its old sync (its provenance is
 * the sync that wrote it); a changed one, such as a revision, records this sync.
 */
export function putMarketObservations(db: DatabaseSync, where: MarketDb, seriesId: number, obs: readonly MarketObservation[], syncId: number): { written: number; unchanged: number } {
  const read = db.prepare(`SELECT value FROM ${where}.market_obs WHERE series_id = ? AND date = ?`);
  const write = db.prepare(
    `INSERT INTO ${where}.market_obs (series_id, date, value, sync_id) VALUES (?, ?, ?, ?)
     ON CONFLICT (series_id, date) DO UPDATE SET value = excluded.value, sync_id = excluded.sync_id`,
  );
  let written = 0;
  let unchanged = 0;
  for (const o of obs) {
    if (!Number.isFinite(o.value)) throw new RangeError(`non-finite market value on ${o.date}`);
    const old = read.get(seriesId, o.date) as { value: number } | undefined;
    if (old && old.value === o.value) {
      unchanged++;
      continue;
    }
    write.run(seriesId, o.date, o.value, syncId);
    written++;
  }
  return { written, unchanged };
}

/** Dates of a series' observations in [from, to] that are absent from `keep`: what a window purge would delete. */
export function missingMarketDates(db: DatabaseSync, where: MarketDb, seriesId: number, from: string, to: string, keep: ReadonlySet<string>): string[] {
  const rows = db.prepare(`SELECT date FROM ${where}.market_obs WHERE series_id = ? AND date >= ? AND date <= ? ORDER BY date`).all(seriesId, from, to) as { date: string }[];
  return rows.map((r) => r.date).filter((d) => !keep.has(d));
}

export function countMarketObservations(db: DatabaseSync, where: MarketDb, seriesId: number): number {
  return (db.prepare(`SELECT count(*) AS n FROM ${where}.market_obs WHERE series_id = ?`).get(seriesId) as { n: number }).n;
}

export function deleteMarketObservations(db: DatabaseSync, where: MarketDb, seriesId: number, dates: readonly string[]): number {
  const del = db.prepare(`DELETE FROM ${where}.market_obs WHERE series_id = ? AND date = ?`);
  let n = 0;
  for (const d of dates) n += Number(del.run(seriesId, d).changes);
  return n;
}

/** Drops observations before the window start (a later `peakSince` setting). */
export function trimMarketWindow(db: DatabaseSync, before: string): number {
  let n = 0;
  for (const where of ["main", "cc"] as const) n += Number(db.prepare(`DELETE FROM ${where}.market_obs WHERE date < ?`).run(before).changes);
  return n;
}

export function putMarketLatest(db: DatabaseSync, where: MarketDb, seriesId: number, latest: { value: number; observedAt: string }, syncId: number): void {
  if (!Number.isFinite(latest.value)) throw new RangeError("non-finite market value");
  db.prepare(
    `INSERT INTO ${where}.market_latest (series_id, value, observed_at, sync_id) VALUES (?, ?, ?, ?)
     ON CONFLICT (series_id) DO UPDATE SET value = excluded.value, observed_at = excluded.observed_at, sync_id = excluded.sync_id`,
  ).run(seriesId, latest.value, latest.observedAt, syncId);
}

/** Deletes latest snapshots of a source older than `before` (C1's terms: refresh within 24 h, or delete). */
export function expireMarketLatest(db: DatabaseSync, where: MarketDb, sourceId: string, before: string): number {
  return Number(
    db
      .prepare(`DELETE FROM ${where}.market_latest WHERE observed_at < ? AND series_id IN (SELECT id FROM ${where}.market_series WHERE source_id = ?)`)
      .run(before, sourceId).changes,
  );
}

/** Removes every series of a source, with its values (a key removed in Settings, a slot cleared). */
export function deleteMarketSource(db: DatabaseSync, where: MarketDb, sourceId: string): number {
  return Number(db.prepare(`DELETE FROM ${where}.market_series WHERE source_id = ?`).run(sourceId).changes);
}

export function deleteMarketSeries(db: DatabaseSync, where: MarketDb, seriesKey: string): number {
  return Number(db.prepare(`DELETE FROM ${where}.market_series WHERE series_key = ?`).run(seriesKey).changes);
}

export type MarketSyncInfo = { syncId: number; licenceId: string; retrievedAt: string; asOf: string | null; asOfBasis: string | null };
export type StoredMarketSeries = MarketSeriesInput & {
  where: MarketDb;
  observations: (MarketObservation & { syncId: number })[];
  latest: { value: number; observedAt: string; syncId: number } | null;
};

/** Every stored series of both files, with its observations in date order and its latest snapshot. */
export function readMarketSeries(db: DatabaseSync): StoredMarketSeries[] {
  const out: StoredMarketSeries[] = [];
  for (const where of ["main", "cc"] as const) {
    const series = db.prepare(`SELECT id, series_key, source_id, item_id, unit, frequency, symbol FROM ${where}.market_series ORDER BY series_key`).all() as {
      id: number;
      series_key: string;
      source_id: string;
      item_id: string;
      unit: MarketUnit;
      frequency: MarketFrequency;
      symbol: string | null;
    }[];
    const obs = db.prepare(`SELECT date, value, sync_id FROM ${where}.market_obs WHERE series_id = ? ORDER BY date`);
    const latest = db.prepare(`SELECT value, observed_at, sync_id FROM ${where}.market_latest WHERE series_id = ?`);
    for (const s of series) {
      const l = latest.get(s.id) as { value: number; observed_at: string; sync_id: number } | undefined;
      out.push({
        where,
        seriesKey: s.series_key,
        sourceId: s.source_id,
        itemId: s.item_id,
        unit: s.unit,
        frequency: s.frequency,
        symbol: s.symbol,
        observations: (obs.all(s.id) as { date: string; value: number; sync_id: number }[]).map((o) => ({ date: o.date, value: o.value, syncId: o.sync_id })),
        latest: l ? { value: l.value, observedAt: l.observed_at, syncId: l.sync_id } : null,
      });
    }
  }
  return out;
}

/** Provenance of the syncs a set of market values came from. */
export function marketSyncInfo(db: DatabaseSync, syncIds: readonly number[]): Map<number, MarketSyncInfo> {
  const read = db.prepare(`SELECT id, licence_id, started_at, upstream_as_of, as_of_basis FROM main.syncs WHERE id = ?`);
  const out = new Map<number, MarketSyncInfo>();
  for (const id of new Set(syncIds)) {
    const r = read.get(id) as { id: number; licence_id: string; started_at: string; upstream_as_of: string | null; as_of_basis: string | null } | undefined;
    if (r) out.set(id, { syncId: r.id, licenceId: r.licence_id, retrievedAt: r.started_at, asOf: r.upstream_as_of, asOfBasis: r.as_of_basis });
  }
  return out;
}

/** The latest content or unchanged sync of a source: what a row shows as "checked" (A5). */
export function marketCheckedAt(db: DatabaseSync, sourceId: string): string | null {
  const r = db
    .prepare(`SELECT max(coalesce(finished_at, started_at)) AS at FROM main.syncs WHERE source_id = ? AND kind IN ('content', 'unchanged')`)
    .get(sourceId) as { at: string | null };
  return r.at;
}

/** The latest finished sync of a source, whatever its kind: a failure with nothing stored shows as an error. */
/** Closes the syncs a crashed run of this source left running, before a new one starts (N3). */
export function failRunningMarketSyncs(db: DatabaseSync, sourceId: string, at: string): number {
  return Number(
    db.prepare("UPDATE main.syncs SET kind = 'failed', finished_at = ?, report_json = ? WHERE source_id = ? AND kind = 'running'").run(at, JSON.stringify({ reason: "interrupted" }), sourceId).changes,
  );
}

export function lastMarketSync(db: DatabaseSync, sourceId: string): { kind: string; finishedAt: string | null } | null {
  const r = db
    .prepare(`SELECT kind, finished_at FROM main.syncs WHERE source_id = ? AND kind <> 'running' ORDER BY id DESC LIMIT 1`)
    .get(sourceId) as { kind: string; finished_at: string | null } | undefined;
  return r ? { kind: r.kind, finishedAt: r.finished_at } : null;
}
