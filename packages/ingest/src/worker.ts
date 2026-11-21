// Runs syncs in a worker thread (architecture §4.5). The worker never imports a module named in its
// job: its entry module fixes the registry and resolves each source id against it (SEC-11). A
// live-no-store view and a person list (sanctions.md §7a) are posted back to the process that
// serves them (qa M1), and a hung or crashed worker ends as a failed sync, never a `running` row
// (SEC-12). One worker runs a batch of sources in order, each under its own lease: starting and stopping many short-lived worker isolates
// occasionally crashed V8 on Windows (a JIT page check), so a CLI run uses one worker.
import { parentPort, Worker, workerData } from "node:worker_threads";
import { personListHeld, setPersonList, type PersonList } from "@finora/resolve";
import { politeFetch, type SourceLoader } from "@finora/sources";
import { failSync, openStore, releaseLease } from "@finora/store";
import { liveView, setLiveView, type LiveView } from "./live-views.ts";
import { runSync, type SyncOptions, type SyncOutcome } from "./pipeline.ts";

type JobOptions = Omit<SyncOptions, "fetcher" | "signal" | "logger" | "now" | "onLiveView" | "onPersonList">;
export type WorkerJob = { dataDir: string; sourceId: string; userAgent: string; options: JobOptions };
export type WorkerBatch = { dataDir: string; sourceIds: string[]; userAgent: string; options: JobOptions; liveViewsHeld?: string[]; personListsHeld?: string[] };

type WorkerMessage =
  | { type: "progress" }
  | { type: "started"; sourceId: string; syncId: number }
  | { type: "live"; sourceId: string; view: LiveView }
  | { type: "persons"; sourceId: string; list: PersonList }
  | { type: "result"; sourceId: string; outcome: SyncOutcome }
  | { type: "done" };

const failed = (reason: string): SyncOutcome => ({
  kind: "failed",
  syncId: null,
  report: { read: 0, written: 0, unchanged: 0, deleted: 0, tombstoned: 0, skipped: {}, dropped: {}, droppedRows: [], events: 0, durationMs: 0, storage: "store", reason },
});

/** Call at the top of a worker entry module, with the registry that module trusts. */
export async function serveSyncWorker(resolve: (sourceId: string) => SourceLoader | undefined): Promise<void> {
  const batch = workerData as WorkerBatch;
  const post = (message: WorkerMessage) => parentPort?.postMessage(message);
  post({ type: "progress" });
  const store = openStore({ dataDir: batch.dataDir });
  try {
    for (const sourceId of batch.sourceIds) {
      const loader = resolve(sourceId);
      if (!loader) {
        post({ type: "result", sourceId, outcome: failed("unknown_source") });
        continue;
      }
      let outcome: SyncOutcome;
      try {
        const fetcher = politeFetch({
          officialHosts: loader.meta.officialHosts,
          userAgent: batch.userAgent,
          ...(loader.meta.limits.requestsPerSecond ? { requestsPerSecond: loader.meta.limits.requestsPerSecond } : {}),
          ...(loader.meta.limits.maxBytes ? { maxBytes: loader.meta.limits.maxBytes } : {}),
        });
        outcome = await runSync(store.db, loader, {
          ...batch.options,
          liveViewHeld: (batch.liveViewsHeld ?? []).includes(sourceId),
          personListHeld: (batch.personListsHeld ?? []).includes(sourceId),
          fetcher,
          onLiveView: (id, view) => post({ type: "live", sourceId: id, view }),
          onPersonList: (id, list) => post({ type: "persons", sourceId: id, list }),
          onProgress: () => post({ type: "progress" }),
          onStart: (syncId) => post({ type: "started", sourceId, syncId }),
        });
      } catch (error) {
        outcome = failed(error instanceof Error ? error.name : "worker_error");
      }
      post({ type: "result", sourceId, outcome });
    }
  } finally {
    // Closed before "done", so the caller may remove the data dir at once.
    store.close();
  }
  post({ type: "done" });
}

/**
 * Spawns `entry` (a module that calls `serveSyncWorker`) for a batch of sources, run in order.
 * Resolves with one outcome per source. A crash, the timeout or a hung worker (no progress for
 * longer than the lease TTL; its heartbeat beats every TTL/3) ends the batch: the running source
 * and every source not yet run end `failed`, the row that worker opened is closed and its lease is
 * released by holder, never another process's (cto, qa on S04i).
 */
export function runSyncsInWorker(entry: URL, batch: WorkerBatch, options: { timeoutMs?: number; startupMs?: number } = {}): Promise<SyncOutcome[]> {
  const holder = batch.options.holder ?? `worker-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const ttl = batch.options.leaseTtlMs ?? 60_000;
  const data: WorkerBatch = {
    ...batch,
    options: { ...batch.options, holder },
    liveViewsHeld: batch.liveViewsHeld ?? batch.sourceIds.filter((id) => liveView(id) !== null),
    personListsHeld: batch.personListsHeld ?? batch.sourceIds.filter((id) => personListHeld(id)),
  };
  return new Promise((resolve) => {
    const worker = new Worker(entry, { workerData: data });
    const outcomes = new Map<string, SyncOutcome>();
    let current: { sourceId: string; syncId: number } | null = null;
    let settled = false;
    const finish = () => resolve(batch.sourceIds.map((id) => outcomes.get(id) ?? failed("not_run")));
    const settle = (reason: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(watchdog);
      if (reason === null) return finish();
      for (const id of batch.sourceIds) if (!outcomes.has(id)) outcomes.set(id, failed(reason));
      // Terminated first, so the hung thread cannot write after its lease is released.
      void worker.terminate().then(() => {
        const store = openStore({ dataDir: batch.dataDir });
        try {
          if (current) {
            failSync(store.db, current.syncId, new Date().toISOString(), reason);
            releaseLease(store.db, { resource: `sync:${current.sourceId}`, holder, expiresAt: 0 });
          }
        } finally {
          store.close();
        }
        finish();
      });
    };
    const timer = setTimeout(() => settle("worker_timeout"), options.timeoutMs ?? 6 * 3_600_000);
    let watchdog = setTimeout(() => settle("worker_hung"), options.startupMs ?? Math.max(ttl, 30_000));
    worker.on("message", (message: WorkerMessage) => {
      if (message.type === "started") current = { sourceId: message.sourceId, syncId: message.syncId };
      else if (message.type === "progress") {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => settle("worker_hung"), ttl);
      } else if (message.type === "live") setLiveView(message.sourceId, message.view);
      else if (message.type === "persons") setPersonList(message.sourceId, message.list);
      else if (message.type === "result") {
        outcomes.set(message.sourceId, message.outcome);
        if (current?.sourceId === message.sourceId) current = null;
        clearTimeout(watchdog);
        watchdog = setTimeout(() => settle("worker_hung"), Math.max(ttl, 30_000));
      } else settle(null);
    });
    worker.once("error", () => settle("worker_crashed"));
    worker.once("exit", (code) => settle(`worker_exit_${code}`));
  });
}

/** One source in its own worker. */
export async function runSyncInWorker(entry: URL, job: WorkerJob, options: { timeoutMs?: number; startupMs?: number } = {}): Promise<SyncOutcome> {
  const { sourceId, ...rest } = job;
  const [outcome] = await runSyncsInWorker(entry, { ...rest, sourceIds: [sourceId] }, options);
  return outcome ?? failed("not_run");
}
