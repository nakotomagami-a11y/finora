// `live-cached` sources (architecture §3.5): written only for an entity the user opens, re-fetched
// on view when older than `refetchHours`, purged when not viewed for the TTL (store retention).
// An empty answer is not proof of removal: per dataset, the first miss withholds the cached values
// and deletes nothing; a second miss at least 24 h later deletes them. 5xx, timeouts and 429 are
// never a miss.
import type { DatabaseSync } from "node:sqlite";
import type { FetchContext, RawArtifact, SourceLoader } from "@finora/sources";
import {
  acquireLease,
  beginSync,
  clearMiss,
  deleteRecords,
  entityByCode,
  finishSync,
  liveCheckedAt,
  markViewed,
  missSince,
  recordId,
  recordLines,
  recordMiss,
  releaseLease,
  setLiveChecked,
  upsertSource,
  writeFinoraEvent,
} from "@finora/store";
import { applyGates } from "./gates.ts";
import { countDrops, emptyReport, writeParsed } from "./pipeline.ts";
import { validRecord } from "./validate.ts";

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

  const lease = acquireLease(db, `sync:${meta.id}:${view.recordKey}`, `view-${process.pid}`, 60_000, options.now.getTime());
  if (!lease) {
    for (const d of view.datasets) states[d] = "cached";
    return states;
  }
  try {
    upsertSource(db, { id: meta.id, storage: "live-cached", purgeScope: meta.purgeScope }, at);
    const syncId = beginSync(db, { sourceId: meta.id, licenceId: meta.licence, storage: "live-cached", parserVersion: loader.parserVersion, startedAt: at });
    const report = emptyReport("live-cached");
    const answers = await loader.fetchRecord({ fetcher: options.fetcher, keys: options.keys, now: at, lastToken: null }, view.recordKey);
    const gateOptions = { companyPartyTypes: options.companyPartyTypes ?? [], lookup: (c: string, v: string) => entityByCode(db, c, v) };
    db.exec("BEGIN IMMEDIATE");
    for (const answer of answers) {
      const key = keyOf(view.recordKey, answer.dataset);
      if (answer.status === "error") {
        states[answer.dataset] = isWithheld(db, meta.id, view.recordKey, answer.dataset) ? "withheld" : "error";
        continue;
      }
      if (answer.status === "empty") {
        const first = recordMiss(db, meta.id, view.recordKey, answer.dataset, at);
        if (options.now.getTime() - Date.parse(first) >= DAY_MS) {
          const id = recordId(db, meta.id, key);
          if (id !== null) {
            for (const line of recordLines(db, id)) {
              writeFinoraEvent(db, { entityEid: line.companyEid, type: "finora.role_ended", date: at.slice(0, 10), itemId: line.itemId, data: { role: line.role } });
            }
            deleteRecords(db, [id]);
            report.deleted++;
          }
          clearMiss(db, meta.id, view.recordKey, answer.dataset);
          states[answer.dataset] = "deleted";
        } else states[answer.dataset] = "withheld";
        continue;
      }
      clearMiss(db, meta.id, view.recordKey, answer.dataset);
      for await (const raw of loader.parse(answer.artifacts ?? [], { now: at })) {
        report.read++;
        if (!validRecord(raw)) continue;
        const gated = applyGates(raw, gateOptions);
        countDrops(report, gated.drops);
        writeParsed(db, { syncId, sourceId: meta.id, day: at.slice(0, 10) }, { ...raw, recordKey: key }, gated, report);
      }
      states[answer.dataset] = "fresh";
    }
    setLiveChecked(db, meta.id, view.recordKey, at);
    markViewed(db, view.entityEid, at);
    db.exec("COMMIT");
    finishSync(db, syncId, { kind: "content", finishedAt: new Date().toISOString(), report });
    return states;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  } finally {
    releaseLease(db, lease);
  }
}
