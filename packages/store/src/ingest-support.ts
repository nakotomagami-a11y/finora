import { isInternalEid } from "@finora/domain";
// The store side of the ingest pipeline (architecture §4.4 steps 4-7): staging, purge, tombstones,
// history reads, the share-alike store, class changes and live-cache misses. Every query is
// scoped to one source or one record; none takes a person id.
import type { DatabaseSync } from "node:sqlite";
import { intern, dropIfOrphan } from "./registry.ts";

/** Step 4: a per-connection temp table of the record keys one sync has seen. */
export function beginStaging(db: DatabaseSync): void {
  db.exec("CREATE TEMP TABLE IF NOT EXISTS staged (record_key TEXT PRIMARY KEY) WITHOUT ROWID; DELETE FROM temp.staged;");
}
export function stage(db: DatabaseSync, recordKey: string): void {
  db.prepare("INSERT OR IGNORE INTO temp.staged (record_key) VALUES (?)").run(recordKey);
}
export function endStaging(db: DatabaseSync): void {
  db.exec("DROP TABLE IF EXISTS temp.staged");
}

export function countRecords(db: DatabaseSync, sourceId: string): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM main.records WHERE source_id = ?").get(sourceId) as { n: number }).n;
}

export type MissingRecord = { id: number; recordKey: string; period: string | null };

/** Records of a source the sync did not see; `periods` limits a periods_in_file purge. */
export function missingRecords(db: DatabaseSync, sourceId: string, options: { periods?: readonly string[] } = {}): MissingRecord[] {
  const rows = db
    .prepare(
      `SELECT r.id, r.record_key, r.period FROM main.records r
       WHERE r.source_id = ? AND NOT EXISTS (SELECT 1 FROM temp.staged s WHERE s.record_key = r.record_key)
       ORDER BY r.id`,
    )
    .all(sourceId) as { id: number; record_key: string; period: string | null }[];
  const periods = options.periods ? new Set(options.periods) : null;
  return rows
    .filter((r) => periods === null || (r.period !== null && periods.has(r.period)))
    .map((r) => ({ id: r.id, recordKey: r.record_key, period: r.period }));
}

export function recordId(db: DatabaseSync, sourceId: string, recordKey: string): number | null {
  const row = db.prepare("SELECT id FROM main.records WHERE source_id = ? AND record_key = ?").get(sourceId, recordKey) as { id: number } | undefined;
  return row?.id ?? null;
}

/** Deletes whole records (statements, facts, events, links and withheld rows cascade), then orphans. */
export function deleteRecords(db: DatabaseSync, ids: readonly number[]): void {
  const touched = new Set<number>();
  for (const id of ids) {
    for (const table of ["statements", "fact_reports", "events"]) {
      for (const row of db.prepare(`SELECT DISTINCT entity_id FROM main.${table} WHERE record_id = ?`).all(id) as { entity_id: number }[]) {
        touched.add(row.entity_id);
      }
    }
    db.prepare("DELETE FROM main.records WHERE id = ?").run(id);
  }
  for (const entity of touched) dropIfOrphan(db, entity);
}

/** EE: a vanished company keeps its identity statements and gets tombstone_since (§3.7). */
export function tombstoneRecord(db: DatabaseSync, id: number, since: string): void {
  db.prepare(
    `UPDATE main.entities SET tombstone_since = COALESCE(tombstone_since, ?)
     WHERE id IN (SELECT entity_id FROM main.statements WHERE record_id = ?) AND natural_person = 0`,
  ).run(since, id);
}

export type RecordLine = { companyEid: string; itemId: string; role: string | null; startDate: string | null; lineId: string | null };

/** The role lines a record holds, with their identities; used only inside the diff (§3.3). */
export function recordLines(db: DatabaseSync, id: number): RecordLine[] {
  const record = db.prepare("SELECT line_ids FROM main.records WHERE id = ?").get(id) as { line_ids: string | null } | undefined;
  if (!record) return [];
  const lineIds = record.line_ids ? (JSON.parse(record.line_ids) as (string | null)[]) : [];
  const rows = db
    .prepare(
      `SELECT rel.value AS company_eid, rel.line, i.name AS item_id,
         (SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = rel.entity_id AND p.name = 'role') AS role,
         (SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = rel.entity_id AND p.name = 'startDate') AS start_date
       FROM main.statements rel JOIN main.props rp ON rp.id = rel.prop_id AND rp.name = 'organization'
       JOIN main.items i ON i.id = rel.item_id WHERE rel.record_id = ? ORDER BY rel.line`,
    )
    .all(id) as { company_eid: string; line: number | null; item_id: string; role: string | null; start_date: string | null }[];
  return rows.map((r) => ({
    companyEid: r.company_eid,
    itemId: r.item_id,
    role: r.role,
    startDate: r.start_date,
    lineId: r.line !== null ? (lineIds[r.line] ?? null) : null,
  }));
}

/**
 * The current values of the props a history event tracks, for one company in one record. A person
 * or a sole trader gives nothing: their old and new names would otherwise land in an event (P4, rule 5).
 */
export function recordValues(db: DatabaseSync, id: number, eid: string, props: readonly string[]): Record<string, string> {
  const rows = db
    .prepare(
      `SELECT p.name, st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id
       JOIN main.entities e ON e.id = st.entity_id JOIN main.schemas sc ON sc.id = e.schema_id
       WHERE st.record_id = ? AND e.eid = ? AND e.natural_person = 0 AND sc.name <> 'Person' AND p.name IN (${props.map(() => "?").join(", ")}) ORDER BY st.id`,
    )
    .all(id, eid, ...props) as { name: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.name] ??= r.value;
  const entity = db.prepare("SELECT legal_form, status FROM main.entities WHERE eid = ? AND natural_person = 0").get(eid) as { legal_form: string | null; status: string | null } | undefined;
  if (entity?.legal_form && props.includes("legalForm")) out.legalForm = entity.legal_form;
  if (entity?.status && props.includes("status")) out.status ??= entity.status;
  return out;
}

/** A Finora-derived event (§3.7): no record, and never a person's name or key in `data`. */
export function writeFinoraEvent(
  db: DatabaseSync,
  event: { entityEid: string; type: string; date: string; itemId: string; data?: Record<string, string | number | null> },
): boolean {
  // Events sit on companies only: a person row never carries one (PS2, P4).
  const entity = db
    .prepare("SELECT e.id FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE e.eid = ? AND s.name <> 'Person'")
    .get(event.entityEid) as { id: number } | undefined;
  if (!entity) return false;
  db.prepare("INSERT INTO main.events (entity_id, type_id, date, data, item_id, record_id) VALUES (?, ?, ?, ?, ?, NULL)").run(
    entity.id,
    intern(db, "event_types", event.type),
    event.date,
    event.data ? JSON.stringify(event.data) : null,
    intern(db, "items", event.itemId),
  );
  return true;
}

/** The party gate's store lookup: a register entity by code, never a person. */
export function entityByCode(db: DatabaseSync, country: string, code: string): { eid: string; naturalPerson: boolean; status: string | null } | null {
  const row = db
    .prepare(
      `SELECT e.eid, e.natural_person, e.status FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id
       WHERE e.country = ? AND e.code = ? AND s.name <> 'Person' ORDER BY e.id LIMIT 1`,
    )
    .get(country, code) as { eid: string; natural_person: number; status: string | null } | undefined;
  return row ? { eid: row.eid, naturalPerson: row.natural_person === 1, status: row.status } : null;
}

/** P1: a share-alike source's rows live in finora-sa.db only, keyed on the public eid. */
export function replaceShareAlike(
  db: DatabaseSync,
  sync: { sourceId: string; licenceId: string; startedAt: string; upstreamAsOf: string | null; records: number },
  rows: readonly { eid: string; prop: string; value: string; itemId: string }[],
): number {
  purgeShareAlike(db, sync.sourceId);
  const syncId = Number(
    db
      .prepare("INSERT INTO sa.sa_syncs (source_id, licence_id, started_at, upstream_as_of, records) VALUES (?, ?, ?, ?, ?)")
      .run(sync.sourceId, sync.licenceId, sync.startedAt, sync.upstreamAsOf, sync.records).lastInsertRowid,
  );
  const insert = db.prepare("INSERT INTO sa.sa_statements (eid, prop, value, item_id, sync_id) VALUES (?, ?, ?, ?, ?)");
  for (const r of rows) insert.run(r.eid, r.prop, r.value, r.itemId, syncId);
  return rows.length;
}

export function purgeShareAlike(db: DatabaseSync, sourceId: string): void {
  db.prepare("DELETE FROM sa.sa_statements WHERE sync_id IN (SELECT id FROM sa.sa_syncs WHERE source_id = ?)").run(sourceId);
  db.prepare("DELETE FROM sa.sa_syncs WHERE source_id = ?").run(sourceId);
}

/** A7: every main-store row of a source, after its class changed. */
export function purgeSourceFromMain(db: DatabaseSync, sourceId: string): void {
  const ids = (db.prepare("SELECT id FROM main.records WHERE source_id = ?").all(sourceId) as { id: number }[]).map((r) => r.id);
  deleteRecords(db, ids);
}

/** The storage class of the source's last content sync, if any. */
export function lastContentStorage(db: DatabaseSync, sourceId: string): string | null {
  const row = db
    .prepare("SELECT storage FROM main.syncs WHERE source_id = ? AND kind = 'content' ORDER BY id DESC LIMIT 1")
    .get(sourceId) as { storage: string } | undefined;
  return row?.storage ?? null;
}

export function lastContentSync(
  db: DatabaseSync,
  sourceId: string,
): { id: number; contentHash: string | null; parserVersion: string; upstreamAsOf: string | null } | null {
  const row = db
    .prepare(
      `SELECT id, content_hash, parser_version, upstream_as_of FROM main.syncs
       WHERE source_id = ? AND kind = 'content' ORDER BY id DESC LIMIT 1`,
    )
    .get(sourceId) as { id: number; content_hash: string | null; parser_version: string; upstream_as_of: string | null } | undefined;
  return row ? { id: row.id, contentHash: row.content_hash, parserVersion: row.parser_version, upstreamAsOf: row.upstream_as_of } : null;
}

export function setContentHash(db: DatabaseSync, syncId: number, hash: string): void {
  db.prepare("UPDATE main.syncs SET content_hash = ? WHERE id = ?").run(hash, syncId);
}

/** Live-cached sources: an empty answer counts per dataset, never as removal on its own (§3.5). */
export function recordMiss(db: DatabaseSync, sourceId: string, recordKey: string, dataset: string, at: string): string {
  db.prepare(
    `INSERT INTO main.live_cache_misses (source_id, record_key, dataset, first_miss_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (source_id, record_key, dataset) DO NOTHING`,
  ).run(sourceId, recordKey, dataset, at);
  return (
    db.prepare("SELECT first_miss_at FROM main.live_cache_misses WHERE source_id = ? AND record_key = ? AND dataset = ?").get(sourceId, recordKey, dataset) as {
      first_miss_at: string;
    }
  ).first_miss_at;
}

export function clearMiss(db: DatabaseSync, sourceId: string, recordKey: string, dataset: string): void {
  db.prepare("DELETE FROM main.live_cache_misses WHERE source_id = ? AND record_key = ? AND dataset = ?").run(sourceId, recordKey, dataset);
}

export function missSince(db: DatabaseSync, sourceId: string, recordKey: string, dataset: string): string | null {
  const row = db
    .prepare("SELECT first_miss_at FROM main.live_cache_misses WHERE source_id = ? AND record_key = ? AND dataset = ?")
    .get(sourceId, recordKey, dataset) as { first_miss_at: string } | undefined;
  return row?.first_miss_at ?? null;
}

/** The started_at of the record's last change, for the live-cache refetch rule. */
export function recordChangedAt(db: DatabaseSync, sourceId: string, recordKey: string): string | null {
  const row = db
    .prepare(
      `SELECT s.started_at FROM main.records r JOIN main.syncs s ON s.id = r.last_changed_sync_id
       WHERE r.source_id = ? AND r.record_key = ?`,
    )
    .get(sourceId, recordKey) as { started_at: string } | undefined;
  return row?.started_at ?? null;
}

/** When a live-cached record was last fetched, whatever came back (the 24 h refetch rule). */
export function liveCheckedAt(db: DatabaseSync, sourceId: string, recordKey: string): string | null {
  const row = db.prepare("SELECT checked_at FROM main.live_cache_checks WHERE source_id = ? AND record_key = ?").get(sourceId, recordKey) as
    | { checked_at: string }
    | undefined;
  return row?.checked_at ?? null;
}

export function setLiveChecked(db: DatabaseSync, sourceId: string, recordKey: string, at: string): void {
  db.prepare(
    `INSERT INTO main.live_cache_checks (source_id, record_key, checked_at) VALUES (?, ?, ?)
     ON CONFLICT (source_id, record_key) DO UPDATE SET checked_at = excluded.checked_at`,
  ).run(sourceId, recordKey, at);
}

/** The record count of a share-alike source's current rows, for its purge guard; null if none. */
export function shareAlikeRecords(db: DatabaseSync, sourceId: string): number | null {
  const row = db.prepare("SELECT records FROM sa.sa_syncs WHERE source_id = ? ORDER BY id DESC LIMIT 1").get(sourceId) as { records: number | null } | undefined;
  return row?.records ?? null;
}

/** True while `holder` still holds `resource` and it has not expired (re-checked before a purge). */
export function holdsLease(db: DatabaseSync, resource: string, holder: string, now: number): boolean {
  const row = db.prepare("SELECT holder, expires_at FROM main.leases WHERE resource = ?").get(resource) as { holder: string; expires_at: number } | undefined;
  return row !== undefined && row.holder === holder && row.expires_at > now;
}

/** Closes one sync a crashed or hung worker left `running` (SEC-12); a finished row is left alone. */
export function failSync(db: DatabaseSync, syncId: number, at: string, reason: string): boolean {
  return (
    db
      .prepare("UPDATE main.syncs SET kind = 'failed', finished_at = ?, report_json = ? WHERE id = ? AND kind = 'running'")
      .run(at, JSON.stringify({ reason }), syncId).changes === 1
  );
}

/** The records of a source whose key starts with a prefix (a live-cached record's datasets). */
export function recordIdsWithPrefix(db: DatabaseSync, sourceId: string, prefix: string): number[] {
  return (
    db.prepare("SELECT id FROM main.records WHERE source_id = ? AND substr(record_key, 1, ?) = ? ORDER BY id").all(sourceId, prefix.length, prefix) as { id: number }[]
  ).map((r) => r.id);
}

export function recordKeyOf(db: DatabaseSync, id: number): string {
  return (db.prepare("SELECT record_key FROM main.records WHERE id = ?").get(id) as { record_key: string } | undefined)?.record_key ?? "";
}

/** Whether the store holds this eid as a non-Person entity: a reference to it names a company row. */
export function isCompanyEid(db: DatabaseSync, eid: string): boolean {
  // A relationship row is not a company (PS5; qa M4 on S05).
  if (isInternalEid(eid)) return false;
  return (
    db.prepare("SELECT 1 FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE e.eid = ? AND s.name <> 'Person'").get(eid) !== undefined
  );
}

/** A ref's target as the store holds it, by eid: the gate judges the row it will write to (qa M2 on S05). */
export function entityByEid(db: DatabaseSync, eid: string): { code: string | null; naturalPerson: boolean; status: string | null; person: boolean } | null {
  const row = db
    .prepare("SELECT e.code, e.natural_person, e.status, s.name AS schema FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE e.eid = ?")
    .get(eid) as { code: string | null; natural_person: number; status: string | null; schema: string } | undefined;
  return row ? { code: row.code, naturalPerson: row.natural_person === 1, status: row.status, person: row.schema === "Person" } : null;
}
