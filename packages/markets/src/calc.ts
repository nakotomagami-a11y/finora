// Crash monitor maths (loaders/markets.md §1.4). Pure: stored observations and settings in, one
// row view out. Nothing here fetches, stores or reads the clock.
import { addDays } from "./settings.ts";
import type { TileRow } from "./tiles.ts";
import type { MarketFrequency, MarketUnit } from "./types.ts";

export type StoredObs = { date: string; value: number; syncId?: number };
export type StoredLatest = { value: number; observedAt: string; syncId?: number };
export type SeriesData = { observations: readonly StoredObs[]; latest: StoredLatest | null };
/** A cited official figure that seeds a peak (seeds.ts); empty in v1 until legal clears one. */
export type Seed = { seriesKey: string; date: string; value: number; citation: string; licence: string };

export type RowState = "ok" | "stale" | "not_configured" | "peak_unknown" | "error" | "loading";
export type Cadence = MarketFrequency | "live";

export type RowView = {
  rowKey: string;
  tileId: TileRow["tileId"];
  itemId: string;
  labelKey: string;
  state: RowState;
  unit: MarketUnit;
  value?: number;
  /** Date of the close, or timestamp of the live value, the row shows. */
  asOf?: string;
  peak?: { value: number; date: string; basis: "since" | "all_time" | "seeded" };
  trackingSince?: string;
  dayChangePct?: number;
  drawdownPct?: number;
  valueLostUsd?: number;
  cadence: Cadence;
  delayed: boolean;
  /** The syncs of every value the row used, per series: its provenance. */
  inputs: { seriesKey: string; syncIds: number[] }[];
  /** M08 only: the estimate the client ticks forward from. */
  ticker?: { total: number; anchor: string; perSecond: number };
};

export type RowContext = {
  peakSince: string;
  now: string;
  /** False when the row's provider is not in the user's local provider file (H4). */
  configured: boolean;
  /** The source's last sync failed, and nothing usable is stored. */
  sourceFailed: boolean;
  seeds: readonly Seed[];
};

/** A live value older than this is ignored and the row falls back to the last close (2x the hourly poll). */
export const LATEST_MAX_AGE_MS = 2 * 60 * 60 * 1000;
/** A supply snapshot older than this hides value lost (the drawdown stays). */
export const SUPPLY_MAX_AGE_DAYS = 2;
const GRACE_DAYS: Record<MarketFrequency, number> = { daily_exchange: 7, daily_7d: 7, monthly: 31, quarterly: 92 };

const day = (iso: string) => iso.slice(0, 10);
const ms = (iso: string) => Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
const daysBetween = (a: string, b: string) => Math.round((ms(day(b)) - ms(day(a))) / 86_400_000);

/** Weekdays strictly between two dates (no holiday calendar). */
export function weekdaysBetween(from: string, to: string): number {
  let n = 0;
  for (let d = addDays(from, 1); d < day(to); d = addDays(d, 1)) {
    const w = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

/** Council clarification 1: stale once older than twice the cadence. */
export function isStale(frequency: MarketFrequency, lastDate: string, now: string): boolean {
  switch (frequency) {
    case "daily_exchange":
      return weekdaysBetween(lastDate, now) > 2;
    case "daily_7d":
      return daysBetween(lastDate, now) > 2;
    case "monthly":
      return daysBetween(lastDate, now) > 62;
    case "quarterly":
      return daysBetween(lastDate, now) > 184;
  }
}

function freshLatest(latest: StoredLatest | null, now: string): StoredLatest | null {
  if (!latest) return null;
  return ms(now) - ms(latest.observedAt) <= LATEST_MAX_AGE_MS ? latest : null;
}

function syncIds(...values: ({ syncId?: number } | null | undefined)[]): number[] {
  return [...new Set(values.map((v) => v?.syncId).filter((id): id is number => id !== undefined))];
}

/** One row of the Crash monitor from its stored series. */
export function computeRow(row: TileRow, data: ReadonlyMap<string, SeriesData>, ctx: RowContext): RowView {
  const view: RowView = { rowKey: row.rowKey, tileId: row.tileId, itemId: row.itemId, labelKey: row.labelKey, state: "loading", unit: row.unit, cadence: row.frequency, delayed: row.delayed, inputs: [] };
  if (!ctx.configured) return { ...view, state: "not_configured" };

  const own = data.get(row.seriesKey) ?? { observations: [], latest: null };
  const seed = ctx.seeds.find((s) => s.seriesKey === row.seriesKey);
  const obs = [...own.observations].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const lastClose = obs.at(-1);
  const live = row.latestOnly ? own.latest : freshLatest(own.latest, ctx.now);
  const useLive = live !== null && (!lastClose || day(live.observedAt) >= lastClose.date);
  const current = useLive ? { value: live.value, at: live.observedAt, ref: live } : lastClose ? { value: lastClose.value, at: lastClose.date, ref: lastClose } : null;
  if (!current) return { ...view, state: ctx.sourceFailed ? "error" : "loading" };

  view.value = current.value;
  view.asOf = current.at;
  view.cadence = useLive && !row.latestOnly ? "live" : row.frequency;
  const used: StoredObs[] = [];

  // Peak: an all-time high from another series, or the highest close since peakSince (a seed counts as one).
  if (row.peakSeriesKey) {
    const ath = data.get(row.peakSeriesKey)?.latest ?? null;
    const peakValue = Math.max(ath?.value ?? -Infinity, current.value);
    if (!Number.isFinite(peakValue)) return { ...view, state: "error" };
    const fromAth = ath !== null && ath.value >= current.value;
    view.peak = { value: peakValue, date: fromAth ? day(ath.observedAt) : day(current.at), basis: "all_time" };
    view.inputs.push({ seriesKey: row.peakSeriesKey, syncIds: syncIds(fromAth ? ath : null) });
  } else {
    const first = obs[0]?.date ?? day(current.at);
    // A seed is a cited figure for the peak itself, so with one the peak is known whatever the history.
    const peakKnown = seed !== undefined || first <= addDays(ctx.peakSince, GRACE_DAYS[row.frequency]);
    if (!peakKnown) {
      view.state = "peak_unknown";
      view.trackingSince = first;
    } else {
      const candidates: { value: number; date: string; seeded: boolean; ref?: StoredObs }[] = obs
        .filter((o) => o.date >= ctx.peakSince)
        .map((o) => ({ value: o.value, date: o.date, seeded: false, ref: o }));
      if (seed && seed.date >= ctx.peakSince) candidates.push({ value: seed.value, date: seed.date, seeded: true });
      candidates.push({ value: current.value, date: day(current.at), seeded: false });
      const peak = candidates.reduce((best, c) => (c.value > best.value || (c.value === best.value && c.date > best.date) ? c : best));
      view.peak = { value: peak.value, date: peak.date, basis: peak.seeded ? "seeded" : "since" };
      if (peak.ref) used.push(peak.ref);
    }
  }

  if (view.peak && view.state !== "peak_unknown") view.drawdownPct = Math.min(0, (current.value / view.peak.value - 1) * 100);

  if (row.frequency === "daily_exchange" || row.frequency === "daily_7d") {
    const previous = [...obs].reverse().find((o) => o.date < day(current.at));
    if (previous && previous.value !== 0) {
      view.dayChangePct = (current.value / previous.value - 1) * 100;
      used.push(previous);
    }
  }

  if (view.peak && view.state !== "peak_unknown") {
    if (row.valueLost === "series") view.valueLostUsd = view.peak.value - current.value;
    if (row.valueLost === "supply" && row.supplySeriesKey) {
      const supply = data.get(row.supplySeriesKey)?.latest ?? null;
      if (supply && daysBetween(supply.observedAt, ctx.now) <= SUPPLY_MAX_AGE_DAYS) {
        view.valueLostUsd = (view.peak.value - current.value) * supply.value;
        view.inputs.push({ seriesKey: row.supplySeriesKey, syncIds: syncIds(supply) });
      }
    }
  }

  view.inputs.unshift({ seriesKey: row.seriesKey, syncIds: syncIds(current.ref, ...used) });
  if (view.state === "loading") view.state = isStale(row.frequency, day(current.at), ctx.now) ? "stale" : "ok";
  return view;
}

/** totalWiped: the sum over countInTotal rows with a value lost; a counted row without one is excluded, never replaced by its parts. */
export function totalWiped(rows: readonly (RowView & { countInTotal: boolean })[]): { valueUsd: number; rowItemIds: string[]; excludedItemIds: string[]; oldestAsOf: string } | null {
  const counted = rows.filter((r) => r.countInTotal);
  const included = counted.filter((r) => r.valueLostUsd !== undefined && r.asOf !== undefined);
  if (included.length === 0) return null;
  return {
    valueUsd: included.reduce((sum, r) => sum + (r.valueLostUsd ?? 0), 0),
    rowItemIds: included.map((r) => r.itemId),
    excludedItemIds: counted.filter((r) => !included.includes(r)).map((r) => r.itemId),
    oldestAsOf: included.map((r) => r.asOf as string).sort()[0] as string,
  };
}
