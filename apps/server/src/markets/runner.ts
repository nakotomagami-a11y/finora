import "server-only";
// Runs one Crash monitor source once (loaders/markets.md §1.7): fetch through the polite fetcher,
// read the as-of, skip an unchanged or older artifact, write series with the sync that carries the
// licence, and purge only inside the window under the purge guard. The only place that touches the
// store and the sources together for markets (architecture §2).
import { createHash } from "node:crypto";
import type { DropReason } from "@finora/domain";
import { ProviderRefused, SchemaChanged, type FetchContext, type MarketConnector, type RawArtifact } from "@finora/markets";
import { checkSource, FetchError, politeFetch, type FieldMap, type Licence, type PoliteFetch, type SourceMeta } from "@finora/sources";
import {
  beginSync,
  countMarketObservations,
  deleteMarketObservations,
  finishSync,
  lastContentSync,
  missingMarketDates,
  putMarketLatest,
  putMarketObservations,
  setContentHash,
  transaction,
  upsertMarketSeries,
  upsertSource,
  type Store,
} from "@finora/store";

export type MarketRunOutcome =
  | { kind: "content" | "unchanged" | "stale_skipped" | "partial"; syncId: number }
  | { kind: "failed"; syncId: number; reason: MarketFailure }
  | { kind: "skipped"; reason: "invalid_source" | "daily_limit" };
export type MarketFailure = "key_rejected" | "not_found" | "rate_limited" | "provider_error" | "schema_changed" | "as_of_missing" | "network";

export type RunOptions = {
  mode: FetchContext["mode"];
  now: string;
  windowStart: string;
  /** Licences registered from the user's local provider file (H4), checked with the built-in ones. */
  licences: Readonly<Record<string, Licence>>;
  userAgent: string;
  /** Tests and the fixtures profile inject a fetch; otherwise the polite fetcher on the connector's hosts. */
  fetch?: PoliteFetch;
};

/** The only classes a market series may be written under: open data in main, licensed series in cc (R17). */
const WRITABLE = { store: "main", "connector-cache": "cc" } as const;
const where = (c: MarketConnector) => WRITABLE[c.meta.storage as keyof typeof WRITABLE];

/** The licence invariants of every source (R12, R13, R17): a connector that fails them never writes a row. */
export function connectorProblems(c: MarketConnector, licences: Readonly<Record<string, Licence>> = {}): string[] {
  return checkSource(c.meta as SourceMeta, c.fieldMap as FieldMap, c.fetchHosts, licences);
}

function contentHash(raw: readonly RawArtifact[], parserVersion: string): string {
  const h = createHash("sha256").update(parserVersion);
  for (const a of [...raw].sort((x, y) => (x.name < y.name ? -1 : 1))) h.update(a.name).update(a.bytes);
  return h.digest("hex");
}

function failureOf(error: unknown): MarketFailure {
  if (error instanceof FetchError) {
    if (error.code === "http_status") return error.status === 401 || error.status === 403 ? "key_rejected" : error.status === 404 ? "not_found" : error.status === 429 ? "rate_limited" : "provider_error";
    return "network";
  }
  if (error instanceof ProviderRefused) return error.code;
  if (error instanceof SchemaChanged) return "schema_changed";
  return "provider_error";
}

export async function runMarketSource(store: Store, c: MarketConnector, opts: RunOptions): Promise<MarketRunOutcome> {
  // A class other than store or connector-cache (agent-only, live-no-store) may hold no market row at all (S22 review M2).
  if (connectorProblems(c, opts.licences).length || !(c.meta.storage in WRITABLE)) return { kind: "skipped", reason: "invalid_source" };
  const { db } = store;
  const storage = c.meta.storage;
  upsertSource(db, { id: c.meta.id, storage, purgeScope: c.meta.purgeScope }, opts.now);
  const syncId = beginSync(db, { sourceId: c.meta.id, licenceId: c.meta.licence, storage, parserVersion: c.parserVersion, startedAt: opts.now });
  const fail = (reason: MarketFailure): MarketRunOutcome => {
    finishSync(db, syncId, { kind: "failed", finishedAt: opts.now, report: { reason } });
    return { kind: "failed", syncId, reason };
  };

  const fetch = opts.fetch ?? politeFetch({ officialHosts: c.meta.officialHosts, userAgent: opts.userAgent, requestsPerSecond: c.meta.limits.requestsPerSecond ?? 1, maxBytes: 32 * 1024 ** 2 });
  let raw: RawArtifact[];
  try {
    raw = await c.fetch({ fetch, now: opts.now, windowStart: opts.windowStart, mode: opts.mode });
  } catch (error) {
    return fail(failureOf(error));
  }

  let asOf: string | null = null;
  let basis: string | null = null;
  try {
    const yielded = c.asOf(raw);
    for (const strategy of c.meta.asOf) {
      const v = yielded[strategy];
      if (v) {
        asOf = v;
        basis = strategy;
        break;
      }
    }
  } catch (error) {
    return fail(failureOf(error));
  }
  if (!asOf || !basis) return fail("as_of_missing");

  // Latest-only runs (quotes, snapshots) always write: their artifact changes every few minutes.
  const hash = contentHash(raw, c.parserVersion);
  const last = lastContentSync(db, c.meta.id);
  if (opts.mode === "daily" && last && last.contentHash === hash && last.parserVersion === c.parserVersion) {
    finishSync(db, syncId, { kind: "unchanged", finishedAt: opts.now, upstreamAsOf: asOf, asOfBasis: basis });
    return { kind: "unchanged", syncId };
  }
  // By day: a quote run of the same source records a later time on the same day than its daily candles.
  if (opts.mode === "daily" && last?.upstreamAsOf && asOf.slice(0, 10) < last.upstreamAsOf.slice(0, 10)) {
    finishSync(db, syncId, { kind: "stale_skipped", finishedAt: opts.now, upstreamAsOf: asOf, asOfBasis: basis });
    return { kind: "stale_skipped", syncId };
  }

  let parsed;
  try {
    parsed = c.parse(raw, { now: opts.now, windowStart: opts.windowStart });
  } catch (error) {
    return fail(failureOf(error));
  }

  const dropped: Partial<Record<DropReason, number>> = {};
  for (const d of parsed.dropped) dropped[d.reason] = (dropped[d.reason] ?? 0) + 1;
  let written = 0;
  let unchanged = 0;
  let deleted = 0;
  let guarded = false;
  transaction(
    db,
    () => {
      for (const s of parsed.series) {
        const seriesId = upsertMarketSeries(db, where(c), { ...s.series, sourceId: c.meta.id });
        if (s.observations) {
          const r = putMarketObservations(db, where(c), seriesId, s.observations, syncId);
          written += r.written;
          unchanged += r.unchanged;
          // Window purge: only inside the pulled date range, and only within the guard (A2).
          if (c.meta.purgeScope === "window" && s.observations.length > 0) {
            const from = s.observations[0]?.date as string;
            const to = s.observations.at(-1)?.date as string;
            const missing = missingMarketDates(db, where(c), seriesId, from, to, new Set(s.observations.map((o) => o.date)));
            const total = countMarketObservations(db, where(c), seriesId);
            if (missing.length > Math.floor(c.meta.maxPurgeShare * total)) guarded = true;
            else deleted += deleteMarketObservations(db, where(c), seriesId, missing);
          }
        }
        if (s.latest) {
          putMarketLatest(db, where(c), seriesId, s.latest, syncId);
          written++;
        }
      }
    },
    "IMMEDIATE",
  );
  setContentHash(db, syncId, hash);
  const kind = guarded ? "partial" : "content";
  finishSync(db, syncId, { kind, finishedAt: opts.now, upstreamAsOf: asOf, asOfBasis: basis, report: { written, unchanged, deleted, series: parsed.series.length, dropped, ...(guarded ? { reason: "purge_guard" } : {}) } });
  return { kind, syncId };
}
