// Runs syncs in a worker thread (architecture §4.5). The worker never imports a module named in its
// job: its entry module fixes the registry and resolves each source id against it (SEC-11). A
// live-no-store view and a person list (sanctions.md §7a) are posted back to the process that
// serves them (qa M1), and a hung or crashed worker ends as a failed sync, never a `running` row
// (SEC-12). One worker runs a batch of sources in order, each under its own lease: starting and stopping many short-lived worker isolates
// occasionally crashed V8 on Windows (a JIT page check), so a CLI run uses one worker.
import { join } from "node:path";
import { getHeapStatistics } from "node:v8";
import { parentPort, Worker, workerData } from "node:worker_threads";
import { personListHeld, setPersonList, type PersonList } from "@finora/resolve";
import { politeFetch, type LoaderConfig, type PoliteFetchOptions, type SourceLoader, type SourceMeta } from "@finora/sources";
import { failSync, openStore, releaseLease } from "@finora/store";
import { liveView, setLiveView, type LiveView } from "./live-views.ts";
import { removeWorkDirs } from "./work-dirs.ts";
import { runSync, type SyncOptions, type SyncOutcome } from "./pipeline.ts";

type JobOptions = Omit<SyncOptions, "fetcher" | "signal" | "logger" | "now" | "onLiveView" | "onPersonList">;
export type WorkerJob = { dataDir: string; sourceId: string; userAgent: string; options: JobOptions; config: LoaderConfig };
export type WorkerBatch = { dataDir: string; sourceIds: string[]; userAgent: string; options: JobOptions; liveViewsHeld?: string[]; personListsHeld?: string[]; config: LoaderConfig };

type WorkerMessage =
  | { type: "progress" }
  | { type: "started"; sourceId: string; syncId: number }
  | { type: "live"; sourceId: string; view: LiveView }
  | { type: "persons"; sourceId: string; list: PersonList }
  | { type: "result"; sourceId: string; outcome: SyncOutcome; peakHeapMb?: number }
  | { type: "done" };

const failed = (reason: string): SyncOutcome => ({
  kind: "failed",
  syncId: null,
  report: { read: 0, written: 0, unchanged: 0, deleted: 0, tombstoned: 0, skipped: {}, dropped: {}, droppedRows: [], events: 0, durationMs: 0, storage: "store", reason },
});

/**
 * A source's fetcher options. Its byte cap bounds a buffered response and a body streamed to a file
 * alike: a streamed file can hold person data, so it gets no larger cap than the source declares
 * (N6 on S05; legal: the cap is part of the person-data bounds).
 */
export function sourceFetchOptions(meta: SourceMeta, userAgent: string): PoliteFetchOptions {
  return {
    officialHosts: meta.officialHosts,
    userAgent,
    ...(meta.limits.requestsPerSecond ? { requestsPerSecond: meta.limits.requestsPerSecond } : {}),
    ...(meta.limits.maxBytes ? { maxBytes: meta.limits.maxBytes, maxFileBytes: meta.limits.maxBytes } : {}),
    ...(meta.limits.allowHttp === true ? { allowHttp: true } : {}),
  };
}

/** Call at the top of a worker entry module, with the registry that module trusts, built for the job's config. */
export async function serveSyncWorker(resolve: (sourceId: string, config: LoaderConfig) => SourceLoader | undefined): Promise<void> {
  const batch = workerData as WorkerBatch;
  const post = (message: WorkerMessage) => parentPort?.postMessage(message);
  post({ type: "progress" });
  // The sync connection: statement and page caches, closed when the batch ends (which finalizes every statement).
  const store = openStore({ dataDir: batch.dataDir, sync: true });
  try {
    for (const sourceId of batch.sourceIds) {
      // No fallback: a batch without its config (LV_PERSON_ROWS) loads nothing (qa on 69a9568).
      if (!batch.config) {
        post({ type: "result", sourceId, outcome: failed("config_missing") });
        continue;
      }
      const loader = resolve(sourceId, batch.config);
      if (!loader) {
        post({ type: "result", sourceId, outcome: failed("unknown_source") });
        continue;
      }
      let outcome: SyncOutcome;
      // This isolate's heap peak while this source ran: which source drives a lane's memory (P10).
      let peak = getHeapStatistics().used_heap_size;
      const sample = () => void (peak = Math.max(peak, getHeapStatistics().used_heap_size));
      try {
        const fetcher = politeFetch(sourceFetchOptions(loader.meta, batch.userAgent));
        outcome = await runSync(store.db, loader, {
          ...batch.options,
          liveViewHeld: (batch.liveViewsHeld ?? []).includes(sourceId),
          personListHeld: (batch.personListsHeld ?? []).includes(sourceId),
          fetcher,
          onLiveView: (id, view) => post({ type: "live", sourceId: id, view }),
          onPersonList: (id, list) => post({ type: "persons", sourceId: id, list }),
          onProgress: () => {
            sample();
            post({ type: "progress" });
          },
          onStart: (syncId) => post({ type: "started", sourceId, syncId }),
        });
      } catch (error) {
        outcome = failed(error instanceof Error ? error.name : "worker_error");
      }
      sample();
      post({ type: "result", sourceId, outcome, peakHeapMb: Math.ceil(peak / 1_048_576) });
    }
  } finally {
    // Closed before "done", so the caller may remove the data dir at once.
    store.close();
  }
  post({ type: "done" });
}

/**
 * A sync worker's old-generation heap cap (cto, qa on S06 SEC-1). It is the crash guard only: buffers
 * are external memory, so P10's RSS budget per worker stays the real bound (architecture §4.5).
 */
export const SYNC_WORKER_HEAP_MB = 768;
/** A sync's outcome from a worker, with the worker heap's peak while that source ran. */
export type WorkerOutcome = SyncOutcome & { peakHeapMb?: number };
export type WorkerLimits = { timeoutMs?: number; startupMs?: number; maxHeapMb?: number };

let started = 0;
/** How many sync workers this process has started: the lane test counts them (cto on S04i). */
export const workerStartCount = () => started;

/** The lane a source loads in: its declared lane, else its country (architecture §4.5). */
export const laneOf = (loader: SourceLoader) => loader.meta.lane ?? loader.meta.country;

/**
 * The sources grouped by lane, each lane in load order: `meta.order` ascending (the register is 0,
 * the default 100), then list order. The CLI and the scheduler both use it, so neither depends on
 * how a profile happens to list its sources (cto on S04i).
 */
export function lanesOf(loaders: readonly SourceLoader[]): Map<string, string[]> {
  const lanes = new Map<string, SourceLoader[]>();
  for (const loader of loaders) lanes.set(laneOf(loader), [...(lanes.get(laneOf(loader)) ?? []), loader]);
  const rank = (loader: SourceLoader) => loader.meta.order ?? 100;
  return new Map([...lanes].map(([lane, list]) => [lane, [...list].sort((a, b) => rank(a) - rank(b)).map((l) => l.meta.id)]));
}

/**
 * Spawns `entry` (a module that calls `serveSyncWorker`) for a batch of sources, run in order.
 * Resolves with one outcome per source. A crash, the timeout or a hung worker (no progress for
 * longer than the lease TTL; its heartbeat beats every TTL/3) ends the batch: the running source
 * and every source not yet run end `failed`, the row that worker opened is closed and its lease is
 * released by holder, never another process's (cto, qa on S04i).
 */
export function runSyncsInWorker(entry: URL, batch: WorkerBatch, options: WorkerLimits = {}): Promise<WorkerOutcome[]> {
  const holder = batch.options.holder ?? `worker-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const ttl = batch.options.leaseTtlMs ?? 60_000;
  // A work base of the store's own, so the parent may remove what a terminated worker left there.
  const workDir = batch.options.workDir ?? join(batch.dataDir, "work");
  const data: WorkerBatch = {
    ...batch,
    options: { ...batch.options, holder, workDir },
    liveViewsHeld: batch.liveViewsHeld ?? batch.sourceIds.filter((id) => liveView(id) !== null),
    personListsHeld: batch.personListsHeld ?? batch.sourceIds.filter((id) => personListHeld(id)),
  };
  // The full store is opened (and migrated) here first: a worker's sync-only open never migrates and
  // refuses a store that is not complete (item 6 on S05).
  openStore({ dataDir: batch.dataDir }).close();
  return new Promise((resolve) => {
    // A heap cap per worker: a loader or reader that runs away ends its own lane's sync as failed,
    // never the parent process (SEC-1 on S06, qa).
    const worker = new Worker(entry, { workerData: data, resourceLimits: { maxOldGenerationSizeMb: options.maxHeapMb ?? SYNC_WORKER_HEAP_MB } });
    started++;
    const outcomes = new Map<string, WorkerOutcome>();
    const finished = new Set<string>();
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
        // The terminated thread never reached its own cleanup: its downloads go now, before the
        // lease is released, for every source of the batch that had not finished (legal condition 1).
        removeWorkDirs(workDir, batch.sourceIds.filter((id) => !finished.has(id)));
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
        outcomes.set(message.sourceId, message.peakHeapMb === undefined ? message.outcome : { ...message.outcome, peakHeapMb: message.peakHeapMb });
        finished.add(message.sourceId);
        if (current?.sourceId === message.sourceId) current = null;
        clearTimeout(watchdog);
        watchdog = setTimeout(() => settle("worker_hung"), Math.max(ttl, 30_000));
      } else settle(null);
    });
    worker.once("error", (error: Error & { code?: string }) => settle(error.code === "ERR_WORKER_OUT_OF_MEMORY" ? "worker_out_of_memory" : "worker_crashed"));
    worker.once("exit", (code) => settle(`worker_exit_${code}`));
  });
}

/** One source in its own worker. */
export async function runSyncInWorker(entry: URL, job: WorkerJob, options: WorkerLimits = {}): Promise<SyncOutcome> {
  const { sourceId, ...rest } = job;
  const [outcome] = await runSyncsInWorker(entry, { ...rest, sourceIds: [sourceId] }, options);
  return outcome ?? failed("not_run");
}
