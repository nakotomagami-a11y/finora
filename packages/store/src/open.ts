import { closeSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DeletionsLog } from "./deletions-log.ts";
import { migrate } from "./migrations.ts";
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

/**
 * Opens the four store files and attaches them as `main`, `user`, `sa` and `cc` (architecture §3.5,
 * §8, §16). `cc` is connector-cache.db: licensed market series, never exported or backed up (R17).
 * `dataDir: null` opens all four in memory, for tests. The logs are created with a new
 * user file only: a log missing beside an existing store is damage, and reads and repairs refuse.
 */
export function openStore(options: { dataDir: string | null }): Store {
  const paths = options.dataDir
    ? {
        main: join(options.dataDir, "finora.db"),
        user: join(options.dataDir, "finora-user.db"),
        sa: join(options.dataDir, "finora-sa.db"),
        cc: join(options.dataDir, "connector-cache.db"),
      }
    : { main: ":memory:", user: ":memory:", sa: ":memory:", cc: ":memory:" };
  if (options.dataDir) mkdirSync(options.dataDir, { recursive: true });
  const db = new DatabaseSync(paths.main);
  // First, so that two processes opening one store at once wait for each other instead of failing.
  db.exec("PRAGMA busy_timeout = 5000");
  db.prepare("ATTACH DATABASE ? AS user").run(paths.user);
  db.prepare("ATTACH DATABASE ? AS sa").run(paths.sa);
  db.prepare("ATTACH DATABASE ? AS cc").run(paths.cc);
  for (const schema of STORE_SCHEMAS) {
    if (options.dataDir) db.exec(`PRAGMA ${schema}.journal_mode = WAL`);
    db.exec(`PRAGMA ${schema}.synchronous = NORMAL`);
  }
  db.exec("PRAGMA foreign_keys = ON");
  const fresh = (db.prepare("PRAGMA user.user_version").get() as { user_version: number }).user_version === 0;
  migrate(db);
  let logs: Store["logs"] = null;
  if (options.dataDir) {
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
