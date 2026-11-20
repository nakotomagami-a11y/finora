import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "./migrations.ts";

export type Store = {
  db: DatabaseSync;
  paths: { main: string; user: string; sa: string };
  close(): void;
};

/**
 * Opens the three store files and attaches them as `main`, `user` and `sa` (architecture §3.5,
 * §16). `dataDir: null` opens all three in memory, for tests.
 */
export function openStore(options: { dataDir: string | null }): Store {
  const paths = options.dataDir
    ? {
        main: join(options.dataDir, "finora.db"),
        user: join(options.dataDir, "finora-user.db"),
        sa: join(options.dataDir, "finora-sa.db"),
      }
    : { main: ":memory:", user: ":memory:", sa: ":memory:" };
  if (options.dataDir) mkdirSync(options.dataDir, { recursive: true });
  const db = new DatabaseSync(paths.main);
  db.prepare("ATTACH DATABASE ? AS user").run(paths.user);
  db.prepare("ATTACH DATABASE ? AS sa").run(paths.sa);
  for (const schema of ["main", "user", "sa"]) {
    if (options.dataDir) db.exec(`PRAGMA ${schema}.journal_mode = WAL`);
    db.exec(`PRAGMA ${schema}.synchronous = NORMAL`);
  }
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  migrate(db);
  return { db, paths, close: () => db.close() };
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
    throw error;
  }
}
