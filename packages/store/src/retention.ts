// P4, P5 (legal rule 11): natural-person data expires. The clock runs from the source's latest
// successful sync, content or unchanged, so live officers never expire while a file is unchanged
// (qa N1). Live-cached entities not viewed for the TTL are purged.
import type { DatabaseSync } from "node:sqlite";
import { markMaintenance } from "./maintenance.ts";
import { dropIfOrphan } from "./registry.ts";

const DAY_MS = 86_400_000;

export function runRetention(
  db: DatabaseSync,
  options: { now: string; personTtlDays: number },
): { personStatements: number; liveCacheEntities: number } {
  const cutoff = new Date(Date.parse(options.now) - options.personTtlDays * DAY_MS).toISOString();
  const stale = db
    .prepare(
      `SELECT s.id FROM main.sources s WHERE COALESCE(
         (SELECT MAX(started_at) FROM main.syncs WHERE source_id = s.id AND kind IN ('content', 'unchanged')), '') < ?`,
    )
    .all(cutoff) as { id: string }[];
  // A record holding any natural person (a role set, a sole trader) expires whole: its
  // relationship rows go with the people they name, and so does the record's hash (PS4).
  let personStatements = 0;
  const touched = new Set<number>();
  for (const source of stale) {
    const records = (
      db
        .prepare(
          `SELECT DISTINCT r.id FROM main.records r JOIN main.statements st ON st.record_id = r.id
           JOIN main.entities e ON e.id = st.entity_id WHERE r.source_id = ? AND e.natural_person = 1`,
        )
        .all(source.id) as { id: number }[]
    ).map((r) => r.id);
    personStatements += expireRecords(db, records, touched);
  }

  // A live-cached company not viewed for the TTL goes with every record that wrote it, hashes
  // included, so the next fetch writes it again instead of matching a stale hash (qa S04a Q-1).
  const expired = (
    db.prepare("SELECT entity_id FROM main.live_cache_views WHERE viewed_at < ?").all(cutoff) as { entity_id: number }[]
  ).map((r) => r.entity_id);
  for (const id of expired) {
    const records = (
      db
        .prepare(
          `SELECT record_id AS id FROM main.statements WHERE entity_id = ?1
           UNION SELECT record_id FROM main.fact_reports WHERE entity_id = ?1
           UNION SELECT record_id FROM main.events WHERE entity_id = ?1 AND record_id IS NOT NULL`,
        )
        .all(id) as { id: number }[]
    ).map((r) => r.id);
    expireRecords(db, records, touched);
    const searchRows = Number(db.prepare("DELETE FROM main.entities_fts WHERE rowid = ?").run(id).changes) + Number(db.prepare("DELETE FROM main.entities_trigram WHERE rowid = ?").run(id).changes);
    if (searchRows > 0) markMaintenance(db, "fts_merge");
    db.prepare("DELETE FROM main.entities WHERE id = ?").run(id);
    touched.delete(id);
  }
  for (const id of touched) dropIfOrphan(db, id);
  // A purge leaves a TRUNCATE checkpoint owed, after any merge: the caller runs runMaintenance once
  // its transaction commits, so no image of a purged row stays in the WAL (legal on fix 7).
  if (personStatements > 0 || expired.length > 0) markMaintenance(db, "wal_truncate");
  return { personStatements, liveCacheEntities: expired.length };
}

/** Deletes whole records (their statements, facts, events and links cascade); returns the statements removed. */
function expireRecords(db: DatabaseSync, recordIds: number[], touched: Set<number>): number {
  let statements = 0;
  for (const recordId of recordIds) {
    for (const row of db.prepare("SELECT DISTINCT entity_id FROM main.statements WHERE record_id = ?").all(recordId) as { entity_id: number }[]) {
      touched.add(row.entity_id);
    }
    statements += Number(db.prepare("DELETE FROM main.statements WHERE record_id = ?").run(recordId).changes);
    db.prepare("DELETE FROM main.records WHERE id = ?").run(recordId);
  }
  return statements;
}

export function markViewed(db: DatabaseSync, eid: string, now: string): void {
  db.prepare(
    `INSERT INTO main.live_cache_views (entity_id, viewed_at) SELECT id, ? FROM main.entities WHERE eid = ?
     ON CONFLICT (entity_id) DO UPDATE SET viewed_at = excluded.viewed_at`,
  ).run(now, eid);
}
