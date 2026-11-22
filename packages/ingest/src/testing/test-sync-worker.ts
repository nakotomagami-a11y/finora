// A worker entry for the ingest tests: it trusts the test sources only.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { serveSyncWorker } from "../worker.ts";
import { companies, fakeSource, roleSetRecord } from "./fake-source.ts";
import { LIVE_SENTINEL, WORK_SENTINEL } from "./sentinels.ts";
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

/**
 * Streamed sources that write a download holding a person-data sentinel into the work dir, then
 * never reach their own cleanup: they hang, crash, run out of memory or stall in the fetch.
 */
function streamedThen(id: string, after: "hang" | "crash" | "oom" | "stall") {
  const loader = fakeSource({ id }, { records: companies(1, 3) });
  loader.fetch = async (ctx) => {
    writeFileSync(join(ctx.workDir as string, "people.csv"), WORK_SENTINEL);
    if (after === "stall") await new Promise(() => {});
    return { artifacts: [{ name: "people.csv", bytes: new Uint8Array(), fetchedAt: ctx.now, file: { path: join(ctx.workDir as string, "people.csv"), size: WORK_SENTINEL.length, sha256: "x" } }] };
  };
  loader.asOf = () => ({ in_file_field: "2026-11-01" });
  loader.parse = function* () {
    if (after === "crash") process.exit(3);
    const held: number[][] = [];
    for (;;) if (after === "oom") held.push(Array.from({ length: 1_000_000 }, (_, i) => i));
  };
  return loader;
}
const streamed = (["hang", "crash", "oom", "stall"] as const).map((after) => streamedThen(`fake-stream-${after}`, after));

await serveSyncWorker((sourceId) => [slowSource, liveSource, sentinelSource, stuckSource, hungSource, crashSource, oomSource, oomMidSource, ...streamed].find((l) => l.meta.id === sourceId));
