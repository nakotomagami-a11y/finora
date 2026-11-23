import { enableStatementCache } from "./statements.ts";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DeletionsLog } from "./deletions-log.ts";
import { migrate, MIGRATIONS, type Target } from "./migrations.ts";
import { forgetInterned } from "./registry.ts";
import { RestrictionsLog } from "./restrictions-log.ts";

/** The attached store files: registry, user state, share-alike rows, licensed market series (§3.5). */
export const STORE_SCHEMAS = ["main", "user", "sa", "cc"] as const;
export type StoreSchema = (typeof STORE_SCHEMAS)[number];

export type Store = {
  db: DatabaseSync;
  paths: Record<StoreSchema, string>;
  /** The two fail-closed logs beside the store files; null for an in-memory store. */
  logs: { deletions: DeletionsLog; restrictions: RestrictionsLog } | null;
  close(): void;
};

/** Creates an empty log only if none exists, so an existing one is never truncated. */
function createLog(path: string): void {
  try {
    closeSync(openSync(path, "wx"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

/** The number of migrations each file reaches when fully migrated. */
const migratedVersions = () => Object.fromEntries((["main", "user", "sa", "cc"] as Target[]).map((t) => [t, MIGRATIONS.filter((m) => m.target === t).length])) as Record<Target, number>;

const notMigrated = () => Object.assign(new Error("store_not_migrated: open the full store first, which migrates every file"), { code: "store_not_migrated" });

/** Whether the full open recorded every file at this build's migration versions. */
function fullyMigrated(db: DatabaseSync): boolean {
  try {
    const row = db.prepare("SELECT value FROM main.store_meta WHERE key = 'migrated'").get() as { value: string } | undefined;
    if (!row) return false;
    const recorded = JSON.parse(row.value) as Partial<Record<Target, number>>;
    // Equal, not at least: a record from a newer build is no proof for this one (R4).
    return Object.entries(migratedVersions()).every(([t, n]) => recorded[t as Target] === n);
  } catch {
    return false;
  }
}

/** The full open records the versions every file now has; written only when they changed. */
function recordMigrated(db: DatabaseSync): void {
  const value = JSON.stringify(migratedVersions());
  const row = db.prepare("SELECT value FROM main.store_meta WHERE key = 'migrated'").get() as { value: string } | undefined;
  if (row?.value !== value) db.prepare("INSERT INTO main.store_meta (key, value) VALUES ('migrated', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(value);
}

/**
 * Opens the four store files and attaches them as `main`, `user`, `sa` and `cc` (architecture §3.5,
 * §8, §16). `cc` is connector-cache.db: licensed market series, never exported or backed up (R17).
 * `dataDir: null` opens all four in memory, for tests. The logs are created with a new
 * user file only: a log missing beside an existing store is damage, and reads and repairs refuse.
 * `sync`: the sync worker's connection, closed when its batch ends. It gets the statement cache and a
 * 64 MB page cache (cto's fixes 2 and 5); no other connection does.
 */
export function openStore(options: { dataDir: string | null; sync?: boolean }): Store {
  const paths = options.dataDir
    ? {
        main: join(options.dataDir, "finora.db"),
        user: join(options.dataDir, "finora-user.db"),
        sa: join(options.dataDir, "finora-sa.db"),
        cc: join(options.dataDir, "connector-cache.db"),
      }
    : { main: ":memory:", user: ":memory:", sa: ":memory:", cc: ":memory:" };
  const sync = options.sync === true;
  // A sync-only open on disk never migrates and creates nothing: the full open comes first (item 6).
  if (sync && options.dataDir && !existsSync(paths.main)) throw notMigrated();
  if (options.dataDir) mkdirSync(options.dataDir, { recursive: true });
  const db = new DatabaseSync(paths.main);
  // First, so that two processes opening one store at once wait for each other instead of failing:
  // even a first read meets another connection's lock (a migration, a TRUNCATE checkpoint). Opening
  // waits long: the other may be migrating a fresh store on a busy machine (qa NIT on S05).
  db.exec("PRAGMA busy_timeout = 60000");
  // Before the attaches, which take it over: a deleted row's bytes are overwritten, on every
  // connection, the sync's included, since a rewrite deletes the value it replaces (legal on fix 7).
  db.exec("PRAGMA secure_delete = ON");
  // No connection checkpoints inside its own COMMIT: the sync checkpoints outside its transactions,
  // and a long-lived process runs idle maintenance (cto's fix 7; see maintenance.ts).
  db.exec("PRAGMA wal_autocheckpoint = 0");
  // The sync connection attaches only the files a sync writes (cto 7087614308, council): a BEGIN
  // IMMEDIATE takes the write lock of every attached file, so with `user` attached a long sync batch
  // made a user's save wait and fail "database is locked". User state lives in `user`, markets in `cc`.
  const schemas: readonly StoreSchema[] = sync ? ["main", "sa"] : STORE_SCHEMAS;
  // Checked before `sa` is attached, which would create its file (R3).
  if (sync && options.dataDir && (!fullyMigrated(db) || !existsSync(paths.sa))) {
    db.close();
    throw notMigrated();
  }
  if (schemas.includes("user")) db.prepare("ATTACH DATABASE ? AS user").run(paths.user);
  db.prepare("ATTACH DATABASE ? AS sa").run(paths.sa);
  if (schemas.includes("cc")) db.prepare("ATTACH DATABASE ? AS cc").run(paths.cc);
  for (const schema of schemas) {
    if (options.dataDir) db.exec(`PRAGMA ${schema}.journal_mode = WAL`);
    db.exec(`PRAGMA ${schema}.synchronous = NORMAL`);
  }
  db.exec("PRAGMA foreign_keys = ON");
  // Savepoints and the staged keys stay in memory (cto's fix 4).
  db.exec("PRAGMA temp_store = MEMORY");
  if (options.sync === true) {
    db.exec("PRAGMA main.cache_size = -65536");
    enableStatementCache(db);
  }
  const fresh = schemas.includes("user") && (db.prepare("PRAGMA user.user_version").get() as { user_version: number }).user_version === 0;
  // No file may be newer than this build: an older build would write a schema it does not know (R4).
  const expected = migratedVersions();
  const versionOf = (schema: StoreSchema) => (db.prepare(`PRAGMA ${schema}.user_version`).get() as { user_version: number }).user_version;
  const tooNew = schemas.find((schema) => versionOf(schema) > expected[schema]);
  if (tooNew) {
    db.close();
    throw Object.assign(new Error(`store_too_new: ${tooNew} was migrated by a newer build`), { code: "store_too_new" });
  }
  // An in-memory sync store has no full open before it, so it migrates its own two files (tests).
  if (!(sync && options.dataDir)) migrate(db, undefined, schemas);
  // The sync-only open reads the files' own versions too, not only the record (R3).
  if (sync && options.dataDir && schemas.some((schema) => versionOf(schema) !== expected[schema])) {
    db.close();
    throw notMigrated();
  }
  if (!sync) recordMigrated(db);
  db.exec("PRAGMA busy_timeout = 5000");
  let logs: Store["logs"] = null;
  // The logs belong to the connections that serve users; the sync connection has none.
  if (options.dataDir && schemas.includes("user")) {
    const deletions = join(options.dataDir, "deletions.log");
    const restrictions = join(options.dataDir, "restrictions.log");
    if (fresh) for (const path of [deletions, restrictions]) createLog(path);
    logs = { deletions: new DeletionsLog(deletions), restrictions: new RestrictionsLog(restrictions) };
  }
  return { db, paths, logs, close: () => db.close() };
}

/** Runs fn in one transaction. */
export function transaction<T>(db: DatabaseSync, fn: () => T, mode: "DEFERRED" | "IMMEDIATE" = "DEFERRED"): T {
  db.exec(`BEGIN ${mode}`);
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    forgetInterned(db);
    throw error;
  }
}
