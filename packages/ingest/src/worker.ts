// Runs one sync in a worker thread (architecture §4.5). The worker never imports a module named
// in its job: its entry module fixes the registry and resolves the job's source id against it
// (SEC-11). A live-no-store view is posted back to the process that serves it (qa M1), and a hung
// or crashed worker ends as a failed sync, never a `running` row (SEC-12).
import { parentPort, Worker, workerData } from "node:worker_threads";
import { politeFetch, type SourceLoader } from "@finora/sources";
import { failSync, openStore, releaseLease } from "@finora/store";
import { liveView, setLiveView, type LiveView } from "./live-views.ts";
import { runSync, type SyncOptions, type SyncOutcome } from "./pipeline.ts";

export type WorkerJob = {
  dataDir: string;
  sourceId: string;
  userAgent: string;
  options: Omit<SyncOptions, "fetcher" | "signal" | "logger" | "now" | "onLiveView">;
};

type WorkerMessage =
  | { type: "progress" }
  | { type: "started"; syncId: number }
  | { type: "live"; sourceId: string; view: LiveView }
  | { type: "done"; outcome: SyncOutcome }
  | { type: "error"; error: string };

/** Call at the top of a worker entry module, with the registry that module trusts. */
export async function serveSyncWorker(resolve: (sourceId: string) => SourceLoader | undefined): Promise<void> {
  const job = workerData as WorkerJob;
  const post = (message: WorkerMessage) => parentPort?.postMessage(message);
  const loader = resolve(job.sourceId);
  if (!loader) {
    post({ type: "error", error: "unknown source" });
    return;
  }
  post({ type: "progress" });
  const store = openStore({ dataDir: job.dataDir });
  let result: WorkerMessage;
  try {
    const fetcher = politeFetch({
      officialHosts: loader.meta.officialHosts,
      userAgent: job.userAgent,
      ...(loader.meta.limits.requestsPerSecond ? { requestsPerSecond: loader.meta.limits.requestsPerSecond } : {}),
    });
    const outcome = await runSync(store.db, loader, {
      ...job.options,
      fetcher,
      onLiveView: (sourceId, view) => post({ type: "live", sourceId, view }),
      onProgress: () => post({ type: "progress" }),
      onStart: (syncId) => post({ type: "started", syncId }),
    });
    result = { type: "done", outcome };
  } catch (error) {
    result = { type: "error", error: error instanceof Error ? error.name : "sync failed" };
  } finally {
    // Closed before the result is posted, so the caller may remove the data dir at once.
    store.close();
  }
  post(result);
}

const failed = (reason: string): SyncOutcome => ({
  kind: "failed",
  syncId: null,
  report: { read: 0, written: 0, unchanged: 0, deleted: 0, tombstoned: 0, skipped: {}, dropped: {}, droppedRows: [], events: 0, durationMs: 0, storage: "store", reason },
});

/**
 * Spawns `entry` (a module that calls `serveSyncWorker`) for one source. Resolves with the
 * outcome; a crash, an error, the timeout or a hung worker resolve as `failed` after closing the
 * sync row. A worker that sends no progress for longer than its lease TTL (its heartbeat beats
 * every TTL/3) is hung: it is terminated and its lease released (cto on S04i).
 */
export function runSyncInWorker(entry: URL, job: WorkerJob, options: { timeoutMs?: number; startupMs?: number } = {}): Promise<SyncOutcome> {
  const holder = job.options.holder ?? `worker-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const ttl = job.options.leaseTtlMs ?? 60_000;
  const data: WorkerJob = { ...job, options: { ...job.options, holder, liveViewHeld: job.options.liveViewHeld ?? liveView(job.sourceId) !== null } };
  return new Promise((resolve) => {
    const worker = new Worker(entry, { workerData: data });
    let settled = false;
    let syncId: number | null = null;
    const settle = (outcome: SyncOutcome, cleanUp: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(watchdog);
      const close = () => {
        const store = openStore({ dataDir: job.dataDir });
        try {
          // Only the row this worker opened: another process may be running a healthy sync of the source.
          if (syncId !== null) failSync(store.db, syncId, new Date().toISOString(), outcome.report?.reason ?? "worker_failed");
          releaseLease(store.db, { resource: `sync:${job.sourceId}`, holder, expiresAt: 0 });
        } finally {
          store.close();
        }
      };
      if (cleanUp) {
        // Terminated first, so the hung thread cannot write after its lease is released.
        void worker.terminate().then(() => {
          close();
          resolve(outcome);
        });
        return;
      }
      resolve(outcome);
    };
    const timer = setTimeout(() => settle(failed("worker_timeout"), true), options.timeoutMs ?? 6 * 3_600_000);
    let watchdog = setTimeout(() => settle(failed("worker_hung"), true), options.startupMs ?? Math.max(ttl, 30_000));
    worker.on("message", (message: WorkerMessage) => {
      if (message.type === "started") syncId = message.syncId;
      else if (message.type === "progress") {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => settle(failed("worker_hung"), true), ttl);
      } else if (message.type === "live") setLiveView(message.sourceId, message.view);
      else if (message.type === "done") settle(message.outcome, false);
      else settle(failed(message.error === "unknown source" ? "unknown_source" : "worker_error"), true);
    });
    worker.once("error", () => settle(failed("worker_crashed"), true));
    worker.once("exit", (code) => settle(failed(`worker_exit_${code}`), true));
  });
}
