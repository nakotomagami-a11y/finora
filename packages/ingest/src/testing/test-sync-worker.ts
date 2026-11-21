// A worker entry for the ingest tests: it trusts the test sources only.
import { serveSyncWorker } from "../worker.ts";
import { companies, fakeSource } from "./fake-source.ts";
import { LIVE_SENTINEL } from "./sentinels.ts";
import { slowSource } from "./slow-source.ts";

const liveSource = fakeSource({ id: "fake-live", storage: "live-no-store" }, { records: companies(1, 4) });

/** A live-no-store source carrying a sentinel value: no file may ever hold its bytes. */
const sentinelSource = fakeSource(
  { id: "fake-live-sentinel", storage: "live-no-store" },
  { records: [{ recordKey: "k1", hashInput: ["1"], entities: [{ eid: "lv-00000000001", schema: "Company", country: "lv", statements: [{ prop: "notes", value: LIVE_SENTINEL, itemId: "S01.LV.01" }] }] }] },
);

/** Its download never answers: the parent's timeout must end it. */
const stuckSource = fakeSource({ id: "fake-stuck" }, { records: [] });
stuckSource.fetch = () => new Promise(() => {});

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

await serveSyncWorker((sourceId) => [slowSource, liveSource, sentinelSource, stuckSource, hungSource, crashSource].find((l) => l.meta.id === sourceId));
