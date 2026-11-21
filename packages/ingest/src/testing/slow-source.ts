// A source for the concurrency test: a worker thread imports it by module URL. While a `hold`
// file exists in the job's data dir, its parse waits, so the test can start the second sync while
// the first one certainly holds the lease.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { workerData } from "node:worker_threads";
import { companies, fakeSource } from "./fake-source.ts";

const hold = typeof workerData?.dataDir === "string" ? join(workerData.dataDir as string, "hold") : null;

export const slowSource = fakeSource({ id: "fake-slow" }, { records: companies(1, 40) });
const parse = slowSource.parse.bind(slowSource);
slowSource.parse = async function* (raw, ctx) {
  while (hold !== null && existsSync(hold)) await new Promise((r) => setTimeout(r, 10));
  yield* parse(raw, ctx);
};
