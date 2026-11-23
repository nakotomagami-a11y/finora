// WAL checkpoints and the purge steps (cto's fix 7 on S05; legal's purge conditions; council on
// target 3). No connection checkpoints inside its own COMMIT (`wal_autocheckpoint = 0` in openStore):
// a sync checkpoints between its transactions, and the work a delete leaves owed is kept as a row in
// `main.maintenance_due`, so a sync cut off before it leaves it for the next sync, the idle timer or
// the boot. The order after a delete (legal): secure_delete is on for every connection, the FTS
// indexes are merged when search rows were deleted, then a TRUNCATE checkpoint empties the WAL.
import type { DatabaseSync } from "node:sqlite";
import { prepared } from "./statements.ts";

export type MaintenanceKind = "fts_merge" | "wal_truncate";
export type CheckpointMode = "PASSIVE" | "TRUNCATE";
export type CheckpointResult = { ms: number; busy: boolean; log: number; checkpointed: number };
/** One maintenance write, on its own line in a sync report: never folded into the transaction p95. */
export type MaintenanceStep = { kind: MaintenanceKind; ms: number; steps: number; maxStepMs: number; busy?: boolean };

/** Pages one FTS merge step may write: each step is its own short transaction, far under 5 s (council). */
export const FTS_MERGE_PAGES = 2000;
const SEARCH_TABLES = ["entities_fts", "entities_trigram"] as const;

/** Records that a write left this maintenance owed; done in the writer's own transaction. */
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

/** One table merged in bounded steps until FTS5 reports no work left; each step is one transaction. */
function mergeSearchTable(db: DatabaseSync, table: (typeof SEARCH_TABLES)[number]): { steps: number; ms: number; maxStepMs: number } {
  let steps = 0;
  let ms = 0;
  let maxStepMs = 0;
  for (;;) {
    const start = performance.now();
    const before = (db.prepare("SELECT total_changes() AS n").get() as { n: number }).n;
    db.exec("BEGIN IMMEDIATE");
    try {
      // A negative budget lets the steps merge every segment into one, as `optimize` would: the terms
      // of deleted rows go with the old segments (cto 7087224181), but no single write is long.
      db.prepare(`INSERT INTO main.${table} (${table}, rank) VALUES ('merge', ?)`).run(-FTS_MERGE_PAGES);
      db.exec("COMMIT");
    } catch (error) {
      if (db.isTransaction) db.exec("ROLLBACK");
      throw error;
    }
    const took = performance.now() - start;
    steps++;
    ms += took;
    maxStepMs = Math.max(maxStepMs, took);
    if ((db.prepare("SELECT total_changes() AS n").get() as { n: number }).n - before < 2) return { steps, ms, maxStepMs };
  }
}

/**
 * Runs the maintenance owed, outside any transaction, and reports each kind on its own line. A merge
 * leaves a TRUNCATE owed. A TRUNCATE that a reader blocks stays owed, is reported busy, and runs on
 * the next call (the next sync's end, the idle timer, the boot), never silently dropped.
 */
export function runMaintenance(db: DatabaseSync): MaintenanceStep[] {
  if (db.isTransaction) throw new Error("maintenance runs outside a transaction");
  const due = new Set(maintenanceDue(db));
  const steps: MaintenanceStep[] = [];
  if (due.has("fts_merge")) {
    let total = { steps: 0, ms: 0, maxStepMs: 0 };
    for (const table of SEARCH_TABLES) {
      const one = mergeSearchTable(db, table);
      total = { steps: total.steps + one.steps, ms: total.ms + one.ms, maxStepMs: Math.max(total.maxStepMs, one.maxStepMs) };
    }
    db.exec("BEGIN IMMEDIATE");
    prepared(db, "DELETE FROM main.maintenance_due WHERE kind = 'fts_merge'").run();
    markMaintenance(db, "wal_truncate");
    db.exec("COMMIT");
    steps.push({ kind: "fts_merge", ...total });
    due.add("wal_truncate");
  }
  if (due.has("wal_truncate")) {
    // The TRUNCATE first, its mark deleted only once it succeeded: neither a crash between the two nor
    // a busy reader loses it (K3, legal). The mark's own delete leaves one page in the WAL, which
    // holds that table only.
    const result = checkpoint(db, "TRUNCATE");
    if (!result.busy) prepared(db, "DELETE FROM main.maintenance_due WHERE kind = 'wal_truncate'").run();
    steps.push({ kind: "wal_truncate", ms: result.ms, steps: 1, maxStepMs: result.ms, ...(result.busy ? { busy: true } : {}) });
  }
  return steps;
}

/** Whether any source's sync lease is live now. */
function syncRunning(db: DatabaseSync, now = Date.now()): boolean {
  return prepared(db, "SELECT 1 FROM main.leases WHERE resource LIKE 'sync:%' AND expires_at > ? LIMIT 1").get(now) !== undefined;
}

/**
 * A long-lived process's own checkpoints (the server): at start and on an idle timer, a PASSIVE
 * checkpoint bounds the WAL between syncs, and any maintenance owed runs. Never inside a user's commit.
 */
export function startIdleMaintenance(db: DatabaseSync, options: { intervalMs?: number; onStep?: (steps: MaintenanceStep[], passive: CheckpointResult) => void } = {}): () => void {
  const tick = () => {
    // A live sync checkpoints and truncates for itself: the idle tick never runs beside it (qa, legal).
    if (db.isTransaction || syncRunning(db)) return;
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
