// P4, P5 (legal rule 11): natural-person data expires. The clock runs from the source's latest
// successful sync, content or unchanged, so live officers never expire while a file is unchanged
// (qa N1). Live-cached entities not viewed for the TTL are purged.
import type { DatabaseSync } from "node:sqlite";

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
    for (const recordId of records) {
      for (const row of db.prepare("SELECT DISTINCT entity_id FROM main.statements WHERE record_id = ?").all(recordId) as { entity_id: number }[]) {
        touched.add(row.entity_id);
      }
      personStatements += Number(db.prepare("DELETE FROM main.statements WHERE record_id = ?").run(recordId).changes);
      db.prepare("DELETE FROM main.records WHERE id = ?").run(recordId);
    }
  }
  for (const id of touched) {
    if (db.prepare("SELECT 1 FROM main.statements WHERE entity_id = ? LIMIT 1").get(id)) continue;
    dropEntity(db, id);
  }
  const expired = (
    db.prepare("SELECT entity_id FROM main.live_cache_views WHERE viewed_at < ?").all(cutoff) as { entity_id: number }[]
  ).map((r) => r.entity_id);
  for (const id of expired) dropEntity(db, id);
  return { personStatements, liveCacheEntities: expired.length };
}

function dropEntity(db: DatabaseSync, id: number): void {
  db.prepare("DELETE FROM main.entities_fts WHERE rowid = ?").run(id);
  db.prepare("DELETE FROM main.entities_trigram WHERE rowid = ?").run(id);
  db.prepare("DELETE FROM main.entities WHERE id = ?").run(id);
}

export function markViewed(db: DatabaseSync, eid: string, now: string): void {
  db.prepare(
    `INSERT INTO main.live_cache_views (entity_id, viewed_at) SELECT id, ? FROM main.entities WHERE eid = ?
     ON CONFLICT (entity_id) DO UPDATE SET viewed_at = excluded.viewed_at`,
  ).run(now, eid);
}
