// Runs one sync in a worker thread. The loader is named by module URL and export, because a
// function cannot cross the thread boundary; the worker builds its own polite fetcher.
import { Worker } from "node:worker_threads";
import type { SyncOptions, SyncOutcome } from "./pipeline.ts";

export type WorkerJob = {
  dataDir: string;
  loaderModule: string;
  loaderExport: string;
  userAgent: string;
  options: Omit<SyncOptions, "fetcher" | "signal" | "logger" | "now">;
};

export function runSyncInWorker(job: WorkerJob): Promise<SyncOutcome> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./sync-worker.ts", import.meta.url), { workerData: job });
    let settled = false;
    worker.once("message", (message: { ok: true; outcome: SyncOutcome } | { ok: false; error: string }) => {
      settled = true;
      if (message.ok) resolve(message.outcome);
      else reject(new Error(message.error));
    });
    worker.once("error", (error) => {
      settled = true;
      reject(error);
    });
    worker.once("exit", (code) => {
      if (!settled) reject(new Error(`sync worker exited with code ${code}`));
    });
  });
}
