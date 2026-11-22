// `live-cached` sources (architecture §3.5): written only for an entity the user opens, re-fetched
// on view when older than `refetchHours`, purged when not viewed for the TTL (store retention).
// An empty answer is not proof of removal: per dataset, the first miss withholds the cached values
// and deletes nothing; a second miss at least 24 h later deletes them. 5xx, timeouts and 429 are
// never a miss.
import type { DatabaseSync } from "node:sqlite";
import type { FetchContext, ParsedRecord, RawArtifact, SourceLoader } from "@finora/sources";
import {
  acquireLease,
  beginSync,
  clearMiss,
  deleteRecords,
  entityByCode,
  entityByEid,
  finishSync,
  heartbeat,
  isCompanyEid,
  liveCheckedAt,
  markMaintenance,
  markViewed,
  missSince,
  recordIdsWithPrefix,
  recordKeyOf,
  recordLines,
  recordMiss,
  releaseLease,
  runMaintenance,
  setLiveChecked,
  upsertSource,
  writeFinoraEvent,
} from "@finora/store";
import { applyGates } from "./gates.ts";
import { countDrops, emptyReport, writeParsed } from "./pipeline.ts";
import { validateRecord } from "./validate.ts";

export type DatasetAnswer = { dataset: string; status: "ok" | "empty" | "error"; artifacts?: RawArtifact[] };
export type LiveCachedLoader = SourceLoader & {
  /** Queries each dataset for one record; `error` for 5xx, timeouts and 429. */
  fetchRecord(ctx: FetchContext, recordKey: string): Promise<DatasetAnswer[]>;
};
export type DatasetState = "fresh" | "cached" | "withheld" | "deleted" | "error";

const DAY_MS = 86_400_000;
const keyOf = (recordKey: string, dataset: string) => `${recordKey}:${dataset}`;

/** True while a dataset's first miss stands: its values are withheld from every surface. */
export function isWithheld(db: DatabaseSync, sourceId: string, recordKey: string, dataset: string): boolean {
  return missSince(db, sourceId, recordKey, dataset) !== null;
}

export async function fetchOnView(
  db: DatabaseSync,
  loader: LiveCachedLoader,
  view: { recordKey: string; entityEid: string; datasets: readonly string[] },
  options: Omit<FetchContext, "now" | "lastToken"> & { now: Date; companyPartyTypes?: readonly string[] },
): Promise<Record<string, DatasetState>> {
  const { meta } = loader;
  const at = options.now.toISOString();
  const refetchMs = (meta.cacheTtl?.refetchHours ?? 24) * 3_600_000;
  const checked = liveCheckedAt(db, meta.id, view.recordKey);
  const states: Record<string, DatasetState> = {};
  const fresh = checked !== null && options.now.getTime() - Date.parse(checked) < refetchMs;
  if (fresh) {
    for (const d of view.datasets) states[d] = isWithheld(db, meta.id, view.recordKey, d) ? "withheld" : "cached";
    markViewed(db, view.entityEid, at);
    return states;
  }

  const lease = acquireLease(db, `sync:${meta.id}:${view.recordKey}`, `view-${process.pid}-${Math.random().toString(36).slice(2)}`, 60_000, options.now.getTime());
  if (!lease) {
    // Another view of this record is fetching: serve what is stored, still withholding a missed dataset (qa S4).
    for (const d of view.datasets) states[d] = isWithheld(db, meta.id, view.recordKey, d) ? "withheld" : "cached";
    return states;
  }
  let syncId: number | null = null;
  try {
    upsertSource(db, { id: meta.id, storage: "live-cached", purgeScope: meta.purgeScope }, at);
    syncId = beginSync(db, { sourceId: meta.id, licenceId: meta.licence, storage: "live-cached", parserVersion: loader.parserVersion, startedAt: at });
    const report = emptyReport("live-cached");
    let withdrawn = false;
    const answers = await loader.fetchRecord({ fetcher: options.fetcher, keys: options.keys, now: at, lastToken: null }, view.recordKey);
    const gateOptions = {
      companyPartyTypes: options.companyPartyTypes ?? [],
      lookup: (c: string, v: string) => entityByCode(db, c, v),
      knownCompany: (eid: string) => isCompanyEid(db, eid),
      byEid: (eid: string) => entityByEid(db, eid),
    };

    // Parse everything first: no write transaction is ever held across an await (SEC-4).
    const parsed = new Map<string, ParsedRecord[]>();
    for (const answer of answers) {
      if (answer.status !== "ok") continue;
      const records: ParsedRecord[] = [];
      for await (const raw of loader.parse(answer.artifacts ?? [], { now: at })) {
        report.read++;
        const checked = validateRecord(raw, { knownCompany: gateOptions.knownCompany });
        if (checked.ok) records.push(checked.record);
        else report.skipped[checked.reason] = (report.skipped[checked.reason] ?? 0) + 1;
      }
      parsed.set(answer.dataset, records);
    }

    db.exec("BEGIN IMMEDIATE");
    // Fencing: the view's lease is renewed inside its own transaction.
    if (!heartbeat(db, lease, 60_000, options.now.getTime())) throw new Error("lease lost");
    for (const answer of answers) {
      const prefix = keyOf(view.recordKey, answer.dataset);
      if (answer.status === "error") {
        states[answer.dataset] = isWithheld(db, meta.id, view.recordKey, answer.dataset) ? "withheld" : "error";
        continue;
      }
      if (answer.status === "empty") {
        const first = recordMiss(db, meta.id, view.recordKey, answer.dataset, at);
        if (options.now.getTime() - Date.parse(first) >= DAY_MS) {
          const ids = recordIdsWithPrefix(db, meta.id, `${prefix}:`);
          for (const id of ids) {
            for (const line of recordLines(db, id)) {
              writeFinoraEvent(db, { entityEid: line.companyEid, type: "finora.role_ended", date: at.slice(0, 10), itemId: line.itemId, data: { role: line.role } });
            }
          }
          deleteRecords(db, ids);
          report.deleted += ids.length;
          clearMiss(db, meta.id, view.recordKey, answer.dataset);
          states[answer.dataset] = "deleted";
        } else states[answer.dataset] = "withheld";
        continue;
      }
      clearMiss(db, meta.id, view.recordKey, answer.dataset);
      // Each record of a dataset keeps its own key, so a second one never overwrites the first (qa S5).
      const keep = new Set<string>();
      for (const record of parsed.get(answer.dataset) ?? []) {
        const gated = applyGates(record, gateOptions);
        countDrops(report, gated.drops);
        const key = `${prefix}:${record.recordKey}`;
        keep.add(key);
        writeParsed(db, { syncId, sourceId: meta.id, day: at.slice(0, 10) }, { ...record, recordKey: key }, gated, report);
      }
      // A record the dataset no longer returns is withdrawn (CT terms): its rows go.
      const gone = recordIdsWithPrefix(db, meta.id, `${prefix}:`).filter((id) => !keep.has(recordKeyOf(db, id)));
      deleteRecords(db, gone);
      if (gone.length > 0) withdrawn = true;
      states[answer.dataset] = "fresh";
    }
    setLiveChecked(db, meta.id, view.recordKey, at);
    markViewed(db, view.entityEid, at);
    // A rewrite or a withdrawal deleted values whose old page images sit in the WAL: a TRUNCATE
    // checkpoint is owed, run after the commit (legal on fix 7).
    if (report.written > 0 || report.deleted > 0 || withdrawn) markMaintenance(db, "wal_truncate");
    db.exec("COMMIT");
    finishSync(db, syncId, { kind: "content", finishedAt: options.now.toISOString(), report });
    try {
      runMaintenance(db);
    } catch {
      // Still owed: the next sync, the idle timer or the boot runs it.
    }
    return states;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (syncId !== null) finishSync(db, syncId, { kind: "failed", finishedAt: options.now.toISOString(), report: { reason: error instanceof Error ? error.name : "error" } });
    throw error;
  } finally {
    releaseLease(db, lease);
  }
}
