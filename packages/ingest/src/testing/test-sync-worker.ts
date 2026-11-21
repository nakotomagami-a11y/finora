// A worker entry for the ingest tests: it trusts the test sources only.
import { serveSyncWorker } from "../worker.ts";
import { companies, fakeSource } from "./fake-source.ts";
import { slowSource } from "./slow-source.ts";

const liveSource = fakeSource({ id: "fake-live", storage: "live-no-store" }, { records: companies(1, 4) });

await serveSyncWorker((sourceId) => [slowSource, liveSource].find((l) => l.meta.id === sourceId));
