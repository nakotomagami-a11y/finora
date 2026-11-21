// A worker entry for the ingest tests: it trusts the test sources only.
import { serveSyncWorker } from "../worker.ts";
import { companies, fakeSource } from "./fake-source.ts";
import { slowSource } from "./slow-source.ts";

const liveSource = fakeSource({ id: "fake-live", storage: "live-no-store" }, { records: companies(1, 4) });

/** Spins without yielding once it starts parsing: no timer in its thread can fire again. */
const hungSource = fakeSource({ id: "fake-hung" }, { records: companies(1, 3) });
hungSource.parse = function* () {
  for (;;) {
    // Busy, never yielding.
  }
};

/** Ends its thread in the middle of a parse, as a crash would. */
const crashSource = fakeSource({ id: "fake-crash" }, { records: companies(1, 3) });
crashSource.parse = function* () {
  process.exit(3);
};

await serveSyncWorker((sourceId) => [slowSource, liveSource, hungSource, crashSource].find((l) => l.meta.id === sourceId));
