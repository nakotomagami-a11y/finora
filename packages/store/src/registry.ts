// The registry write path the ingest pipeline builds on (architecture §3.2-§3.3, §4.4 step 5).
import { prepared } from "./statements.ts";
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { COMPANY_ID_PROPS, findPersonalCodes, idIsPersonalCode, isInternalEid, isLoadable, isNaturalPerson, isProp, NAME_PROPS, naturalPersonCaption, normalizeText, ORGANISATION_SCHEMAS, type SchemaName } from "@finora/domain";

/** Store-internal refusals; the API maps them to `internal_error` or its own codes. */
export type StoreErrorCode = "unknown_prop" | "item_not_loadable" | "personal_code_refused" | "purpose_blocked" | "entity_missing" | "ref_not_company";

export class StoreError extends Error {
  readonly code: StoreErrorCode;

  constructor(code: StoreErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}

const internCache = new WeakMap<DatabaseSync, Map<string, number>>();

/** Drops the cached intern ids of a connection; any rollback must call it, or a rolled-back id stays cached. */
export function forgetInterned(db: DatabaseSync): void {
  internCache.delete(db);
}

/** Integer id for a repeated string in one of the intern tables. */
export function intern(db: DatabaseSync, table: "schemas" | "props" | "items" | "concepts" | "event_types", name: string): number {
  let cache = internCache.get(db);
  if (!cache) internCache.set(db, (cache = new Map()));
  const key = `${table}:${name}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  prepared(db, `INSERT INTO main.${table} (name) VALUES (?) ON CONFLICT (name) DO NOTHING`).run(name);
  const row = prepared(db, `SELECT id FROM main.${table} WHERE name = ?`).get(name) as { id: number };
  cache.set(key, row.id);
  return row.id;
}

export function upsertSource(db: DatabaseSync, source: { id: string; storage: string; purgeScope?: string }, now: string): void {
  prepared(db, 
    `INSERT INTO main.sources (id, storage, purge_scope, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET storage = excluded.storage, purge_scope = excluded.purge_scope`,
  ).run(source.id, source.storage, source.purgeScope ?? "full", now);
}

export type SyncStart = { sourceId: string; licenceId: string; storage: string; parserVersion: string; startedAt: string };

export function beginSync(db: DatabaseSync, sync: SyncStart): number {
  const result = prepared(db, 
      `INSERT INTO main.syncs (source_id, kind, licence_id, storage, started_at, parser_version)
       VALUES (?, 'running', ?, ?, ?, ?)`,
    )
    .run(sync.sourceId, sync.licenceId, sync.storage, sync.startedAt, sync.parserVersion);
  return Number(result.lastInsertRowid);
}

export function finishSync(
  db: DatabaseSync,
  syncId: number,
  end: { kind: "content" | "unchanged" | "stale_skipped" | "partial" | "failed"; finishedAt: string; upstreamAsOf?: string; asOfBasis?: string; report?: unknown },
): void {
  prepared(db, 
    `UPDATE main.syncs SET kind = ?, finished_at = ?, upstream_as_of = ?, as_of_basis = ?, report_json = ? WHERE id = ?`,
  ).run(end.kind, end.finishedAt, end.upstreamAsOf ?? null, end.asOfBasis ?? null, end.report ? JSON.stringify(end.report) : null, syncId);
}

export type StatementInput = { prop: string; value: string; itemId: string; lang?: string; line?: number };
export type EntityInput = {
  eid: string;
  schema: SchemaName;
  country: string;
  legalForm?: string | null;
  status?: string | null;
  code?: string | null;
  statements: StatementInput[];
  /** Attach statements to an entity another source owns: never created or changed here. */
  ref?: boolean;
};
export type RecordInput = {
  /** Mark touched entities in `search_dirty` instead of writing their search rows (a sync; see rebuildSearch). */
  deferSearch?: boolean;
  syncId: number;
  sourceId: string;
  recordKey: string;
  hashInput: string[];
  entities: EntityInput[];
  /**
   * A role set's line identities in line order: the source's own row-local role-row id, or null
   * where it has none (architecture §3.3). Internal: never output, logged or exported.
   */
  lineIds?: (string | null)[];
  /** Window and periods_in_file sources: the record's period (ISO date). */
  period?: string | null;
  reports?: ReportInput[];
  events?: SourceEventInput[];
  /** Fields refused at load: the profile shows them as not loaded, never as empty. */
  withheld?: { entityEid: string; prop: string; reason: string }[];
};
export type ReportInput = {
  entityEid: string;
  kind: string;
  periodStart?: string | null;
  periodEnd: string;
  currency?: string | null;
  unitScale?: number;
  facts: { concept: string; value: number }[];
};
export type SourceEventInput = { entityEid: string; type: string; date: string; data?: Record<string, string | number | null>; itemId: string };

/** sha256 truncated to 16 bytes (architecture §3.2). */
export function rowHash(hashInput: string[]): Buffer {
  return createHash("sha256").update(JSON.stringify(hashInput)).digest().subarray(0, 16);
}

function refuse(input: RecordInput): void {
  for (const event of input.events ?? []) {
    if (!isLoadable(event.itemId)) throw new StoreError("item_not_loadable", event.itemId);
    // The second line behind the ingest gate (SEC-1): no personal code in any event's data.
    for (const value of Object.values(event.data ?? {})) {
      if (typeof value === "string" && findPersonalCodes(value).length > 0) throw new StoreError("personal_code_refused", "event data");
    }
  }
  for (const entity of input.entities) {
    const naturalPerson = isNaturalPerson({ schema: entity.schema, legalForm: entity.legalForm ?? null });
    for (const s of entity.statements) {
      if (!isProp(s.prop)) throw new StoreError("unknown_prop", s.prop);
      if (!isLoadable(s.itemId)) throw new StoreError("item_not_loadable", s.itemId);
      if (!naturalPerson) continue;
      // A sole trader's own register id is checked against its own country's personal-code shape only.
      const ownId = entity.schema !== "Person" && COMPANY_ID_PROPS.has(s.prop);
      const leaks = ownId ? idIsPersonalCode(entity.country, s.value) : findPersonalCodes(s.value).length > 0;
      if (leaks) throw new StoreError("personal_code_refused", `${entity.schema}.${s.prop}`);
    }
  }
}

/**
 * Writes one source record: replaces its statements when the hash changed, does nothing when it
 * did not. Returns whether anything was written. Refuses a HIDE or LATER item (load rule 2) and a
 * personal-code value on a natural person (P3). Atomic on its own (a savepoint), inside or outside
 * the caller's transaction.
 */
export function writeRecord(db: DatabaseSync, input: RecordInput): { changed: boolean } {
  const hash = rowHash(input.hashInput);
  const existing = prepared(db, "SELECT id, row_hash FROM main.records WHERE source_id = ? AND record_key = ?")
    .get(input.sourceId, input.recordKey) as { id: number; row_hash: Uint8Array } | undefined;
  if (existing && Buffer.from(existing.row_hash).equals(hash)) return { changed: false };
  refuse(input);
  db.exec("SAVEPOINT write_record");
  try {
    write(db, input, hash, existing?.id);
    db.exec("RELEASE write_record");
  } catch (error) {
    db.exec("ROLLBACK TO write_record");
    db.exec("RELEASE write_record");
    forgetInterned(db);
    throw error;
  }
  return { changed: true };
}

function write(db: DatabaseSync, input: RecordInput, hash: Buffer, existingId: number | undefined): void {
  const lineIds = input.lineIds ? JSON.stringify(input.lineIds) : null;
  const existing = existingId === undefined ? undefined : { id: existingId };
  let recordId: number;
  let previousEntities: number[] = [];
  if (existing) {
    recordId = existing.id;
    previousEntities = (
      prepared(db, "SELECT DISTINCT entity_id FROM main.statements WHERE record_id = ?").all(recordId) as { entity_id: number }[]
    ).map((r) => r.entity_id);
    prepared(db, "UPDATE main.records SET row_hash = ?, last_changed_sync_id = ?, line_ids = ?, period = ? WHERE id = ?").run(
      hash,
      input.syncId,
      lineIds,
      input.period ?? null,
      recordId,
    );
    for (const table of ["statements", "fact_reports", "events", "withheld"]) {
      prepared(db, `DELETE FROM main.${table} WHERE record_id = ?`).run(recordId);
    }
  } else {
    const result = prepared(db, 
        `INSERT INTO main.records (source_id, record_key, row_hash, first_sync_id, last_changed_sync_id, line_ids, period) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.sourceId, input.recordKey, hash, input.syncId, input.syncId, lineIds, input.period ?? null);
    recordId = Number(result.lastInsertRowid);
  }

  const insert = prepared(db, 
    "INSERT INTO main.statements (entity_id, prop_id, value, lang, item_id, record_id, line) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const entity of input.entities) {
    const entityId = entity.ref ? existingEntity(db, entity.eid) : upsertEntity(db, entity, input.syncId);
    for (const s of entity.statements) {
      insert.run(entityId, intern(db, "props", s.prop), s.value, s.lang ?? null, intern(db, "items", s.itemId), recordId, s.line ?? null);
    }
    // A sync defers the search rows to one pass at its end (cto's fix 3); the caption stays inline,
    // and so does removing the rows of an entity that is not searchable any more: a company rewritten
    // as a sole trader is never found by name, not even until the pass (L2, L3; qa, legal on 8661a89).
    if (input.deferSearch) {
      const entity = refreshCaption(db, entityId);
      if (entity && !searchable(entity)) deleteSearchRows(db, entityId);
      prepared(db, "INSERT OR IGNORE INTO main.search_dirty (entity_id) VALUES (?)").run(entityId);
    } else refreshEntity(db, entityId);
  }
  const entityId = (eid: string): number => {
    const row = prepared(db, "SELECT id FROM main.entities WHERE eid = ?").get(eid) as { id: number } | undefined;
    if (!row) throw new StoreError("entity_missing");
    return row.id;
  };
  /** Facts and events belong to companies: never to a person or relationship row (SEC-4 on S05). */
  const companyId = (eid: string): number => {
    if (isInternalEid(eid)) throw new StoreError("ref_not_company");
    const row = prepared(db, "SELECT e.id, s.name AS schema FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE e.eid = ?").get(eid) as { id: number; schema: string } | undefined;
    if (!row) throw new StoreError("entity_missing");
    if (row.schema === "Person") throw new StoreError("ref_not_company");
    return row.id;
  };
  for (const report of input.reports ?? []) {
    const reportId = Number(
      prepared(db, 
          `INSERT INTO main.fact_reports (entity_id, kind, period_start, period_end, currency, unit_scale, record_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(companyId(report.entityEid), report.kind, report.periodStart ?? null, report.periodEnd, report.currency ?? null, report.unitScale ?? 1, recordId)
        .lastInsertRowid,
    );
    const fact = prepared(db, "INSERT INTO main.facts (report_id, concept_id, value) VALUES (?, ?, ?)");
    for (const f of report.facts) fact.run(reportId, intern(db, "concepts", f.concept), f.value);
  }
  for (const event of input.events ?? []) {
    prepared(db, "INSERT INTO main.events (entity_id, type_id, date, data, item_id, record_id) VALUES (?, ?, ?, ?, ?, ?)").run(
      companyId(event.entityEid),
      intern(db, "event_types", event.type),
      event.date,
      event.data ? JSON.stringify(event.data) : null,
      intern(db, "items", event.itemId),
      recordId,
    );
  }
  for (const w of input.withheld ?? []) {
    prepared(db, "INSERT OR IGNORE INTO main.withheld (record_id, entity_id, prop_id, reason) VALUES (?, ?, ?, ?)").run(
      recordId,
      entityId(w.entityEid),
      intern(db, "props", w.prop),
      w.reason,
    );
  }
  // An entity left with no statement (a person whose role ended, PS4) keeps nothing, not even its row.
  for (const id of previousEntities) dropIfOrphan(db, id);
}

/**
 * Deletes an entity that nothing refers to any more, with its search rows. An entity that still
 * has facts, events or links from another source is kept (qa S04a Q-4).
 */
export function dropIfOrphan(db: DatabaseSync, entityId: number): boolean {
  const deleted = prepared(db, 
      `DELETE FROM main.entities WHERE id = ?1
         AND NOT EXISTS (SELECT 1 FROM main.statements WHERE entity_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM main.fact_reports WHERE entity_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM main.events WHERE entity_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM main.links WHERE entity_a = ?1 OR entity_b = ?1)`,
    )
    .run(entityId).changes;
  if (deleted === 0) return false;
  prepared(db, "DELETE FROM main.entities_fts WHERE rowid = ?").run(entityId);
  prepared(db, "DELETE FROM main.entities_trigram WHERE rowid = ?").run(entityId);
  return true;
}

/** A ref's target: an existing company row, never a person or relationship row (qa M1 on S05, legal). */
function existingEntity(db: DatabaseSync, eid: string): number {
  if (isInternalEid(eid)) throw new StoreError("ref_not_company");
  const row = prepared(db, "SELECT e.id, s.name AS schema FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id WHERE e.eid = ?").get(eid) as { id: number; schema: string } | undefined;
  if (!row) throw new StoreError("entity_missing");
  if (row.schema === "Person") throw new StoreError("ref_not_company");
  return row.id;
}

function upsertEntity(db: DatabaseSync, entity: EntityInput, syncId: number): number {
  const naturalPerson = isNaturalPerson({ schema: entity.schema, legalForm: entity.legalForm ?? null }) ? 1 : 0;
  prepared(db, 
    `INSERT INTO main.entities (eid, schema_id, country, legal_form, natural_person, status, code, caption, first_sync_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, '', ?)
     ON CONFLICT (eid) DO UPDATE SET legal_form = excluded.legal_form, natural_person = excluded.natural_person,
       status = excluded.status, code = excluded.code`,
  ).run(entity.eid, intern(db, "schemas", entity.schema), entity.country, entity.legalForm ?? null, naturalPerson, entity.status ?? null, entity.code ?? null, syncId);
  return (prepared(db, "SELECT id FROM main.entities WHERE eid = ?").get(entity.eid) as { id: number }).id;
}

/** Recomputes an entity's caption and search rows. Only organisations that are not natural persons are searchable (L2, L3). */
type EntityForSearch = { id: number; eid: string; natural_person: number; legal_form: string | null; code: string | null; schema: string };

/** Organisations only, never a natural person, never a sanctions list entry (sanctions.md §6; L2, L3). */
const searchable = (entity: EntityForSearch) =>
  entity.natural_person === 0 && (ORGANISATION_SCHEMAS as readonly string[]).includes(entity.schema) && !entity.eid.startsWith("sanc-");

function deleteSearchRows(db: DatabaseSync, entityId: number): void {
  prepared(db, "DELETE FROM main.entities_fts WHERE rowid = ?").run(entityId);
  prepared(db, "DELETE FROM main.entities_trigram WHERE rowid = ?").run(entityId);
}

/** The entity and its names; null when it is gone. */
function entityForSearch(db: DatabaseSync, entityId: number): { entity: EntityForSearch; names: string[] } | null {
  const entity = prepared(
    db,
    `SELECT e.id, e.eid, e.natural_person, e.legal_form, e.code, s.name AS schema FROM main.entities e
       JOIN main.schemas s ON s.id = e.schema_id WHERE e.id = ?`,
  ).get(entityId) as EntityForSearch | undefined;
  if (!entity) return null;
  const names = (
    prepared(
      db,
      `SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id
         WHERE st.entity_id = ? AND p.name IN (${NAME_PROPS.map(() => "?").join(", ")}) ORDER BY st.id`,
    ).all(entityId, ...NAME_PROPS) as { value: string }[]
  ).map((r) => r.value);
  return { entity, names };
}

/** The entity's caption, from its names (or, for a natural person, its legal form and code); returns the entity, null when gone. */
export function refreshCaption(db: DatabaseSync, entityId: number): EntityForSearch | null {
  const found = entityForSearch(db, entityId);
  if (!found) return null;
  const { entity, names } = found;
  const caption =
    entity.natural_person === 1
      ? naturalPersonCaption({ legalForm: entity.legal_form, code: entity.code ?? "" })
      : (names[0] ?? entity.code ?? "");
  prepared(db, "UPDATE main.entities SET caption = ? WHERE id = ?").run(caption, entityId);
  return entity;
}

/** The entity's two search rows, rewritten from its names. */
export function refreshSearchRows(db: DatabaseSync, entityId: number): void {
  deleteSearchRows(db, entityId);
  const found = entityForSearch(db, entityId);
  if (!found) return;
  const { entity, names } = found;
  if (searchable(entity)) {
    const text = normalizeText([...new Set(names)].join(" "));
    prepared(db, "INSERT INTO main.entities_fts (rowid, search_text) VALUES (?, ?)").run(entityId, text);
    prepared(db, "INSERT INTO main.entities_trigram (rowid, search_text) VALUES (?, ?)").run(entityId, text);
  }
}

export function refreshEntity(db: DatabaseSync, entityId: number): void {
  refreshCaption(db, entityId);
  refreshSearchRows(db, entityId);
}

/**
 * Writes the search rows of every entity a sync marked dirty, `batch` per transaction, opened with
 * `begin` (a sync's fenced begin) and committed here. The marks are rows, so a sync cut off before
 * this pass leaves them for the next sync or the boot to finish (qa condition 1 on the write path).
 */
export function rebuildSearch(db: DatabaseSync, options: { begin?: () => void; batch?: number } = {}): number {
  const begin = options.begin ?? (() => db.exec("BEGIN IMMEDIATE"));
  const batch = options.batch ?? 5000;
  let done = 0;
  for (;;) {
    // A cheap look first, so a sync with nothing owed takes no write lock.
    if (prepared(db, "SELECT 1 FROM main.search_dirty LIMIT 1").get() === undefined) return done;
    begin();
    let ids: number[];
    try {
      // Read inside the transaction: an entity another sync removed since is gone with its mark
      // (ON DELETE CASCADE), and one gone anyway only loses its mark (qa SHOULD on 8661a89).
      ids = (prepared(db, "SELECT entity_id FROM main.search_dirty ORDER BY entity_id LIMIT ?").all(batch) as { entity_id: number }[]).map((r) => r.entity_id);
      for (const id of ids) {
        refreshSearchRows(db, id);
        prepared(db, "DELETE FROM main.search_dirty WHERE entity_id = ?").run(id);
      }
      db.exec("COMMIT");
    } catch (error) {
      if (db.isTransaction) db.exec("ROLLBACK");
      throw error;
    }
    done += ids.length;
  }
}

/** Whether a record's stored hash already equals this hash input: an unchanged record is not read further. */
export function recordUnchanged(db: DatabaseSync, sourceId: string, recordKey: string, hashInput: readonly string[]): boolean {
  const row = prepared(db, "SELECT row_hash FROM main.records WHERE source_id = ? AND record_key = ?").get(sourceId, recordKey) as { row_hash: Uint8Array } | undefined;
  return row !== undefined && Buffer.from(row.row_hash).equals(rowHash([...hashInput]));
}
