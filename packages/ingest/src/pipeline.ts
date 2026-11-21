// One sync of one source (architecture §4.4): fetch, as-of check, parse and gate, stage, write in
// time-bounded transactions, purge under the guard, history, report. Runs under the source's
// `sync:<id>` lease, so two syncs of one source never overlap.
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
  stage,
  tombstoneRecord,
  upsertSource,
  writeFinoraEvent,
  writeRecord,
  type Lease,
} from "@finora/store";
import { applyGates, type Drop, type GateResult } from "./gates.ts";
import { snapshot, writeHistory } from "./history.ts";
import { clearLiveView, setLiveView } from "./live-views.ts";
import { dropRaw, loadRaw, saveRaw } from "./raw-cache.ts";
import { validRecord } from "./validate.ts";

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

  const lease = acquireLease(db, `sync:${meta.id}`, holder, ttl, now().getTime());
  if (!lease) {
    logger.info("sync already running", { sourceId: meta.id });
    return { kind: "already_running", syncId: null, report: null };
  }
  const started = now();
  const startedAt = started.toISOString();
  upsertSource(db, { id: meta.id, storage, purgeScope: meta.purgeScope }, startedAt);
  const syncId = beginSync(db, { sourceId: meta.id, licenceId: meta.licence, storage, parserVersion: loader.parserVersion, startedAt });
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

    let fetched = await loader.fetch({ fetcher: options.fetcher, keys: options.keys ?? {}, now: startedAt, lastToken: lastToken(db, meta.id) });
    if (fetched.token) report.token = fetched.token;
    let artifacts: RawArtifact[] | null = fetched.unchanged ? null : fetched.artifacts;
    const sameParser = previous?.parserVersion === loader.parserVersion;
    if (artifacts === null) {
      if (sameParser && !classChanged) return finish("unchanged", { upstreamAsOf: previous?.upstreamAsOf ?? null });
      artifacts = keepRaw ? loadRaw(options.rawCacheDir as string, meta.id) : null;
      if (artifacts === null) {
        fetched = await loader.fetch({ fetcher: options.fetcher, keys: options.keys ?? {}, now: startedAt, lastToken: null });
        if (fetched.unchanged) return finish("failed", { reason: "raw_cache_missing" });
        artifacts = fetched.artifacts;
      }
    }
    const hash = contentHash(artifacts);
    if (previous && previous.contentHash === hash && sameParser && !classChanged) {
      return finish("unchanged", { upstreamAsOf: previous.upstreamAsOf });
    }
    if (keepRaw) saveRaw(options.rawCacheDir as string, meta.id, artifacts);

    const dates = loader.asOf(artifacts);
    const basis = meta.asOf.find((s) => typeof dates[s] === "string" && dates[s] !== "");
    if (!basis) return finish("failed", { reason: "as_of_missing" });
    const asOf = dates[basis] as string;
    if (previous?.upstreamAsOf && asOf < previous.upstreamAsOf && !classChanged) {
      return finish("stale_skipped", { upstreamAsOf: previous.upstreamAsOf, reason: "older_than_last_sync" });
    }

    const gateOptions = {
      companyPartyTypes: options.companyPartyTypes ?? [],
      lookup: (country: string, code: string) => entityByCode(db, country, code),
    };
    const day = startedAt.slice(0, 10);
    const periods = new Set<string>();
    const deletes: string[] = [];
    const memory: { eid: string; prop: string; value: string; itemId: string }[] = [];
    let complete = true;

    if (storage === "store") beginStaging(db);
    const maxMs = options.batch?.maxMs ?? 250;
    let maxRecords = options.batch?.maxRecords ?? 5000;
    let inBatch = 0;
    let batchStart = 0;
    let inTransaction = false;
    const commit = () => {
      if (!inTransaction) return;
      db.exec("COMMIT");
      inTransaction = false;
      // A slow disk shrinks the batch, so the write lock is never held long (qa session 2).
      if (Date.now() - batchStart > maxMs && maxRecords > 50) maxRecords = Math.max(50, Math.floor(maxRecords / 2));
      heartbeat(db, lease as Lease, ttl, now().getTime());
    };

    try {
      for await (const raw of loader.parse(artifacts, { now: startedAt })) {
        if (options.signal?.aborted) {
          complete = false;
          report.reason = "interrupted";
          break;
        }
        report.read++;
        if (!validRecord(raw)) {
          bump(report.skipped, "invalid_record");
          continue;
        }
        if (raw.op === "delete") {
          deletes.push(raw.recordKey);
          continue;
        }
        if (raw.period) periods.add(raw.period);
        const gated = applyGates(raw, gateOptions);
        countDrops(report, gated.drops);

        if (storage !== "store") {
          // Share-alike and live-no-store rows stay keyed on the public eid; a fact is kept as
          // `<concept>@<period end>` until the share-alike loader slice (S07) shapes its own tables.
          for (const e of gated.entities) for (const s of e.statements) memory.push({ eid: e.eid, prop: s.prop, value: s.value, itemId: s.itemId });
          for (const r of gated.reports) {
            for (const f of r.facts) memory.push({ eid: r.entityEid, prop: `${f.concept}@${r.periodEnd}`, value: String(f.value), itemId: r.itemId });
          }
          continue;
        }

        stage(db, raw.recordKey);
        if (!inTransaction) {
          db.exec("BEGIN IMMEDIATE");
          inTransaction = true;
          batchStart = Date.now();
          inBatch = 0;
        }
        writeParsed(db, { syncId, sourceId: meta.id, day }, raw, gated, report);
        if (++inBatch >= maxRecords || Date.now() - batchStart > maxMs) commit();
      }
    } catch (error) {
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
      db.exec("BEGIN IMMEDIATE");
      replaceShareAlike(db, { sourceId: meta.id, licenceId: meta.licence, startedAt, upstreamAsOf: asOf }, memory);
      db.exec("COMMIT");
      report.written = memory.length;
    } else if (storage === "live-no-store") {
      setLiveView(meta.id, { asOf, loadedAt: startedAt, rows: memory });
      report.written = memory.length;
    } else {
      const purged = purge(db, loader, { deletes, periods, allowMassPurge: options.allowMassPurge === true, day, windowStart: loader.windowStart?.(artifacts) ?? null });
      endStaging(db);
      report.deleted = purged.deleted;
      report.tombstoned = purged.tombstoned;
      report.events += purged.events;
      if (purged.guard) {
        setContentHash(db, syncId, hash);
        return finish("partial", { upstreamAsOf: asOf, asOfBasis: basis, reason: "purge_guard" });
      }
    }

    if (classChanged) moveOutOf(db, meta.id, previousStorage as StorageClass, storage, options.rawCacheDir ?? null);
    if (storage !== "live-no-store") setContentHash(db, syncId, hash);
    return finish("content", { upstreamAsOf: asOf, asOfBasis: basis });
  } catch (error) {
    logger.warn("sync failed", { sourceId: meta.id, error: error instanceof Error ? error.name : "unknown" });
    if (db.isTransaction) db.exec("ROLLBACK");
    return finish("failed", { reason: error instanceof Error && "code" in error ? String((error as { code: unknown }).code) : "error" });
  } finally {
    releaseLease(db, lease);
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
    bump(report.skipped, error instanceof Error && /which it does not write/.test(error.message) ? "entity_missing" : "write_refused");
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
function moveOutOf(db: DatabaseSync, sourceId: string, from: StorageClass, to: StorageClass, rawCacheDir: string | null): void {
  if (from === to) return;
  db.exec("BEGIN IMMEDIATE");
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
 */
function purge(
  db: DatabaseSync,
  loader: SourceLoader,
  run: { deletes: string[]; periods: Set<string>; allowMassPurge: boolean; day: string; windowStart: string | null },
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

  db.exec("BEGIN IMMEDIATE");
  let events = 0;
  let tombstoned = 0;
  const deleteIds: number[] = [];
  for (const record of candidates) {
    if (meta.onRemoval === "tombstone") {
      tombstoneRecord(db, record.id, run.day);
      tombstoned++;
      continue;
    }
    // A removed role set leaves only role_ended events, with no name and no id (P4).
    for (const line of recordLines(db, record.id)) {
      if (writeFinoraEvent(db, { entityEid: line.companyEid, type: "finora.role_ended", date: run.day, itemId: line.itemId, data: { role: line.role } })) events++;
    }
    deleteIds.push(record.id);
  }
  deleteRecords(db, deleteIds);
  db.exec("COMMIT");
  return { deleted: deleteIds.length, tombstoned, events, guard: false };
}
