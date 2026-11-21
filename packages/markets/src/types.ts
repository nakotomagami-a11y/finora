// The Crash monitor data layer's types (docs/plan/loaders/markets.md). This package depends on
// `domain` only (architecture §2): connectors are metadata plus pure parsers, and the fetch they
// use is injected by the server, which owns the store writes.
import type { DropReason } from "@finora/domain";

export type MarketUnit = "index_points" | "usd" | "usd_per_oz" | "usd_per_bbl" | "usd_cap" | "coins";
export type MarketFrequency = "daily_exchange" | "daily_7d" | "monthly" | "quarterly";
export type AsOfStrategy = "in_file_field" | "in_file_name" | "max_date_in_data" | "portal_metadata" | "http_last_modified";

/** Field for field the shape of `SourceMeta` in `@finora/sources`, so the server checks it with `checkSource`. */
export type MarketMeta = {
  id: string;
  country: "lt" | "lv" | "ee" | "us" | "intl";
  publisher: string;
  homepage: string;
  officialHosts: string[];
  licence: string;
  attribution: string | null;
  storage: "store" | "connector-cache";
  cadence: "daily" | "weekly" | "monthly" | "quarterly" | "on-view";
  publishedAtUtc: string | null;
  asOf: AsOfStrategy[];
  maxPurgeShare: number;
  purgeScope: "window" | "none";
  deepLink: string | null;
  orderUrl: null;
  requires: string[];
  limits: { requestsPerSecond?: number; dailyRequests?: number };
  items: string[];
};

export type MarketFieldMapEntry = {
  field: string;
  target: { concept: string } | { dropped: DropReason };
  itemId?: string;
  personal: false;
};

export type Fetch = (url: string, init?: { headers?: Record<string, string>; body?: string; idempotent?: boolean }) => Promise<{ status: number; headers: Record<string, string>; bytes: Uint8Array }>;
export type RawArtifact = { name: string; bytes: Uint8Array; headers?: Record<string, string>; fetchedAt: string };

export type FetchContext = {
  fetch: Fetch;
  /** Values of `meta.requires` and optional keys, read by the server's env module. */
  keys: Record<string, string>;
  now: string;
  /** Observations are wanted from this date (peakSince − 10 days). */
  windowStart: string;
  /** Fund slots with a symbol (stocks only). */
  slots: readonly { slot: string; symbol: string }[];
  /** "daily" pulls history; "latest" pulls only the current quote or snapshot. */
  mode: "daily" | "latest";
};

export type SeriesDef = { seriesKey: string; itemId: string; unit: MarketUnit; frequency: MarketFrequency; symbol?: string | null };
export type Observation = { date: string; value: number };

export type ParsedSeries = {
  series: SeriesDef;
  observations?: Observation[];
  latest?: { value: number; observedAt: string };
};

export type MarketParse = {
  series: ParsedSeries[];
  /** Counted in the sync report: reason and field name only, never a value (SEC-2). */
  dropped: { reason: DropReason; field: string }[];
};

export interface MarketConnector {
  meta: MarketMeta;
  /** Changes whenever the parser, its field map, the item list or the tile config changes (A1). */
  parserVersion: string;
  fieldMap: readonly MarketFieldMapEntry[];
  /** Every host `fetch` may call; all must be in `meta.officialHosts`. */
  fetchHosts: readonly string[];
  fetch(ctx: FetchContext): Promise<RawArtifact[]>;
  /** The date each strategy yields; the runner takes the first in `meta.asOf` order. */
  asOf(raw: RawArtifact[]): Partial<Record<AsOfStrategy, string | null>>;
  parse(raw: RawArtifact[], ctx: { now: string; windowStart: string }): MarketParse;
}
