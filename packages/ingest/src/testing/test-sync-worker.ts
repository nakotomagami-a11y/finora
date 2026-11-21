// A worker entry for the ingest tests: it trusts the test sources only.
import { serveSyncWorker } from "../worker.ts";
import { companies, fakeSource, roleSetRecord } from "./fake-source.ts";
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

/** Allocates without bound once it parses, as a reader with no row cap would (SEC-1 on S06). */
const oomSource = fakeSource({ id: "fake-oom" }, { records: companies(1, 3) });
oomSource.parse = function* () {
  const held: number[][] = [];
  for (;;) held.push(Array.from({ length: 1_000_000 }, (_, i) => i));
};

/**
 * Yields companies and their role sets (person lines), so a write transaction holding person rows
 * is open, then runs out of memory inside it (legal on S06, qa).
 */
const oomMidSource = fakeSource(
  { id: "fake-oom-mid" },
  { records: [...companies(1, 3), ...[1, 2, 3].map((n) => roleSetRecord(n, [{ name: `Example Person ${n}`, role: "board_member", rowId: `${n}01` }]))] },
);
const parseRecords = oomMidSource.parse.bind(oomMidSource);
oomMidSource.parse = async function* (artifacts, context) {
  yield* parseRecords(artifacts, context);
  const held: number[][] = [];
  for (;;) held.push(Array.from({ length: 1_000_000 }, (_, i) => i));
};

await serveSyncWorker((sourceId) => [slowSource, liveSource, sentinelSource, stuckSource, hungSource, crashSource, oomSource, oomMidSource].find((l) => l.meta.id === sourceId));
