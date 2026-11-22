// WAL checkpoints and the purge step (cto's fix 7 on S05; legal's purge conditions; council on
// target 3). No connection checkpoints inside its own COMMIT (`wal_autocheckpoint = 0` in openStore):
// a sync checkpoints between its transactions, and the TRUNCATE a delete leaves owed is kept as a
// row in `main.maintenance_due`, so a sync cut off before it leaves it for the next sync, the idle
// timer or the boot. The order after a delete (legal): secure_delete is on for every connection, the
// FTS indexes drop a deleted row's terms at once (their `secure-delete` option, set by a migration),
// then a TRUNCATE checkpoint empties the WAL.
import type { DatabaseSync } from "node:sqlite";
import { prepared } from "./statements.ts";

export type MaintenanceKind = "wal_truncate";
export type CheckpointMode = "PASSIVE" | "TRUNCATE";
export type CheckpointResult = { ms: number; busy: boolean; log: number; checkpointed: number };
/** One maintenance write, on its own line in a sync report: never folded into the transaction p95. */
export type MaintenanceStep = { kind: MaintenanceKind; ms: number; steps: number; maxStepMs: number; busy?: boolean };

/** Records that a write left this maintenance owed; done in the writer's own transaction, or on its own. */
export function markMaintenance(db: DatabaseSync, kind: MaintenanceKind): void {
  prepared(db, "INSERT OR IGNORE INTO main.maintenance_due (kind) VALUES (?)").run(kind);
}

export function maintenanceDue(db: DatabaseSync): MaintenanceKind[] {
  return (prepared(db, "SELECT kind FROM main.maintenance_due ORDER BY kind").all() as { kind: MaintenanceKind }[]).map((r) => r.kind);
}

/**
 * A WAL checkpoint, outside any transaction. TRUNCATE never waits: with a reader on an old snapshot
 * or another writer it reports busy at once, and the caller keeps it owed.
 */
export function checkpoint(db: DatabaseSync, mode: CheckpointMode, schema?: "main" | "sa"): CheckpointResult {
  const start = performance.now();
  if (mode === "TRUNCATE") db.exec("PRAGMA busy_timeout = 0");
  try {
    const row = db.prepare(`PRAGMA ${schema ? `${schema}.` : ""}wal_checkpoint(${mode})`).get() as { busy: number; log: number; checkpointed: number };
    // An in-memory store has no WAL: log and checkpointed read -1.
    const busy = row.busy !== 0 || (row.log > 0 && row.checkpointed < row.log);
    return { ms: performance.now() - start, busy, log: Math.max(0, row.log), checkpointed: Math.max(0, row.checkpointed) };
  } finally {
    if (mode === "TRUNCATE") db.exec("PRAGMA busy_timeout = 5000");
  }
}

/**
 * Runs the maintenance owed, outside any transaction, and reports it on its own line. A TRUNCATE
 * that a reader blocks stays owed, is reported busy, and runs on the next call (the next sync's end,
 * the idle timer, the boot), never silently dropped.
 */
export function runMaintenance(db: DatabaseSync): MaintenanceStep[] {
  if (db.isTransaction) throw new Error("maintenance runs outside a transaction");
  if (!maintenanceDue(db).includes("wal_truncate")) return [];
  // The mark goes first: after a TRUNCATE nothing may be written to the WAL again.
  prepared(db, "DELETE FROM main.maintenance_due WHERE kind = 'wal_truncate'").run();
  const result = checkpoint(db, "TRUNCATE");
  if (result.busy) markMaintenance(db, "wal_truncate");
  return [{ kind: "wal_truncate", ms: result.ms, steps: 1, maxStepMs: result.ms, ...(result.busy ? { busy: true } : {}) }];
}

/**
 * A long-lived process's own checkpoints (the server): at start and on an idle timer, a PASSIVE
 * checkpoint bounds the WAL between syncs, and a TRUNCATE a sync left owed runs. Never inside a
 * user's commit.
 */
export function startIdleMaintenance(db: DatabaseSync, options: { intervalMs?: number; onStep?: (steps: MaintenanceStep[], passive: CheckpointResult) => void } = {}): () => void {
  const tick = () => {
    if (db.isTransaction) return;
    try {
      const passive = checkpoint(db, "PASSIVE");
      options.onStep?.(runMaintenance(db), passive);
    } catch {
      // A busy store or a closed connection: the next tick tries again.
    }
  };
  tick();
  const timer = setInterval(tick, options.intervalMs ?? 60_000);
  timer.unref?.();
  return () => clearInterval(timer);
}
