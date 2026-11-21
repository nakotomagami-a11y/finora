// One sync of one source (architecture §4.4): fetch, as-of check, parse and gate, stage, write in
// time-bounded transactions, purge under the guard, history, report. Runs under the source's
// `sync:<id>` lease, kept alive by a heartbeat for the whole sync, so two syncs of one source
// never overlap.
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { ParsedRecord, PoliteFetch, RawArtifact, SourceLoader, StorageClass } from "@finora/sources";
import {
  acquireLease,
  beginStaging,
  beginSync,
  countRecords,
  deleteRecords,
  endStaging,
  entityByCode,
  finishSync,
  heartbeat,
  holdsLease,
  lastContentStorage,
  lastContentSync,
  missingRecords,
  purgeShareAlike,
  purgeSourceFromMain,
  recordId,
  recordLines,
  releaseLease,
  replaceShareAlike,
  setContentHash,
  shareAlikeRecords,
  stage,
  StoreError,
  tombstoneRecord,
  upsertSource,
  writeFinoraEvent,
  writeRecord,
} from "@finora/store";
import { applyGates, type Drop, type GateResult } from "./gates.ts";
import { snapshot, writeHistory } from "./history.ts";
import { clearLiveView, liveView, setLiveView, type LiveView } from "./live-views.ts";
import { dropRaw, loadRaw, saveRaw } from "./raw-cache.ts";
import { validateRecord } from "./validate.ts";

export type SyncKind = "content" | "unchanged" | "stale_skipped" | "partial" | "failed" | "already_running";

export type SyncReport = {
  read: number;
  written: number;
  unchanged: number;
  deleted: number;
  tombstoned: number;
  skipped: Record<string, number>;
  dropped: Record<string, number>;
  /** Refused values by prop and row-local reference: never the value (legal 7058881476). */
  droppedRows: Drop[];
  events: number;
  durationMs: number;
  reason?: string;
  token?: string;
  storage: StorageClass;
};

export type SyncOutcome = { kind: SyncKind; syncId: number | null; report: SyncReport | null };

export type Logger = { info(message: string, fields?: Record<string, unknown>): void; warn(message: string, fields?: Record<string, unknown>): void };
const silent: Logger = { info: () => {}, warn: () => {} };

export type SyncOptions = {
  fetcher: PoliteFetch;
  keys?: Record<string, string>;
  now?: () => Date;
  /** Where the latest artifacts are kept; null keeps none. */
  rawCacheDir?: string | null;
  /** `SHARE_ALIKE_MODE`: "live-no-store" keeps a share-alike source in memory only. */
  shareAlikeMode?: "store" | "live-no-store";
  allowMassPurge?: boolean;
  holder?: string;
  leaseTtlMs?: number;
  /** Records per transaction, and the time one transaction may hold the write lock. */
  batch?: { maxRecords?: number; maxMs?: number };
  signal?: AbortSignal;
  logger?: Logger;
  /** Register type values that prove a party is a company (LV LEGAL_ENTITY, EE J). */
  companyPartyTypes?: readonly string[];
  /** A live-no-store view, for the process that serves it (a worker posts it to the app; qa M1). */
  onLiveView?: (sourceId: string, view: LiveView) => void;
  /** Whether the serving process holds this source's live view; without one, never "unchanged". */
  liveViewHeld?: boolean;
  /** Called on every successful heartbeat: a worker's parent watches it to spot a hung sync. */
  onProgress?: () => void;
  /** Called with the sync row this run opened, so a watcher can close exactly that row (qa on S04i). */
  onStart?: (syncId: number) => void;
};

export function effectiveStorage(loader: SourceLoader, mode: SyncOptions["shareAlikeMode"]): StorageClass {
  return loader.meta.storage === "share-alike-store" && mode === "live-no-store" ? "live-no-store" : loader.meta.storage;
}

function contentHash(artifacts: readonly RawArtifact[]): string {
  const hash = createHash("sha256");
  for (const a of artifacts) hash.update(a.name).update("\0").update(a.bytes).update("\0");
  return hash.digest("hex");
}

function lastToken(db: DatabaseSync, sourceId: string): string | null {
  const row = db
    .prepare("SELECT report_json FROM main.syncs WHERE source_id = ? AND kind IN ('content', 'unchanged') AND report_json IS NOT NULL ORDER BY id DESC LIMIT 1")
    .get(sourceId) as { report_json: string } | undefined;
  if (!row) return null;
  return (JSON.parse(row.report_json) as { token?: string }).token ?? null;
}

const bump = (counts: Record<string, number>, key: string, n = 1) => (counts[key] = (counts[key] ?? 0) + n);

/** Thrown inside a sync when its lease was lost: everything in flight rolls back. */
class LeaseLost extends Error {}

/** Every string a value of `refused` appears in is masked, so no row hash covers a personal code. */
function masked(hashInput: readonly string[], refused: readonly string[]): string[] {
  if (refused.length === 0) return [...hashInput];
  return hashInput.map((h) => refused.reduce((text, value) => (value ? text.split(value).join("[withheld]") : text), h));
}

export async function runSync(db: DatabaseSync, loader: SourceLoader, options: SyncOptions): Promise<SyncOutcome> {
  const { meta } = loader;
  const now = options.now ?? (() => new Date());
  const logger = options.logger ?? silent;
  const ttl = options.leaseTtlMs ?? 60_000;
  const holder = options.holder ?? `sync-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const storage = effectiveStorage(loader, options.shareAlikeMode);
  if (storage === "live-cached" || storage === "agent-only" || storage === "connector-cache") {
    throw new Error(`${meta.id}: a ${storage} source is never synced in bulk`);
  }

  const resource = `sync:${meta.id}`;
  const lease = acquireLease(db, resource, holder, ttl, now().getTime());
  if (!lease) {
    logger.info("sync already running", { sourceId: meta.id });
    return { kind: "already_running", syncId: null, report: null };
  }
  // Heartbeat from acquisition to release (SEC-3, qa M2): a long download or parse keeps the
  // lease; a lease taken over by another holder stops this sync before it writes again.
  let lost = false;
  const beat = () => {
    if (lost || db.isTransaction) return;
    if (heartbeat(db, lease, ttl, now().getTime())) options.onProgress?.();
    else lost = true;
  };
  const timer = setInterval(beat, Math.max(10, Math.floor(ttl / 3)));
  const assertLease = () => {
    if (lost || !holdsLease(db, resource, holder, now().getTime())) {
      lost = true;
      throw new LeaseLost();
    }
  };
  /** Fencing (qa on S04i): the lease row is renewed inside the write transaction itself, so a
   *  takeover between two transactions rolls back whatever this one would have written. */
  const begin = () => {
    db.exec("BEGIN IMMEDIATE");
    if (lost || !heartbeat(db, lease, ttl, now().getTime())) {
      lost = true;
      db.exec("ROLLBACK");
      throw new LeaseLost();
    }
  };

  const started = now();
  const startedAt = started.toISOString();
  upsertSource(db, { id: meta.id, storage, purgeScope: meta.purgeScope }, startedAt);
  const syncId = beginSync(db, { sourceId: meta.id, licenceId: meta.licence, storage, parserVersion: loader.parserVersion, startedAt });
  options.onStart?.(syncId);
  const report = emptyReport(storage);
  const finish = (kind: Exclude<SyncKind, "already_running">, extra: { reason?: string; upstreamAsOf?: string | null; asOfBasis?: string | null } = {}): SyncOutcome => {
    report.durationMs = now().getTime() - started.getTime();
    if (extra.reason) report.reason = extra.reason;
    finishSync(db, syncId, {
      kind,
      finishedAt: now().toISOString(),
      ...(extra.upstreamAsOf ? { upstreamAsOf: extra.upstreamAsOf } : {}),
      ...(extra.asOfBasis ? { asOfBasis: extra.asOfBasis } : {}),
      report,
    });
    // Counts only: a sync log line never carries a value (P3, live-no-store condition 1).
    logger.info("sync finished", { sourceId: meta.id, kind, read: report.read, written: report.written, deleted: report.deleted, dropped: report.dropped });
    return { kind, syncId, report };
  };

  try {
    const previous = lastContentSync(db, meta.id);
    const previousStorage = lastContentStorage(db, meta.id);
    const classChanged = previousStorage !== null && previousStorage !== storage;
    const keepRaw = meta.rawCache !== false && storage !== "live-no-store" && options.rawCacheDir;
    // A live-no-store source with no view held in the serving process must parse again: an
    // "unchanged" answer would leave it serving nothing (qa M1).
    const mustParse = classChanged || (storage === "live-no-store" && !(options.liveViewHeld ?? liveView(meta.id) !== null));

    let fetched = await loader.fetch({ fetcher: options.fetcher, keys: options.keys ?? {}, now: startedAt, lastToken: mustParse ? null : lastToken(db, meta.id) });
    assertLease();
    if (fetched.token) report.token = fetched.token;
    let artifacts: RawArtifact[] | null = fetched.unchanged ? null : fetched.artifacts;
    const sameParser = previous?.parserVersion === loader.parserVersion;
    if (artifacts === null) {
      if (sameParser && !mustParse) return finish("unchanged", { upstreamAsOf: previous?.upstreamAsOf ?? null });
      artifacts = keepRaw ? loadRaw(options.rawCacheDir as string, meta.id) : null;
      if (artifacts === null) {
        fetched = await loader.fetch({ fetcher: options.fetcher, keys: options.keys ?? {}, now: startedAt, lastToken: null });
        assertLease();
        if (fetched.unchanged) return finish("failed", { reason: "raw_cache_missing" });
        artifacts = fetched.artifacts;
      }
    }
    const hash = contentHash(artifacts);
    if (previous && previous.contentHash === hash && sameParser && !mustParse) {
      return finish("unchanged", { upstreamAsOf: previous.upstreamAsOf });
    }

    const dates = loader.asOf(artifacts);
    const basis = meta.asOf.find((s) => typeof dates[s] === "string" && dates[s] !== "");
    if (!basis) return finish("failed", { reason: "as_of_missing" });
    const asOf = dates[basis] as string;
    if (previous?.upstreamAsOf && asOf < previous.upstreamAsOf && !classChanged) {
      return finish("stale_skipped", { upstreamAsOf: previous.upstreamAsOf, reason: "older_than_last_sync" });
    }
    // Only a file that passed the as-of check replaces the cached one (qa M5).
    if (keepRaw) saveRaw(options.rawCacheDir as string, meta.id, artifacts);

    const gateOptions = {
      companyPartyTypes: options.companyPartyTypes ?? [],
      lookup: (country: string, code: string) => entityByCode(db, country, code),
    };
    const day = startedAt.slice(0, 10);
    const periods = new Set<string>();
    const deletes: string[] = [];
    const memory: { eid: string; prop: string; value: string; itemId: string }[] = [];
    let memoryRecords = 0;
    let complete = true;

    if (storage === "store") beginStaging(db);
    const maxMs = options.batch?.maxMs ?? 250;
    let maxRecords = options.batch?.maxRecords ?? 5000;
    let inBatch = 0;
    let batchStart = 0;
    const commit = () => {
      if (!db.isTransaction) return;
      db.exec("COMMIT");
      // A slow disk shrinks the batch, so the write lock is never held long (qa session 2).
      if (Date.now() - batchStart > maxMs && maxRecords > 50) maxRecords = Math.max(50, Math.floor(maxRecords / 2));
      beat();
    };

    let lastYield = Date.now();
    try {
      for await (const raw of loader.parse(artifacts, { now: startedAt })) {
        // A parse loop yields at least once a second, so the heartbeat timer can fire (cto on S04i).
        if (!db.isTransaction && Date.now() - lastYield > 1000) {
          await new Promise((r) => setImmediate(r));
          lastYield = Date.now();
        }
        if (options.signal?.aborted) {
          complete = false;
          report.reason = "interrupted";
          break;
        }
        report.read++;
        // Staged before validation: a record that fails validation is skipped, never purged (qa M4).
        const key = (raw as { recordKey?: unknown }).recordKey;
        if (storage === "store" && typeof key === "string" && key !== "" && (raw as { op?: unknown }).op !== "delete") stage(db, key);
        const checked = validateRecord(raw);
        if (!checked.ok) {
          bump(report.skipped, checked.reason);
          continue;
        }
        const record = checked.record;
        if (record.op === "delete") {
          // Explicit deletes belong to change feeds only (qa S8).
          if (meta.purgeScope === "none") deletes.push(record.recordKey);
          else bump(report.skipped, "delete_not_allowed");
          continue;
        }
        if (record.period) periods.add(record.period);
        const gated = applyGates(record, gateOptions);
        countDrops(report, gated.drops);

        if (storage !== "store") {
          // Share-alike and live-no-store rows stay keyed on the public eid; a fact is kept as
          // `<concept>@<period end>` until the share-alike loader slice (S07) shapes its own tables.
          memoryRecords++;
          for (const e of gated.entities) for (const s of e.statements) memory.push({ eid: e.eid, prop: s.prop, value: s.value, itemId: s.itemId });
          for (const r of gated.reports) {
            for (const f of r.facts) memory.push({ eid: r.entityEid, prop: `${f.concept}@${r.periodEnd}`, value: String(f.value), itemId: r.itemId });
          }
          continue;
        }

        if (!db.isTransaction) {
          begin();
          batchStart = Date.now();
          inBatch = 0;
        }
        writeParsed(db, { syncId, sourceId: meta.id, day }, { ...record, hashInput: masked(record.hashInput, gated.refused) }, gated, report);
        if (++inBatch >= maxRecords || Date.now() - batchStart > maxMs) commit();
      }
    } catch (error) {
      if (error instanceof LeaseLost) throw error;
      complete = false;
      report.reason = "parse_error";
      logger.warn("parse failed", { sourceId: meta.id, error: error instanceof Error ? error.name : "unknown" });
    }
    commit();

    if (!complete) {
      if (storage === "store") endStaging(db);
      return finish("partial", { upstreamAsOf: previous?.upstreamAsOf ?? null, reason: report.reason ?? "interrupted" });
    }

    if (storage === "share-alike-store") {
      // The purge guard holds here too: a short or empty file never empties the store (qa M3).
      const before = shareAlikeRecords(db, meta.id);
      const removed = before === null ? 0 : Math.max(0, before - memoryRecords);
      if (before !== null && removed > Math.max(Math.ceil(meta.maxPurgeShare * before), 5) && options.allowMassPurge !== true) {
        return finish("partial", { upstreamAsOf: asOf, asOfBasis: basis, reason: "purge_guard" });
      }
      begin();
      replaceShareAlike(db, { sourceId: meta.id, licenceId: meta.licence, startedAt, upstreamAsOf: asOf, records: memoryRecords }, memory);
      db.exec("COMMIT");
      report.written = memoryRecords;
      report.deleted = removed;
    } else if (storage === "live-no-store") {
      const view: LiveView = { asOf, loadedAt: startedAt, rows: memory };
      setLiveView(meta.id, view);
      options.onLiveView?.(meta.id, view);
      report.written = memoryRecords;
    } else {
      const purged = purge(db, loader, {
        deletes,
        periods,
        allowMassPurge: options.allowMassPurge === true,
        day,
        windowStart: loader.windowStart?.(artifacts) ?? null,
        begin,
        maxMs,
      });
      endStaging(db);
      report.deleted = purged.deleted;
      report.tombstoned = purged.tombstoned;
      report.events += purged.events;
      if (purged.guard) {
        setContentHash(db, syncId, hash);
        return finish("partial", { upstreamAsOf: asOf, asOfBasis: basis, reason: "purge_guard" });
      }
    }

    if (classChanged) moveOutOf(db, meta.id, previousStorage as StorageClass, storage, options.rawCacheDir ?? null, begin);
    if (storage !== "live-no-store") setContentHash(db, syncId, hash);
    return finish("content", { upstreamAsOf: asOf, asOfBasis: basis });
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (storage === "store") endStaging(db);
    if (error instanceof LeaseLost) {
      logger.warn("sync lost its lease", { sourceId: meta.id });
      return finish("partial", { reason: "lease_lost" });
    }
    // The error's name and code only: a message could carry a value (qa S7).
    const code = error instanceof StoreError ? error.code : error instanceof Error && "code" in error ? String((error as { code: unknown }).code) : "error";
    logger.warn("sync failed", { sourceId: meta.id, error: error instanceof Error ? error.name : "unknown", code });
    return finish("failed", { reason: code });
  } finally {
    clearInterval(timer);
    if (!lost) releaseLease(db, lease);
  }
}

/** Writes one gated record and its history events; counts the outcome in the report. */
export function writeParsed(
  db: DatabaseSync,
  sync: { syncId: number; sourceId: string; day: string },
  raw: ParsedRecord,
  gated: GateResult,
  report: SyncReport,
): void {
  const existing = recordId(db, sync.sourceId, raw.recordKey);
  const companies = gated.entities.filter((e) => e.schema !== "Person").map((e) => e.eid);
  const before = snapshot(db, existing, companies);
  try {
    const { changed } = writeRecord(db, {
      syncId: sync.syncId,
      sourceId: sync.sourceId,
      recordKey: raw.recordKey,
      hashInput: raw.hashInput,
      entities: gated.entities,
      reports: gated.reports,
      events: gated.events,
      withheld: gated.withheld,
      ...(raw.lineIds ? { lineIds: raw.lineIds } : {}),
      ...(raw.period ? { period: raw.period } : {}),
    });
    if (!changed) {
      report.unchanged++;
      return;
    }
    report.written++;
    if (existing === null) return;
    const after = snapshot(db, existing, companies);
    const itemOf = (eid: string, prop: string) => {
      const statements = gated.entities.find((e) => e.eid === eid)?.statements ?? [];
      return statements.find((s) => s.prop === prop)?.itemId ?? statements[0]?.itemId ?? null;
    };
    report.events += writeHistory(db, before, after, sync.day, itemOf);
  } catch (error) {
    bump(report.skipped, error instanceof StoreError && error.code === "entity_missing" ? "entity_missing" : "write_refused");
  }
}

export function emptyReport(storage: StorageClass): SyncReport {
  return { read: 0, written: 0, unchanged: 0, deleted: 0, tombstoned: 0, skipped: {}, dropped: {}, droppedRows: [], events: 0, durationMs: 0, storage };
}

export function countDrops(report: SyncReport, drops: readonly Drop[]): void {
  for (const d of drops) {
    bump(report.dropped, d.reason);
    if (d.prop) report.droppedRows.push(d);
  }
}

/** A7: after a full reload into the new class, nothing of the source stays in the old one. */
function moveOutOf(db: DatabaseSync, sourceId: string, from: StorageClass, to: StorageClass, rawCacheDir: string | null, begin: () => void): void {
  if (from === to) return;
  begin();
  if (from === "store") purgeSourceFromMain(db, sourceId);
  if (from === "share-alike-store") purgeShareAlike(db, sourceId);
  db.exec("COMMIT");
  if (from === "live-no-store") clearLiveView(sourceId);
  if (to === "live-no-store" && rawCacheDir) dropRaw(rawCacheDir, sourceId);
}

/**
 * Step 6 with the purge guard (A2): a sync may delete at most max(ceil(share x records), 5)
 * records. Window sources expect the records that aged out of the window; periods_in_file
 * sources purge only periods present in the file; change feeds guard their explicit deletes.
 * Deletes run in time-bounded batches, each re-checking the lease first (qa S6, SEC-3).
 */
function purge(
  db: DatabaseSync,
  loader: SourceLoader,
  run: { deletes: string[]; periods: Set<string>; allowMassPurge: boolean; day: string; windowStart: string | null; begin: () => void; maxMs: number },
): { deleted: number; tombstoned: number; events: number; guard: boolean } {
  const { meta } = loader;
  const total = countRecords(db, meta.id);
  const allowed = Math.max(Math.ceil(meta.maxPurgeShare * total), 5);
  let candidates: { id: number; recordKey: string; period: string | null }[];
  let counted: number;
  if (meta.purgeScope === "none") {
    candidates = run.deletes.map((key) => ({ id: recordId(db, meta.id, key) ?? -1, recordKey: key, period: null })).filter((r) => r.id >= 0);
    counted = candidates.length;
  } else {
    candidates = missingRecords(db, meta.id, meta.purgeScope === "periods_in_file" ? { periods: [...run.periods] } : {});
    const aged = meta.purgeScope === "window" && run.windowStart !== null ? (r: { period: string | null }) => r.period !== null && r.period < run.windowStart! : () => false;
    counted = candidates.filter((r) => !aged(r)).length;
  }
  if (counted > allowed && !run.allowMassPurge) return { deleted: 0, tombstoned: 0, events: 0, guard: true };

  let events = 0;
  let tombstoned = 0;
  let deleted = 0;
  for (let i = 0; i < candidates.length; ) {
    run.begin();
    const start = Date.now();
    const batch: number[] = [];
    for (; i < candidates.length && Date.now() - start <= run.maxMs; i++) {
      const record = candidates[i]!;
      if (meta.onRemoval === "tombstone") {
        tombstoneRecord(db, record.id, run.day);
        tombstoned++;
        continue;
      }
      // A removed role set leaves only role_ended events, with no name and no id (P4).
      for (const line of recordLines(db, record.id)) {
        if (writeFinoraEvent(db, { entityEid: line.companyEid, type: "finora.role_ended", date: run.day, itemId: line.itemId, data: { role: line.role } })) events++;
      }
      batch.push(record.id);
    }
    deleteRecords(db, batch);
    deleted += batch.length;
    db.exec("COMMIT");
  }
  return { deleted, tombstoned, events, guard: false };
}
