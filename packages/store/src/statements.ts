// Reused prepared statements on the sync worker's connection only (cto's write-path fix 2; legal,
// qa on S05). Compiling the write path's ~25 statements per record cost most of a load; a cached
// statement keeps its last bound value in SQLite, so the cache lives only on a connection that is
// closed when its batch ends (the worker's), which finalizes every statement, and it is emptied at
// the end of every sync. Any other connection prepares as before and keeps nothing.
import type { DatabaseSync, StatementSync } from "node:sqlite";

const caches = new WeakMap<DatabaseSync, Map<string, StatementSync>>();

/** Turns the cache on for a connection that is closed at the end of its batch (the sync worker's). */
export function enableStatementCache(db: DatabaseSync): void {
  caches.set(db, new Map());
}

/** A prepared statement: from the connection's cache when it has one, else freshly prepared. */
export function prepared(db: DatabaseSync, sql: string): StatementSync {
  const cache = caches.get(db);
  if (!cache) return db.prepare(sql);
  let statement = cache.get(sql);
  if (!statement) {
    statement = db.prepare(sql);
    cache.set(sql, statement);
  }
  return statement;
}

/** Empties the cache at the end of a sync, whatever its outcome. */
export function clearStatementCache(db: DatabaseSync): void {
  caches.get(db)?.clear();
}

/** Tests only: the number of cached statements, and the statements themselves. */
export const statementCacheSize = (db: DatabaseSync) => caches.get(db)?.size ?? 0;
export const cachedStatements = (db: DatabaseSync): StatementSync[] => [...(caches.get(db)?.values() ?? [])];
