// The registry write path the ingest pipeline builds on (architecture §3.2-§3.3, §4.4 step 5).
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  COMPANY_ID_PROPS,
  idIsPersonalCode,
  findPersonalCodes,
  isLoadable,
  isNaturalPerson,
  isProp,
  NAME_PROPS,
  naturalPersonCaption,
  normalizeText,
  ORGANISATION_SCHEMAS,
  type SchemaName,
} from "@finora/domain";

/** Store-internal refusals; the API maps them to `internal_error` or its own codes. */
export type StoreErrorCode = "unknown_prop" | "item_not_loadable" | "personal_code_refused" | "purpose_blocked";

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
  db.prepare(`INSERT INTO main.${table} (name) VALUES (?) ON CONFLICT (name) DO NOTHING`).run(name);
  const row = db.prepare(`SELECT id FROM main.${table} WHERE name = ?`).get(name) as { id: number };
  cache.set(key, row.id);
  return row.id;
}

export function upsertSource(db: DatabaseSync, source: { id: string; storage: string; purgeScope?: string }, now: string): void {
  db.prepare(
    `INSERT INTO main.sources (id, storage, purge_scope, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET storage = excluded.storage, purge_scope = excluded.purge_scope`,
  ).run(source.id, source.storage, source.purgeScope ?? "full", now);
}

export type SyncStart = { sourceId: string; licenceId: string; storage: string; parserVersion: string; startedAt: string };

export function beginSync(db: DatabaseSync, sync: SyncStart): number {
  const result = db
    .prepare(
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
  db.prepare(
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
};
export type RecordInput = {
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
  const existing = db
    .prepare("SELECT id, row_hash FROM main.records WHERE source_id = ? AND record_key = ?")
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
      db.prepare("SELECT DISTINCT entity_id FROM main.statements WHERE record_id = ?").all(recordId) as { entity_id: number }[]
    ).map((r) => r.entity_id);
    db.prepare("UPDATE main.records SET row_hash = ?, last_changed_sync_id = ?, line_ids = ?, period = ? WHERE id = ?").run(
      hash,
      input.syncId,
      lineIds,
      input.period ?? null,
      recordId,
    );
    for (const table of ["statements", "fact_reports", "events", "withheld"]) {
      db.prepare(`DELETE FROM main.${table} WHERE record_id = ?`).run(recordId);
    }
  } else {
    const result = db
      .prepare(
        `INSERT INTO main.records (source_id, record_key, row_hash, first_sync_id, last_changed_sync_id, line_ids, period) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.sourceId, input.recordKey, hash, input.syncId, input.syncId, lineIds, input.period ?? null);
    recordId = Number(result.lastInsertRowid);
  }

  const insert = db.prepare(
    "INSERT INTO main.statements (entity_id, prop_id, value, lang, item_id, record_id, line) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const entity of input.entities) {
    const entityId = upsertEntity(db, entity, input.syncId);
    for (const s of entity.statements) {
      insert.run(entityId, intern(db, "props", s.prop), s.value, s.lang ?? null, intern(db, "items", s.itemId), recordId, s.line ?? null);
    }
    refreshEntity(db, entityId);
  }
  const entityId = (eid: string): number => {
    const row = db.prepare("SELECT id FROM main.entities WHERE eid = ?").get(eid) as { id: number } | undefined;
    if (!row) throw new Error(`record ${input.recordKey} refers to ${eid}, which it does not write`);
    return row.id;
  };
  for (const report of input.reports ?? []) {
    const reportId = Number(
      db
        .prepare(
          `INSERT INTO main.fact_reports (entity_id, kind, period_start, period_end, currency, unit_scale, record_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(entityId(report.entityEid), report.kind, report.periodStart ?? null, report.periodEnd, report.currency ?? null, report.unitScale ?? 1, recordId)
        .lastInsertRowid,
    );
    const fact = db.prepare("INSERT INTO main.facts (report_id, concept_id, value) VALUES (?, ?, ?)");
    for (const f of report.facts) fact.run(reportId, intern(db, "concepts", f.concept), f.value);
  }
  for (const event of input.events ?? []) {
    db.prepare("INSERT INTO main.events (entity_id, type_id, date, data, item_id, record_id) VALUES (?, ?, ?, ?, ?, ?)").run(
      entityId(event.entityEid),
      intern(db, "event_types", event.type),
      event.date,
      event.data ? JSON.stringify(event.data) : null,
      intern(db, "items", event.itemId),
      recordId,
    );
  }
  for (const w of input.withheld ?? []) {
    db.prepare("INSERT OR IGNORE INTO main.withheld (record_id, entity_id, prop_id, reason) VALUES (?, ?, ?, ?)").run(
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
  const deleted = db
    .prepare(
      `DELETE FROM main.entities WHERE id = ?1
         AND NOT EXISTS (SELECT 1 FROM main.statements WHERE entity_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM main.fact_reports WHERE entity_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM main.events WHERE entity_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM main.links WHERE entity_a = ?1 OR entity_b = ?1)`,
    )
    .run(entityId).changes;
  if (deleted === 0) return false;
  db.prepare("DELETE FROM main.entities_fts WHERE rowid = ?").run(entityId);
  db.prepare("DELETE FROM main.entities_trigram WHERE rowid = ?").run(entityId);
  return true;
}

function upsertEntity(db: DatabaseSync, entity: EntityInput, syncId: number): number {
  const naturalPerson = isNaturalPerson({ schema: entity.schema, legalForm: entity.legalForm ?? null }) ? 1 : 0;
  db.prepare(
    `INSERT INTO main.entities (eid, schema_id, country, legal_form, natural_person, status, code, caption, first_sync_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, '', ?)
     ON CONFLICT (eid) DO UPDATE SET legal_form = excluded.legal_form, natural_person = excluded.natural_person,
       status = excluded.status, code = excluded.code`,
  ).run(entity.eid, intern(db, "schemas", entity.schema), entity.country, entity.legalForm ?? null, naturalPerson, entity.status ?? null, entity.code ?? null, syncId);
  return (db.prepare("SELECT id FROM main.entities WHERE eid = ?").get(entity.eid) as { id: number }).id;
}

/** Recomputes an entity's caption and search rows. Only organisations that are not natural persons are searchable (L2, L3). */
export function refreshEntity(db: DatabaseSync, entityId: number): void {
  const entity = db
    .prepare(
      `SELECT e.id, e.natural_person, e.legal_form, e.code, s.name AS schema FROM main.entities e
       JOIN main.schemas s ON s.id = e.schema_id WHERE e.id = ?`,
    )
    .get(entityId) as { id: number; natural_person: number; legal_form: string | null; code: string | null; schema: string };
  const names = (
    db
      .prepare(
        `SELECT st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id
         WHERE st.entity_id = ? AND p.name IN (${NAME_PROPS.map(() => "?").join(", ")}) ORDER BY st.id`,
      )
      .all(entityId, ...NAME_PROPS) as { value: string }[]
  ).map((r) => r.value);

  const searchable = entity.natural_person === 0 && (ORGANISATION_SCHEMAS as readonly string[]).includes(entity.schema);
  const caption =
    entity.natural_person === 1
      ? naturalPersonCaption({ legalForm: entity.legal_form, code: entity.code ?? "" })
      : (names[0] ?? entity.code ?? "");
  db.prepare("UPDATE main.entities SET caption = ? WHERE id = ?").run(caption, entityId);
  db.prepare("DELETE FROM main.entities_fts WHERE rowid = ?").run(entityId);
  db.prepare("DELETE FROM main.entities_trigram WHERE rowid = ?").run(entityId);
  if (searchable) {
    const text = normalizeText([...new Set(names)].join(" "));
    db.prepare("INSERT INTO main.entities_fts (rowid, search_text) VALUES (?, ?)").run(entityId, text);
    db.prepare("INSERT INTO main.entities_trigram (rowid, search_text) VALUES (?, ?)").run(entityId, text);
  }
}
