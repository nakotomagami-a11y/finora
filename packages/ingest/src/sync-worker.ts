// A sync's own thread (architecture §4.5): opens its own store connection, so parsing never blocks
// the app's main thread and the source's lease decides who runs.
import { parentPort, workerData } from "node:worker_threads";
import { politeFetch, type SourceLoader } from "@finora/sources";
import { openStore } from "@finora/store";
import { runSync } from "./pipeline.ts";
import type { WorkerJob } from "./worker.ts";

const job = workerData as WorkerJob;
const loader = (await import(job.loaderModule))[job.loaderExport] as SourceLoader;
const store = openStore({ dataDir: job.dataDir });
try {
  const fetcher = politeFetch({
    officialHosts: loader.meta.officialHosts,
    userAgent: job.userAgent,
    ...(loader.meta.limits.requestsPerSecond ? { requestsPerSecond: loader.meta.limits.requestsPerSecond } : {}),
  });
  const outcome = await runSync(store.db, loader, { ...job.options, fetcher });
  parentPort?.postMessage({ ok: true, outcome });
} catch (error) {
  parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : "sync failed" });
} finally {
  store.close();
}
